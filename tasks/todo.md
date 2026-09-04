# Pendientes — rebrand Horno San Lorenzo

## Bloquea encender los cobros
- [ ] Carta de precios con fotos → Bloque C (recategorizar a dulce/salado/packs,
      10 subcategorías, copys por producto, referencias que faltan)
- [ ] Condiciones de compra: razón social, CIF y revisión legal
- [ ] Configurar las 5 variables de Stripe y Resend en Vercel (ver `.env.example`)
- [ ] Confirmar con el obrador gastos de envío y pedido mínimo
      (constantes en `src/lib/entrega.ts`, hoy a cero)
- [ ] Confirmar qué formas de pago admite cada tienda

## Marca y contenido
- [ ] SVG oficial de Bizum para el pie (Simple Icons no lo trae)
- [ ] Foto real de cajitas para el submenú de «Packs y promos»
- [ ] Decidir si se recupera, reformulado, el copy retirado de Tradición
      («cero mejorantes, conservantes y colorantes»): el manual prohíbe las
      promesas de salud, pero puede ser un argumento de venta real

## Más adelante
- [ ] Bloque E: alta B2B real con validación de CIF, precios por cliente y
      packs XL descontados. Necesita backend (auth + base de datos)
- [ ] Revisar el despliegue en producción con el adaptador: rutas nuevas,
      fuentes y que las funciones de /api respondan
