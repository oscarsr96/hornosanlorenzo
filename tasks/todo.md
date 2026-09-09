# Pendientes — Horno San Lorenzo

## Bloquea encender los cobros
- [ ] **Antes de poner `RESEND_API_KEY`: cerrar la fuga por tiempo de la
      recuperación de contraseña.** La respuesta de «he olvidado mi contraseña»
      dice lo mismo exista o no la cuenta, pero si existe **espera** a que salga
      el correo y si no existe no espera: se puede saber quién es cliente
      midiendo cuánto tarda. Hoy no se nota porque no hay proveedor configurado.
      El arreglo es `advanced.backgroundTasks.handler` de Better Auth con el
      `waitUntil` de Vercel, pero **exige Fluid Compute activado** en el panel
      del proyecto: sin eso, `waitUntil` es un no-op silencioso y el correo de
      recuperación podría no enviarse nunca. Comprobar primero si está activo
      (detalle en la sección «Ronda de arreglo 1» del informe de la tarea 9)
- [ ] **Horario real de la tienda de Alcobendas.** La ficha dice «Lun–Sáb
      7:00–14:00» y Oscar confirmó el 9 de septiembre de 2026 que está mal: la
      recogida llega hasta las 19:30. No lo cambio sin el horario completo —si
      hay cierre a mediodía, como en Pozuelo, no me lo puedo inventar. Está en
      `src/data/stores.ts`
- [ ] **Validar los códigos postales de reparto.** `CP_RANGOS` en
      `src/lib/entrega.ts` bloquea el envío fuera de zona, pero los rangos los
      saqué yo de fuentes públicas, no del cliente: Madrid capital
      28001–28055,
      Alcobendas 28100–28109, Pozuelo 28220–28224, San Sebastián de los Reyes
      28700–28709, Tres Cantos 28760. Confirmarlos con el obrador antes de
      cobrar: un rango de más acepta pedidos que no se pueden repartir, y uno
      de menos rechaza clientes buenos
- [ ] **Alérgenos de las 100 fichas.** Van todas con `allergens: []` porque la
      carta no los trae. No inventarlos: tienen que venir del obrador
- [ ] Configurar las 5 variables de Stripe y Resend en Vercel (`.env.example`)
- [ ] Condiciones de compra: razón social, CIF y revisión legal
- [ ] Confirmar con el obrador gastos de envío y pedido mínimo
      (constantes en `src/lib/entrega.ts`, hoy a cero)
- [ ] Confirmar qué formas de pago admite cada tienda

## Carta: lo que falta
- [ ] Fotos reales: las 100 fichas llevan las 8 fotos del obrador repetidas por
      familia, ninguna es del producto de su ficha
- [ ] Salado repite foto en fichas seguidas (solo hay una foto salada en el
      lote). Decidir: dejarlo, o recortar la de empanadas en dos encuadres
- [ ] Copy propio para 47 productos que hoy usan la nota de su sección
      (planchas, colección especial, brazos, empanadas, quiches, Lorenzas)
- [ ] Páginas de la carta de **bollería diaria** y **temporada**: no estaban en
      los rangos 5–14, así que esas dos gamas no tienen ni una ficha
- [ ] Precio de «Las Lorenzas Rellenas Saladas» y «Las Lorenzas Variadas»,
      hoy marcadas `consultar: true`

## Coherencia y deuda
- [ ] **Firma en versión clara.** La cabecera es teja y el logo es moka: hoy se
      invierte a blanco por CSS (`[filter:brightness(0)_invert(1)]` en
      `Header.astro`), lo que aplana el acento teja del «desde 1986». Pedir al
      cliente el PNG de la firma en blanco y quitar el filtro
- [ ] **Copy de «Particulares» inventado.** La sección 01 de
      `/a-quien-servimos` (lead, bullets y cita) la escribí yo por analogía con
      Hostelería y Empresas: el brief solo traía esos dos canales. Validar con
      el cliente antes de enseñarlo
- [ ] Los tres servicios de la home (`src/data/services.ts`) siguen siendo
      «Reparto propio · Empresas y oficinas · Hostelería»: no casan con los tres
      públicos nuevos (Particulares · Hostelería · Empresas). Unificar
- [ ] Sin WhatsApp en todo el sitio (decisión del 9 de septiembre de 2026): la
      única vía de pedido es Stripe, que aún no tiene claves. Hasta
      configurarlo, el checkout solo puede ofrecer teléfono
- [ ] `src/components/Firma.astro` quedó sin uso al poner el logo en PNG en la
      cabecera: borrarlo o reutilizarlo en documentos
- [ ] `/catalogo/empanada-de-zorza` ya no existe (ahora `-picadillo-adobado`) y
      no hay redirección
- [ ] Pozuelo abre domingos según su ficha, pero el checkout bloquea todos los
      domingos (`isClosed` en `src/lib/entrega.ts`). Preguntar al obrador
- [ ] Taxonomía legacy en `src/data/categories.ts`: `temporada` se quedó a cero
      productos y la etiqueta de `bolleria` ya no describe su contenido
- [ ] Nombres desalineados: el pie dice «Nuestros productos» y «Packs y promos»
      frente a «Tienda Online» y «Packs» del menú; y «Carta» no está en el pie
- [ ] El hero usa `--color-cream`, el mismo tono que ahora tiene la banda
      superior: cabecera y hero se funden
- [ ] La cabecera sticky en móvil ocupa ~132 px con el CTA. Valorar sacarlo
      del sticky si molesta al hacer scroll
- [ ] SVG oficial de Bizum para el pie (Simple Icons no lo trae)
- [ ] Foto real de cajitas para el submenú de «Packs»
- [ ] Decidir si se recupera, reformulado, el copy retirado de Tradición
      («cero mejorantes, conservantes y colorantes»): el manual prohíbe las
      promesas de salud, pero puede ser un argumento de venta real

## Más adelante
- [ ] **Llevar el cómputo a Cloud Run** cuando el proyecto esté asentado. Del
      análisis de costes del 9 de septiembre de 2026: Vercel Pro son ~20 €/mes
      —Hobby no vale, es solo uso no comercial y esto cobra con Stripe— y Cloud
      Run a este tráfico son ~2–5 € porque escala a cero. La base de datos **se
      queda donde esté**: Cloud SQL no tiene plan gratuito, no baja a cero y es
      justo la pieza cara (~10–30 €/mes). O sea, la jugada es mover el cómputo,
      no «migrar a Google Cloud». Son unas horas, no una migración, porque el
      diseño ya no depende del proveedor
      (`docs/superpowers/specs/2026-09-09-registro-usuarios-y-panel-admin-design.md`, §5.3).
      Ojo con Cloudflare como alternativa barata: su entorno no es Node del todo
      y `pg` no funciona ahí sin cambiar a un driver por HTTP. Cloud Run sí, es
      un contenedor de Node normal.
      Los precios salen de mi entrenamiento, no de sus webs: confírmalos antes
      de decidir
- [ ] Bloque E: alta B2B real con validación de CIF, precios por cliente y
      packs XL descontados. Necesita backend (auth + base de datos)
- [ ] Si algún día se quieren cuentas de usuario, el alta de `/acceso` está
      montada para admitir contraseña. Hoy no la pide a propósito
- [ ] Revisar el despliegue en producción: rutas nuevas, el PDF de la carta y
      que las funciones de /api respondan
