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
#   - «Traer» (valravnx, 5 nov: «poder tpearlos a mi»): pone al otro jugador junto a ti; a él le llega adónde, a menos
#     de 2 m de ti;
#   - al jugador traído (una cuenta que no es de admin), su navegador le pone donde dice el servidor y le avisa (le trae
#     un admin simulado: otro cliente de node con una cuenta de admin; así sigue siendo una sola página);
#   - M, Esc y «Cerrar» lo cierran.
#   - la herramienta del admin (valravnx, 6 nov): se abre en «Info» (lo del servidor y dónde estás) sin el mapa, que va
#     en su pestaña; en «Modos», la velocidad ×10 (la confirma el servidor y el juego la usa) y autoconstruir; en «Arcón»,
#     buscar un objeto e invocarlo a lo que llevas; la cámara libre vuela (sube y avanza) con el personaje quieto, «Ir
#     aquí» le pone bajo ella y F10 (PC) o el botón «Cámara» (móvil) la quita.
#   - explorar libre (valravnx, 5 nov: «en el panel de admin ponme el mapa de todo el continente… que quiero poder
#     explorar libre»): el mapa del panel es el del continente entero; un clic en otra región te lleva allí, en el suelo,
#     con el terreno cargado; andas, y el servidor te tiene allí. A una cuenta que no es de admin no le pasa (sigue en la isla).
# MUTAR=1: un servidor que dice a todos que son admin: tiene que fallar (a la cuenta que no lo es le saldría el botón).
# MUTAR=3: el navegador no hace caso de que le traigan: tiene que fallar.
# MUTAR=2: el navegador no suelta a la cuenta de admin fuera de la isla: tiene que fallar (no puede andar allí).
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_admin'
os.makedirs(SALIDA, exist_ok=True)
MUTAR_TODO = os.environ.get('MUTAR', '')
MUTAR = MUTAR_TODO == '1'
ADMINS = ['valravnx', 'admmovil', 'admen', 'admbotpc', 'admbotmovil']   # la cuenta de admin de cada vista (la máquina dice sus correos: usuario@ejemplo.com, como los pone correo_prueba.py)
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
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_ADMIN_CORREO': ','.join(u + '@ejemplo.com' for u in ADMINS)}, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)
# el otro jugador: un cliente de node que manda su estado, quieto (aparece de golpe lejos: por eso el servidor va sin el
# límite de velocidad, KINHOLD_PRUEBAS_MOVIMIENTO=libre)
# (a la altura del suelo de su sitio: el servidor conoce el terreno y no admite a nadie muy por encima o por debajo)
BOT = f"""import {{ WebSocket }} from 'ws';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const y = terrenoWhitholm().suelo({OTRO[0]}, {OTRO[1]});
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
ws.on('open', () => setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: {OTRO[0]}, y, z: {OTRO[1]}, giro: 0.4, anim: 'quieto' }})), 200));
ws.on('message', (d) => {{ const m = JSON.parse(d.toString()); if (m.tipo === 'bienvenida') console.log(m.autor);
  if (m.tipo === 'admin' && m.que === 'traido') console.log('traido ' + JSON.stringify(m)); }});"""
