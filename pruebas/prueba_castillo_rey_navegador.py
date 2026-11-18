# Prueba en navegador (Chromium sin pantalla): el castillo del rey se recorre andando en el juego de verdad, con su
# movimiento (src/juego/main.js) y sus choques (src/logica/castillo_rey.js): los recorridos de
# pruebas/datos/recorrido_castillo_rey.json (los escribe herramientas/castillo_rey/ruta.py): el del que ataca (de la calle
# a la cámara del alcaide, por la barbacana, el puente, la puerta, los patios, la escalera del homenaje y su caracol), el de
# la guardia (la torre AB, su caracol y el adarve hasta la torre A), el de la puerta (el caracol de la guardia hasta la
# terraza y el adarve) y el de la poterna (su escalera por el acantilado hasta el pantalán). Se guía la cámara hacia cada
# punto y se anda con W; en cada punto con nombre, la altura tiene que ser la que toca. Capturas en algunos.
# Uso: python3 pruebas/prueba_castillo_rey_navegador.py dist/kinhold_demo.html <carpeta> [ruta ruta…]
# MUTAR=1: el castillo se ve pero no se pisa ni para el paso (window.__mutarCastillo): tiene que fallar.
import sys, os, json, time
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
AQUI = os.path.dirname(os.path.abspath(__file__))
RUTAS = json.load(open(os.path.join(AQUI, 'datos', 'recorrido_castillo_rey.json')))
SOLO = sys.argv[3:] or list(RUTAS)
FOTOS = {'dentro de la barbacana', 'en el paso de la puerta', 'en la sala del homenaje', 'en la cámara del alcaide', 'en el adarve', 'en el cuarto de la guardia', 'en la terraza de la puerta', 'en el muelle'}
S = RUTAS['atacante'][0]
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida={round(S[0])},{round(S[1])}&lang=es&hora=11&graficos=movil-1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
# anda la ruta guiando la cámara en cada fotograma; en los puntos de caracol («~»), despacio y más fino
ANDAR = """([ruta, fotos]) => new Promise((ok) => {
  const k = window.__kinhold; let i = 0, quieto = 0, ult = null; const log = [];
  dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
  const paso = () => {
    const pj = k.pj, [tx, tz, ey, nombre] = ruta[i];
    const fino = nombre === '~' || (ruta[i + 1] && ruta[i + 1][3] === '~');
    window.__dtMax = fino ? 0.03 : 0.1;
    const dx = tx - pj.x, dz = tz - pj.z, d = Math.hypot(dx, dz);
    if (d < (fino ? 0.1 : 0.3)) {
      if (nombre && nombre !== '~') log.push({ i, nombre, y: pj.y, ey });
      i++; quieto = 0;
      if (i >= ruta.length || (nombre && fotos.includes(nombre))) { dispatchEvent(new KeyboardEvent('keyup', { key: 'w' })); ok({ log, i, fin: i >= ruta.length, foto: nombre }); return; }
    } else {
      k.cam.yaw = Math.atan2(-dx, -dz);
      const p = pj.x.toFixed(2) + ',' + pj.z.toFixed(2);
      quieto = p === ult ? quieto + 1 : 0; ult = p;
      if (quieto > 40) { dispatchEvent(new KeyboardEvent('keyup', { key: 'w' })); log.push({ i, nombre, atascado: true, y: pj.y, x: pj.x, z: pj.z, d }); ok({ log, i, fin: false, atascado: true }); return; }
    }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
})"""

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''), flush=True)
    if not cond: fallos.append(nombre)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 640, 'height': 400}, locale='es-ES')
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(URL)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=900000)
    pg.wait_for_function(f"{K}.castillo && {K}.castillo.estado !== 'lejos' && {K}.castillo.estado !== 'cargando'", timeout=300000)
    comprobar('el castillo del rey se carga al acercarse', pg.evaluate(f"{K}.castillo.estado") == 'listo')
    if os.environ.get('MUTAR') == '1': pg.evaluate('window.__mutarCastillo = true')
    O = pg.evaluate(f'{K}.mundoJ.salida'); y0 = pg.evaluate(f'{K}.mundoJ.y0')
    for nombreRuta in SOLO:
        r = [[x - O['x'], z - O['z'], (None if ey is None else ey - y0), n] for x, z, ey, n in RUTAS[nombreRuta]]
        # al principio de la ruta (en el suelo)
        pg.evaluate(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: {r[0][0]}, z: {r[0][1]}, k: 0 }}); k.pj.y = k.decorado.altura({r[0][0]}, {r[0][1]}); }})()")
        pg.wait_for_timeout(1500)
        t0 = time.time(); i = 1; mal = []
        while i < len(r):
            res = pg.evaluate(ANDAR, [r[i:], sorted(FOTOS)])
            for e in res['log']:
                if e.get('atascado'): mal.append(f"atascado antes de «{r[i + e['i']][3] or '#' + str(i + e['i'])}» a {e['d']:.2f} m"); continue
                if e['ey'] is not None and abs(e['y'] - e['ey']) > 0.3: mal.append(f"en «{e['nombre']}» a {e['y'] + y0:.2f} m (tocaba {e['ey'] + y0:.2f})")
            if res.get('foto'):
                pg.wait_for_timeout(1200)
                pg.screenshot(path=f"{SALIDA}/castillo_{nombreRuta}_{res['foto'].replace(' ', '_')}.png", timeout=600000)
            if res.get('atascado'): break
            i += res['i']
        comprobar(f'recorrido «{nombreRuta}» entero andando, sin atascarse ni caerse', not mal and i >= len(r), '; '.join(mal[:4]) + f' ({round(time.time() - t0)} s)')
    comprobar('sin errores en la página', not errores, '; '.join(errores[:3]))
    nav.close()
srv.shutdown()
print('TODO BIEN' if not fallos else f'FALLAN {len(fallos)}: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
