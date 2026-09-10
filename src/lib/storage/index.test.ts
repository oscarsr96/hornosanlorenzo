import { describe, expect, it } from "vitest";
import { rutaDeImagen } from "~/lib/storage/index";

describe("rutaDeImagen", () => {
  it("dos fotos con el mismo nombre original no acaban en la misma ruta", () => {
    // Nombres de cámara de móvil como IMG_0001.jpg se repiten constantemente:
    // dos subidas con ese nombre no pueden pisarse.
    const rutaA = rutaDeImagen("IMG_0001.jpg", "productos");
    const rutaB = rutaDeImagen("IMG_0001.jpg", "productos");
    expect(rutaA).not.toBe(rutaB);
  });

  it("mantiene el prefijo de la carpeta y la extensión .webp", () => {
    const ruta = rutaDeImagen("croissant.jpg", "noticias");
    expect(ruta.startsWith("noticias/")).toBe(true);
    expect(ruta.endsWith(".webp")).toBe(true);
  });

  it("un nombre hostil sigue saliendo seguro", () => {
    const nombres = [
      "../../etc/passwd",
      "/etc/passwd",
      ".env",
      "",
      "a".repeat(300),
    ];
    for (const nombre of nombres) {
      const ruta = rutaDeImagen(nombre, "productos");
      expect(ruta.startsWith("productos/")).toBe(true);
      expect(ruta.endsWith(".webp")).toBe(true);
      expect(ruta).not.toContain("..");
      expect(ruta).not.toContain("/etc/passwd");
    }
  });
});
