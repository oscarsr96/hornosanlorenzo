/**
 * Búsqueda de texto libre del panel, compartida por pedidos y clientes: el
 * obrador teclea lo que el cliente le dice por teléfono —un nombre a medias,
 * un correo, un móvil con espacios, los primeros caracteres de la
 * referencia— y los dos listados tienen que entenderlo igual.
 *
 * Es una función pura a propósito: el escape y la normalización se prueban
 * sin base de datos, y cada módulo solo tiene que pegar el resultado a su
 * consulta.
 */
export type PatronBusqueda = {
  /** Patrón para `ilike` (`%texto%`), o null si no hay nada que buscar. */
  patron: string | null;
  /**
   * El texto sin espacios cuando son solo dígitos, para casarlo contra el
   * teléfono guardado sin sus separadores: «600 12 34 56» tiene que
   * encontrar «600123456». Null si el texto no parece un teléfono.
   */
  soloDigitos: string | null;
};

export function patronBusqueda(texto: string | undefined): PatronBusqueda {
  const limpio = (texto ?? "").trim();
  if (!limpio) return { patron: null, soloDigitos: null };

  // `%` y `_` son comodines de LIKE, y la barra invertida su carácter de
  // escape: sueltos, un «50%» tecleado encontraría todo lo que empieza por
  // 50. Se escapan para que lo que teclee el obrador se busque tal cual.
  const escapado = limpio.replace(/[\\%_]/g, (c) => `\\${c}`);

  return {
    patron: `%${escapado}%`,
    soloDigitos: /^[\d\s]+$/.test(limpio) ? limpio.replace(/\s/g, "") : null,
  };
}
