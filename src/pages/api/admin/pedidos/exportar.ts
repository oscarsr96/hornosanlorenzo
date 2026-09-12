import type { APIRoute } from "astro";
import { listarPedidos } from "~/lib/db/pedidos";
import { pedidosAExcel } from "~/lib/pedidos-excel";
import { esAdmin } from "~/lib/auth/guardia";

export const prerender = false;

/** 404, no 401 ni 403: mismo criterio que el resto del panel (spec §7). */
const noEncontrado = () => new Response("No encontrado", { status: 404 });

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Los mismos pedidos que enseña `/admin/pedidos`, con sus mismos filtros
 * (`?entrega=`, `?entrada=` y la búsqueda `?q=`), en un .xlsx. Lo que no
 * tenga forma de fecha se ignora, igual que en la página.
 */
export const GET: APIRoute = async ({ url, locals }) => {
  if (!esAdmin(locals.usuario)) return noEncontrado();

  const lee = (clave: string) => {
    const v = url.searchParams.get(clave) ?? "";
    return FECHA.test(v) ? v : undefined;
  };
  const fechaEntrega = lee("entrega");
  const fechaEntrada = lee("entrada");
  // Mismo recorte que en la página, para que el Excel sea lo que se ve.
  const texto = (url.searchParams.get("q") ?? "").slice(0, 80).trim() || undefined;

  try {
    const pedidos = await listarPedidos(100, { fechaEntrega, fechaEntrada, texto });
    const xlsx = await pedidosAExcel(pedidos);
    const sufijo = [fechaEntrega && `entrega-${fechaEntrega}`, fechaEntrada && `entrada-${fechaEntrada}`]
      .filter(Boolean)
      .join("-");
    const nombre = `pedidos${sufijo ? `-${sufijo}` : ""}.xlsx`;
    return new Response(new Uint8Array(xlsx), {
      status: 200,
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${nombre}"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("[admin/pedidos/exportar] no se pudo generar:", error);
    return new Response("No se pudo generar el Excel.", { status: 500 });
  }
};
