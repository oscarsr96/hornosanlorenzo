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
    // El nombre lo componemos nosotros con un sufijo propio (ver
    // `rutaDeImagen` en index.ts): no hace falta que el proveedor añada el
    // suyo, y así la URL es legible.
    addRandomSuffix: false,
    // `rutaDeImagen` ya incluye un componente aleatorio: con eso, dos rutas
    // iguales son prácticamente imposibles. Si aun así ocurre, significa que
    // algo va muy mal, y la respuesta correcta es fallar alto — un 500 al
    // subir la foto se ve y se puede reintentar. Con `allowOverwrite: true`
    // el choque pisaría en silencio una foto que puede seguir usada por otra
    // ficha, y eso no se descubre hasta que alguien pregunta por qué su
    // tarta enseña una foto de una empanada.
    allowOverwrite: false,
  });
  return url;
}

export async function borra(url: string): Promise<void> {
  await del(url);
}
