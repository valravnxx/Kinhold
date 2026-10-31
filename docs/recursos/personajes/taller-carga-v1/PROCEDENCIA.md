# Animaciones de cargar hechas en el taller propio (v1)

- `Hombro_Walk_Loop` (en el juego, «al hombro»): andar con un tronco al hombro derecho, sujeto con la mano derecha por
  encima; el tronco algo inclinado a la izquierda y adelante. La mano izquierda va suelta.
- `Hombro_Idle_Loop` («al hombro, quieto»): lo mismo, quieto.
- `Drag_Walk_Loop` («arrastrar»): andar inclinado adelante, con las dos manos abajo junto a la cadera, un poco por detrás,
  agarrando las varas de la rastra.

Hechas por código (valravnx, 31 oct: «las tratamos de hacer nosotros») a partir de las del taller que ya había, de la
Universal Animation Library de Quaternius (**CC0 1.0**), pasadas al esqueleto «game_engine» de MakeHuman (**CC0**):
`Walk_Loop` e `Idle_Loop` para el cuerpo y las piernas, y la mano cerrada de `Walk_Carry_Loop`. Encima, el tronco se
inclina girando las vértebras y cada brazo que sujeta algo va por IK de dos huesos (brazo y antebrazo) a su punto.
Se pueden usar sin pagar ni citar, como el resto de los recursos del taller.

- Hechas sobre los personajes de `taller-v20` (el esqueleto no ha cambiado desde la v2): una por sexo.
- Solo llevan el esqueleto y las tres animaciones (sin mallas), unos 76 KB por sexo. El juego y el visor las cargan
  aparte (`crearPersonajeMH({ cargas: true })`; el visor, `?cargasMH=` para otra carpeta).

Cómo se hicieron (desde la raíz del proyecto):

```
V=docs/recursos/personajes
node herramientas/taller/hacer_cargas.mjs $V/taller-v20/mh_hombre.glb /tmp/x/hombre_extra.glb
node herramientas/taller/hacer_cargas.mjs $V/taller-v20/mh_mujer.glb /tmp/x/mujer_extra.glb
EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/x docs/recursos/personajes/taller-carga-v1
```

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-carga-v2…).
