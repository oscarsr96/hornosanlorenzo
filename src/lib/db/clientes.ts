import { pool } from "~/lib/db/pool";
import { patronBusqueda } from "~/lib/db/busqueda";

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
 *
 * `texto` es la búsqueda libre del panel (nombre, correo o teléfono, con el
 * mismo criterio que en pedidos); vacío, devuelve a todos.
 */
export async function listarClientes(limite = 500, texto?: string): Promise<Cliente[]> {
  const busqueda = patronBusqueda(texto);
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
      where ($2::text is null
             or u.name ilike $2
             or u.email ilike $2
             or u.telefono ilike $2
             -- El teléfono lo escribe el cliente al registrarse, con o sin
             -- espacios; si lo buscado son solo dígitos se compara sin
             -- separadores por ambos lados.
             or ($3::text is not null
                 and regexp_replace(u.telefono, '\\D', '', 'g') like '%' || $3 || '%'))
      order by u."createdAt" desc
      limit $1`,
    [limite, busqueda.patron, busqueda.soloDigitos],
  );
  return rows;
}
