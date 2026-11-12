# 002 · Escritorio

Estado: **aprobada** (Luis, 2026-11-12).

## Qué

tariPRO como app de escritorio para Mac y Windows (Electron), con los datos en una carpeta que elige el usuario (la de Luis, en Dropbox), aviso de versiones nuevas con descarga en un clic y las novedades de cada versión dentro de la app.

## Por qué

Hoy hay que tener Node instalado y abrir el repo, y los datos viajan con git (que además no tiene remoto). Luis quiere abrir la app en cualquiera de sus dos ordenadores y encontrar la última tarifa sin hacer push ni pull, y poder pasársela a otros rotulistas.

## Alcance

1. **App de escritorio.** Ventana propia con la interfaz actual. El servidor corre dentro de la app, en `127.0.0.1` y en el puerto fijo 4173: el borrador va ligado al puerto. Si está ocupado (por ejemplo, con `npm start` abierto), mensaje claro y la app se cierra.
2. **Carpeta de datos obligatoria.** Al arrancar, la app comprueba que hay una carpeta configurada, que existe y que se puede escribir en ella. Si no, la pide antes de abrir nada; si el usuario cancela, la app se cierra. Se recuerda por ordenador, porque la ruta cambia entre Mac y Windows. Dentro: `current.json`, `versions/` y `exports/` (los PDF). Si la carpeta está vacía, pregunta antes de crear un catálogo nuevo: una carpeta de Dropbox que aún no ha sincronizado también parece vacía, y crear ahí un catálogo chocaría con el real. Se puede cambiar desde el menú.
3. **Datos más nuevos que la app.** Si el catálogo tiene un `schemaVersion` mayor que el de la app, esta no deja editar ni guardar: avisa de que los datos son de una versión más nueva y ofrece descargarla. Si es menor, se migra al leer, como ahora. Cada versión guardada anota con qué versión de la app se guardó (`savedWith`).
4. **Versión nueva disponible.** Al arrancar, la app consulta la última release publicada en GitHub. Si es más nueva, avisa con sus novedades y un botón «Descargar» que baja el instalador de ese sistema. No se instala sola. Sin conexión, no dice nada.
5. **Novedades.** En el menú, «Novedades» muestra el `CHANGELOG.md` de la versión instalada. La primera vez que se abre una versión nueva, se muestra su apartado. «Acerca de tariPRO»: versión, carpeta de datos y créditos.
6. **Copias en conflicto.** Si en la carpeta de datos hay copias en conflicto creadas por Dropbox o pCloud, la app avisa al arrancar y dice qué archivos son. No las resuelve sola: las versiones guardadas son inmutables, así que no se pierde nada.
7. **Instaladores y releases.** Mac en `.dmg` (Apple Silicon e Intel: el portátil de Luis es Apple Silicon y el Ryzentosh es Intel) y Windows en instalador `.exe` (x64). Se compilan en GitHub Actions al subir una etiqueta `vX.Y.Z` y quedan como borrador de release, que Luis publica. Las notas salen de esa versión en el `CHANGELOG.md`.
8. **Corte.** Los datos reales del repo antiguo pasan a `~/Dropbox/Apps/tariPRO`, se prueba en los dos ordenadores y Luis borra el repo antiguo.

## Fuera de alcance

- Actualización automática (sin firma de Apple no funciona en Mac; Luis prefiere el aviso con descarga).
- Firma y notarización: la primera vez, macOS y Windows avisan de que la app no está firmada (instrucciones en el README).
- Edición simultánea en varios ordenadores.
- Marca personalizable y textos de ayuda del primer arranque.

## Criterios de aceptación

- Primer arranque sin configuración: pide la carpeta y no deja continuar sin ella.
- Con una carpeta vacía, pregunta «Esta carpeta está vacía. ¿Crear un catálogo nuevo aquí?». Si se responde que no, no escribe nada y vuelve a pedir la carpeta.
- Si la carpeta configurada desaparece o es de solo lectura, la vuelve a pedir y explica por qué.
- Un catálogo guardado en un ordenador aparece en el otro al abrir la app, una vez Dropbox ha sincronizado.
- Con datos de un `schemaVersion` mayor: aviso, botón de descarga, y no se puede guardar.
- Con una release más nueva en GitHub: aviso con novedades y descarga del instalador correcto en Mac y en Windows. Sin red: arranca sin avisos ni errores.
- Una copia en conflicto en la carpeta produce un aviso con su nombre.
- «Novedades» y «Acerca de» funcionan en los dos sistemas.
- `npm test` en verde; los instaladores de 0.2.0 se instalan y abren en el Mac de Luis (Apple Silicon), en el Ryzentosh (Intel) y en Windows.
- Los borradores, versiones y PDF funcionan igual que en 0.1.0.

## Decisiones

- Icono de la app: provisional a partir del favicon (cuadrado naranja) hasta tener uno definitivo (Luis, 2026-11-12).

## Plan

Ver [`plan.md`](plan.md).
