# Las imágenes de cada cosa para el panel de fabricar, sacadas de los modelos del juego (herramientas/iconos/iconos.js).
# Uso: python3 herramientas/iconos/sacar.py docs/recursos/iconos-vN [hoja=/ruta/hoja.png]
# Guarda <tipo>.webp (y est_<estación>.webp) de 192 px con el fondo transparente, más indice.json con cuáles aún no
# tienen su modelo («propio»: false). Los recursos publicados no se cambian: si la carpeta ya tiene imágenes, para
# (para un cambio, otra carpeta: iconos-v2…). Con hoja=, además una hoja con todas para mirarlas de un vistazo. Con
# conjunto=piezas, las de las piezas de construir, los muebles y el mojón (docs/recursos/piezas-vN).
import sys, os, json, base64, io, subprocess, tempfile, threading, functools, http.server, socketserver
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..')
LADO = 192
sal = sys.argv[1]
arg = dict(a.split('=', 1) for a in sys.argv[2:])
if os.path.isdir(sal) and any(f.endswith('.webp') for f in os.listdir(sal)):
    sys.exit(f'{sal} ya tiene imágenes: los recursos publicados no se cambian (usa otra carpeta)')
os.makedirs(sal, exist_ok=True)
d = tempfile.mkdtemp()
subprocess.run(['npx', 'esbuild', os.path.join(RAIZ, 'herramientas/iconos/iconos.js'), '--bundle', '--format=esm', f'--outfile={d}/i.js', '--log-level=warning'], check=True, cwd=RAIZ)
open(f'{d}/index.html', 'w').write('<!doctype html><meta charset="utf-8"><body><script type="module" src="i.js"></script>')
class S(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(S, directory=d)); threading.Thread(target=srv.serve_forever, daemon=True).start()

indice, vacias, hechas = {}, [], []
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 300, 'height': 300}); err = []
    pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
    pg.goto(f'http://127.0.0.1:{srv.server_address[1]}/index.html' + (f"?conjunto={arg['conjunto']}" if 'conjunto' in arg else ''))
    pg.wait_for_function('window.__iconos', timeout=120000)
    for e in pg.evaluate('window.__iconos.lista'):
        n = e['nombre']
        im = Image.open(io.BytesIO(base64.b64decode(pg.evaluate(f"window.__iconos.foto('{n}')").split(',')[1]))).convert('RGBA')
        caja = im.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox()
        if not caja or (caja[2] - caja[0]) * (caja[3] - caja[1]) < im.width * im.height * 0.04: vacias.append(n)
        im = im.resize((LADO, LADO), Image.LANCZOS)
        im.save(os.path.join(sal, n + '.webp'), 'WEBP', quality=88, method=6)
        indice[n] = {'propio': e['propio']}
        hechas.append((n, im))
    b.close()
if err: print('\n'.join(err[:10]))
json.dump({'lado': LADO, 'iconos': indice}, open(os.path.join(sal, 'indice.json'), 'w'), ensure_ascii=False, indent=1)
print(f'{len(indice)} imágenes en {sal}; sin modelo aún: {sum(not v["propio"] for v in indice.values())}')
if vacias: sys.exit('imágenes vacías o casi: ' + ', '.join(vacias))
if 'hoja' in arg:
    W = 8; H = (len(hechas) + W - 1) // W
    hoja = Image.new('RGBA', (W * 170, H * 190), (44, 37, 30, 255)); dib = ImageDraw.Draw(hoja)
    for i, (n, im) in enumerate(hechas):
        x, y = (i % W) * 170 + 9, (i // W) * 190 + 4
        hoja.paste(im.resize((152, 152)), (x, y), im.resize((152, 152)))
        dib.text((x, y + 156), n + ('' if indice[n]['propio'] else ' (sin modelo)'), fill=(240, 230, 210) if indice[n]['propio'] else (200, 150, 120))
    hoja.convert('RGB').save(arg['hoja'])
