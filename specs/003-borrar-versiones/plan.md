# 003 · Borrar versiones: plan

Rama `feat/delete-versions`. Spec en [`spec.md`](spec.md).

## Diseño

- **`CatalogStore.remove(id)`**, en la misma cola que `save()` para no cruzarse con un guardado. Lee `current.json`: si `id` es la vigente, error 409. Crea `papelera/` si no existe y mueve `versions/<id>.json` allí con `rename`, sin reescribirlo. Si el archivo no está, error 404 con «Esta versión ya no existe; puede que se haya borrado desde otro ordenador.».
- **API**: `DELETE /api/version/<id>`, con la misma validación del identificador que `version()`.
- **Panel «Versiones»**: botón «Borrar» en cada versión salvo la vigente. La confirmación muestra el nombre y la fecha, y dice que va a `papelera/`. Tras borrar, aviso breve y se vuelve a leer el panel. Con un error, mensaje y se vuelve a leer el panel.
- Sin cambios de formato: `history()` ya solo lee `versions/`.

## Pasos

1. `remove()` y la ruta, con tests: mueve el archivo intacto, rechaza la vigente, 404 si no existe, no toca `current.json`, las demás versiones ni `exports/`.
2. Botón y confirmación en el panel.
3. `CHANGELOG.md` en `[Unreleased]`.

## Comprobación

- `npm test` en verde.
- En un navegador real, con una carpeta de prueba: guardar dos versiones, borrar una, ver que desaparece y está en `papelera/`. La vigente no tiene botón. Borrar desde un segundo servidor en la misma carpeta y luego desde el primero: mensaje y el panel se actualiza. Consola sin errores.
- Luis lo prueba en la app.
