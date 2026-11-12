# tariPRO

## Qué es

tariPRO calcula y mantiene la tarifa profesional de un taller de impresión digital. Apuntas lo que te cuesta cada material y cada acabado, decides con qué margen vendes, y la app te da los precios de venta y la tarifa en PDF A4 lista para mandar a tus clientes.

Antes de guardar nada ves cómo cambian tus precios. Cada versión guardada queda en el historial.

## Para quién es

Para rotulistas y talleres de impresión que venden a otros profesionales (agencias, otros rotulistas, imprentas) y quieren dejar de mantener la tarifa en un Excel. Nació para la tarifa de [Impress](https://impr.es) y funciona en Mac y Windows.

## Cómo se usa

1. **Tarifa y materiales**: da de alta cada material con su coste por m² (o por unidad) y su precio base, por margen, por recargo o a mano.
2. **Acabados**: crea laminados y procesos (troquelado, ollados…) con su suplemento de venta y elige a qué materiales se aplican. Las filas de la tarifa salen solas y puedes ocultar las que no quieras.
3. **Costes y descuentos**: tinta, preparación, merma, redondeo y los tres tramos de descuento por cantidad.
4. **Simulador**: calcula el coste, el precio y el margen real de una pieza concreta.
5. **Documento A4**: título, familias, condiciones y contacto de la tarifa en PDF.
6. **Guardar versión** cuando los precios te convenzan, y **exportar el PDF**. En **Versiones** tienes todas las anteriores.

Lo que cambias es un borrador hasta que lo guardas: puedes probar sin miedo.

## Créditos

Hecho por Luis Giménez ([Impress Marketing](https://impr.es)) para el mundo con 🧡

---

## Desarrollo

Requisito: [Node.js](https://nodejs.org/) 22 o posterior. De momento no hay dependencias que instalar.

```sh
npm start          # http://127.0.0.1:4173
npm test           # tests públicos
```

Variables opcionales:

| Variable | Para qué | Por defecto |
|---|---|---|
| `PORT` | Puerto del servidor local. Ojo: el borrador del navegador va ligado al puerto | `4173` |
| `IMPRESS_DATA_DIR` | Carpeta del catálogo (`current.json`) y sus versiones (`versions/`) | `data/` |
| `IMPRESS_EXPORT_DIR` | Carpeta de los PDF exportados | `exports/` |
| `TARIPRO_FIXTURES` | Carpeta con los datos privados de los tests de paridad con el Maestro | sin definir: esos tests se saltan |

`data/` y `exports/` están fuera de git. Para probar con tus datos reales sin tocarlos, copia la carpeta y apunta `IMPRESS_DATA_DIR` a la copia.

### Estructura

```
app/        model.mjs (cálculo, compartido con el navegador) · store.mjs (guardado y versiones)
            http.mjs (API local) · pdf.mjs (generador del PDF) · empty-catalog.json (primer arranque)
public/     interfaz (HTML, CSS y JS sin build)
tests/      node --test · fixtures/ con un catálogo de ejemplo de costes inventados
specs/      una carpeta por funcionalidad, con su spec y su plan
server.mjs  arranque del servidor local
```

### Tests

- `npm test`: tests públicos (modelo, guardado, API, PDF e interfaz), con el catálogo de ejemplo.
- `TARIPRO_FIXTURES=<carpeta> npm test`: añade la paridad con el Maestro original (112 precios y 14 simulaciones). La carpeta tiene `initial.json`, `versions/initial.json` y `workbooks.json`. Son datos reales y **nunca** entran en el repo.
- Los tests no sustituyen mirar la interfaz en un navegador ni revisar el PDF a ojo (con Vista previa; `pdftoppm` pierde la negrita).

### Datos y confidencialidad

El repositorio es público. Los costes de proveedor son confidenciales, igual que los márgenes reales y los datos de contacto. Nada de eso va en el código, los tests, la documentación ni las capturas. Revisa el diff antes de cada commit.

## Distribuir

Todavía no hay app de escritorio. Llega con la spec [`002-escritorio`](specs/002-escritorio/spec.md): instaladores para Mac y Windows publicados como releases de GitHub, carpeta de datos elegible y aviso de versiones nuevas. Esta sección se completará con ella: cómo compilar, cómo publicar una versión y cómo instalar.

## Versiones y novedades

- Versionado semántico: `MAYOR.MENOR.PARCHE`.
- Cada cambio visible se apunta en [`CHANGELOG.md`](CHANGELOG.md), bajo `[Unreleased]`. Al publicar, esa sección pasa a ser la de la versión nueva.

## Cómo se organiza el proyecto (SDD)

- Cada funcionalidad tiene su carpeta en `specs/NNN-nombre/`: `spec.md` (qué, por qué, alcance, criterios) y `plan.md` (diseño, pasos, comprobación). Se aprueban antes de escribir código.
- [`todo.md`](todo.md): qué está hecho, qué está en marcha y qué queda.
- [`AGENTS.md`](AGENTS.md) y [`MEMORY.md`](MEMORY.md): instrucciones y estado para los agentes de IA (Claude Code, Codex). `CLAUDE.md` solo los carga.
- [`PRODUCT.md`](PRODUCT.md): contexto de producto para la skill de diseño.
