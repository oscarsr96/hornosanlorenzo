import type { APIRoute } from "astro";
import { listarNoticias } from "~/lib/db/noticias";
import { listarProductos } from "~/lib/db/productos";
import { SIN_CACHE } from "~/lib/lectura-publica";

/**
 * `@astrojs/sitemap` solo recoge las páginas que se generan en construcción.
 * Las noticias y las fichas de producto ya no lo son (`prerender = false`),
 * así que sin esto desaparecerían del sitemap sin que nadie se enterase hasta
 * perder el posicionamiento. Va declarado en `public/robots.txt` junto al otro.
 */
export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("https://hornosanlorenzo-demo.vercel.app");

  let urls: { loc: string }[] = [];
  let fallo = false;
  try {
    const noticias = await listarNoticias({ soloPublicadas: true });
    urls = noticias.map((n) => ({
      loc: new URL(`/noticias/${n.slug}`, base).toString(),
    }));
    // Mismo motivo que las noticias: las fichas de producto son ahora
    // `prerender = false` (tarea 18), así que `@astrojs/sitemap` no las ve.
    const productos = await listarProductos({ soloActivos: true });
    urls = [
      ...urls,
      ...productos.map((p) => ({
        loc: new URL(`/catalogo/${p.slug}`, base).toString(),
      })),
    ];
  } catch (error) {
    // Un sitemap vacío es mejor que un 500: los buscadores reintentan. Pero
    // esta ruta va por ISR, así que un sitemap vacío que se GUARDE deja de
    // ser un reintento y pasa a ser la verdad del sitio hasta el siguiente
    // despliegue: se marca para no cachearlo (`~/lib/lectura-publica.ts`).
    fallo = true;
    console.error(
      "No se pudo construir el sitemap de contenido:",
      error instanceof Error ? error.message : error,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc></url>`).join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      ...(fallo ? SIN_CACHE : { "cache-control": "public, max-age=3600" }),
    },
  });
};
