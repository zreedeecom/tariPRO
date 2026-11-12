# 003 · Borrar versiones

Estado: **borrador**, pendiente de las preguntas abiertas y del OK de Luis.

## Qué

Poder quitar versiones del panel «Versiones»: pruebas, guardados por error o versiones ya fusionadas en otra (spec 004).

## Por qué

Cada guardado crea una versión inmutable y hoy no hay forma de quitarla desde la app. Con el uso, y más aún con fusiones, el historial se llena de versiones que ya no aportan y cuesta encontrar las buenas.

## Alcance

1. Botón «Borrar» en cada versión del panel, salvo en la vigente: la vigente es `current.json` y siempre tiene su versión.
2. Confirmación con el nombre y la fecha de la versión.
3. Los PDF exportados de esa versión se quedan en `exports/`.
4. Si otro ordenador tiene abierta la app, deja de ver la versión al volver a abrir el panel. Un borrador basado en una versión borrada sigue recuperándose igual: lleva su propio contenido.

## Fuera de alcance

- Borrar la versión vigente. Para «deshacer» un guardado, se recupera una versión anterior como borrador y se guarda.
- Editar versiones guardadas: siguen siendo inmutables.

## Preguntas abiertas

1. **¿Borrado definitivo o papelera?** Propuesta: mover a `papelera/` dentro de la carpeta de datos, sin vaciarla nunca sola. Se puede rescatar a mano y no depende de que la carpeta esté en Dropbox. La alternativa es borrar de verdad: más limpio, pero sin vuelta atrás fuera de Dropbox.
2. **¿Una a una o varias a la vez?** Propuesta: una a una para empezar. Con la spec 004, «borrar las versiones fusionadas» desde la propia fusión.

## Criterios de aceptación

- La versión vigente no tiene botón «Borrar».
- Tras confirmar, la versión desaparece del panel y su archivo sale de `versions/`. Si se cancela, no cambia nada.
- Borrar no toca `current.json`, las demás versiones ni los PDF.
- Si el archivo ya no existe (borrado desde el otro ordenador), mensaje claro y el panel se actualiza.
- `npm test` en verde, con tests del borrado en `CatalogStore` y la API.
