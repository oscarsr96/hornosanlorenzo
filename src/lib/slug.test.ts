import { describe, expect, it } from "vitest";
import { slugify } from "~/lib/slug";

describe("slugify", () => {
  it("quita acentos, mayúsculas y signos", () => {
    expect(slugify("Roscón de Reyes 2026 — ¡reservas abiertas!")).toBe(
      "roscon-de-reyes-2026-reservas-abiertas",
    );
  });

  it("no deja guiones sueltos ni al principio ni al final", () => {
    expect(slugify("  ¿Y esto?  ")).toBe("y-esto");
  });

  it("nunca devuelve vacío: un slug vacío rompería la URL", () => {
    expect(slugify("💥")).toBe("noticia");
  });
});
