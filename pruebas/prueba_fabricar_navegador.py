# Prueba en navegador del panel de fabricación (P3, «De nada a una casa»), en línea con un servidor local.
# Uso: python3 pruebas/prueba_fabricar_navegador.py <html de la demo> <carpeta_capturas>
# Es el panel del estudio que aprobó valravnx el 6 nov (cartas con imagen, pestañas por dónde se hace, ficha, los dos
# atajos). Comprueba, en PC (1280×800): el botón «Fabricar» y la tecla H abren el panel, en «Con las manos»; en «Todo»
# están todas las recetas, cada carta con su imagen (de los modelos del juego) y ninguna «sin modelo aún». Con 3
# fibras en la mano, el cordel sale en «Puedes hacerlo ya» y su ficha dice que la fibra está «en las manos»; el leñero, en
# «Te falta algo», con lo que falta en rojo en su ficha y el atajo «Hacer antes: 1 cordel de fibra», que lo encarga
# al servidor (la fibra sale de lo que lleva en el servidor): sale en «En marcha» y, terminado, «Recoger» le da el
# cordel (en el servidor). La lasca, en gris, con la piedra de tallar que hace falta. Los puestos de trabajo son obra
# (valravnx, 6 nov): ya no se ponen desde el panel, sino desde el menú de construcción, en su pestaña «Puestos de
# trabajo»; se pone el marco a su lado (en el servidor, sin gastar nada, y se dibuja tenue con su armazón), Usar le
# lleva la piedra y trabaja en él hasta levantarlo, y la lasca pasa a «Te falta algo».
# Depositar (valravnx, 6 nov): con Usar delante de la piedra de tallar se abre el panel en su pestaña, con lo que
# tiene encima y lo que lleva para dejar; lo dejado está en el servidor, se ve puesto encima y tocarlo lo devuelve;
# el atajo «Poner en la piedra de tallar lo que falta» deja el sílex y la piedra de una vez, y la lasca pasa a «ya».
# Reparar (10 nov): un hacha de piedra nueva no se repara; gastada con un par de golpes a un árbol (los cuenta el
# servidor), junto a la piedra de tallar con el cordel dejado en ella, el menú del clic derecho ofrece «Reparar: hacha
# de piedra», y elegirlo la deja nueva en el servidor, gasta el cordel y lo dice.
# En el móvil (390×844), otro jugador ve la piedra de tallar con lo depositado, su panel va a pantalla completa y la
# ficha sube desde abajo al tocar una carta.
# El material sale del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba el panel; el recorrido de jugador
# (pruebas/prueba_recorrido.mjs) ya fabrica sin arcón, con lo que se recoge.
# Acabado nuevo (11 nov): cada sitio dice si está a tu lado o «no hay cerca»; «×3» solo con material para tres, y encarga
# tres seguidas en el servidor.
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

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")

        print('El panel se abre con el botón y con H')
        # (en PC, la pestaña Fabricar del menú con pestañas; en el móvil, el botón del arco del pulgar)
        A.click('#btnMenu'); A.wait_for_timeout(200)
        comprobar('sale la pestaña «Fabricar»', A.is_visible('#tabFabricar'))
        A.click('#tabFabricar'); A.wait_for_timeout(400)
        comprobar('el botón lo abre', A.evaluate(f"{K}.panelFabricar.abierto && !document.getElementById('panelFabricar').hidden"))
        comprobar('en la pestaña «Con las manos»', A.evaluate(f"{K}.panelFabricar.pestana") == 'manos')
        A.keyboard.press('h'); A.wait_for_timeout(300)
        comprobar('H lo cierra', not A.evaluate(f"{K}.panelFabricar.abierto"))
        A.keyboard.press('h'); A.wait_for_timeout(300)
        comprobar('y H lo vuelve a abrir', A.evaluate(f"{K}.panelFabricar.abierto"))
        pestana(A, 'todo')
        comprobar('en «Todo», todas las recetas, a la vista (sin aprender ninguna)', A.evaluate("[...document.querySelectorAll('#panelFabricar .fab-carta[data-fila]')].filter(c => !c.dataset.fila.startsWith('estacion:')).length") >= 25)
        comprobar('cada carta con su imagen, que carga', esperar(A, "[...document.querySelectorAll('#panelFabricar .fab-carta img')].length >= 25 && [...document.querySelectorAll('#panelFabricar .fab-carta img')].every(i => i.complete && i.naturalWidth > 0)", 15000))
        comprobar('y ninguna receta sale «sin modelo aún»', esperar(A, "!document.querySelector('#panelFabricar .fab-carta[data-grupo] .fab-pend') && document.querySelectorAll('#panelFabricar .fab-carta').length > 0", 5000))

        print('Con 3 fibras en la mano')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'fibra', cantidad: 3, a: 'mano:der' }})")
        comprobar('el servidor le da las 3 fibras (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 3) is not None)
        esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-ya [data-fila=\"cordel\"]')", 5000)
        f = fila(A, 'cordel') or {}
        comprobar('el cordel, en «Puedes hacerlo ya»', 'fab-sec-ya' in f.get('sec', ''), str(f))
        t = elegir(A, 'cordel')
        comprobar('y su ficha dice que la fibra está en las manos (3 de 3), y para qué sirve', 'en las manos' in t and '3 de 3' in t and 'Para atar' in t, t)
        comprobar('la carta dice «ya»', A.evaluate("document.querySelector('#panelFabricar .fab-carta[data-fila=\"cordel\"] .fab-estado').textContent") == 'ya')
        comprobar('con fibra para uno, «×3» está pero no se puede (y dice para cuántas hay)', A.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-ficha .fab-hacer3'); return !!b && b.disabled && /solo para 1/.test(b.title); })()"))
        comprobar('sin puestos de trabajo, cada sitio dice que no hay cerca, y «Con las manos», en cualquier sitio', A.evaluate("(() => { const d = k => (document.querySelector(`#panelFabricar .fab-pest[data-pestana=\"${k}\"] .fab-donde`) || {}).textContent; return d('tallar') === 'no hay cerca' && d('manos') === 'en cualquier sitio'; })()"))
        f = fila(A, 'lenero') or {}
        t = elegir(A, 'lenero')
        comprobar('el leñero, en «Te falta algo», con lo que falta en rojo en su ficha', 'fab-sec-casi' in f.get('sec', '') and A.evaluate("document.querySelectorAll('#panelFabricar .fab-ficha .fab-mat.fab-falta').length") == 2, t)
        comprobar('y el atajo «Hacer antes: 1 cordel de fibra», que dice con qué y cuánto tarda', A.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-ficha .fab-antes[data-receta=\"cordel\"]'); return !!b && /Hacer antes: 1 cordel de fibra \\(con 3 fibra cruda · 15 s\\)/.test(b.textContent); })()"), t)
        t = elegir(A, 'lasca_silex')
        comprobar('la lasca, en gris, con la piedra de tallar que hace falta', 'fab-sec-despues' in (fila(A, 'lasca_silex') or {}).get('sec', '') and 'piedra de tallar' in t, t)
        elegir(A, 'lenero')
        A.wait_for_timeout(500)
        captura(A, f'{SALIDA}/PC_panel.png')

        print('Hacer (con el atajo) y recoger, por el servidor')
        A.click('#panelFabricar .fab-antes[data-receta="cordel"]')
        comprobar('el servidor gasta la fibra de lo que lleva', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 0) is not None)
        comprobar('sale en «En marcha», con lo que le queda y su barra', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-marcha .fab-tiempo') && /quedan \\d+ s/.test(document.querySelector('#panelFabricar .fab-sec-marcha').innerText) && !!document.querySelector('#panelFabricar .fab-sec-marcha .fab-barra i')", 5000))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_en_marcha.png')
        comprobar('terminado (15 s), sale «Recoger»', esperar(A, "!!document.querySelector('#panelFabricar .fab-recoger')", 30000))
        A.click('#panelFabricar .fab-recoger')
        ok_c = servidorDice(lambda d: cuantos(d, yo, 'cordel') >= 1) is not None
        comprobar('y el cordel es suyo en el servidor', ok_c)
        if not ok_c:
            try: print('  (lo último que apunta el servidor:', ' | '.join(x[:220] for x in open(os.path.join(sitio, 'objetos.jsonl')).read().strip().split('\n')[-4:]), ')')
            except Exception as e: print('  (sin objetos.jsonl:', e, ')')
            print('  (aviso del panel:', A.evaluate("document.querySelector('#panelFabricar .fab-aviso').textContent"), '· botón:', A.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-recoger'); return b ? 'sigue, disabled=' + b.disabled : 'no está'; })()"), ')')
        comprobar('y el panel dice lo que recoge', esperar(A, "/Recoges: 1 × Cordel/.test(document.querySelector('#panelFabricar .fab-aviso').textContent)", 5000))

        print('Los puestos de trabajo, como obra, desde el menú de construcción (valravnx, 6 nov)')
        comprobar('en el panel ya no se ponen estaciones', not A.evaluate("!!document.querySelector('#panelFabricar .fab-sec-est, #panelFabricar .fab-poner')"))
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: 'mano:izq' }})")
        servidorDice(lambda d: cuantos(d, yo, 'piedra') == 1)
        A.keyboard.press('h'); A.wait_for_timeout(300)
        A.evaluate(f"{K}.cambiarModo('construir')"); A.wait_for_timeout(200)
        A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); A.wait_for_timeout(300)
        menu = A.evaluate("[...document.querySelectorAll('#piezas button.pieza')].map(b => b.innerText)")
        comprobar('la pestaña «Puestos de trabajo», con los cuatro puestos (el hogar, 8 nov), lo que piden y dónde van', A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').textContent") == 'Puestos de trabajo'
                  and len(menu) == 4 and any('Piedra de tallar' in m and '1 piedra' in m for m in menu) and any('Hoguera' in m and 'solo fuera' in m for m in menu) and any('Hogar' in m and 'solo dentro' in m for m in menu), str(menu))
        A.wait_for_timeout(300)
        captura(A, f'{SALIDA}/PC_menu_puestos.png')
        A.evaluate(f"{K}.seleccionar('puesto', 'piedra_tallar')")
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 1, z = {K}.pj.z + 0.2; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); }})()")
        comprobar('el marco se puede poner a su lado', A.evaluate(f"{K}.estado.candidato && {K}.estado.candidato.tipo === 'puesto' && {K}.estado.candidato.v.ok"), str(A.evaluate(f"{K}.estado.candidato && {K}.estado.candidato.v")))
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 9, z = {K}.pj.z; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); }})()")
        comprobar('lejos, no (el marco se pone a tu lado)', A.evaluate(f"!{K}.estado.candidato.v.ok && /lado/.test({K}.estado.candidato.v.motivo)"))
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 1, z = {K}.pj.z + 0.2; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        d = servidorDice(lambda d: any(e['tipo'] == 'piedra_tallar' and e.get('obra') for e in (d.get('fabricacion') or {}).get('estaciones', [])))
        comprobar('el servidor tiene el marco, de su autor, y no ha gastado nada', d is not None and any(e['autor'] == yo for e in d['fabricacion']['estaciones']) and cuantos(d, yo, 'piedra') == 1)
        comprobar('y se dibuja como obra: tenue, con su armazón de estacas', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_piedra_tallar'); return !!o && !!o.getObjectByName('armazon'); }})()", 8000))
        A.evaluate(f"{K}.cambiarModo('mover')")
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 1.3, z: e.z + 0.3, rot: -1.2 }}); {K}.cam.yaw = 0.15; {K}.cam.dist = 3.6; {K}.cam.pitch = 0.55; }})()")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_marco_piedra_tallar.png')
        comprobar('en el menú del clic derecho: la obra y quitar el marco', esperar(A, f"(() => {{ const o = {K}.opcionesUsar(); return o.includes('Obra: Piedra de tallar') && o.includes('Quitar el marco: Piedra de tallar'); }})()", 8000), str(A.evaluate(f"{K}.opcionesUsar()")))
        A.keyboard.press('f')
        d = servidorDice(lambda d: any(e['tipo'] == 'piedra_tallar' and not e.get('obra') for e in d['fabricacion']['estaciones']), 30000)
        comprobar('Usar le lleva la piedra y trabaja en él hasta levantarlo (en el servidor)', d is not None and cuantos(d, yo, 'piedra') == 0, A.evaluate("document.getElementById('aviso').textContent"))
        comprobar('y se dibuja levantada, sin armazón', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_piedra_tallar'); return !!o && !o.getObjectByName('armazon'); }})()", 8000))
        comprobar('y el aviso lo dice', esperar(A, "/Puesto terminado/.test(document.getElementById('aviso').textContent)", 5000), A.evaluate("document.getElementById('aviso').textContent"))
        A.keyboard.press('h'); A.wait_for_timeout(300)
        pestana(A, 'todo')
        comprobar('la lasca pasa a «Te falta algo»', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-casi [data-fila=\"lasca_silex\"]')", 5000), str(fila(A, 'lasca_silex')))
        comprobar('y la pestaña de la piedra de tallar dice que está a tu lado', esperar(A, "(document.querySelector('#panelFabricar .fab-pest[data-pestana=\"tallar\"] .fab-donde') || {}).textContent === 'a tu lado'", 5000))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_panel_con_piedra.png')
        A.keyboard.press('h'); A.wait_for_timeout(300)
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 1.3, z: e.z + 0.3, rot: -1.2 }}); {K}.cam.yaw = 0.15; {K}.cam.dist = 3.6; {K}.cam.pitch = 0.55; }})()")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_piedra_tallar.png')
        pos = A.evaluate(f"Object.values({K}.fabCliente.estaciones)[0]")

        print('Depositar en la piedra de tallar (valravnx, 6 nov): sus recetas gastan lo depositado en ella')
        idPt = pos['id']
        def pulsar(clase, texto, ms=8000):   # pulsa el hueco de esa clase que dice texto (cuando ya esté)
            return esperar(A, f"(() => {{ const b = [...document.querySelectorAll('#panelFabricar .{clase}')].find(b => !b.disabled && (b.title + ' ' + b.innerText).includes('{texto}')); if (b) b.click(); return !!b; }})()", ms)
        print('  lleva:', A.evaluate(f"JSON.stringify(Object.fromEntries(Object.entries({K}.inventario.lugares).filter(([l, c]) => c && l.startsWith('mano')).map(([l, c]) => [l, c.tipo])))"))
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'silex', cantidad: 1, a: 'mano:izq' }})")
        servidorDice(lambda d: cuantos(d, yo, 'silex') == 1)
        A.keyboard.press('f'); A.wait_for_timeout(500)
        comprobar('Usar delante de la piedra de tallar abre el panel en su pestaña', A.evaluate(f"{K}.panelFabricar.abierto && {K}.panelFabricar.pestana === 'tallar'"), str(A.evaluate(f"{K}.panelFabricar.pestana")))
        comprobar('con lo que tiene encima (nada) y lo que lleva para dejar', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-dep .fab-dejar img') && /No hay nada/.test(document.querySelector('#panelFabricar .fab-sec-dep').innerText)", 8000))
        comprobar('con el sílex en la mano, la lasca sigue en «Te falta algo» (no está depositado)', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-casi [data-fila=\"lasca_silex\"]')", 8000))
        comprobar('sale el cordel que lleva, para dejarlo', pulsar('fab-dejar', 'Cordel'))
        d = servidorDice(lambda d: any(e.get('deposito', {}).get('cordel') == 1 for e in d['fabricacion']['estaciones']))
        if d is None:
            try:
                l = open(os.path.join(sitio, 'objetos.jsonl')).read().strip().split('\n')[-4:]
                print('  (lo último que apunta el servidor:', ' | '.join(x[:220] for x in l), ')')
            except Exception as e: print('  (sin objetos.jsonl:', e, ')')
            print('  (aviso del panel:', A.evaluate("document.querySelector('#panelFabricar .fab-aviso').textContent"), '· abierto:', A.evaluate(f"{K}.panelFabricar.abierto + ' ' + {K}.panelFabricar.pestana"), '· pj:', A.evaluate(f"[{K}.pj.x, {K}.pj.z]"), '· estación:', A.evaluate(f"JSON.stringify(Object.values({K}.fabCliente.estaciones).map(e => [e.id, e.x, e.z]))"), ')')
        comprobar('dejarlo lo deposita en el servidor', d is not None and cuantos(d, yo, 'cordel') == 0)
        esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-dep [data-dep=\"cordel\"]')", 5000)
        comprobar('y sale encima de la piedra de tallar, para cogerlo', pulsar('fab-coger', 'Cordel'))
        d = servidorDice(lambda d: cuantos(d, yo, 'cordel') == 1)
        comprobar('cogerlo lo devuelve a lo que lleva', d is not None and not any(e.get('deposito', {}).get('cordel') for e in d['fabricacion']['estaciones']))
        pulsar('fab-dejar', 'Cordel')
        servidorDice(lambda d: cuantos(d, yo, 'cordel') == 0)   # el cordel se queda en ella: hace falta una mano libre
        libre = A.evaluate(f"['mano:der', 'mano:izq'].find(l => !{K}.inventario.lugares[l])") or 'mano:der'
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'piedra', cantidad: 1, a: '{libre}' }})")
        comprobar('coge una piedra con la mano libre', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 1) is not None)
        A.wait_for_timeout(1200)
        t = elegir(A, 'lasca_silex')
        comprobar('la ficha de la lasca tiene el atajo «Poner en la piedra de tallar lo que falta: 1 sílex y 1 piedra (los llevas tú)»', esperar(A, "(() => { const b = document.querySelector('#panelFabricar .fab-poner-falta'); return !!b && /Poner en la piedra de tallar lo que falta: 1 sílex y 1 piedra \\(los llevas tú\\)/.test(b.textContent); })()", 5000), t)
        A.wait_for_timeout(300)
        captura(A, f'{SALIDA}/PC_panel_estacion.png')
        A.click('#panelFabricar .fab-poner-falta')
        d = servidorDice(lambda d: any(e.get('deposito') == {'cordel': 1, 'silex': 1, 'piedra': 1} for e in d['fabricacion']['estaciones']))
        comprobar('de un toque: el servidor tiene el sílex y la piedra en la piedra de tallar', d is not None and cuantos(d, yo, 'silex') == 0 and cuantos(d, yo, 'piedra') == 0, str(d and d['fabricacion']['estaciones']))
        comprobar('la lasca pasa a «Puedes hacerlo ya», y su ficha dice que sale de la estación', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-ya [data-fila=\"lasca_silex\"]') && /en la estación/.test(document.querySelector('#panelFabricar .fab-ficha').innerText)", 6000), str(fila(A, 'lasca_silex')))
        comprobar('y se ven puestos encima de la piedra de tallar', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_piedra_tallar'); return !!o && !!o.getObjectByName('deposito_silex') && !!o.getObjectByName('deposito_piedra'); }})()", 6000))
        A.wait_for_timeout(400)
        captura(A, f'{SALIDA}/PC_panel_deposito.png')
        A.keyboard.press('h'); A.wait_for_timeout(300)
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 1.3, z: e.z + 0.3, rot: -1.2 }}); {K}.cam.yaw = 0.15; {K}.cam.dist = 2.6; {K}.cam.pitch = 0.6; }})()")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_piedra_tallar_con_deposito.png')

        print('Reparar en su puesto (10 nov): el hacha de piedra gastada, en la piedra de tallar, con el cordel dejado en ella')
        def usado_hacha(d):
            j = d['inventarios']['jugadores'].get(yo) or {}
            for c in (j.get('lugares') or {}).values():
                if isinstance(c, dict) and c.get('tipo') == 'hacha_piedra': return c.get('usado', 0)
            return None
        libre = A.evaluate(f"['mano:der', 'mano:izq'].find(l => !{K}.inventario.lugares[l])") or 'mano:der'
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'hacha_piedra', cantidad: 1, a: '{libre}' }})")
        comprobar('coge un hacha de piedra (nueva)', servidorDice(lambda d: usado_hacha(d) == 0) is not None)
        comprobar('nueva, el menú no ofrece repararla', 'Reparar: hacha de piedra' not in A.evaluate(f"{K}.opcionesUsar()"))
        # un par de golpes a un árbol, como un jugador (el servidor cuenta cada uno), y vuelta a la piedra de tallar
        arb = A.evaluate(f"""(() => {{ const k = {K}, e = Object.values(k.fabCliente.estaciones)[0];
          const a = k.obstaculos.filter(o => o.arbol && o.id && k.talaV.enPie(o)).sort((p, q) => Math.hypot(p.x - e.x, p.z - e.z) - Math.hypot(q.x - e.x, q.z - e.z))[0];
          if (!a) return null; const d = Math.hypot(a.x - e.x, a.z - e.z) || 1;
          Object.assign(k.pj, {{ x: a.x - (a.x - e.x) / d * (a.r + 0.6), z: a.z - (a.z - e.z) / d * (a.r + 0.6) }}); k.pj.rot = Math.atan2(a.x - k.pj.x, a.z - k.pj.z);
          return {{ id: a.id, x: a.x, z: a.z }}; }})()""")
        A.wait_for_timeout(1500)
        if arb: A.evaluate(f"{K}.usar()")
        d = servidorDice(lambda d: (usado_hacha(d) or 0) >= 2, 30000)
        A.evaluate(f"{K}.estado.talando = null")
        comprobar('talando, el servidor gasta el hacha', d is not None, str(arb))
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 1.3, z: e.z + 0.3, rot: -1.2 }}); {K}.cam.yaw = 0.15; {K}.cam.dist = 2.6; {K}.cam.pitch = 0.6; }})()")
        A.wait_for_timeout(1500)
        gastado = usado_hacha(json.load(open(OBJETOS))) or 0
        ops = A.evaluate(f"{K}.opcionesUsar()")
        comprobar('gastada, junto a la piedra de tallar, el menú del clic derecho ofrece «Reparar: hacha de piedra»', 'Reparar: hacha de piedra' in ops, str(ops))
        sitio_pt = A.evaluate(f"""(() => {{ const k = {K}, e = Object.values(k.fabCliente.estaciones)[0], v = new k.camara.position.constructor(e.x, k.alturaSuelo(e.x, e.z) + 0.2, e.z).project(k.camara);
          return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }})()""")
        A.evaluate(f"{K}.abrirMenuUsar({sitio_pt[0]}, {sitio_pt[1]})"); A.wait_for_timeout(400)
        menu = A.evaluate(f"{K}.menuUsar()") or []
        comprobar('y sale en el menú, junto al puesto', any('Reparar: hacha de piedra' in m for m in menu), str(menu))
        captura(A, f'{SALIDA}/PC_menu_reparar.png')
        A.evaluate("(() => { const b = [...document.querySelectorAll('#menuUsar button')].find(b => /Reparar/.test(b.textContent)); if (b) b.click(); })()")
        d = servidorDice(lambda d: usado_hacha(d) == 0 and not any(e.get('deposito', {}).get('cordel') for e in d['fabricacion']['estaciones']))
        comprobar(f'al elegirlo, el servidor la repara (de {gastado} usos a 0: recupera hasta 84) y gasta el cordel dejado en la piedra de tallar', d is not None and gastado >= 2)
        comprobar('y lo dice, con lo que le queda', esperar(A, "/Reparado: hacha de piedra\\. Le quedan 168 usos de 168/.test(document.getElementById('aviso').textContent)", 5000), A.evaluate("document.getElementById('aviso').textContent"))
        A.wait_for_timeout(300)
        captura(A, f'{SALIDA}/PC_reparado.png')
        comprobar('nueva otra vez, el menú ya no ofrece repararla', 'Reparar: hacha de piedra' not in A.evaluate(f"{K}.opcionesUsar()"))
        A.evaluate(f"(() => {{ const l = ['mano:der', 'mano:izq'].find(l => {K}.inventario.lugares[l] && {K}.inventario.lugares[l].tipo === 'hacha_piedra'); if (l) {K}.accionInventario({{ tipo: 'soltar', de: l }}); }})()")

        print('En el móvil, otro jugador')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        comprobar('el móvil es otro jugador', B.evaluate(f"{K}.enLinea.red.yo") != yo)
        B.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {pos['x']} - 0.6, z: {pos['z']} + 1.7, rot: 2.8 }}); {K}.cam.yaw = 0.35; {K}.cam.dist = 3.4; {K}.cam.pitch = 0.75; }})()")
        comprobar('ve la piedra de tallar del otro', esperar(B, f"!!{K}.escena.getObjectByName('estacion_piedra_tallar')", 20000))
        comprobar('y lo depositado en ella, puesto encima', esperar(B, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_piedra_tallar'); return !!o && !!o.getObjectByName('deposito_silex'); }})()", 10000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_piedra_tallar.png')
        B.tap('#btnFabricar'); B.wait_for_timeout(600)
        r = B.evaluate("(() => { const r = document.getElementById('panelFabricar').getBoundingClientRect(); return [r.width, r.height]; })()")
        comprobar('su panel ocupa casi la pantalla (el tablero del menú)', r[0] >= 380 and r[1] >= 650, str(r))
        B.tap('#panelFabricar .fab-pest[data-pestana="tallar"]'); B.wait_for_timeout(500)
        comprobar('en la pestaña de la piedra de tallar, con lo que A ha dejado en ella, la lasca ya está en «Puedes hacerlo ya» a su lado (la estación es de otro, pero vale)', esperar(B, "!!document.querySelector('#panelFabricar .fab-sec-ya [data-fila=\"lasca_silex\"]')", 5000))
        comprobar('y ve lo depositado, con su imagen', esperar(B, "!!document.querySelector('#panelFabricar .fab-sec-dep [data-dep=\"silex\"] img')", 10000))   # (el móvil, con swiftshader, tarda en dar un fotograma)
        comprobar('sin salirse de lado', B.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1"))
        comprobar('la ficha no tapa nada mientras no se toca una carta', B.evaluate("document.querySelector('#panelFabricar .fab-ficha').getBoundingClientRect().top >= innerHeight - 2"))
        B.wait_for_timeout(500)
        captura(B, f'{SALIDA}/movil_panel.png')
        B.tap('#panelFabricar .fab-carta[data-fila="lasca_silex"]')
        sube = esperar(B, "(() => { const r = document.querySelector('#panelFabricar .fab-ficha').getBoundingClientRect(); return r.top > 100 && r.bottom <= innerHeight + 1; })()", 8000)   # (sube con una transición corta)
        rf = B.evaluate("(() => { const r = document.querySelector('#panelFabricar .fab-ficha').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; })()")
        comprobar('al tocar una carta, su ficha sube desde abajo, dentro de la pantalla', sube, str(rf))
        comprobar('con «Hacer» a mano', B.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-ficha .fab-hacer'); if (!b) return false; const r = b.getBoundingClientRect(); return r.height >= 40 && r.bottom <= innerHeight; })()"))
        captura(B, f'{SALIDA}/movil_ficha.png')
        B.tap('#panelFabricar .fab-velo', position={'x': 195, 'y': 60}); B.wait_for_timeout(500)
        comprobar('y tocando fuera se vuelve a bajar', B.evaluate("!document.getElementById('panelFabricar').classList.contains('fab-ficha-abierta')"))
        B.evaluate(f"{K}.panelFabricar.cerrar()"); B.wait_for_timeout(500)
        B.evaluate(f"{K}.cambiarModo('construir')"); B.wait_for_timeout(200)
        B.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); B.wait_for_timeout(500)
        comprobar('en el móvil, la pestaña de los puestos en el menú de construcción, sin salirse de lado', B.evaluate("document.querySelectorAll('#piezas button.pieza').length === 4 && document.documentElement.scrollWidth <= innerWidth + 1"))
        captura(B, f'{SALIDA}/movil_menu_puestos.png')
        B.evaluate(f"{K}.cambiarModo('mover')")

        print('Las tres estaciones de cerca, con algo depositado (solo para mirarlas: la hoguera y el banco se dibujan aquí, no se ponen)')
        A.evaluate(f"""(() => {{ const f = {K}.fabCliente, e = Object.values(f.estaciones)[0];
          f.estaciones['hoguera:vista'] = {{ id: 'hoguera:vista', tipo: 'hoguera', x: e.x - 1.6, z: e.z + 0.2, autor: 'vista', cola: [], deposito: {{ rama: 3, fibra: 2 }} }};
          f.estaciones['banco_tronco:vista'] = {{ id: 'banco_tronco:vista', tipo: 'banco_tronco', x: e.x + 1.7, z: e.z - 0.3, autor: 'vista', cola: [], deposito: {{ mimbre: 2, tronco_corto: 1 }} }};
          {K}.estacionesV.refrescar(); Object.assign({K}.pj, {{ x: e.x + 0.2, z: e.z + 3.2, rot: 0 }}); {K}.cam.yaw = 0; {K}.cam.dist = 3.4; {K}.cam.pitch = 0.62; }})()""")
        comprobar('la hoguera y el banco de tronco se dibujan', A.evaluate(f"!!{K}.escena.getObjectByName('estacion_hoguera') && !!{K}.escena.getObjectByName('estacion_banco_tronco')"))
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_tres_estaciones.png')

        print('«Hacer ×3»: con fibra para tres, encarga tres cordeles seguidos, en el servidor')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'fibra', cantidad: 9, a: 'mano:izq' }})")
        comprobar('el servidor le da 9 fibras', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 9) is not None)
        A.evaluate(f"{K}.panelFabricar.cerrar()"); A.keyboard.press('h'); A.wait_for_timeout(600)
        t = elegir(A, 'cordel')
        comprobar('la carta dice para cuántas hay', A.evaluate("document.querySelector('#panelFabricar .fab-carta[data-fila=\"cordel\"] .fab-estado').textContent") == 'ya · para 3')
        comprobar('y «×3» se puede', A.evaluate("(() => { const b = document.querySelector('#panelFabricar .fab-ficha .fab-hacer3'); return !!b && !b.disabled; })()"))
        captura(A, f'{SALIDA}/PC_hacer_tres.png')
        antes = A.evaluate("document.querySelectorAll('#panelFabricar .fab-sec-marcha .fab-enc').length")
        A.evaluate("document.querySelector('#panelFabricar .fab-ficha .fab-hacer3').click()")
        comprobar('el servidor gasta las 9 fibras', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 0) is not None)
        comprobar('y salen tres más en «En marcha», cada una con su barra', esperar(A, f"document.querySelectorAll('#panelFabricar .fab-sec-marcha .fab-enc').length === {antes} + 3 && /Encargado: Cordel de fibra ×3/.test(document.querySelector('#panelFabricar .fab-aviso').textContent)", 8000), A.evaluate("document.querySelector('#panelFabricar .fab-pie').innerText"))
        captura(A, f'{SALIDA}/PC_en_marcha_tres.png')

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
