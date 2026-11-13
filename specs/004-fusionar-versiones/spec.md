# 004 · Cambios desde otro ordenador

Estado: **implementada** en `feat/live-changes` (2026-11-13); falta la prueba de Luis en sus dos Mac.

## Qué

Si alguien guarda una versión desde otro ordenador (u otra ventana) con la app abierta, la app lo detecta y trae esos cambios sin perder lo que llevas hecho. Solo pregunta cuando los dos habéis cambiado lo mismo de forma distinta.

La fusión de dos versiones cualesquiera desde el panel pasa a la spec 005.

## Por qué

Con los datos en Dropbox, dos personas (o Luis en dos ordenadores) pueden editar a la vez. Hoy no se pierde nada, pero el segundo en guardar recibe «El catálogo cambió en otra pestaña» y tiene que comparar a mano. Si recupera su borrador y guarda, la versión del otro deja de ser la vigente, aunque sigue en el historial. Lo normal es que no haya choques reales: cada uno crea o toca materiales distintos.

## Alcance

1. **Detección.** La app comprueba cada pocos segundos, y al volver a la ventana, si la versión vigente ha cambiado.
2. **Sin conflictos, se incorpora sola:** si no tienes cambios, se carga la versión nueva; si los tienes y no chocan, entran los suyos y los tuyos siguen en el borrador. En los dos casos, un aviso dice qué ha entrado.
3. **Con conflictos:** aviso «Se ha guardado “X” desde otro ordenador y choca con tu borrador» con «Resolver» y «Más tarde».
4. **Cómo se fusiona.** Se compara lo tuyo y lo suyo con la versión de la que partías:
   - lo que cambió un solo lado entra solo;
   - si los dos cambiasteis lo mismo de forma distinta, o uno quitó un acabado que el otro editó, hay un conflicto.
   
   «Resolver» abre una ventana para elegir. Después, el borrador se revisa y se guarda como siempre.
5. **Al guardar con la vigente cambiada,** se ofrece lo mismo en vez del error actual.
6. **Al recuperar un borrador de una sesión anterior** cuya versión de partida ya no es la vigente: se ofrece incorporar en vez de sustituir.

## Fuera de alcance

- Fusión de dos versiones cualesquiera desde el panel, con «Fusión de A y B» (spec 005).
- Edición en tiempo real o bloqueo mientras otro edita.

## Criterios de aceptación

- Con la app abierta en dos sitios sobre la misma carpeta, lo guardado en uno aparece en el otro en segundos, sin reiniciar.
- Dos personas añaden materiales distintos a la vez: los dos quedan en el borrador, sin preguntar nada.
- Mismo campo cambiado distinto en cada lado: se pregunta, y el resultado lleva lo elegido.
- Incorporar nunca toca la versión vigente ni el historial: solo cambia el borrador.
- Un error de lectura durante la comprobación (Dropbox a medio sincronizar) no muestra avisos.
- `npm test` en verde, con tests del motor de fusión.

## Decisiones

- Dividida: 004 = detectar e incorporar al borrador, sin cambio de formato; 005 = fusión desde el panel, con `schemaVersion` 3 (Luis, 2026-11-13).
- Sin conflictos, los cambios del otro ordenador se cargan solos con un aviso, tengas o no cambios propios. Solo se pregunta si hay conflictos (Luis, 2026-11-13).
- Los suplementos por material son parte de su acabado: quitar un acabado en un lado y cambiar uno de sus suplementos en el otro es un conflicto «mantener / quitar». Si se mantiene, vuelve con sus suplementos (Luis, 2026-11-13).
- Una fusión sin conflictos que deja el catálogo no válido (p. ej. más de 4 acabados de proceso en un material) no se incorpora sola: se avisa con «Revisar» (2026-11-13).
- Borrador recuperado cuya versión de partida ya no existe: cada campo distinto es una elección; los materiales y acabados que solo están en un lado entran sin preguntar (2026-11-13).

## Plan

Ver [`plan.md`](plan.md).
