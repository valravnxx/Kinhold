# Personajes del taller propio (v5)

- **Cuerpo:** malla base de MakeHuman a través de MPFB2 (github.com/makehumancommunity/mpfb2). Los recursos de MakeHuman
  (malla base, objetivos de forma y esqueleto «game_engine») son CC0.
- **Ropa, pelo, barba, cofia, piel y ojos:** hechos por código en este proyecto (herramientas/taller/vestir_mpfb.py),
  a partir de las mallas de ayuda de la propia base. No llevan recursos de terceros.
- **Animaciones:** Universal Animation Library de Quaternius (CC0), pasadas a este esqueleto con
  herramientas/taller/pasar_animaciones.mjs.
  La carrera (Jog_Fwd_Loop) va suavizada por código en ese mismo paso (menos zancada, braceo, bote e inclinación).
- Compresión: herramientas/taller/preparar_mh.mjs (WebP y meshopt).

Los recursos publicados no se cambian: una versión nueva va en otra carpeta (taller-v2…).

Cambios: v2, postura; v3, ropa por capas (camisa, túnica o vestido, gambesón); v4, cota de malla (anillas pintadas
por código) y sobreveste sin mangas, y cada prenda partida en cuerpo, mangas y falda; v5, carrera más
suave y natural (valravnx la vio «fea y exagerada»). La ropa y el resto de animaciones son las de la v4.
