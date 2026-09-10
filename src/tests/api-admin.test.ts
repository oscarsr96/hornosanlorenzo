import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("~/lib/db/noticias", () => ({
  listarNoticias: vi.fn().mockResolvedValue([]),
  crearNoticia: vi.fn(),
  actualizarNoticia: vi.fn(),
  borrarNoticia: vi.fn(),
  NoticiaError: class extends Error {},
}));
vi.mock("~/lib/cache", () => ({ invalidar: vi.fn(), RUTAS_NOTICIAS: ["/"] }));
vi.mock("~/lib/storage", () => ({
  guardarImagen: vi.fn(),
  ImagenError: class extends Error {},
}));

const cliente = { id: "u1", email: "a@b.c", name: "Ana", rol: "cliente" };
const admin = { id: "u2", email: "c@d.e", name: "Carmen", rol: "admin" };

const peticion = (body: unknown) =>
  new Request("https://x.test/api/admin/noticias", {
    method: "POST",
    body: JSON.stringify(body),
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
