# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [semántico](https://semver.org/lang/es/).

## [Unreleased]

### Cambiado
- Repositorio nuevo, tariPRO, sin datos dentro: el catálogo, sus versiones y los PDF viven en la carpeta que indiquen `IMPRESS_DATA_DIR` e `IMPRESS_EXPORT_DIR` (por defecto `data/` y `exports/`, fuera de git).
- El primer arranque crea un catálogo vacío (antes cargaba el catálogo de Impress).
- Los tests usan un catálogo de ejemplo con costes inventados. Los de paridad con el Maestro (112 precios y 14 simulaciones) solo se ejecutan con `TARIPRO_FIXTURES`.

### Eliminado
- `start.command` y `start.bat`: hasta que llegue la app de escritorio, se arranca con `npm start`.

## [0.1.0] - 2026-11-11

Primera versión, hecha en el repositorio anterior.

### Añadido
- Catálogo editable de materiales y acabados (laminados y procesos), sin tocar código: nuevos materiales, papeles, unidades y acabados desde la interfaz. Duplicar y archivar materiales.
- Precio de cada fila = precio base del material + suplementos de sus acabados. El precio base se fija por margen, por recargo o a mano. Cada material puede tener su propio suplemento para un acabado.
- Filas de la tarifa generadas solas (sin laminado o con uno, cada proceso sí o no) y ocultables una a una.
- Comparación del precio guardado con el propuesto antes de guardar. Si sube el coste de un acabado, el suplemento se mantiene y se sugiere el que conserva el margen.
- Costes desconocidos: el margen queda «Pendiente» en vez de calcularse con un cero.
- Descuentos por cantidad en tres tramos.
- Simulador de una pieza: bobina, consumo, merma, coste, ingreso y margen. Varios anchos de bobina por material.
- Versiones: cada guardado es una instantánea con nombre; historial, recuperar una versión como borrador y borrador recuperable si se cierra la ventana.
- Importar y exportar el catálogo en JSON.
- Tarifa en PDF A4 con la estética de Impress: familias agrupables, lemas por material, tramos de descuento, condiciones en página propia y contacto al pie. Cada exportación lleva fecha y hora y nunca sobrescribe otra.
- Los catálogos del formato anterior (v1) se convierten solos al abrirlos.
