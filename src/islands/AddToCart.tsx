import { useState } from "react";
import { addItem, type CartItem } from "~/lib/cart";
import { emitToast } from "~/islands/ToastHost";

type Variant = { id: string; label: string; priceCents: number };

type Props = {
  slug: string;
  name: string;
  unitPriceCents: number;
  variants?: Variant[];
  compact?: boolean;
};

export default function AddToCart({
  slug,
  name,
  unitPriceCents,
  variants,
  compact,
}: Props) {
  const [variantId, setVariantId] = useState<string | undefined>(
    variants?.[0]?.id,
  );
  const [qty, setQty] = useState(1);

  const variant = variants?.find((v) => v.id === variantId);
  const finalPrice = variant?.priceCents ?? unitPriceCents;

  function onAdd() {
    const item: Omit<CartItem, "qty"> & { qty: number } = {
      slug,
      name,
      variantId: variant?.id,
      variantLabel: variant?.label,
      unitPriceCents: finalPrice,
      qty,
    };
    addItem(item);
    emitToast(`Añadido — ${name}${variant ? ` (${variant.label})` : ""}`);
  }

  if (compact) {
    return (
      <button
        onClick={onAdd}
        style={{
          background: "var(--color-ink)",
          color: "white",
          border: "none",
          padding: "0.5rem 1rem",
          borderRadius: 9999,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Añadir
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {variants && variants.length > 1 && (
        <fieldset style={{ border: "none", padding: 0 }}>
          <legend
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "var(--color-ink-muted)",
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            Tamaño / opción
          </legend>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {variants.map((v) => (
              <label
                key={v.id}
                style={{
                  cursor: "pointer",
                  padding: "0.5rem 0.875rem",
                  border:
                    variantId === v.id
                      ? "2px solid var(--color-ink)"
                      : "1px solid var(--color-line)",
                  borderRadius: 9999,
                  background:
                    variantId === v.id ? "var(--color-cream)" : "white",
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={variantId === v.id}
                  onChange={() => setVariantId(v.id)}
                  style={{
                    position: "absolute",
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                />
                {v.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <label
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            color: "var(--color-ink-muted)",
            fontWeight: 600,
          }}
          htmlFor="qty"
        >
          Cantidad
        </label>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            border: "1px solid var(--color-line)",
            borderRadius: 9999,
          }}
        >
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            aria-label="Reducir cantidad"
            style={{
              background: "transparent",
              border: "none",
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            −
          </button>
          <span
            id="qty"
            style={{ minWidth: 28, textAlign: "center", fontWeight: 600 }}
          >
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            aria-label="Aumentar cantidad"
            style={{
              background: "transparent",
              border: "none",
              width: 36,
              height: 36,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={onAdd}
        style={{
          background: "var(--color-ink)",
          color: "white",
          border: "none",
          padding: "0.875rem 1.5rem",
          borderRadius: 9999,
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          transition: "transform .15s",
        }}
      >
        Añadir al pedido ·{" "}
        {new Intl.NumberFormat("es-ES", {
          style: "currency",
          currency: "EUR",
        }).format((finalPrice * qty) / 100)}
      </button>
    </div>
  );
}
