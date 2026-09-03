import type { APIRoute } from "astro";
import Stripe from "stripe";
import { formatDateISO } from "~/lib/format";
import { MODE_COPY } from "~/lib/entrega";
import {
  orderPayloadSchema,
  priceOrder,
  destinationLabel,
  OrderError,
} from "~/lib/pedido";

// El cobro se calcula en servidor: esta ruta no puede prerenderizarse.
export const prerender = false;

const SLOT_LABEL = { morning: "mañana", afternoon: "tarde" } as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

export const POST: APIRoute = async ({ request, url }) => {
  const secret = import.meta.env.STRIPE_SECRET_KEY;
  if (!secret) {
    console.error("[checkout] falta STRIPE_SECRET_KEY");
    return json(
      { error: "El pago no está configurado todavía. Escríbenos por WhatsApp." },
      503,
    );
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json({ error: "Petición mal formada." }, 400);
  }

  const parsed = orderPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Faltan datos del pedido." }, 400);
  }

  let order;
  try {
    order = await priceOrder(parsed.data);
  } catch (err) {
    if (err instanceof OrderError) return json({ error: err.message }, err.status);
    console.error("[checkout] error al valorar el pedido", err);
    return json({ error: "No hemos podido preparar el pedido." }, 500);
  }

  const { payload } = order;
  const stripe = new Stripe(secret);
  const origin = import.meta.env.PUBLIC_SITE_URL ?? url.origin;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.lines.map(
    (line) => ({
      quantity: line.qty,
      price_data: {
        currency: "eur",
        unit_amount: line.unitPriceCents,
        product_data: {
          name: line.variantLabel ? `${line.name} — ${line.variantLabel}` : line.name,
        },
      },
    }),
  );

  if (order.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: order.shippingCents,
        product_data: { name: "Reparto a domicilio" },
      },
    });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: payload.email,
      success_url: `${origin}/pedido/gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/carrito`,
      locale: "es",
      // Los metadatos viajan con el pago: son lo que lee el webhook para
      // avisar al obrador. Stripe limita cada valor a 500 caracteres.
      metadata: {
        modalidad: MODE_COPY[payload.mode].label,
        dia: formatDateISO(payload.dateISO),
        franja: SLOT_LABEL[payload.slot],
        destino: destinationLabel(payload).slice(0, 480),
        nombre: payload.name?.slice(0, 120) ?? "",
        notas: payload.notes?.slice(0, 480) ?? "",
      },
    });

    if (!session.url) throw new Error("Stripe no devolvió URL de pago");
    return json({ url: session.url });
  } catch (err) {
    console.error("[checkout] Stripe rechazó la sesión", err);
    return json({ error: "No hemos podido abrir el pago. Inténtalo de nuevo." }, 502);
  }
};
