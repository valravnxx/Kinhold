# Animaciones extra del taller propio (v1)

- **Animaciones:** las 39 extra de la Universal Animation Library 2 de Quaternius (CC0), las mismas de
  `recursos/personajes/v1/animaciones_extra.glb` (trabajos, arco, espada ligera y pesada, escudo, vendarse, pasos en
  todas direcciones, trepar, tumbarse…), pasadas al esqueleto «game_engine» de MakeHuman (CC0) con
  `herramientas/taller/pasar_animaciones.mjs`, con las mismas correcciones de postura que las básicas del taller
  (tronco enderezado y brazos colgando rectos, medidos en el Idle_Loop del paquete).
- Hechas sobre los personajes de `taller-v12` (el esqueleto no ha cambiado desde la v2): una por sexo, porque el
  esqueleto de la mujer tiene otras medidas.
- Solo llevan el esqueleto y las animaciones (sin mallas): el juego las carga aparte cuando las necesita
  (`crearPersonajeMH({ extra: true })`, `src/personajes/makehuman.js`).
- Compresión: `EXTRA=1 node herramientas/taller/preparar_mh.mjs` (sin fotogramas sobrantes y meshopt).

Cómo se hicieron (desde la raíz del proyecto):

```
V=docs/recursos/personajes
SOLO_ANIM=1 node herramientas/taller/pasar_animaciones.mjs $V/v1/animaciones.glb+$V/v1/animaciones_extra.glb $V/taller-v12/mh_hombre.glb /tmp/x/hombre_extra.glb <los 39 clips>
(lo mismo con mh_mujer.glb → mujer_extra.glb)
EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/x docs/recursos/personajes/taller-anim-v1
```

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-anim-v2…).
