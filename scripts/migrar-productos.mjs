/**
 * Vuelca `src/content/products/*.md` a las tablas `productos` y `variantes`,
 * subiendo las fotos al almacén.
 *
 *   pnpm migrar:productos              vuelca
 *   pnpm migrar:productos --verificar  no escribe: compara ficha a ficha
 *
 * Idempotente: el slug es el nombre del fichero, así que las URLs de siempre
 * no cambian y volver a ejecutarlo actualiza en vez de duplicar. El
 * `on conflict` no toca `activo`/`agotado`: si el obrador marcó una ficha
 * como agotada, repetir el volcado no la resucita.
 *
 * Importa `@vercel/blob` y `sharp` directamente en vez de pasar por
 * `src/lib/storage` porque esto es un script de Node suelto, fuera del build
 * de Astro, y no resuelve el alias `~`.
 *
 * Esta es la tarea de riesgo de todo el plan: aquí es donde se puede perder
 * la carta si algo va mal. Por eso cada ficha se procesa en su propio
 * try/catch — un fallo (una foto que falta, un error de sharp, un corte de
 * red al subir) se reporta con la misma voz que el resto de fallos, sin
 * tumbar el resto de las 98 fichas ni ensuciar la salida con un stack trace.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import pg from "pg";
import { put } from "@vercel/blob";
import sharp from "sharp";

const DIR = "src/content/products";
const soloVerificar = process.argv.includes("--verificar");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}
if (!soloVerificar && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error(
    "Falta BLOB_READ_WRITE_TOKEN: sin él no se pueden subir las fotos",
  );
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

/** Las 98 fichas comparten 8 fotos: cada fichero se sube una sola vez. */
const fotosSubidas = new Map();

