# Prueba en navegador: construir a la altura del suelo en el mundo de verdad (valravnx, 30 oct: «lo que se coloque se
# coloque a la altura del suelo, no de la línea de altura 0, y que los suelos de base alisen el suelo de abajo»).
# Uso: python3 pruebas/prueba_nivelado_navegador.py <html de la demo> <carpeta_capturas>
# En PC y en móvil, en una ladera de Whitholm (lejos de la salida, que es llana): el mojón en el suelo; dos cimientos y
# un muro: la construcción queda a la altura del suelo donde empieza y el terreno de debajo de los cimientos sale llano
# a esa altura (en la malla que se ve), y el de lejos, como antes; una cerca, a ras del suelo de su sitio; el
# personaje pisa el cimiento; la brocha redonda alisa un círculo. Capturas de cerca: la ladera antes y después.
# MUTAR=1: los cimientos no alisan el suelo (se quitan las marcas antes de rehacer los trozos): tiene que fallar.
import sys, os, re, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_nivelado'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos/personajes')):
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o) and (c in ('v1', 'taller-anim-v1', 'taller-carga-v1') or re.fullmatch(r'taller-v\d+', c)): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR', '')
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# una ladera suave (de 10 a 35 cm por metro en 6 m alrededor), en tierra seca y andable, a menos de 380 m de la salida (más allá, seco() no mira los ríos)
LADERA = """(() => {
  const k = window.__kinhold, m = k.mundoJ, h = (x, z) => m.altura(x, z);
  let mejor = null;
  for (let r = 40; r < 380 && !mejor; r += 8) for (let a = 0; a < 6.283 && !mejor; a += 0.15) {
    const x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
    if (!m.seco(x, z) || m.sobreMar(x, z) < 3) continue;
    const gx = (h(x + 3, z) - h(x - 3, z)) / 6, gz = (h(x, z + 3) - h(x, z - 3)) / 6, g = Math.hypot(gx, gz);
    if (g < 0.1 || g > 0.35) continue;
    let ok = true;
    for (let b = -8; b <= 8 && ok; b += 4) for (let c = -8; c <= 8 && ok; c += 4) if (!m.seco(x + b, z + c)) ok = false;
    if (ok && !k.obstaculos.some(o => Math.hypot(o.x - x, o.z - z) < 5)) mejor = { x, z, g };
  }
  return mejor;
})()"""
ESPERAR_TERRENO = f"{K}.mundoListo && {K}.mundoJ.terreno.faltan() === 0"

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
        print('Vista', nombre)
        ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
        pg = ctx.new_page()
        err = []
        pg.on('pageerror', lambda e: err.append(str(e)))
        pg.on('console', lambda m: err.append(m.text) if m.type == 'error' else None)
        pg.goto(URL)
        pg.wait_for_function('window.__demo && (window.__demo.listo || window.__demo.error)', timeout=240000)
        comprobar('la demo arranca sin error', not pg.evaluate('window.__demo.error'), str(pg.evaluate('window.__demo.error')))
        pg.wait_for_function(f'{K}.mundoListo', timeout=240000)
        pg.evaluate(f'{K}.reiniciar()')
        lad = pg.evaluate(LADERA)
        comprobar('hay una ladera suave cerca de la salida', bool(lad), json.dumps(lad))
        if not lad: ctx.close(); continue
        X, Z = lad['x'], lad['z']
        print('  ladera en', X, Z, 'pendiente', round(lad['g'], 3))
        # al sitio: el jugador, un poco más abajo, y la cámara mirando la ladera de lado
        # la cámara detrás del personaje, mirando hacia la obra (que va más allá de él)
        ENCUADRE = f'([x, z]) => {{ const k = {K}; k.pj.x = x - 3; k.pj.z = z + 5; k.pj.k = 0; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.cam.yaw = Math.atan2(-4, 6); k.cam.pitch = 0.32; k.cam.dist = 9; }}'
        pg.evaluate(ENCUADRE, [X + 1, Z + 1])
        pg.wait_for_function(ESPERAR_TERRENO, timeout=240000); pg.wait_for_timeout(1200)
        base = pg.evaluate(f'([x, z]) => {{ const m = {K}.mundoJ, r = []; for (const [a, b] of [[0, 0], [2, 0], [0, 2], [2, 2], [-1, 3], [12, -9], [-11, 10]]) r.push(m.altura(x + a, z + b)); return r; }}', [X, Z])
        pg.screenshot(path=f'{SALIDA}/{nombre}_ladera_antes.png')

        # el mojón, en el suelo
        pg.evaluate(f"([x, z]) => {{ const k = {K}; k.cambiarModo('construir'); k.accion({{ tipo: 'rellenar', cantidad: 50 }}); k.seleccionar('mojon', 'mojon'); k.apuntar(x - 3, z + 3); k.colocar(); }}", [X, Z])
        mj = pg.evaluate(f'(() => {{ const k = {K}, g = k.escena.children.find(o => o.name === "mojon") || null; return {{ mojon: k.mundo.mojon }}; }})()')
        comprobar('el mojón se pone', bool(mj['mojon']), json.dumps(mj))
        # dos cimientos y un muro encima de uno, empezando en (X, Z)
        r = pg.evaluate(f"""([x, z, mutar]) => {{ const k = {K}, res = [];
          k.estado.rotLibre = 0;
          k.seleccionar('pieza', 'cim_piedra'); k.apuntar(x, z); res.push(k.estado.candidato && k.estado.candidato.v.ok); k.colocar();
          k.apuntar(x + 2, z); k.colocar();
          k.apuntar(x, z + 2); k.colocar();
          k.seleccionar('pieza', 'cerca'); k.apuntar(x + 7, z - 0.02); k.colocar();
          k.terminarObras();
          k.seleccionar('pieza', 'muro_tronco'); k.apuntar(x + 1, z - 1); k.colocar();
          k.terminarObras();
          if (mutar) {{ k.mundo.nivelados.length = 0; k.reconstruir(); }}
          const c = k.mundo.construcciones[0];
          return {{ n: k.mundo.construcciones.length, piezas: c ? [...c.piezas.values()].map(p => p.tipo + (p.obra ? '*' : '')) : [], oy: c ? c.oy : null,
            nivelados: k.mundo.nivelados.length, primera: res[0], grupoY: k.escena.getObjectByName ? null : null }};
        }}""", [X, Z, MUTAR == '1'])
        print('  ', json.dumps(r))
        comprobar('la construcción se pone (cimientos, cerca y muro, terminados)', r['n'] >= 1 and len(r['piezas']) >= 4 and not any('*' in t for t in r['piezas']), json.dumps(r['piezas']))
        comprobar('la construcción queda a la altura del suelo donde empieza (no a 0)', r['oy'] is not None and abs(r['oy'] - base[0]) < 0.05 and max(base[:5]) - min(base[:5]) > 0.2, f"oy {r['oy']}, suelo {base[0]:.3f}, desnivel debajo {max(base[:5]) - min(base[:5]):.2f} m")
        pg.wait_for_timeout(500)
        pg.wait_for_function(ESPERAR_TERRENO, timeout=240000); pg.wait_for_timeout(800)
        d = pg.evaluate(f"""([x, z]) => {{ const k = {K}, m = k.mundoJ, c = k.mundo.construcciones[0], h = (a, b) => m.terreno.alturaEn(a + m.salida.x, b + m.salida.z) - m.y0;
          const pts = [[0, 0], [2, 0], [0, 2], [-0.8, 0.8], [2.8, -0.8], [0.8, 2.8]].map(([a, b]) => h(x + a, z + b) - c.oy);
          // el grupo de la construcción en la escena (su altura) y la cerca (a ras de su suelo)
          let gy = null, cy = null, cerca = null;
          for (const r of k.escena.children) for (const g of r.children || []) if (g.userData && g.userData.c === c) {{ gy = g.position.y; for (const o of g.children) if (o.userData.key && o.userData.key.startsWith('e:') && c.piezas.get(o.userData.key).tipo === 'cerca') {{ const w = new (o.position.constructor)(); o.getWorldPosition(w); cy = w.y; cerca = [w.x, w.z]; }} }}
          return {{ pts, lejos: [h(x + 12, z - 9), h(x - 11, z + 10)], gy, cy, sueloCerca: cerca && k.alturaSuelo(cerca[0], cerca[1]) }};
        }}""", [X, Z])
        print('  ', json.dumps(d))
        comprobar('el terreno de debajo de los cimientos sale llano a su altura (malla que se ve)', max(abs(v) for v in d['pts']) < 0.03, json.dumps([round(v, 3) for v in d['pts']]))
        comprobar('el terreno de lejos, como antes', abs(d['lejos'][0] - base[5]) < 0.05 and abs(d['lejos'][1] - base[6]) < 0.05, f"{d['lejos']} / {base[5:]}")
        comprobar('la construcción se dibuja a su altura', d['gy'] is not None and abs(d['gy'] - r['oy']) < 1e-6, str(d['gy']))
        comprobar('la cerca, a ras del suelo de su sitio', d['cy'] is not None and abs(d['cy'] - d['sueloCerca']) < 0.06, f"{d['cy']} / {d['sueloCerca']}")
        # el personaje sobre el cimiento
        pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 2; k.pj.z = z; }}', [X, Z])
        # la altura del personaje va hacia la del suelo poco a poco (por fotogramas): sin tarjeta gráfica, a 1 o 2 fps,
        # tarda; se espera a que se quede quieta (como mucho 30 s)
        y, antes = pg.evaluate(f'{K}.pj.y'), None
        for _ in range(30):
            pg.wait_for_timeout(1000); antes, y = y, pg.evaluate(f'{K}.pj.y')
            if abs(y - antes) < 0.001: break
        comprobar('el personaje pisa el cimiento (a la altura de la construcción)', abs(y - r['oy']) < 0.6 and y > r['oy'] - 0.01, f'{y:.3f} / oy {r["oy"]:.3f}')
        # la captura de cerca, con el personaje fuera, mirando la obra de lado
        pg.evaluate(f'{K}.cambiarModo("mover")'); pg.evaluate(ENCUADRE, [X + 1, Z + 1]); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_ladera_cimientos.png')
        # la brocha redonda: alisa un círculo de 2 m a 30 cm por encima del suelo de su centro
        bx, bz = X - 6, Z - 4
        b = pg.evaluate(f"""([x, z]) => {{ const k = {K}, y = k.mundoJ.altura(x, z) + 0.3; const r = k.accion({{ tipo: 'nivelar', x, z, y, radio: 2 }}); k.reconstruir(); return {{ ok: r.ok, y }}; }}""", [bx, bz])
        pg.wait_for_timeout(300); pg.wait_for_function(ESPERAR_TERRENO, timeout=240000)
        hb = pg.evaluate(f'([x, z]) => {{ const m = {K}.mundoJ; return [m.altura(x, z), m.altura(x + 1.2, z - 1)]; }}', [bx, bz])
        comprobar('la brocha alisa un círculo a su altura', b['ok'] and abs(hb[0] - b['y']) < 0.03 and abs(hb[1] - b['y']) < 0.03, f"{hb} / {b['y']:.3f}")
        malos = [e for e in err if 'favicon' not in e]
        comprobar('sin errores en la página', not malos, '; '.join(malos[:3]))
        ctx.close()
    nav.close()

print(f'\n{len(fallos)} fallos' if fallos else '\nTodo bien')
sys.exit(1 if fallos else 0)
