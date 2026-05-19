import { useMemo, useState } from "react";
import { useCart } from "~/hooks/useCart";
import { stores, type StoreId } from "~/data/stores";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  type PickupInfo,
} from "~/lib/whatsapp";
import { formatPriceCents } from "~/lib/format";

const PHONE = import.meta.env.PUBLIC_WHATSAPP_NUMBER;

function nextNDays(start: Date, n: number) {
  const days: string[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() + 1);
  for (let i = 0; i < n; i++) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

export default function CartPage() {
  const { cart, totalCents, totalQty, updateQty, removeItem, clearCart } =
    useCart();

  const [storeId, setStoreId] = useState<StoreId>("alcobendas");
  const [dateISO, setDateISO] = useState<string>("");
  const [slot, setSlot] = useState<PickupInfo["slot"]>("morning");
  const [name, setName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const store = stores.find((s) => s.id === storeId)!;
  const availableDates = useMemo(() => {
    const days = nextNDays(new Date(), 7);
    return days.filter((d) => {
      const dow = new Date(d + "T00:00:00").getDay();
      return store.openDays.includes(dow);
    });
  }, [store]);

  const canSubmit = cart.items.length > 0 && dateISO !== "";

  function submit() {
    if (!canSubmit) return;
    const pickup: PickupInfo = {
      storeId,
      dateISO,
      slot,
      name: name.trim() || undefined,
      notes: notes.trim() || undefined,
    };
    const msg = buildWhatsAppMessage(cart, pickup);
    const url = buildWhatsAppUrl(PHONE, msg);
    window.location.href = url;
  }

  if (cart.items.length === 0) {
    return (
      <section
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "3rem 1rem",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 36,
            marginBottom: 12,
          }}
        >
          Tu pedido está vacío
        </h1>
        <p style={{ color: "var(--color-ink-muted)", marginBottom: 24 }}>
          Empieza por el catálogo y añade lo que necesites.
        </p>
        <a
          href="/catalogo"
          style={{
            display: "inline-block",
            background: "var(--color-ink)",
            color: "var(--color-cream)",
            padding: "0.875rem 1.5rem",
            borderRadius: 9999,
            fontWeight: 700,
          }}
        >
          Ver catálogo →
        </a>
      </section>
    );
  }

  return (
    <section style={{ maxWidth: 960, margin: "0 auto", padding: "2rem 1rem" }}>
      <p
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.25em",
          color: "var(--color-ink-muted)",
          fontWeight: 600,
        }}
      >
        Tu pedido
      </p>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 40,
          marginTop: 4,
        }}
      >
        {totalQty} {totalQty === 1 ? "artículo" : "artículos"}
      </h1>

      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {cart.items.map((item) => (
          <div
            key={item.slug + (item.variantId ?? "")}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 16,
              padding: 16,
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              background: "var(--color-paper)",
            }}
          >
            <div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>
                {item.name}
              </p>
              {item.variantLabel && (
                <p style={{ fontSize: 13, color: "var(--color-ink-muted)" }}>
                  {item.variantLabel}
                </p>
              )}
              <p
                style={{
                  fontSize: 14,
                  color: "var(--color-ink-muted)",
                  marginTop: 4,
                }}
              >
                {formatPriceCents(item.unitPriceCents)} c/u
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                gap: 8,
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  border: "1px solid var(--color-line)",
                  borderRadius: 9999,
                }}
              >
                <button
                  onClick={() =>
                    updateQty(item.slug, item.variantId, item.qty - 1)
                  }
                  aria-label="−"
                  style={{
                    width: 32,
                    height: 32,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
                <span
                  style={{ minWidth: 24, textAlign: "center", fontWeight: 600 }}
                >
                  {item.qty}
                </span>
                <button
                  onClick={() =>
                    updateQty(item.slug, item.variantId, item.qty + 1)
                  }
                  aria-label="+"
                  style={{
                    width: 32,
                    height: 32,
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {formatPriceCents(item.unitPriceCents * item.qty)}
              </p>
              <button
                onClick={() => removeItem(item.slug, item.variantId)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--color-ink-muted)",
                  fontSize: 12,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 18,
        }}
      >
        <span>Total estimado</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 24,
          }}
        >
          {formatPriceCents(totalCents)}
        </span>
      </div>

      <hr
        style={{
          margin: "32px 0",
          border: "none",
          borderTop: "1px solid var(--color-line)",
        }}
      />

      <h2 style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>
        Recogida
      </h2>

      <fieldset style={{ border: "none", padding: 0, marginTop: 16 }}>
        <legend
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
        >
          📍 Tienda
        </legend>
        <div
          style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}
        >
          {stores.map((s) => (
            <label
              key={s.id}
              style={{
                padding: "0.75rem 1rem",
                border:
                  storeId === s.id
                    ? "2px solid var(--color-ink)"
                    : "1px solid var(--color-line)",
                borderRadius: 12,
                cursor: "pointer",
                background: storeId === s.id ? "var(--color-cream)" : "white",
              }}
            >
              <input
                type="radio"
                name="store"
                value={s.id}
                checked={storeId === s.id}
                onChange={() => {
                  setStoreId(s.id);
                  setDateISO("");
                }}
                style={{ position: "absolute", opacity: 0 }}
              />
              <strong style={{ display: "block" }}>{s.shortName}</strong>
              <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
                {s.hoursText}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ marginTop: 24 }}>
        <label
          htmlFor="pickup-date"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
        >
          📅 Día
        </label>
        <select
          id="pickup-date"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
          style={{
            display: "block",
            marginTop: 8,
            padding: "0.75rem 1rem",
            border: "1px solid var(--color-line)",
            borderRadius: 9999,
            background: "white",
            fontSize: 14,
            width: "100%",
            maxWidth: 320,
          }}
        >
          <option value="">Elige un día</option>
          {availableDates.map((d) => (
            <option key={d} value={d}>
              {new Intl.DateTimeFormat("es-ES", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }).format(new Date(d + "T00:00:00"))}
            </option>
          ))}
        </select>
      </div>

      <fieldset style={{ border: "none", padding: 0, marginTop: 24 }}>
        <legend
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
        >
          🕘 Franja
        </legend>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {[
            { id: "morning", label: "Mañana" },
            { id: "afternoon", label: "Tarde" },
          ].map((s) => (
            <label
              key={s.id}
              style={{
                padding: "0.5rem 1rem",
                border:
                  slot === s.id
                    ? "2px solid var(--color-ink)"
                    : "1px solid var(--color-line)",
                borderRadius: 9999,
                cursor: "pointer",
                background: slot === s.id ? "var(--color-cream)" : "white",
                fontSize: 14,
              }}
            >
              <input
                type="radio"
                name="slot"
                value={s.id}
                checked={slot === s.id}
                onChange={() => setSlot(s.id as PickupInfo["slot"])}
                style={{ position: "absolute", opacity: 0 }}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div style={{ marginTop: 24 }}>
        <label
          htmlFor="pickup-name"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
        >
          👤 Tu nombre (opcional)
        </label>
        <input
          id="pickup-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Para que sepan quién pregunta"
          style={{
            display: "block",
            marginTop: 8,
            padding: "0.75rem 1rem",
            border: "1px solid var(--color-line)",
            borderRadius: 9999,
            width: "100%",
            maxWidth: 320,
            fontSize: 14,
          }}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <label
          htmlFor="pickup-notes"
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.25em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
        >
          📝 Notas (opcional)
        </label>
        <textarea
          id="pickup-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Alergias, indicaciones, lo que necesites"
          style={{
            display: "block",
            marginTop: 8,
            padding: "0.75rem 1rem",
            border: "1px solid var(--color-line)",
            borderRadius: 12,
            width: "100%",
            maxWidth: 480,
            fontSize: 14,
            fontFamily: "inherit",
          }}
        />
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 16,
          marginTop: 32,
          background: "var(--color-paper)",
          padding: 16,
          border: "1px solid var(--color-line)",
          borderRadius: 16,
        }}
      >
        <button
          onClick={submit}
          disabled={!canSubmit}
          style={{
            width: "100%",
            background: canSubmit
              ? "var(--color-wa)"
              : "var(--color-ink-muted)",
            color: "white",
            border: "none",
            padding: "1rem 1.5rem",
            borderRadius: 9999,
            fontSize: 16,
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          ✓ Pedir por WhatsApp · {formatPriceCents(totalCents)}
        </button>
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "var(--color-ink-muted)",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          Al pulsar se abre WhatsApp con el pedido escrito. El horno te confirma
          disponibilidad, precio final y hora exacta antes de prepararlo. Aún no
          estás comprando.
        </p>
      </div>

      <p style={{ textAlign: "center", marginTop: 16 }}>
        <button
          onClick={() => {
            if (confirm("¿Vaciar el carrito?")) clearCart();
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--color-ink-muted)",
            textDecoration: "underline",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          Vaciar carrito
        </button>
      </p>
    </section>
  );
}
