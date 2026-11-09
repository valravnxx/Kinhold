# Prueba en navegador del modo arma con lo que llevas en la mano (valravnx, 9 nov; src/logica/arma_mano.js,
# src/juego/combate_mundo.js, src/combate/modelos.js), contra el servidor de verdad con Whitholm, en PC y en móvil:
#   - con las manos vacías, el modo arma es a puños (sin nada en la mano del modelo);
#   - con el hacha de piedra en la mano, su arma es el hacha y se ve el hacha en la mano;
#   - con la lanza endurecida, su arma es la lanza y se ve la lanza; sale el botón «Lanzar»;
#   - se acerca andando a una liebre, coge impulso y la lanza apuntando a ella: sale de la mano y se ve volar; alguna de
#     las que lanza la mata (la dice el servidor): la liebre muerta y la lanza quedan en el suelo;
#   - capturas: la lanza en la mano en el modo arma, cogiendo impulso, y la liebre cazada.
# Uso: python3 pruebas/prueba_caza_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el modo arma sigue con la espada larga (no mira la mano): tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_caza'
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
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_ARCON': 'si'},
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
EN_SUELO = f"(t) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t).map(o => ({{ id: o.id, x: o.x, z: o.z }}))"
EN_SUELO = f"(t) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t).map(o => ({{ id: o.id, x: o.x, z: o.z }}))"
CB = f"{K}.combate"
def arma(pg): return pg.evaluate(f"(() => {{ const c = {CB}; return {{ arma: c.L && c.L.arma, objeto: c.modelo && c.modelo.userData.objeto, piezas: c.modelo && c.modelo.userData.arma ? c.modelo.userData.arma.children.length : -1, lanzar: !document.getElementById('cmbLanzar').hidden }}; }})()")
def coger(pg, objeto):
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: '{objeto}', cantidad: 1, a: 'mano:der' }})")
    return esperar(pg, f"(() => {{ const c = {K}.inventario.lugares['mano:der']; return !!c && c.tipo === '{objeto}'; }})()", 10000)
def soltar(pg):
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'soltar', de: 'mano:der' }})")
    esperar(pg, f"!{K}.inventario.lugares['mano:der']", 10000)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'arma' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta') && {K}.objetosRed && {K}.objetosRed.deServidor", 300000)
            comprobar(f'{nombre}: en línea', listo)
            if MUTAR: pg.evaluate(f"(() => {{ const c = {CB}, s = c.sacar; c.sacar = () => {{ s(); c.L.arma = 'espada_larga'; }}; }})()")
            # con las manos vacías: puños
            pg.evaluate(f"{CB}.sacar()"); pg.wait_for_timeout(1500)
            a = arma(pg)
            comprobar(f'{nombre}: con las manos vacías, a puños (nada en la mano)', a['arma'] == 'punos' and a['objeto'] is None and a['piezas'] == 0 and not a['lanzar'], str(a))
            pg.evaluate(f"{CB}.guardar()")
            # con el hacha de piedra
            coger(pg, 'hacha_piedra')
            pg.evaluate(f"{CB}.sacar()"); pg.wait_for_timeout(1500)
            a = arma(pg)
            comprobar(f'{nombre}: con el hacha de piedra en la mano, el hacha (y se ve en la mano)', a['arma'] == 'hacha' and a['objeto'] == 'hacha_piedra' and a['piezas'] > 0, str(a))
            pg.evaluate(f"{CB}.guardar()"); soltar(pg)
            # con la lanza
            coger(pg, 'lanza_endurecida')
            pg.evaluate(f"{CB}.sacar()"); pg.wait_for_timeout(1500)
            a = arma(pg)
            comprobar(f'{nombre}: con la lanza en la mano, la lanza (se ve, y sale el botón Lanzar)', a['arma'] == 'lanza' and a['objeto'] == 'lanza_endurecida' and a['piezas'] > 0 and a['lanzar'], str(a))
            hay = esperar(pg, f"{K}.fauna && {K}.fauna.liebres.size > 0", 60000)
            ls = pg.evaluate(LIEBRES) if hay else []
            comprobar(f'{nombre}: llegan las liebres de alrededor', len(ls) > 0, f'{len(ls)}')
            if not ls:
                ctx.close(); continue
            yo = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            l = min(ls, key=lambda q: math.hypot(q['ox'] - yo[0], q['oz'] - yo[1]))
            # a 18 m de golpe (no la asusta) y luego andando despacio hasta unos 10 m
            ang = math.atan2(yo[0] - l['ox'], yo[1] - l['oz'])
            poner(pg, l['ox'] + math.sin(ang) * 18, l['oz'] + math.cos(ang) * 18)
            pg.evaluate(f"""(id) => new Promise(r => {{ const k = {K}, t = setInterval(() => {{ const q = k.fauna.liebres.get(id); if (!q) {{ clearInterval(t); r(); return; }}
              const d = Math.hypot(q.obj.x - k.pj.x, q.obj.z - k.pj.z); if (d <= 10.5) {{ clearInterval(t); r(); return; }}
              k.pj.x += (q.obj.x - k.pj.x) / d * 0.2; k.pj.z += (q.obj.z - k.pj.z) / d * 0.2; }}, 100); }})""", l['id'])
            pg.wait_for_timeout(1500)
            pg.evaluate(f"window.__vuelan = 0; setInterval(() => {{ window.__vuelan = Math.max(window.__vuelan, {CB}.vuelos.length); }}, 30)")
            muerta = False; salio = True; lanzadas = 0
            for k in range(8):
                u = pg.evaluate(UNA, l['id'])
                if not u: break
                if k > 0: coger(pg, 'lanza_endurecida'); pg.wait_for_timeout(500)
                pj = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
                pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {math.atan2(pj[0] - u['ox'], pj[1] - u['oz'])}; k.pj.rot = k.cam.yaw + Math.PI; }})()")
                pg.evaluate(f"{CB}.empezarTiro()")
                pg.wait_for_timeout(1200)
                if k == 0: captura(pg, f'{SALIDA}/{nombre}_lanza_impulso.png')
                y = pg.evaluate(f"{K}.alturaSuelo({u['ox']}, {u['oz']})")
                pg.evaluate(f"{CB}.soltarTiro({{ x: {u['ox']}, y: {y}, z: {u['oz']} }})"); lanzadas += 1
                if not esperar(pg, f"!{K}.inventario.lugares['mano:der']", 5000): salio = False
                if esperar(pg, f"(id) => !{K}.fauna.liebres.has(id) && {K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'liebre')", 4000, l['id']): muerta = True; break
            comprobar(f'{nombre}: al lanzarla sale de la mano', salio)
            comprobar(f'{nombre}: y se ve volar', pg.evaluate("window.__vuelan > 0"))
            comprobar(f'{nombre}: alguna de las que lanza mata la liebre (lo dice el servidor): muerta en el suelo, con la lanza', muerta and len(pg.evaluate(EN_SUELO, 'lanza_endurecida')) > 0, f'{lanzadas} lanzadas')
            if muerta:
                m = sorted(pg.evaluate(EN_SUELO, 'liebre'), key=lambda o: math.hypot(o['x'] - u['ox'], o['z'] - u['oz']))[0]
                pg.evaluate(f"{CB}.guardar()")
                poner(pg, m['x'] + 1.6, m['z'] + 0.4)
                pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {math.atan2(1.6, 0.4)}; k.cam.pitch = 0.55; k.cam.dist = 1.8; }})()")
                pg.wait_for_timeout(5000)
                captura(pg, f'{SALIDA}/{nombre}_liebre_cazada.png')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
