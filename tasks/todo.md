# Pendientes — Horno San Lorenzo

## Bloquea encender los cobros
- [ ] **RGPD de las cuentas.** La política de privacidad dice literalmente que
      solo regula el formulario de contacto, y ese formulario recoge menos datos
      y tiene más garantías que el alta de cuenta (que no tiene ni casilla de
      consentimiento ni enlace). Faltan: encargados del tratamiento (Neon,
      Resend, Stripe **y ahora también Vercel Blob**, que entra con el panel de
      productos y noticias de esta rama, así que la lista se hace más larga, no
      más corta), plazo de conservación y **borrado de cuenta a petición**, que
      hoy no existe ni técnicamente. Bloquea que se registre el primer cliente
      real, no el despliegue
- [ ] **Probar una restauración de copia de seguridad**, no solo confiar en que
      Neon las hace: restaurar un volcado a una base vacía y ver que arranca.
      Esto ya no es solo prudencia: con esta rama la carta entera, las noticias
      y los pedidos viven en Postgres. Antes el contenido estaba en git y se
      recuperaba solo aunque se perdiera la base de datos; ahora, si se pierde
      la base de datos, se pierden las 98 fichas, las noticias y los pedidos a
      la vez. Esto sube de «pendiente» a «lo primero que se prueba antes de
      confiar en el sistema»
- [ ] **Las fotos ya no están en git.** Viven en Vercel Blob y no entran hoy en
      ninguna copia de seguridad. Antes una foto mala se corregía con
      `git revert`; ahora, si se borra o se sobrescribe por error desde
      `/admin/productos` o `/admin/noticias`, no hay vuelta atrás. Decidir si se
      hace un volcado periódico de Blob o se asume el riesgo por escrito
- [ ] **Separar la base de datos de desarrollo de la de producción.**
      `DATABASE_URL` sigue apuntando a la misma rama de Neon en local y en
      Vercel. Ya estaba anotado como incómodo; con la carta, las noticias y los
      pedidos viviendo ahí dentro, deja de ser incómodo y pasa a ser peligroso:
      cualquier prueba local podría escribir o borrar sobre las 98 fichas
      reales, sobre una noticia publicada o sobre un pedido de un cliente.
      Resolverlo **antes** de correr el volcado (punto siguiente) contra
      producción, no después. La rama `pruebas` de Neon ya existe y es gratis
- [ ] **El volcado de productos y noticias no se ha ejecutado nunca contra
      producción, ni se ha hecho el ensayo que verifica que funciona.**
      `pnpm migrar:productos` y `pnpm migrar:noticias` solo se han corrido en
      este entorno de trabajo, que no tiene `BLOB_READ_WRITE_TOKEN` — así que
      nunca se han corrido de verdad, contra ninguna base de datos real, ni han
      subido una sola foto. Tampoco se ha hecho el ensayo que el plan llama «la
      diferencia entre migrar y perder la carta»: volcar, romper un precio a
      propósito, y comprobar que `pnpm migrar:productos --verificar` lo detecta.
      Hasta que ese ensayo y el volcado real pasen en verde contra producción,
      **`src/content/products/` y `src/content/noticias/` no se tocan**: hoy son
      la única copia de la carta y de las noticias que existe fuera del
      historial de git, porque las tablas `productos` y `noticias` de
      producción están vacías
- [ ] **Las migraciones 005, 006 y 007 no están aplicadas en producción.**
      Producción solo tiene hasta `db/migrations/004_direcciones.sql`; las
      tablas de pedidos (`005_pedidos.sql`), noticias (`006_noticias.sql`) y
      productos con sus variantes (`007_productos.sql`) solo existen en este
      entorno local. Si esta rama se despliega antes de correr `pnpm db:migrar`
      contra producción, el checkout intenta escribir en una tabla `pedidos`
      que no existe todavía, y falla justo en el momento de cobrar
- [ ] **`VERCEL_BYPASS_TOKEN` y `BLOB_READ_WRITE_TOKEN` sin configurar en
      Vercel.** El primero invalida la caché ISR cuando se guarda algo desde el
      panel; el segundo sube y borra fotos en Vercel Blob. Sin ellos, el panel
      deja guardar pero la web no se entera del cambio (o tarda hasta que
      caduque la caché) y no se pueden subir fotos. Ojo en particular con
      `VERCEL_BYPASS_TOKEN`: tiene que estar puesto en el entorno de
      **construcción** de Vercel además del de ejecución, porque
      `astro.config.mjs` lo lee con `process.env.VERCEL_BYPASS_TOKEN` al
      construir. Si solo está en el entorno de ejecución, la invalidación falla
      en silencio y nadie se entera hasta que alguien pregunta por qué un
      precio cambiado en el panel no se ve en la web
