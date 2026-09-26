/**
 * Actualiza la tabla `productos` a la carta final (CARTA_PRECIOS_FINAL.pptx,
 * septiembre de 2026).
 *
 * Solo cambia nombres, descripciones, la etiqueta de los tamaños y las
 * raciones. NO toca precios (coinciden todos con la carta final), ni slugs
 * (son las URL de las fichas y la referencia de los pedidos ya hechos), ni
 * el orden (sale del documento de best sellers, no de la carta).
 *
 *   node --env-file=.env scripts/actualizar-carta-final.mjs            # enseña qué cambiaría
 *   node --env-file=.env scripts/actualizar-carta-final.mjs --aplicar  # lo aplica
 *
 * Antes de aplicar guarda una copia de las filas afectadas en
 * `--copia=<fichero>` (obligatorio con --aplicar). Todo va en una
 * transacción: o entra la carta entera o no entra nada.
 */
import pg from "pg";
import { writeFileSync } from "node:fs";

// Etiquetas de tamaño de la carta final, por tipo de producto.
const TARTA = {
  pequena: "S · 6–8 rac.",
  mediana: "M · 10–12 rac.",
  grande: "XL · 15–20 rac.",
};
const PLANCHA = { pequena: "L · 12–15 rac.", grande: "XL · 24–30 rac." };
const BRAZO = { mini: "S · 4–6 rac.", brazo: "M · 8–10 rac." };

const PLANCHA_DESC =
  "Plancha «San Lorenzo»: las de toda la vida, para mesas largas. XL de 24–30 raciones, L de 12–15.";
const ESPECIAL_DESC =
  "Plancha especial: sabores que solo salen de nuestro horno. XL de 24–30 raciones, L de 12–15.";
const EMPANADA_DESC =
  "Hojaldre del Horno San Lorenzo, receta artesanal asturiana. Entera de 16–20 raciones, media de 8–10.";
const QUICHE_DESC = "Quiche artesana de 10 raciones.";
const MINI_SALADO_DESC =
  "Mini croissants salados rellenos, en cajas de 6, 12 y 24 unidades.";

