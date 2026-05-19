import { storeById, type StoreId } from "~/data/stores";
import type { Cart } from "~/lib/cart";
import { formatPriceCents, formatDateISO } from "~/lib/format";

export type PickupInfo = {
  storeId: StoreId;
  dateISO: string;
  slot: "morning" | "afternoon";
  name?: string;
  notes?: string;
};

const SLOT_LABEL: Record<PickupInfo["slot"], string> = {
  morning: "mañana",
  afternoon: "tarde",
};

export function buildWhatsAppMessage(cart: Cart, pickup: PickupInfo): string {
  const store = storeById(pickup.storeId);

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
  lines.push(`📍 Recogida: ${store.shortName} (${store.address})`);
  lines.push(`📅 Día: ${formatDateISO(pickup.dateISO)}`);
  lines.push(`🕘 Franja: ${SLOT_LABEL[pickup.slot]}`);

  if (pickup.name) lines.push(`👤 Nombre: ${pickup.name}`);
  if (pickup.notes) lines.push(`📝 Notas: ${pickup.notes}`);

  lines.push("", "¿Me confirmáis disponibilidad y hora exacta?");

  return lines.join("\n");
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const cleaned = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`;
}
