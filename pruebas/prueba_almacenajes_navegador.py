# Prueba en navegador de los almacenajes de la base (P3, «De nada a una casa»; revisión del 1 nov), en línea con un
# servidor local y dos jugadores.
# Uso: python3 pruebas/prueba_almacenajes_navegador.py <html de la demo> <carpeta_capturas>
# En PC (1280×800), un jugador va a la zona de al lado de la salida (la de la salida es del rey), pone su mojón y, desde
# la pestaña «Almacenajes» de Construir, el marco de una pila de piedras; con Usar le lleva sus
# 4 piedras y la levanta. «Guardar y sacar» abre el panel con ella: lo guardado y lo que lleva que se guarda ahí (las
# ramas, no); guarda piedras (en el servidor) y se ven puestas en montón; saca y vuelven a sus manos; y la llena. En el
# móvil (390×844), el otro jugador la ve llena igual, con el menú (puede mirarla, pero es tierra de otro: no saca nada).
# El acopio de troncos y la leñera se miran llenos de cerca (solo para mirarlos: se dibujan en este navegador; su
# lógica y el servidor, en pruebas/prueba_fabricacion.mjs y pruebas/prueba_objetos_servidor.mjs).
# El material sale del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba los almacenajes en el juego; el recorrido
# de jugador (pruebas/prueba_recorrido.mjs) levanta la pila y guarda en ella sin arcón, con lo que se recoge.
# MUTAR=1 tira los mensajes de objetos que manda la página (como si se guardara solo en el navegador): falla.
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
    return crear_y_confirmar(pg, codigos, f'acopiador{_n[0]}', 'clave-de-prueba-123')
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



def base_tierra():
    # la zona de al lado de la salida, al oeste (como el recorrido de jugador): la de la salida es del rey
    js = """import { terrenoWhitholm } from './src/logica/terreno_servidor.js';
const T = terrenoWhitholm(), zs = T.zona(0, 4);
for (let r = 20; r < 3000; r += 10) { const id = T.zona(-r, 4); if (id !== null && id !== zs && !T.esZonaRey(id)) { console.log(JSON.stringify({ x: -r - 40, z: 4 })); process.exit(0); } }"""
    out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=300).stdout.strip().splitlines()
    return json.loads(out[-1])
def pila_servidor(d, yo):
    l = [e for e in (d.get('fabricacion') or {}).get('estaciones', []) if e['tipo'] == 'pila_piedras' and e['autor'] == yo]
    return l[0] if l else None
def coger(pg, objeto, n, a):
    r = pg.evaluate(f"""(() => {{ const l = {K}.inventario.lugares, a = !l['{a}'] ? '{a}' : ['mano:der', 'mano:izq'].find(m => !l[m]);
      if (!a) return 'manos llenas: ' + JSON.stringify([l['mano:der'], l['mano:izq']]);
      const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{objeto}', cantidad: {n}, a }}); return r && r.ok === false ? r.motivo : ''; }})()""")
    if r: print(f'  (coger {n} {objeto}: {r})')
def mirar(pg, tipo, dist=3.2, pitch=0.5, yaw=0):
    pg.evaluate(f"""(() => {{ const e = Object.values({K}.fabCliente.estaciones).find(x => x.tipo === '{tipo}'); if (!e) return;
      Object.assign({K}.pj, {{ x: e.x + 0.6, z: e.z + 1.4, rot: Math.atan2(-0.6, -1.4) }}); {K}.cam.yaw = {yaw}; {K}.cam.dist = {dist}; {K}.cam.pitch = {pitch}; }})()""")
DEPOSITO = "(t => { const o = window.__kinhold.escena.getObjectByName('estacion_' + t); const d = o && o.getObjectByName('deposito'); let n = 0; if (d) d.traverse(m => { if (m.isMesh) n++; }); return n; })"
PANEL = "document.getElementById('panelFabricar').innerText"

