import { Pool } from "pg";

/**
 * Único punto de conexión a Postgres. Nada más en el proyecto debe importar
 * `pg` directamente: cuando esto se mude a Cloud SQL, se cambia aquí y ya.
 *
 * `max: 3` porque cada función sin estado de Vercel abre su propio pool y el
 * proveedor tiene un límite de conexiones bajo en los planes pequeños.
 */
const connectionString =
  import.meta.env.DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Cópiala de .env.example y ponla en .env y en Vercel.",
  );
}

// `connectionTimeoutMillis`: sin esto, un `pool.connect()`/`pool.query()`
// que no puede conseguir hueco se queda esperando para siempre, no falla.
// Es defensa en profundidad: si algún día se reintroduce un interbloqueo
// (varias funciones reteniendo un cliente mientras esperan otro del mismo
// pool agotado — el bug que corrigió la tarea 14), el sitio no se cuelga en
// silencio, lanza un error a los diez segundos que sí queda en los logs.
export const pool = new Pool({
  connectionString,
  max: 3,
  connectionTimeoutMillis: 10_000,
});
