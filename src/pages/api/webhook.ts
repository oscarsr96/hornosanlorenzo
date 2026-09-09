import type { APIRoute } from "astro";
import Stripe from "stripe";
import { enviarCorreo } from "~/lib/email/enviar";
import { site } from "~/data/site";

// Stripe llama a esta ruta: nunca se prerenderiza.
export const prerender = false;

/**
 * Confirmación del cobro.
 *
 * La confirmación se hace SIEMPRE aquí y nunca en la vuelta del navegador:
 * el cliente puede cerrar la pestaña o manipular la URL de retorno, pero esta
 * llamada la hace Stripe y va firmada.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.STRIPE_SECRET_KEY;
  const signingSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

  if (!secret || !signingSecret) {
    console.error("[webhook] faltan claves de Stripe");
    return new Response("not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("missing signature", { status: 400 });

  // La firma se comprueba sobre el cuerpo en crudo, sin parsear.
  const body = await request.text();
  const stripe = new Stripe(secret);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      signingSecret,
    );
  } catch (err) {
    console.error("[webhook] firma inválida", err);
    return new Response("invalid signature", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ignored", { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") {
    return new Response("unpaid", { status: 200 });
  }

  try {
    await notify(stripe, session);
  } catch (err) {
    // Devolver 500 hace que Stripe reintente, que es lo que queremos si el
    // correo falla: el cobro ya está hecho y el obrador tiene que enterarse.
    console.error("[webhook] no se pudo avisar del pedido", err);
    return new Response("notification failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
};

export async function notify(stripe: Stripe, session: Stripe.Checkout.Session) {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const to = import.meta.env.ORDER_NOTIFICATION_EMAIL;
  const from = import.meta.env.ORDER_FROM_EMAIL;

  const m = session.metadata ?? {};
  const total = ((session.amount_total ?? 0) / 100)
    .toFixed(2)
    .replace(".", ",");
  const cliente = session.customer_details?.email ?? "";

  const items = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 50,
  });
  const detalle = items.data
    .map((i) => `• ${i.quantity}× ${i.description}`)
    .join("\n");

  const resumen = [
    `Pedido pagado — ${total} €`,
    "",
    detalle,
    "",
    `Modalidad: ${m.modalidad ?? ""}`,
    `Día: ${m.dia ?? ""} (${m.franja ?? ""})`,
    `Destino: ${m.destino ?? ""}`,
    m.nombre ? `Nombre: ${m.nombre}` : "",
    m.notas ? `Notas: ${m.notas}` : "",
    `Email: ${cliente}`,
    "",
    `Referencia Stripe: ${session.id}`,
  ]
    .filter(Boolean)
    .join("\n");

  // Todo o nada, a propósito: el correo al cliente dice «Ya está pagado y
  // anotado en el obrador», y esa frase solo puede ser cierta si ese aviso
  // ha salido de verdad — da igual que la razón sea que falta configuración
  // (este caso) o que el envío al obrador falle ya con todo bien
  // configurado (el siguiente bloque: proveedor caído, dominio sin
  // verificar, límite alcanzado...). Si mandáramos el correo al cliente de
  // todos modos, podríamos confirmarle algo falso, o dejar una avería sin
  // que nadie la note porque el cliente sigue viendo confirmaciones
  // perfectas. Por eso cualquiera de los dos casos frena también el correo
  // al cliente: el pedido no se pierde, queda en el panel de Stripe y en
  // este registro.
  if (!apiKey || !to || !from) {
    console.warn("[webhook] correo no configurado; pedido:\n" + resumen);
    return;
  }

  const obrador = await enviarCorreo({
    para: to,
    asunto: `Pedido web — ${m.dia ?? ""} · ${total} €`,
    texto: resumen,
  });

  if (!obrador.ok) {
    // Mismo motivo que el bloque de arriba: sin aviso al obrador, no se
    // manda la confirmación al cliente.
    console.warn("[webhook] no se pudo avisar al obrador; pedido:\n" + resumen);
    return;
  }

  if (cliente) {
    const clienteEnviado = await enviarCorreo({
      para: cliente,
      asunto: `Tu pedido en ${site.name}`,
      texto: [
        `Gracias por tu pedido. Ya está pagado y anotado en el obrador.`,
        "",
        detalle,
        "",
        `Total: ${total} €`,
        `${m.modalidad ?? ""} · ${m.dia ?? ""} (${m.franja ?? ""})`,
        `${m.destino ?? ""}`,
        "",
        `Si necesitas cambiar algo, escríbenos a ${site.email}.`,
        "",
        site.name,
        site.legend,
      ].join("\n"),
    });

    if (!clienteEnviado.ok) {
      console.warn(
        `[webhook] no se pudo avisar al cliente (${cliente}) de su pedido:\n` +
          resumen,
      );
    }
  }
}
