# Prueba en navegador de los almacenajes de la base (P3, «De nada a una casa»; revisión del 1 nov), en línea con un
# servidor local y dos jugadores.
# Uso: python3 pruebas/prueba_almacenajes_navegador.py <html de la demo> <carpeta_capturas>
# En PC (1280×800), un jugador va a la zona de al lado de la salida (la de la salida es del rey), pone su mojón y, desde
# la pestaña «Almacenajes» de Construir, el marco de una pila de piedras; con Usar le lleva sus
# 4 piedras y la levanta. «Guardar y sacar» abre el panel con ella: lo guardado y lo que lleva que se guarda ahí (las
# ramas, no); guarda piedras (en el servidor) y se ven puestas en montón; saca y vuelven a sus manos; y la llena. En el
# móvil (390×844), el otro jugador la ve llena igual, con el menú (puede mirarla, pero es tierra de otro: no saca nada).
# El acopio de troncos y la leñera (y, desde el 8 nov, el soporte de varas, el almiar, el hoyo de barro y el cesto) se
# miran llenos de cerca (solo para mirarlos: se dibujan en este navegador; su
# lógica y el servidor, en pruebas/prueba_fabricacion.mjs y pruebas/prueba_objetos_servidor.mjs).
# El material sale del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba los almacenajes en el juego; el recorrido
# de jugador (pruebas/prueba_recorrido.mjs) levanta la pila y guarda en ella sin arcón, con lo que se recoge.
# Con el giro que se le da al ponerla (Girar seis veces: 90°), el servidor la guarda y se dibuja así; y al final se
# desmonta desde Desmontar (valravnx, 7 nov: «no se ponen en la dirección de rotación… y no se pueden desmontar»): el
# 75 % de su material y lo que guardaba, al suelo.
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
def encuadre(pg, tipo, dist, pitch, yaw, lado=1.1, atras=0.9, cual=0):
    # para mirar uno de cerca sin que el personaje lo tape: el personaje a un lado, detrás (atras > 0: el almacenaje entre
    # la cámara y él) o delante (atras < 0: el almacenaje más allá, junto a él)
    pg.evaluate(f"""(() => {{ const e = Object.values({K}.fabCliente.estaciones).filter(x => x.tipo === '{tipo}')[{cual}]; if (!e) return;
      const s = Math.sin({yaw}), c = Math.cos({yaw});
      Object.assign({K}.pj, {{ x: e.x - s * {atras} + c * {lado}, z: e.z - c * {atras} - s * {lado}, rot: {yaw} + Math.PI }}); {K}.cam.yaw = {yaw}; {K}.cam.dist = {dist}; {K}.cam.pitch = {pitch}; }})()""")
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
        comprobar('la pestaña «Almacenajes»: los siete (acopio de troncos, pila de piedras, leñera, soporte de varas, almiar, hoyo de barro y cesto), y no los puestos de trabajo',
                  lista == ['Acopio de troncos', 'Pila de piedras', 'Leñera', 'Soporte de varas', 'Almiar', 'Hoyo de barro', 'Cesto'], str(lista))
        A.evaluate("document.querySelector('#pestanas button[data-cat=\"puestos\"]').click()"); A.wait_for_timeout(200)
        lista2 = A.evaluate("[...document.querySelectorAll('#piezas .pieza b')].map(b => b.textContent)")
        comprobar('y en «Puestos de trabajo» no salen', 'Pila de piedras' not in lista2 and 'Hoguera' in lista2, str(lista2))
        A.evaluate(f"{K}.seleccionar('puesto', 'pila_piedras')")
        coger(A, 'piedra', 3, 'mano:der'); coger(A, 'piedra', 1, 'mano:izq')
        comprobar('el servidor le da 4 piedras (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'piedra') == 4) is not None)
        for _ in range(6): A.evaluate(f"{K}.girar()")
        A.evaluate(f"(() => {{ const x = {K}.pj.x + 1, z = {K}.pj.z + 0.2; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        d = servidorDice(lambda d: abs(((pila_servidor(d, yo) or {}).get('giro') or 0) - 1.571) < 0.002)
        comprobar('el servidor guarda el giro con que se pone (Girar ×6: 90°)', d is not None, str(pila_servidor(json.load(open(OBJETOS)), yo)))
        comprobar('y se dibuja con ese giro', esperar(A, f"(() => {{ const o = {K}.escena.getObjectByName('estacion_pila_piedras'); return !!o && Math.abs(o.rotation.y - 1.571) < 0.002; }})()", 8000))
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

        print('El soporte de varas, el almiar, el hoyo de barro y el cesto (8 nov), llenos y vacíos (solo para mirarlos)')
        NUEVOS = """((K, desde) => { const p = Object.values(K.fabCliente.estaciones).find(e => e.tipo === 'pila_piedras'), l = Object.values(K.fabCliente.estaciones).filter(e => !e.id.endsWith(':mirar')).map(e => ({ ...e }));
          const pon = (tipo, dx, dz, deposito, sufijo = '') => l.push({ id: tipo + ':mirar' + sufijo, tipo, x: p.x + dx, z: p.z + dz, autor: p.autor, deposito });
          pon('soporte_varas', 3.5, -4, { vara: 20 }); pon('almiar', -3.5, -4.5, { paja: 18, junco: 5 }); pon('hoyo_barro', 0.5, 8, { barro: 12 }); pon('cesto', 2, 3.5, { fibra: 12, silex: 6, cordel: 2, bayas: 4 });
          if (desde) { pon('almiar', -7, -4.5, { junco: 6 }, 'b'); pon('soporte_varas', 7, -4, {}, 'b'); }
          // los de mirar se quedan aunque el servidor vuelva a mandar las estaciones (las de verdad, más estos)
          K.__mirar = l.filter(e => e.id.includes(':mirar'));
          if (!K.estacionesV.__poner) { K.estacionesV.__poner = K.estacionesV.poner; K.estacionesV.poner = lista => K.estacionesV.__poner([...(lista || []).filter(e => !String(e.id).includes(':mirar')), ...(K.__mirar || [])]); }
          K.estacionesV.poner(l); })"""
        A.evaluate(f"{NUEVOS}({K}, true)")
        for t in ['soporte_varas', 'almiar', 'hoyo_barro', 'cesto']:
            comprobar(f'{t}: se dibuja con lo guardado', esperar(A, f"{DEPOSITO}('{t}') > 0", 5000), str(A.evaluate(f"{DEPOSITO}('{t}')")))
        A.add_style_tag(content='#materiales { visibility: hidden !important; }')   # (cuenta también los de mirar)
        for t, dist, pitch, yaw, lado, atras, cual, nombre in [('soporte_varas', 3.8, 0.38, 0.6, 1.2, -1.8, 0, 'soporte_varas_lleno'), ('soporte_varas', 3.8, 0.38, 0.6, 1.2, -1.8, 1, 'soporte_varas_vacio'),
                ('almiar', 6.5, 0.32, 0.4, 0.9, 2.0, 0, 'almiar_lleno'), ('almiar', 5.5, 0.3, 0.4, 0.8, 1.6, 1, 'almiar_juncos'),
                ('hoyo_barro', 3.2, 0.7, 0.3, 0.9, -1.4, 0, 'hoyo_barro_lleno'), ('cesto', 2.4, 0.6, 0.3, 0.6, -1.2, 0, 'cesto_lleno')]:
            encuadre(A, t, dist, pitch, yaw, lado, atras, cual); A.wait_for_timeout(2200)
            captura(A, f'{SALIDA}/PC_{nombre}.png')
        # el almiar solo con juncos (de pie, en cono) y el soporte vacío, junto a los llenos
        A.evaluate(f"""(() => {{ const e = Object.values({K}.fabCliente.estaciones).find(x => x.tipo === 'pila_piedras');
          Object.assign({K}.pj, {{ x: e.x - 1.5, z: e.z + 2.5, rot: Math.atan2(0.2, 1) }}); {K}.cam.yaw = 0; {K}.cam.dist = 10; {K}.cam.pitch = 0.42; }})()"""); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_almacenajes_nuevos.png')

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
        B.evaluate(f"{NUEVOS}({K}, false)")
        B.add_style_tag(content='#materiales { visibility: hidden !important; }')
        comprobar('en el móvil, el almiar y el cesto se ven igual', esperar(B, f"{DEPOSITO}('almiar') > 0 && {DEPOSITO}('cesto') > 0", 8000))
        encuadre(B, 'almiar', 6.5, 0.4, 0.4, 0.5, -2.2); B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_almiar.png')
        encuadre(B, 'cesto', 2.6, 0.6, 0.3, 0.5, -1.2); B.wait_for_timeout(2000)
        captura(B, f'{SALIDA}/movil_cesto.png')
        B.evaluate(f"{K}.__mirar = []; {K}.estacionesV.poner(Object.values({K}.fabCliente.estaciones).filter(e => !e.id.includes(':mirar')))")

        print('Desmontarla, desde Desmontar (el dueño, en PC)')
        pl = pila_servidor(json.load(open(OBJETOS)), yo)
        A.evaluate(f"{K}.__mirar = []; {K}.estacionesV.poner({K}.objetosRed ? Object.values({K}.fabCliente.estaciones).filter(e => !e.id.includes(':mirar')) : [])")
        mirar(A, 'pila_piedras', 4.0, 0.6)
        A.evaluate(f"{K}.cambiarModo('desmontar')"); A.wait_for_timeout(1500)
        pt = A.evaluate(f"{K}.proyectar({pl['x']}, {K}.alturaSuelo({pl['x']}, {pl['z']}) + 0.25, {pl['z']})")
        A.evaluate(f"{K}.elegirPieza({pt['x']}, {pt['y']})"); A.wait_for_timeout(300)
        aviso = A.evaluate("document.getElementById('aviso').textContent")
        comprobar('al apuntarla, la elige y dice que se recupera el 75 %', '75' in aviso and not A.evaluate("document.getElementById('confirmar').hidden"), aviso)
        captura(A, f'{SALIDA}/PC_desmontar_pila.png')
        A.evaluate(f"{K}.confirmarDesmontaje()")
        def piedras_suelo(d):
            return sum(o['cosa']['n'] for o in (d.get('suelo') or {}).get('objetos', []) if o.get('cosa', {}).get('tipo') == 'piedra')
        d = servidorDice(lambda d: pila_servidor(d, yo) is None)
        comprobar('desmontada en el servidor', d is not None, A.evaluate("document.getElementById('aviso').textContent"))
        comprobar('y sus 40 piedras y 3 de su material (el 75 % de 4), en el suelo', d is not None and piedras_suelo(d) >= 43, str(piedras_suelo(d) if d else None))
        comprobar('ya no se dibuja', esperar(A, f"!{K}.escena.getObjectByName('estacion_pila_piedras')", 8000))
        A.evaluate(f"{K}.cambiarModo('mover')")

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
