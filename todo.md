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
- [ ] Paso 4 · Aviso de versión nueva, «Novedades» y «Acerca de»
- [ ] Paso 5 · Instaladores (Mac arm64 + x64, Windows x64) e icono
- [ ] Paso 6 · Releases desde GitHub Actions; primera versión 0.2.0
- [ ] Paso 7 · Corte: datos reales a `~/Dropbox/Apps/tariPRO`, prueba en los dos ordenadores
- [ ] Luis: borrar `~/Code/tarifa-pro-impress` tras el corte

## Pendiente de Luis

- [ ] Costes reales de troquelado y ollados (hoy «Pendiente»)
- [ ] Licencia del repo antes de compartir la app (MIT u otra)

## Ideas sin spec

- Marca personalizable: logo, colores, contacto y cómo se generan los bloques del PDF
- Textos de ayuda para el primer arranque
- Simulador de varios paños: ¿una tirada por paño o continua? ¿piezas en paralelo, girar? ¿descuento por m² del trabajo?
- Simulador: ¿elegir solo el ancho de bobina óptimo?
- Revisión final de diseño y `DESIGN.md` (skill impeccable)
