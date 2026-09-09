import { describe, expect, it } from "vitest";
import { preparaAltaUsuario } from "~/lib/auth/alta";

describe("preparaAltaUsuario", () => {
  const bueno = { name: "Ana", telefono: "666123456" };

  it("acepta un alta con nombre y teléfono válidos", async () => {
    const { data } = await preparaAltaUsuario(bueno);
    expect(data.name).toBe("Ana");
    expect(data.telefono).toBe("666123456");
  });

  it("normaliza el teléfono al guardarlo", async () => {
    const { data } = await preparaAltaUsuario({
      ...bueno,
      telefono: "+34 666 12 34 56",
    });
    expect(data.telefono).toBe("666123456");
  });

  it("recorta espacios del nombre", async () => {
    const { data } = await preparaAltaUsuario({ ...bueno, name: "  Ana  " });
    expect(data.name).toBe("Ana");
  });

  it("rechaza el alta si el nombre queda vacío tras recortarlo", async () => {
    await expect(
      preparaAltaUsuario({ ...bueno, name: "   " }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });

  it("rechaza el alta sin teléfono, aunque el campo sea opcional en el esquema", async () => {
    const { telefono, ...sinTelefono } = bueno;
    await expect(preparaAltaUsuario(sinTelefono)).rejects.toMatchObject({
      status: "BAD_REQUEST",
    });
  });

  it("rechaza un teléfono que no tiene forma de teléfono español", async () => {
    await expect(
      preparaAltaUsuario({ ...bueno, telefono: "12345" }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });
});
