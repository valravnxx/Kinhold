# Prueba en navegador de la hoguera (P3, «De nada a una casa»), en línea con un servidor local y dos jugadores.
# Uso: python3 pruebas/prueba_hoguera_navegador.py <html de la demo> <carpeta_capturas>
# En PC (1280×800), un jugador levanta una hoguera desde «Puestos de trabajo» (el marco, sus 6 piedras y sus 4 ramas,
# y el trabajo); levantada sale apagada, con sus ramas puestas. Con Usar se abre el panel en la pestaña del fuego, con
# su estado arriba; «Encender» (con la yesca y el taladro de fuego en las manos) la enciende en el servidor (gasta la
# yesca, el taladro sigue) y se ve arder: brasas, llamas, humo y luz, y da calor al lado. «Echar 1 rama» le da 3 min
# más en el servidor. En el móvil (390×844), el otro jugador la ve arder igual, con el panel y el menú del clic
# derecho; y apagada sola, con las cenizas. Capturas de cerca, de día y de noche.
# El material sale del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba la hoguera en el juego; el recorrido de
# jugador (pruebas/prueba_recorrido.mjs) la levanta y la enciende sin arcón, con lo que se recoge.
# MUTAR=1 tira los mensajes de objetos que manda la página (como si se encendiera solo en el navegador): falla.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_fabricar'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)
s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
OBJETOS = os.path.join(sitio, 'objetos.json')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_ARCON': 'si', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def esperar(pg, cond, ms=20000):
    try: pg.wait_for_function(cond, timeout=ms, polling=250); return True
    except Exception: return False
def servidorDice(f, ms=15000):
    fin = time.time() + ms / 1000
    while True:
        try:
            d = json.load(open(OBJETOS))
            if f(d): return d
        except Exception: pass
        if time.time() > fin: return None
        time.sleep(0.25)
def cuantos(d, autor, tipo):
    j = d['inventarios']['jugadores'].get(autor)
    n = [0]
    def rec(c):
        if isinstance(c, dict):
            if c.get('tipo') == tipo: n[0] += c.get('n', 1)
            for v in c.values(): rec(v)
        elif isinstance(c, list):
            for v in c: rec(v)
    rec(j)
    return n[0]
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
_n = [0]
def crear_cuenta(pg, ms=10000):
    try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=ms)
    except Exception: return False
    _n[0] += 1
    return crear_y_confirmar(pg, codigos, f'fogonero{_n[0]}', 'clave-de-prueba-123')
