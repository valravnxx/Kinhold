# Procedencia de los personajes

Autor: **Quaternius** (https://quaternius.com). Licencia **CC0 1.0** (dominio público): se pueden usar, modificar y vender sin pagar ni citar. Textos de licencia en esta carpeta (`base-license.txt`, `outfits-license.txt`, `animations-license.txt`).

Paquetes: Universal Base Characters, Modular Character Outfits – Fantasy y Universal Animation Library (1 y 2), versión Standard.

Copia de origen: redistribución CC0 en https://github.com/OpenAgentsInc/openagents, carpeta `assets/verse/characters/quaternius`, commit `e2247fd8101517d768c5937d7df720d35e89c77e`.

Preparados con `herramientas/preparar_personajes.mjs`: texturas reducidas (color 1024 px, relieve y rugosidad 512 px), un `.glb` por pieza y `animaciones.glb` solo con los clips que usa el juego (sin escalas ni desplazamientos salvo la pelvis). Huellas SHA-256 en `manifiesto.json`.

## Animaciones extra (`animaciones_extra.glb`)

Universal Animation Library 2, versión **Source** completa (134 clips), de Quaternius, **CC0 1.0**. Copia de origen: https://github.com/Arod231/monomachia, `game/assets/quaternius/animations/UAL2_Source.glb` (su `game/assets/CREDITS.md` la identifica como el `UAL2.glb` del paquete Source con licencia CC0). Mismo esqueleto de 65 huesos. Se guardan 39 clips útiles para el juego (trabajos del campo, minar, pescar, arco, espada ligera y pesada, bloqueo, escudo, vendarse, pasos en todas direcciones, trepar, tumbarse); preparados con `herramientas/preparar_animaciones_extra.mjs`.
