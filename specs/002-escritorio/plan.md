# 002 · Escritorio: plan

Rama `feat/desktop`. Spec en [`spec.md`](spec.md).

## Diseño

- **Dependencias** (solo de desarrollo, versiones exactas fijadas al instalar): `electron` y `electron-builder`. Nada en tiempo de ejecución: la consulta de versiones usa `fetch` y no hace falta `electron-updater`, porque no hay autoinstalación.
- **`app/server.mjs`**: `startServer({ dataDirectory, exportsDirectory, port })` sale del actual `server.mjs`, que se queda como arranque de desarrollo (`npm start`, con las mismas variables). Electron llama a la misma función: un solo servidor.
- **`electron/main.mjs`** (proceso principal):
  - Configuración por ordenador en `userData/settings.json`: `{ dataDirectory }`.
  - Al arrancar comprueba la carpeta (existe y se puede escribir: escribe y borra un archivo de prueba). Si falla, diálogo nativo que explica el motivo y abre el selector de carpetas; si se cancela, cierra la app. Si no hay `current.json` ni versiones guardadas, pide confirmación antes de crear el catálogo vacío. Si hay versiones pero falta `current.json`, `store.initialize()` lanza `INCOMPLETE_DATA` sin escribir nada; el proceso principal muestra una ventana «Esperando a que termine la sincronización… (intento N de 3)», reintenta cada 10 s y, tras el tercero, diálogo con «Reintentar» y «Salir». Con `npm start`, mensaje y salida.
  - Arranca el servidor con `exports/` dentro de la carpeta de datos y abre la ventana en `http://127.0.0.1:4173`. Los enlaces externos se abren en el navegador.
  - Menú: «Cambiar carpeta de datos…» (relanza la app; antes pregunta a la página `window.hasUnsavedChanges()` y, si hay borrador, pide guardar o descartar), «Novedades», «Acerca de tariPRO» y los de edición estándar (copiar y pegar).
- **Datos más nuevos**: `store.initialize()` lee el `schemaVersion` sin migrar. Si es mayor que `SCHEMA_VERSION`, lanza un error con código propio. El proceso principal lo muestra en un diálogo con «Descargar la versión nueva» y no abre la interfaz. Con `npm start` también: el servidor no arranca y lo explica.
- **`savedWith`**: `save()` añade la versión de la app (de `package.json`). Es un campo informativo que `validate()` ignora, así que no sube `schemaVersion`.
- **Copias en conflicto**: al arrancar, se buscan en la carpeta de datos nombres con «conflict», «conflicto» o «[conflicted]» (Dropbox en inglés y en español, pCloud). Si hay alguno, diálogo con la lista.
- **Versión nueva**: `fetch` a `api.github.com/repos/zreedeecom/tariPRO/releases/latest` (repo público, sin token), con 5 s de límite. Si la etiqueta es mayor que `app.getVersion()`, diálogo con sus notas y «Descargar», que abre en el navegador el instalador de ese sistema: `.dmg` de la arquitectura del Mac o `.exe` en Windows. Cualquier error de red se ignora.
- **Novedades**: `CHANGELOG.md` va dentro de la app. Una ventana pequeña lo muestra convertido a HTML: un conversor mínimo para lo que usa el changelog (títulos, listas, negrita, código y enlaces), sin dependencia. `userData/settings.json` guarda la última versión vista para enseñar las novedades una vez tras actualizar.
- **Empaquetado** (`electron-builder`, configuración en `package.json`): `appId` `es.impr.taripro`, `productName` tariPRO. Mac: `dmg` arm64 y x64, con firma ad hoc (`identity: "-"`, sin «hardened runtime»: en Apple Silicon una app sin ninguna firma no arranca). Windows: `nsis` x64. Dentro van `app/`, `public/`, `electron/`, `CHANGELOG.md` y `package.json`. Icono en `build/icon.png` (1024 px). Nombre de los instaladores con la arquitectura (`tariPRO-X.Y.Z-arm64.dmg`, `-x64.dmg`, `-x64.exe`): el aviso de versión nueva elige el suyo por ese sufijo.
- **Releases**: `.github/workflows/release.yml`. Al subir una etiqueta `v*`: matriz `macos-latest` + `windows-latest`, `npm ci`, `npm test` y `electron-builder --publish always` con el `GITHUB_TOKEN` del propio workflow (nada de tokens personales). La release queda en borrador; Luis la publica.

## Pasos

1. `startServer()` y `npm start` igual que ahora; tests en verde.
2. Bloqueo por `schemaVersion` mayor, carpeta a medio sincronizar (`INCOMPLETE_DATA`), `savedWith` y detección de copias en conflicto, con tests.
3. Instalar `electron` y `electron-builder` (autorizado por Luis, 2026-11-12). Proceso principal: carpeta obligatoria, ventana y menú. Prueba en el Mac con `npm run app`.
4. Aviso de versión nueva, «Novedades» y «Acerca de».
5. Configuración de `electron-builder`, icono provisional y `.dmg` local. Probar en el Mac.
6. Workflow de releases. Etiqueta `v0.2.0`, borrador de release, instalar en el Mac, el Ryzentosh y Windows. Luis la publica.
7. Corte con Luis: copiar `data/` y `exports/` del repo antiguo a `~/Dropbox/Apps/tariPRO` y esperar a que Dropbox termine de sincronizar en el otro ordenador antes de abrir allí la app. Luego abrirla en los dos, guardar en uno y ver el cambio en el otro.
8. Documentación: README (distribuir, publicar una versión, instalar una app sin firmar), `CHANGELOG.md`, `MEMORY.md` y `todo.md`.

## Comprobación

- `npm test` en cada paso.
- A mano, en la app: primer arranque sin configuración, carpeta vacía (aceptar y rechazar), carpeta con `versions/` y sin `current.json` (esperar, reintentar y salir; que aparezca el archivo durante la espera), carpeta borrada, carpeta de solo lectura, catálogo con `schemaVersion` 3, copia en conflicto falsa en la carpeta, aviso de versión nueva (con `TARIPRO_FAKE_VERSION=0.0.1` para que la app se crea antigua) y sin red.
- Instalar desde la release en los tres ordenadores.
