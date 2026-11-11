# Fotos de la prueba de estilo de la naturaleza (Meshy al lado de lo de hoy), en PC (1280×800) y en el móvil (390×844):
# python3 herramientas/meshy/fotos_naturaleza.py <carpeta_modelos_aligerados> <carpeta_fotos> arbol_adulto,arbol_joven,…
# Empaqueta herramientas/meshy/muestrario_naturaleza.js con esbuild y lo abre en Chromium sin pantalla.
import sys, os, shutil, subprocess, tempfile, threading, functools, http.server, socketserver
from playwright.sync_api import sync_playwright
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..')
mod, sal, cosas = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(sal, exist_ok=True)
d = tempfile.mkdtemp()
subprocess.run(['npx', 'esbuild', os.path.join(RAIZ, 'herramientas/meshy/muestrario_naturaleza.js'), '--bundle', '--format=esm', f'--outfile={d}/m.js', '--log-level=warning'], check=True, cwd=RAIZ)
shutil.copytree(mod, f'{d}/modelos')
open(f'{d}/index.html', 'w').write('<!doctype html><meta charset="utf-8"><body><script type="module" src="m.js"></script>')
class S(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(S, directory=d)); threading.Thread(target=srv.serve_forever, daemon=True).start()
nombres = cosas.split(',')
with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'])
    for disp, (w, h) in {'pc': (1280, 800), 'movil': (390, 844)}.items():
        pg = b.new_page(viewport={'width': w, 'height': h}); err = []
        pg.on('pageerror', lambda e: err.append(str(e))); pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(f"http://127.0.0.1:{srv.server_address[1]}/index.html?cosas={cosas}")
        pg.wait_for_function('window.__muestrario && window.__muestrario.listo', timeout=180000)
        pg.wait_for_timeout(500)
        pg.evaluate(f"window.__muestrario.foto(-1, 'tres', {w}, {h})"); pg.screenshot(path=f'{sal}/{disp}_00_todas.png')
        for i, n in enumerate(nombres):
            for v in ['tres', 'cerca']:
                pg.evaluate(f"window.__muestrario.foto({i}, '{v}', {w}, {h})"); pg.screenshot(path=f'{sal}/{disp}_{i + 1:02d}_{n}_{v}.png')
        print(disp, 'errores', err[:3]); pg.close()
    b.close()