# (con -e: los import se buscan desde cwd, la raíz del repositorio, donde está ws; no se escribe ningún archivo)
bot = subprocess.Popen(['node', '--input-type=module', '-e', BOT], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
AUTOR_BOT = bot.stdout.readline().strip()
# lo que le llega al jugador simulado cuando le traen
TRAIDO = []
def leer_bot():
    for l in bot.stdout:
        if l.startswith('traido '): TRAIDO.append(json.loads(l[7:]))
threading.Thread(target=leer_bot, daemon=True).start()

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
# el admin simulado: otro cliente de node que crea una cuenta de admin (el código del correo se lo pasa esta prueba por su
# entrada), se queda quieto en ADMIN_BOT y trae al jugador que se le diga; da la respuesta del servidor y se va
ADMIN_BOT = (1460.0, 880.0)
ADMIN_JS = f"""import {{ WebSocket }} from 'ws';
import {{ createInterface }} from 'readline';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const [usuario, quien] = process.argv.slice(1);
const y = terrenoWhitholm().suelo({ADMIN_BOT[0]}, {ADMIN_BOT[1]});
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
const fin = (m) => {{ console.log('fin ' + JSON.stringify(m)); process.exit(0); }};
setTimeout(() => fin({{ ok: false, motivo: 'sin respuesta' }}), 30000);
ws.on('open', () => {{ setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: {ADMIN_BOT[0]}, y, z: {ADMIN_BOT[1]}, giro: 0, anim: 'quieto' }})), 200);
  ws.send(JSON.stringify({{ tipo: 'cuenta', id: 1, que: 'crear', usuario, clave: 'clave-de-prueba-123', correo: usuario + '@ejemplo.com' }})); }});
createInterface({{ input: process.stdin }}).on('line', (c) => ws.send(JSON.stringify({{ tipo: 'cuenta', id: 2, que: 'verificar', codigo: c.trim() }})));
ws.on('message', (d) => {{ const m = JSON.parse(d.toString());
  if (m.tipo === 'cuenta' && m.id === 2) {{ if (!m.ok || !m.admin) fin(m); else setTimeout(() => ws.send(JSON.stringify({{ tipo: 'admin', id: 3, que: 'traer', quien }})), 600); }}
  if (m.tipo === 'admin' && m.id === 3) fin(m); }});"""
def traer_con_admin(usuario, quien):
    a = subprocess.Popen(['node', '--input-type=module', '-e', ADMIN_JS, usuario, quien], cwd=RAIZ, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    try:
        c = codigos.de(usuario)
        if c: a.stdin.write(c + '\n'); a.stdin.flush()
        for l in a.stdout:
            if l.startswith('fin '): return json.loads(l[4:])
        return None
    finally: a.kill()

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
            if MUTAR_TODO == '3': pg.add_init_script("window.__mutarTraido = true")
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
            fuera = pg.evaluate(f"({{ libre: {K}.mundoJ.esLibre, dentro: {K}.mundoJ.dentro(-150000, 150000) }})")
            comprobar(f'{nombre}: sin la cuenta de admin no se puede ir fuera de la isla', fuera['libre'] is False and fuera['dentro'] is False, str(fuera))
            comprobar(f'{nombre}: la clave que guardaba el navegador antes se borra', pg.evaluate("localStorage.getItem('kinhold_admin_clave')") is None)
            # le trae el admin (simulado, con su cuenta de admin): su navegador le pone junto a él y le avisa
            r = traer_con_admin(f'admbot{nombre}', pg.evaluate(f"{K}.yo"))
            traido = esperar(pg, f"Math.hypot({K}.pj.x - {ADMIN_BOT[0]}, {K}.pj.z - {ADMIN_BOT[1]}) < 2", 8000)
            aviso = pg.evaluate("document.getElementById('aviso').textContent")
            comprobar(f'{nombre}: al que trae el admin, su navegador le pone junto a él y le avisa', bool(r and r.get('ok')) and traido and 'admin' in aviso, f'{r} · {aviso} · {pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")}')
            pg.wait_for_timeout(1500)
            captura(pg, f'{SALIDA}/{nombre}_traido.png')
            comprobar(f'{nombre}: sin errores en la página (sin admin)', not err, '; '.join(err)[:300])
            ctx.close()

            # la cuenta de admin
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR_TODO == '2': ctx.add_init_script('window.__mutarAdminLibre = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo && {PANEL}", 300000)
            comprobar(f'{nombre}: crea la cuenta de admin', crear_cuenta(pg, ADMINS[0] if not movil else ADMINS[1]))
            esperar(pg, f"{K}.mapaRey.listo", 300000)
            comprobar(f'{nombre}: con la cuenta de admin sale el botón «Admin», sin recargar', esperar(pg, "!!document.getElementById('btnAdmin')", 5000))
            abrir_panel = (lambda: (pg.tap('#btnMenu'), pg.tap('#btnAdmin'))) if movil else (lambda: pg.keyboard.press('F9'))   # (Admin, al pie del menú)
            pulsar = (lambda sel: pg.tap(sel, timeout=90000)) if movil else (lambda sel: pg.click(sel, timeout=90000))
            # (desde el 6 nov el panel se abre en «Info», sin el mapa; el mapa y la lista están en su pestaña)
            abrir_panel(); pg.wait_for_timeout(600)
            comprobar(f'{nombre}: se abre en «Info», sin el mapa: lo del servidor y dónde estás', esperar(pg, f"{PANEL}.info && document.querySelectorAll('#panelAdmin dl dt').length >= 10", 8000) and not pg.evaluate(f"{K}.mapaRey.abierto") and 'Conectados' in pg.evaluate("document.getElementById('panelAdmin').textContent") and 'Donde estás' in pg.evaluate("document.getElementById('panelAdmin').textContent"), pg.evaluate("document.getElementById('panelAdmin').textContent")[:200])
            pg.wait_for_timeout(800)
            captura(pg, f'{SALIDA}/{nombre}_info.png')
            pulsar('#panelAdmin .pa-cerrar'); pg.wait_for_timeout(300)
            def abrir():
                abrir_panel(); pg.wait_for_timeout(300)
                if pg.evaluate(f"{PANEL}.abierto"): pulsar('#panelAdmin .pa-p-mapa')
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
            pulsar('#panelAdmin li .pa-ir')
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
            # «Traer»: el otro jugador, junto a ti
            abrir(); pg.wait_for_timeout(500)
            esperar(pg, f"{PANEL}.jugadores.some(j => j.autor === '{AUTOR_BOT}')", 8000)
            n_antes = len(TRAIDO)
            comprobar(f'{nombre}: en la lista, «Ir» y «Traer»', pg.evaluate("[...document.querySelectorAll('#panelAdmin li button')].map(b => b.textContent).join(',')") == 'Ir,Traer')
            pulsar('#panelAdmin li .pa-traer')
            dicho = esperar(pg, f"{ESTADO_PANEL}.startsWith('Traído')", 8000)
            pg.wait_for_timeout(500)
            yo = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            t = TRAIDO[-1] if len(TRAIDO) > n_antes else None
            cerca = t is not None and ((t['x'] - yo[0]) ** 2 + (t['z'] - yo[1]) ** 2) ** 0.5 < 2
            comprobar(f'{nombre}: «Traer» le pone junto a ti y a él le llega adónde', dicho and cerca and pg.evaluate(f"{PANEL}.abierto"), f'{pg.evaluate(ESTADO_PANEL)} · {t} · {yo}')
            captura(pg, f'{SALIDA}/{nombre}_traer.png')
            pulsar('#panelAdmin .pa-cerrar'); pg.wait_for_timeout(300)
            # la herramienta del admin (valravnx, 6 nov): modos, arcón de admin y cámara libre
            abrir_panel(); pg.wait_for_timeout(400); pulsar('#panelAdmin .pa-p-modos'); pg.wait_for_timeout(300)
            pulsar('#panelAdmin .pa-v10')
            comprobar(f'{nombre}: velocidad ×10: la confirma el servidor y el juego la usa', esperar(pg, f"{PANEL}.modos.velocidad === 10 && {K}.velocidadAdmin() === 10", 8000), pg.evaluate(ESTADO_PANEL))
            pulsar('#panelAdmin .pa-auto')
            comprobar(f'{nombre}: autoconstruir se activa', esperar(pg, f"{PANEL}.modos.autoconstruir === true && !!document.querySelector('#panelAdmin .pa-auto.pa-on')", 8000), pg.evaluate(ESTADO_PANEL))
            captura(pg, f'{SALIDA}/{nombre}_modos.png')
            pulsar('#panelAdmin .pa-auto'); esperar(pg, f"{PANEL}.modos.autoconstruir === false", 8000)
            pulsar('#panelAdmin .pa-v1')
            comprobar(f'{nombre}: y se vuelven a apagar', esperar(pg, f"{PANEL}.modos.velocidad === 1 && {K}.velocidadAdmin() === 1", 8000))
            pulsar('#panelAdmin .pa-p-arcon'); pg.wait_for_timeout(300)
            pg.fill('#panelAdmin .pa-buscar', 'hacha de hierro'); pg.wait_for_timeout(300)
            n_obj = pg.evaluate("document.querySelectorAll('#panelAdmin .pa-objetos li').length")
            pulsar('#panelAdmin .pa-objetos li .pa-invocar')
            comprobar(f'{nombre}: el arcón de admin: buscar «hacha de hierro» e invocarla, a lo que llevas', n_obj >= 1 and esperar(pg, f"{K}.inventario.cuantos('hacha_hierro') >= 1", 8000), f'{n_obj} · {pg.evaluate(ESTADO_PANEL)}')
            captura(pg, f'{SALIDA}/{nombre}_arcon.png')
            # la cámara libre: el personaje se queda; la cámara vuela, sube y avanza
            pulsar('#panelAdmin .pa-p-modos'); pg.wait_for_timeout(300)
            pulsar('#panelAdmin .pa-camara'); pg.wait_for_timeout(300)
            pj0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]"); c0 = pg.evaluate(f"({{ ...{K}.camLibre }})")
            activa = pg.evaluate(f"{K}.camLibre.activa && !{PANEL}.abierto && !document.getElementById('barraVuelo').hidden")
            if movil:
                pg.dispatch_event('#vueloSubir', 'pointerdown'); pg.wait_for_timeout(2000); pg.dispatch_event('#vueloSubir', 'pointerup')
            else:
                pg.keyboard.down('Space'); pg.wait_for_timeout(2000); pg.keyboard.up('Space')
                pg.keyboard.down('w'); pg.wait_for_timeout(2000); pg.keyboard.up('w')
            pg.wait_for_timeout(200)
            c1 = pg.evaluate(f"({{ ...{K}.camLibre }})"); pj1 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            # (sin tarjeta gráfica el juego va a pocos fotogramas y cada uno avanza como mucho 0,05 s: aquí se mira que
            # se mueve, no cuánto)
            subio = c1['y'] - c0['y'] > 0.1
            avanzo = movil or ((c1['x'] - c0['x']) ** 2 + (c1['z'] - c0['z']) ** 2) ** 0.5 > 0.1
            quieto = ((pj1[0] - pj0[0]) ** 2 + (pj1[1] - pj0[1]) ** 2) ** 0.5 < 0.1
            comprobar(f'{nombre}: cámara libre: sube y avanza volando y el personaje se queda donde estaba', activa and subio and avanzo and quieto, f'{c0} → {c1} · personaje {pj0} → {pj1}')
            pg.wait_for_timeout(600)
            captura(pg, f'{SALIDA}/{nombre}_camara.png')
            pulsar('#vueloIrAqui')
            aqui = esperar(pg, f"!{K}.camLibre.activa && Math.hypot({K}.pj.x - {c1['x']}, {K}.pj.z - {c1['z']}) < 0.5", 8000)
            comprobar(f'{nombre}: «Ir aquí» pone al personaje bajo la cámara y la quita', aqui, str(pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")))
            if not movil:
                pg.keyboard.press('F10'); pg.wait_for_timeout(300)
                on = pg.evaluate(f"{K}.camLibre.activa")
                pg.keyboard.press('F10'); pg.wait_for_timeout(300)
                comprobar(f'{nombre}: F10 la pone y la quita', on and not pg.evaluate(f"{K}.camLibre.activa"))
            else:
                pulsar('#btnMenu'); pulsar('#btnAdmin'); pg.wait_for_timeout(300); pulsar('#panelAdmin .pa-p-modos'); pulsar('#panelAdmin .pa-camara'); pg.wait_for_timeout(300)
                on = pg.evaluate(f"{K}.camLibre.activa")
                pulsar('#vueloSalir'); pg.wait_for_timeout(300)
                comprobar(f'{nombre}: el botón «Cámara» la quita', on and not pg.evaluate(f"{K}.camLibre.activa"))
            # explorar libre: el mapa del continente entero y un clic en otra región
            abrir(); pg.wait_for_timeout(500)
            esperar(pg, f"{K}.mapaRey.continente", 120000)
            mapa = pg.evaluate(f"(() => {{ const m = {K}.mapaRey, d = m.datos; return {{ continente: m.continente, cuadro: d.cuadro, regiones: (d.regiones || []).map(r => [r.nombre, r.isla, r.x, r.y]) }}; }})()")
            comprobar(f'{nombre}: el mapa del panel es el del continente entero, con sus regiones', mapa['continente'] and mapa['cuadro']['x1'] - mapa['cuadro']['x0'] >= 250 and len(mapa['regiones']) >= 4, str(mapa)[:300])
            # se abre centrado en ti, a la escala de la isla; alejándolo del todo, el continente entero
            pg.evaluate(f"(() => {{ const m = {K}.mapaRey, c = m.datos.cuadro; m.centrarEn((c.x0 + c.x1) / 2, (c.y0 + c.y1) / 2, 1); }})()")
            pg.wait_for_timeout(800)
            captura(pg, f'{SALIDA}/{nombre}_continente.png')
            otra = next((r for r in mapa['regiones'] if not r[1]), None)
            destino = pg.evaluate(f"(([x, y]) => {{ const [a, b] = {K}.mapaRey.kmAPant(x, y); return {{ x: Math.round(a), y: Math.round(b) }}; }})", [otra[2], otra[3]]) if otra else {'x': 0, 'y': 0}
            esperado = pg.evaluate(f"(() => {{ const k = {K}, [a, b] = k.mapaRey.pantAKm({destino['x']}, {destino['y']}); return {{ x: a * 1000 - k.mundoJ.salida.x, z: b * 1000 - k.mundoJ.salida.z }}; }})()")
            if movil: pg.touchscreen.tap(destino['x'], destino['y'])
            else: pg.mouse.click(destino['x'], destino['y'])
            fue = esperar(pg, f"!{PANEL}.abierto && Math.hypot({K}.pj.x - {esperado['x']}, {K}.pj.z - {esperado['z']}) < 0.5", 8000)
            comprobar(f'{nombre}: un clic en otra región ({otra and otra[0]}) te lleva allí', fue, f'esperado {esperado}')
            listo = esperar(pg, f"{K}.mundoJ.listo", 240000)
            pg.wait_for_timeout(1500)
            pj = pg.evaluate(f"({{ x: {K}.pj.x, y: {K}.pj.y, z: {K}.pj.z, suelo: {K}.alturaSuelo({K}.pj.x, {K}.pj.z), isla: {K}.mundoJ.dentro({K}.pj.x, {K}.pj.z) && !{K}.mundoJ.esLibre }})")
            comprobar(f'{nombre}: allí se carga el terreno y estás en el suelo', listo and abs(pj['y'] - pj['suelo']) < 0.6, str(pj))
            # andar un poco (hacia delante, 3 s)
            antes = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            pg.keyboard.down('w'); pg.wait_for_timeout(3000); pg.keyboard.up('w'); pg.wait_for_timeout(300)
            ahora = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]")
            andado = ((ahora[0] - antes[0]) ** 2 + (ahora[1] - antes[1]) ** 2) ** 0.5
            comprobar(f'{nombre}: y puedes andar por allí', andado > 0.3, f'{andado:.2f} m')
            # el servidor te tiene allí: tu sitio en su lista
            pg.wait_for_timeout(800)
            serv = pg.evaluate(f"""() => new Promise((listo) => {{ const k = {K}; let fin = null;
              const quitar = k.enLinea.escuchar((m) => {{ if (m.tipo === 'admin' && m.id === 999999) {{ quitar(); listo(m.jugadores ? (m.jugadores.find(j => j.autor === m.yo) || null) : m); }} }});
              k.enLinea.enviar({{ tipo: 'admin', id: 999999, que: 'ver' }}); setTimeout(() => listo('sin respuesta'), 5000); }})""")
            de_verdad = isinstance(serv, dict) and 'x' in serv and abs(serv['x'] - ahora[0]) < 3 and abs(serv['z'] - ahora[1]) < 3
            comprobar(f'{nombre}: el servidor te tiene allí (fuera de la isla)', de_verdad, f'{serv} / {ahora}')
            captura(pg, f'{SALIDA}/{nombre}_fuera.png')
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
        for pest in ['modos', 'arcon', 'info', 'mapa']:   # todas las pestañas, para ver sus textos
            pg.click(f'#panelAdmin .pa-p-{pest}'); pg.wait_for_timeout(500)
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
