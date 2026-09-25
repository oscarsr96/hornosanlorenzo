import type { Producto } from "~/lib/db/productos";

/**
 * Productos que son el mismo con distinto relleno: en la carta cada sabor es
 * su ficha (con su precio y su línea en el pedido y en la hoja de
 * producción), pero en la web se enseñan en una sola tarjeta con una foto y
 * un selector de sabor. Mil fotos iguales una detrás de otra no ayudan a
 * elegir.
 *
 * Agrupar es solo cosa de la vista: al carrito entra el producto del sabor
 * elegido, igual que si se hubiera pulsado su propia tarjeta.
 */
export const GRUPOS_SABOR = {
  empanadas: { titulo: "Empanadas", singular: "Empanada" },
  supremas: { titulo: "Supremas", singular: "Suprema" },
  quiches: { titulo: "Quiches", singular: "Quiche" },
} as const;

export type SeccionConSabores = keyof typeof GRUPOS_SABOR;

export type ElementoCatalogo =
  | { tipo: "producto"; producto: Producto }
  | {
      tipo: "sabores";
      seccion: SeccionConSabores;
      titulo: string;
      singular: string;
      sabores: Producto[];
    };

const esSeccionConSabores = (s: string | null): s is SeccionConSabores =>
  s !== null && Object.hasOwn(GRUPOS_SABOR, s);

/**
 * Junta los sabores de cada grupo en un elemento, que ocupa el sitio del
 * primero de ellos: el orden de la carta se mantiene. Con un solo sabor no
 * hay nada que elegir y se queda como tarjeta normal.
 */
export function agruparSabores(productos: Producto[]): ElementoCatalogo[] {
  const porSeccion = new Map<SeccionConSabores, Producto[]>();
  for (const p of productos) {
    if (esSeccionConSabores(p.seccion)) {
      porSeccion.set(p.seccion, [...(porSeccion.get(p.seccion) ?? []), p]);
    }
  }

  const salida: ElementoCatalogo[] = [];
  const yaPuestos = new Set<SeccionConSabores>();
  for (const p of productos) {
    const seccion = esSeccionConSabores(p.seccion) ? p.seccion : null;
    const sabores = seccion ? porSeccion.get(seccion)! : [];
    if (!seccion || sabores.length < 2) {
      salida.push({ tipo: "producto", producto: p });
      continue;
    }
    if (yaPuestos.has(seccion)) continue;
    yaPuestos.add(seccion);
    salida.push({
      tipo: "sabores",
      seccion,
      ...GRUPOS_SABOR[seccion],
      sabores,
    });
  }
  return salida;
}
