import { describe, expect, it, vi, beforeEach } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("invalidar", () => {
  it("pide cada ruta con la cabecera de invalidación de Vercel", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-secreto");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { invalidar } = await import("~/lib/cache");
    await invalidar(["/", "/noticias"]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, opciones] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://ejemplo.test/");
    expect(opciones.method).toBe("HEAD");
    expect(opciones.headers["x-prerender-revalidate"]).toBe("token-secreto");
  });

  it("un 401 de Vercel se registra: la invalidación no puede fallar en silencio", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-que-no-coincide");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    // `fetch` resuelve tan normal con un 401: sin mirar el estado, un token
    // desparejado dejaría el sitio sin invalidar nada y sin una sola línea
    // en los registros.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await expect(invalidar(["/noticias"])).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(String(errorSpy.mock.calls[0][0])).toContain("401");
    errorSpy.mockRestore();
  });

  it("una respuesta correcta no registra nada", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-secreto");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 200 })),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await invalidar(["/noticias"]);

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("el sitemap de contenido entra en las dos listas", async () => {
    // Se arma leyendo las dos tablas y también va por ISR: si no se
    // invalidara, una ficha o una noticia nueva no llegaría a los
    // buscadores hasta el siguiente despliegue.
    const { RUTAS_NOTICIAS, RUTAS_CATALOGO } = await import("~/lib/cache");
    expect(RUTAS_NOTICIAS).toContain("/sitemap-contenido.xml");
    expect(RUTAS_CATALOGO).toContain("/sitemap-contenido.xml");
  });

  it("sin token configurado no llama a nadie y no lanza", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await expect(invalidar(["/noticias"])).resolves.toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("si la invalidación falla, no lanza: el guardado ya se hizo", async () => {
    vi.stubEnv("VERCEL_BYPASS_TOKEN", "token-secreto");
    vi.stubEnv("PUBLIC_SITE_URL", "https://ejemplo.test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNRESET")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { invalidar } = await import("~/lib/cache");
    await expect(invalidar(["/noticias"])).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
