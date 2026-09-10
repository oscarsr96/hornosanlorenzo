import { pool } from "~/lib/db/pool";
import type { PricedOrder } from "~/lib/pedido";

/**
 * Pedidos. Único sitio del proyecto con SQL de pedidos: hacia fuera todo va
 * en camelCase y nadie ve un nombre de columna.
 */

export type LineaPedido = {
  slug: string | null;
  nombre: string;
  varianteLabel: string | null;
  qty: number;
  unitPriceCents: number;
};

export type PedidoConLineas = {
  id: string;
  userId: string | null;
  stripeSessionId: string | null;
  mode: "domicilio" | "recogida";
  fechaEntrega: string;
  slot: "morning" | "afternoon" | null;
  storeId: string | null;
  address: string | null;
  postalCode: string | null;
  email: string;
  telefono: string;
  nombre: string | null;
  notas: string | null;
  subtotalCents: number;
  envioCents: number;
  totalCents: number;
  reconstruido: boolean;
  createdAt: Date;
  lineas: LineaPedido[];
};

/** Lo mínimo que necesita saber quien confirma un cobro. */
export type PedidoAnotado = { id: string; notificadoEn: Date | null };

export type PedidoReconstruido = {
  stripeSessionId: string;
  email: string;
  telefono: string;
  nombre: string | null;
  notas: string | null;
  totalCents: number;
  lineas: { nombre: string; qty: number; unitPriceCents: number }[];
};

/**
 * Anota el pedido antes de mandar a nadie a pagar. Nace 'iniciado': si el
 * cobro no llega a completarse, se queda así y no ensucia el panel.
 *
 * Va en una transacción porque un pedido sin sus líneas no es un pedido: es
 * un importe sin explicación.
 */
