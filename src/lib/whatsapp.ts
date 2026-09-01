import { storeById, type StoreId } from "~/data/stores";
import type { Cart } from "~/lib/cart";
import { formatPriceCents, formatDateISO } from "~/lib/format";
import { MODE_COPY, type DeliveryMode } from "~/lib/entrega";

export type OrderInfo = {
  mode: DeliveryMode;
  dateISO: string;
  /** Solo en recogida. */
  storeId?: StoreId;
  /** Solo en envío a domicilio. */
  address?: string;
  slot: "morning" | "afternoon";
  name?: string;
  notes?: string;
};

const SLOT_LABEL: Record<OrderInfo["slot"], string> = {
  morning: "mañana",
  afternoon: "tarde",
};

export function buildWhatsAppMessage(cart: Cart, order: OrderInfo): string {
  const lines: string[] = [];
  lines.push("Hola Horno San Lorenzo 👋", "");
  lines.push("Quería hacer un pedido:", "");

  for (const item of cart.items) {
    const label = item.variantLabel ? ` (${item.variantLabel})` : "";
    const line = `• ${item.qty}× ${item.name}${label} — ${formatPriceCents(
      item.unitPriceCents * item.qty,
    )}`;
    lines.push(line);
  }

  const total = cart.items.reduce((s, i) => s + i.unitPriceCents * i.qty, 0);
  lines.push("", `Total estimado: ${formatPriceCents(total)}`, "");

  lines.push(`🚚 ${MODE_COPY[order.mode].label}`);
  if (order.mode === "recogida" && order.storeId) {
    const store = storeById(order.storeId);
    lines.push(`📍 Tienda: ${store.shortName} (${store.address})`);
  }
  if (order.mode === "domicilio" && order.address) {
    lines.push(`📍 Dirección: ${order.address}`);
  }
  lines.push(`📅 Día: ${formatDateISO(order.dateISO)}`);
  lines.push(`🕘 Franja: ${SLOT_LABEL[order.slot]}`);

  if (order.name) lines.push(`👤 Nombre: ${order.name}`);
  if (order.notes) lines.push(`📝 Notas: ${order.notes}`);

  lines.push("", "¿Me confirmáis disponibilidad y hora exacta?");

  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
