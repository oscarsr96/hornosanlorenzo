import { useCart } from "~/hooks/useCart";

function CartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h3l2.6 12.4a1.6 1.6 0 0 0 1.6 1.3h9.1a1.6 1.6 0 0 0 1.6-1.2L22 7H6" />
    </svg>
  );
}

export default function CartBadge() {
  const { totalQty } = useCart();
  const hasItems = totalQty > 0;

  return (
    <a
      href="/carrito"
      aria-label={`Ver pedido (${totalQty} unidades)`}
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      {/* Icon-only with floating count */}
      <span
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          color: "var(--color-ink)",
        }}
      >
        <CartIcon />
        {hasItems && (
          <span
            style={{
              position: "absolute",
              top: 2,
              right: 2,
              minWidth: 18,
              height: 18,
              padding: "0 5px",
              background: "var(--color-hot)",
              color: "white",
              borderRadius: 0,
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--color-cream)",
            }}
          >
            {totalQty}
          </span>
        )}
      </span>
    </a>
  );
}
