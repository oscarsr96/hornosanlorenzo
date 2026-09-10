import { z } from "zod";
import {
  isDateAllowed,
  meetsMinimum,
  shippingCents,
  admiteCP,
  esTelefonoValido,
  ZONA_REPARTO_COPY,
  MIN_ORDER_CENTS,
} from "~/lib/entrega";
import { stores, type StoreId } from "~/data/stores";
import { productosParaPedido } from "~/lib/db/productos";

/**
 * Modelo de pedido del lado del servidor.
 *
 * El navegador solo manda referencias y cantidades: los precios se recalculan
 * aquí a partir de la tabla `productos`, que es la única fuente de verdad.
 * Nunca se confía en un importe que venga del cliente.
 */

export const orderPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        slug: z.string().min(1).max(120),
        variantId: z.string().min(1).max(60).optional(),
        qty: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(40),
  mode: z.enum(["domicilio", "recogida"]),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Solo en recogida: el envío a domicilio no elige franja. */
  slot: z.enum(["morning", "afternoon"]).optional(),
  storeId: z.string().optional(),
  address: z.string().max(300).optional(),
  /** Solo en domicilio: cinco dígitos, y tiene que ser zona de reparto. */
  postalCode: z
    .string()
    .regex(/^\d{5}$/)
    .optional(),
  name: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  email: z.string().email().max(160),
  /** Obligatorio en las dos modalidades: es como se avisa de un problema. */
  phone: z.string().min(9).max(20),
});

export type OrderPayload = z.infer<typeof orderPayloadSchema>;

export type PricedLine = {
  slug: string;
  name: string;
  variantLabel?: string;
  qty: number;
  unitPriceCents: number;
  totalCents: number;
};

export type PricedOrder = {
  lines: PricedLine[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  payload: OrderPayload;
  /**
   * Quién hizo el pedido, si tenía sesión. Sale de `Astro.locals.usuario` en
   * el endpoint que llama a `priceOrder`, nunca del cuerpo de la petición:
   * aceptarlo del navegador dejaría que cualquiera atribuyera su pedido a
   * otra persona. Un invitado no tiene sesión, así que aquí queda `undefined`.
   */
  userId?: string;
};

export class OrderError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

/**
 * Valida el pedido y le pone precio leyendo el catálogo.
 * Lanza OrderError con un mensaje presentable si algo no cuadra.
 *
 * `userId` es opcional y solo lo rellena quien llama desde el endpoint, a
 * partir de la sesión: aquí no se lee de ningún sitio que el navegador
 * pueda tocar.
 */
export async function priceOrder(
  payload: OrderPayload,
  { userId, now = new Date() }: { userId?: string; now?: Date } = {},
): Promise<PricedOrder> {
  if (payload.mode === "domicilio") {
    if (!payload.address || payload.address.trim().length < 6) {
      throw new OrderError("Falta la dirección de entrega.");
    }
    // El navegador ya lo comprueba, pero el reparto se decide aquí: un CP de
    // fuera de zona no puede entrar por mucho que el cliente edite el formulario.
    if (!payload.postalCode) {
      throw new OrderError("Falta el código postal de entrega.");
    }
    if (!admiteCP(payload.postalCode)) {
      throw new OrderError(
        `No repartimos en el código postal ${payload.postalCode}. ${ZONA_REPARTO_COPY}`,
      );
    }
  } else {
    const valid = stores.some((s) => s.id === payload.storeId);
    if (!valid) throw new OrderError("La tienda de recogida no es válida.");
  }

  if (!esTelefonoValido(payload.phone)) {
    throw new OrderError("El teléfono de contacto no parece válido.");
  }

  // La fuente de verdad del precio es la tabla `productos`. Se piden solo los
  // slugs del carrito, no el catálogo entero: son 98 fichas y aquí hacen falta
  // dos o tres.
  const bySlug = await productosParaPedido(payload.items.map((i) => i.slug));

  const lines: PricedLine[] = [];
  for (const item of payload.items) {
    const product = bySlug.get(item.slug);
    if (!product || !product.activo) {
      // Mismo mensaje para «no existe» y «desactivado»: para quien compra son
      // lo mismo, y distinguirlo solo serviría para adivinar qué hay detrás.
      throw new OrderError(`El producto «${item.slug}» ya no está disponible.`);
    }

    if (product.agotado) {
      throw new OrderError(
        `«${product.name}» se ha agotado. Quítalo del carrito y vuelve a intentarlo.`,
      );
    }

    if (product.consultar || product.priceCents === null) {
      throw new OrderError(
        `«${product.name}» se encarga hablando con el obrador: no tiene precio de venta online.`,
      );
    }

    let unitPriceCents = product.priceCents;
    let variantLabel: string | undefined;

    if (item.variantId) {
      const variant = product.variantes.find(
        (v) => v.variantId === item.variantId,
      );
      if (!variant) {
        throw new OrderError(
          `La opción elegida de «${product.name}» ya no está disponible.`,
        );
      }
      unitPriceCents = variant.priceCents;
      variantLabel = variant.label;
    }

    lines.push({
      slug: item.slug,
      name: product.name,
      variantLabel,
      qty: item.qty,
      unitPriceCents,
      totalCents: unitPriceCents * item.qty,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);

  // El plazo depende del importe y de la tienda, así que la fecha no se puede
  // validar hasta tener el pedido valorado.
  if (
    !isDateAllowed(payload.mode, payload.dateISO, now, {
      subtotalCents,
      storeId: payload.storeId,
    })
  ) {
    throw new OrderError(
      "La fecha elegida no está disponible para este pedido. Revisa el día de entrega.",
    );
  }

  if (!meetsMinimum(payload.mode, subtotalCents)) {
    throw new OrderError(
      `El pedido mínimo para reparto a domicilio es de ${(MIN_ORDER_CENTS / 100).toFixed(2)} €.`,
    );
  }

  const envio = shippingCents(payload.mode, subtotalCents);

  return {
    lines,
    subtotalCents,
    shippingCents: envio,
    totalCents: subtotalCents + envio,
    payload,
    userId,
  };
}

/** Dónde se entrega, en una línea, para el correo y los metadatos de Stripe. */
export function destinationLabel(payload: OrderPayload): string {
  if (payload.mode === "domicilio") {
    return [payload.address, payload.postalCode].filter(Boolean).join(" · ");
  }
  const store = stores.find((s) => s.id === (payload.storeId as StoreId));
  return store ? `${store.shortName} — ${store.address}` : "";
}
