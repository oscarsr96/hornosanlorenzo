import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/lib/db/noticias", () => ({
  listarNoticias: vi.fn().mockResolvedValue([]),
  crearNoticia: vi.fn(),
  actualizarNoticia: vi.fn(),
  borrarNoticia: vi.fn(),
  NoticiaError: class extends Error {},
}));
vi.mock("~/lib/cache", () => ({
  invalidar: vi.fn(),
  RUTAS_NOTICIAS: ["/"],
  // El endpoint de productos también importa esto: sin extenderlo aquí
  // quedaría `undefined` y `[...RUTAS_CATALOGO, ...]` del PUT reventaría.
  RUTAS_CATALOGO: ["/", "/catalogo"],
}));
vi.mock("~/lib/storage", () => ({
  guardarImagen: vi.fn(),
  ImagenError: class extends Error {},
}));
vi.mock("~/lib/db/productos", () => ({
  listarProductos: vi.fn().mockResolvedValue([]),
  crearProducto: vi.fn(),
  actualizarProducto: vi.fn(),
  ProductoError: class extends Error {},
}));

const cliente = { id: "u1", email: "a@b.c", name: "Ana", rol: "cliente" };
const admin = { id: "u2", email: "c@d.e", name: "Carmen", rol: "admin" };

const peticion = (body: unknown) =>
  new Request("https://x.test/api/admin/noticias", {
    method: "POST",
    body: JSON.stringify(body),
  });

// Sin fichero: basta para probar la guardia (que corta antes de leer el
// `FormData`) y, con sesión de admin, para llegar a la validación propia
// del endpoint ("No hemos recibido la foto.").
const peticionImagen = (formData: FormData = new FormData()) =>
  new Request("https://x.test/api/admin/imagen", {
    method: "POST",
    body: formData,
  });

beforeEach(() => vi.resetModules());

describe("guardia de los endpoints del panel", () => {
  it("sin sesión, 404: ni siquiera se admite que el endpoint existe", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({
      request: peticion({}),
      locals: { usuario: null },
    } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de cliente, 404", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({
      request: peticion({}),
      locals: { usuario: cliente },
    } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de admin, entra en la validación (400 por datos, no 404)", async () => {
    const { POST } = await import("~/pages/api/admin/noticias");
    const r = await POST({
      request: peticion({}),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });
});

describe("guardia del endpoint de subida de fotos", () => {
  it("sin sesión, 404", async () => {
    const { POST } = await import("~/pages/api/admin/imagen");
    const r = await POST({
      request: peticionImagen(),
      locals: { usuario: null },
    } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de cliente, 404", async () => {
    const { POST } = await import("~/pages/api/admin/imagen");
    const r = await POST({
      request: peticionImagen(),
      locals: { usuario: cliente },
    } as never);
    expect(r.status).toBe(404);
  });

  it("con sesión de admin y sin foto, 400: la guardia deja pasar, la validación no", async () => {
    const { POST } = await import("~/pages/api/admin/imagen");
    const r = await POST({
      request: peticionImagen(),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });
});

describe("guardia y validación de /api/admin/productos", () => {
  const peticionProducto = (body: unknown) =>
    new Request("https://x.test/api/admin/productos", {
      method: "POST",
      body: JSON.stringify(body),
    });

  it("con sesión de cliente, 404", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const r = await POST({
      request: peticionProducto({}),
      locals: { usuario: cliente },
    } as never);
    expect(r.status).toBe(404);
  });

  it("un precio negativo o cero no entra, aunque lo mande un admin", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const base = {
      name: "Tarta",
      category: "tartas",
      shortDescription: "Una tarta.",
      priceCents: 0,
      consultar: false,
      allergens: [],
      variantes: [],
    };
    const r = await POST({
      request: peticionProducto(base),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });

  it("una categoría inventada tampoco: la lista está cerrada en código", async () => {
    const { POST } = await import("~/pages/api/admin/productos");
    const r = await POST({
      request: peticionProducto({
        name: "Tarta",
        category: "inventada",
        shortDescription: "Una tarta.",
        priceCents: 1000,
        consultar: false,
        allergens: [],
        variantes: [],
      }),
      locals: { usuario: admin },
    } as never);
    expect(r.status).toBe(400);
  });
});
