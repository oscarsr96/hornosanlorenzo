import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import {
  compruebaFichero,
  normaliza,
  ImagenError,
  ANCHO_MAXIMO,
  MAX_BYTES,
} from "~/lib/storage/imagen";

describe("compruebaFichero", () => {
  it("acepta jpeg, png y webp", () => {
    for (const tipo of ["image/jpeg", "image/png", "image/webp"]) {
      expect(() => compruebaFichero(tipo, 1000)).not.toThrow();
    }
  });

  it("rechaza cualquier otra cosa con un mensaje que se le puede enseñar a alguien", () => {
    try {
      compruebaFichero("application/pdf", 1000);
      throw new Error("debería haber lanzado");
    } catch (err) {
      expect(err).toBeInstanceOf(ImagenError);
      expect((err as ImagenError).message).toMatch(/jpg, png o webp/i);
      // Ni rastro del tipo MIME crudo: el mensaje es para una persona.
      expect((err as ImagenError).message).not.toContain("application/pdf");
    }
  });

  it("rechaza lo que pase del tamaño máximo", () => {
    expect(() => compruebaFichero("image/jpeg", MAX_BYTES + 1)).toThrow(
      ImagenError,
    );
  });
});

describe("normaliza", () => {
  it("reduce una foto enorme al ancho máximo y devuelve sus medidas", async () => {
    // Ruido, no un color liso: un JPEG de un color sólido comprime a casi
    // nada por sí solo (y su webp igual), así que la comparación de tamaño
    // de abajo no diría nada sobre nuestro código. Con ruido, la compresión
    // real de sharp es lo único que puede explicar la diferencia.
    const ancho = 4000;
    const alto = 3000;
    const canales = 3;
    const original = await sharp(randomBytes(ancho * alto * canales), {
      raw: { width: ancho, height: alto, channels: canales },
    })
      .jpeg()
      .toBuffer();

    const salida = await normaliza(original);

    expect(salida.ancho).toBe(ANCHO_MAXIMO);
    expect(salida.alto).toBe(Math.round((ANCHO_MAXIMO * 3000) / 4000));
    expect(salida.tipo).toBe("image/webp");
    // Una foto de móvil sin tocar son varios megas: esto tiene que pesar menos.
    expect(salida.datos.byteLength).toBeLessThan(original.byteLength);
  });

  it("no agranda una foto que ya es pequeña", async () => {
    const original = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .toBuffer();

    const salida = await normaliza(original);
    expect(salida.ancho).toBe(400);
    expect(salida.alto).toBe(300);
  });

  it("rechaza un fichero que no es una imagen aunque diga que lo es", async () => {
    await expect(
      normaliza(Buffer.from("esto no es una foto")),
    ).rejects.toBeInstanceOf(ImagenError);
  });
});
