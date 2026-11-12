# MEMORY.md - tariPRO

Estado actual del proyecto. Solo lo vigente; máximo ~50 líneas.

## Estado

- Repo nuevo (2026-11-12), sucesor de `~/Code/tarifa-pro-impress` (empezado con Codex). Se trajo solo el código; el historial, los originales y los análisis están en el archivo privado.
- **El repo antiguo sigue siendo la copia de trabajo con los datos reales** hasta el corte de la spec 002. Aquí no se editan tarifas reales.
- Spec 001 (tarifa base): hecha. Spec 002 (escritorio): spec + plan aprobados (Luis, 2026-11-12), en curso en `feat/desktop`.
- 49 tests: 47 públicos y 2 de paridad con el Maestro (solo con `TARIPRO_FIXTURES`).

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

## Archivo privado (fuera del repo)

- `~/Dropbox/Apps/tariPRO/archivo/`: `original/` (7 Excel y el PDF de referencia; intocables), `repo-codex/` (docs, análisis, decisiones y scripts antiguos) y `tarifa-pro-impress.bundle` (historial git completo).
- `~/Dropbox/Apps/tariPRO/fixtures/`: catálogo real (`initial.json` v2, `versions/initial.json` v1) y `workbooks.json` del Maestro, para `TARIPRO_FIXTURES`.
- `tests/fixtures/` se generó desde ahí cambiando costes, márgenes, proveedores y contacto; precios de venta, nombres y suplementos son los públicos.

## Trampas activas

- `pdftoppm` pierde la negrita de Helvetica: revisar el PDF con Vista previa o `qlmanage`.
- El borrador del navegador va ligado al puerto: en Electron, puerto fijo.
- Los catálogos v1 se migran al leer y no se reescriben en disco hasta guardar.
- Probar Electron: `TARIPRO_USER_DATA` y carpetas de prueba, nunca `~/Dropbox/Apps/tariPRO`. `screencapture` no ve otras ventanas sin permiso de grabación; con `--remote-debugging-port` se inspecciona la ventana, pero un diálogo nativo abierto bloquea esa API.
- Costes de troquelado y ollados desconocidos: márgenes «Pendiente».
