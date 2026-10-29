# Personajes del taller propio (v12)

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
hecho por código como la ropa; el sombrero es una malla propia pegada al hueso de la cabeza. Lo demás, igual que la v7. La capucha y la toca tapan el hueco de la oreja (la oreja va aparte y se esconde debajo), y sus bordes se miden
sin el empuje de la tela para que salgan limpios.
v9, personalización: formas de MakeHuman como formas del modelo (peso y músculo, cara ancha, nariz ancha y larga,
mentón: cada una con su «_mas» y su «_menos», hechas con los mismos ajustes y objetivos de MakeHuman, CC0); la piel y
el pelo pintados en gris con su color en el material; el iris aparte; cejas, pelo pintado y barba (corta o bigote) como
calcos sobre la piel. Lo demás, igual que la v8.
v10, más peinados y barbas: melena, coleta y trenzas (mallas propias hechas por código sobre el pelo corto, con su
textura de mechones y puntas desiguales; arriba siguen la cabeza y abajo el cuello y la espalda), barba larga (la piel
de la barba despegada y estirada bajo el mentón) y perilla pintada; la barba ya no se aclara bajo la barbilla. La mujer
lleva también el pelo corto y las orejas aparte, para cuando no lleva la cofia. Lo demás, igual que la v9.
v11, arreglo de las manos y de las botas de la mujer. Desde la v9 las manos salían rotas, como una tira: al reducir
triángulos protegiendo la cara, la reducción entera caía sobre las manos y el cuello. Ahora la proporción se calcula
solo con la parte que se puede reducir y las manos quedan como en la v8. Las botas de la mujer son bajas (hasta un poco
encima del tobillo) para que la caña no atraviese por detrás la falda larga. Lo demás, igual que la v10.
v12, pies descalzos: la piel de los pies (con dedos y uñas, la planta algo más oscura) como pieza aparte, para cuando
no lleva zapatos ni botas (el GDD empieza descalzo); sale de la misma malla de MakeHuman. El bajo de las calzas va
recto (antes seguía los cuadros de la malla, en dientes de sierra, y lo tapaban los zapatos). Lo demás, igual que la v11.
