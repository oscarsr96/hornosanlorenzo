import { describe, expect, it } from "vitest";
import { camposAdicionales } from "~/lib/auth/campos";

describe("camposAdicionales", () => {
  it("cierra el registro como administrador: `rol` no se acepta como entrada", () => {
    // Es el único candado que impide `POST /sign-up/email` con
    // `{ rol: "admin" }` en el cuerpo. Si `input: false` desaparece, esta
    // prueba tiene que fallar: todo el plan del panel de administración se
    // apoya en que nadie pueda darse de alta pidiendo ser administrador.
    expect(camposAdicionales.rol.input).toBe(false);
  });

  it("da de alta a cualquiera como cliente por defecto", () => {
    expect(camposAdicionales.rol.defaultValue).toBe("cliente");
  });
});
