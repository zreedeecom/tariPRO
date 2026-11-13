# MEMORY.md - tariPRO

Estado actual del proyecto. Solo lo vigente; máximo ~50 líneas.

## Estado

- Repo nuevo (2026-11-12), sucesor de `~/Code/tarifa-pro-impress` (empezado con Codex). Se trajo solo el código; el historial, los originales y los análisis están en el archivo privado.
- Los datos reales viven en `~/Dropbox/Apps/tariPRO` (copiados del repo antiguo el 2026-11-12) y se editan con la app instalada. En el repo no se editan tarifas reales.
- Spec 001 (tarifa base): hecha. Spec 002 (escritorio): 0.2.0 publicada; datos reales ya en `~/Dropbox/Apps/tariPRO` y probados en los dos Mac. Falta: Windows con la carpeta real, README (paso 8) y que Luis borre el repo antiguo.
- Spec 003 (borrar versiones a `papelera/`): hecha, en `main` y sin publicar. Spec 004 (cambios desde otro ordenador): implementada en `feat/live-changes`, sin merge; falta que Luis la pruebe en sus dos Mac. Spec 005 (fusión desde el panel): idea.
- 73 tests: 71 públicos y 2 de paridad con el Maestro (solo con `TARIPRO_FIXTURES`).

## Decisiones vigentes

- Electron y no Node SEA: la app ya es Node + navegador y Electron la envuelve casi sin cambios (Luis, 2026-11-12).
- Datos fuera del repo, en una carpeta sincronizada que elige el usuario; la de Luis, `~/Dropbox/Apps/tariPRO` (siempre disponible sin conexión). Si no está definida o no es accesible, la app la pide antes de continuar (Luis, 2026-11-12).
- Repo público en GitHub desde el principio: sin costes ni datos personales (Luis, 2026-11-12).
- Actualizaciones: aviso y descarga con un clic, sin autoinstalación ni firma de Apple (Luis, 2026-11-12).
- Primer arranque con el catálogo vacío; los textos de ayuda, más adelante (Luis, 2026-11-12).
- Marca personalizable (logo, contacto, bloques del PDF) para otros rotulistas: más adelante, con su spec (Luis, 2026-11-12).
- Fuente de los precios: el Maestro; la app reproduce sus 112 precios y 14 simulaciones. Esquema v2 = base + suplemento por acabado (Luis, 2026-11-11).
- Uso alterno en Mac y Windows, nunca simultáneo (Luis, 2026-11-11).
- Cambiar de carpeta de datos exige no tener borrador: el borrador no va ligado a la carpeta (Luis, 2026-11-12).
- Borrar versiones las mueve a `papelera/`, una a una; la vigente no se borra (Luis, 2026-11-12).
- Cambios desde otro ordenador: sin conflictos se cargan solos con aviso; solo se pregunta si chocan. Sin cambio de formato en la 004; `schemaVersion` 3 queda para la 005 (Luis, 2026-11-13).
- Firma de código (Apple 99 $/año, Certum ~50 €/año): solo cuando se distribuya (Luis, 2026-11-12).

## Archivo privado (fuera del repo)

- `~/Dropbox/Apps/tariPRO/archivo/`: `original/` (7 Excel y el PDF de referencia; intocables), `repo-codex/` (docs, análisis, decisiones y scripts antiguos) y `tarifa-pro-impress.bundle` (historial git completo).
- `~/Dropbox/Apps/tariPRO/fixtures/`: catálogo real (`initial.json` v2, `versions/initial.json` v1) y `workbooks.json` del Maestro, para `TARIPRO_FIXTURES`.
- `tests/fixtures/` se generó desde ahí cambiando costes, márgenes, proveedores y contacto; precios de venta, nombres y suplementos son los públicos.

## Trampas activas

- `pdftoppm` pierde la negrita de Helvetica: revisar el PDF con Vista previa o `qlmanage`.
- El borrador del navegador va ligado al puerto: en Electron, puerto fijo.
- Los catálogos v1 se migran al leer y no se reescriben en disco hasta guardar.
- Firma ad hoc en Mac: sin ella, la versión de Apple Silicon no arranca; macOS pedirá «Abrir igualmente» la primera vez.
- Probar Electron: `TARIPRO_USER_DATA` y carpetas de prueba, nunca `~/Dropbox/Apps/tariPRO`. `screencapture` no ve otras ventanas sin permiso de grabación; con `--remote-debugging-port` se inspecciona la ventana, pero un diálogo nativo abierto bloquea esa API.
- Costes de troquelado y ollados desconocidos: márgenes «Pendiente».