async function subeFoto(rutaRelativa) {
  const ruta = rutaRelativa.replace(/^(\.\.\/)+/, "");
  if (fotosSubidas.has(ruta)) return fotosSubidas.get(ruta);

  const original = await readFile(ruta);
  const salida = await sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const nombre = basename(ruta).replace(/\.[a-z0-9]+$/i, "");
  const { url } = await put(`productos/${nombre}.webp`, salida.data, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  const foto = { url, ancho: salida.info.width, alto: salida.info.height };
  fotosSubidas.set(ruta, foto);
  console.log(`  foto ↑ ${nombre}.webp`);
  return foto;
}

/**
 * Solo para `--verificar`: repite el mismo `resize` del volcado (sin subir
 * nada) para saber qué ancho/alto debería haber quedado en la base de
 * datos. Cacheado igual que `subeFoto`, porque son las mismas 8 fotos.
 */
const dimensionesCache = new Map();

async function dimensionesEsperadas(ruta) {
  if (dimensionesCache.has(ruta)) return dimensionesCache.get(ruta);
  const original = await readFile(ruta);
  const { info } = await sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const esperado = { ancho: info.width, alto: info.height };
  dimensionesCache.set(ruta, esperado);
  return esperado;
}

const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
let escritos = 0;
let problemas = 0;

for (const fichero of ficheros) {
  const slug = basename(fichero, ".md");
  try {
    const { data, content } = matter(
      await readFile(join(DIR, fichero), "utf8"),
    );
    const variantes = data.variants ?? [];

    if (soloVerificar) {
      const { rows } = await cliente.query(
        `select p.id, p.name, p.category, p.seccion, p.price_cents, p.consultar,
                p.unit, p.short_description, p.cuerpo, p.allergens, p.destacado,
                p.temporada, p.orden, p.image_url, p.image_alt, p.image_width,
                p.image_height
           from productos p where p.slug = $1`,
        [slug],
      );
      if (rows.length === 0) {
        console.error(`✗ ${slug}: no está en la base de datos`);
        problemas++;
        continue;
      }
      const f = rows[0];
      const dif = [];
      if (f.name !== data.name)
        dif.push(`nombre: «${f.name}» ≠ «${data.name}»`);
      if (f.category !== data.category)
        dif.push(`categoría: ${f.category} ≠ ${data.category}`);
      if ((f.seccion ?? null) !== (data.seccion ?? null))
        dif.push("sección distinta");
      if (f.price_cents !== (data.priceCents ?? null))
        dif.push(`PRECIO: ${f.price_cents} ≠ ${data.priceCents ?? null}`);
      if (f.consultar !== Boolean(data.consultar))
        dif.push("«consultar» distinto");
      if ((f.unit ?? null) !== (data.unit ?? null)) dif.push("unidad distinta");
      if (f.short_description !== data.shortDescription)
        dif.push("descripción distinta");
      if (f.cuerpo.trim() !== content.trim()) dif.push("cuerpo distinto");
      if (JSON.stringify(f.allergens) !== JSON.stringify(data.allergens ?? []))
        dif.push("alérgenos distintos");
      if (f.destacado !== Boolean(data.featured))
        dif.push("«destacado» distinto");
      if (f.temporada !== Boolean(data.seasonal))
        dif.push("«temporada» distinto");
      if (f.orden !== (data.order ?? 100))
        dif.push(`orden: ${f.orden} ≠ ${data.order ?? 100}`);
      if (data.image && !f.image_url) dif.push("sin foto");
      if ((f.image_alt ?? null) !== (data.imageAlt ?? null))
        dif.push("texto alternativo distinto");
      // Las 98 fichas comparten 8 fotos: si un resize saliera mal, las
      // dimensiones estarían mal en todas las fichas que usan esa foto a la
      // vez, así que se comparan aunque la URL ya coincida. Se recalculan
      // con el mismo `resize` que usa el volcado —no a mano: el redondeo de
      // sharp no tiene por qué coincidir con una cuenta hecha aparte.
      if (data.image) {
        const ruta = data.image.replace(/^(\.\.\/)+/, "");
        try {
          const esperado = await dimensionesEsperadas(ruta);
          if (
            f.image_width !== esperado.ancho ||
            f.image_height !== esperado.alto
          ) {
            dif.push(
              `dimensiones: ${f.image_width}×${f.image_height} ≠ ${esperado.ancho}×${esperado.alto}`,
            );
          }
        } catch {
          dif.push(
            `no se pudo leer la foto original para comparar dimensiones (${ruta})`,
          );
        }
      }

      const { rows: vs } = await cliente.query(
        `select variant_id, label, price_cents from variantes
          where producto_id = $1 order by orden`,
        [f.id],
      );
      if (vs.length !== variantes.length) {
        dif.push(
          `VARIANTES: ${vs.length} en la base, ${variantes.length} en el fichero`,
        );
      } else {
        for (const [i, v] of variantes.entries()) {
          if (vs[i].variant_id !== v.id || vs[i].price_cents !== v.priceCents) {
            dif.push(
              `variante ${v.id}: ${vs[i].price_cents} ≠ ${v.priceCents}`,
            );
          }
        }
      }

      if (dif.length) {
        console.error(`✗ ${slug}: ${dif.join("; ")}`);
        problemas++;
      }
      continue;
    }

    const foto = data.image ? await subeFoto(data.image) : null;

    const { rows } = await cliente.query(
      `insert into productos
         (slug, name, category, seccion, price_cents, consultar, unit,
          short_description, cuerpo, allergens, destacado, temporada, orden,
          image_url, image_alt, image_width, image_height, activo, agotado)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,false)
       on conflict (slug) do update set
         name = excluded.name, category = excluded.category,
         seccion = excluded.seccion, price_cents = excluded.price_cents,
         consultar = excluded.consultar, unit = excluded.unit,
         short_description = excluded.short_description, cuerpo = excluded.cuerpo,
         allergens = excluded.allergens, destacado = excluded.destacado,
         temporada = excluded.temporada, orden = excluded.orden,
         image_url = excluded.image_url, image_alt = excluded.image_alt,
         image_width = excluded.image_width, image_height = excluded.image_height,
         updated_at = now()
       returning id`,
      [
        slug,
        data.name,
        data.category,
        data.seccion ?? null,
        data.priceCents ?? null,
        Boolean(data.consultar),
        data.unit ?? null,
        data.shortDescription,
        content.trim(),
        data.allergens ?? [],
        Boolean(data.featured),
        Boolean(data.seasonal),
        data.order ?? 100,
        foto?.url ?? null,
        data.imageAlt ?? null,
        foto?.ancho ?? null,
        foto?.alto ?? null,
      ],
    );

    await cliente.query("delete from variantes where producto_id = $1", [
      rows[0].id,
    ]);
    for (const [i, v] of variantes.entries()) {
      await cliente.query(
        `insert into variantes (producto_id, variant_id, label, price_cents, orden)
         values ($1,$2,$3,$4,$5)`,
        [rows[0].id, v.id, v.label, v.priceCents, i],
      );
    }

    escritos++;
  } catch (error) {
    console.error(`✗ ${slug}: ${error.message}`);
    problemas++;
  }
}

// El recuento importa tanto como los campos: una ficha de más en la base de
// datos (un slug viejo que ya no está en el repositorio) también es un fallo.
const { rows: total } = await cliente.query(
  "select count(*)::int as n from productos",
);
await cliente.end();

if (soloVerificar) {
  if (total[0].n !== ficheros.length) {
    console.error(
      `✗ hay ${total[0].n} fichas en la base de datos y ${ficheros.length} ficheros`,
    );
    problemas++;
  }
  // Con 98 fichas un solo «✗» se puede escapar en la pantalla: el último
  // renglón tiene que ser el veredicto, sin lugar a dudas.
  console.log(
    `\n${ficheros.length} ficha(s) comprobadas, ${problemas} problema(s).`,
  );
  console.log(
    problemas === 0
      ? `Todo cuadra: ${ficheros.length} fichas, campo a campo.`
      : `NO retires los Markdown.`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}
console.log(
  `\n${escritos} ficha(s) volcadas, ${problemas} problema(s), ${fotosSubidas.size} foto(s) subidas.` +
    `\nAhora: pnpm migrar:productos --verificar`,
);
if (problemas > 0) process.exit(1);
