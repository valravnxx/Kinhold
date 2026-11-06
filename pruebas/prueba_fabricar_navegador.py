# Prueba en navegador del panel de fabricación (P3, «De nada a una casa»), en línea con un servidor local.
# Uso: python3 pruebas/prueba_fabricar_navegador.py <html de la demo> <carpeta_capturas>
# Comprueba, en PC (1280×800): el botón «Fabricar» y la tecla H abren el panel; con 3 fibras en la mano, el cordel
# sale en «Puedes hacerlo ya» diciendo que sale de la mano; el leñero, en «Casi», con lo que falta en rojo; la lasca,
# en gris («después»), con la piedra de tallar que hace falta. «Hacer» lo encarga al servidor (la fibra sale de lo que
# lleva en el servidor), sale en «En marcha» y, terminado, «Recoger» le da el cordel (en el servidor). Con una piedra,
# «Poner delante» pone la piedra de tallar (en el servidor, y se dibuja) y la lasca pasa de «después» a «casi».
# En el móvil (390×844), otro jugador ve la piedra de tallar y su panel va a pantalla completa.
# El material sale del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba el panel; el recorrido de jugador
# (pruebas/prueba_recorrido.mjs) ya fabrica sin arcón, con lo que se recoge.
# MUTAR=1 tira los mensajes de objetos que manda la página (como si el panel fabricara solo en el navegador): falla.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_fabricar'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
os.symlink(os.path.join(RAIZ, 'docs/recursos'), f'{sitio}/recursos')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.ThreadingTCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()
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
    return crear_y_confirmar(pg, codigos, f'artesano{_n[0]}', 'clave-de-prueba-123')
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
    crear_cuenta(pg)
    comprobar(f'{nombre}: entra y le llega lo que lleva en el servidor', esperar(pg, f"{K}.enLinea.red.yo && {K}.objetosRed.deServidor", 120000), str(err[:2]))
    return ctx, pg, err
