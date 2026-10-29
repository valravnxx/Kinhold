# Copia a docs/capturas/<destino>/ en JPG (máx. 1280 px de ancho) SOLO las capturas de este cambio: las nombradas.
# valravnx, 29 oct: cada noticia salía con todas las capturas de la batería de pruebas (más de 20, a veces 80) y las del
# cambio eran las 2 últimas. Se nombran las capturas nuevas y las de las vistas que ha tocado el cambio, en PC y en móvil;
# el resto se mira en /tmp/kinhold_capturas/ pero no se publica.
# Uso: python3 herramientas/capturas.py <carpeta_origen> <destino> <captura> [<captura> ...]
#      p. ej. python3 herramientas/capturas.py /tmp/kinhold_capturas/construccion construccion-v36 '50_remate*' 'movil_06j*'
#      Cada captura es un nombre (con o sin extensión) o un patrón con * y ?. Como mucho 12 (CAPTURAS_MAS=1 deja más,
#      solo si de verdad son todas de este cambio).
import sys, os, fnmatch
from PIL import Image
if len(sys.argv) < 4:
    sys.exit('Faltan las capturas: di cuáles son de este cambio (nombres o patrones), no se publica la batería entera.\n'
             'Uso: python3 herramientas/capturas.py <carpeta_origen> <destino> <captura> [<captura> ...]')
origen, nombre, pedidas = sys.argv[1], sys.argv[2], sys.argv[3:]
hay = sorted(f for f in os.listdir(origen) if f.lower().endswith(('.png', '.jpg', '.jpeg')))
elegidas, sin = [], []
for p in pedidas:
    q = [f for f in hay if fnmatch.fnmatch(f, p) or os.path.splitext(f)[0] == p or fnmatch.fnmatch(os.path.splitext(f)[0], p)]
    if not q: sin.append(p)
    elegidas += [f for f in q if f not in elegidas]
if sin: sys.exit(f'No hay ninguna captura que se llame así en {origen}: {", ".join(sin)}')
if len(elegidas) > 12 and not os.environ.get('CAPTURAS_MAS'):
    sys.exit(f'Son {len(elegidas)} capturas: como mucho 12, las de este cambio ({", ".join(elegidas[:15])}…).')
dest = os.path.join(os.path.dirname(__file__), '..', 'docs', 'capturas', nombre)
os.makedirs(dest, exist_ok=True)
for f in elegidas:
    im = Image.open(os.path.join(origen, f)).convert('RGB')
    if im.width > 1280: im = im.resize((1280, round(im.height * 1280 / im.width)), Image.LANCZOS)
    im.save(os.path.join(dest, os.path.splitext(f)[0] + '.jpg'), quality=82, optimize=True)
print(f'{len(elegidas)} capturas en', os.path.normpath(dest) + ':', ', '.join(elegidas))
