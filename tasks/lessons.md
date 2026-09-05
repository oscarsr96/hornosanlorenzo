# Lecciones — hornosanlorenzo

## El servidor de desarrollo da falsos positivos

Dos formas de perseguir el bug equivocado: tras `pnpm add`, la caché de Vite
queda desfasada y las islas fallan con `jsxDEV is not a function`, que parece un
error de React (pasó con `CartPage`, que estaba bien); y tras reiniciar, Astro
elige otro puerto sin avisar, así que se prueba contra un servidor viejo que
responde 200 con el módulo antiguo en memoria.

**Why:** una prueba que pasa contra el entorno equivocado es peor que un error,
porque cierra la investigación en falso.

**How to apply:** ante un fallo raro de hidratación, vaciar `node_modules/.vite`
y `.astro/` antes de tocar el componente. Y leer siempre el puerto del log
(`grep Local`) en vez de darlo por hecho.

## Verificar el camino completo, no la pieza que tocaste

Cargué 54 productos con varios tamaños y comprobé que la ficha los mostraba: la
rejilla del catálogo seguía metiendo en el carrito la talla más barata sin
preguntar. Añadí «Top Ventas» y «Packs» al submenú y comprobé el menú:
`/catalogo` seguía pintando la taxonomía vieja, con un chip que no filtraba
nada. Las dos veces lo vio Oscar abriendo la web.

**Why:** lo que edité funcionaba. Fallaba la pantalla de al lado que derivaba de
lo mismo, y llegar ahí por reporte del usuario cuesta una ronda entera.

**How to apply:** tras cargar datos o cambiar navegación, recorrer en el
navegador hasta el carrito y abrir las páginas que derivan su UI de esa
estructura —landings, filtros, portada—, no solo la editada.
