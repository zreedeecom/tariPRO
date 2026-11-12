# AGENTS.md - tariPRO

Tarifa profesional de impresión digital: costes, márgenes y precios de venta de materiales y acabados, y la tarifa en PDF A4. La usa Luis (Impress) en Mac y Windows; la idea es compartirla con otros rotulistas.

## Al empezar

- `git fetch` y avisar a Luis si la rama actual va por detrás de su upstream. No hacer `pull` sin que lo pida.
- Leer `MEMORY.md` y `todo.md`.

## Cómo funciona

- Servidor Node local (`server.mjs`, solo `127.0.0.1`) y la interfaz en `public/`, sin build. Servidor y navegador comparten `app/model.mjs`.
- **Datos fuera del repo**: `current.json` y `versions/` (una instantánea inmutable por guardado) en `IMPRESS_DATA_DIR`; los PDF, en `IMPRESS_EXPORT_DIR`. Por defecto `data/` y `exports/`, ignorados por git.
- Primer arranque sin datos: `app/empty-catalog.json`.
- El borrador vive en el `localStorage` del navegador, ligado al origen (`127.0.0.1:4173`): si cambia el puerto, se pierden los borradores.
- App de escritorio (Electron, `electron/main.mjs`): pide la carpeta de datos (se recuerda por ordenador en `userData/settings.json`), arranca el mismo servidor en el puerto fijo 4173 y abre la ventana. En curso: `specs/002-escritorio/`.

## Stack y estructura

- Node 22+, sin dependencias en tiempo de ejecución ni build. Solo de desarrollo: `electron` y `electron-builder`, con versión exacta.
- `app/model.mjs` cálculo · `app/store.mjs` guardado atómico y versiones · `app/server.mjs` `startServer()` (lo usan `npm start` y Electron) · `app/http.mjs` API y estáticos · `app/pdf.mjs` PDF vectorial propio (Helvetica con métricas AFM, sin fuentes incrustadas).
- `tests/` con `node --test`; `tests/fixtures/` es un catálogo de ejemplo con costes inventados.
- `specs/NNN-nombre/`: spec + plan de cada funcionalidad.

## Comandos

- `npm start` (http://127.0.0.1:4173) · `npm run app` (Electron) · `npm test`
- `npm run dist`: instaladores en `dist/` para el sistema actual (`-- --mac`, `-- --win`). Configuración en `package.json` (`build`); icono provisional en `build/icon.svg` → `build/icon.png`.
- `TARIPRO_FIXTURES=<carpeta> npm test`: añade los 2 tests de paridad con el Maestro, que usan datos reales de fuera del repo.
- Variables: `PORT`, `IMPRESS_DATA_DIR`, `IMPRESS_EXPORT_DIR` (`npm start`); `TARIPRO_USER_DATA` (Electron: carpeta de ajustes y borradores alternativa, para pruebas sin tocar la configuración real) y `TARIPRO_FAKE_VERSION` (Electron: versión con la que se compara la última release, para probar el aviso).

## Convenciones

- **Inglés**: código, comentarios, nombres de ficheros y commits (conventional commits).
- **Español**: documentación e interfaz.
- Documentación concisa: estado actual, nada de historial.
- Código simple, sin sobreingeniería. Cambios pequeños y verificables.
- Versionado semántico. `CHANGELOG.md` (Keep a Changelog) se actualiza con cada cambio visible.

## Reglas de negocio

- Precio de fila = precio base del material + suplementos de sus acabados. Base por margen, recargo o precio fijo.
- Precio sugerido y precio de venta elegido son cosas distintas: la app sugiere, Luis decide.
- Los cambios se previsualizan antes de guardar; guardar crea una versión inmutable.
- Los costes conservan su precisión: nunca redondear entradas a dos decimales.
- Coste desconocido = `null`, nunca 0: el margen queda «Pendiente».
- Simulador: una pieza, una tirada. No inferir reglas de varios paños o pedidos sin confirmarlas.
- Cualquier cambio en el formato de los datos sube `schemaVersion` y añade su paso en `migrate()`.
- PDF: A4, identidad Impress (negro y naranja), solo datos públicos: nunca costes, márgenes ni proveedores.
- Ante una regla de negocio dudosa, preguntar antes de implementarla.

## Datos confidenciales

- Los costes de proveedor son confidenciales: cada proveedor vende a precios distintos según el cliente, y una filtración le perjudica.
- El repo es público: nunca costes o márgenes reales, proveedores ni datos de contacto personales. Ni en código, tests, docs, capturas o PDF.
- Datos reales y fixtures privadas: en la carpeta de datos de Luis, fuera del repo. Revisar el diff con esto en mente antes de cada commit.

## Forma de trabajar (SDD)

- Toda funcionalidad empieza con `specs/NNN-nombre/spec.md` (qué, por qué, alcance, criterios) y `plan.md` (diseño, pasos, comprobación), aprobados por Luis antes de escribir código.
- `todo.md` lleva el estado de cada spec. Al cerrarla: `CHANGELOG.md`, `MEMORY.md` y `todo.md`.
- Ramas cortas desde `main`: `feat/…`, `fix/…`, `chore/…`. Merge a `main` con OK de Luis.
- Al terminar: qué ha cambiado, cómo se ha comprobado y qué queda.

## Memoria

- La memoria vive solo en `MEMORY.md` de este repo. Máximo ~50 líneas: estado, decisiones vigentes con su porqué (Luis, fecha) y trampas activas.
- Lo que se convierta en regla permanente, a `AGENTS.md`. Nada sensible.

## Límites

- Pregunta antes: instalar dependencias, cambiar el formato de los datos, crear repos, publicar releases, merge a `main`.
- Nunca: datos confidenciales en el repo; tocar los datos reales de Luis sin que lo pida; rutas personales fijas en el código; comandos en servidores remotos sin autorización expresa.

## Verificación

- `npm test` en verde; con `TARIPRO_FIXTURES` si se toca el modelo.
- En un navegador real: carga, guardar versión, exportar PDF y consola sin errores.
- PDF: revisar el render con Vista previa o `qlmanage` (`pdftoppm` pierde la negrita).
