# Personajes del taller propio (v8)

- **Cuerpo:** malla base de MakeHuman a través de MPFB2 (github.com/makehumancommunity/mpfb2). Los recursos de MakeHuman
  (malla base, objetivos de forma y esqueleto «game_engine») son CC0.
- **Ropa, calzado, tocados, pelo, barba, cofia, piel y ojos:** hechos por código en este proyecto (herramientas/taller/vestir_mpfb.py),
  a partir de las mallas de ayuda de la propia base. No llevan recursos de terceros.
- **Animaciones:** Universal Animation Library de Quaternius (CC0), pasadas a este esqueleto con
  herramientas/taller/pasar_animaciones.mjs.
  La carrera (Jog_Fwd_Loop) va suavizada por código en ese mismo paso (menos zancada, braceo, bote e inclinación).
- Compresión: herramientas/taller/preparar_mh.mjs (WebP y meshopt).

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-v2…).

Cambios: v2, postura; v3, ropa por capas (camisa, túnica o vestido, gambesón); v4, cota de malla (anillas pintadas
por código) y sobreveste sin mangas, y cada prenda partida en cuerpo, mangas y falda; v5, carrera más
suave y natural (valravnx la vio «fea y exagerada»). La ropa y el resto de animaciones son las de la v4.
v6, los brazos al correr (valravnx: «torcidos hacia delante, en pose nada natural»): el brazo oscila alrededor de la vertical, el antebrazo
un poco hacia arriba y hacia dentro, la mano de canto y la muñeca recta. Lo demás, igual que la v5.
v7, el cinturón de encima de la cota ya no se estira hacia los brazos (el contorno se medía también contra las
mangas, y las de la cota bajan hasta la mano). Lo demás, igual que la v6.
v8, capa abierta por delante, botas y tocados (capucha con esclavina, sombrero de paja y, en la mujer, toca), todo
hecho por código como la ropa; el sombrero es una malla propia pegada al hueso de la cabeza. Lo demás, igual que la v7.
