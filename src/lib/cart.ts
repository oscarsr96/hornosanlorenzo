export type CartItem = {
  slug: string;
  name: string;
  variantId?: string;
  variantLabel?: string;
  qty: number;
  unitPriceCents: number;
};

export type Cart = {
  items: CartItem[];
  updatedAt: string;
};

const STORAGE_KEY = "hsl-cart-v1";
const CART_EVENT = "hsl-cart-update";

const isBrowser = typeof window !== "undefined";

function emptyCart(): Cart {
  return { items: [], updatedAt: new Date().toISOString() };
}

export function loadCart(): Cart {
  if (!isBrowser) return emptyCart();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyCart();
    const parsed = JSON.parse(raw) as Cart;
    if (!Array.isArray(parsed.items)) return emptyCart();
    parsed.items = parsed.items.filter(
      (i) =>
        typeof i.slug === "string" &&
        typeof i.qty === "number" &&
        i.qty > 0 &&
        typeof i.unitPriceCents === "number" &&
        i.unitPriceCents > 0,
    );
    return parsed;
  } catch {
    return emptyCart();
  }
}

function saveCart(cart: Cart): void {
  if (!isBrowser) return;
  cart.updatedAt = new Date().toISOString();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: cart }));
}

function sameItem(
  a: CartItem,
  b: Pick<CartItem, "slug" | "variantId">,
): boolean {
  return a.slug === b.slug && (a.variantId ?? null) === (b.variantId ?? null);
}

export function addItem(item: Omit<CartItem, "qty"> & { qty?: number }): Cart {
  const cart = loadCart();
  const qty = item.qty ?? 1;
  const existing = cart.items.find((i) => sameItem(i, item));
  if (existing) {
    existing.qty += qty;
  } else {
    cart.items.push({ ...item, qty });
  }
  saveCart(cart);
  return cart;
}

export function updateQty(
  slug: string,
  variantId: string | undefined,
  qty: number,
): Cart {
  const cart = loadCart();
  const item = cart.items.find((i) => sameItem(i, { slug, variantId }));
  if (!item) return cart;
  if (qty <= 0) {
    cart.items = cart.items.filter((i) => !sameItem(i, { slug, variantId }));
  } else {
    item.qty = qty;
  }
  saveCart(cart);
  return cart;
}

export function removeItem(slug: string, variantId?: string): Cart {
  return updateQty(slug, variantId, 0);
}

export function clearCart(): Cart {
  const cart = emptyCart();
  saveCart(cart);
  return cart;
}

export function totalCents(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.unitPriceCents * i.qty, 0);
}

export function totalQty(cart: Cart): number {
  return cart.items.reduce((sum, i) => sum + i.qty, 0);
}

export const CART_UPDATE_EVENT = CART_EVENT;
