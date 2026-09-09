import type { APIRoute } from "astro";
import { admiteCP } from "~/lib/entrega";
import {
  borrarDireccion,
  crearDireccion,
  listarDirecciones,
  marcarPredeterminada,
  traduceError,
  MENSAJE_DIRECCION_AJENA,
} from "~/lib/db/direcciones";

// Escribe y lee en Postgres a partir de la sesión de la petición: no puede
// prerenderizarse.
export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const cuerpoJSON = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  try {
    const raw = await request.json();
    return raw && typeof raw === "object"
      ? (raw as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

export const GET: APIRoute = async ({ locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  try {
    const direcciones = await listarDirecciones(usuario.id);
    return json({ direcciones });
  } catch (error) {
    const { mensaje, status } = traduceError(
      error,
      "No se pudieron cargar las direcciones.",
    );
    return json({ error: mensaje }, status);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  const cuerpo = await cuerpoJSON(request);

  const alias = typeof cuerpo.alias === "string" ? cuerpo.alias.trim() : "";
  const calle = typeof cuerpo.calle === "string" ? cuerpo.calle.trim() : "";
  const postalCode =
    typeof cuerpo.postalCode === "string" ? cuerpo.postalCode.trim() : "";
  const predeterminada = cuerpo.predeterminada === true;

  if (!alias) return json({ error: "Dale un nombre a la dirección." }, 400);
  if (!calle) return json({ error: "Escribe la calle y el número." }, 400);

  // La validación del navegador es una comodidad: quien llame aquí
  // directamente no puede colar un envío fuera de zona.
  if (!admiteCP(postalCode)) {
    return json(
      { error: `No repartimos en el código postal ${postalCode}.` },
      400,
    );
  }

  try {
    const direccion = await crearDireccion(usuario.id, {
      alias,
      calle,
      postalCode,
      predeterminada,
    });
    return json({ direccion }, 201);
  } catch (error) {
    const { mensaje, status } = traduceError(
      error,
      "No se pudo guardar la dirección.",
    );
    return json({ error: mensaje }, status);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  const cuerpo = await cuerpoJSON(request);
  const id = typeof cuerpo.id === "string" ? cuerpo.id : "";
  if (!id) return json({ error: "Falta la dirección a marcar." }, 400);

  try {
    // El id sale de la sesión, nunca del cuerpo de la petición:
    // `marcarPredeterminada` solo toca filas de `usuario.id`. Si el id ya no
    // existe o es de otro, lanza en vez de devolver `ok` y dejar al usuario
    // sin ninguna predeterminada: ese fallo llega aquí como un error normal,
    // nunca como un `{ok:true}` engañoso.
    await marcarPredeterminada(usuario.id, id);
    return json({ ok: true });
  } catch (error) {
    const { mensaje, status } = traduceError(
      error,
      "No se pudo marcar la dirección como predeterminada.",
    );
    return json({ error: mensaje }, status);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const usuario = locals.usuario;
  if (!usuario) return new Response("No autorizado", { status: 401 });

  const cuerpo = await cuerpoJSON(request);
  const id = typeof cuerpo.id === "string" ? cuerpo.id : "";
  if (!id) return json({ error: "Falta la dirección a borrar." }, 400);

  try {
    // `borrarDireccion` solo borra si la fila es de `usuario.id`: el número
    // de filas afectadas distingue «borrada» de «no era tuya».
    const borradas = await borrarDireccion(usuario.id, id);
    if (borradas === 0) {
      return json({ error: MENSAJE_DIRECCION_AJENA }, 404);
    }
    return json({ ok: true });
  } catch (error) {
    const { mensaje, status } = traduceError(
      error,
      "No se pudo borrar la dirección.",
    );
    return json({ error: mensaje }, status);
  }
};
