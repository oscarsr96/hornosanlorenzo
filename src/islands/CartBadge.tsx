import { useCart } from "~/hooks/useCart";

export default function CartBadge() {
  const { totalQty } = useCart();

  return (
    <a
      href="/carrito"
      aria-label={`Ver pedido (${totalQty} unidades)`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.5rem",
        background: "var(--color-ink)",
        color: "white",
        padding: "0.5rem 0.875rem",
        borderRadius: 9999,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: "none",
        transition: "transform .15s",
      }}
    >
      <span>Mi pedido</span>
      <span
        style={{
          background:
            totalQty > 0 ? "var(--color-hot)" : "var(--color-ink-muted)",
          color: "white",
          borderRadius: 9999,
          minWidth: 22,
          height: 22,
          padding: "0 7px",
          fontSize: 11,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {totalQty}
      </span>
    </a>
  );
}
