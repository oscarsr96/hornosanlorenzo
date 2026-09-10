import { createMarkdownProcessor } from "@astrojs/markdown-remark";

/**
 * El cuerpo de noticias y fichas ahora sale de una columna, no de un fichero,
 * así que `<Content />` de `astro:content` ya no sirve. Este es el mismo
 * procesador que usa Astro por dentro: el HTML sale idéntico al de los
 * Markdown de antes, no parecido.
 *
 * OJO: el Markdown de Astro deja pasar HTML en crudo. Hoy solo escribe aquí
 * un admin —que ya puede cambiar precios—, así que no añade riesgo nuevo. Si
 * algún día escribe más gente, hay que sanear la salida.
 *
 * El procesador se crea una sola vez por instancia: montarlo cuesta y se
 * reaprovecha entre peticiones de la misma función.
 */
let procesador: ReturnType<typeof createMarkdownProcessor> | null = null;

export async function aHtml(markdown: string): Promise<string> {
  if (!markdown.trim()) return "";
  procesador ??= createMarkdownProcessor();
  const { code } = await (await procesador).render(markdown);
  return code;
}
