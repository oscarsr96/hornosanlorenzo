import { useEffect, useMemo, useState } from "react";
import {
  categories,
  categoryIds,
  grupoCategories,
  grupoLabel,
  type CategoryId,
  type GrupoId,
} from "~/data/categories";

type Props = {
  grupo?: GrupoId | null;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

export default function CategoryFilter({ grupo = null }: Props) {
  // El sitio es estático: los parámetros de la URL solo existen en el cliente.
  const [active, setActive] = useState<CategoryId | "all">("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");
    if (cat && (categoryIds as readonly string[]).includes(cat)) {
      setActive(cat as CategoryId);
    }
    setSearch(params.get("q") ?? "");
    setReady(true);
  }, []);

  const allowed = useMemo<readonly CategoryId[]>(
    () => (grupo ? grupoCategories[grupo] : categoryIds),
    [grupo],
  );

  useEffect(() => {
    if (!ready) return;
    const url = new URL(window.location.href);
    if (active === "all") url.searchParams.delete("cat");
    else url.searchParams.set("cat", active);
    if (search) url.searchParams.set("q", search);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());

    const needle = normalize(search.trim());
    let shown = 0;

    document.querySelectorAll<HTMLElement>("[data-product]").forEach((el) => {
      const cat = el.dataset.category as CategoryId;
      const inGroup = allowed.includes(cat);
      const inCategory = active === "all" || cat === active;
      const inSearch =
        needle === "" || normalize(el.dataset.search ?? "").includes(needle);
      const show = inGroup && inCategory && inSearch;
      el.style.display = show ? "" : "none";
      if (show) shown += 1;
    });

    setVisible(shown);
  }, [active, search, allowed, ready]);

  const chips: Array<{ id: CategoryId | "all"; label: string }> = [
    { id: "all", label: grupo ? `Todo ${grupoLabel[grupo].toLowerCase()}` : "Todo" },
    ...categories
      .filter((c) => allowed.includes(c.id))
      .map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <div>
      {search.trim() !== "" && (
        <p className="mb-4 text-sm text-[color:var(--color-ink-muted)]">
          {visible === 0
            ? `Sin resultados para «${search.trim()}».`
            : `${visible} resultado${visible === 1 ? "" : "s"} para «${search.trim()}».`}{" "}
          <button
            type="button"
            onClick={() => setSearch("")}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--color-caramelo)",
              fontWeight: 600,
              textDecoration: "underline",
            }}
          >
            Quitar búsqueda
          </button>
        </p>
      )}

      {chips.length > 2 && (
      <div
        role="tablist"
        aria-label="Filtrar por categoría"
        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        {chips.map((c) => {
          const isActive = c.id === active;
          return (
            <button
              key={c.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(c.id)}
              style={{
                minHeight: 40,
                padding: "0.5rem 1rem",
                borderRadius: 0,
                border: isActive ? "none" : "1px solid var(--color-line)",
                background: isActive ? "var(--color-caramelo)" : "transparent",
                color: isActive ? "var(--color-leche)" : "var(--color-ink)",
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
      )}
    </div>
  );
}
