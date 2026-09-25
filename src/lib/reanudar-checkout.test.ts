import { describe, expect, it } from "vitest";
import { rutaDeVuelta } from "~/lib/reanudar-checkout";

describe("rutaDeVuelta", () => {
  it("sin parámetro va a la cuenta", () => {
    expect(rutaDeVuelta(null)).toBe("/cuenta");
    expect(rutaDeVuelta("")).toBe("/cuenta");
  });

  it("acepta rutas del propio sitio", () => {
    expect(rutaDeVuelta("/carrito")).toBe("/carrito");
  });

  it("no deja salir a otro dominio", () => {
    expect(rutaDeVuelta("https://malo.example")).toBe("/cuenta");
    expect(rutaDeVuelta("//malo.example")).toBe("/cuenta");
    expect(rutaDeVuelta("/\\malo.example")).toBe("/cuenta");
    expect(rutaDeVuelta("javascript:alert(1)")).toBe("/cuenta");
  });
});
