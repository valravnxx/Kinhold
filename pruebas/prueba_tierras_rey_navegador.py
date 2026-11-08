# Prueba en navegador de Strandvang, tierras del rey (valravnx, 31 oct): el cartel al entrar y al salir
# (src/juego/main.js, con src/logica/tierras_rey.js). Que los golpes entre jugadores no hieran ahí lo prueba la lógica
# del servidor (pruebas/prueba_tierras_rey.mjs); aquí, sin servidor, lo que ve el jugador.
# Uso: python3 pruebas/prueba_tierras_rey_navegador.py <html de la demo> <carpeta_capturas>
# Comprueba, en PC, en móvil y en inglés: que al aparecer en Strandvang (salida 41, a unos 300 m de Motdale) sale el
# cartel de «Entras en Strandvang, tierras del rey»; que al cruzar a Motdale sale el de «Sales de…» y al volver otra vez
# el de entrar; que se va solo a los pocos segundos; que cabe en la pantalla; y que en inglés no falta ningún texto.
# MUTAR=1: el juego no ve nunca las tierras del rey (window.__mutarTierras): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_tierras_rey'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos/personajes')):
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR', '')
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=41'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

CARTEL = """() => { const c = document.getElementById('cartelTierras'); if (!c || c.hidden) return null;
  const r = c.getBoundingClientRect(); return { texto: c.textContent, cambio: c.dataset.cambio, caja: [r.left, r.top, r.right, r.bottom] }; }"""
def esperar_cartel(pg, cambio, ms=60000):
    try:
        pg.wait_for_function(f"(() => {{ const c = document.getElementById('cartelTierras'); return c && !c.hidden && c.dataset.cambio === '{cambio}'; }})()", timeout=ms)
    except Exception: pass
    return pg.evaluate(CARTEL)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil, lang in [('pc', {'width': 1280, 'height': 800}, False, 'es'), ('movil', {'width': 390, 'height': 844}, True, 'es'), ('pc_en', {'width': 1280, 'height': 800}, False, 'en')]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        # el cartel dura 6 s; con 1 fotograma por segundo sin tarjeta gráfica, para las capturas, 20
        ctx.add_init_script('window.__duraCartel = 20000')
        if MUTAR == '1': ctx.add_init_script('window.__mutarTierras = true')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.goto(BASE + ('&lang=en' if lang == 'en' else ''))
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
        comprobar('la demo arranca sin error', not pg.evaluate('window.__demo.error'), str(pg.evaluate('window.__demo.error')))
        pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
        comprobar('sabe qué son las tierras del rey', pg.evaluate(f'!!{K}.tierrasRey && {K}.tierrasRey.nombre') == 'Strandvang')
        comprobar('apareces en Strandvang', pg.evaluate(f'{K}.tierrasRey.en({K}.pj.x, {K}.pj.z)'))
        c = esperar_cartel(pg, 'entra')
        en = lang == 'en'
        comprobar('al aparecer dentro, el cartel de entrar', bool(c) and (('Strandvang' in c['texto'] and ("king's lands" in c['texto'] if en else 'tierras del rey' in c['texto']))), c and c['texto'])
        comprobar('el cartel cabe en la pantalla', bool(c) and c['caja'][0] >= 0 and c['caja'][2] <= vista['width'] and c['caja'][1] >= 0, c and str(c['caja']))
        pg.screenshot(path=f'{SALIDA}/{nombre}_entras.png')
        # a Motdale: 400 m al oeste
        pg.evaluate(f'{K}.pj.x -= 400')
        c = esperar_cartel(pg, 'sale')
        comprobar('al cruzar a Motdale, el cartel de salir', bool(c) and not pg.evaluate(f'{K}.tierrasRey.en({K}.pj.x, {K}.pj.z)'), c and c['texto'])
        pg.screenshot(path=f'{SALIDA}/{nombre}_sales.png')
        # se va solo
        try:
            pg.wait_for_function("(() => { const c = document.getElementById('cartelTierras'); return c && c.hidden; })()", timeout=60000); ido = True
        except Exception: ido = False
        comprobar('el cartel se va solo a los pocos segundos', ido)
        pg.evaluate(f'{K}.pj.x += 400')
        c = esperar_cartel(pg, 'entra')
        comprobar('al volver, otra vez el de entrar', bool(c))
        if en:
            falta = pg.evaluate('[...window.__idioma.faltan]')
            comprobar('en inglés no falta ningún texto', not falta, str(falta[:6]))
        comprobar('sin errores en la página', not err, '; '.join(err[:3]))
        ctx.close()
    nav.close()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
