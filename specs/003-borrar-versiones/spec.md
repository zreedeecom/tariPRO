# 003 · Borrar versiones

Estado: **aprobada** (Luis, 2026-11-12).

## Qué

Poder quitar versiones del panel «Versiones»: pruebas, guardados por error o versiones ya fusionadas en otra (spec 004).

## Por qué

Cada guardado crea una versión inmutable y hoy no hay forma de quitarla desde la app. Con el uso, y más aún con fusiones, el historial se llena de versiones que ya no aportan y cuesta encontrar las buenas.

## Alcance

1. Botón «Borrar» en cada versión del panel, salvo en la vigente: la vigente es `current.json` y siempre tiene su versión.
2. Confirmación con el nombre y la fecha de la versión. Se borran una a una.
3. Borrar mueve el archivo de `versions/` a `papelera/`, dentro de la carpeta de datos. La app nunca vacía la papelera: se rescata una versión devolviendo su archivo a `versions/`.
4. Los PDF exportados de esa versión se quedan en `exports/`.
5. Si otro ordenador tiene abierta la app, deja de ver la versión al volver a abrir el panel. Un borrador basado en una versión borrada sigue recuperándose igual: lleva su propio contenido.

## Fuera de alcance

- Borrar la versión vigente. Para «deshacer» un guardado, se recupera una versión anterior como borrador y se guarda.
- Editar versiones guardadas: siguen siendo inmutables.

## Criterios de aceptación

- La versión vigente no tiene botón «Borrar».
- Tras confirmar, la versión desaparece del panel y su archivo pasa intacto a `papelera/`. Si se cancela, no cambia nada.
- Borrar no toca `current.json`, las demás versiones ni los PDF.
- Si el archivo ya no existe (borrado desde el otro ordenador), mensaje claro y el panel se actualiza.
- `npm test` en verde, con tests del borrado en `CatalogStore` y la API.

## Decisiones

- Papelera dentro de la carpeta de datos en vez de borrado definitivo: se puede rescatar y no depende de Dropbox (Luis, 2026-11-12).
- Una a una (Luis, 2026-11-12).

## Plan

Ver [`plan.md`](plan.md).
