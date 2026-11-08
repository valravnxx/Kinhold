# Prueba en navegador (Chromium sin pantalla) del bosque de lejos visto de cerca (valravnx, 7 nov: «el tema de los
# arboles de lejos que hiciste crea este glitch grafico de monticulos que equivaldrian rollo a 50 metros cada uno, queda
# muy irreal a estas cortas distancias, habria que hacerlo mas suave, y tambien que comiencen a aparecer algo mas lejos»).
# En Whitholm, sin servidor y con el PC alto (el horizonte y las copas de cerca): empieza en un prado en lo alto y mira
# al bosque espeso más cercano (entre 300 y 700 m, algo más abajo). Comprueba que las copas de cerca están, que cada
# punto lleva lo que sube sobre el suelo y que no empiezan hasta 240 m o más del jugador (antes, desde los árboles de
# verdad, a veces a cien metros); y saca capturas en PC (1280×800) y móvil (390×844), con y sin las copas de cerca.
# Uso: python3 pruebas/prueba_dosel_cerca_navegador.py <html> <carpeta_capturas>
# MUTAR=1: las copas de cerca como antes (sin suavizar y desde el jugador): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_dosel'
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
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=211700,31900&graficos=pc-3'   # (un prado en lo alto, con bosque espeso a 400 m, unos 40 m más abajo)
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# el bosque espeso más cercano entre 300 y 700 m del jugador, donde empieza (en la rejilla de 100 m del horizonte: con
# dosel en sus 3 × 3 vecinos), sin moverse de la salida (al llevarlo lejos, el terreno de allí aún no está)
BUSCAR = f"""(() => {{ const h = window.__graficos.horizonte, m = h.muestras; while (!m.tiene(1)) m.avanzar(1000); window.__graficos.poner('pc-3', false);
  const O = {K}.mundoJ.salida, pj = {K}.pj, nx = m.nx, nz = m.nz, B = m.base, X = (i) => m.rect.x0 + i * B - O.x, Z = (j) => m.rect.z0 + j * B - O.z;
  const D = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz) ? 0 : m.dosel[j * nx + i];
  const lleno = (i, j) => {{ for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!(D(i + a, j + b) > 0)) return false; return true; }};
  const sx = Math.round((pj.x + O.x - m.rect.x0) / B), sz = Math.round((pj.z + O.z - m.rect.z0) / B);
  let mejor = null;
  for (let j = sz - 8; j <= sz + 8; j++) for (let i = sx - 8; i <= sx + 8; i++) {{
    const d = Math.hypot(X(i) - pj.x, Z(j) - pj.z); if (d < 300 || d > 700 || !lleno(i, j)) continue;
    if (!mejor || d < mejor.d) mejor = {{ p: [X(i), Z(j)], q: [pj.x, pj.z], d }}; }}
  return mejor; }})()"""

def ir(pg, s):
    """mira al bosque, a ras de suelo, con las copas de cerca ya hechas"""
    pg.evaluate(f"""(s => {{ const pj = {K}.pj, dx = s.p[0] - s.q[0], dz = s.p[1] - s.q[1]; pj.rot = Math.atan2(dx, dz);
      {K}.cam.yaw = Math.atan2(-dx, -dz); {K}.cam.pitch = 0.12; }})""", s)
    pg.wait_for_function(f"(() => {{ const t = {K}.mundoJ.terreno; return t.faltan() === 0 && {K}.decorado.pendientes === 0; }})()", timeout=900000)
    pg.wait_for_timeout(3000)
    return pg.evaluate(f"""(() => {{ const h = window.__graficos.horizonte; h.completarDoselCerca({K}.pj.x, {K}.pj.z);
      const g = h.doselCerca.geometry, u = h.doselCerca.material.userData.u, a = g.attributes.aAlto;
      return {{ tris: g.index ? g.index.count / 3 : 0, alto: a ? Array.from(a.array).filter(v => v > 5).length : 0, ini: u && u.uIni ? u.uIni.value : null, rampa: u && u.uRampa ? u.uRampa.value : null }}; }})()""")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista in [('PC', {'width': 1280, 'height': 800}), ('móvil', {'width': 390, 'height': 844, 'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2})]:
        print(nombre)
        pg = nav.new_page(viewport={'width': vista['width'], 'height': vista['height']}, **{k: v for k, v in vista.items() if k not in ('width', 'height')})
        errores = []
        pg.on('pageerror', lambda e: errores.append(str(e)))
        if MUTAR: pg.add_init_script('globalThis.__mutarMonticulos = true')
        pg.goto(BASE)
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=600000)
        pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=600000)
        s = pg.evaluate(BUSCAR)
        comprobar(f'{nombre}: hay un bosque espeso a 300–700 m de la salida', s is not None, str(s))
        if not s: pg.close(); continue
        d = ir(pg, s)
        pref = 'pc' if nombre == 'PC' else 'movil'
        if nombre == 'PC':
            comprobar('PC: delante, las copas de cerca', d['tris'] > 2000, str(d))
            comprobar('PC: cada punto lleva lo que sube sobre el suelo (para meterlo bajo el suelo cerca)', d['alto'] > 500, str(d))
            comprobar('PC: no empiezan hasta 240 m del jugador, y suben poco a poco', (d['ini'] or 0) >= 240 and (d['rampa'] or 0) >= 100, str(d))
        pg.screenshot(timeout=300000, path=f'{SALIDA}/{pref}_1_bosque.png')
        pg.evaluate("window.__graficos.horizonte.doselCerca.visible = false"); pg.wait_for_timeout(2500)
        pg.screenshot(timeout=300000, path=f'{SALIDA}/{pref}_2_sin_copas_de_cerca.png')
        pg.evaluate("window.__graficos.horizonte.doselCerca.visible = true")
        # más arriba, para ver las copas desde lo alto
        pg.evaluate(f"{K}.cam.pitch = 0.32"); pg.wait_for_timeout(3000)
        pg.screenshot(timeout=300000, path=f'{SALIDA}/{pref}_3_desde_arriba.png')
        comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))
        pg.close()
    nav.close()
srv.shutdown()
print('\nTODO CORRECTO' if not fallos else f'\n{len(fallos)} FALLOS: ' + '; '.join(fallos))
sys.exit(1 if fallos else 0)
