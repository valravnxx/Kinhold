# Prueba en navegador (Chromium sin pantalla) del ciclo de día y noche (valravnx, 7 nov: «el ciclo dia y noche, cielo
# estrellado limpio, sol y luna, y toda la iluminación dinámica que dará el sol»). En el mundo de verdad (Whitholm),
# sin servidor, en PC (1280×800) y en móvil (390×844):
#   - las pruebas automáticas sin ?hora ven la luz «mañana» del estilo v5, quieta (las demás pruebas no dependen de la hora);
#   - a mediodía, el cielo claro y la luz del sol arriba, al sur; la sombra la hace el sol (la luz va donde dice el cielo);
#   - al ponerse el sol, mirándolo: su disco se ve, cálido, más claro que el cielo de al lado;
#   - de noche con luna llena: el cielo oscuro, con estrellas (puntos claros sueltos) y la luna (un disco claro donde
#     dice el cielo); el suelo, oscuro pero se ve; con luna nueva, más oscuro, pero aún se ve;
#   - el agua refleja el cielo de cada momento (de noche, oscuro);
#   - en PC alto (con el horizonte), de noche lo lejano no brilla (la bruma va al color del cielo de noche);
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_cielo_navegador.py <html> <carpeta_capturas>
# MUTAR=1: el cielo vivo apagado (como antes: el degradado de la página, sin sol, luna ni estrellas): tiene que fallar.
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver, json
from playwright.sync_api import sync_playwright
from PIL import Image, ImageStat

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_cielo'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3', 'taller-dormir-v1', 'taller-sentarse-v1']:
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
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg, extra=''):
    pg.goto(BASE + extra)
    pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    # sin los botones ni los avisos (taparían el cielo que se mide; en el móvil, casi toda la franja de arriba)
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    pg.wait_for_timeout(1500)

def poner(pg, hora, fase=None, mirar=None, pitch=0.1):
    f = {'hora': hora} if fase is None else {'hora': hora, 'fase': fase}
    c = pg.evaluate(f'{K}.cielo.poner({json.dumps(f)})')
    if MUTAR: pg.evaluate(f'{K}.cielo.estado.activo = false; {K}.cielo.paso = () => {K}.cielo.actual')
    pg.evaluate(f'{K}.cam.pitch = {pitch}')
    if mirar: pg.evaluate(f'(() => {{ const d = {K}.cielo.actual.{mirar}; {K}.cam.yaw = Math.atan2(-d[0], -d[2]); }})()')
    pg.wait_for_timeout(2500)
    return c

def foto(pg, ruta=None):
    b = pg.screenshot(timeout=180000)
    if ruta: open(ruta, 'wb').write(b)
    return Image.open(io.BytesIO(b)).convert('RGB')

def media(im, caja):
    return [round(x) for x in ImageStat.Stat(im.crop(caja)).mean]

def donde(pg, cosa):
    """dónde sale en la pantalla (de 0 a 1, de izquierda a derecha y de arriba abajo) algo del cielo: el sol o la luna"""
    return pg.evaluate(f"""(() => {{ const k = {K}, d = k.cielo.actual.{cosa}, c = k.camara;
      const v = c.position.clone().addScaledVector(new c.position.constructor(d[0], d[1], d[2]), 1000).project(c);
      return {{ x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: v.z }}; }})()""")

def estrellas(im, caja):
    """puntos claros sueltos en el cielo: píxeles mucho más claros que la media de alrededor"""
    zona = im.crop(caja).convert('L'); w, h = zona.size; px = zona.load()
    base = ImageStat.Stat(zona).median[0]; n = 0
    for y in range(1, h - 1, 1):
        for x in range(1, w - 1, 1):
            v = px[x, y]
            if v > base + 45 and v >= max(px[x - 1, y], px[x + 1, y], px[x, y - 1], px[x, y + 1]): n += 1
    return n, base

