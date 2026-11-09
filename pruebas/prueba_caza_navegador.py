# Prueba en navegador de cazar con la lanza endurecida (P4; src/logica/caza.js, src/juego/fauna.js y src/juego/suelo.js),
# contra el servidor de verdad con Whitholm, en PC y en móvil. Es la parte de esta tarea que ve el jugador:
#   - con la lanza en la mano y una liebre a tiro delante (alerta, a 17 m), Usar dice «Lanzar la lanza»;
#   - al lanzarla sale de la mano y se ve volar hacia la liebre (la dibuja el navegador con lo que dice el servidor);
#   - el servidor decide que acierta: la liebre sale de las vivas y en el suelo quedan la liebre muerta y la lanza;
#   - capturas: la lanza en vuelo y, de cerca, la liebre muerta y la lanza en la hierba.
# Uso: python3 pruebas/prueba_caza_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el navegador no dibuja la lanza que vuela: tiene que fallar.
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
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR: ctx.add_init_script('window.__mutarLanza = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'caza' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea', listo)
            hay = esperar(pg, f"{K}.fauna && {K}.fauna.liebres.size > 0", 60000)
            ls = pg.evaluate(LIEBRES) if hay else []
            comprobar(f'{nombre}: llegan las liebres de alrededor', len(ls) > 0, f'{len(ls)}')
            if not ls:
                ctx.close(); continue
            # la lanza a la mano (del arcón de pruebas: la de verdad se hace en la hoguera, en el recorrido)
            esperar(pg, f"{K}.objetosRed && {K}.objetosRed.deServidor", 30000)
            pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'lanza_endurecida', cantidad: 1, a: 'mano:der' }})")
            comprobar(f'{nombre}: (la lanza en la mano)', esperar(pg, f"(() => {{ const c = {K}.inventario.lugares['mano:der']; return !!c && c.tipo === 'lanza_endurecida'; }})()", 10000))
            yo = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            l = min(ls, key=lambda q: math.hypot(q['ox'] - yo[0], q['oz'] - yo[1]))
            a = math.atan2(yo[0] - l['ox'], yo[1] - l['oz'])
            # a 14 m, andando, de cara a ella: se pone alerta (quieta)
            for _ in range(3):
                u0 = pg.evaluate(UNA, l['id']) or {'ox': l['ox'], 'oz': l['oz']}
                poner(pg, u0['ox'] + math.sin(a) * 17, u0['oz'] + math.cos(a) * 17, a + math.pi)
                u0 = pg.evaluate(UNA, l['id']); pj0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
                if u0 and 14.5 < math.hypot(u0['ox'] - pj0[0], u0['oz'] - pj0[1]) < 19.5: break
            alerta = esperar(pg, f"(id) => {{ const l = {K}.fauna.liebres.get(id); return l && l.anim === 'alerta'; }}", 15000, l['id'])
            u = pg.evaluate(UNA, l['id'])
            pj = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            pg.evaluate(f"{K}.pj.rot = {math.atan2(u['ox'] - pj[0], u['oz'] - pj[1])}")
            texto = pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : null; }})()")
            comprobar(f'{nombre}: con la lanza en la mano y la liebre a tiro (alerta: {alerta}), Usar dice «Lanzar la lanza»', texto == 'Lanzar la lanza', str(texto) + ' ' + json.dumps(pg.evaluate(f"(id) => {{ const k = {K}, l = k.fauna.liebres.get(id); return {{ rot: k.pj.rot, pj: [k.pj.x, k.pj.z], l: l && [l.x, l.z], a: l && Math.atan2(l.x - k.pj.x, l.z - k.pj.z), tiro: k.liebreATiro() }}; }}", l['id'])))
            pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {a} + 0.5; k.cam.pitch = 0.25; k.cam.dist = 7; }})()")
            pg.evaluate(f"window.__vuelan = 0; setInterval(() => {{ window.__vuelan = Math.max(window.__vuelan, {K}.fauna.lanzas.size); }}, 50)")
            pg.evaluate(f"{K}.usar()")
            vuela = esperar(pg, "window.__vuelan > 0", 5000)
            pg.wait_for_timeout(300)
            captura(pg, f'{SALIDA}/{nombre}_lanza_vuela.png')
            comprobar(f'{nombre}: la lanza sale de la mano y se ve volar', vuela and esperar(pg, f"!{K}.inventario.lugares['mano:der']", 5000))
            cae = esperar(pg, f"(id) => !{K}.fauna.liebres.has(id) && {K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'liebre')", 15000, l['id'])
            cerca_de = lambda lst: sorted(lst, key=lambda o: math.hypot(o['x'] - u['ox'], o['z'] - u['oz']))[:1]
            muerta = cerca_de(pg.evaluate(EN_SUELO, 'liebre')); lanza = cerca_de(pg.evaluate(EN_SUELO, 'lanza_endurecida'))
            comprobar(f'{nombre}: acierta: la liebre cae muerta y la lanza queda a su lado', cae and muerta and lanza and math.hypot(muerta[0]['x'] - lanza[0]['x'], muerta[0]['z'] - lanza[0]['z']) < 1.2, f'{muerta} {lanza}')
            comprobar(f'{nombre}: la lanza ya no vuela', esperar(pg, f"{K}.fauna.lanzas.size === 0", 5000))
            if muerta:
                m = muerta[0]
                poner(pg, m['x'] + 1.6, m['z'] + 0.4)
                pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {math.atan2(1.6, 0.4)}; k.cam.pitch = 0.55; k.cam.dist = 1.8; }})()")
                pg.wait_for_timeout(6000)
                captura(pg, f'{SALIDA}/{nombre}_liebre_cazada.png')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
