# Prueba en navegador del panel de depuración del admin (valravnx, 30 oct; src/juego/panel_admin.js), con el admin por la
# cuenta (revisión del 1 nov, P1: sin clave aparte).
# Uso: python3 pruebas/prueba_admin_navegador.py <html de la demo> <carpeta_capturas>
# Una sola página a la vez (no es de las de dos páginas en línea): la demo con un servidor local, y un jugador simulado
# (un cliente de node, sin navegador) quieto en un sitio conocido. Comprueba, en PC y móvil:
#   - con una cuenta que no es de admin no sale el botón «Admin» (ni con ?admin en la dirección) y F9 no abre nada;
#     la clave que guardaba el navegador antes se borra;
#   - con la cuenta de admin sale el botón y el panel se abre (botón o F9) sin pedir ninguna clave: el mapa del rey
#     abierto, el otro jugador en la lista y pintado en el mapa donde está;
#   - «Ir» te pone junto a él (a menos de 2 m) y cierra el panel; un clic en el mapa te lleva a ese punto, en el suelo;
#   - M, Esc y «Cerrar» lo cierran.
# MUTAR=1: un servidor que dice a todos que son admin: tiene que fallar (a la cuenta que no lo es le saldría el botón).
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_admin'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'
ADMINS = ['valravnx', 'admmovil', 'admen']   # la cuenta de admin de cada vista (la máquina dice sus correos: usuario@ejemplo.com, como los pone correo_prueba.py)
OTRO = (1500.0, 900.0)   # dónde está el jugador simulado (m, relativos a la salida; lejos, para que tu marca no lo tape)

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
SERVIDOR = os.path.join(RAIZ, 'servidor/servidor.mjs')
if MUTAR:
    t = open(SERVIDOR).read(); m = t.replace('admin: esAdmin(autor),', 'admin: true,'); assert m != t
    SERVIDOR = os.path.join(RAIZ, 'servidor/.servidor_mutado_admin_nav.mjs'); open(SERVIDOR, 'w').write(m)
