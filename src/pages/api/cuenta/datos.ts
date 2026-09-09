import type { APIRoute } from "astro";
import { pool } from "~/lib/db/pool";
import { validaDatosPersonales } from "~/lib/auth/alta";

// Escribe en Postgres a partir de la sesión de la petición: no puede
// prerenderizarse.
export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const PATCH: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Petición mal formada." }, 400);
  }

  const cuerpo =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  // Mismas reglas que el alta (`preparaAltaUsuario`, en `~/lib/auth/alta`):
  // sería absurdo poder guardar editando un teléfono que el alta rechaza.
  const resultado = validaDatosPersonales({
    name: cuerpo.nombre,
    telefono: cuerpo.telefono,
  });
  if (!resultado.ok) {
    return json({ error: resultado.message }, 400);
  }

  // El id sale de la sesión, nunca del cuerpo de la petición: si viniera del
  // cliente, cualquiera podría editar la ficha de otro.
  await pool.query('update "user" set name = $1, telefono = $2 where id = $3', [
    resultado.data.name,
    resultado.data.telefono,
    usuario.id,
  ]);

  return json({ ok: true });
};
