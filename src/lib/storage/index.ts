import { randomUUID } from "node:crypto";
import { compruebaFichero, normaliza } from "~/lib/storage/imagen";
import { sube, borra } from "~/lib/storage/blob";

export { ImagenError } from "~/lib/storage/imagen";

export type ImagenGuardada = { url: string; ancho: number; alto: number };

export type Carpeta = "productos" | "noticias";

/** Sin acentos, sin espacios y sin sorpresas: esto acaba en una URL. */
function nombreSeguro(nombre: string): string {
  return (
    nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\.[a-z0-9]+$/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "foto"
  );
}

/**
 * Compone la ruta del blob. Dos componentes en el sufijo, cada uno por su
 * motivo: la fecha, para que el almacén se pueda ojear en orden cronológico
 * a mano; y un trozo de UUID, porque nombres de cámara de móvil como
 * `IMG_0001.jpg` se repiten constantemente y dos subidas con ese nombre en
 * el mismo milisegundo no pueden acabar componiendo la misma ruta — eso es
 * lo que evita el choque, no la fecha por sí sola. Exportada para poder
 * probarla sin simular el proveedor: es lógica nuestra, no una llamada a
 * Vercel Blob.
 */
export function rutaDeImagen(nombreOriginal: string, carpeta: Carpeta): string {
  const sufijo = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  return `${carpeta}/${nombreSeguro(nombreOriginal)}-${sufijo}.webp`;
}

/**
 * Guarda una foto y devuelve su URL y sus medidas.
 */
export async function guardarImagen(
  fichero: File,
  carpeta: Carpeta,
): Promise<ImagenGuardada> {
  compruebaFichero(fichero.type, fichero.size);

  const original = Buffer.from(await fichero.arrayBuffer());
  const { datos, ancho, alto, tipo } = await normaliza(original);

  const ruta = rutaDeImagen(fichero.name, carpeta);
  const url = await sube(ruta, datos, tipo);

  return { url, ancho, alto };
}

/**
 * Borra una foto. Que falle no puede tumbar el guardado de la ficha: una foto
 * huérfana en el almacén cuesta céntimos; una ficha que no se deja guardar
 * cuesta una llamada del cliente.
 */
export async function borrarImagen(url: string): Promise<void> {
  try {
    await borra(url);
  } catch (err) {
    console.error(
      "[storage] no se pudo borrar la foto:",
      err instanceof Error ? err.message : err,
    );
  }
}
