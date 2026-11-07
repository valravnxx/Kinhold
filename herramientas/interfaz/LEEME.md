# Interfaz: el kit renderizado y las maquetas del estudio (7 nov)

Con esto se hicieron las piezas y las maquetas de la octava versión del estudio de la interfaz
(`diseno/estudios/interfaz.html`). Aún no van en el juego: son para el estudio.

- `kit.py` — cuero, roble, latón y hierro en Blender (Cycles, sin pantalla, con el `bpy` del taller): botón, botón de
  acción, medallón, hueco, marco de 9 trozos, tablero, cuero, correa y los iconos de latón repujado. Uso:
  `python3 kit.py <carpeta> [pieza ...]`. Los iconos piden antes sus máscaras en `/tmp/ui_kit/mask/` (la silueta
  rasterizada y su altura con el bisel, sacadas con Playwright y scipy; ver el estudio).
- `retrato.py` — tu personaje del taller renderizado de cuerpo entero (el GLB sin meshopt: `desmeshopt.mjs`).
- `maqueta_v8.html` — las maquetas (se abren con `?e=<estado>&d=pc|movil`; piden las imágenes del kit en `kit/`, los
  iconos de las cosas y las capturas de fondo).