def entrar(nav, nombre, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    if MUTAR:
        ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
          WebSocket.prototype.send = function (d) { if (String(d).includes('"tipo":"objeto"')) return; return s.call(this, d); }; })()""")
    pg = ctx.new_page(); err = []
    pg.on('pageerror', lambda e, err=err: err.append(str(e)))
    pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
    esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo", 300000)
    crear_cuenta(pg, 60000)   # (en el móvil de la nube la pantalla de la cuenta tarda en salir)
    comprobar(f'{nombre}: entra y le llega lo que lleva en el servidor', esperar(pg, f"{K}.enLinea.red.yo && {K}.objetosRed.deServidor", 120000), str(err[:2]))
    comprobar(f'{nombre}: sin la pantalla de la cuenta delante', esperar(pg, "!document.getElementById('pantallaCuenta') || document.getElementById('pantallaCuenta').hidden || getComputedStyle(document.getElementById('pantallaCuenta')).display === 'none'", 30000))
    return ctx, pg, err
TEXTO = "document.getElementById('panelFabricar').innerText"
def fila(pg, clave):
    return pg.evaluate(f"(() => {{ const f = document.querySelector('#panelFabricar [data-fila=\"{clave}\"]'); return f ? {{ cls: f.className, txt: f.innerText, sec: f.closest('section').className }} : null; }})()")
def elegir(pg, clave):   # toca la carta y devuelve el texto de su ficha
    pg.evaluate(f"(() => {{ const f = document.querySelector('#panelFabricar .fab-carta[data-fila=\"{clave}\"]'); if (f) f.click(); }})()")
    pg.wait_for_timeout(250)
    return pg.evaluate("document.querySelector('#panelFabricar .fab-ficha').innerText")
def pestana(pg, k):
    pg.evaluate(f"document.querySelector('#panelFabricar .fab-pest[data-pestana=\"{k}\"]').click()"); pg.wait_for_timeout(250)


def fuego_servidor(d, yo):
    l = [e for e in (d.get('fabricacion') or {}).get('estaciones', []) if e['tipo'] == 'hoguera' and e['autor'] == yo and not e.get('obra')]
    return l[0].get('fuego') if l else None
def coger(pg, objeto, n, a):
    # en la mano que se dice si está libre; si no, en la otra (y si ninguna, lo dice)
    r = pg.evaluate(f"""(() => {{ const l = {K}.inventario.lugares, a = !l['{a}'] ? '{a}' : ['mano:der', 'mano:izq'].find(m => !l[m]);
      if (!a) return 'manos llenas: ' + JSON.stringify([l['mano:der'], l['mano:izq']]);
      const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{objeto}', cantidad: {n}, a }}); return r && r.ok === false ? r.motivo : ''; }})()""")
    if r: print(f'  (coger {n} {objeto}: {r})')
def mirar_hoguera(pg, dist=3.0, pitch=0.5, yaw=0):
    pg.evaluate(f"""(() => {{ const e = Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'hoguera'); if (!e) return;
      Object.assign({K}.pj, {{ x: e.x + 0.55, z: e.z + 1.3, rot: Math.atan2(-0.55, -1.3) }}); {K}.cam.yaw = {yaw}; {K}.cam.dist = {dist}; {K}.cam.pitch = {pitch}; }})()""")
LLAMAS = "(() => { const o = window.__kinhold.escena.getObjectByName('estacion_hoguera'); const f = o && o.getObjectByName('fuego'); return f ? f.children.filter(m => m.name === 'llama').length : -1; })()"
CENIZAS = "(() => { const o = window.__kinhold.escena.getObjectByName('estacion_hoguera'); const f = o && o.getObjectByName('fuego'); return !!f && !!f.getObjectByName('ceniza') && !f.children.some(m => m.name === 'humo'); })()"

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")

        print('Levanta una hoguera desde «Puestos de trabajo»')
        coger(A, 'piedra', 3, 'mano:der'); coger(A, 'piedra', 3, 'mano:izq')
        comprobar('el servidor le da 6 piedras (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 6) is not None)
        A.evaluate(f"{K}.cambiarModo('construir')"); A.wait_for_timeout(200)
        A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); A.wait_for_timeout(300)
        A.evaluate(f"{K}.seleccionar('puesto', 'hoguera')")
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 1, z = {K}.pj.z + 0.2; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        comprobar('el servidor tiene el marco de la hoguera', servidorDice(lambda d: any(e['tipo'] == 'hoguera' and e.get('obra') for e in (d.get('fabricacion') or {}).get('estaciones', []))) is not None)
        A.evaluate(f"{K}.cambiarModo('mover')")
        esperar(A, f"Object.values({K}.fabCliente.estaciones).some(e => e.tipo === 'hoguera')", 8000)
        mirar_hoguera(A)
        A.keyboard.press('f')
        comprobar('Usar le lleva las piedras', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 0) is not None)
        comprobar('y lo que lleva le llega del servidor: las manos, vacías', esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000), str(A.evaluate(f"JSON.stringify([{K}.inventario.lugares['mano:der'], {K}.inventario.lugares['mano:izq']])")))
        for n in (3, 1):   # (en una mano caben 3 ramas)
            coger(A, 'rama', n, 'mano:der')
            comprobar(f'el servidor le da {n} rama(s) (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'rama') == n) is not None)
            esperar(A, f"{K}.inventario.cuantos('rama') === {n}", 5000)
            A.wait_for_timeout(600); A.keyboard.press('f')
            if n == 3: comprobar('Usar le lleva las ramas', servidorDice(lambda d: cuantos(d, yo, 'rama') == 0) is not None)
        d = servidorDice(lambda d: fuego_servidor(d, yo) is not None, 40000)
        comprobar('y con sus ramas y el trabajo queda levantada (en el servidor)', d is not None and cuantos(d, yo, 'rama') == 0, A.evaluate("document.getElementById('aviso').textContent"))
        f = fuego_servidor(d, yo) if d else None
        comprobar('levantada, apagada y con sus 4 ramas puestas (12 min)', f is not None and f['hasta'] == 0 and f['combustible'] == 720, str(f))
        comprobar('se dibuja con sus ramas, sin fuego', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_hoguera'); return !!o && !o.getObjectByName('armazon') && o.getObjectByName('ramas').visible && !o.getObjectByName('fuego'); }})()", 8000))

        print('La enciende con la yesca y el taladro de fuego, desde el panel')
        A.keyboard.press('f'); A.wait_for_timeout(500)
        comprobar('Usar abre el panel en la pestaña del fuego', A.evaluate(f"{K}.panelFabricar.abierto && {K}.panelFabricar.pestana === 'fuego'"))
        comprobar('arriba, el fuego: apagada, con lo que tiene puesto', esperar(A, "(() => { const s = document.querySelector('#panelFabricar .fab-fuego'); return !!s && /Apagada/.test(s.innerText) && /12 min/.test(s.innerText); })()", 5000), A.evaluate("(document.querySelector('#panelFabricar .fab-fuego') || {}).innerText"))
        comprobar('sin yesca ni taladro, «Encender» no se puede y dice lo que falta', A.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-encender'); return !!b && b.disabled && /taladro de fuego y la yesca/.test(document.querySelector('#panelFabricar .fab-fuego').innerText); })()"))
        pestana(A, 'fuego')
        comprobar('la lanza endurecida, en «Te falta algo» (el fuego apagado)', 'fab-sec-casi' in ((fila(A, 'lanza_endurecida') or {}).get('sec', '')), str(fila(A, 'lanza_endurecida')))
        coger(A, 'taladro_fuego', 1, 'mano:der'); coger(A, 'yesca', 1, 'mano:izq')
        servidorDice(lambda d: cuantos(d, yo, 'yesca') == 1 and cuantos(d, yo, 'taladro_fuego') == 1)
        comprobar('con ellos en las manos, «Encender» se puede', esperar(A, "(() => { const b = document.querySelector('#panelFabricar .fab-encender'); return !!b && !b.disabled; })()", 5000))
        A.wait_for_timeout(300)
        captura(A, f'{SALIDA}/PC_panel_hoguera_apagada.png')
        A.click('#panelFabricar .fab-encender')
        d = servidorDice(lambda d: (fuego_servidor(d, yo) or {}).get('hasta', 0) > 0)
        comprobar('el servidor la enciende: gasta la yesca y el taladro sigue', d is not None and cuantos(d, yo, 'yesca') == 0 and cuantos(d, yo, 'taladro_fuego') == 1)
        comprobar('el panel la da encendida, con lo que le queda', esperar(A, "/Encendida: le quedan 12 min/.test(document.querySelector('#panelFabricar .fab-fuego').innerText)", 8000), A.evaluate("(document.querySelector('#panelFabricar .fab-fuego') || {}).innerText"))
        comprobar('se ve arder: llamas', esperar(A, LLAMAS + " >= 5", 8000), str(A.evaluate(LLAMAS)))
        comprobar('alumbra (una luz de fuego encendida)', esperar(A, "window.__fuegos().hogueras >= 1 && window.__fuegos().encendidas >= 1", 5000), str(A.evaluate("window.__fuegos()")))
        comprobar('y da calor a su lado', A.evaluate(f"{K}.calor()") > 0.3, str(A.evaluate(f"{K}.calor()")))
        A.evaluate(f"(() => {{ const p = {K}.pj; p.x += 8; }})()")
        comprobar('lejos, no', A.evaluate(f"{K}.calor()") == 0)
        coger(A, 'rama', 1, 'mano:izq')
        servidorDice(lambda d: cuantos(d, yo, 'rama') == 1)
        A.evaluate(f"{K}.panelFabricar.cerrar()"); mirar_hoguera(A); A.keyboard.press('f'); A.wait_for_timeout(500)
        hasta0 = fuego_servidor(json.load(open(OBJETOS)), yo)['hasta']
        esperar(A, "(() => { const b = document.querySelector('#panelFabricar .fab-echar[data-objeto=\"rama\"]'); return !!b && !b.disabled; })()", 5000)
        A.click('#panelFabricar .fab-echar[data-objeto="rama"]')
        d = servidorDice(lambda d: (fuego_servidor(d, yo) or {}).get('hasta', 0) == hasta0 + 180000)
        comprobar('«Echar 1 rama» le da 3 min más en el servidor, con la rama que lleva', d is not None and cuantos(d, yo, 'rama') == 0)
        comprobar('y el panel lo dice', esperar(A, "/Echas al fuego: 1 rama/.test(document.querySelector('#panelFabricar .fab-aviso').textContent) && /le quedan 15 min/.test(document.querySelector('#panelFabricar .fab-fuego').innerText)", 5000))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_panel_hoguera_encendida.png')
        A.evaluate(f"{K}.panelFabricar.cerrar()")
        A.add_style_tag(content='#menuUsar, #aviso { visibility: hidden !important; }')
        mirar_hoguera(A, 2.6, 0.42); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_hoguera_ardiendo.png')
        A.evaluate(f"{K}.cielo.poner({{ hora: 22 }})"); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_hoguera_noche.png')
        A.evaluate(f"{K}.cielo.poner({{ hora: 9 }})")

        print('En el móvil, el otro jugador la ve igual')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        comprobar('le llega la hoguera, encendida', esperar(B, f"Object.values({K}.fabCliente.estaciones).some(e => e.tipo === 'hoguera' && e.fuego && e.fuego.hasta > Date.now())", 20000))
        mirar_hoguera(B, 3.2, 0.5)
        comprobar('y la ve arder', esperar(B, LLAMAS + " >= 5", 8000), str(B.evaluate(LLAMAS)))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_hoguera_ardiendo.png')
        ops = B.evaluate(f"{K}.opcionesUsar()")
        comprobar('en el menú del clic derecho: usarla, y no encenderla (ya arde)', 'Usar: Hoguera' in ops and 'Encender: Hoguera' not in ops, str(ops))
        B.evaluate(f"{K}.panelFabricar.abrirEstacion(Object.values({K}.fabCliente.estaciones).find(e => e.tipo === 'hoguera').id)"); B.wait_for_timeout(600)
        comprobar('su panel, con el fuego arriba y sin salirse de lado', B.evaluate("/Encendida/.test(document.querySelector('#panelFabricar .fab-fuego').innerText) && document.documentElement.scrollWidth <= innerWidth + 1"))
        captura(B, f'{SALIDA}/movil_panel_hoguera.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()")
        print('Apagada sola: las cenizas (solo para mirarla: se adelanta su hora en este navegador)')
        B.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones).find(e => e.tipo === 'hoguera'); e.fuego.hasta = Date.now() - 1; }})()")
        comprobar('pasada su hora se apaga sola y quedan las cenizas, sin humo', esperar(B, CENIZAS, 5000))
        comprobar('sin ramas (ya ardieron) y sin luz', B.evaluate(f"!{K}.escena.getObjectByName('estacion_hoguera').getObjectByName('ramas').visible && window.__fuegos().hogueras === 0"))
        comprobar('y el menú ofrece encenderla (aunque no tiene nada que arder)', 'Encender: Hoguera' in B.evaluate(f"{K}.opcionesUsar()"))
        B.add_style_tag(content='#menuUsar, #aviso { visibility: hidden !important; }')
        mirar_hoguera(B, 2.6, 0.5); B.wait_for_timeout(2000)
        captura(B, f'{SALIDA}/movil_hoguera_cenizas.png')

        for nombre, err in [('PC', errA), ('móvil', errB)]:
            malos = [e for e in err if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e]
            comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        nav.close()
finally:
    if servidor.poll() is None: servidor.terminate()
    web.shutdown()
    shutil.rmtree(sitio, ignore_errors=True)

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
