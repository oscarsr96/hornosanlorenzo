import { pool } from "~/lib/db/pool";

/**
 * Los clientes, para el panel. La spec §8 lo dice tal cual: «nombre, correo
 * y teléfono, para conocerlos y poder llamar». Nada más.
 */
export type Cliente = {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: string | null;
  creadoEn: Date;
  /** Cuántos pedidos pagados lleva. Es la única cifra que pide el panel. */
  pedidos: number;
};

/**
 * Las columnas van nombradas una a una y jamás `select *`: la tabla `user`
 * es de Better Auth y puede crecer con campos que no deben salir de ahí.
 * La contraseña vive en `account`, y esta consulta no la toca.
 */
export async function listarClientes(limite = 500): Promise<Cliente[]> {
  const { rows } = await pool.query<Cliente>(
    `select u.id,
            u.name          as nombre,
            u.email,
            u.telefono,
            u.rol,
            u."createdAt"   as "creadoEn",
            (select count(*)::int
               from pedidos p
              where p.user_id = u.id and p.estado = 'pagado') as pedidos
       from "user" u
      order by u."createdAt" desc
      limit $1`,
    [limite],
  );
  return rows;
}
