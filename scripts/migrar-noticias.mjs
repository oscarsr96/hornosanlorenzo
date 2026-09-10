/**
 * Vuelca las noticias de `src/content/noticias/*.md` a la tabla `noticias`,
 * subiendo sus fotos al almacén.
 *
 *   pnpm migrar:noticias              vuelca (solo con la tabla vacía)
 *   pnpm migrar:noticias --verificar  no escribe: solo compara y avisa
 *   pnpm migrar:noticias --forzar     vuelca PISANDO lo que haya
 *
 * Se puede repetir: cada noticia se identifica por su slug —el nombre del
 * fichero, para que las URLs de siempre no cambien— y se actualiza en vez de
 * duplicarse. Pero «se actualiza» quiere decir que el `on conflict`
 * SOBREESCRIBE título, excerpt, cuerpo, fecha, foto, etiquetas y hasta
 * `publicada` con lo que diga el Markdown. Cualquier noticia escrita desde
 * el panel se revierte, y una despublicada a mano vuelve a publicarse. Por
 * eso se niega a escribir sobre una tabla con filas salvo con `--forzar`.
 *
 * Importa `@vercel/blob` directamente en vez de pasar por `src/lib/storage`
 * porque esto es un script de Node suelto, fuera del build de Astro, y no
 * resuelve el alias `~`. Es una migración que se ejecuta una vez, no parte
 * de la aplicación.
 */
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import matter from "gray-matter";
import pg from "pg";
import { put } from "@vercel/blob";
import sharp from "sharp";

const DIR = "src/content/noticias";
const soloVerificar = process.argv.includes("--verificar");
const forzar = process.argv.includes("--forzar");

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

/** La ruta del frontmatter es relativa al .md: `../../../public/...`. */
function rutaFoto(valor) {
  return valor.replace(/^(\.\.\/)+/, "");
}

async function subeFoto(ruta) {
  const original = await readFile(ruta);
  const salida = await sharp(original)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const nombre = basename(ruta).replace(/\.[a-z0-9]+$/i, "");
  const { url } = await put(`noticias/${nombre}.webp`, salida.data, {
    access: "public",
    contentType: "image/webp",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return { url, ancho: salida.info.width, alto: salida.info.height };
}

/**
 * Guardia de un solo uso. El `on conflict (slug) do update` de más abajo
 * pisa título, excerpt, cuerpo, fecha, foto, etiquetas y `publicada` con lo que
 * diga el Markdown. Eso está bien mientras la base de datos sea un volcado del
 * repositorio; deja de estarlo en cuanto el obrador empieza a editar desde
 * el panel — que es justo para lo que se hizo `/admin/noticias`.
 *
 * Tres meses después de arrancar, `pnpm migrar:noticias` sin más (o de
 * memoria, queriendo escribir `--verificar`) revierte las noticias del panel
 * a los Markdown de septiembre y vuelve a publicar lo despublicado, sin
 * preguntar nada. Por eso: si la tabla tiene filas, no se escribe salvo que
 * se pida a gritos con `--forzar`.
 */
async function rechazaSiYaHayDatos(cliente, tabla, comando) {
  const { rows } = await cliente.query(
    `select count(*)::int as n from ${tabla}`,
  );
  const n = rows[0].n;
  if (n === 0 || forzar) return;

  console.error(
    [
      `La tabla \`${tabla}\` ya tiene ${n} fila(s).`,
      "",
      "Este volcado las SOBREESCRIBE con lo que digan los Markdown: título,",
      "excerpt, cuerpo, fecha, foto, etiquetas y hasta `publicada`. Todo lo",
      "que se haya escrito desde el panel desde el volcado inicial se",
      "perdería sin aviso.",
      "",
      "Si lo que quieres es comprobar que la base de datos cuadra con los",
      `Markdown:   ${comando} --verificar`,
      "",
      "Si de verdad quieres volver a volcar y pisar las ediciones del panel,",
      `hazlo a propósito:   ${comando} --forzar`,
    ].join("\n"),
  );
  await cliente.end();
  process.exit(1);
}

if (!soloVerificar) await rechazaSiYaHayDatos(cliente, "noticias", "pnpm migrar:noticias");

const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".md")).sort();
let escritas = 0;
let problemas = 0;

for (const fichero of ficheros) {
  const slug = basename(fichero, ".md");
  const { data, content } = matter(await readFile(join(DIR, fichero), "utf8"));

  const fecha =
    data.date instanceof Date
      ? data.date.toISOString().slice(0, 10)
      : String(data.date).slice(0, 10);

  if (soloVerificar) {
    const { rows } = await cliente.query(
      `select titulo, excerpt, cuerpo, to_char(fecha,'YYYY-MM-DD') as fecha,
              image_url, image_alt, tags, publicada
         from noticias where slug = $1`,
      [slug],
    );
    if (rows.length === 0) {
      console.error(`✗ ${slug}: no está en la base de datos`);
      problemas++;
      continue;
    }
    const fila = rows[0];
    const diferencias = [];
    if (fila.titulo !== data.title)
      diferencias.push(`título: «${fila.titulo}» ≠ «${data.title}»`);
    if (fila.excerpt !== data.excerpt) diferencias.push("excerpt distinto");
    if (fila.cuerpo.trim() !== content.trim())
      diferencias.push("cuerpo distinto");
    if (fila.fecha !== fecha)
      diferencias.push(`fecha: ${fila.fecha} ≠ ${fecha}`);
    if (fila.image_alt !== data.imageAlt)
      diferencias.push("texto alternativo distinto");
    if (!fila.image_url) diferencias.push("sin foto");
    if (fila.publicada === Boolean(data.draft))
      diferencias.push("publicada al revés");
    if (JSON.stringify(fila.tags) !== JSON.stringify(data.tags ?? []))
      diferencias.push("etiquetas distintas");

    if (diferencias.length) {
      console.error(`✗ ${slug}: ${diferencias.join("; ")}`);
      problemas++;
    } else {
      console.log(`✓ ${slug}`);
    }
    continue;
  }

  const foto = data.image ? await subeFoto(rutaFoto(data.image)) : null;

  await cliente.query(
    `insert into noticias
       (slug, titulo, excerpt, cuerpo, fecha, image_url, image_alt,
        image_width, image_height, tags, publicada)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict (slug) do update set
       titulo = excluded.titulo, excerpt = excluded.excerpt,
       cuerpo = excluded.cuerpo, fecha = excluded.fecha,
       image_url = excluded.image_url, image_alt = excluded.image_alt,
       image_width = excluded.image_width, image_height = excluded.image_height,
       tags = excluded.tags, publicada = excluded.publicada,
       updated_at = now()`,
    [
      slug,
      data.title,
      data.excerpt,
      content.trim(),
      fecha,
      foto?.url ?? null,
      data.imageAlt ?? null,
      foto?.ancho ?? null,
      foto?.alto ?? null,
      data.tags ?? [],
      !data.draft,
    ],
  );
  console.log(`✓ ${slug}`);
  escritas++;
}

await cliente.end();

if (soloVerificar) {
  console.log(
    problemas === 0
      ? `\nTodo cuadra: ${ficheros.length} noticias.`
      : `\n${problemas} noticia(s) NO cuadran. No retires nada todavía.`,
  );
  process.exit(problemas === 0 ? 0 : 1);
}
console.log(
  `\n${escritas} noticia(s) volcadas. Ahora: pnpm migrar:noticias --verificar`,
);
