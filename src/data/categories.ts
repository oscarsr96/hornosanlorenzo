export const categoryIds = [
  "panes",
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
  { id: "panes", label: "Panes", short: "Masa madre, fermentación lenta" },
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
