# 001 · Tarifa base: plan

Spec en [`spec.md`](spec.md). Hecho; esto describe cómo quedó.

## Diseño

- **Sin dependencias ni build**: Node nativo, HTML/CSS/JS servidos tal cual, datos en JSON. Evita instalar paquetes y depender de Excel o de un navegador para generar el PDF.
- **`app/model.mjs`**: todo el cálculo (filas, precios, márgenes, simulación, validación y migración v1 → v2). Lo usan el servidor, el navegador y el PDF, así que no hay dos versiones del cálculo.
- **`app/store.mjs`**: `current.json` se escribe de forma atómica (temporal + renombrar). Cada guardado crea antes `versions/<revisión>.json`, que nunca se reescribe. `save()` exige la revisión esperada: si el catálogo cambió entretanto, responde 409. Los guardados van en cola.
- **`app/http.mjs`**: rutas estáticas explícitas (nada fuera de la lista), solo `Host`/`Origin` locales, CSP estricta y límite de 2 MB por petición.
  - `GET /api/state` · `PUT /api/state` (guardar) · `GET /api/history` · `GET /api/version/:id`
  - `POST /api/preview` (PDF del borrador) · `POST /api/export` (PDF de una versión guardada, a la carpeta de exportaciones) · `GET /exports/:archivo`
- **`app/pdf.mjs`**: generador propio de PDF vectorial, acotado a tablas A4. Helvetica sin incrustar, codificación WinAnsi y anchos de letra con las métricas AFM de Adobe para centrar bien. Un carácter fuera de WinAnsi da un error explícito.
- **`public/app.mjs`**: la interfaz. El borrador va al `localStorage` (clave por versión del formato), y se avisa antes de sustituir cambios sin guardar.

## Comprobación

- `npm test`: 39 tests públicos con el catálogo de ejemplo (`tests/fixtures/`, costes inventados).
- `TARIPRO_FIXTURES=<carpeta> npm test`: los 2 de paridad con el Maestro.
- La verificación original contra los Excel (484 valores, scripts de Python) está en el archivo privado: `archivo/repo-codex/`.
