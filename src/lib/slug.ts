/**
 * Slug para una URL a partir de un título. Vive aparte de los repositorios
 * porque lo usan las noticias y los productos, y porque es lógica pura que se
 * prueba sin base de datos.
 */
export function slugify(texto: string): string {
  const limpio = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  // Un slug vacío rompería la URL: mejor uno feo que una página en /noticias/.
  return limpio || "noticia";
}
