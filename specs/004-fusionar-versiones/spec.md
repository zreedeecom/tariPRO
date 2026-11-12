# 004 · Cambios desde otro ordenador y fusión de versiones

Estado: **por valorar** (idea de Luis, 2026-11-12). Sin plan.

## Qué

1. **Aviso de versión nueva mientras se edita.** Si alguien guarda una versión desde otro ordenador (o otra ventana) con la app abierta, la app lo detecta y avisa. Ofrece incorporar esos cambios al borrador sin perder lo hecho.
2. **Fusionar dos versiones desde el panel.** Elegir dos versiones, ver sus diferencias, decidir qué prevalece en cada una y guardar el resultado como versión nueva. Las dos de origen quedan intactas, y la nueva anota de cuáles sale.

## Por qué

Con los datos en Dropbox, dos personas (o Luis en dos ordenadores) pueden editar a la vez. Hoy no se pierde nada, pero el segundo en guardar recibe «El catálogo cambió en otra pestaña» y tiene que comparar a mano. Si recupera su borrador y guarda, la versión del otro deja de ser la vigente, aunque sigue en el historial. Lo normal es que no haya choques reales: cada uno crea o toca materiales distintos.

## Cómo funcionaría

- **Fusión a tres bandas.** Para saber quién cambió qué, se compara cada lado con la versión de la que partieron los dos (la base). El borrador ya guarda su base; las versiones no. A partir de esta spec, cada versión anotaría de cuál parte (`basedOn`) y, si es una fusión, de cuáles sale (`mergedFrom`). Es un cambio de formato: `schemaVersion` 3 con su paso en `migrate()`.
- **Por elemento.** Materiales y acabados se comparan por su `id`, campo a campo. Ajustes y textos del PDF, campo a campo. Lo que cambió en un solo lado entra solo. Solo pregunta cuando los dos cambiaron lo mismo de forma distinta, o uno borró lo que el otro editó.
- **Detección.** Al volver a la ventana y cada pocos segundos, la app comprueba si `current.json` ha cambiado. Si es así, sale un aviso: «Se ha guardado “X” desde otro ordenador · Incorporar a mi borrador · Ver diferencias». Al guardar con la versión vigente cambiada, se ofrece lo mismo en vez del error actual.
- **Fusión desde el panel.** Mismo motor. La base es la versión común más cercana, siguiendo `basedOn`. Con versiones antiguas, sin `basedOn`, no hay base: cada diferencia se presenta como elección.
- **Marcado.** La versión fusionada muestra «Fusión de A y B». A y B muestran «Fusionada en C», para saber cuáles se pueden borrar (spec 003).

## Preguntas abiertas

1. **¿Dividirla en dos?** Propuesta: 004 = aviso e incorporar al borrador (lo de cada día); 005 = fusión de dos versiones cualesquiera desde el panel.
2. **¿Cómo se presenta un conflicto?** Propuesta: agrupado por material o acabado, con los dos valores y su precio resultante, y elegir uno por campo. Con «quedarme con todo lo mío / todo lo suyo» para acabar rápido.
3. **El orden de los materiales en la tarifa**, si los dos lo cambiaron: ¿se toma uno entero o se intenta combinar?

## Fuera de alcance

- Edición en tiempo real entre ordenadores.
- Bloquear la edición mientras otro edita.
