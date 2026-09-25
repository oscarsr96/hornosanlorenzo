/**
 * Reglas de entrega.
 *
 *   Envío a domicilio — «Entregamos en 24 horas. Entrega programada al día
 *   siguiente para pedidos realizados antes de las 18:00 del día anterior.»
 *
 *   Recogida en tienda — el mismo día en Alcobendas si se pide antes de las
 *   15:00; en Pozuelo, siempre de un día para otro.
 *
 *   Cualquier modalidad — desde 250 € el obrador necesita dos días.
 */

export type DeliveryMode = "domicilio" | "recogida";

/** Hora límite para que el envío salga al día siguiente. */
export const CUTOFF_HOUR = 18;

/** Hora límite para que la recogida del mismo día siga siendo posible. */
export const RECOGIDA_MISMO_DIA_HOUR = 15;

/** Desde este importe el obrador necesita dos días: no vale el día siguiente. */
export const DOS_DIAS_DESDE_CENTS = 25_000;

/** Tiendas que nunca preparan para el mismo día. */
const TIENDAS_SIN_MISMO_DIA: readonly string[] = ["pozuelo"];

export const DOS_DIAS_COPY =
  "Los pedidos desde 250 € necesitan dos días de preparación.";

export const MODE_COPY: Record<DeliveryMode, { label: string; body: string }> = {
  domicilio: {
    label: "Envío a domicilio",
    body: "Entregamos en 24 horas. Entrega programada al día siguiente para pedidos realizados antes de las 18:00 del día anterior. Pedido mínimo 25 € de lunes a jueves y 35 € viernes, sábados y vísperas de festivo. Solo Madrid capital, Alcobendas, San Sebastián de los Reyes, Tres Cantos y Pozuelo de Alarcón.",
  },
  recogida: {
    label: "Recogida en tienda",
    body: "Recogida el mismo día en Alcobendas para pedidos antes de las 15h. En Pozuelo, siempre de un día para otro.",
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

/** Lo que condiciona el primer día disponible, además de la modalidad. */
export type PlazoOpts = {
  /** Subtotal del pedido: desde 250 € hacen falta dos días. */
  subtotalCents?: number;
  /** Solo en recogida: Pozuelo nunca prepara para el mismo día. */
  storeId?: string;
};

/**
 * Primer día que se puede elegir.
 *
 * Recogida: hoy mismo si aún no son las 15:00, salvo en Pozuelo, que siempre
 * es de un día para otro.
 * Domicilio: mañana si aún no son las 18:00; si no, pasado.
 * En ambas, un pedido de 250 € o más no baja de dos días.
 */
export function earliestDate(
  mode: DeliveryMode,
  now: Date = new Date(),
  { subtotalCents = 0, storeId }: PlazoOpts = {},
): string {
  let dias =
    mode === "recogida"
      ? // Pozuelo nunca prepara para hoy; en Alcobendas hay hasta las 15:00.
        (storeId && TIENDAS_SIN_MISMO_DIA.includes(storeId)) ||
        now.getHours() >= RECOGIDA_MISMO_DIA_HOUR
        ? 1
        : 0
      : now.getHours() < CUTOFF_HOUR
        ? 1
        : 2;

  if (subtotalCents >= DOS_DIAS_DESDE_CENTS) dias = Math.max(dias, 2);

  return toISO(nextOpenDay(addDays(now, dias)));
}

/** El calendario abre con la opción más permisiva: la recogida. */
export function earliestSelectableDate(now: Date = new Date()): string {
  return earliestDate("recogida", now);
}

/* -------------------------------------------------------------------------
 * Reglas comerciales del reparto.
 * El envío sigue siendo gratuito. El pedido mínimo del reparto a domicilio
 * depende del día de entrega: 25 € de lunes a jueves; 35 € los viernes, los
 * sábados y las vísperas de festivo.
 * ---------------------------------------------------------------------- */

/** Coste del reparto a domicilio, en céntimos. 0 = gratuito. */
export const SHIPPING_CENTS = 0;

/** Importe a partir del cual el reparto sale gratis. null = tarifa siempre igual. */
export const FREE_SHIPPING_FROM_CENTS: number | null = null;

/** Pedido mínimo del reparto a domicilio de lunes a jueves, en céntimos. */
export const MIN_ORDER_CENTS = 2_500;

/** Pedido mínimo del reparto los viernes, sábados y vísperas de festivo. */
export const MIN_ORDER_ALTO_CENTS = 3_500;

export const MIN_ORDER_COPY =
  "Pedido mínimo a domicilio: 25 € de lunes a jueves; 35 € viernes, sábados y vísperas de festivo.";

/**
 * Festivos de Madrid, en ISO. Solo sirven para saber qué día es víspera.
 *
 * 2026: los doce de la Comunidad (Decreto 75/2025, BOCM 25-9-2025) y los dos
 * locales de Madrid capital (BOCM 12-12-2025), que es donde cae casi todo el
 * reparto. Los locales de Alcobendas, Pozuelo, Sanse y Tres Cantos no están:
 * **falta confirmar con el obrador si también cuentan**.
 * 2027: solo los dos nacionales fijos de enero. **El resto hay que añadirlo
 * cuando salga el calendario oficial** (la Comunidad lo aprueba a finales de
 * septiembre y los locales llegan en diciembre).
 */
export const FESTIVOS: ReadonlySet<string> = new Set([
  "2026-01-01",
  "2026-01-06",
  "2026-04-02",
  "2026-04-03",
  "2026-05-01",
  "2026-05-02",
  "2026-05-15", // San Isidro, local de Madrid
  "2026-08-15",
  "2026-10-12",
  "2026-11-02",
  "2026-11-09", // La Almudena, local de Madrid
  "2026-12-07",
  "2026-12-08",
  "2026-12-25",
  "2027-01-01",
  "2027-01-06",
]);

/** El día siguiente es festivo. */
export const esVisperaDeFestivo = (dateISO: string): boolean =>
  FESTIVOS.has(toISO(addDays(fromISO(dateISO), 1)));

/**
 * Pedido mínimo para una modalidad y un día de entrega. La recogida no tiene
 * mínimo; el reparto sube a 35 € los viernes, sábados y vísperas de festivo.
 */
export function minimoPedidoCents(mode: DeliveryMode, dateISO: string): number {
  if (mode === "recogida") return 0;
  const dia = fromISO(dateISO).getDay();
  return dia === 5 || dia === 6 || esVisperaDeFestivo(dateISO)
    ? MIN_ORDER_ALTO_CENTS
    : MIN_ORDER_CENTS;
}

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

/** ¿Llega el pedido al mínimo exigido para su modalidad y día de entrega? */
export function meetsMinimum(
  mode: DeliveryMode,
  subtotalCents: number,
  dateISO: string,
): boolean {
  return subtotalCents >= minimoPedidoCents(mode, dateISO);
}

/** ¿Es una fecha admisible para esta modalidad, importe y tienda? */
export function isDateAllowed(
  mode: DeliveryMode,
  dateISO: string,
  now: Date = new Date(),
  opts: PlazoOpts = {},
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return false;
  const date = fromISO(dateISO);
  if (Number.isNaN(date.getTime())) return false;
  if (isClosed(date)) return false;
  return dateISO >= earliestDate(mode, now, opts);
}