TEXTO = "document.getElementById('panelFabricar').innerText"
def fila(pg, clave):
    return pg.evaluate(f"(() => {{ const f = document.querySelector('#panelFabricar [data-fila=\"{clave}\"]'); return f ? {{ cls: f.className, txt: f.innerText, sec: f.closest('section').className }} : null; }})()")

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")

        print('El panel se abre con el botón y con H')
        comprobar('sale el botón «Fabricar»', A.evaluate("!!document.getElementById('btnFabricar') && !document.getElementById('btnFabricar').hidden"))
        A.click('#btnFabricar'); A.wait_for_timeout(400)
        comprobar('el botón lo abre', A.evaluate(f"{K}.panelFabricar.abierto && !document.getElementById('panelFabricar').hidden"))
        A.keyboard.press('h'); A.wait_for_timeout(300)
        comprobar('H lo cierra', not A.evaluate(f"{K}.panelFabricar.abierto"))
        A.keyboard.press('h'); A.wait_for_timeout(300)
        comprobar('y H lo vuelve a abrir', A.evaluate(f"{K}.panelFabricar.abierto"))
        comprobar('todas las recetas, a la vista (sin aprender ninguna)', A.evaluate("document.querySelectorAll('#panelFabricar [data-fila]').length") >= 25)

        print('Con 3 fibras en la mano')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'fibra', cantidad: 3, a: 'mano:der' }})")
        comprobar('el servidor le da las 3 fibras (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 3) is not None)
        esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-ya [data-fila=\"cordel\"]')", 5000)
        f = fila(A, 'cordel') or {}
        comprobar('el cordel, en «Puedes hacerlo ya»', 'fab-sec-ya' in f.get('sec', ''), str(f))
        comprobar('y dice que la fibra sale de la mano', '3 de la mano' in f.get('txt', ''), f.get('txt', ''))
        f = fila(A, 'lenero') or {}
        comprobar('el leñero, en «Casi», con lo que falta en rojo', 'fab-sec-casi' in f.get('sec', '') and A.evaluate("document.querySelectorAll('#panelFabricar [data-fila=\"lenero\"] .fab-falta').length") == 2, f.get('txt', ''))
        f = fila(A, 'lasca_silex') or {}
        comprobar('la lasca, en gris, con la piedra de tallar que hace falta', 'fab-sec-despues' in f.get('sec', '') and 'piedra de tallar' in f.get('txt', ''), f.get('txt', ''))
        A.wait_for_timeout(500)
        captura(A, f'{SALIDA}/PC_panel.png')

        print('Hacer y recoger, por el servidor')
        A.click('#panelFabricar .fab-hacer[data-receta="cordel"]')
        comprobar('el servidor gasta la fibra de lo que lleva', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 0) is not None)
        comprobar('sale en «En marcha», con lo que le queda', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-marcha .fab-tiempo') && /quedan \\d+ s/.test(document.querySelector('#panelFabricar .fab-sec-marcha').innerText)", 5000))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_en_marcha.png')
        comprobar('terminado (15 s), sale «Recoger»', esperar(A, "!!document.querySelector('#panelFabricar .fab-recoger')", 30000))
        A.click('#panelFabricar .fab-recoger')
        comprobar('y el cordel es suyo en el servidor', servidorDice(lambda d: cuantos(d, yo, 'cordel') >= 1) is not None)
        comprobar('y el panel dice lo que recoge', esperar(A, "/Recoges: 1 × Cordel/.test(document.querySelector('#panelFabricar .fab-aviso').textContent)", 5000))

        print('Poner la piedra de tallar delante')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:izq' }})")
        servidorDice(lambda d: cuantos(d, yo, 'piedra') == 1)
        comprobar('con una piedra, la piedra de tallar se puede poner', esperar(A, "!!document.querySelector('#panelFabricar .fab-poner[data-tipo=\"piedra_tallar\"]')", 5000))
        A.click('#panelFabricar .fab-poner[data-tipo="piedra_tallar"]')
        d = servidorDice(lambda d: any(e['tipo'] == 'piedra_tallar' for e in (d.get('fabricacion') or {}).get('estaciones', [])))
        comprobar('el servidor la tiene, de su autor', d is not None and any(e['autor'] == yo for e in d['fabricacion']['estaciones']))
        comprobar('y se dibuja delante', esperar(A, f"!!{K}.escena.getObjectByName('estacion_piedra_tallar')", 8000))
        comprobar('la lasca pasa de «después» a «casi»', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-casi [data-fila=\"lasca_silex\"]')", 5000), str(fila(A, 'lasca_silex')))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_panel_con_piedra.png')
        A.keyboard.press('h'); A.wait_for_timeout(300)
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 1.1, z: e.z + 1.3 }}); {K}.cam.dist = 3.2; {K}.cam.pitch = 0.5; }})()")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_piedra_tallar.png')
        pos = A.evaluate(f"Object.values({K}.fabCliente.estaciones)[0]")

        print('En el móvil, otro jugador')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        comprobar('el móvil es otro jugador', B.evaluate(f"{K}.enLinea.red.yo") != yo)
        B.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {pos['x']} - 1.0, z: {pos['z']} + 1.4 }}); {K}.cam.dist = 3.2; {K}.cam.pitch = 0.5; }})()")
        comprobar('ve la piedra de tallar del otro', esperar(B, f"!!{K}.escena.getObjectByName('estacion_piedra_tallar')", 20000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_piedra_tallar.png')
        B.tap('#btnFabricar'); B.wait_for_timeout(600)
        r = B.evaluate("(() => { const r = document.getElementById('panelFabricar').getBoundingClientRect(); return [r.width, r.height]; })()")
        comprobar('su panel va a pantalla completa', r[0] >= 389 and r[1] >= 840, str(r))
        comprobar('y sin piedra, la lasca está en «casi» a su lado (la estación es de otro, pero vale)', esperar(B, "!!document.querySelector('#panelFabricar .fab-sec-casi [data-fila=\"lasca_silex\"]')", 5000))
        comprobar('sin salirse de lado', B.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1"))
        captura(B, f'{SALIDA}/movil_panel.png')
        B.evaluate("document.querySelector('#panelFabricar .fab-sec-est').scrollIntoView()"); B.wait_for_timeout(300)
        captura(B, f'{SALIDA}/movil_panel_estaciones.png')

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
