# Animaciones de cargar hechas en el taller propio (v3)

Como la v2 (`taller-carga-v2/`), con un cambio en las dos de llevar el tronco al hombro (revisión del 1 nov: el tronco
tapaba la cabeza y la mano subía al cuello):

- `Hombro_Walk_Loop` y `Hombro_Idle_Loop`: el tronco va ahora encima del hombro derecho, sobre la articulación y algo
  por fuera, al lado de la cabeza (el juego lo ata a la clavícula). La mano derecha lo sujeta por delante del hombro,
  con la palma encima y los dedos por encima hacia dentro; el codo, delante y abajo. Dónde van el tronco y la mano lo
  dice `src/personajes/medidas_carga.js`, que leen la animación y el juego.
- `Drag_Walk_Loop`, `Empujar_Walk_Loop` y `Empujar_Idle_Loop`: como en la v2.

Hechas por código (valravnx, 31 oct: «las tratamos de hacer nosotros») a partir de las del taller que ya había, de la
Universal Animation Library de Quaternius (**CC0 1.0**), pasadas al esqueleto «game_engine» de MakeHuman (**CC0**):
`Walk_Loop` e `Idle_Loop` para el cuerpo y las piernas, y la mano cerrada de `Walk_Carry_Loop`. Encima, el tronco se
inclina girando las vértebras, cada brazo que sujeta algo va por IK de dos huesos (brazo y antebrazo) a su punto y la
mano se orienta y se cierra por código. Se pueden usar sin pagar ni citar, como el resto de los recursos del taller.

- Hechas sobre los personajes de `taller-v24` (el esqueleto no ha cambiado desde la v2): una por sexo.
- Solo llevan el esqueleto y las cinco animaciones (sin mallas), unos 106 KB por sexo.

Cómo se hicieron (desde la raíz del proyecto):

```
V=docs/recursos/personajes
node herramientas/taller/hacer_cargas.mjs $V/taller-v24/mh_hombre.glb /tmp/x/hombre_extra.glb
node herramientas/taller/hacer_cargas.mjs $V/taller-v24/mh_mujer.glb /tmp/x/mujer_extra.glb
EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/x docs/recursos/personajes/taller-carga-v3
```

Los recursos publicados no se cambian: una versión nueva va en otra carpeta.
