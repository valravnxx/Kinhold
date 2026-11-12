# Prueba en navegador (Chromium sin pantalla) de la prueba de posprocesado y los seis perfiles gráficos (valravnx, 4 nov).
# Comprueba: la página carga sin errores; cada perfil monta sus pasadas (más perfil, más pasadas o más resolución);
# cada efecto cambia la imagen al quitarlo (si no, no está haciendo nada); los efectos que un perfil no lleva no se
# pueden poner; «Sin posprocesado» dibuja directo; «Medir» da una medida de cada perfil y elige uno.
# Capturas en PC (1280×800) y móvil (390×844): los seis perfiles, la v5 sin nada, cada efecto quitado y puesto, el
# rincón (oclusión) y el atardecer a contraluz (brillo y haces).
# Uso: python3 pruebas/prueba_posprocesado_navegador.py <html> <carpeta_capturas>
# MUTAR=1: los efectos no hacen nada (la cadena se monta sin ellos): la prueba tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_posprocesado.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_posprocesado'
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'posprocesado': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/posprocesado/prueba.html'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = bool(os.environ.get('MUTAR'))
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def lienzo(pg):
    """la imagen del lienzo 3D sola (sin la interfaz), reducida para comparar"""
    st = pg.add_style_tag(content='body > *:not(canvas){visibility:hidden!important}')
    png = pg.screenshot(); pg.evaluate('e => e.remove()', st)
    return Image.open(io.BytesIO(png)).convert('RGB').resize((320, 200))
def diferencia(a, b):
    return sum(ImageStat.Stat(ImageChops.difference(a, b)).mean) / 3

def recorrido(pg, nombre, pref):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.__post', timeout=60000)
    pg.evaluate('localStorage.clear()'); pg.reload(); pg.wait_for_function('window.__post', timeout=60000)
    pg.evaluate('window.__post.pausar(true)')
    if MUTAR: pg.evaluate("window.__post.poner = (o => function (x = {}) { return o.call(this, { ...x, on: { ao: false, brillo: false, rayos: false, color: false, tono: false, desenfoque: false } }); })(window.__post.poner)")
    def poner(**k):
        import json
        pg.evaluate(f'window.__post.poner({json.dumps(k)})'); pg.wait_for_timeout(150)
    def cap(n):
        pg.screenshot(path=f'{SALIDA}/{pref}_{n}.png')
    print(f'{nombre}: el aparato', pg.evaluate('JSON.stringify(window.__post.aparato)'), '→ sugiere', pg.evaluate('window.__post.sugerido'))
    # la v5 tal cual
    poner(v5=True, luz='manana', vista='maqueta'); cap('00_v5_sin_posprocesado')
    v5 = lienzo(pg)
    comprobar(f'{nombre}: sin posprocesado dibuja directo (1 pasada)', pg.evaluate('window.__post.pasadas()') == 1)
    # los seis perfiles
    pasadas = {}
    for i, p in enumerate(pg.evaluate('window.__post.PERFILES.map(p => p.id)')):
        poner(v5=False, perfil=p, vista='maqueta'); cap(f'0{i + 1}_perfil_{p}')
        pasadas[p] = pg.evaluate('window.__post.pasadas()')
    # lo que debe llevar cada uno: el dibujo, la oclusión si la lleva, la pasada de efectos y el SMAA si es su suavizado
    # (el MSAA de los PC medio y alto va en el propio dibujo: no cuesta pasada)
    esperado = {p['id']: 2 + (1 if p['ao'] else 0) + (1 if p['suavizado'].startswith('smaa') else 0) for p in pg.evaluate('window.__post.PERFILES')}
    comprobar(f'{nombre}: cada perfil monta la cadena que le toca', pasadas == esperado, f'{pasadas} (esperado {esperado})')
    # cada efecto, en el PC alto (los lleva todos), quitándolo: tiene que cambiar la imagen
    vistas = {'ao': 'rincon', 'tono': 'cabana', 'color': 'cabana', 'brillo': 'cabana', 'niebla': 'maqueta', 'desenfoque': 'cabana', 'rayos': 'contraluz'}
    luces = {'brillo': 'ocaso', 'rayos': 'ocaso'}
    umbral = {'ao': 0.25, 'tono': 1.0, 'color': 0.5, 'brillo': 0.08, 'niebla': 0.3, 'desenfoque': 0.8, 'rayos': 0.3}
    for e, v in vistas.items():
        luz = luces.get(e, 'manana')
        poner(perfil='pc-3', luz=luz, vista=v, on={'desenfoque': e == 'desenfoque', e: True}); con = lienzo(pg); cap(f'1_{e}_con')
        poner(perfil='pc-3', luz=luz, vista=v, on={'desenfoque': False, e: False}); sin = lienzo(pg); cap(f'1_{e}_sin')
        d = diferencia(con, sin)
        comprobar(f'{nombre}: {e} cambia la imagen ({v}, {luz})', d >= umbral[e], f'{d:.2f} (umbral {umbral[e]})')
    # lo que un perfil no lleva no se puede poner
    poner(perfil='movil-1', vista='maqueta', luz='manana')
    dis = pg.evaluate("[...document.querySelectorAll('[data-efecto]')].filter(b => b.disabled).map(b => b.dataset.efecto)")
    comprobar(f'{nombre}: en el móvil básico no se pueden poner la oclusión, el brillo, los haces ni el desenfoque', sorted(dis) == ['ao', 'brillo', 'desenfoque', 'rayos'], str(dis))
    # el perfil más alto se parece a la v5 en lo esencial (misma escena, mismo encuadre): no se ha roto el dibujo
    poner(perfil='pc-3', vista='maqueta', luz='manana'); d = diferencia(lienzo(pg), v5)
    comprobar(f'{nombre}: el PC alto se parece a la v5 en lo general (no se ha roto el dibujo)', d < 18, f'{d:.2f}')
    # medir (aquí, sin tarjeta gráfica, los números no valen: solo que salga)
    r = pg.evaluate('window.__post.medirTodo(2)')
    comprobar(f'{nombre}: «Medir» mide los seis perfiles y elige uno', len(r['perfiles']) == 6 and all(x > 0 for x in r['perfiles'].values()) and r['elegido'], str({k: round(v, 1) for k, v in r['perfiles'].items()}) + ' → ' + str(r['elegido']))
    pg.evaluate('window.__post.pausar(true)'); pg.wait_for_timeout(200)   # «Medir» vuelve a dibujar sin parar; aquí, sin tarjeta, eso no deja hacer capturas
    cap('2_medida')
    pg.click('#btnCerrarMedida')
    comprobar(f'{nombre}: sin errores de página', not errores, '; '.join(errores)[:400])

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    recorrido(pg, 'PC', 'pc')
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    recorrido(ctx.new_page(), 'móvil', 'movil')
    nav.close()
print(f'\n{"HAY FALLOS: " + ", ".join(fallos) if fallos else "TODO CORRECTO"} · capturas en {SALIDA}')
sys.exit(1 if fallos else 0)
