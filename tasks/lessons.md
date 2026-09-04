# Lecciones — hornosanlorenzo

## Limpiar la caché de Vite tras instalar dependencias

Después de `pnpm add`, si las islas de React dejan de hidratarse y la consola
muestra `jsxDEV is not a function`, no es un fallo del código: es la caché de
dependencias optimizadas de Vite, que quedó desfasada.

**Why:** el síntoma parece un error de compilación de React y lleva a depurar el
componente equivocado. Pasó con `CartPage`, que estaba correcto.

**How to apply:** vaciar `node_modules/.vite` y `.astro/` y reiniciar el
servidor antes de tocar nada del componente.

## Leer el puerto real del servidor de desarrollo

`pkill` + arrancar de inmediato deja el puerto anterior ocupado, y Astro elige
otro sin avisar. Estuve varias iteraciones probando contra un servidor viejo con
el módulo antiguo en memoria, y las peticiones respondían: no había ningún
indicio de que fuera el servidor equivocado.

**Why:** un `curl` que devuelve 200 contra el servidor equivocado es peor que un
error, porque parece que la prueba ha pasado.

**How to apply:** después de arrancar, leer el puerto del log (`grep Local`) en
vez de darlo por hecho, sobre todo tras cambiar `astro.config.mjs`.
