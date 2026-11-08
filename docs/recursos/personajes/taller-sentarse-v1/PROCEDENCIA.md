# Sentado en el suelo (taller-sentarse-v1)

- **Animación:** Sitting_Idle_Loop de la Universal Animation Library de Quaternius (CC0), pasada al esqueleto del taller
  (MakeHuman «game_engine», CC0) con `herramientas/taller/pasar_animaciones.mjs` sobre los personajes de `taller-v12`, y
  llevada de la silla al suelo con `herramientas/taller/hacer_sentarse.mjs`: la pelvis baja hasta 12 cm del suelo y las
  rodillas quedan rectas (la rotación de la pantorrilla de Idle_Loop de `taller-v24`); el tronco, los brazos y el
  respirar son los de Quaternius. Comprimida con `EXTRA=1 node herramientas/taller/preparar_mh.mjs`.
- Para descansar sentado (P4, el cansancio). Los recursos publicados no se cambian: una versión nueva va en otra carpeta.
