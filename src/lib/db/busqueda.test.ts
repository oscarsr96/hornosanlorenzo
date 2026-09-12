import { describe, expect, it } from "vitest";
import { patronBusqueda } from "~/lib/db/busqueda";

describe("patronBusqueda", () => {
  it("envuelve el texto en comodines y recorta los espacios de los extremos", () => {
    expect(patronBusqueda("  ana ")).toEqual({ patron: "%ana%", soloDigitos: null });
  });

  it("sin texto, o solo con espacios, no hay filtro", () => {
    expect(patronBusqueda(undefined)).toEqual({ patron: null, soloDigitos: null });
    expect(patronBusqueda("")).toEqual({ patron: null, soloDigitos: null });
    expect(patronBusqueda("   ")).toEqual({ patron: null, soloDigitos: null });
  });

  it("escapa los comodines de LIKE para que se busquen tal cual", () => {
    // Un «50%» tecleado tiene que encontrar un «50%» escrito en las notas o
    // en un correo, no cualquier cosa que empiece por 50.
    expect(patronBusqueda("50%").patron).toBe("%50\\%%");
    expect(patronBusqueda("ana_b").patron).toBe("%ana\\_b%");
    // La barra invertida es el carácter de escape: suelta rompería el patrón.
    expect(patronBusqueda("a\\b").patron).toBe("%a\\\\b%");
  });

  it("un teléfono tecleado con espacios se busca también sin ellos", () => {
    expect(patronBusqueda("600 12 34 56")).toEqual({
      patron: "%600 12 34 56%",
      soloDigitos: "600123456",
    });
    expect(patronBusqueda("699000111").soloDigitos).toBe("699000111");
  });

  it("si hay algo que no sea dígito o espacio, no se trata como teléfono", () => {
    expect(patronBusqueda("+34 600 12 34 56").soloDigitos).toBeNull();
    expect(patronBusqueda("ana 12").soloDigitos).toBeNull();
    expect(patronBusqueda("3f2a").soloDigitos).toBeNull();
  });
});
