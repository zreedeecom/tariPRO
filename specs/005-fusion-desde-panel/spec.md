# 005 · Fusionar dos versiones desde el panel

Estado: **idea** (Luis, 2026-11-12). Sale de la 004; se escribe después de ella.

## Qué

En «Versiones», elegir dos versiones, ver sus diferencias, decidir qué prevalece y guardar el resultado como versión nueva. Las dos de origen quedan intactas. La nueva muestra «Fusión de A y B», y A y B muestran «Fusionada en C», para saber cuáles se pueden borrar (spec 003).

## Notas

- Usa el motor de fusión de la 004. Para comparar a tres bandas hace falta la versión común. Por eso cada versión anotaría de cuál parte (`basedOn`) y, si es fusión, de cuáles sale (`mergedFrom`). Con versiones sin esa anotación, cada diferencia se presenta como elección.
- Es un cambio de formato: `schemaVersion` 3 con su paso en `migrate()`. Coste: en cuanto una app nueva guarde en la carpeta, una app que siga en 0.2.0 no podrá abrir los datos hasta actualizarse (el bloqueo por datos más nuevos). Hay que actualizar todos los ordenadores a la vez.
