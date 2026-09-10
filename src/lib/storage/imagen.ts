import sharp from "sharp";

/**
 * Validar y normalizar la foto antes de guardarla. Aquí no se sabe quién es
 * el proveedor de almacenamiento: eso es cosa de `blob.ts`. Este fichero se
 * queda igual el día de la mudanza a Google Cloud.
 */

export class ImagenError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ImagenError";
  }
}

export const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const MAX_BYTES = 8 * 1024 * 1024;
/** Más de esto no lo aprovecha ninguna pantalla del sitio. */
export const ANCHO_MAXIMO = 1600;

/**
 * El mensaje va en cristiano y sin devolver el tipo que mandaron: quien sube
 * la foto es el panadero, no un programador leyendo un log.
 */
export function compruebaFichero(tipo: string, bytes: number): void {
  if (!TIPOS_PERMITIDOS.includes(tipo as (typeof TIPOS_PERMITIDOS)[number])) {
    throw new ImagenError("La foto tiene que ser un jpg, png o webp.");
  }
  if (bytes > MAX_BYTES) {
    throw new ImagenError(
      `La foto pesa demasiado. El máximo son ${MAX_BYTES / 1024 / 1024} MB.`,
    );
  }
}

export type ImagenNormalizada = {
  datos: Buffer;
  ancho: number;
  alto: number;
  tipo: "image/webp";
};

/**
 * Reduce la foto al ancho máximo (nunca la agranda) y la pasa a webp. Las
 * medidas se devuelven porque se guardan en la base de datos: `<Image>` con
 * una URL remota las necesita, y si no las tuviera se pondría a descargar la
 * foto para medirla en cada petición.
 */
export async function normaliza(datos: Buffer): Promise<ImagenNormalizada> {
  try {
    const salida = await sharp(datos)
      .rotate() // respeta la orientación EXIF de las fotos de móvil
      .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    return {
      datos: salida.data,
      ancho: salida.info.width,
      alto: salida.info.height,
      tipo: "image/webp",
    };
  } catch {
    // sharp lanza con detalles del formato: no salen de aquí.
    throw new ImagenError("No hemos podido leer esa foto. Prueba con otra.");
  }
}
