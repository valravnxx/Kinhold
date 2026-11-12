# Prueba en navegador (Chromium sin pantalla) de la hierba densa (valravnx, 12 nov, hito «El aspecto»:
# src/mundo/hierba_densa.js). En el mundo de verdad (Whitholm), sin servidor y con ?hierba=1 (las pruebas automáticas
# van sin ella si no se pide): con un perfil que la lleva salen miles de matas alrededor del jugador y las briznas
# sueltas de antes no se dibujan; van al color del suelo (verdes, no grises ni negras); con el móvil básico no hay hierba
# densa y vuelven las briznas; al cambiar de perfil en marcha se pone y se quita; al andar, la hierba va detrás (se
# hacen las celdas nuevas y se sueltan las lejanas). Capturas en PC y móvil.
# Uso: python3 pruebas/prueba_hierba_navegador.py <html> <carpeta_capturas>
# MUTAR=1: se entra con ?hierba=0 (sin hierba densa, como antes): la prueba tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_hierba'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in os.listdir(os.path.join(RAIZ, 'docs/recursos')):   # los recursos, como en la web (de los personajes, solo los de hoy)
    if c != 'personajes': shutil.copytree(os.path.join(RAIZ, 'docs/recursos', c), f'{sitio}/recursos/{c}')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/meshy-v2'), f'{sitio}/recursos/personajes/meshy-v2')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
