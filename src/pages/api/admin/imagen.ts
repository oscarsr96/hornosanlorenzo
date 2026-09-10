import type { APIRoute } from "astro";
import { guardarImagen, ImagenError, type Carpeta } from "~/lib/storage";
import { esAdmin } from "~/lib/auth/guardia";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

const CARPETAS: Carpeta[] = ["productos", "noticias"];

export const POST: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario))
    return new Response("No encontrado", { status: 404 });

  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return json({ error: "No hemos recibido la foto." }, 400);
  }

  const fichero = formulario.get("foto");
  const carpeta = String(formulario.get("carpeta") ?? "");

  if (!(fichero instanceof File))
    return json({ error: "No hemos recibido la foto." }, 400);
  // La carpeta sale de una lista cerrada: si viniera del navegador tal cual,
  // se podría escribir en cualquier sitio del almacén.
  if (!CARPETAS.includes(carpeta as Carpeta)) {
    return json({ error: "Destino de la foto no válido." }, 400);
  }

  try {
    return json(await guardarImagen(fichero, carpeta as Carpeta));
  } catch (error) {
    if (error instanceof ImagenError)
      return json({ error: error.message }, error.status);
    console.error("[admin/imagen] no se pudo guardar la foto:", error);
    return json({ error: "No se pudo guardar la foto." }, 500);
  }
};
