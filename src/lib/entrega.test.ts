import { describe, expect, it } from "vitest";
import { admiteCP, esTelefonoValido } from "~/lib/entrega";

describe("esTelefonoValido", () => {
  it("acepta un móvil con espacios y con prefijo", () => {
    expect(esTelefonoValido("666 12 34 56")).toBe(true);
    expect(esTelefonoValido("+34 666123456")).toBe(true);
  });

  it("acepta un fijo de Madrid", () => {
    expect(esTelefonoValido("916613932")).toBe(true);
  });

  it("rechaza lo que no son nueve dígitos españoles", () => {
    expect(esTelefonoValido("12345")).toBe(false);
    expect(esTelefonoValido("1234567890")).toBe(false);
  });
});

describe("admiteCP", () => {
  it("acepta la zona de reparto", () => {
    expect(admiteCP("28001")).toBe(true);
    expect(admiteCP("28760")).toBe(true);
  });

  it("rechaza fuera de zona y formatos malos", () => {
    expect(admiteCP("08001")).toBe(false);
    expect(admiteCP("28056")).toBe(false);
    expect(admiteCP("2800")).toBe(false);
  });
});
