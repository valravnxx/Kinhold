# Personajes del taller propio (v3)

- **Cuerpo:** malla base de MakeHuman a través de MPFB2 (github.com/makehumancommunity/mpfb2). Los recursos de MakeHuman
  (malla base, objetivos de forma y esqueleto «game_engine») son CC0.
- **Ropa, pelo, barba, cofia, piel y ojos:** hechos por código en este proyecto (herramientas/taller/vestir_mpfb.py),
  a partir de las mallas de ayuda de la propia base. No llevan recursos de terceros.
- **Animaciones:** Universal Animation Library de Quaternius (CC0), pasadas a este esqueleto con
  herramientas/taller/pasar_animaciones.mjs.
- Compresión: herramientas/taller/preparar_mh.mjs (WebP y meshopt).

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-v2…).

Cambios: v2, postura (tronco, hombros y brazos) y túnica del hombre sin marcar pecho; v3, ropa por capas
(camisa de lino de base, túnica o vestido, gambesón acolchado, un cinturón por capa).
