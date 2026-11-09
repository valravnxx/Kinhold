# Prueba en navegador de las liebres (P4; src/logica/fauna.js y src/juego/fauna.js), contra el servidor de verdad con
# Whitholm, en PC y en móvil (una sola página por vista). Es la parte del recorrido de jugador de esta tarea: el jugador
# ve liebres y huyen al acercarse.
#   - al entrar le llegan las liebres de alrededor (las mueve el servidor) y se dibujan en el suelo;
#   - de lejos (a 30 m) pastan; a 17 m se ponen alerta (quietas); a 4 m, corriendo hacia ella, huye y se aleja deprisa;
#   - capturas de la liebre vista desde el jugador: pastando, alerta y huyendo (las de cerca del modelo, aparte).
# Uso: python3 pruebas/prueba_fauna_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el navegador no dibuja las liebres que llegan: tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_fauna'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(nombre, ok, detalle=''):
    print(('  OK   ' if ok else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not ok: fallos.append(nombre)
def esperar(pg, cond, ms=30000, arg=None):
    try: pg.wait_for_function(cond, arg=arg, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
# las liebres que se dibujan: id, dónde (el modelo), qué hace y si está en el suelo
LIEBRES = f"""() => [...{K}.fauna.liebres.entries()].map(([id, l]) => ({{ id, ox: l.obj.x, oz: l.obj.z, x: l.m.raiz.position.x, y: l.m.raiz.position.y, z: l.m.raiz.position.z, anim: l.anim, suelo: {K}.alturaSuelo(l.m.raiz.position.x, l.m.raiz.position.z), visible: l.m.raiz.visible }}))"""
UNA = f"""(id) => {{ const l = {K}.fauna.liebres.get(id); return l ? {{ x: l.m.raiz.position.x, z: l.m.raiz.position.z, anim: l.anim, ox: l.obj.x, oz: l.obj.z }} : null; }}"""
# pone al jugador en (x, z) y espera a que siga allí (justo al entrar, el juego aún puede colocarlo en su sitio)
def poner(pg, x, z, giro=None):
    for _ in range(4):
        pg.evaluate(f"(() => {{ const k = {K}; Object.assign(k.pj, {{ x: {x}, z: {z}, vel: 0 }}); {'' if giro is None else f'k.pj.rot = {giro};'} }})()")
        pg.wait_for_timeout(3000)
        if pg.evaluate(f"Math.hypot({K}.pj.x - ({x}), {K}.pj.z - ({z})) < 1"): return True
    return False
# la cámara detrás del jugador, baja y cerca, mirando hacia la liebre (a: de la liebre al jugador)
def camara_hacia(pg, a, dist=2.4, pitch=0.12):
    pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {a}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; k.pj.rot = {a} + Math.PI; }})()")
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR: ctx.add_init_script('window.__mutarFauna = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'liebres' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea', listo)
            hay = esperar(pg, f"{K}.fauna && {K}.fauna.liebres.size > 0", 60000)
            ls = pg.evaluate(LIEBRES) if hay else []
            comprobar(f'{nombre}: llegan las liebres de alrededor y se dibujan', hay and len(ls) > 0, f'{len(ls)}')
            if not ls:
                ctx.close(); continue
            yo = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            l = min(ls, key=lambda q: math.hypot(q['ox'] - yo[0], q['oz'] - yo[1]))
            # de lejos (30 m): pasta, en el suelo
            a = math.atan2(yo[0] - l['ox'], yo[1] - l['oz'])
            poner(pg, l['ox'] + math.sin(a) * 30, l['oz'] + math.cos(a) * 30)
            pg.wait_for_timeout(6000)
            esperar(pg, f"(id) => {{ const l = {K}.fauna.liebres.get(id); return l && l.m.raiz.visible && Math.hypot(l.m.raiz.position.x - l.obj.x, l.m.raiz.position.z - l.obj.z) < 1; }}", 60000, l['id'])
            u = pg.evaluate(UNA, l['id'])
            comprobar(f'{nombre}: de lejos pasta (o da saltitos)', u and u['anim'] in ('pastar', 'saltar'), json.dumps(u))
            l2 = next(q for q in pg.evaluate(LIEBRES) if q['id'] == l['id'])
            comprobar(f'{nombre}: se ve, en el suelo', l2['visible'] and abs(l2['x']) + abs(l2['z']) > 0 and abs(l2['y'] - l2['suelo']) < 0.05, json.dumps(l2))
            camara_hacia(pg, a)
            pg.wait_for_timeout(6000)
            captura(pg, f'{SALIDA}/{nombre}_liebre_pasta.png')
            # a 17 m: alerta, quieta
            u = pg.evaluate(UNA, l['id'])
            poner(pg, u['ox'] + math.sin(a) * 17, u['oz'] + math.cos(a) * 17)
            alerta = esperar(pg, f"(id) => {{ const l = {K}.fauna.liebres.get(id); return l && l.anim === 'alerta'; }}", 15000, l['id'])
            comprobar(f'{nombre}: a 17 m se pone alerta', alerta, json.dumps(pg.evaluate(UNA, l['id'])))
            camara_hacia(pg, a)
            pg.wait_for_timeout(6000)
            captura(pg, f'{SALIDA}/{nombre}_liebre_alerta.png')
            # a 4 m: huye y se aleja deprisa (lo dice el servidor; el navegador la mueve)
            u = pg.evaluate(UNA, l['id'])
            # (lo que hace la liebre, apuntado cada 100 ms: a un fotograma por segundo, la huida puede acabar entre dos miradas)
            pg.evaluate(f"(id) => {{ window.__animsLiebre = new Set(); setInterval(() => {{ const l = {K}.fauna.liebres.get(id); if (l) window.__animsLiebre.add(l.anim); }}, 100); }}", l['id'])
            poner(pg, u['ox'] + math.sin(a) * 4, u['oz'] + math.cos(a) * 4, a + math.pi)
            pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {a}; k.cam.pitch = 0.3; k.cam.dist = 6; }})()")
            huye = esperar(pg, "window.__animsLiebre.has('huir')", 15000)
            comprobar(f'{nombre}: a 4 m huye', huye, json.dumps(pg.evaluate(UNA, l['id'])))
            captura(pg, f'{SALIDA}/{nombre}_liebre_huye.png')
            pg.wait_for_timeout(4000)
            u2 = pg.evaluate(UNA, l['id']); pj = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            lejos = u2 and math.hypot(u2['ox'] - pj[0], u2['oz'] - pj[1])
            comprobar(f'{nombre}: se aleja deprisa (más de 15 m en unos segundos)', bool(lejos and lejos > 15), f'{lejos}')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
