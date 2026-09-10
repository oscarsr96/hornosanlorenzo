import { describe, expect, it, beforeAll, afterAll } from "vitest";

const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de noticias", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/noticias");

  const datos = (extra: Record<string, unknown> = {}) => ({
    titulo: "Roscón de Reyes 2026",
    excerpt: "Reservas abiertas hasta el 3 de enero.",
    cuerpo: "El roscón es el postre de la casa.\n\n**Reservas:** en tienda.",
    fecha: "2025-12-15",
    imageUrl: "https://x.public.blob.vercel-storage.com/noticias/roscon.webp",
    imageAlt: "Roscón de Reyes con nata",
    imageWidth: 1600,
    imageHeight: 1000,
    tags: ["temporada", "navidad"],
    publicada: true,
    ...extra,
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/noticias");
    await pool.query("delete from noticias");
  });

  afterAll(async () => {
    await pool.query("delete from noticias");
    await pool.end();
  });

  it("crea una noticia y le saca el slug del título", async () => {
    const noticia = await repo.crearNoticia(datos());
    expect(noticia.slug).toBe("roscon-de-reyes-2026");
    expect(noticia.tags).toEqual(["temporada", "navidad"]);
    expect(noticia.imageWidth).toBe(1600);
  });

  it("no deja dos noticias con el mismo slug: lo dice en cristiano", async () => {
    await expect(repo.crearNoticia(datos())).rejects.toMatchObject({
      name: "NoticiaError",
      status: 409,
    });
    // El mensaje no puede escupir el nombre del índice de Postgres.
    await expect(repo.crearNoticia(datos())).rejects.toThrow(
      /ya hay una noticia/i,
    );
  });

  it("una noticia sin publicar no sale en la web pero sí en el panel", async () => {
    await repo.crearNoticia(
      datos({ titulo: "Borrador de San Valentín", publicada: false }),
    );

    const publicas = await repo.listarNoticias({ soloPublicadas: true });
    expect(publicas.map((n) => n.titulo)).not.toContain(
      "Borrador de San Valentín",
    );

    const todas = await repo.listarNoticias({ soloPublicadas: false });
    expect(todas.map((n) => n.titulo)).toContain("Borrador de San Valentín");

    // Y tampoco se puede llegar a ella por su URL adivinando el slug.
    expect(
      await repo.obtenerNoticia("borrador-de-san-valentin", {
        soloPublicada: true,
      }),
    ).toBeNull();
    expect(
      await repo.obtenerNoticia("borrador-de-san-valentin"),
    ).not.toBeNull();
  });

  it("actualiza y borra, y el slug no se recalcula aunque cambie el título", async () => {
    const noticia = await repo.crearNoticia(datos({ titulo: "Torrijas 2026" }));
    expect(noticia.slug).toBe("torrijas-2026");
    const cambiada = await repo.actualizarNoticia(noticia.id, {
      // Título distinto a propósito: si `actualizarNoticia` recalculara el
      // slug a partir de él, esta prueba lo detectaría. Con el mismo
      // título de antes (como estaba escrita esta prueba) un slug
      // recalculado por error habría dado el mismo valor y habría pasado
      // igual.
      ...datos({ titulo: "Torrijas de Semana Santa 2026" }),
      excerpt: "Solo en Semana Santa.",
    });
    expect(cambiada?.excerpt).toBe("Solo en Semana Santa.");
    // La URL ya compartida (`/noticias/torrijas-2026`) tiene que seguir
    // funcionando aunque el título haya cambiado.
    expect(cambiada?.slug).toBe("torrijas-2026");
    // Devuelve el slug, no un recuento: el endpoint lo necesita para
    // invalidar la propia página de la noticia (`/noticias/<slug>`), que si
    // no se queda viva y compartible después de borrarla.
    expect(await repo.borrarNoticia(noticia.id)).toBe("torrijas-2026");
    expect(await repo.borrarNoticia(noticia.id)).toBeNull();
  });

  it("las publicadas salen de la más reciente a la más antigua", async () => {
    await pool.query("delete from noticias");
    await repo.crearNoticia(datos({ titulo: "Vieja", fecha: "2025-01-01" }));
    await repo.crearNoticia(datos({ titulo: "Nueva", fecha: "2026-01-01" }));
    const lista = await repo.listarNoticias({ soloPublicadas: true });
    expect(lista.map((n) => n.titulo)).toEqual(["Nueva", "Vieja"]);
  });
});
