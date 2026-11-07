# Prueba en navegador (Chromium sin pantalla) del bosque de lejos visto de cerca (valravnx, 7 nov: «el tema de los
# arboles de lejos que hiciste crea este glitch grafico de monticulos que equivaldrian rollo a 50 metros cada uno, queda
# muy irreal a estas cortas distancias, habria que hacerlo mas suave, y tambien que comiencen a aparecer algo mas lejos»).
# En Whitholm, sin servidor y con el PC alto (el horizonte y las copas de cerca): busca un prado a unos 400 m de un
# bosque espeso, lleva allí al jugador y mira al bosque a ras de suelo. Comprueba que las copas de cerca están, que cada
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
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&graficos=pc-3'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# un prado a unos 400 m de un bosque espeso (en la rejilla de 100 m del horizonte: el bosque con dosel en sus 3 × 3
# vecinos; el prado sin dosel en los suyos y sobre el mar), el más cercano a la salida
BUSCAR = f"""(() => {{ const h = window.__graficos.horizonte, m = h.muestras; while (!m.tiene(1)) m.avanzar(1000); window.__graficos.poner('pc-3', false);
  const O = {K}.mundoJ.salida, nx = m.nx, nz = m.nz, B = m.base, X = (i) => m.rect.x0 + i * B, Z = (j) => m.rect.z0 + j * B;
  const D = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz) ? 0 : m.dosel[j * nx + i];
  const lleno = (i, j) => {{ for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!(D(i + a, j + b) > 0)) return false; return true; }};
  const nada = (i, j) => {{ for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (D(i + a, j + b) > 0) return false; return true; }};
  const sx = Math.round((O.x - m.rect.x0) / B), sz = Math.round((O.z - m.rect.z0) / B);
  for (let r = 2; r < 80; r++) for (let j = sz - r; j <= sz + r; j++) for (let i = sx - r; i <= sx + r; i++) {{
    if (Math.max(Math.abs(i - sx), Math.abs(j - sz)) !== r || !lleno(i, j)) continue;
    for (const [a, b] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {{
      const qi = i + a, qj = j + b; if (!nada(qi, qj) || !(m.alto[qj * nx + qi] > 2)) continue;
      return {{ p: [X(i) - O.x, Z(j) - O.z], q: [X(qi) - O.x, Z(qj) - O.z] }}; }} }}
  return null; }})()"""

def ir(pg, s):
    """lleva al jugador al prado y le pone mirando al bosque, a ras de suelo"""
    pg.evaluate(f"""(s => {{ const pj = {K}.pj; Object.assign(pj, {{ x: s.q[0], z: s.q[1], k: 0, vel: 0 }});
      const dx = s.p[0] - s.q[0], dz = s.p[1] - s.q[1]; pj.rot = Math.atan2(dx, dz);
      {K}.cam.yaw = Math.atan2(-dx, -dz); {K}.cam.pitch = 0.06; }})""", s)
    pg.wait_for_timeout(3000)
    pg.evaluate(f"{K}.pj.y = {K}.alturaSuelo({K}.pj.x, {K}.pj.z)")
    # el terreno y los árboles de allí, y luego las copas de cerca (del todo: en el juego van poco a poco)
    # (hasta que el terreno de cerca llega al bosque: las copas de cerca solo se ponen donde ya hay terreno)
    pg.wait_for_function(f"(s => {{ const t = {K}.mundoJ.terreno, O = {K}.mundoJ.salida; return t.alturaEn(s.p[0] + O.x, s.p[1] + O.z) !== null && t.alturaEn(s.q[0] + O.x, s.q[1] + O.z) !== null && t.faltan() === 0 && {K}.decorado.pendientes === 0; }})", arg=s, timeout=900000)
    pg.wait_for_timeout(4000)
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
        comprobar(f'{nombre}: hay un prado a 400 m de un bosque espeso', s is not None, str(s))
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
