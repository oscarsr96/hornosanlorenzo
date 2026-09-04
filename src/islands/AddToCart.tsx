import { useState } from "react";
import { addItem, type CartItem } from "~/lib/cart";
import { emitToast } from "~/islands/ToastHost";
import { formatPriceCents } from "~/lib/format";

type Variant = { id: string; label: string; priceCents: number };

type Props = {
  slug: string;
  name: string;
  unitPriceCents: number;
  unit?: string;
  variants?: Variant[];
  compact?: boolean;
};

export default function AddToCart({
  slug,
  name,
  unitPriceCents,
  unit,
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

  const compactButton = (
    <button
      onClick={onAdd}
      style={{
        background: "var(--color-caramelo)",
        color: "var(--color-leche)",
        border: "none",
        padding: "0.5rem 1rem",
        borderRadius: 0,
        fontWeight: 600,
        fontSize: 13,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      Añadir
    </button>
  );

  if (compact) {
    // Sin tamaños la tarjeta ya pinta el precio: aquí solo va el botón.
    if (!variants || variants.length <= 1) return compactButton;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        <select
          value={variantId}
          onChange={(e) => setVariantId(e.target.value)}
          aria-label={`Tamaño de ${name}`}
          style={{
            appearance: "none",
            WebkitAppearance: "none",
            width: "100%",
            minHeight: 40,
            padding: "0 2rem 0 0.75rem",
            border: "1px solid var(--color-line)",
            borderRadius: 0,
            background:
              "var(--color-leche) url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='11' height='8' viewBox='0 0 12 12' fill='none' stroke='%23322820' stroke-width='1.6'%3E%3Cpath d='m2 4.5 4 3.5 4-3.5'/%3E%3C/svg%3E\") no-repeat right 0.75rem center",
            color: "var(--color-ink)",
            font: "inherit",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 600,
              margin: 0,
            }}
          >
            {formatPriceCents(finalPrice)}
          </p>
          {compactButton}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.875rem",
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        {formatPriceCents(finalPrice)}
        {unit && (
          <span
            style={{
              fontSize: "0.875rem",
              color: "var(--color-ink-muted)",
              fontWeight: 400,
            }}
          >
            {" "}
            / {unit}
          </span>
        )}
      </p>

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
                  borderRadius: 0,
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
            borderRadius: 0,
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
          background: "var(--color-caramelo)",
          color: "var(--color-leche)",
          border: "none",
          padding: "0.875rem 1.5rem",
          borderRadius: 0,
          fontSize: 15,
          fontWeight: 700,
          cursor: "pointer",
          transition: "transform .15s",
        }}
      >
        Añadir al pedido · {formatPriceCents(finalPrice * qty)}
      </button>
    </div>
  );
}
