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
    body: "Entregamos en 24 horas. Entrega programada al día siguiente para pedidos realizados antes de las 18:00 del día anterior. Solo Madrid capital, Alcobendas, San Sebastián de los Reyes, Tres Cantos y Pozuelo de Alarcón.",
  },
  recogida: {
    label: "Recogida en tienda",
    body: "Recogida en tienda el mismo día (posibilidad día siguiente para pedidos superiores a 200 €).",
  },
};

/**
 * El envío a domicilio no se elige por franja: el reparto propio sale por la
 * mañana y entrega antes del cierre del mediodía. Solo la recogida en tienda
 * ofrece mañana o tarde.
 */
/**
 * Códigos postales a los que llega el reparto propio.
 *
 * Madrid capital son los CP que existen de verdad (28001–28055), no todo el
 * prefijo 280xx: 28056–28099 son apartados de correos y códigos
 * administrativos, no direcciones a las que se pueda repartir.
 *
 * **Los rangos los tomé de fuentes públicas, no del cliente**, así que hay
 * que validarlos con el obrador antes de cobrar (ver tasks/todo.md).
 */
const CP_RANGOS: readonly { desde: number; hasta: number; municipio: string }[] = [
  { desde: 28001, hasta: 28055, municipio: "Madrid capital" },
  { desde: 28100, hasta: 28109, municipio: "Alcobendas" },
  { desde: 28220, hasta: 28224, municipio: "Pozuelo de Alarcón" },
  { desde: 28700, hasta: 28709, municipio: "San Sebastián de los Reyes" },
  { desde: 28760, hasta: 28760, municipio: "Tres Cantos" },
];

/** El CP es de reparto. Espera cinco dígitos; cualquier otra cosa es `false`. */
export const admiteCP = (cp: string): boolean => {
  if (!/^\d{5}$/.test(cp)) return false;
  const n = Number(cp);
  return CP_RANGOS.some((r) => n >= r.desde && n <= r.hasta);
};

/** Municipio de un CP de reparto, para confirmarle al cliente dónde entrega. */
export const municipioDeCP = (cp: string): string | null => {
  if (!/^\d{5}$/.test(cp)) return null;
  const n = Number(cp);
  return CP_RANGOS.find((r) => n >= r.desde && n <= r.hasta)?.municipio ?? null;
};

/**
 * Teléfono de contacto del pedido. Se admite escribirlo con espacios, puntos
 * o guiones, y con prefijo +34: lo que importa es que queden nueve dígitos
 * españoles, que es con lo que el obrador puede llamar.
 */
export const normalizaTelefono = (tel: string): string => {
  const digitos = tel.replace(/\D/g, "");
  return digitos.startsWith("34") && digitos.length === 11
    ? digitos.slice(2)
    : digitos;
};

export const esTelefonoValido = (tel: string): boolean =>
  /^[6789]\d{8}$/.test(normalizaTelefono(tel));

/** Municipios a los que llega el reparto propio. */
export const ZONA_REPARTO = [
  "Madrid capital",
  "Alcobendas",
  "San Sebastián de los Reyes",
  "Tres Cantos",
  "Pozuelo de Alarcón",
] as const;

export const ZONA_REPARTO_COPY = `Solo enviamos a ${ZONA_REPARTO.slice(0, -1).join(", ")} y ${ZONA_REPARTO.at(-1)}.`;

export const ENTREGA_DOMICILIO_COPY = "Entrega antes de las 14:30h";

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
