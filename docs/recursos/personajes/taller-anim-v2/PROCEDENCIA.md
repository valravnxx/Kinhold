# Animaciones extra del taller propio (v2): las de la v1 y las de cargar

- **Las 39 de la v1** (`taller-anim-v1`), iguales: Universal Animation Library 2 de Quaternius (CC0), pasadas al
  esqueleto «game_engine» de MakeHuman (CC0) con las mismas correcciones de postura.
- **Nuevas, para cargar** (Universal Animation Library de Quaternius, versión Standard, **CC0 1.0**: dominio público,
  uso comercial permitido sin pagar ni citar):
  - `Push_Loop` (en el juego, «empujar»): inclinado hacia delante, empujando con las dos manos mientras anda. Para
    empujar algo pesado (la carretilla y la rastra, cuando estén).
  - `PickUp_Table` («coger de una mesa»): coge algo pequeño con una mano a la altura de la cintura.
  - Llevar algo en brazos andando ya estaba en las básicas del taller (`Walk_Carry_Loop`, de la misma biblioteca).
- Copia de origen de la Universal Animation Library (Standard): `UAL1_Standard.glb` de https://github.com/Arod231/monomachia,
  commit `57cad9a` (`game/assets/quaternius/animations/UAL1_Standard.glb`; su `game/assets/CREDITS.md` la identifica
  como la versión Standard gratuita del paquete, CC0). SHA-256 del archivo:
  `69591853d817488edaa8fd9bf8fc1d821eaeaf789f8627b3cd23b41c4ed67997`. Mismo esqueleto y mismo reposo que las demás
  (lo comprueba `pasar_animaciones.mjs` al unir los orígenes).
- Llevar al hombro y arrastrar: no están en ninguna de las dos bibliotecas de Quaternius (se miraron los 45 clips de
  la Standard y los 134 de la Source de la 2). Queda pendiente de decidir de dónde salen.
- Hechas sobre los personajes de `taller-v20` (el esqueleto no ha cambiado desde la v2): una por sexo.
- Solo llevan el esqueleto y las animaciones (sin mallas). El visor de personaje las carga con
  `?animMH=../../recursos/personajes/taller-anim-v2/`; el juego sigue con la v1 hasta que las use.

Cómo se hicieron (desde la raíz del proyecto):

```
V=docs/recursos/personajes
CL=<los 39 clips de taller-anim-v1/manifiesto.json>,Push_Loop,PickUp_Table
SOLO_ANIM=1 node herramientas/taller/pasar_animaciones.mjs $V/v1/animaciones.glb+$V/v1/animaciones_extra.glb+UAL1_Standard.glb $V/taller-v20/mh_hombre.glb /tmp/x/hombre_extra.glb $CL
(lo mismo con mh_mujer.glb → mujer_extra.glb)
EXTRA=1 node herramientas/taller/preparar_mh.mjs /tmp/x docs/recursos/personajes/taller-anim-v2
```

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-anim-v3…).
