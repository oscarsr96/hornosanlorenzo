import { describe, expect, it, beforeAll, afterAll } from "vitest";

// Igual que en `direcciones.test.ts`: nada de importar el repositorio aquí
// arriba. `~/lib/db/pedidos` arrastra `~/lib/db/pool`, que crea el pool en
// cuanto se carga el módulo — y lo crearía contra el DATABASE_URL normal,
// antes de que el beforeAll lo redirija a la base de pruebas.
const URL_PRUEBAS = process.env.DATABASE_URL_TEST;
const describeSiHayBD = URL_PRUEBAS ? describe : describe.skip;

describeSiHayBD("repositorio de pedidos", () => {
  let pool: import("pg").Pool;
  let repo: typeof import("~/lib/db/pedidos");

  const pedidoDePrueba = (extraPayload: { dateISO?: string } = {}) => ({
    lines: [
      {
        slug: "tarta-de-queso",
        name: "Tarta de queso",
        qty: 2,
        unitPriceCents: 1850,
        totalCents: 3700,
      },
      {
        slug: "croissant",
        name: "Croissant",
        variantLabel: "Grande",
        qty: 3,
        unitPriceCents: 190,
        totalCents: 570,
      },
    ],
    subtotalCents: 4270,
    shippingCents: 0,
    totalCents: 4270,
    payload: {
      items: [],
      mode: "recogida" as const,
      dateISO: "2026-09-20",
      slot: "morning" as const,
      storeId: "alcobendas",
      email: "cliente@example.com",
      phone: "666123456",
      name: "Ana",
      notes: "Sin azúcar por encima",
      ...extraPayload,
    },
  });

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    const { Pool } = await import("pg");
    pool = new Pool({ connectionString: URL_PRUEBAS, max: 2 });
    repo = await import("~/lib/db/pedidos");
    await pool.query("delete from pedidos");
  });

  afterAll(async () => {
    await pool.query("delete from pedidos");
    await pool.end();
  });

  it("guarda el pedido con sus líneas y el precio cobrado", async () => {
    const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);

    const [pedido] = (await repo.listarPedidos(10)).filter((p) => p.id === id);
    // Todavía está 'iniciado', así que no sale en el listado del panel.
    expect(pedido).toBeUndefined();

    const { rows } = await pool.query(
      "select estado, total_cents, telefono from pedidos where id = $1",
      [id],
    );
    expect(rows[0].estado).toBe("iniciado");
    expect(rows[0].total_cents).toBe(4270);

    const lineas = await pool.query(
      "select slug, unit_price_cents, variante_label from lineas_pedido where pedido_id = $1 order by orden",
      [id],
    );
    expect(lineas.rows).toHaveLength(2);
    expect(lineas.rows[0].unit_price_cents).toBe(1850);
    expect(lineas.rows[1].variante_label).toBe("Grande");
  });

  it("marcarPagado es idempotente: dos avisos de Stripe no duplican nada", async () => {
    const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.anotarSesionStripe(id, "cs_test_idem");

    const primera = await repo.marcarPagado({ sessionId: "cs_test_idem" });
    expect(primera?.id).toBe(id);
    expect(primera?.notificadoEn).toBeNull();

    await repo.marcarAvisado(id);

    const segunda = await repo.marcarPagado({ sessionId: "cs_test_idem" });
    // Sigue pagado, pero ahora consta que ya se avisó: quien llame sabrá
    // que no tiene que volver a mandar el correo.
    expect(segunda?.id).toBe(id);
    expect(segunda?.notificadoEn).toBeInstanceOf(Date);

    const { rows } = await pool.query(
      "select count(*)::int as n from pedidos where id = $1",
      [id],
    );
    expect(rows[0].n).toBe(1);
  });

  it("devuelve null si el aviso de Stripe no corresponde a ningún pedido nuestro", async () => {
    expect(
      await repo.marcarPagado({ sessionId: "cs_test_desconocida" }),
    ).toBeNull();
  });

  it("listarPedidos devuelve solo los pagados, del más reciente al más antiguo", async () => {
    const viejo = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.marcarPagado({ pedidoId: viejo, sessionId: "cs_test_viejo" });
    const nuevo = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
    await repo.marcarPagado({ pedidoId: nuevo, sessionId: "cs_test_nuevo" });
    await repo.crearPedidoIniciado(pedidoDePrueba() as never); // se queda iniciado

    const lista = await repo.listarPedidos(50);
    const ids = lista.map((p) => p.id);
    expect(ids).toContain(nuevo);
    expect(ids).toContain(viejo);
    expect(ids.indexOf(nuevo)).toBeLessThan(ids.indexOf(viejo));
    expect(lista.every((p) => p.lineas.length > 0)).toBe(true);
  });

  it("un pedido anotado sin pago (Stripe sin configurar) sale en el panel con su estado; un iniciado no", async () => {
    const sinPago = await repo.crearPedidoIniciado(pedidoDePrueba() as never, {
      estado: "sin_pago",
    });
    const iniciado = await repo.crearPedidoIniciado(pedidoDePrueba() as never);

    const lista = await repo.listarPedidos(50);
    const anotado = lista.find((p) => p.id === sinPago);
    expect(anotado?.estado).toBe("sin_pago");
    expect(lista.find((p) => p.id === iniciado)).toBeUndefined();
    // Los pagados siguen llevando su estado, para que el panel distinga.
    expect(lista.filter((p) => p.estado === "pagado").length).toBeGreaterThan(0);
  });

  describe("cambiar el estado desde el panel", () => {
    it("un pedido sin pago se marca como cobrado, y se puede deshacer", async () => {
      const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never, {
        estado: "sin_pago",
      });
      expect(await repo.cambiarEstadoAMano(id, "pagado")).toBe(true);
      expect((await repo.listarPedidos(50)).find((p) => p.id === id)?.estado).toBe("pagado");

      expect(await repo.cambiarEstadoAMano(id, "sin_pago")).toBe(true);
      expect((await repo.listarPedidos(50)).find((p) => p.id === id)?.estado).toBe("sin_pago");
    });

    it("un pedido cobrado por Stripe no se puede devolver a sin pago", async () => {
      const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
      await repo.marcarPagado({ pedidoId: id, sessionId: "cs_test_intocable" });
      expect(await repo.cambiarEstadoAMano(id, "sin_pago")).toBe(false);
      expect((await repo.listarPedidos(50)).find((p) => p.id === id)?.estado).toBe("pagado");
    });

    it("un carrito abandonado (iniciado) no se puede marcar como cobrado a mano", async () => {
      const id = await repo.crearPedidoIniciado(pedidoDePrueba() as never);
      expect(await repo.cambiarEstadoAMano(id, "pagado")).toBe(false);
      const { rows } = await pool.query("select estado from pedidos where id = $1", [id]);
      expect(rows[0].estado).toBe("iniciado");
    });

    it("un id que no existe devuelve false, no revienta", async () => {
      expect(
        await repo.cambiarEstadoAMano("00000000-0000-0000-0000-000000000000", "pagado"),
      ).toBe(false);
    });
  });

  describe("filtros del panel", () => {
    it("filtra por día de entrega y por día de entrada, y se pueden combinar", async () => {
      await pool.query("delete from pedidos");
      const entregaHoy = await repo.crearPedidoIniciado(
        pedidoDePrueba({ dateISO: "2026-09-20" }) as never,
        { estado: "sin_pago" },
      );
      const entregaOtro = await repo.crearPedidoIniciado(
        pedidoDePrueba({ dateISO: "2026-09-21" }) as never,
        { estado: "sin_pago" },
      );
      // Entró ayer: se fuerza `created_at`, que el repositorio no deja elegir.
      await pool.query(
        "update pedidos set created_at = created_at - interval '1 day' where id = $1",
        [entregaOtro],
      );
      const hoy = new Date().toISOString().slice(0, 10);
      const ayer = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

      const porEntrega = await repo.listarPedidos(50, { fechaEntrega: "2026-09-20" });
      expect(porEntrega.map((p) => p.id)).toEqual([entregaHoy]);

      const porEntrada = await repo.listarPedidos(50, { fechaEntrada: ayer });
      expect(porEntrada.map((p) => p.id)).toEqual([entregaOtro]);

      const combinado = await repo.listarPedidos(50, {
        fechaEntrega: "2026-09-21",
        fechaEntrada: hoy,
      });
      expect(combinado).toEqual([]);
    });
  });

  it("crearPedidoReconstruido es idempotente: dos entregas del mismo webhook no duplican las líneas", async () => {
    const datos = {
      stripeSessionId: "cs_test_reconstruido",
      mode: "domicilio" as const,
      fechaEntrega: "2026-12-24",
      slot: null,
      storeId: null,
      address: "Calle de la Prueba 1",
      postalCode: "28100",
      email: "cliente@example.com",
      telefono: "666123456",
      nombre: "Ana",
      notas: null,
      totalCents: 4270,
      lineas: [
        { nombre: "Tarta de queso", qty: 2, unitPriceCents: 1850 },
        { nombre: "Croissant", qty: 3, unitPriceCents: 190 },
      ],
    };

    await repo.crearPedidoReconstruido(datos);
    await repo.crearPedidoReconstruido(datos);

    const { rows: pedidos } = await pool.query(
      "select count(*)::int as n from pedidos where stripe_session_id = $1",
      [datos.stripeSessionId],
    );
    expect(pedidos[0].n).toBe(1);

    const { rows: lineas } = await pool.query(
      `select count(*)::int as n from lineas_pedido l
        join pedidos p on p.id = l.pedido_id
       where p.stripe_session_id = $1`,
      [datos.stripeSessionId],
    );
    expect(lineas[0].n).toBe(2);
  });

  it("un pedido reconstruido guarda la entrega que venía en Stripe, no una inventada", async () => {
    await repo.crearPedidoReconstruido({
      stripeSessionId: "cs_test_con_entrega",
      mode: "domicilio",
      fechaEntrega: "2026-12-24",
      slot: null,
      storeId: null,
      address: "Calle de la Prueba 1",
      postalCode: "28100",
      email: "cliente@example.com",
      telefono: "666123456",
      nombre: null,
      notas: null,
      totalCents: 3000,
      lineas: [{ nombre: "Roscón", qty: 1, unitPriceCents: 3000 }],
    });

    const [pedido] = (await repo.listarPedidos(50)).filter(
      (p) => p.stripeSessionId === "cs_test_con_entrega",
    );
    // Antes esto era siempre 'recogida' y la fecha de hoy, escritas a mano
    // por la propia función mientras el webhook tenía los datos buenos
    // delante y no los pasaba.
    expect(pedido.mode).toBe("domicilio");
    expect(pedido.fechaEntrega).toBe("2026-12-24");
    expect(pedido.postalCode?.trim()).toBe("28100");
  });

  it("lo que Stripe no trae se guarda como nulo, no como un valor por defecto", async () => {
    await repo.crearPedidoReconstruido({
      stripeSessionId: "cs_test_sin_entrega",
      mode: null,
      fechaEntrega: null,
      slot: null,
      storeId: null,
      address: null,
      postalCode: null,
      email: "cliente@example.com",
      telefono: "666123456",
      nombre: null,
      notas: null,
      totalCents: 3000,
      lineas: [{ nombre: "Roscón", qty: 1, unitPriceCents: 3000 }],
    });

    const [pedido] = (await repo.listarPedidos(50)).filter(
      (p) => p.stripeSessionId === "cs_test_sin_entrega",
    );
    // El panel lo enseña como «sin datos»: un día y una modalidad
    // inventados serían peores que admitir que no se saben.
    expect(pedido.mode).toBeNull();
    expect(pedido.fechaEntrega).toBeNull();
  });
});
