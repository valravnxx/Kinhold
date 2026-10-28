# Fotos del muestrario de piezas: python3 herramientas/muestrario/fotos.py <carpeta> piezas=muro_tronco,… [deco=mesa,…] [armas=espada_larga,escudo,hacha,…] [vistas=tres,frente,cerca]
# Con casas=1, casas pequeñas con sus tejados y hastiales (herramientas/muestrario/tejados.js).
# Construye el muestrario con esbuild, lo abre en Chromium sin pantalla y saca una foto por pieza y vista (más una general).
import sys, os, subprocess, tempfile, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..')
sal = sys.argv[1]; os.makedirs(sal, exist_ok=True)
arg = dict(a.split('=', 1) for a in sys.argv[2:])
d = tempfile.mkdtemp()
subprocess.run(['npx', 'esbuild', os.path.join(RAIZ, 'herramientas/muestrario/' + ('tejados.js' if arg.get('casas') else 'muestrario.js')), '--bundle', '--format=esm', f'--outfile={d}/m.js', '--log-level=warning'], check=True, cwd=RAIZ)
open(f'{d}/index.html', 'w').write('<!doctype html><meta charset="utf-8"><body><script type="module" src="m.js"></script>')
class S(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(S, directory=d)); threading.Thread(target=srv.serve_forever, daemon=True).start()
nombres = [('pieza', t) for t in arg.get('piezas', '').split(',') if t] + [('deco', t) for t in arg.get('deco', '').split(',') if t] + [('arma', t) for t in arg.get('armas', '').split(',') if t]
if arg.get('casas'): nombres = [('casa', t) for t in ['paja_dos_aguas', 'tablillas_dos_aguas', 'paja_una_caida', 'tablillas_una_caida', 'teja_dos_aguas', 'teja_una_caida', 'paja_cuatro_aguas', 'tablillas_en_L', 'teja_en_L', 'paja_en_L', 'tablillas_cuatro_aguas', 'teja_piramide']]
if arg.get('solo'): nombres = [(i, n) for i, n in enumerate(nombres) if n[1] in arg['solo'].split(',')]
else: nombres = list(enumerate(nombres))
vistas = arg.get('vistas', 'tres,frente,cerca').split(',')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 900, 'height': 700}); err = []
    pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
    pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?piezas={arg.get('piezas', '')}&deco={arg.get('deco', '')}&armas={arg.get('armas', '')}")
    pg.wait_for_function('window.__muestrario && window.__muestrario.listo', timeout=60000)
    pg.wait_for_timeout(500)
    pg.evaluate("window.__muestrario.foto(-1, 'tres', 1400, 700)"); pg.screenshot(path=f'{sal}/00_todas.png', clip={'x': 0, 'y': 0, 'width': 900, 'height': 700})
    for n, (i, (c, t)) in enumerate(nombres):
        for v in vistas:
            pg.evaluate(f"window.__muestrario.foto({i}, '{v}', 900, 700)"); pg.screenshot(path=f'{sal}/{i + 1:02d}_{t}_{v}.png')
    print('fotos', len(nombres) * len(vistas) + 1, '· errores', err[:3]); b.close()
