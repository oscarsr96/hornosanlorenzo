import { pool } from "~/lib/db/pool";
import { admiteCP } from "~/lib/entrega";

/**
 * Direcciones guardadas de un usuario. Hacia fuera todo va en camelCase;
 * el mapeo de columnas (`postal_code`, `user_id`) es cosa de este módulo,
 * nadie fuera de aquí debe ver nombres de columna.
 */
export type Direccion = {
  id: string;
  alias: string;
  calle: string;
  postalCode: string;
  predeterminada: boolean;
};

export type DatosDireccion = {
  alias: string;
  calle: string;
  postalCode: string;
  predeterminada: boolean;
};

const SELECT_CAMPOS = `
  id,
  alias,
  calle,
  postal_code as "postalCode",
  predeterminada
`;

/**
 * Mismo mensaje para «no existe» y «es de otro usuario»: distinguirlos le
 * diría a quien pruebe ids ajenos cuáles existen de verdad. Lo usan
 * `borrarDireccion` (vía el endpoint, que compone la respuesta a partir de
 * `rowCount`) y `marcarPredeterminada` (que lo lanza directamente), para que
 * el endpoint solo tenga que comparar contra una constante, no repetir el
 * texto.
 */
export const MENSAJE_DIRECCION_AJENA = "Esa dirección no existe o no es tuya.";

/** Todas las direcciones de un usuario, la predeterminada primero. */
export async function listarDirecciones(userId: string): Promise<Direccion[]> {
  const { rows } = await pool.query<Direccion>(
    `select ${SELECT_CAMPOS}
     from direcciones
     where user_id = $1
     order by predeterminada desc, created_at asc`,
    [userId],
  );
  return rows;
}

/**
 * Da de alta una dirección. Valida el código postal contra la zona de
 * reparto antes de tocar la base de datos: es la misma comprobación que usa
 * el checkout, así que nadie puede colar por aquí un envío fuera de zona.
 */
export async function crearDireccion(
  userId: string,
  datos: DatosDireccion,
): Promise<Direccion> {
  if (!admiteCP(datos.postalCode)) {
    throw new Error(`No repartimos en el código postal ${datos.postalCode}.`);
  }

  const { rows } = await pool.query<Direccion>(
    `insert into direcciones (user_id, alias, calle, postal_code, predeterminada)
     values ($1, $2, $3, $4, $5)
     returning ${SELECT_CAMPOS}`,
    [userId, datos.alias, datos.calle, datos.postalCode, datos.predeterminada],
  );
  return rows[0];
}

/**
 * Borra una dirección del usuario. Devuelve el número de filas afectadas
 * (0 o 1) para que quien llame distinga «borrada» de «no era tuya»: el
 * `where user_id = $1` es lo que impide borrar la dirección de otra
 * persona conociendo su id.
 */
export async function borrarDireccion(
  userId: string,
  id: string,
): Promise<number> {
  const { rowCount } = await pool.query(
    `delete from direcciones where id = $1 and user_id = $2`,
    [id, userId],
  );
  return rowCount ?? 0;
}

/**
 * Marca una dirección como predeterminada y desmarca el resto. Va en una
 * transacción: primero se quita la marca a todas las del usuario y luego se
 * pone en la elegida. Sin transacción, el índice único de la migración
 * podría rechazar a medias la segunda escritura y dejar al usuario sin
 * ninguna predeterminada.
 *
 * El segundo `update` puede no afectar a ninguna fila —el id ya no existe,
 * o es de otro usuario, por ejemplo una pestaña con la lista desactualizada
 * porque la dirección se borró en otra—. Si eso pasa, la primera consulta ya
 * ha desmarcado todas: sin comprobarlo, el `commit` dejaría al usuario sin
 * ninguna predeterminada aunque el resultado pareciera correcto. Por eso se
 * comprueba `rowCount` y, si es cero, se lanza antes del `commit`: el único
 * `catch`, más abajo, deshace la transacción entera con `rollback` y el
 * estado anterior queda intacto.
 */
export async function marcarPredeterminada(
  userId: string,
  id: string,
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query(
      `update direcciones set predeterminada = false where user_id = $1`,
      [userId],
    );
    const { rowCount } = await cliente.query(
      `update direcciones set predeterminada = true where id = $1 and user_id = $2`,
      [id, userId],
    );
    if (!rowCount) {
      throw new Error(MENSAJE_DIRECCION_AJENA);
    }
    await cliente.query("commit");
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}
