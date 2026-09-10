import { put, del } from "@vercel/blob";

/**
 * El ÚNICO fichero del proyecto que sabe que los ficheros están en Vercel
 * Blob. La spec §5.3 lo pide así: mudarse a Cloud Storage es reescribir esto
 * y nada más. Si algún día aparece un `import` de `@vercel/blob` en otro
 * sitio, esa promesa se ha roto.
 */

export async function sube(
  ruta: string,
  datos: Buffer,
  tipo: string,
): Promise<string> {
  const { url } = await put(ruta, datos, {
    access: "public",
    contentType: tipo,
    // El nombre lo componemos nosotros con un sufijo propio (ver index.ts):
    // no hace falta que el proveedor añada el suyo, y así la URL es legible.
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

export async function borra(url: string): Promise<void> {
  await del(url);
}
