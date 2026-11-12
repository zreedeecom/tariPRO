# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado [semántico](https://semver.org/lang/es/).

## [Unreleased]

## [0.2.0] - 2026-11-12

tariPRO pasa a ser una app de escritorio para Mac y Windows.

### Añadido
- Instaladores para Mac (Apple Silicon e Intel) y Windows. Ya no hace falta Node ni abrir el proyecto.
- Carpeta de datos a elegir, por ejemplo una de Dropbox, para usar la misma tarifa en varios ordenadores. Se pide la primera vez, se recuerda en cada ordenador y se cambia desde «Archivo → Cambiar carpeta de datos…» (antes hay que guardar o descartar el borrador).
- En una carpeta vacía, pregunta antes de crear un catálogo.
- Si la carpeta tiene versiones pero aún no el catálogo actual (Dropbox no ha terminado de sincronizar), espera hasta 30 s y luego ofrece «Reintentar» o «Salir», sin escribir nada.
- Si los datos son de una versión más nueva de tariPRO, no los abre ni los sobrescribe, y ofrece descargarla.
- Avisa de las copias en conflicto que dejen Dropbox o pCloud en la carpeta de datos.
- Aviso de versión nueva al arrancar, con sus novedades y descarga del instalador de ese ordenador. Sin conexión no dice nada.
- «Ayuda → Novedades» y «Acerca de tariPRO». La primera vez que se abre una versión nueva, enseña lo que ha cambiado.
- «Generar PDF» abre el PDF guardado en la carpeta `exports/` de los datos.
- Cada versión guardada anota con qué versión de la app se hizo.

### Cambiado
- El primer arranque empieza con un catálogo vacío.

### Corregido
- Una copia en conflicto dentro de `versions/` ya no rompe el historial.

### Eliminado
- `start.command` y `start.bat`: los sustituye la app de escritorio.

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
