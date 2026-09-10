import { pool } from "~/lib/db/pool";
import { slugify } from "~/lib/slug";

/**
 * Noticias. Único sitio con SQL de noticias; hacia fuera, camelCase.
 */

export class NoticiaError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "NoticiaError";
  }
}

export type Noticia = {
  id: string;
  slug: string;
  titulo: string;
  excerpt: string;
  cuerpo: string;
  fecha: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  tags: string[];
  publicada: boolean;
};

export type DatosNoticia = {
  titulo: string;
  excerpt: string;
  cuerpo: string;
  fecha: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  tags: string[];
  publicada: boolean;
  /** Solo lo usa el volcado inicial, para conservar las URLs de siempre. */
  slug?: string;
};

const CAMPOS = `
  id, slug, titulo, excerpt, cuerpo,
  to_char(fecha, 'YYYY-MM-DD') as fecha,
  image_url    as "imageUrl",
  image_alt    as "imageAlt",
  image_width  as "imageWidth",
  image_height as "imageHeight",
  tags, publicada
`;

/**
 * Traduce los errores de Postgres a algo que se le puede enseñar a quien está
 * escribiendo la noticia. Mismo criterio que `direccionesErrores.ts`: el texto
 * de un índice único no sale nunca a la pantalla.
 */
function traduce(err: unknown): never {
  if (err instanceof NoticiaError) throw err;
  if (typeof err === "object" && err && "code" in err && err.code === "23505") {
    throw new NoticiaError(
      "Ya hay una noticia con ese título. Cámbialo un poco.",
      409,
    );
  }
  throw err;
}

export async function listarNoticias({
  soloPublicadas,
}: {
  soloPublicadas: boolean;
}): Promise<Noticia[]> {
  const { rows } = await pool.query<Noticia>(
    `select ${CAMPOS} from noticias
      ${soloPublicadas ? "where publicada" : ""}
      order by fecha desc, created_at desc`,
  );
  return rows;
}

export async function obtenerNoticia(
  slug: string,
  { soloPublicada = false }: { soloPublicada?: boolean } = {},
): Promise<Noticia | null> {
  const { rows } = await pool.query<Noticia>(
    `select ${CAMPOS} from noticias
      where slug = $1 ${soloPublicada ? "and publicada" : ""}`,
    [slug],
  );
  return rows[0] ?? null;
}

export async function crearNoticia(datos: DatosNoticia): Promise<Noticia> {
  try {
    const { rows } = await pool.query<Noticia>(
      `insert into noticias
         (slug, titulo, excerpt, cuerpo, fecha, image_url, image_alt,
          image_width, image_height, tags, publicada)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       returning ${CAMPOS}`,
      [
        datos.slug ?? slugify(datos.titulo),
        datos.titulo,
        datos.excerpt,
        datos.cuerpo,
        datos.fecha,
        datos.imageUrl,
        datos.imageAlt,
        datos.imageWidth,
        datos.imageHeight,
        datos.tags,
        datos.publicada,
      ],
    );
    return rows[0];
  } catch (err) {
    traduce(err);
  }
}

/**
 * El slug NO se recalcula al editar: si alguien corrige una errata del título,
 * la URL que ya está compartida por ahí fuera tiene que seguir funcionando.
 */
export async function actualizarNoticia(
  id: string,
  datos: DatosNoticia,
): Promise<Noticia | null> {
  try {
    const { rows } = await pool.query<Noticia>(
      `update noticias set
         titulo = $2, excerpt = $3, cuerpo = $4, fecha = $5,
         image_url = $6, image_alt = $7, image_width = $8, image_height = $9,
         tags = $10, publicada = $11, updated_at = now()
       where id = $1
       returning ${CAMPOS}`,
      [
        id,
        datos.titulo,
        datos.excerpt,
        datos.cuerpo,
        datos.fecha,
        datos.imageUrl,
        datos.imageAlt,
        datos.imageWidth,
        datos.imageHeight,
        datos.tags,
        datos.publicada,
      ],
    );
    return rows[0] ?? null;
  } catch (err) {
    traduce(err);
  }
}

export async function borrarNoticia(id: string): Promise<number> {
  const { rowCount } = await pool.query("delete from noticias where id = $1", [
    id,
  ]);
  return rowCount ?? 0;
}
