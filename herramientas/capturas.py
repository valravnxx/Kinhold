# Copia capturas a docs/capturas/<carpeta>/ en JPG (máx. 1280 px de ancho) para que el repositorio no engorde.
# Uso: python3 herramientas/capturas.py <carpeta_origen> <nombre_destino>   (p. ej. /tmp/capt combate-v3)
import sys, os
from PIL import Image
origen, nombre = sys.argv[1], sys.argv[2]
dest = os.path.join(os.path.dirname(__file__), '..', 'docs', 'capturas', nombre)
os.makedirs(dest, exist_ok=True)
for f in sorted(os.listdir(origen)):
    if not f.lower().endswith(('.png', '.jpg', '.jpeg')): continue
    im = Image.open(os.path.join(origen, f)).convert('RGB')
    if im.width > 1280: im = im.resize((1280, round(im.height * 1280 / im.width)), Image.LANCZOS)
    im.save(os.path.join(dest, os.path.splitext(f)[0] + '.jpg'), quality=82, optimize=True)
print('capturas en', os.path.normpath(dest))
