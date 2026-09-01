export const categoryIds = [
  "bolleria",
  "tartas",
  "salado",
  "temporada",
] as const;

export type CategoryId = (typeof categoryIds)[number];

export type Category = {
  id: CategoryId;
  label: string;
  short: string;
};

export const categories: readonly Category[] = [
  {
    id: "bolleria",
    label: "Bollería",
    short: "Croissants, napolitanas, suizos",
  },
  { id: "tartas", label: "Tartas", short: "Para celebrar o capricho diario" },
  { id: "salado", label: "Salado", short: "Empanadas, quiches, hojaldres" },
  { id: "temporada", label: "Temporada", short: "Roscón, torrijas, panettone" },
] as const;

export const categoryById = (id: CategoryId): Category =>
  categories.find((c) => c.id === id)!;

/**
 * Agrupación comercial del brief: Dulce · Salado · Packs.
 * Se superpone a las categorías del catálogo sin sustituirlas.
 */
export const grupoIds = ["dulce", "salado", "packs"] as const;

export type GrupoId = (typeof grupoIds)[number];

export const grupoCategories: Record<GrupoId, readonly CategoryId[]> = {
  dulce: ["bolleria", "tartas", "temporada"],
  salado: ["salado"],
  packs: [],
};

export const grupoLabel: Record<GrupoId, string> = {
  dulce: "Dulce",
  salado: "Salado",
  packs: "Packs y promos del mes",
};

export const isGrupoId = (value: string | null): value is GrupoId =>
  value !== null && (grupoIds as readonly string[]).includes(value);