/** slug → cambios. `variantes` es variant_id → etiqueta nueva. */
const CAMBIOS = {
  // Dulce · Tartas
  "bombon-noir": { name: "Bombón de Chocolate Negro", variantes: TARTA },
  "la-sacher-de-frambuesa": {
    name: "Sacher, Chocolate y Frambuesa",
    variantes: TARTA,
  },
  "bombon-ivoire": { name: "Bombón de Chocolate Blanco", variantes: TARTA },
  "la-san-marcos": { name: "San Marcos Nata y Trufa", variantes: TARTA },
  "la-trufada": { name: "Nata y Trufa", variantes: TARTA },
  "corona-de-fresas": { name: "Fresas Naturales y Nata", variantes: TARTA },
  "la-selva-negra": { name: "Selva Negra", variantes: TARTA },
  "corona-de-frutas": { name: "Frutas y Nata", variantes: TARTA },
  "la-nupcial": { variantes: TARTA },
  "la-americana": {
    name: "Americana de Zanahoria",
    // No hay grande: en la carta es «—».
    variantes: { pequena: TARTA.pequena, mediana: TARTA.mediana },
  },

  // Dulce · Cremosas
  "cremoso-de-queso": {
    name: "Flan de Queso",
    short: "Flan de queso espectacular, recomendación del chef.",
  },
  "arroz-con-leche-del-obrador": {
    short: "Receta tradicional, elaboración diaria, recomendación del chef.",
  },
  "los-tres-chocolates": { name: "Tres Chocolates" },
  "la-mousse-de-chocolate": { name: "Mousse de Chocolate" },
  "cheesecake-de-arandanos": {
    name: "Queso y Arándanos",
    short: "Tarta cremosa de queso con arándanos.",
  },
  "cheesecake-de-frambuesa": {
    name: "Queso y Frambuesa",
    short: "Tarta cremosa de queso con frambuesa.",
  },
  "crema-y-frutas-de-temporada": {
    name: "Frutas y Crema",
    short: "Frutas variadas y deliciosa crema.",
  },
  "la-santiago": {
    name: "Santiago con Almendras",
    short: "Tarta de Santiago con almendras de las de verdad.",
  },
  "la-fina-de-manzana": {
    name: "Manzana y Crema",
    short: "Manzana y deliciosa crema.",
  },

  // Dulce · Planchas
  "plancha-oreo": { short: PLANCHA_DESC, variantes: PLANCHA },
  "plancha-fresa-y-nata": {
    name: "Fresa & Nata",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },
  "plancha-yema-y-nata": {
    name: "Yema & Nata",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },
  "plancha-nata-y-trufa": {
    name: "Nata & Trufa",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },
  "plancha-san-marcos-nata": { short: PLANCHA_DESC, variantes: PLANCHA },
  "plancha-san-marcos-trufa": { short: PLANCHA_DESC, variantes: PLANCHA },
  "plancha-chocolate-y-nata": {
    name: "Chocolate & Nata",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },
  "plancha-chocolate-y-trufa": {
    name: "Chocolate & Trufa",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },
  "plancha-yogur-y-limon": {
    name: "Yogur & Limón",
    short: PLANCHA_DESC,
    variantes: PLANCHA,
  },

  // Dulce · Colección especial de planchas
  "plancha-red-velvet": { short: ESPECIAL_DESC, variantes: PLANCHA },
  "plancha-carrot-cake": { name: "De Zanahoria", variantes: PLANCHA },
  "plancha-nata-y-trufa-con-chocolate-rizado": {
    short: ESPECIAL_DESC,
    variantes: PLANCHA,
  },
  "plancha-tiramisu": { short: ESPECIAL_DESC, variantes: PLANCHA },
  "plancha-dulce-de-leche": { short: ESPECIAL_DESC, variantes: PLANCHA },
  "plancha-queso-con-frambuesa": { short: ESPECIAL_DESC, variantes: PLANCHA },
  "plancha-queso-con-arandanos": { short: ESPECIAL_DESC, variantes: PLANCHA },
  "plancha-fresas-en-trocitos-con-nata": {
    short: ESPECIAL_DESC,
    variantes: PLANCHA,
  },
  // Solo tamaño XL: la descripción no puede prometer el pequeño.
  "plancha-manzana-y-crema": {
    short: "Plancha especial de 24–30 raciones.",
    unit: "XL · 24–30 rac.",
  },
  "plancha-milhojas-de-nata-y-crema": {
    short: "Plancha especial de 24–30 raciones.",
    unit: "XL · 24–30 rac.",
  },
  "plancha-frutas-con-crema": {
    short: "Recomendación del chef. Plancha de 24–30 raciones.",
    unit: "XL · 24–30 rac.",
  },

  // Dulce · Bocaditos
  "trufas-del-obrador": { name: "Trufitas del Obrador" },
  "bocados-de-nata-y-trufa": { name: "Bocaditos de Nata y Trufa" },
  "coleccion-de-petisus": {
    short: "Pasteles rellenos variados · 1 kg ≈ 40 ud / ½ kg ≈ 20 ud.",
  },

  // Dulce · Brazos
  "brazo-el-segoviano": { name: "Ponche Segoviano", variantes: BRAZO },
  "brazo-el-clasico": { name: "Gitano", unit: "M · 8–10 rac." },
  "brazo-tiramisu-y-mascarpone": { variantes: BRAZO },
  "brazo-milhojas-de-nata-y-crema": {
    name: "Milhojas Nata y Crema",
    unit: "M · 8–10 rac.",
  },
  "brazo-fresas-naturales-con-nata": { unit: "M · 8–10 rac." },
  "brazo-san-marcos-nata-y-trufa": {
    name: "San Marcos con Nata y Trufa",
    unit: "M · 8–10 rac.",
  },
  "brazo-frutas-variadas": { unit: "M · 8–10 rac." },
  "brazo-tres-chocolates": { unit: "M · 8–10 rac." },
  "brazo-selva-negra": { unit: "M · 8–10 rac." },
  "brazo-milhojas-de-nata-crema-y-frambuesa": {
    name: "Milhoja de Nata, Crema y Frambuesa",
    unit: "M · 8–10 rac.",
  },

  // Dulce · Ocasiones para celebrar (el precio de la foto se queda: ver aviso)
  "tarta-retrato": { name: "Tarta con Fotografía personalizada" },
  "oblea-ilustrada": { name: "Oblea Infantil" },
  "plancha-de-celebracion-tematica": {
    name: "Plancha Campo de Fútbol",
    short: "24 raciones.",
  },

  // Dulce · Mini croissants
  "mini-croissants-caladas": { name: "Calados" },
  "mini-croissants-rellenas": { name: "Rellenos" },

  // Salado · Empanadas y supremas
  "empanada-de-bonito": { short: EMPANADA_DESC },
  "empanada-de-carne": { short: EMPANADA_DESC },
  "empanada-de-jamon-y-queso": { short: EMPANADA_DESC },
  "empanada-de-pollo-y-datiles": { short: EMPANADA_DESC },
  "empanada-de-chistorra-bacon-y-queso": { short: EMPANADA_DESC },
  "empanada-de-picadillo-adobado": { name: "Picadillo Adobado" },
  "suprema-salmon-cebolla-caramelizada-y-queso-crema": {
    name: "Salmón, Cebolla Caramelizada y Queso Philadelphia",
  },
  "suprema-queso-de-cabra-y-piquillos": {
    name: "Queso de Cabra con Pimientos del Piquillo",
    short: "Vegetariana.",
  },

  // Salado · Quiches (la carta final las da de 10 raciones)
  "quiche-carbonara": { unit: "10 raciones", short: QUICHE_DESC },
  "quiche-espinacas-queso-y-pasas": {
    unit: "10 raciones",
    short: `Vegetariana. ${QUICHE_DESC}`,
  },
  "quiche-puerros-cebolla-y-bacon": { unit: "10 raciones", short: QUICHE_DESC },
  "quiche-trigueros-y-tomate-cherry": {
    unit: "10 raciones",
    short: `Vegetariana. ${QUICHE_DESC}`,
  },
  "quiche-champinon-y-jamon-serrano": {
    unit: "10 raciones",
    short: QUICHE_DESC,
  },
  "quiche-salchicha-y-queso": {
    name: "Salchichas y Queso",
    unit: "10 raciones",
    short: "La favorita de los peques.",
  },

  // Salado · Mini croissants
  "mini-croissants-york-y-queso": { short: MINI_SALADO_DESC },
  "mini-croissants-serrano-y-tomate": { short: MINI_SALADO_DESC },
  "mini-croissants-crema-de-sobrasada": { short: MINI_SALADO_DESC },
  "mini-croissants-bonito-con-mayonesa": { short: MINI_SALADO_DESC },
  "mini-croissants-salmon-y-queso-crema": { short: MINI_SALADO_DESC },
};

