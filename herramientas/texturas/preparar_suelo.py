# Prepara las texturas CC0 del suelo (bajadas con herramientas/texturas/bajar.py) para el juego:
# docs/recursos/suelo/cc0-v1/<capa>.webp (color con la altura en el alfa) y <capa>_relieve.webp (normal, GL), 512 px,
# y medias.json (el color medio de cada una: el sombreador usa la textura como detalle sobre el color del sitio).
# Uso: python3 herramientas/texturas/preparar_suelo.py <carpeta con lo bajado> hierba=hierba tierra=tierra ...
import sys, os, json
from PIL import Image, ImageStat
orig = sys.argv[1]; capas = dict(a.split('=') for a in sys.argv[2:])
dest = 'docs/recursos/suelo/cc0-v1'; os.makedirs(dest, exist_ok=True)
lista = json.load(open(os.path.join(orig, 'lista.json'))) if os.path.exists(os.path.join(orig, 'lista.json')) else {}
medias = {}
for capa, de in capas.items():
    c = Image.open(os.path.join(orig, de + '_color.png')).convert('RGB')
    h = Image.open(os.path.join(orig, de + '_altura.png')).convert('L')
    # la altura, estirada a todo el rango (para mezclar por altura en los bordes)
    lo, hi = h.getextrema(); h = h.point(lambda v: int(255 * (v - lo) / max(1, hi - lo)))
    rgba = c.copy(); rgba.putalpha(h)
    rgba.save(os.path.join(dest, capa + '.webp'), quality=88, method=6)
    Image.open(os.path.join(orig, de + '_relieve.png')).convert('RGB').save(os.path.join(dest, capa + '_relieve.webp'), quality=90, method=6)
    # el color medio, en lineal (como los colores de los vértices)
    m = ImageStat.Stat(c).mean; medias[capa] = [round((v / 255) ** 2.2, 4) for v in m]
    print(capa, de, medias[capa])
json.dump(medias, open(os.path.join(dest, 'medias.json'), 'w'), indent=1)
