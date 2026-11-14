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
import re, sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_fabricar'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
# ROMPER=era deja la era sin despejar la hierba y sin tenderse sobre el terreno (las dos comprobaciones de la era fallan)
ROMPER = os.environ.get('ROMPER', '')

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
    return crear_y_confirmar(pg, codigos, f'artesano{_n[0]}', 'clave-de-prueba-123')
def entrar(nav, nombre, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    if ROMPER == 'era': ctx.add_init_script("window.__sinDespejarEras = true; window.__sinAsentar = true;")
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
        comprobar('con las manos no sale «×3» (se hace una cosa a la vez)', A.evaluate("!!document.querySelector('#panelFabricar .fab-ficha .fab-hacer') && !document.querySelector('#panelFabricar .fab-ficha .fab-hacer3')"))
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
        nombres = [m.split('\n')[0] for m in menu]
        comprobar('la pestaña «Puestos de trabajo», con los siete puestos (el hogar, 8 nov; el secadero, el raspador de pieles y la era, 13 nov) y lo que piden (cada carta, sus materiales: lo que tienes / lo que pide)', A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').textContent") == 'Puestos de trabajo'
                  and nombres == ['Hoguera', 'Hogar', 'Piedra de tallar', 'Banco de trabajo de tronco', 'Secadero', 'Raspador de pieles', 'Era'] and menu[5].split('\n')[1:] == ['4', '/0', '1', '/0'] and menu[4].split('\n')[1:] == ['4', '/0', '2', '/0'] and menu[2].split('\n')[1:] == ['1', '/1'] and menu[6].split('\n')[1:3] == ['8', '/1'], str(menu))
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
        print('Lejos de la piedra de tallar, la pestaña dice a cuántos pasos')
        A.keyboard.press('h'); A.wait_for_timeout(300)
        A.evaluate(f"(() => {{ const e = Object.values({K}.fabCliente.estaciones)[0]; Object.assign({K}.pj, {{ x: e.x + 9, z: e.z }}); }})()")
        A.wait_for_timeout(300); A.keyboard.press('h'); A.wait_for_timeout(500)
        comprobar('a 9 m, la pestaña de la piedra de tallar dice «a 9 pasos»', esperar(A, "(document.querySelector('#panelFabricar .fab-pest[data-pestana=\"tallar\"] .fab-donde') || {}).textContent === 'a 9 pasos'", 5000), A.evaluate("(document.querySelector('#panelFabricar .fab-pest[data-pestana=\"tallar\"] .fab-donde') || {}).textContent || ''"))
        A.wait_for_timeout(300)
        captura(A, f'{SALIDA}/PC_panel_a_pasos.png')
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

        print('El secadero (P9, 13 nov), con carne colgada: seca, secándose y por secar (solo para mirarlo: se dibuja aquí), y su pestaña')
        SECADERO = f"""((K, dx, dz) => {{ const f = K.fabCliente, e = Object.values(f.estaciones).find(x => x.tipo === 'piedra_tallar'), ahora = Date.now();
          f.estaciones['secadero:vista'] = {{ id: 'secadero:vista', tipo: 'secadero', x: e.x + dx, z: e.z + dz, autor: K.enLinea.red.yo, cola: [], deposito: {{ carne_cruda: 2 }},
            colgado: [{{ hasta: ahora - 1000 }}, {{ hasta: ahora + 3 * 3600e3 }}] }};
          // que se quede aunque el servidor vuelva a mandar las estaciones (las de verdad, más este)
          K.__vista = f.estaciones['secadero:vista'];
          if (!K.estacionesV.__poner) {{ K.estacionesV.__poner = K.estacionesV.poner; K.estacionesV.poner = l => {{ K.estacionesV.__poner(l); if (K.__vista) {{ K.fabCliente.estaciones[K.__vista.id] = K.__vista; K.estacionesV.refrescar(); }} }}; }}
          K.estacionesV.refrescar(); K.mirarEras(); }})"""
        A.evaluate(f"{SECADERO}({K}, 0.5, -3.5)")
        n = A.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_secadero'), d = o && o.getObjectByName('deposito'); let n = 0; if (d) d.traverse(m => {{ if (m.isMesh) n++; }}); return n; }})()")
        comprobar('el secadero se dibuja, con lo colgado', A.evaluate(f"!!{K}.escena.getObjectByName('estacion_secadero')") and n > 0, str(n))
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['secadero:vista']; Object.assign({K}.pj, {{ x: e.x + 1.8, z: e.z + 1.6, rot: 2.3 }}); {K}.cam.yaw = 0.25; {K}.cam.dist = 4.2; {K}.cam.pitch = 0.32; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_secadero.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['secadero:vista']; Object.assign({K}.pj, {{ x: e.x + 1.4, z: e.z + 0.6, rot: 2 }}); {K}.cam.yaw = 0.05; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.12; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_secadero_cerca.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['secadero:vista']; Object.assign({K}.pj, {{ x: e.x + 0.4, z: e.z + 1.2 }}); }})()""")
        A.evaluate(f"{K}.panelFabricar.abrirEstacion('secadero:vista')"); A.wait_for_timeout(800)
        comprobar('su pestaña «Secadero», con la carne seca: 1 carne cruda, 6 h', esperar(A, "!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"secar\"]') && /Carne seca/.test(document.getElementById('panelFabricar').innerText)", 6000), A.evaluate("document.getElementById('panelFabricar').innerText")[:300])
        t = elegir(A, 'secar_carne')
        comprobar('la ficha dice lo que tarda (6 h) y para qué sirve', '6 h' in t and 'no se estropea' in t, t[:300])
        captura(A, f'{SALIDA}/PC_panel_secadero.png')
        A.evaluate(f"{K}.panelFabricar.cerrar()")

        print('El raspador de pieles (P9, 13 nov): uno con una piel por raspar tensada (y otra al pie) y otro con una limpia; y su pestaña (el zurrón puesto, en prueba_llevado_navegador.py)')
        RASPADOR = f"""((K, dx, dz) => {{ const f = K.fabCliente, e = Object.values(f.estaciones).find(x => x.tipo === 'piedra_tallar');
          K.__vistas = K.__vistas || {{}};
          K.__vistas['raspador:vista'] = {{ id: 'raspador:vista', tipo: 'raspador', x: e.x + dx, z: e.z + dz, giro: 0, autor: K.enLinea.red.yo, cola: [], deposito: {{ piel: 2 }} }};
          K.__vistas['raspador:vista2'] = {{ id: 'raspador:vista2', tipo: 'raspador', x: e.x + dx + 1.9, z: e.z + dz - 0.2, giro: -0.3, autor: 'vista', cola: [], deposito: {{ piel_limpia: 1 }} }};
          Object.assign(f.estaciones, K.__vistas);
          if (!K.estacionesV.__poner2) {{ K.estacionesV.__poner2 = K.estacionesV.poner; K.estacionesV.poner = l => {{ K.estacionesV.__poner2(l); Object.assign(K.fabCliente.estaciones, K.__vistas); K.estacionesV.refrescar(); }}; }}
          K.estacionesV.refrescar(); }})"""
        A.evaluate(f"{RASPADOR}({K}, -3.5, -5.5)")
        n = A.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_raspador'), d = o && o.getObjectByName('deposito'); let n = 0; if (d) d.traverse(m => {{ if (m.isMesh) n++; }}); return n; }})()")
        comprobar('el raspador se dibuja, con la piel tensada y la otra al pie', A.evaluate(f"!!{K}.escena.getObjectByName('estacion_raspador')") and n >= 2, str(n))
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x + 1.0, z: e.z + 2.6, rot: 2.8 }}); {K}.cam.yaw = 0.1; {K}.cam.dist = 3.6; {K}.cam.pitch = 0.25; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_raspador.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x + 0.5, z: e.z + 1.5, rot: 2.9 }}); {K}.cam.yaw = -0.15; {K}.cam.dist = 2.2; {K}.cam.pitch = 0.12; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_raspador_cerca.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x - 0.6, z: e.z - 1.6, rot: 0.2 }}); {K}.cam.yaw = Math.PI - 0.3; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.15; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_raspador_detras.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x + 0.3, z: e.z + 1.1 }}); }})()""")
        A.evaluate(f"{K}.panelFabricar.abrirEstacion('raspador:vista')"); A.wait_for_timeout(800)
        comprobar('su pestaña «Raspador de pieles», con la piel limpia: 1 piel, y pide llevar la lasca', esperar(A, "!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"raspar\"]') && /Piel limpia/.test(document.getElementById('panelFabricar').innerText)", 6000), A.evaluate("document.getElementById('panelFabricar').innerText")[:300])
        t = elegir(A, 'raspar_piel')
        comprobar('la ficha dice para qué sirve y que hace falta la lasca de sílex', 'zurrón' in t and re.search('lasca', t, re.I) is not None, t[:300])
        captura(A, f'{SALIDA}/PC_panel_raspador.png')
        A.evaluate(f"{K}.panelFabricar.cerrar()")

        print('La era (P11, 13 nov), con dos gavillas por trillar (solo para mirarla: se dibuja aquí), y su pestaña')
        ERA = f"""((K, dx, dz) => {{ const f = K.fabCliente, e = Object.values(f.estaciones).find(x => x.tipo === 'piedra_tallar');
          f.estaciones['era:vista'] = {{ id: 'era:vista', tipo: 'era', x: e.x + dx, z: e.z + dz, autor: K.enLinea.red.yo, cola: [], deposito: {{ gavilla: 2 }} }};
          K.__vistas = K.__vistas || {{}}; K.__vistas['era:vista'] = f.estaciones['era:vista'];
          if (!K.estacionesV.__poner2) {{ K.estacionesV.__poner2 = K.estacionesV.poner; K.estacionesV.poner = l => {{ K.estacionesV.__poner2(l); Object.assign(K.fabCliente.estaciones, K.__vistas); K.estacionesV.refrescar(); }}; }}
          K.estacionesV.refrescar(); K.mirarEras(); }})"""
        A.evaluate(f"{ERA}({K}, -3.5, 1)")
        comprobar('y sin hierba encima: el suelo de la era despeja la hierba densa, las flores y las matas', A.evaluate(f"(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; return {K}.erasDespejadas().some(c => Math.hypot(c[0] - e.x, c[1] - e.z) < 0.01 && c[2] > 1.45); }})()"))
        comprobar('y tendida sobre el terreno: su suelo y sus piedras siguen la cuesta (sin la explanada enterrada)', A.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_era'), m = o && o.getObjectByName('modelo'); return !!m && m.userData.asentado === 'era' && !m.getObjectByName('bajo_tierra').visible; }})()"))
        comprobar('la era se dibuja, con las gavillas encima', A.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('estacion_era'); return !!o && !!o.getObjectByName('deposito_gavilla'); }})()"))
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; Object.assign({K}.pj, {{ x: e.x + 2.2, z: e.z + 2.0, rot: 2.3 }}); {K}.cam.yaw = 0.7; {K}.cam.dist = 4.6; {K}.cam.pitch = 0.45; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_era.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; Object.assign({K}.pj, {{ x: e.x + 1.9, z: e.z + 0.4, rot: 1.8 }}); {K}.cam.yaw = 1.2; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.3; }})()""")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_era_cerca.png')
        A.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; Object.assign({K}.pj, {{ x: e.x + 1.2, z: e.z + 0.8 }}); }})()""")
        A.evaluate(f"{K}.panelFabricar.abrirEstacion('era:vista')"); A.wait_for_timeout(800)
        comprobar('su pestaña «Era», con trillar una gavilla', esperar(A, "!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"trillar\"]') && /Trillar una gavilla/.test(document.getElementById('panelFabricar').innerText)", 6000), A.evaluate("document.getElementById('panelFabricar').innerText")[:300])
        t = elegir(A, 'trillar')
        comprobar('la ficha pide el mayal y dice lo que da (grano y paja)', 'mayal' in t.lower() and 'paja' in t.lower(), t[:400])
        captura(A, f'{SALIDA}/PC_panel_era.png')
        A.evaluate(f"{K}.panelFabricar.cerrar()")
        print('Las tres estaciones de cerca, con algo depositado (solo para mirarlas: la hoguera y el banco se dibujan aquí, no se ponen)')
        A.evaluate(f"""(() => {{ const f = {K}.fabCliente, e = Object.values(f.estaciones)[0];
          f.estaciones['hoguera:vista'] = {{ id: 'hoguera:vista', tipo: 'hoguera', x: e.x - 1.6, z: e.z + 0.2, autor: 'vista', cola: [], deposito: {{ rama: 3, fibra: 2 }} }};
          f.estaciones['banco_tronco:vista'] = {{ id: 'banco_tronco:vista', tipo: 'banco_tronco', x: e.x + 1.7, z: e.z - 0.3, autor: 'vista', cola: [], deposito: {{ mimbre: 2, tronco_corto: 1 }} }};
          {K}.estacionesV.refrescar(); Object.assign({K}.pj, {{ x: e.x + 0.2, z: e.z + 3.2, rot: 0 }}); {K}.cam.yaw = 0; {K}.cam.dist = 3.4; {K}.cam.pitch = 0.62; }})()""")
        comprobar('la hoguera y el banco de tronco se dibujan', A.evaluate(f"!!{K}.escena.getObjectByName('estacion_hoguera') && !!{K}.escena.getObjectByName('estacion_banco_tronco')"))
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_tres_estaciones.png')

        print('Con fibra para tres, la carta lo dice; con las manos se hace de una en una (no hay «×3»), en el servidor')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'fibra', cantidad: 9, a: 'mano:izq' }})")
        comprobar('el servidor le da 9 fibras', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 9) is not None)
        A.evaluate(f"{K}.panelFabricar.cerrar()"); A.keyboard.press('h'); A.wait_for_timeout(600)
        t = elegir(A, 'cordel')
        comprobar('la carta dice para cuántas hay', A.evaluate("document.querySelector('#panelFabricar .fab-carta[data-fila=\"cordel\"] .fab-estado').textContent") == 'ya · para 3')
        comprobar('y no ofrece «×3»', A.evaluate("!document.querySelector('#panelFabricar .fab-ficha .fab-hacer3')"))
        captura(A, f'{SALIDA}/PC_hacer_tres.png')
        A.evaluate("document.querySelector('#panelFabricar .fab-ficha .fab-hacer').click()")
        comprobar('«Hacer» gasta 3 fibras en el servidor', servidorDice(lambda d: cuantos(d, yo, 'fibra') == 6) is not None)
        comprobar('y sale en «En marcha», con su barra', esperar(A, "!!document.querySelector('#panelFabricar .fab-sec-marcha .fab-barra i')", 8000))
        captura(A, f'{SALIDA}/PC_en_marcha_tres.png')

        print('Cribar el grano (P11, 14 nov): con la criba de grano en la mano, el grano sin limpiar de trillar da grano de cebada')
        A.evaluate(f"{K}.panelFabricar.cerrar()")
        A.evaluate(f"(() => {{ for (const m of ['mano:der', 'mano:izq']) if ({K}.inventario.lugares[m]) {K}.accionInventario({{ tipo: 'soltar', de: m, cantidad: {K}.inventario.lugares[m].n }}); }})()")
        comprobar('suelta lo de las manos', esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000))
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'grano_sucio', cantidad: 3, a: 'mano:izq' }})")
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'criba_grano', cantidad: 1, a: 'mano:der' }})")
        comprobar('el servidor le da la criba de grano y 3 de grano sin limpiar', servidorDice(lambda d: cuantos(d, yo, 'criba_grano') == 1 and cuantos(d, yo, 'grano_sucio') == 3) is not None)
        A.keyboard.press('h'); A.wait_for_timeout(600)
        t = elegir(A, 'cribar')
        comprobar('la carta «Cribar el grano», ya; su ficha pide la criba de grano y da grano de cebada', A.evaluate("(document.querySelector('#panelFabricar .fab-carta[data-fila=\"cribar\"] .fab-estado') || {}).textContent || ''").startswith('ya') and 'criba de grano' in t.lower() and 'grano de cebada' in t.lower(), t[:300])
        captura(A, f'{SALIDA}/PC_cribar.png')
        A.evaluate("document.querySelector('#panelFabricar .fab-ficha .fab-hacer').click()")
        comprobar('«Hacer» gasta 1 de grano sin limpiar en el servidor', servidorDice(lambda d: cuantos(d, yo, 'grano_sucio') == 2) is not None)
        A.evaluate(f"{K}.panelFabricar.cerrar()")
        A.evaluate(f"(() => {{ {K}.cam.yaw = 2.2; {K}.cam.dist = 2.2; {K}.cam.pitch = 0.2; }})()")
        A.wait_for_timeout(2500)
        comprobar('la criba se ve en la mano (con su modelo, no el hatillo)', A.evaluate(f"(() => {{ let g = null; {K}.escena.traverse(o => {{ if (o.name === 'llevado_mano_r') g = o; }}); return !!g && !g.userData.generico; }})()"))
        captura(A, f'{SALIDA}/PC_criba_mano.png')
        A.evaluate(f"(() => {{ {K}.cam.yaw = 0.4; {K}.cam.dist = 2.2; {K}.cam.pitch = 0.2; }})()")
        A.wait_for_timeout(2000)
        captura(A, f'{SALIDA}/PC_criba_mano_frente.png')
        A.evaluate(f"(() => {{ for (const m of ['mano:der', 'mano:izq']) if ({K}.inventario.lugares[m]) {K}.accionInventario({{ tipo: 'soltar', de: m, cantidad: {K}.inventario.lugares[m].n }}); }})()")
        comprobar('la criba y el grano, en el suelo', esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000))
        A.evaluate(f"(() => {{ {K}.cam.yaw = 0.9; {K}.cam.dist = 1.6; {K}.cam.pitch = 0.75; }})()")
        A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_criba_suelo.png')

        # una cosa cada vez (valravnx, 14 nov): el PC termina y se cierra antes de que entre el móvil; en la nube, sin
        # tarjeta, con los dos abiertos el móvil se colgaba al crear la cuenta. Lo del PC sigue en el servidor.
        ctxA.close()

        print('En el móvil, otro jugador')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        comprobar('el móvil es otro jugador', B.evaluate(f"{K}.enLinea.red.yo") != yo)
        B.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {pos['x']} - 0.6, z: {pos['z']} + 1.7, rot: 2.8 }}); {K}.cam.yaw = 0.35; {K}.cam.dist = 3.4; {K}.cam.pitch = 0.75; }})()")
        comprobar('ve la piedra de tallar del otro', esperar(B, f"!!{K}.escena.getObjectByName('estacion_piedra_tallar')", 20000))
        comprobar('y lo depositado en ella, puesto encima', esperar(B, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_piedra_tallar'); return !!o && !!o.getObjectByName('deposito_silex'); }})()", 10000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_piedra_tallar.png')
        print('La era, en el móvil')
        B.evaluate(f"{ERA}({K}, -3.5, 1)")
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; Object.assign({K}.pj, {{ x: e.x + 2.0, z: e.z + 2.2, rot: 2.3 }}); {K}.cam.yaw = 0.6; {K}.cam.dist = 4.2; {K}.cam.pitch = 0.42; }})()""")
        comprobar('en el móvil, también la era', esperar(B, f"!!{K}.escena.getObjectByName('estacion_era')", 8000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_era.png')
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['era:vista']; Object.assign({K}.pj, {{ x: e.x + 1.2, z: e.z + 0.8 }}); }})()""")
        B.evaluate(f"{K}.panelFabricar.abrirEstacion('era:vista')"); B.wait_for_timeout(1000)
        comprobar('y su panel, sin salirse de lado', B.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"trillar\"]') && document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
        captura(B, f'{SALIDA}/movil_panel_era.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()"); B.wait_for_timeout(500)
        B.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {pos['x']} - 0.6, z: {pos['z']} + 1.7, rot: 2.8 }}); {K}.cam.yaw = 0.35; {K}.cam.dist = 3.4; {K}.cam.pitch = 0.75; }})()"); B.wait_for_timeout(1500)

        B.tap('#btnFabricar'); B.wait_for_timeout(600)
        r = B.evaluate("(() => { const r = document.getElementById('panelFabricar').getBoundingClientRect(); return [r.width, r.height]; })()")
        comprobar('su panel ocupa casi la pantalla (el tablero del menú, con su margen)', r[0] >= 360 and r[1] >= 650, str(r))
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
        B.tap('#panelFabricar .fab-carta[data-fila="lasca_silex"]'); B.wait_for_timeout(800)
        B.tap('#panelFabricar .fab-ficha .fab-hacer')
        comprobar('en el móvil, «Hacer» encarga la lasca y sale en «En marcha», con su barra', esperar(B, "!!document.querySelector('#panelFabricar .fab-sec-marcha .fab-barra i')", 10000))
        if B.evaluate("document.getElementById('panelFabricar').classList.contains('fab-ficha-abierta')"): B.tap('#panelFabricar .fab-velo', position={'x': 195, 'y': 60}); B.wait_for_timeout(500)
        B.evaluate("document.querySelector('#panelFabricar .fab-sec-marcha').scrollIntoView({block: 'center'})"); B.wait_for_timeout(500)
        captura(B, f'{SALIDA}/movil_en_marcha.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()"); B.wait_for_timeout(500)
        B.evaluate(f"{K}.cambiarModo('construir')"); B.wait_for_timeout(200)
        B.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); B.wait_for_timeout(500)
        comprobar('en el móvil, la pestaña de los puestos en el menú de construcción, sin salirse de lado', B.evaluate("document.querySelectorAll('#piezas button.pieza').length === 7 && document.documentElement.scrollWidth <= innerWidth + 1"))
        captura(B, f'{SALIDA}/movil_menu_puestos.png')
        B.evaluate(f"{K}.cambiarModo('mover')")

        print('El secadero, en el móvil')
        B.evaluate(f"{SECADERO}({K}, 0.5, -3.5)")
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['secadero:vista']; Object.assign({K}.pj, {{ x: e.x + 1.6, z: e.z + 1.8, rot: 2.3 }}); {K}.cam.yaw = 0.3; {K}.cam.dist = 3.8; {K}.cam.pitch = 0.3; }})()""")
        comprobar('en el móvil, también', esperar(B, f"!!{K}.escena.getObjectByName('estacion_secadero')", 8000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_secadero.png')
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['secadero:vista']; Object.assign({K}.pj, {{ x: e.x + 0.4, z: e.z + 1.2 }}); }})()""")
        B.evaluate(f"{K}.panelFabricar.abrirEstacion('secadero:vista')"); B.wait_for_timeout(1000)
        comprobar('y su panel, sin salirse de lado (con una pestaña más)', B.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"secar\"]') && document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
        captura(B, f'{SALIDA}/movil_panel_secadero.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()")

        print('El raspador de pieles, en el móvil')
        B.evaluate(f"{RASPADOR}({K}, -3.5, -5.5)")
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x + 1.2, z: e.z + 2.8, rot: 2.8 }}); {K}.cam.yaw = 0.15; {K}.cam.dist = 3.6; {K}.cam.pitch = 0.3; }})()""")
        comprobar('en el móvil, también', esperar(B, f"!!{K}.escena.getObjectByName('estacion_raspador')", 8000))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_raspador.png')
        B.evaluate(f"""(() => {{ const e = {K}.fabCliente.estaciones['raspador:vista']; Object.assign({K}.pj, {{ x: e.x + 0.3, z: e.z + 1.1 }}); }})()""")
        B.evaluate(f"{K}.panelFabricar.abrirEstacion('raspador:vista')"); B.wait_for_timeout(1000)
        comprobar('y su panel, sin salirse de lado', B.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"raspar\"]') && document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
        t = elegir(B, 'raspar_piel'); B.wait_for_timeout(600)   # la ficha de la receta, entera
        comprobar('en el móvil, la ficha de la piel limpia dice que hace falta la lasca', re.search('lasca', t, re.I) is not None, t[:200])
        captura(B, f'{SALIDA}/movil_panel_raspador.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()")

        print('Cribar el grano, en el móvil')
        yoB = B.evaluate(f"{K}.enLinea.red.yo")
        B.evaluate(f"(() => {{ for (const m of ['mano:der', 'mano:izq']) if ({K}.inventario.lugares[m]) {K}.accionInventario({{ tipo: 'soltar', de: m, cantidad: {K}.inventario.lugares[m].n }}); }})()")
        esperar(B, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000)
        B.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'grano_sucio', cantidad: 2, a: 'mano:izq' }})")
        B.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'criba_grano', cantidad: 1, a: 'mano:der' }})")
        comprobar('en el móvil, el servidor le da la criba y el grano sin limpiar', servidorDice(lambda d: cuantos(d, yoB, 'criba_grano') == 1 and cuantos(d, yoB, 'grano_sucio') == 2) is not None)
        B.tap('#btnFabricar'); B.wait_for_timeout(800)
        B.tap('#panelFabricar .fab-pest[data-pestana="manos"]'); B.wait_for_timeout(500)
        comprobar('en el móvil, «Cribar el grano» en «Con las manos», sin salirse de lado', B.evaluate("!!document.querySelector('#panelFabricar .fab-carta[data-fila=\"cribar\"]') && document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1"))
        B.evaluate("(() => { const c = document.querySelector('#panelFabricar .fab-carta[data-fila=\"cribar\"]'); if (c) c.scrollIntoView({ block: 'center' }); })()"); B.wait_for_timeout(300)
        captura(B, f'{SALIDA}/movil_cribar.png')
        B.tap('#panelFabricar .fab-carta[data-fila="cribar"]'); B.wait_for_timeout(600)
        comprobar('en el móvil, su ficha pide la criba de grano', 'criba de grano' in B.evaluate("document.querySelector('#panelFabricar .fab-ficha').innerText").lower())
        captura(B, f'{SALIDA}/movil_cribar_ficha.png')
        B.evaluate(f"{K}.panelFabricar.cerrar()"); B.wait_for_timeout(300)
        B.evaluate(f"(() => {{ {K}.cam.yaw = 2.2; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.25; }})()"); B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_criba_mano.png')

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