const aplicar = process.argv.includes("--aplicar");
const copia = process.argv.find((a) => a.startsWith("--copia="))?.slice(8);
if (aplicar && !copia) {
  console.error(
    "Con --aplicar hace falta --copia=<fichero> para guardar cómo estaba.",
  );
  process.exit(1);
}

const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const slugs = Object.keys(CAMBIOS);
const { rows: filas } = await c.query(
  `select id, slug, name, short_description, unit from productos where slug = any($1)`,
  [slugs],
);
const { rows: vars } = await c.query(
  `select v.producto_id, v.variant_id, v.label, v.price_cents from variantes v
     join productos p on p.id = v.producto_id where p.slug = any($1)`,
  [slugs],
);

const faltan = slugs.filter((s) => !filas.some((f) => f.slug === s));
if (faltan.length) {
  console.error("No existen en la base:", faltan.join(", "));
  process.exit(1);
}

let n = 0;
const sentencias = [];
for (const f of filas) {
  const cambio = CAMBIOS[f.slug];
  for (const [campo, col] of [
    ["name", "name"],
    ["short", "short_description"],
    ["unit", "unit"],
  ]) {
    if (cambio[campo] !== undefined && cambio[campo] !== f[col]) {
      console.log(`${f.slug} · ${col}: «${f[col]}» → «${cambio[campo]}»`);
      sentencias.push([
        `update productos set ${col} = $1, updated_at = now() where id = $2`,
        [cambio[campo], f.id],
      ]);
      n++;
    }
  }
  for (const [variantId, label] of Object.entries(cambio.variantes ?? {})) {
    const v = vars.find(
      (x) => x.producto_id === f.id && x.variant_id === variantId,
    );
    if (!v) {
      console.error(`${f.slug}: no tiene la variante «${variantId}»`);
      process.exit(1);
    }
    if (v.label !== label) {
      console.log(`${f.slug} · tamaño ${variantId}: «${v.label}» → «${label}»`);
      sentencias.push([
        `update variantes set label = $1 where producto_id = $2 and variant_id = $3`,
        [label, f.id, variantId],
      ]);
      n++;
    }
  }
}
console.log(`\n${n} cambios en ${filas.length} fichas.`);

if (!aplicar) {
  console.log("Sin --aplicar: no se ha tocado nada.");
  await c.end();
  process.exit(0);
}

writeFileSync(
  copia,
  JSON.stringify({ productos: filas, variantes: vars }, null, 2),
);
console.log(`Copia de cómo estaba: ${copia}`);

try {
  await c.query("begin");
  for (const [sql, params] of sentencias) await c.query(sql, params);
  await c.query("commit");
  console.log("Aplicado.");
} catch (e) {
  await c.query("rollback");
  console.error("Falló y no se ha aplicado nada:", e.message);
  process.exit(1);
}
await c.end();

// Las páginas del catálogo van por ISR: se piden de nuevo para que se vea ya.
const token = process.env.VERCEL_BYPASS_TOKEN;
// El `.env` de desarrollo apunta a localhost, donde no hay ISR: la caché que
// importa es la de producción.
const base = /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_SITE_URL ?? "")
  ? "https://hornosanlorenzo.vercel.app"
  : process.env.PUBLIC_SITE_URL;
if (token && base) {
  const rutas = [
    "/",
    "/catalogo",
    "/catalogo/dulce",
    "/catalogo/salado",
    "/catalogo/top-ventas",
    "/sitemap-contenido.xml",
    ...slugs.map((s) => `/catalogo/${s}`),
  ];
  const res = await Promise.all(
    rutas.map((r) =>
      fetch(new URL(r, base), {
        method: "HEAD",
        headers: { "x-prerender-revalidate": token },
      })
        .then((x) => x.status)
        .catch(() => "error"),
    ),
  );
  const malas = rutas.filter((_, i) => res[i] !== 200);
  console.log(
    `Caché: ${rutas.length - malas.length}/${rutas.length} rutas refrescadas.${malas.length ? " Fallan: " + malas.join(", ") : ""}`,
  );
} else {
  console.log(
    "Sin VERCEL_BYPASS_TOKEN o PUBLIC_SITE_URL: la caché se renovará sola.",
  );
}
