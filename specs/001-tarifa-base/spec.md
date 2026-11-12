# 001 · Tarifa base

Estado: **hecha** (versión 0.1.0). Spec escrita a posteriori a partir de lo construido y de las decisiones de Luis (2026-11-11).

## Qué

Una app local para mantener la tarifa profesional de impresión digital: costes de materiales y acabados, márgenes, precios de venta y la tarifa en PDF A4. Sustituye a los Excel con los que se hacía la tarifa de Impress.

## Por qué

Los siete Excel originales repetían datos con fórmulas distintas y no estaban enlazados entre sí: cambiar un coste no actualizaba nada más. Se elige el Maestro como fuente (integra costes, bobinas, simulación y tarifa, y sus 112 precios coinciden con el PDF publicado). La app debe reproducirlo, permitir cambios sin tocar código y enseñar el efecto de cada cambio antes de guardarlo.

## Alcance

- **Catálogo abierto**: materiales (por m² o por unidad, con bobinas de varios anchos) y acabados (laminados y procesos), editables desde la interfaz.
- **Precio de fila = precio base del material + suplementos de sus acabados.** El precio base se fija por margen sobre venta, por recargo sobre coste o a mano. El suplemento es del acabado, con excepción opcional por material.
- **Filas generadas**: sin laminado o con uno (nunca dos), por cada combinación de procesos. Máximo cuatro procesos por material. Las filas se pueden ocultar; el simulador sigue pudiendo usarlas.
- **Coste de referencia** de la tarifa: material + tinta + preparación repartida entre la cantidad de referencia + acabados, sin merma.
- **Cambios de coste**: el borrador recalcula los precios por margen o recargo y compara con los guardados. Si sube el coste de un acabado, el suplemento no cambia solo: se sugiere el que conserva el margen guardado y Luis decide.
- **Costes desconocidos** (`null`): el precio se mantiene y el margen queda «Pendiente». Nunca se tratan como cero.
- **Descuentos** por cantidad en tres tramos, con el umbral incluido, aplicados al precio con suplementos. Sin agrupar pedidos.
- **Simulador** de una pieza y una tirada: bobina (el laminado necesita bobina del mismo ancho), consumo, merma de largo, preparación una vez por pedido, coste, ingreso y margen.
- **Versiones**: guardar crea una instantánea inmutable con nombre; historial, recuperar como borrador, importar y exportar JSON. El borrador sobrevive a cerrar la ventana.
- **PDF A4** con la identidad de Impress (negro y naranja): familias agrupables, lema por material, tramos, condiciones en página propia y contacto anclado al pie. Solo datos públicos. Cada exportación lleva fecha y hora y no sobrescribe ninguna anterior.
- **Formato de datos** versionado (`schemaVersion` 2). Los catálogos v1 (variantes hechas a mano por material) se convierten al leer, sin reescribir el archivo.

## Fuera de alcance

- Simulación de varios paños o pedidos agrupados (reglas sin confirmar, ver `todo.md`).
- Varios usuarios editando a la vez.
- Marca personalizable para otros talleres.

## Criterios de aceptación

- Con el catálogo real, la app reproduce los 112 precios (con tramos) y los 238 valores de las 14 simulaciones del Maestro. Con `TARIPRO_FIXTURES`: `tests/maestro.test.mjs`.
- Ningún cambio llega a la versión guardada sin «Guardar versión», y ningún guardado sobrescribe otro (dos guardados simultáneos: uno falla con 409).
- Una entrada inválida nunca sustituye al catálogo guardado.
- El PDF tiene páginas A4, no contiene costes, márgenes ni proveedores, y pagina sin cortar textos largos.
- La API solo responde en `127.0.0.1`/`localhost` y no sirve los archivos de datos.
- `npm test` en verde.

## Plan

Ver [`plan.md`](plan.md).
