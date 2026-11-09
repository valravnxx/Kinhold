# Prueba en navegador de los ríos de verdad (valravnx, 5 nov): un arroyo, un río de los anchos y una unión de un
# afluente, en PC y en móvil, con capturas desde la orilla. Comprueba en el mundo del juego (el de la demo, con su
# terreno y su agua) que el agua va seguida por el cauce (antes salía «agua a ratos») andando por el centro del río
# 60 m río arriba y 60 m río abajo, y en la unión, desde el afluente hasta el río al que entra; y que hay agua donde
# está el río. Las capturas son para mirarlas (el lecho de piedra y grava, el ancho y la orilla).
# Uso: python3 pruebas/prueba_rios_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el agua del río solo en la mitad de los sitios (como «a ratos»): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, json
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_rios'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos/personajes')):
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
# las imágenes de lo que llevas (la barra de abajo) y el kit de la interfaz, como en la web
import re as _rk
for _c in _rk.findall(r"CARPETA_(?:ICONOS|INTERFAZ|FUENTES) = '([^']+)'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()):
    if not os.path.exists(f'{sitio}/{_c}'): shutil.copytree(os.path.join(RAIZ, 'docs', _c), f'{sitio}/{_c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR', '')
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
# los sitios (m del mundo, Whitholm), con la salida más cercana: un arroyo de unos 6 m, un río de unos 14 m y la unión
# de un afluente (el punto donde acaba, en el cauce del otro)
SITIOS = [
    {'n': 'arroyo', 'x': 217109, 'z': 46918, 'salida': 26},
    {'n': 'rio', 'x': 195888, 'z': 65144, 'salida': 168},
    {'n': 'union', 'x': 197421, 'z': 55080, 'salida': 66},
]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# andar por el centro del río siguiendo la corriente (río arriba y río abajo) y contar dónde hay agua
SEGUIR = """([x, z, pasos, mutar]) => { const k = window.__kinhold, m = k.mundoJ; let hay = 0, n = 0, secos = [];
  for (const sentido of [1, -1]) { let px = x, pz = z;
    for (let i = 0; i < pasos; i++) { const a = m.aguaEn(px, pz); n++;
      if (a && !(mutar && i % 2)) hay++; else if (secos.length < 6) secos.push([Math.round(px), Math.round(pz)]);
      const c = a && Math.hypot(a.dx, a.dz) > 1e-6 ? a : null;
      let dx, dz; if (c) { const l = Math.hypot(c.dx, c.dz); dx = c.dx / l; dz = c.dz / l; }
      else { const pa = m.paisaje, xm = px + m.salida.x, zm = pz + m.salida.z, tr = pa.riosEn(xm - 200, zm - 200, xm + 200, zm + 200), co = pa.corriente(xm, zm, tr); const l = Math.hypot(co.dx, co.dy) || 1; dx = co.dx / l; dz = co.dy / l; }
      px += dx * sentido; pz += dz * sentido; } }
  return { hay, n, secos }; }"""

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        for s in SITIOS:
            print('Vista', nombre, s['n'])
            ctx = nav.new_context(viewport=vista, device_scale_factor=1, is_mobile=movil, has_touch=movil)
            pg = ctx.new_page(); err = []
            pg.on('pageerror', lambda e: err.append(str(e)))
            pg.goto(f"{BASE}&salida={s['salida']}")
            pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=300000)
            pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
            # el punto del río en la escena, su ancho y la orilla (a un lado del cauce, mirando al agua)
            r = pg.evaluate(f"""([xm, zm]) => {{ const k = {K}, m = k.mundoJ, pa = m.paisaje, tr = pa.riosEn(xm - 300, zm - 300, xm + 300, zm + 300);
              const c = pa.rioCerca(xm, zm, tr), co = pa.corriente(xm, zm, tr), l = Math.hypot(co.dx, co.dy) || 1, nx = -co.dy / l, nz = co.dx / l;
              const x = xm - m.salida.x, z = zm - m.salida.z, off = c.ancho / 2 + 3;
              k.pj.x = x + nx * off; k.pj.z = z + nz * off; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z);
              k.cam.yaw = Math.atan2(nx, nz); k.cam.pitch = 0.42; k.cam.dist = Math.max(10, c.ancho * 1.3);
              return {{ x, z, ancho: c.ancho, dm: c.dm }}; }}""", [s['x'], s['z']])
            try:
                pg.wait_for_function(f'{K}.mundoListo && {K}.decorado.pendientes === 0 && Math.hypot({K}.decorado.centro.x - {K}.pj.x, {K}.decorado.centro.z - {K}.pj.z) < 1', timeout=240000)
            except Exception: print('  (el decorado no ha acabado de ponerse a tiempo)')
            pg.wait_for_timeout(4000)
            print('  decorado:', json.dumps(pg.evaluate(f'(() => {{ const d = {K}.decorado; return {{ centro: d.centro, pendientes: d.pendientes, cuenta: d.cuenta, pj: [{K}.pj.x, {K}.pj.z] }}; }})()')))
            a = pg.evaluate(f'([x, z]) => {K}.mundoJ.aguaEn(x, z)', [r['x'], r['z']])
            comprobar(f"{s['n']}: hay agua en el río (de {r['ancho']:.1f} m de ancho)", bool(a) and a['hondo'] > 0.1, json.dumps(a))
            seg = pg.evaluate(SEGUIR, [r['x'], r['z'], 60, MUTAR == '1'])
            comprobar(f"{s['n']}: el agua va seguida por el cauce, 60 m arriba y abajo (nada de agua a ratos)", seg['hay'] >= seg['n'] * 0.97, f"{seg['hay']} de {seg['n']} · secos en {seg['secos']}")
            pg.screenshot(path=f"{SALIDA}/{nombre}_{s['n']}.png")
            comprobar(f"{s['n']}: sin errores en la página", not err, '; '.join(err[:3]))
            ctx.close()
    nav.close()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