servidor = subprocess.Popen(['node', SERVIDOR, str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_ADMIN_CORREO': ','.join(u + '@ejemplo.com' for u in ADMINS)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)
# el otro jugador: un cliente de node que manda su estado, quieto
# (a la altura del suelo de su sitio: el servidor conoce el terreno y no admite a nadie muy por encima o por debajo)
BOT = f"""import {{ WebSocket }} from 'ws';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const y = terrenoWhitholm().suelo({OTRO[0]}, {OTRO[1]});
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
ws.on('open', () => setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: {OTRO[0]}, y, z: {OTRO[1]}, giro: 0.4, anim: 'quieto' }})), 200));
ws.on('message', (d) => {{ const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') console.log(m.autor); }});"""
# (con -e: los import se buscan desde cwd, la raíz del repositorio, donde está ws; no se escribe ningún archivo)
bot = subprocess.Popen(['node', '--input-type=module', '-e', BOT], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
AUTOR_BOT = bot.stdout.readline().strip()

URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
# (fuera de la f-string: el Python del PC de valravnx no admite barras invertidas dentro de sus llaves)
ESTADO_PANEL = 'document.querySelector("#panelAdmin .pa-estado").textContent'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(nombre, ok, detalle=''):
    print(('  OK   ' if ok else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not ok: fallos.append(nombre)
def esperar(pg, cond, ms=30000):
    try: pg.wait_for_function(cond, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
# Cuentas (P1): la primera vez sale la pantalla de crear cuenta, que tapa el juego; se crea una (si sale) y se sigue
def crear_cuenta(pg, usuario, ms=10000):
    try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=ms)
    except Exception: return False
    clave = 'clave-de-prueba-123'
    # y confirma el correo con el código que llega (pruebas/correo_prueba.py), como un jugador
    return crear_y_confirmar(pg, codigos, usuario, clave)
PANEL = f"{K}.panelAdmin"

try:
    print('Jugador simulado:', AUTOR_BOT)
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            # una cuenta que no es de admin (con la clave de antes guardada en el navegador, y ?admin en la dirección)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            ctx.add_init_script("try { if (!sessionStorage.getItem('puesta')) { localStorage.setItem('kinhold_admin_clave', 'clave-de-antes-0123456'); sessionStorage.setItem('puesta', '1'); } } catch (e) {}")
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL + '&admin', wait_until='domcontentloaded', timeout=180000)
            comprobar(f'{nombre}: entra en línea con el mundo listo', esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo && {PANEL}", 300000))
            comprobar(f'{nombre}: crea una cuenta que no es de admin', crear_cuenta(pg, f'jugador{nombre}'))
            esperar(pg, f"{K}.mapaRey.listo", 300000)
            pg.wait_for_timeout(1500)
            comprobar(f'{nombre}: sin la cuenta de admin no sale el botón «Admin» (ni con ?admin)', not pg.evaluate("!!document.getElementById('btnAdmin')") and pg.evaluate(f"{K}.enLinea.admin === false"))
            if not movil:
                pg.keyboard.press('F9'); pg.wait_for_timeout(400)
                comprobar(f'{nombre}: y F9 no abre nada', not pg.evaluate(f"{PANEL}.abierto || {K}.mapaRey.abierto"))
            comprobar(f'{nombre}: la clave que guardaba el navegador antes se borra', pg.evaluate("localStorage.getItem('kinhold_admin_clave')") is None)
            comprobar(f'{nombre}: sin errores en la página (sin admin)', not err, '; '.join(err)[:300])
            ctx.close()

            # la cuenta de admin
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo && {PANEL}", 300000)
            comprobar(f'{nombre}: crea la cuenta de admin', crear_cuenta(pg, ADMINS[0] if not movil else ADMINS[1]))
            esperar(pg, f"{K}.mapaRey.listo", 300000)
            comprobar(f'{nombre}: con la cuenta de admin sale el botón «Admin», sin recargar', esperar(pg, "!!document.getElementById('btnAdmin')", 5000))
            abrir = (lambda: pg.tap('#btnAdmin')) if movil else (lambda: pg.keyboard.press('F9'))
            pulsar = (lambda sel: pg.tap(sel, timeout=90000)) if movil else (lambda sel: pg.click(sel, timeout=90000))
            abrir(); pg.wait_for_timeout(400)
            comprobar(f'{nombre}: se abre sin pedir ninguna clave', pg.evaluate(f"{PANEL}.abierto && {K}.mapaRey.abierto && !document.querySelector('#panelAdmin input')"))
            vio = esperar(pg, f"{PANEL}.jugadores.some(j => j.autor === '{AUTOR_BOT}')", 8000)
            comprobar(f'{nombre}: el otro jugador sale en la lista', vio and pg.evaluate("document.querySelectorAll('#panelAdmin li').length") >= 1, pg.evaluate(ESTADO_PANEL))
            # pintado en el mapa donde está: el punto azul en su sitio
            punto = pg.evaluate(f"""(() => {{ const k = {K}, m = k.mapaRey, s = k.mundoJ.salida;
              const [x, y] = m.kmAPant((s.x + {OTRO[0]}) / 1000, (s.z + {OTRO[1]}) / 1000);
              const c = document.querySelector('#mapaRey canvas'), r = c.width / innerWidth, d = c.getContext('2d').getImageData(Math.round(x * r), Math.round(y * r), 1, 1).data;
              return {{ x, y, rgb: [d[0], d[1], d[2]] }}; }})()""")
            azul = punto['rgb'][2] > punto['rgb'][0] + 40
            comprobar(f'{nombre}: el otro jugador, pintado en el mapa donde está', azul, str(punto))
            captura(pg, f'{SALIDA}/{nombre}_panel.png')
            # «Ir» junto a él
            pulsar('#panelAdmin li button')
            junto = esperar(pg, f"!{PANEL}.abierto && Math.hypot({K}.pj.x - {OTRO[0]}, {K}.pj.z - {OTRO[1]}) < 2", 8000)
            d = pg.evaluate(f"Math.hypot({K}.pj.x - {OTRO[0]}, {K}.pj.z - {OTRO[1]})")
            comprobar(f'{nombre}: «Ir» te pone junto a él y cierra el panel', junto and not pg.evaluate(f"{K}.mapaRey.abierto"), f'a {d:.2f} m')
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/{nombre}_junto.png')
            # al volver a abrirlo, un clic en el mapa lleva ahí
            abrir(); pg.wait_for_timeout(500)
            comprobar(f'{nombre}: se vuelve a abrir', pg.evaluate(f"{PANEL}.abierto"))
            destino = pg.evaluate(f"""(() => {{ const k = {K}, m = k.mapaRey, s = k.mundoJ.salida;
              const [x, y] = m.kmAPant((s.x + 400) / 1000, (s.z - 300) / 1000); return {{ x: Math.round(x), y: Math.round(y) }}; }})()""")
            esperado = pg.evaluate(f"(() => {{ const k = {K}, [a, b] = k.mapaRey.pantAKm({destino['x']}, {destino['y']}); return {{ x: a * 1000 - k.mundoJ.salida.x, z: b * 1000 - k.mundoJ.salida.z }}; }})()")
            if movil: pg.touchscreen.tap(destino['x'], destino['y'])
            else: pg.mouse.click(destino['x'], destino['y'])
            fue = esperar(pg, f"!{PANEL}.abierto && Math.hypot({K}.pj.x - {esperado['x']}, {K}.pj.z - {esperado['z']}) < 0.5", 8000)
            pj = pg.evaluate(f"({{ x: {K}.pj.x, y: {K}.pj.y, z: {K}.pj.z, suelo: {K}.alturaSuelo({K}.pj.x, {K}.pj.z) }})")
            comprobar(f'{nombre}: un clic en el mapa te lleva a ese punto', fue, f'esperado {esperado}, está {pj}')
            comprobar(f'{nombre}: y en el suelo', abs(pj['y'] - pj['suelo']) < 0.5, str(pj))
            pg.wait_for_timeout(2500)
            captura(pg, f'{SALIDA}/{nombre}_clic.png')
            # cerrar con M o Esc (PC) y con «Cerrar»
            abrir(); pg.wait_for_timeout(400)
            if not movil:
                pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
                comprobar(f'{nombre}: Esc lo cierra', not pg.evaluate(f"{PANEL}.abierto || {K}.mapaRey.abierto"))
                abrir(); pg.wait_for_timeout(400)
                pg.keyboard.press('m'); pg.wait_for_timeout(300)
                comprobar(f'{nombre}: M lo cierra', not pg.evaluate(f"{PANEL}.abierto || {K}.mapaRey.abierto"))
                abrir(); pg.wait_for_timeout(400)
            pulsar('#panelAdmin .pa-cerrar'); pg.wait_for_timeout(300)
            comprobar(f'{nombre}: «Cerrar» lo cierra con el mapa', not pg.evaluate(f"{PANEL}.abierto || {K}.mapaRey.abierto"))
            faltan = pg.evaluate('window.__idioma ? [...window.__idioma.faltan] : []')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err)[:300])
            ctx.close()
        # en inglés, ningún texto del panel sin traducir
        print('Vista pc_en')
        ctx = nav.new_context(viewport={'width': 1280, 'height': 800}, locale='en-US')
        pg = ctx.new_page()
        pg.goto(URL + '&lang=en', wait_until='domcontentloaded', timeout=180000)
        esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo && {PANEL}", 300000)
        crear_cuenta(pg, ADMINS[2])
        esperar(pg, f"{K}.mapaRey.listo", 300000)
        esperar(pg, "!!document.getElementById('btnAdmin')", 5000)
        pg.keyboard.press('F9'); pg.wait_for_timeout(300)
        esperar(pg, f"{PANEL}.jugadores.length > 0", 8000)
        faltan = [f for f in pg.evaluate('[...window.__idioma.faltan]')]
        comprobar('en inglés: ningún texto sin traducir', not faltan, str(faltan))
        texto = pg.evaluate("document.getElementById('panelAdmin').textContent")
        comprobar('en inglés: el panel en inglés', 'Debug (admin)' in texto and 'Close' in texto, texto[:120])
        captura(pg, f'{SALIDA}/pc_en_panel.png')
        nav.close()
finally:
    bot.kill(); servidor.kill(); web.shutdown()
    for f in ([SERVIDOR] if MUTAR else []):
        if os.path.exists(f): os.remove(f)
    shutil.rmtree(sitio, ignore_errors=True)
print(f'\n{len(fallos)} fallos' if fallos else '\nTodo bien')
sys.exit(1 if fallos else 0)
