import { useEffect, useState } from "react";
import { categories, type CategoryId } from "~/data/categories";

type Props = { current: CategoryId | "all" };

export default function CategoryFilter({ current }: Props) {
  const [active, setActive] = useState<CategoryId | "all">(current);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (active === "all") url.searchParams.delete("cat");
    else url.searchParams.set("cat", active);
    window.history.replaceState({}, "", url.toString());

    document.querySelectorAll<HTMLElement>("[data-product]").forEach((el) => {
      const cat = el.dataset.category as CategoryId;
      el.style.display = active === "all" || cat === active ? "" : "none";
    });
  }, [active]);

  const all: Array<{ id: CategoryId | "all"; label: string }> = [
    { id: "all", label: "Todo" },
    ...categories.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <div
      role="tablist"
      aria-label="Filtrar por categoría"
      style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
    >
      {all.map((c) => {
        const isActive = c.id === active;
        return (
          <button
            key={c.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => setActive(c.id)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: 9999,
              border: isActive ? "none" : "1px solid var(--color-line)",
              background: isActive ? "var(--color-ink)" : "transparent",
              color: isActive ? "var(--color-cream)" : "var(--color-ink)",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
