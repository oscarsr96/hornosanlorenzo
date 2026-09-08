# Pendientes — Horno San Lorenzo

## Bloquea encender los cobros
- [ ] **Alérgenos de las 100 fichas.** Van todas con `allergens: []` porque la
      carta no los trae. No inventarlos: tienen que venir del obrador
- [ ] Configurar las 5 variables de Stripe y Resend en Vercel (`.env.example`)
- [ ] `PUBLIC_WHATSAPP_NUMBER` en Vercel: si falta, el botón de WhatsApp del
      checkout abre `wa.me/` sin destinatario
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
- [ ] Bloque E: alta B2B real con validación de CIF, precios por cliente y
      packs XL descontados. Necesita backend (auth + base de datos)
- [ ] Si algún día se quieren cuentas de usuario, el alta de `/acceso` está
      montada para admitir contraseña. Hoy no la pide a propósito
- [ ] Revisar el despliegue en producción: rutas nuevas, el PDF de la carta y
      que las funciones de /api respondan