try:
    B0 = base_tierra()
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")

        print('Va a la zona de al lado y pone su mojón')
        A.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {B0['x']}, z: {B0['z']} }}); }})()"); A.wait_for_timeout(1500)
        A.evaluate(f"{K}.llevarPara('mojon', 'mojon')"); A.wait_for_timeout(800)
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon')")
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 2, z = {K}.pj.z - 3; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        comprobar('pone su mojón en la zona de al lado (en el servidor)', esperar(A, f"!!{K}.miMojon", 15000), A.evaluate("document.getElementById('aviso').textContent"))
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.accion({{ tipo: 'dejar_arcon', de: m, cantidad: l[m].n }}); }})()"); A.wait_for_timeout(500)

        print('Levanta una pila de piedras desde «Almacenajes»')
        A.evaluate("document.querySelector('#pestanas button[data-cat=\"almacenajes\"]').click()"); A.wait_for_timeout(300)
        lista = A.evaluate("[...document.querySelectorAll('#piezas .pieza b')].map(b => b.textContent)")
        comprobar('la pestaña «Almacenajes»: acopio de troncos, pila de piedras y leñera (y no los puestos de trabajo)', lista == ['Acopio de troncos', 'Pila de piedras', 'Leñera'], str(lista))
        A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); A.wait_for_timeout(200)
        lista2 = A.evaluate("[...document.querySelectorAll('#piezas .pieza b')].map(b => b.textContent)")
        comprobar('y en «Puestos de trabajo» no salen', 'Pila de piedras' not in lista2 and 'Hoguera' in lista2, str(lista2))
        A.evaluate(f"{K}.seleccionar('puesto', 'pila_piedras')")
        coger(A, 'piedra', 3, 'mano:der'); coger(A, 'piedra', 1, 'mano:izq')
        comprobar('el servidor le da 4 piedras (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 4) is not None)
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 1, z = {K}.pj.z + 0.2; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        comprobar('el servidor tiene el marco de la pila', servidorDice(lambda d: (pila_servidor(d, yo) or {}).get('obra') is not None) is not None, A.evaluate("document.getElementById('aviso').textContent"))
        A.evaluate(f"{K}.cambiarModo('mover')")
        esperar(A, f"Object.values({K}.fabCliente.estaciones).some(e => e.tipo === 'pila_piedras')", 8000)
        mirar(A, 'pila_piedras')
        A.keyboard.press('f')
        comprobar('Usar le lleva sus 4 piedras', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 0) is not None)
        A.wait_for_timeout(600); A.keyboard.press('f')
        d = servidorDice(lambda d: (pila_servidor(d, yo) or {'obra': 1}).get('obra') is None, 30000)
        comprobar('y trabajando en ella queda levantada (en el servidor)', d is not None, A.evaluate("document.getElementById('aviso').textContent"))
        comprobar('se dibuja sin armazón, con su lecho de losas', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_pila_piedras'); return !!o && !o.getObjectByName('armazon'); }})()", 8000))

        print('Guardar y sacar, desde el panel')
        A.wait_for_timeout(500)
        ops = A.evaluate(f"{K}.opcionesUsar()")
        comprobar('en el menú de Usar: «Guardar y sacar: Pila de piedras»', 'Guardar y sacar: Pila de piedras' in ops, str(ops))
        A.evaluate(f"{K}.panelFabricar.abrirEstacion(Object.values({K}.fabCliente.estaciones).find(e => e.tipo === 'pila_piedras').id)"); A.wait_for_timeout(500)
        comprobar('el panel se abre con la pila, sin recetas', A.evaluate(f"{K}.panelFabricar.pestana === 'almacen' && !document.querySelector('#panelFabricar .fab-carta')"), A.evaluate(PANEL)[:200])
        comprobar('dice qué guarda y cuánto cabe (vacía, 0 de 40) y que la obra no coge de ahí', esperar(A, f"/Vacío: aquí se guarda piedra/.test({PANEL}) && /0 de 40/.test({PANEL}) && /no coge de aquí/.test({PANEL})", 5000), A.evaluate(PANEL)[:300])
        coger(A, 'rama', 2, 'mano:izq'); coger(A, 'piedra', 3, 'mano:der')
        servidorDice(lambda d: cuantos(d, yo, 'piedra') == 3 and cuantos(d, yo, 'rama') == 2)
        esperar(A, f"{K}.inventario.cuantos('piedra') === 3 && {K}.inventario.cuantos('rama') === 2", 5000); A.wait_for_timeout(1200)
        dejables = A.evaluate("[...document.querySelectorAll('#panelFabricar .fab-dejar')].map(b => b.title)")
        comprobar('de lo que lleva, solo se puede guardar la piedra (las ramas, no)', len(dejables) == 1 and 'Piedra' in dejables[0], str(dejables))
        A.click('#panelFabricar .fab-dejar')
        d = servidorDice(lambda d: ((pila_servidor(d, yo) or {}).get('deposito') or {}).get('piedra') == 3)
        comprobar('guarda 3 piedras: en el servidor', d is not None and cuantos(d, yo, 'piedra') == 0)
        comprobar('el panel lo dice (3 de 40) y se ven puestas en la pila', esperar(A, f"/Guardas: 3/.test({PANEL}) && /3 de 40/.test({PANEL}) && {DEPOSITO}('pila_piedras') >= 3", 6000), A.evaluate(PANEL)[:300])
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; if (l['mano:izq']) {K}.accion({{ tipo: 'dejar_arcon', de: 'mano:izq', cantidad: l['mano:izq'].n }}); }})()"); A.wait_for_timeout(600)
        esperar(A, "!!document.querySelector('#panelFabricar .fab-coger')", 5000)
        A.click('#panelFabricar .fab-coger')
        d = servidorDice(lambda d: not ((pila_servidor(d, yo) or {}).get('deposito') or {}).get('piedra'))
        comprobar('saca las piedras: vuelven a sus manos (en el servidor)', d is not None and cuantos(d, yo, 'piedra') == 3)
        captura(A, f'{SALIDA}/PC_panel_pila_vacia.png')
        # la llena: 40 piedras, de 3 en 3 desde las manos (el arcón de pruebas se las da)
        for _ in range(14):
            n = A.evaluate(f"{K}.inventario.cuantos('piedra')")
            hay = ((pila_servidor(json.load(open(OBJETOS)), yo) or {}).get('deposito') or {}).get('piedra', 0)
            if hay >= 40: break
            if n == 0:
                coger(A, 'piedra', min(3, 40 - hay), 'mano:der'); esperar(A, f"{K}.inventario.cuantos('piedra') > 0", 5000); A.wait_for_timeout(1200)
            esperar(A, "!!document.querySelector('#panelFabricar .fab-dejar')", 5000)
            antes = hay
            A.click('#panelFabricar .fab-dejar')
            servidorDice(lambda d: ((pila_servidor(d, yo) or {}).get('deposito') or {}).get('piedra', 0) > antes, 6000)
            A.wait_for_timeout(300)
        d = json.load(open(OBJETOS))
        comprobar('la llena: 40 piedras (en el servidor)', ((pila_servidor(d, yo) or {}).get('deposito') or {}).get('piedra') == 40, str((pila_servidor(d, yo) or {}).get('deposito')))
        coger(A, 'piedra', 1, 'mano:der'); A.wait_for_timeout(1200)
        comprobar('llena, no cabe ni una más (el panel lo dice)', esperar(A, f"/No cabe nada más/.test({PANEL}) && /40 de 40/.test({PANEL})", 5000), A.evaluate(PANEL)[:300])
        comprobar('y se ve llena: 40 piedras en montón', esperar(A, f"{DEPOSITO}('pila_piedras') >= 40", 5000), str(A.evaluate(f"{DEPOSITO}('pila_piedras')")))
        captura(A, f'{SALIDA}/PC_panel_pila_llena.png')
        comprobar('el contador de arriba («En tu tierra») cuenta lo guardado: 40 piedras', esperar(A, "/En tu tierra/.test(document.getElementById('materiales').innerText) && /40\\s*piedra/.test(document.getElementById('materiales').innerText)", 6000), A.evaluate("document.getElementById('materiales').innerText"))
        A.evaluate(f"{K}.panelFabricar.cerrar()")
        A.add_style_tag(content='#menuUsar, #aviso { visibility: hidden !important; }')
        mirar(A, 'pila_piedras', 2.8, 0.45); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_pila_llena.png')

        print('El acopio de troncos y la leñera, llenos (solo para mirarlos: se dibujan en este navegador)')
        A.evaluate(f"""(() => {{ const p = Object.values({K}.fabCliente.estaciones).find(e => e.tipo === 'pila_piedras'), y = {K}.alturaSuelo;
          const l = Object.values({K}.fabCliente.estaciones).map(e => ({{ ...e }}));
          l.push({{ id: 'acopio_troncos:mirar', tipo: 'acopio_troncos', x: p.x + 3.5, z: p.z, autor: p.autor, deposito: {{ tronco_delgado: 10, tronco_corto: 2 }} }});
          l.push({{ id: 'lenera:mirar', tipo: 'lenera', x: p.x - 3, z: p.z + 0.5, autor: p.autor, deposito: {{ lena: 24, rama: 6 }} }});
          {K}.estacionesV.poner(l); }})()""")
        comprobar('el acopio, con sus 12 troncos puestos', esperar(A, f"{DEPOSITO}('acopio_troncos') > 0", 5000))
        comprobar('la leñera, con su leña y sus ramas', esperar(A, f"{DEPOSITO}('lenera') > 0", 5000))
        mirar(A, 'acopio_troncos', 4.2, 0.4); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_acopio_lleno.png')
        mirar(A, 'lenera', 3.4, 0.35, 0.6); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_lenera_llena.png')

        print('En el móvil, el otro jugador la ve llena; es tierra de otro')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        pl = pila_servidor(json.load(open(OBJETOS)), yo)
        B.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {pl['x']} + 0.6, z: {pl['z']} + 1.4 }}); }})()")   # (el servidor deja andar libre en las pruebas)
        comprobar('le llega la pila, con sus 40 piedras', esperar(B, f"Object.values({K}.fabCliente.estaciones).some(e => e.tipo === 'pila_piedras' && e.deposito.piedra === 40)", 20000))
        mirar(B, 'pila_piedras', 3.0, 0.5)
        comprobar('y la ve llena', esperar(B, f"{DEPOSITO}('pila_piedras') >= 40", 8000), str(B.evaluate(f"{DEPOSITO}('pila_piedras')")))
        B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_pila_llena.png')
        B.evaluate(f"{K}.panelFabricar.abrirEstacion(Object.values({K}.fabCliente.estaciones).find(e => e.tipo === 'pila_piedras').id)"); B.wait_for_timeout(600)
        comprobar('su panel, sin salirse de lado', B.evaluate(f"/Guardado en la pila de piedras/.test({PANEL}) && document.documentElement.scrollWidth <= innerWidth + 1"), B.evaluate(PANEL)[:200])
        esperar(B, "!!document.querySelector('#panelFabricar .fab-coger')", 5000)
        captura(B, f'{SALIDA}/movil_panel_pila.png')
        B.click('#panelFabricar .fab-coger')
        comprobar('pero no saca nada: es tierra de otro', esperar(B, "/tierra de otro/.test(document.querySelector('#panelFabricar .fab-aviso').textContent)", 6000) and ((pila_servidor(json.load(open(OBJETOS)), yo) or {}).get('deposito') or {}).get('piedra') == 40,
                  B.evaluate("document.querySelector('#panelFabricar .fab-aviso').textContent"))
        B.evaluate(f"{K}.panelFabricar.cerrar()")

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