export async function crearPedidoIniciado(order: PricedOrder): Promise<string> {
  const p = order.payload;
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<{ id: string }>(
      `insert into pedidos (
         user_id, mode, fecha_entrega, slot, store_id, address, postal_code,
         email, telefono, nombre, notas,
         subtotal_cents, envio_cents, total_cents
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       returning id`,
      [
        order.userId ?? null,
        p.mode,
        p.dateISO,
        p.slot ?? null,
        p.storeId ?? null,
        p.address ?? null,
        p.postalCode ?? null,
        p.email,
        p.phone,
        p.name ?? null,
        p.notes ?? null,
        order.subtotalCents,
        order.shippingCents,
        order.totalCents,
      ],
    );
    const id = rows[0].id;

    for (const [i, linea] of order.lines.entries()) {
      await cliente.query(
        `insert into lineas_pedido
           (pedido_id, slug, nombre, variante_label, qty, unit_price_cents, orden)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id,
          linea.slug,
          linea.name,
          linea.variantLabel ?? null,
          linea.qty,
          linea.unitPriceCents,
          i,
        ],
      );
    }

    await cliente.query("commit");
    return id;
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

/** La referencia de Stripe se conoce después de crear la sesión de pago. */
export async function anotarSesionStripe(
  pedidoId: string,
  sessionId: string,
): Promise<void> {
  await pool.query(`update pedidos set stripe_session_id = $2 where id = $1`, [
    pedidoId,
    sessionId,
  ]);
}

/**
 * Da el pedido por pagado. Idempotente a propósito: Stripe reintenta el
 * mismo aviso si nuestra respuesta falla, y esos reintentos no pueden
 * duplicar el pedido ni volver a poner en marcha nada.
 *
 * Devuelve también `notificadoEn`, que es lo que permite a quien llama saber
 * si el correo al obrador ya salió o si este reintento todavía tiene que
 * mandarlo. Devuelve null si el pago no corresponde a ningún pedido nuestro
 * (por ejemplo, si la base de datos estaba caída al cobrar).
 */
export async function marcarPagado(ref: {
  pedidoId?: string | null;
  sessionId: string;
}): Promise<PedidoAnotado | null> {
  const { rows } = await pool.query<PedidoAnotado>(
    `update pedidos
        set estado = 'pagado',
            stripe_session_id = coalesce(stripe_session_id, $2)
      where (id = $1::uuid or stripe_session_id = $2)
      returning id, notificado_en as "notificadoEn"`,
    [ref.pedidoId ?? null, ref.sessionId],
  );
  return rows[0] ?? null;
}

/**
 * Último recurso: el cobro salió bien pero el pedido no llegó a anotarse
 * (Postgres caído en ese momento). Se reconstruye con lo que da Stripe, que
 * es menos —no hay slugs ni desglose de envío— y por eso queda marcado.
 * Es preferible a que el pedido no aparezca en el panel.
 */
export async function crearPedidoReconstruido(
  datos: PedidoReconstruido,
): Promise<PedidoAnotado> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const { rows } = await cliente.query<PedidoAnotado>(
      `insert into pedidos (
         stripe_session_id, mode, fecha_entrega, email, telefono, nombre, notas,
         subtotal_cents, envio_cents, total_cents, estado, reconstruido
       ) values ($1, 'recogida', current_date, $2, $3, $4, $5, $6, 0, $6, 'pagado', true)
       on conflict (stripe_session_id) do update set estado = 'pagado'
       returning id, notificado_en as "notificadoEn"`,
      [
        datos.stripeSessionId,
        datos.email,
        datos.telefono,
        datos.nombre,
        datos.notas,
        datos.totalCents,
      ],
    );
    const id = rows[0].id;

    // Idempotencia frente a entregas repetidas del webhook: si dos avisos de
    // Stripe llegan mientras la base seguía caída, el segundo `insert` de
    // arriba entra por la rama `on conflict` y devuelve el mismo `id` que el
    // primero. Sin este borrado previo, cada entrega añadiría su propia
    // copia de las líneas; borrando primero, la segunda transacción sustituye
    // las líneas por un juego idéntico en vez de sumarlas.
    await cliente.query("delete from lineas_pedido where pedido_id = $1", [id]);

    for (const [i, linea] of datos.lineas.entries()) {
      await cliente.query(
        `insert into lineas_pedido (pedido_id, nombre, qty, unit_price_cents, orden)
         values ($1,$2,$3,$4,$5)`,
        [id, linea.nombre, linea.qty, linea.unitPriceCents, i],
      );
    }

    await cliente.query("commit");
    return rows[0];
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

/** El aviso al obrador ya salió: un reintento de Stripe no debe repetirlo. */
export async function marcarAvisado(pedidoId: string): Promise<void> {
  await pool.query(
    `update pedidos set notificado_en = now() where id = $1 and notificado_en is null`,
    [pedidoId],
  );
}

/**
 * Lo que ve el panel: solo pagados, del más reciente al más antiguo, con sus
 * líneas. Una sola consulta con agregación en vez de N+1: son pocos pedidos,
 * pero el patrón importa más que el volumen de hoy.
 */
export async function listarPedidos(limite = 100): Promise<PedidoConLineas[]> {
  const { rows } = await pool.query<PedidoConLineas>(
    `select p.id,
            p.user_id           as "userId",
            p.stripe_session_id as "stripeSessionId",
            p.mode,
            to_char(p.fecha_entrega, 'YYYY-MM-DD') as "fechaEntrega",
            p.slot,
            p.store_id     as "storeId",
            p.address,
            p.postal_code  as "postalCode",
            p.email,
            p.telefono,
            p.nombre,
            p.notas,
            p.subtotal_cents as "subtotalCents",
            p.envio_cents    as "envioCents",
            p.total_cents    as "totalCents",
            p.reconstruido,
            p.created_at     as "createdAt",
            coalesce(
              (select json_agg(json_build_object(
                        'slug', l.slug,
                        'nombre', l.nombre,
                        'varianteLabel', l.variante_label,
                        'qty', l.qty,
                        'unitPriceCents', l.unit_price_cents)
                      order by l.orden)
                 from lineas_pedido l
                where l.pedido_id = p.id),
              '[]'::json
            ) as lineas
       from pedidos p
      where p.estado = 'pagado'
      order by p.created_at desc
      limit $1`,
    [limite],
  );
  return rows;
}
