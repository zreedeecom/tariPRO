# 004 · Cambios desde otro ordenador

Estado: **aprobada la idea** (Luis, 2026-11-12). Plan escrito, pendiente de dos decisiones y del OK de Luis.

## Qué

Si alguien guarda una versión desde otro ordenador (u otra ventana) con la app abierta, la app lo detecta y trae esos cambios sin perder lo que llevas hecho. Solo pregunta cuando los dos habéis cambiado lo mismo de forma distinta.

La fusión de dos versiones cualesquiera desde el panel pasa a la spec 005.

## Por qué

Con los datos en Dropbox, dos personas (o Luis en dos ordenadores) pueden editar a la vez. Hoy no se pierde nada, pero el segundo en guardar recibe «El catálogo cambió en otra pestaña» y tiene que comparar a mano. Si recupera su borrador y guarda, la versión del otro deja de ser la vigente, aunque sigue en el historial. Lo normal es que no haya choques reales: cada uno crea o toca materiales distintos.

## Alcance

1. **Detección.** La app comprueba cada pocos segundos, y al volver a la ventana, si la versión vigente ha cambiado.
2. **Sin cambios propios:** se carga la versión nueva y se avisa con un mensaje breve. *(Pendiente de confirmar.)*
3. **Con cambios propios:** aviso «Se ha guardado “X” desde otro ordenador» con «Incorporar a mi borrador» y «Más tarde».
4. **Incorporar.** Se compara lo tuyo y lo suyo con la versión de la que partías:
   - lo que cambió un solo lado entra solo;
   - si los dos cambiasteis lo mismo de forma distinta, o uno quitó un acabado que el otro editó, hay un conflicto.
   
   Sin conflictos, el borrador queda con todo y un resumen dice qué ha entrado. Con conflictos, se abre una ventana para elegir. Después, el borrador se revisa y se guarda como siempre.
5. **Al guardar con la vigente cambiada,** se ofrece lo mismo en vez del error actual.
6. **Al recuperar un borrador de una sesión anterior** cuya versión de partida ya no es la vigente: se ofrece incorporar en vez de sustituir.

## Fuera de alcance

- Fusión de dos versiones cualesquiera desde el panel, con «Fusión de A y B» (spec 005).
- Edición en tiempo real o bloqueo mientras otro edita.

## Criterios de aceptación

- Con la app abierta en dos sitios sobre la misma carpeta, lo guardado en uno aparece en el otro en segundos, sin reiniciar.
- Dos personas añaden materiales distintos a la vez: incorporar deja los dos, sin preguntar nada.
- Mismo campo cambiado distinto en cada lado: se pregunta, y el resultado lleva lo elegido.
- Incorporar nunca toca la versión vigente ni el historial: solo cambia el borrador.
- Un error de lectura durante la comprobación (Dropbox a medio sincronizar) no muestra avisos.
- `npm test` en verde, con tests del motor de fusión.

## Decisiones

- Dividida: 004 = detectar e incorporar al borrador, sin cambio de formato; 005 = fusión desde el panel. *(Propuesta, pendiente de Luis.)*

## Plan

Ver [`plan.md`](plan.md).
