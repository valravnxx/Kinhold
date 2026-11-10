# Personajes de Meshy (meshy-v2)

- Los mismos `hombre.glb` y `mujer.glb` de `meshy-v1` (el hombre y la mujer que hizo valravnx en Meshy, generador de
  modelos 3D con IA, plan Premium de valravnx), con el mismo esqueleto de la API de rigging de Meshy (24 huesos, sin dedos).
- Dos animaciones más de la biblioteca de Meshy, pedidas el 10 nov de 2026 sobre los mismos rigs (`herramientas/meshy/encargo.py`,
  acción «animar» con `rigs`): «Casual Walk» (el andar del hombre, acortado 1,5× para que vaya a paso normal; el de antes cruzaba los pies como en una pasarela) e
  «Idle 3» (el reposo de los dos, quieto y tranquilo; el de antes miraba a un lado y a otro). Valravnx, 10 nov.
- 69 animaciones en total (61 de la biblioteca y 8 hechas con Text to Motion), unidas por sexo con
  `herramientas/meshy/unir_personaje.mjs` (`EXTRA`, `SOLO_EXTRA` y `ACELERAR`) y las marcas de agarre con `poner_dedos.mjs` (`SOLO_MARCAS=1`).
- Licencia: la de las condiciones de Meshy para la cuenta de valravnx (no comprobado aquí el texto exacto).
