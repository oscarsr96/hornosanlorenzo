# Lecciones — hornosanlorenzo

## Las cachés de desarrollo dan falsos positivos

Tras `pnpm add`, la caché de Vite falla con `jsxDEV is not a function`, que
parece un error de React y no lo es. Tras reiniciar, Astro cambia de puerto sin
avisar y se prueba contra un servidor viejo.

**Why:** una prueba que pasa —o falla— contra el entorno equivocado cierra la
investigación en falso.

**How to apply:** vaciar `node_modules/.vite` y `.astro/`, y leer el puerto del
log (`grep -i local`) en vez de darlo por hecho.

## Verificar el camino completo, no la pieza que tocaste

Cargué productos con varios tamaños y comprobé la ficha: la rejilla seguía
metiendo en el carrito la talla más barata. Añadí «Top Ventas» al submenú y
comprobé el menú: `/catalogo` seguía pintando la taxonomía vieja.

**Why:** lo editado funcionaba; fallaba la pantalla de al lado que derivaba de
lo mismo.

**How to apply:** tras tocar datos o navegación, recorrer en el navegador las
páginas que derivan de esa estructura. Y al arreglar un control, pulsarlo.

## La verificación que no verifica

Cuatro formas de creer que algo está comprobado cuando no lo está, todas de la
misma sesión. Pruebas que **se saltaban** con `pnpm test` porque el comando no
cargaba `.env`, con el informe diciendo «4/4 en verde» porque se corrieron con
la variable exportada a mano. Una prueba de código postal que seguía pasando
con la validación de zona rota, porque usaba un producto inexistente y solo
comprobaba que fallara, no por qué. Dos fallos de build que sobrevivieron
cuatro tareas con pruebas y tipos en verde —un `*.test.ts` dentro de
`src/pages/`, que Astro trata como ruta— porque `pnpm build` solo se corría al
final. Y una comprobación del checkout «sin sesión» hecha borrando cookies
desde el navegador, que no ve las `httpOnly`.

**Why:** todas aparecían en el recuento y ninguna protegía nada. Es peor que no
tenerlas: dan tranquilidad falsa y nadie vuelve a mirarlas.

**How to apply:** romper a propósito lo que la prueba protege y verla ponerse
roja. Contar las saltadas en terminal limpia (`env -i`), no en la tuya.
Afirmar sobre el motivo del fallo, no solo sobre su tipo. Y `pnpm build` en
cada tarea, que ni las pruebas ni los tipos ven si el sitio se despliega.
