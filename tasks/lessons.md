# Lecciones — hornosanlorenzo

## Las cachés de desarrollo dan falsos positivos

Tres formas de perseguir el bug equivocado. Tras `pnpm add`, la caché de Vite
falla con `jsxDEV is not a function`, que parece un error de React (pasó con
`CartPage`, que estaba bien). Tras reiniciar, Astro cambia de puerto sin avisar
y se prueba contra un servidor viejo. Y tras renombrar fichas de contenido,
`.astro/data-store.json` escupe un «Duplicate id» por fichero: parecen 100
errores y son cero.

**Why:** una prueba que pasa —o falla— contra el entorno equivocado cierra la
investigación en falso.

**How to apply:** vaciar `node_modules/.vite` y `.astro/` antes de tocar nada, y
leer el puerto del log (`grep Local`) en vez de darlo por hecho.

## Verificar el camino completo, no la pieza que tocaste

Cargué productos con varios tamaños y comprobé la ficha: la rejilla seguía
metiendo en el carrito la talla más barata. Añadí «Top Ventas» al submenú y
comprobé el menú: `/catalogo` seguía pintando la taxonomía vieja. Al revés
también paga: pulsar de verdad el botón de WhatsApp destapó un fallo que nadie
había reportado —sin `PUBLIC_WHATSAPP_NUMBER` el handler reventaba y el botón no
hacía nada—, porque nadie lo había pulsado en local.

**Why:** lo editado funcionaba; fallaba la pantalla de al lado que derivaba de
lo mismo, y llegar ahí por reporte del usuario cuesta una ronda entera.

**How to apply:** tras tocar datos o navegación, recorrer en el navegador hasta
el carrito y las páginas que derivan de esa estructura. Y al arreglar un
control, pulsarlo, no solo leer el diff.
