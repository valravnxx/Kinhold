# Prueba en navegador de la demo única: menú, las tres partes, el botón «Menú» y el personaje elegido en todo.
# Uso: python3 pruebas/prueba_demo_navegador.py <html> <carpeta_capturas>
# Sirve el html en jugar/demo/ y los recursos de personaje en recursos/personajes/ (como la web).
# MUTAR=1 borra lo guardado al cambiar de parte (como si no se pasara el personaje): la prueba tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_demo'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v4']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html'
MUTAR = bool(os.environ.get('MUTAR'))

ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def variedad(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((160, 100))
    return sum(ImageStat.Stat(im).stddev) / 3
def tapado(pg, sel):
    """True si el centro del elemento lo tapa otra cosa"""
    return pg.evaluate("""s => { const e = document.querySelector(s); if (!e) return 'no está'; const r = e.getBoundingClientRect();
      if (r.width === 0) return 'invisible'; const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return x === e || e.contains(x) ? '' : (x ? x.id || x.tagName : 'nada'); }""", sel)
def ir(pg, sel):
    if MUTAR: pg.evaluate('localStorage.clear()')
    pg.click(sel); pg.wait_for_load_state('load'); pg.wait_for_function('window.__demo && window.__demo.listo', timeout=60000)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL); pg.wait_for_function('window.__demo && window.__demo.listo')
        # 1. menú
        comprobar('menú: tres partes', pg.locator('a.parte').count() == 3)
        comprobar('menú: sin personaje elegido lo dice', 'Aún no has elegido' in pg.inner_text('#demoPersonaje'))
        for s in ['[data-ir=construir]', '[data-ir=duelo]', '[data-ir=personaje]']:
            t = tapado(pg, s); comprobar(f'menú: {s} se ve y no está tapado', t == '', t)
        pg.screenshot(path=f'{SALIDA}/{nombre}_menu.png')
        # 2. personaje: se elige mujer con vestido y gambesón
        ir(pg, '[data-ir=personaje]')
        pg.wait_for_function('window.__personaje && window.__personaje.listo()', timeout=180000)
        comprobar('personaje: botón Menú arriba y libre', tapado(pg, '#btnDemoMenu') == '', tapado(pg, '#btnDemoMenu'))
        pg.evaluate("window.__personaje.cambiar({sexo: 'mujer', capas: {mujer: ['vestido', 'gambeson']}})")
        pg.wait_for_function('window.__personaje.listo()', timeout=180000)
        pg.evaluate("window.__personaje.ponerVista('cuerpo')"); pg.evaluate('window.__personaje.pausar(true)'); pg.evaluate('window.__personaje.instante(1.0)')
        png = pg.screenshot(path=f'{SALIDA}/{nombre}_personaje.png')
        comprobar('personaje: se dibuja la escena', variedad(png) > 12, f'{variedad(png):.1f}')
        # 3. vuelta al menú
        ir(pg, '#btnDemoMenu')
        r = pg.inner_text('#demoPersonaje')
        comprobar('menú: resume el personaje elegido', 'mujer' in r and 'gambesón' in r, r)
        # 4. construir: la jugadora es la elegida
        ir(pg, '[data-ir=construir]')
        pg.wait_for_function('window.__kinhold && window.__kinhold.jugador.mh', timeout=180000)
        mh = pg.evaluate('({s: window.__kinhold.jugador.mh.opciones.sexo, c: window.__kinhold.jugador.mh.capas})')
        comprobar('construir: el personaje elegido', mh['s'] == 'mujer' and mh['c'] == ['vestido', 'gambeson'], str(mh))
        t = tapado(pg, '#btnDemoMenu'); comprobar('construir: botón Menú libre', t == '', t)
        pg.wait_for_timeout(1500)
        png = pg.screenshot(path=f'{SALIDA}/{nombre}_construir.png')
        comprobar('construir: se dibuja', variedad(png) > 12, f'{variedad(png):.1f}')
        # 5. duelo: con lino lleva su vestido sin gambesón; con malla, gambesón y cota
        ir(pg, '#btnDemoMenu'); ir(pg, '[data-ir=duelo]')
        pg.wait_for_function("window.__duelo && window.__duelo.mJugador.userData.taller && window.__duelo.mJugador.userData.taller.estado === 'listo'", timeout=180000)
        arm = pg.evaluate('window.__duelo.opc.armadura')
        mh = pg.evaluate('({s: window.__duelo.mJugador.userData.taller.mh.opciones.sexo, c: window.__duelo.mJugador.userData.taller.mh.capas})')
        esperado = {'lino': ['vestido'], 'gambeson': ['gambeson'], 'malla': ['gambeson', 'cota']}.get(arm)
        comprobar(f'duelo: la elegida con armadura {arm}', mh['s'] == 'mujer' and mh['c'] == esperado, str(mh))
        pg.evaluate("window.__duelo.configurar({armadura: 'malla'})")
        pg.wait_for_function("window.__duelo.mJugador.userData.taller && window.__duelo.mJugador.userData.taller.estado === 'listo'", timeout=180000)
        c = pg.evaluate('window.__duelo.mJugador.userData.taller.mh.capas')
        comprobar('duelo: con cota se ven gambesón y cota', c == ['gambeson', 'cota'], str(c))
        rv = pg.evaluate("window.__duelo.mRival && window.__duelo.mRival.userData.taller && window.__duelo.mRival.userData.taller.mh ? window.__duelo.mRival.userData.taller.mh.opciones.sexo : 'hombre'")
        comprobar('duelo: el rival sigue siendo el de siempre', rv == 'hombre', rv)
        t = tapado(pg, '#btnDemoMenu'); comprobar('duelo: botón Menú libre', t == '', t)
        pg.wait_for_timeout(1500)
        png = pg.screenshot(path=f'{SALIDA}/{nombre}_duelo.png')
        comprobar('duelo: se dibuja', variedad(png) > 12, f'{variedad(png):.1f}')
        ir(pg, '#btnDemoMenu')
        comprobar('vuelve al menú', pg.locator('a.parte').count() == 3)
        errores = [e for e in err if 'favicon' not in e]
        comprobar('sin errores en la consola', not errores, '; '.join(errores[:3]))
        ctx.close()
    # el menú en inglés y en ruso: sin textos sin traducir
    for l in ['en', 'ru']:
        ctx = nav.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.goto(URL + '?lang=' + l); pg.wait_for_function('window.__demo && window.__demo.listo')
        f = pg.evaluate('[...window.__idioma.faltan]')
        comprobar(f'menú en {l}: todo traducido', not f, '; '.join(f[:3]))
        t = tapado(pg, '[data-ir=personaje]'); comprobar(f'menú en {l}: nada tapado', t == '', t)
        pg.screenshot(path=f'{SALIDA}/movil_menu_{l}.png'); ctx.close()
    nav.close()
srv.shutdown()
print(); print('TODO CORRECTO' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