- [ ] **`DATABASE_URL` y `BETTER_AUTH_SECRET` en Vercel antes de fusionar
      `feat/base-de-datos-y-acceso` a `main`.** `src/middleware.ts` corre en
      todas las peticiones y importa `~/lib/auth/server`, que crea el pool de
      Postgres en cuanto se carga el módulo: sin `DATABASE_URL` ese `import`
      lanza y **el build de Vercel falla para todo el sitio**, no solo para
      cuenta o carrito. Sin `BETTER_AUTH_SECRET` pasa lo mismo al construirse
      `auth`. Las dos tienen que estar puestas en Vercel antes de fusionar,
      no después.
      Añadir también `PUBLIC_SITE_URL` al entorno de **build**, no solo al de
      ejecución: `import.meta.env.PUBLIC_SITE_URL` se resuelve en build
      (Vite la sustituye como una constante), así que si solo está en el
      entorno de ejecución llega `undefined` a `auth.baseURL` y Better Auth
      construye los enlaces de recuperación de contraseña con el `Host` de
      cada petición en vez de con el dominio real.
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
- [ ] **Alérgenos de las 98 fichas.** Siguen todas con `allergens: []` porque la
      carta impresa no los trae — eso no ha cambiado, y no se pueden inventar.
      Lo que sí cambió: ya no es tarea de un desarrollador editando 98 Markdown
      uno a uno. El obrador puede entrarlos él mismo, ficha a ficha, desde
      `/admin/productos`, en cuanto exista la ficha en producción (ver el punto
      del volcado, más arriba). Siguen teniendo que venir de ellos, pero ya no
      hace falta pasar por nosotros para meterlos
- [ ] Configurar las 5 variables de Stripe y Resend en Vercel (`.env.example`)
- [ ] Condiciones de compra: razón social, CIF y revisión legal
- [ ] Confirmar con el obrador gastos de envío y pedido mínimo
      (constantes en `src/lib/entrega.ts`, hoy a cero)
- [ ] Confirmar qué formas de pago admite cada tienda

## Carta: lo que falta
- [ ] **Fotos reales.** Las 98 fichas siguen llevando las 8 fotos del obrador
      repetidas por familia, ninguna es la del producto de su propia ficha —
      eso no ha cambiado. Lo que cambió: las fotos ya no se comitean al
      repositorio, se suben desde `/admin/productos` (Vercel Blob detrás).
      Sigue haciendo falta una sesión de fotos del obrador, producto a
      producto, pero en cuanto exista quien la tenga puede subirla directamente
      desde el panel, sin pasar por un desarrollador ni por un `git commit`
- [ ] Salado repite foto en fichas seguidas (solo hay una foto salada en el
      lote). Decidir: dejarlo, o recortar la de empanadas en dos encuadres
- [ ] Copy propio para 47 productos que hoy usan la nota de su sección
      (planchas, colección especial, brazos, empanadas, quiches, Lorenzas)
- [ ] Páginas de la carta de **bollería diaria** y **temporada**: no estaban en
      los rangos 5–14, así que esas dos gamas no tienen ni una ficha
- [ ] Precio de «Las Lorenzas Rellenas Saladas» y «Las Lorenzas Variadas»,
      hoy marcadas `consultar: true`

## Coherencia y deuda
- [ ] Variables del entorno **preview** en Vercel (`DATABASE_URL`,
      `BETTER_AUTH_SECRET`): no se pudieron poner con el CLI v50 instalado, que
      pide confirmación interactiva. Sin ellas los despliegues de rama fallan al
      construir y los pull requests salen en rojo. Se arregla desde el panel o
      actualizando el CLI
- [ ] Comprobar en un despliegue real que el límite de intentos identifica la IP
      del cliente y no cae en el contador global. Es la única defensa contra
      fuerza bruta que hay
- [ ] **Pantalla para dar de alta a otro admin.** Hoy el papel se da con
      `pnpm admin correo@ejemplo.com` contra la base de datos. La spec §7 dice
      que un admin debería poder dar de alta a otro desde el panel; mientras no
      exista, cada alta pasa por alguien con acceso a `DATABASE_URL`
- [ ] **Cerrar y volver a abrir sesión después de `pnpm admin`.** El papel viaja
      en la sesión que resuelve el middleware: quien ya estuviera dentro sigue
      viendo la web como cliente hasta que vuelve a entrar
- [ ] **El panel no deja registro de quién cambia qué.** Un cambio de precio,
      de foto, de alérgenos o de una noticia publicada no queda anotado hoy con
      quién lo hizo ni cuándo. Con un solo administrador no importa; en cuanto
      haya dos, un precio mal puesto o una ficha desactivada por error no se
      puede rastrear hasta quien lo tecleó
- [ ] **Nadie ha visto el panel en un navegador de verdad.** Cada pantalla
      (`/admin/pedidos`, `/admin/clientes`, `/admin/noticias`,
      `/admin/productos`) se verificó con pruebas automáticas, `curl` y la
      salida de `pnpm build`, nunca abriéndola en un navegador. Falta la pasada
      visual completa y, sobre todo, probar de principio a fin el flujo de subir
      una foto real: elegir fichero, que suba a Vercel Blob, guardar la ficha y
      comprobar que se ve cambiada en `/catalogo`
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
