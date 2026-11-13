# todo

## 001 · Tarifa base · hecha

- [x] Catálogo, precios base + suplemento, simulador, versiones y PDF A4 (`specs/001-tarifa-base/`)
- [x] Paridad con el Maestro: 112 precios y 14 simulaciones
- [x] Repo nuevo sin datos: catálogo vacío al empezar, tests con catálogo inventado, paridad con `TARIPRO_FIXTURES`

## 002 · Escritorio (Electron) · en curso (`feat/desktop`)

- [x] OK de Luis a `specs/002-escritorio/spec.md` y `plan.md`
- [x] Paso 1 · Servidor arrancable desde Electron (`startServer`)
- [x] Paso 2 · Bloqueo por datos más nuevos, `savedWith` y aviso de copias en conflicto
- [x] Paso 3 · Electron: carpeta de datos obligatoria, ventana y menú
  - [x] Luis: prueba manual de los diálogos (primer arranque, carpeta vacía, borrada, solo lectura, espera de 30 s, `schemaVersion` 3, puerto ocupado, cambios sin guardar, copias en conflicto)
- [x] Paso 4 · Aviso de versión nueva, «Novedades» y «Acerca de»
- [x] Paso 5 · Instaladores (Mac arm64 + x64, Windows x64) e icono
- [x] Paso 6 · Releases desde GitHub Actions; 0.2.0 publicada y probada en Intel, Apple Silicon y Windows, con aviso de versión nueva
- [ ] Paso 7 · Corte: datos reales a `~/Dropbox/Apps/tariPRO`; probado en los dos Mac, falta Windows
- [ ] Luis: borrar `~/Code/tarifa-pro-impress` tras el corte
- [ ] Paso 8 · README (instalar, avisos de app no firmada, publicar versión) y cierre de la spec

## 003 · Borrar versiones · hecha (`specs/003-borrar-versiones/`)

- [x] OK de Luis a la spec (papelera, una a una) y al plan
- [x] Paso 1 · `remove()` y `DELETE /api/version/<id>`, con tests
- [x] Paso 2 · Botón y confirmación en el panel
- [x] Luis: prueba en la app

## 004 · Cambios desde otro ordenador · en la 0.3.0, falta la prueba de Luis (`specs/004-fusionar-versiones/`)

- [x] Spec y plan aprobados: dividida en 004/005, y sin conflictos se carga sola con aviso (Luis, 2026-11-13)
- [x] Paso 1 · `app/merge.mjs` con tests
- [x] Paso 2 · `GET /api/revision`, código `STALE`, base desde `papelera/`
- [x] Paso 3 · Comprobación periódica e incorporación sin conflictos (solo sola si no hay `conflicts` ni `errors`)
- [x] Paso 4 · Diálogo de conflictos
- [x] Paso 5 · Guardar con `STALE` y borrador recuperado
- [x] Paso 6 · `CHANGELOG.md`; prueba con dos servidores (Chrome sin interfaz, 11 casos, consola limpia)
- [ ] Luis: prueba en sus dos Mac sobre una carpeta de prueba en Dropbox
- [x] Release 0.3.0 (con 003 y 004): etiqueta `v0.3.0`; Luis revisa y publica el borrador

## 005 · Fusionar dos versiones desde el panel · por hacer (`specs/005-fusion-desde-panel/`)

- [ ] Spec y plan, después de la 004

## Pendiente de Luis

- [ ] Costes reales de troquelado y ollados (hoy «Pendiente»)
- [ ] Licencia del repo antes de compartir la app (MIT u otra)
- [ ] Antes de distribuir: firma de código. Mac: Apple Developer Program (99 $/año), Developer ID y notarización en CI. Windows: certificado de firma (p. ej. Certum Open Source, ~50 €/año)

## Ideas sin spec

- Marca personalizable: logo, colores, contacto y cómo se generan los bloques del PDF
- Textos de ayuda para el primer arranque
- Simulador de varios paños: ¿una tirada por paño o continua? ¿piezas en paralelo, girar? ¿descuento por m² del trabajo?
- Simulador: ¿elegir solo el ancho de bobina óptimo?
- Revisión final de diseño y `DESIGN.md` (skill impeccable)
