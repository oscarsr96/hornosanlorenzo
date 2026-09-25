import { describe, expect, it } from "vitest";
import { admiteCP, esTelefonoValido, minimoPedidoCents, meetsMinimum } from "~/lib/entrega";

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

describe("minimoPedidoCents", () => {
  it("la recogida no tiene mínimo", () => {
    expect(minimoPedidoCents("recogida", "2026-10-02")).toBe(0);
  });

  it("25 € de lunes a jueves", () => {
    // Semana del 28-9-2026: lunes a jueves, sin festivos al día siguiente.
    for (const iso of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01"]) {
      expect(minimoPedidoCents("domicilio", iso)).toBe(2500);
    }
  });

  it("35 € viernes y sábado", () => {
    expect(minimoPedidoCents("domicilio", "2026-10-02")).toBe(3500);
    expect(minimoPedidoCents("domicilio", "2026-10-03")).toBe(3500);
  });

  it("35 € la víspera de un festivo entre semana", () => {
    // Lunes 7 de diciembre es festivo: el martes 8 también, y el 7 es su víspera.
    expect(minimoPedidoCents("domicilio", "2026-12-07")).toBe(3500);
    // Jueves 24 de diciembre, víspera de Navidad.
    expect(minimoPedidoCents("domicilio", "2026-12-24")).toBe(3500);
    // Jueves 31 de diciembre, víspera de Año Nuevo, cruzando de año.
    expect(minimoPedidoCents("domicilio", "2026-12-31")).toBe(3500);
    // Miércoles 9 de diciembre, día corriente después del puente.
    expect(minimoPedidoCents("domicilio", "2026-12-09")).toBe(2500);
  });
});

describe("meetsMinimum", () => {
  it("compara con el mínimo del día de entrega", () => {
    expect(meetsMinimum("domicilio", 2500, "2026-09-29")).toBe(true);
    expect(meetsMinimum("domicilio", 2499, "2026-09-29")).toBe(false);
    expect(meetsMinimum("domicilio", 3000, "2026-10-02")).toBe(false);
    expect(meetsMinimum("recogida", 100, "2026-10-02")).toBe(true);
  });
});
