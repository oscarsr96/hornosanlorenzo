import { useEffect, useState, useCallback } from "react";
import {
  loadCart,
  totalCents,
  totalQty,
  addItem as _addItem,
  updateQty as _updateQty,
  removeItem as _removeItem,
  clearCart as _clearCart,
  CART_UPDATE_EVENT,
  type Cart,
  type CartItem,
} from "~/lib/cart";

export function useCart() {
  const [cart, setCart] = useState<Cart>(() => loadCart());

  useEffect(() => {
    const handler = () => setCart(loadCart());
    window.addEventListener(CART_UPDATE_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(CART_UPDATE_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const addItem = useCallback(
    (item: Omit<CartItem, "qty"> & { qty?: number }) => {
      setCart(_addItem(item));
    },
    [],
  );

  const updateQty = useCallback(
    (slug: string, variantId: string | undefined, qty: number) => {
      setCart(_updateQty(slug, variantId, qty));
    },
    [],
  );

  const removeItem = useCallback((slug: string, variantId?: string) => {
    setCart(_removeItem(slug, variantId));
  }, []);

  const clearCart = useCallback(() => {
    setCart(_clearCart());
  }, []);

  return {
    cart,
    totalCents: totalCents(cart),
    totalQty: totalQty(cart),
    addItem,
    updateQty,
    removeItem,
    clearCart,
  };
}
