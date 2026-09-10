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
 * Guarda una foto y devuelve su URL y sus medidas. El sufijo con la fecha
 * evita que subir una foto nueva con el mismo nombre pise a la anterior, que
 * puede seguir usada por otra ficha.
 */
export async function guardarImagen(
  fichero: File,
  carpeta: Carpeta,
): Promise<ImagenGuardada> {
  compruebaFichero(fichero.type, fichero.size);

  const original = Buffer.from(await fichero.arrayBuffer());
  const { datos, ancho, alto, tipo } = await normaliza(original);

  const ruta = `${carpeta}/${nombreSeguro(fichero.name)}-${Date.now()}.webp`;
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