def recorrido(pg, nombre, pref, movil):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    W, H = foto(pg).size   # (los px de la captura: en el móvil no son los de innerWidth)
    arriba = (0, round(H * 0.06), W, round(H * 0.22))   # una franja de cielo
    suelo = (round(W * 0.1), round(H * 0.62), round(W * 0.9), round(H * 0.95))
    comprobar(f'{nombre}: sin ?hora, las pruebas ven la luz «mañana» del estilo v5, quieta', pg.evaluate(f'{K}.cielo.fijo') == 'v5' and abs(pg.evaluate(f'{K}.ambiente.sol.intensity') - 2.2) < 1e-6)
    # mediodía
    c = poner(pg, 12)
    im = foto(pg, f'{SALIDA}/{pref}_1_mediodia.png')
    cie = media(im, arriba)
    comprobar(f'{nombre}: a mediodía, el cielo claro', sum(cie) / 3 > 150, str(cie))
    luz = pg.evaluate(f"(() => {{ const s = {K}.ambiente.sol; const d = s.position.clone().sub(s.target.position).normalize(); return [d.x, d.y, d.z, s.intensity]; }})()")
    comprobar(f'{nombre}: la luz que hace sombra viene del sol (al sur, a 48°)', abs(luz[0]) < 0.02 and abs(luz[1] - 0.743) < 0.02 and luz[2] > 0.6 and luz[3] > 2, str([round(v, 3) for v in luz]))
    suelo_dia = sum(media(im, suelo)) / 3
    # el ocaso, mirando al sol
    poner(pg, 17.55, mirar='sol', pitch=0.05)
    im = foto(pg, f'{SALIDA}/{pref}_2_ocaso.png')
    p = donde(pg, 'sol'); p['x'] *= W; p['y'] *= H
    dentro = 6 < p['x'] < W - 6 and 6 < p['y'] < H - 6 and p['z'] < 1
    if dentro:
        dis = media(im, (round(p['x']) - 2, round(p['y']) - 2, round(p['x']) + 3, round(p['y']) + 3))
        lado = media(im, (round(p['x']) + 30, round(p['y']) - 4, round(p['x']) + 50, round(p['y']) + 4))
    else: dis = lado = [0, 0, 0]
    comprobar(f'{nombre}: al ponerse, el disco del sol se ve donde está, más claro que el cielo de al lado', dentro and sum(dis) > sum(lado) + 25 and dis[0] > 235, f'en {round(p["x"])},{round(p["y"])}: {dis} contra {lado}')
    comprobar(f'{nombre}: y el cielo de al lado es cálido (rojo sobre azul)', lado[0] > lado[2] + 15, str(lado))
    # noche de luna llena, mirando a la luna
    poner(pg, 19.0, 0.5, mirar='luna', pitch=0.05)
    im = foto(pg, f'{SALIDA}/{pref}_3_luna_llena.png')
    p = donde(pg, 'luna'); p['x'] *= W; p['y'] *= H
    dentro = 6 < p['x'] < W - 6 and 6 < p['y'] < H - 6 and p['z'] < 1
    lu = media(im, (round(p['x']) - 2, round(p['y']) - 2, round(p['x']) + 3, round(p['y']) + 3)) if dentro else [0, 0, 0]
    comprobar(f'{nombre}: de noche, la luna llena se ve donde está (un disco claro)', dentro and min(lu) > 170, f'en {round(p["x"])},{round(p["y"])}: {lu}')
    # medianoche con luna llena: cielo oscuro con estrellas; el suelo se ve
    poner(pg, 0, 0.5, pitch=0.1)
    im = foto(pg, f'{SALIDA}/{pref}_4_medianoche.png')
    cie = media(im, arriba)
    n, base = estrellas(im, arriba)
    comprobar(f'{nombre}: a medianoche, el cielo oscuro', sum(cie) / 3 < 40, str(cie))
    comprobar(f'{nombre}: con estrellas (puntos claros sueltos)', n >= 8, f'{n} estrellas en la franja (fondo {base})')
    s_llena = sum(media(im, suelo)) / 3
    comprobar(f'{nombre}: con luna llena, el suelo oscuro pero se ve', 30 < s_llena < suelo_dia * 0.75, f'{round(s_llena)} (de día {round(suelo_dia)})')
    # luna nueva
    poner(pg, 0, 0.0, pitch=0.1)
    im = foto(pg, f'{SALIDA}/{pref}_5_luna_nueva.png')
    s_nueva = sum(media(im, suelo)) / 3
    comprobar(f'{nombre}: con luna nueva, más oscuro, pero aún se ve', 18 < s_nueva < s_llena - 5, f'{round(s_nueva)} (con luna llena {round(s_llena)})')
    comprobar(f'{nombre}: de noche, el agua refleja un cielo oscuro', pg.evaluate(f'{K}.cielo.agua') < 0.05, str(pg.evaluate(f'{K}.cielo.agua')))
    poner(pg, 12)
    comprobar(f'{nombre}: de día, claro', pg.evaluate(f'{K}.cielo.agua') > 0.3, str(pg.evaluate(f'{K}.cielo.agua')))
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

def horizonte(pg, nombre, pref):
    """PC alto, con el horizonte: de noche lo lejano no brilla"""
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg, '&graficos=pc-3')
    W, H = foto(pg).size
    # (las muestras de la isla se hacen poco a poco: aquí, de una vez, como en la prueba del perfil gráfico)
    pg.evaluate("(() => { const G = window.__graficos, m = G.horizonte.muestras; while (!m.tiene(1)) m.avanzar(1000); G.poner('pc-3', false); })()")
    comprobar(f'{nombre}: el PC alto lleva el horizonte', pg.evaluate('!!window.__graficos.horizonte && window.__graficos.horizonte.activo'), pg.evaluate('window.__graficos.perfil'))
    poner(pg, 0, 0.5, pitch=0.05)
    im = foto(pg, f'{SALIDA}/{pref}_6_noche_horizonte.png')
    franja = media(im, (0, round(H * 0.25), W, round(H * 0.42)))
    comprobar(f'{nombre}: de noche, lo lejano y el cielo, oscuros (la bruma va al cielo de noche)', sum(franja) / 3 < 60, str(franja))
    n, base = estrellas(im, (0, round(H * 0.06), W, round(H * 0.22)))
    comprobar(f'{nombre}: y con estrellas', n >= 8, f'{n} (fondo {base})')
    poner(pg, 17.55, mirar='sol', pitch=0.05)
    foto(pg, f'{SALIDA}/{pref}_7_ocaso_horizonte.png')
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, pref, vista, movil in [('PC', 'pc', {'width': 1280, 'height': 800}, False), ('móvil', 'movil', {'width': 390, 'height': 844}, True)]:
        ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
        pg = ctx.new_page()
        recorrido(pg, nombre, pref, movil)
        ctx.close()
    ctx = nav.new_context(viewport={'width': 1280, 'height': 800})
    horizonte(ctx.new_page(), 'PC alto', 'pc_alto')
    ctx.close()
    nav.close()
srv.shutdown()
print(f'\n{"FALLAN: " + ", ".join(fallos) if fallos else "Todo correcto"}')
sys.exit(1 if fallos else 0)
