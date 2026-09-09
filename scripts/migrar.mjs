import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

const DIR = "db/migrations";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL");
  process.exit(1);
}

const cliente = new pg.Client({ connectionString: url });
await cliente.connect();

await cliente.query(`
  create table if not exists _migraciones (
    nombre      text primary key,
    aplicada_en timestamptz not null default now()
  )
`);

const { rows } = await cliente.query("select nombre from _migraciones");
const aplicadas = new Set(rows.map((r) => r.nombre));
const ficheros = (await readdir(DIR)).filter((f) => f.endsWith(".sql")).sort();

let nuevas = 0;
for (const fichero of ficheros) {
  if (aplicadas.has(fichero)) continue;
  const sql = await readFile(join(DIR, fichero), "utf8");
  try {
    await cliente.query("begin");
    await cliente.query(sql);
    await cliente.query("insert into _migraciones (nombre) values ($1)", [
      fichero,
    ]);
    await cliente.query("commit");
    console.log(`✓ ${fichero}`);
    nuevas++;
  } catch (err) {
    await cliente.query("rollback");
    console.error(`✗ ${fichero}\n`, err.message);
    process.exit(1);
  }
}

console.log(
  nuevas === 0 ? "Nada que aplicar." : `${nuevas} migración(es) aplicadas.`,
);
await cliente.end();