MUTAR = os.environ.get('MUTAR') == '1'
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&hora=13&hierba=' + ('0' if MUTAR else '1')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
CUENTA = f"(() => {{ const h = {K}.hierbaDensa; return h ? h.cuenta : null; }})()"
BRIZNAS = f"(() => {{ let n = 0; {K}.escena.traverse(o => {{ if (o.isInstancedMesh && (o.name === 'hierba' || o.name === 'hierbaCerca')) n += o.count; }}); return n; }})()"
def esperar_hierba(pg, minimo=1):
    try: pg.wait_for_function(f"{K}.hierbaDensa && {K}.hierbaDensa.cuenta.matas >= {minimo}", timeout=240000)
    except Exception: pass
    pg.wait_for_timeout(3000)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    for vista, opts, graf in (('pc', dict(viewport={'width': 1280, 'height': 800}), 'pc-1'), ('movil', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True), 'movil-2')):
        print(f'La hierba densa ({vista}, {graf})')
        pg = nav.new_page(**opts); err = []; pg.on('pageerror', lambda e: err.append(str(e)))
        pg.goto(BASE + '&graficos=' + graf)
        pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
        try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
        except Exception: pass
        esperar_hierba(pg, 500)
        c = pg.evaluate(CUENTA) or {'matas': 0, 'celdas': 0, 'triangulos': 0}
        conf = pg.evaluate(f"(() => {{ const p = window.__graficos.PERFILES.find(x => x.id === window.__graficos.perfil); return p.hierba; }})()")
        comprobar('con un perfil que la lleva, miles de matas alrededor del jugador', c['matas'] > 1000, f"{c['matas']} matas en {c['celdas']} celdas, {c['triangulos']} triángulos")
        tope = 3.1416 * (conf['radio'] + 12) ** 2 * conf['densidad'] * 1.6 if conf else 0
        comprobar('y no más de las que dice su perfil (radio y matas por metro)', 0 < c['matas'] <= tope, f"{c['matas']} de {round(tope)}")
        comprobar('las briznas sueltas de antes ya no se dibujan', pg.evaluate(BRIZNAS) == 0, str(pg.evaluate(BRIZNAS)))
        # el color: el del suelo que tienen debajo (verde: más verde que rojo y que azul), ninguna negra
        col = pg.evaluate(f"""(() => {{ let n = 0, verdes = 0, oscuras = 0; {K}.hierbaDensa.grupo.traverse(o => {{ if (!o.isInstancedMesh) return; const a = o.instanceColor.array;
          for (let i = 0; i < a.length; i += 3) {{ n++; if (a[i + 1] > a[i] && a[i + 1] > a[i + 2]) verdes++; if (a[i + 1] < 0.02) oscuras++; }} }}); return [n, verdes, oscuras]; }})()""")
        comprobar('las matas, del color del suelo: verdes y ninguna negra', col[0] > 0 and col[1] == col[0] and col[2] == 0, f'{col[1]} verdes de {col[0]}, {col[2]} negras')
        # al pie del suelo (ni flotando ni hundidas): la altura de unas cuantas, contra la del suelo
        pie = pg.evaluate(f"""(() => {{ const k = {K}; let peor = 0, n = 0; k.hierbaDensa.grupo.traverse(o => {{ if (!o.isInstancedMesh || n > 400) return; const a = o.instanceMatrix.array;
          for (let i = 0; i < Math.min(o.count, 40); i++) {{ const x = a[i * 16 + 12], y = a[i * 16 + 13], z = a[i * 16 + 14]; peor = Math.max(peor, Math.abs(y - k.alturaSuelo(x, z))); n++; }} }}); return [peor, n]; }})()""")
        comprobar('cada mata, al pie del suelo (a menos de 6 cm)', pie[1] > 50 and pie[0] < 0.06, f'la peor, a {pie[0] * 100:.1f} cm ({pie[1]} miradas)')
        pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = 0.6; k.cam.dist = 7; k.cam.pitch = 0.35; }})()"); pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/hierba_{vista}.png', timeout=180000)
        # al andar, la hierba va detrás
        pg.evaluate(f"(() => {{ const k = {K}; k.pj.x += 60; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }})()")
        try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
        except Exception: pass
        pg.wait_for_timeout(6000); esperar_hierba(pg, 300)
        lim = conf['radio'] + 30   # (las celdas se sueltan a dos celdas más allá del radio; con holgura)
        lejos = pg.evaluate(f"""(() => {{ const k = {K}; let cerca = 0, atras = 0; k.hierbaDensa.grupo.traverse(o => {{ if (!o.isInstancedMesh) return; const a = o.instanceMatrix.array;
          const d = Math.hypot(a[12] - k.pj.x, a[14] - k.pj.z); if (d < %LIM%) cerca++; else atras++; }}); return [cerca, atras]; }})()""".replace('%LIM%', str(lim)))
        comprobar('al andar 60 m, la hierba va detrás: hay celdas donde estás y se han soltado las de atrás', lejos[0] > 3 and lejos[1] == 0, f'{lejos[0]} celdas contigo, {lejos[1]} atrás')
        # el móvil básico no la lleva: vuelven las briznas; y al volver al perfil, otra vez la hierba
        pg.evaluate("window.__graficos.poner('movil-1', false)"); pg.wait_for_timeout(3000)
        c1 = pg.evaluate(CUENTA) or {'matas': 0}
        comprobar('el móvil básico no lleva hierba densa y vuelven las briznas sueltas', c1['matas'] == 0 and (MUTAR or pg.evaluate(BRIZNAS) > 0), f"{c1['matas']} matas, {pg.evaluate(BRIZNAS)} briznas")
        pg.evaluate(f"window.__graficos.poner('{graf}', false)"); esperar_hierba(pg, 300)
        c2 = pg.evaluate(CUENTA) or {'matas': 0}
        comprobar('al volver a su perfil, otra vez la hierba densa', c2['matas'] > 300 and pg.evaluate(BRIZNAS) == 0, f"{c2['matas']} matas")
        # donde se construye no hay hierba: con todo ocupado a menos de 6 m, ahí no queda ninguna mata, y más allá sí
        pg.evaluate(f"(() => {{ const k = {K}; const c = {{ x: k.pj.x, z: k.pj.z }}; window.__centroDespejar = c; k.hierbaDensa.despejar((x, z) => Math.hypot(x - c.x, z - c.z) < 6); }})()"); pg.wait_for_timeout(9000)
        des = pg.evaluate(f"""(() => {{ const k = {K}; let dentro = 0, fuera = 0; k.hierbaDensa.grupo.traverse(o => {{ if (!o.isInstancedMesh) return; const a = o.instanceMatrix.array;
          for (let i = 0; i < o.count; i++) {{ const c = window.__centroDespejar, d = Math.hypot(a[i * 16 + 12] - c.x, a[i * 16 + 14] - c.z); if (d < 5.9) dentro++; else fuera++; }} }}); return [dentro, fuera]; }})()""")
        comprobar('donde se ha construido no queda hierba, y alrededor sí', des[0] == 0 and des[1] > 300, f'{des[0]} matas dentro, {des[1]} fuera')
        comprobar('sin errores en la página', not err, '; '.join(err[:3]))
        pg.close()
    nav.close()
srv.shutdown()
print(f'\n{"HAY FALLOS: " + ", ".join(fallos) if fallos else "Todo bien"}')
sys.exit(1 if fallos else 0)
