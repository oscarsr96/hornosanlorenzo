import type { APIRoute } from "astro";
import { z } from "zod";
import {
  listarNoticias,
  crearNoticia,
  actualizarNoticia,
  borrarNoticia,
  NoticiaError,
} from "~/lib/db/noticias";
import { invalidar, RUTAS_NOTICIAS } from "~/lib/cache";
import { esAdmin } from "~/lib/auth/guardia";

export const prerender = false;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

/**
 * 404, no 401 ni 403: mismo criterio que las páginas del panel (spec §7). Un
 * 403 le confirma a cualquiera que ahí detrás hay algo que atacar.
 */
const noEncontrado = () => new Response("No encontrado", { status: 404 });

const esquema = z.object({
  titulo: z.string().trim().min(3).max(140),
  excerpt: z.string().trim().min(10).max(240),
  cuerpo: z.string().max(20_000).default(""),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  imageUrl: z.string().url().nullable().default(null),
  imageAlt: z.string().trim().max(200).nullable().default(null),
  imageWidth: z.number().int().positive().nullable().default(null),
  imageHeight: z.number().int().positive().nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  publicada: z.boolean().default(false),
});

async function cuerpoJSON(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Una foto sin texto alternativo es una foto que no existe para quien usa un
 * lector de pantalla. Se pide aquí, en el servidor, y no solo en el formulario.
 */
function compruebaAlt(datos: z.infer<typeof esquema>): string | null {
  if (datos.imageUrl && !datos.imageAlt) {
    return "Escribe qué se ve en la foto: hace falta para quien no puede verla.";
  }
  return null;
}

export const GET: APIRoute = async ({ locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();
  try {
    return json({ noticias: await listarNoticias({ soloPublicadas: false }) });
  } catch (error) {
    console.error("[admin/noticias] no se pudieron leer:", error);
    return json({ error: "No se pudieron cargar las noticias." }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const parsed = esquema.safeParse(await cuerpoJSON(request));
  if (!parsed.success)
    return json({ error: "Faltan datos de la noticia." }, 400);

  const falta = compruebaAlt(parsed.data);
  if (falta) return json({ error: falta }, 400);

  try {
    const noticia = await crearNoticia(parsed.data);
    // Se invalida después de guardar, y `invalidar` nunca lanza: si falla, el
    // cambio ya está escrito y solo tarda un poco más en verse.
    await invalidar(RUTAS_NOTICIAS);
    return json({ noticia }, 201);
  } catch (error) {
    if (error instanceof NoticiaError)
      return json({ error: error.message }, error.status);
    console.error("[admin/noticias] no se pudo crear:", error);
    return json({ error: "No se pudo guardar la noticia." }, 500);
  }
};

export const PUT: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const bruto = await cuerpoJSON(request);
  const id = (bruto as { id?: unknown })?.id;
  if (typeof id !== "string")
    return json({ error: "Falta la noticia a editar." }, 400);

  const parsed = esquema.safeParse(bruto);
  if (!parsed.success)
    return json({ error: "Faltan datos de la noticia." }, 400);

  const falta = compruebaAlt(parsed.data);
  if (falta) return json({ error: falta }, 400);

  try {
    const noticia = await actualizarNoticia(id, parsed.data);
    if (!noticia) return json({ error: "Esa noticia ya no existe." }, 404);
    await invalidar([...RUTAS_NOTICIAS, `/noticias/${noticia.slug}`]);
    return json({ noticia });
  } catch (error) {
    if (error instanceof NoticiaError)
      return json({ error: error.message }, error.status);
    console.error("[admin/noticias] no se pudo actualizar:", error);
    return json({ error: "No se pudo guardar la noticia." }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const bruto = await cuerpoJSON(request);
  const id = (bruto as { id?: unknown })?.id;
  if (typeof id !== "string")
    return json({ error: "Falta la noticia a borrar." }, 400);

  try {
    const borradas = await borrarNoticia(id);
    if (!borradas) return json({ error: "Esa noticia ya no existe." }, 404);
    await invalidar(RUTAS_NOTICIAS);
    return json({ ok: true });
  } catch (error) {
    console.error("[admin/noticias] no se pudo borrar:", error);
    return json({ error: "No se pudo borrar la noticia." }, 500);
  }
};
