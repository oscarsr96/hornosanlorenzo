/**
 * Reglas de entrega del brief de front end.
 *
 *   Envío a domicilio — «Entregamos en 24 horas. Entrega programada al día
 *   siguiente para pedidos realizados antes de las 18:00 del día anterior.»
 *
 *   Recogida en tienda — «Recogida en tienda el mismo día (posibilidad día
 *   siguiente para pedidos superiores a 200 €).»
 */

export type DeliveryMode = "domicilio" | "recogida";

/** Hora límite para que el envío salga al día siguiente. */
export const CUTOFF_HOUR = 18;

/** A partir de este importe, la recogida puede pasar al día siguiente. */
export const PICKUP_NEXT_DAY_THRESHOLD_CENTS = 20_000;

export const MODE_COPY: Record<DeliveryMode, { label: string; body: string }> = {
  domicilio: {
    label: "Envío a domicilio",
    body: "Entregamos en 24 horas. Entrega programada al día siguiente para pedidos realizados antes de las 18:00 del día anterior.",
  },
  recogida: {
    label: "Recogida en tienda",
    body: "Recogida en tienda el mismo día (posibilidad día siguiente para pedidos superiores a 200 €).",
  },
};

/** Reparto propio y obrador: de lunes a sábado. */
export const isClosed = (date: Date): boolean => date.getDay() === 0;

export const toISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const fromISO = (iso: string): Date => new Date(`${iso}T00:00:00`);

const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const nextOpenDay = (date: Date): Date => {
  let d = new Date(date);
  while (isClosed(d)) d = addDays(d, 1);
  return d;
};

/**
 * Primer día que se puede elegir para cada modalidad.
 * Recogida: hoy mismo. Domicilio: mañana si aún no son las 18:00; si no, pasado.
 */
export function earliestDate(mode: DeliveryMode, now: Date = new Date()): string {
  const base =
    mode === "recogida"
      ? now
      : addDays(now, now.getHours() < CUTOFF_HOUR ? 1 : 2);
  return toISO(nextOpenDay(base));
}

/** El calendario abre con la opción más permisiva: la recogida. */
export function earliestSelectableDate(now: Date = new Date()): string {
  return earliestDate("recogida", now);
}

/* -------------------------------------------------------------------------
 * Reglas comerciales del reparto.
 * Pendientes de confirmar con el obrador: hoy el envío es gratuito y no hay
 * pedido mínimo. Cambiar estas cuatro constantes basta para activarlos.
 * ---------------------------------------------------------------------- */

/** Coste del reparto a domicilio, en céntimos. 0 = gratuito. */
export const SHIPPING_CENTS = 0;

/** Importe a partir del cual el reparto sale gratis. null = tarifa siempre igual. */
export const FREE_SHIPPING_FROM_CENTS: number | null = null;

/** Pedido mínimo para el reparto a domicilio, en céntimos. 0 = sin mínimo. */
export const MIN_ORDER_CENTS = 0;

/** Lo que cuesta el reparto para un subtotal dado. La recogida nunca cuesta. */
export function shippingCents(mode: DeliveryMode, subtotalCents: number): number {
  if (mode === "recogida") return 0;
  if (
    FREE_SHIPPING_FROM_CENTS !== null &&
    subtotalCents >= FREE_SHIPPING_FROM_CENTS
  ) {
    return 0;
  }
  return SHIPPING_CENTS;
}

/** ¿Llega el pedido al mínimo exigido para su modalidad? */
export function meetsMinimum(mode: DeliveryMode, subtotalCents: number): boolean {
  if (mode === "recogida") return true;
  return subtotalCents >= MIN_ORDER_CENTS;
}

/** ¿Es una fecha admisible para esta modalidad? */
export function isDateAllowed(
  mode: DeliveryMode,
  dateISO: string,
  now: Date = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const date = fromISO(dateISO);
  if (Number.isNaN(date.getTime())) return false;
  if (isClosed(date)) return false;
  return dateISO >= earliestDate(mode, now);
}
