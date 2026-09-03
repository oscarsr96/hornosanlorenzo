import { getCollection } from "astro:content";
import { z } from "zod";
import {
  isDateAllowed,
  meetsMinimum,
  shippingCents,
  MIN_ORDER_CENTS,
} from "~/lib/entrega";
import { stores, type StoreId } from "~/data/stores";

/**
 * Modelo de pedido del lado del servidor.
 *
 * El navegador solo manda referencias y cantidades: los precios se recalculan
 * aquí a partir de la colección de contenido, que es la única fuente de verdad.
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
  slot: z.enum(["morning", "afternoon"]),
  storeId: z.string().optional(),
  address: z.string().max(300).optional(),
  name: z.string().max(120).optional(),
  notes: z.string().max(500).optional(),
  email: z.string().email().max(160),
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
 */
export async function priceOrder(
  payload: OrderPayload,
  now: Date = new Date(),
): Promise<PricedOrder> {
  if (!isDateAllowed(payload.mode, payload.dateISO, now)) {
    throw new OrderError(
      "La fecha elegida ya no está disponible para esa modalidad de entrega.",
    );
  }

  if (payload.mode === "domicilio") {
    if (!payload.address || payload.address.trim().length < 6) {
      throw new OrderError("Falta la dirección de entrega.");
    }
  } else {
    const valid = stores.some((s) => s.id === payload.storeId);
    if (!valid) throw new OrderError("La tienda de recogida no es válida.");
  }

  const catalog = await getCollection("products");
  const bySlug = new Map(catalog.map((p) => [p.id, p]));

  const lines: PricedLine[] = [];
  for (const item of payload.items) {
    const product = bySlug.get(item.slug);
    if (!product) {
      throw new OrderError(`El producto «${item.slug}» ya no está disponible.`);
    }

    let unitPriceCents = product.data.priceCents;
    let variantLabel: string | undefined;

    if (item.variantId) {
      const variant = product.data.variants?.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new OrderError(
          `La opción elegida de «${product.data.name}» ya no está disponible.`,
        );
      }
      unitPriceCents = variant.priceCents;
      variantLabel = variant.label;
    }

    lines.push({
      slug: item.slug,
      name: product.data.name,
      variantLabel,
      qty: item.qty,
      unitPriceCents,
      totalCents: unitPriceCents * item.qty,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.totalCents, 0);

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
  };
}

/** Dónde se entrega, en una línea, para el correo y los metadatos de Stripe. */
export function destinationLabel(payload: OrderPayload): string {
  if (payload.mode === "domicilio") return payload.address ?? "";
  const store = stores.find((s) => s.id === (payload.storeId as StoreId));
  return store ? `${store.shortName} — ${store.address}` : "";
}
