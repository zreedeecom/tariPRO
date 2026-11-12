# 004 · Cambios desde otro ordenador: plan

Rama `feat/live-changes`. Spec en [`spec.md`](spec.md).

## Diseño

- **No cambia el formato de los datos.** La base de la fusión ya está en memoria: `saved` es la versión de la que partió el borrador. Incorporar es un *rebase*:
  - `merged = mergeCatalogs(saved, draft, nueva)`;
  - luego `saved = nueva` y `draft = merged`.
  
  El borrador queda basado en la versión nueva, así que el aviso de cambios, los precios que cambian y el control de guardado siguen como están.
- **`app/merge.mjs`**: puro, compartido con el navegador (se añade a los estáticos de `app/http.mjs`, como `model.mjs`). `mergeCatalogs(base, mine, theirs)` devuelve `{ state, conflicts, summary }`.
  - **Materiales y acabados por `id`.**
    - Si solo un lado cambió un elemento, se toma ese elemento entero. Así, si tú no tocaste nada, el resultado es exactamente lo suyo.
    - Si cambiaron los dos, se compara campo a campo, con algunos campos en bloque:
      - `pricing` (modo y valor), `rolls`, `settings.tiers` y las listas de líneas del documento van como una sola unidad;
      - `supplements` va por acabado;
      - `materialIds` y `hiddenRows` se tratan como conjuntos: se suma lo añadido y se resta lo quitado en cada lado.
    - `price` no se compara: se recalcula con `materialize()`.
  - **Ajustes y documento:** campo a campo.
  - **Altas y bajas.**
    - Un material o acabado nuevo en un lado entra solo.
    - Un acabado quitado en un lado y sin tocar en el otro se quita.
    - Quitado en un lado y editado en el otro es un conflicto («mantener» o «quitar»).
    - Los materiales no se borran (se archivan), así que no se da ese caso.
  - **Orden:** el suyo, y detrás los materiales y acabados nuevos tuyos. La app no permite reordenar, así que no hay conflicto de orden.
  - **Conflictos.** Cada uno lleva elemento, campo, etiqueta en español y los valores base, tuyo y suyo. Mientras no se elige, gana lo tuyo.
  - **Limpieza.** Se quitan `supplements` y `materialIds` que apunten a acabados que ya no existen, y se pasa `validate()`.
- **API.**
  - `GET /api/revision` devuelve `{ revision, versionLabel, savedAt }` de `current.json`, para la comprobación periódica.
  - El 409 de guardar con la vigente cambiada lleva el código `STALE`, para distinguirlo del 409 de borrar la vigente.
  - `version()` busca también en `papelera/` cuando se pide la base de un borrador recuperado.
- **Navegador (`public/app.mjs`).**
  - Comprobación cada 5 s con la ventana visible y al volver a ella. Si falla, no se muestra nada.
  - Nunca se cambia el estado si hay un guardado en curso, un diálogo abierto o campos con error: se espera a la siguiente.
  - **Sin cambios propios:** se carga la nueva y sale el aviso breve. *(Si Luis lo confirma.)*
  - **Con cambios propios:** banner con «Incorporar a mi borrador» y «Más tarde». «Más tarde» recuerda esa revisión para no repetir el aviso; si llega otra, vuelve a avisar.
  - **Incorporar sin conflictos:** rebase y resumen («Entran 2 materiales nuevos y 3 cambios del otro ordenador»).
  - **Con conflictos:** diálogo agrupado por material o acabado. Cada campo enseña los dos valores, y en los materiales el precio base que resulta de cada opción. Hay «Quedarme con todo lo mío / todo lo suyo» y «Aplicar».
  - **Al guardar con `STALE`:** se lee la vigente y se sigue el mismo flujo; después se revisa y se guarda.
  - **Borrador recuperado** con otra versión de partida: «Recuperar e incorporar» hace la fusión a tres bandas con la versión de partida leída de `versions/` o `papelera/`. Si ya no existe, cada diferencia se presenta como elección.

## Pasos

1. `app/merge.mjs` con tests: materiales nuevos en los dos lados, mismo cambio en los dos, conflicto real, acabado quitado en un lado y editado en el otro, `pricing` en bloque, identidad (sin cambios tuyos queda exactamente lo suyo, y al revés) y resultado válido.
2. `GET /api/revision`, código `STALE` y base desde `papelera/`, con tests.
3. Comprobación periódica, banner e incorporar sin conflictos.
4. Diálogo de conflictos.
5. Guardar con `STALE` y borrador recuperado.
6. `CHANGELOG.md`.

## Comprobación

- `npm test` en verde.
- Dos servidores (`node server.mjs` en los puertos 4174 y 4175) sobre la misma carpeta de prueba: cada puerto tiene su propio borrador, como dos ordenadores. Casos:
  - guardar en uno con el otro limpio;
  - con borrador sin choques;
  - con un choque;
  - guardar con la vigente cambiada;
  - recuperar un borrador viejo.
  
  Consola sin errores.
- Luis lo prueba con la app en sus dos Mac sobre una carpeta de prueba en Dropbox.
