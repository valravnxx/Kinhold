# Prueba en navegador de lo que llevas y el suelo en línea (hito «Equipo y carga»): con un servidor local, lo que lleva
# el jugador, lo que suelta, lo que tala y lo que recoge lo guarda el servidor (su objetos.json), no el navegador.
# Uso: python3 pruebas/prueba_objetos_en_linea_navegador.py <html de la demo> <carpeta_capturas>
# Comprueba, en PC: coger un hacha del arcón de pruebas del panel llega al servidor; talar un árbol a golpes lo tala el
# servidor (tocón y lo que deja, en su suelo) y se ve caer; coger del suelo y recoger van a lo que lleva en el servidor;
# soltar el hacha la deja en el suelo del servidor; nada de eso se guarda en el navegador; al recargar, lo que llevas,
# el suelo y el tocón vuelven del servidor. Y en el móvil, otro jugador ve el tocón y el hacha en el suelo.
# MUTAR=1 tira los mensajes de objetos que manda la página (como si se hiciera solo en el navegador): tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_objetos_en_linea'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v19', 'taller-anim-v1']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()
s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
ARCHIVO = os.path.join(sitio, 'mundo.jsonl')
OBJETOS = os.path.join(sitio, 'objetos.json')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), ARCHIVO], cwd=RAIZ,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?hilos=1&servidor=ws://127.0.0.1:{PUERTO}'

ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def esperar(pg, cond, ms=20000):
    try: pg.wait_for_function(cond, timeout=ms, polling=250); return True
    except Exception: return False
def servidorDice(f, ms=15000):
    # lo que el servidor tiene guardado (objetos.json), hasta que cumpla f
    fin = time.time() + ms / 1000
    while True:
        try:
            d = json.load(open(OBJETOS))
            if f(d): return d
        except Exception: pass
        if time.time() > fin: return None
        time.sleep(0.25)
def lleva(d, autor, tipo):
    j = d['inventarios']['jugadores'].get(autor)
    return j is not None and f'"tipo": "{tipo}"' in json.dumps(j)
def enSuelo(d, tipo): return any(o['cosa']['tipo'] == tipo for o in d['suelo']['objetos'])
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')

def entrar(nav, nombre, vista, movil, ctx=None, pg=None):
    # con pg, la misma pestaña otra vez (recargar: la ficha va en sessionStorage, que es de cada pestaña)
    nuevo = ctx is None
    if nuevo: ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    if MUTAR and nuevo:
        ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
          WebSocket.prototype.send = function (d) { if (String(d).includes('"tipo":"objeto"')) return; return s.call(this, d); }; })()""")
    if pg is None: pg = ctx.new_page()
    err = []
    pg.on('pageerror', lambda e, err=err: err.append(str(e)))
    pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL); pg.wait_for_function('window.__demo && window.__demo.listo')
    pg.click('[data-ir=construir]'); pg.wait_for_load_state('load')
    comprobar(f'{nombre}: el juego carga', esperar(pg, 'window.__demo && window.__demo.listo', 60000), str(err[:2]))
    comprobar(f'{nombre}: el terreno de alrededor llega', esperar(pg, f'!{K}.mundoJ || {K}.mundoListo', 120000))
    comprobar(f'{nombre}: se conecta y le llega lo que lleva en el servidor', esperar(pg, f"{K}.enLinea && {K}.enLinea.red.yo && {K}.objetosRed && {K}.objetosRed.deServidor", 60000))
    return ctx, pg, err

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")

        print('El arcón de pruebas, por el servidor')
        A.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: 'hacha_hierro', cantidad: 1, a: 'mano:der' }})")
        comprobar('PC coge un hacha y el servidor la tiene en su mano', servidorDice(lambda d: lleva(d, yo, 'hacha_hierro')) is not None)

        print('Talar, por el servidor')
        # el árbol dibujado más cercano, en pie; PC se pone a su lado
        arbol = A.evaluate(f"""(() => {{ const pj = {K}.pj; let m = null, md = 1e9;
          for (const o of {K}.obstaculos) {{ if (!o.arbol || !o.malla || !o.id || !{K}.talaV.enPie(o)) continue;
            const d = Math.hypot(o.x - pj.x, o.z - pj.z); if (d < md) {{ md = d; m = o; }} }}
          if (!m) return null; const a = Math.atan2(pj.x - m.x, pj.z - m.z);
          pj.x = m.x + Math.sin(a) * (m.r + 0.5); pj.z = m.z + Math.cos(a) * (m.r + 0.5);
          return {{ id: m.id, x: m.x, z: m.z, d: md }}; }})()""")
        comprobar('hay un árbol cerca', arbol is not None, str(arbol))
        A.wait_for_timeout(1200)   # que el servidor sepa dónde está (la presencia)
        comprobar('PC lo tiene al alcance', A.evaluate(f"!!{K}.arbolCercano()"))
        A.evaluate(f"{K}.usar()")
        # a 1 fotograma por segundo la caída puede acabar entre dos miradas: vale también si ya está talado
        cayendo = esperar(A, f"{K}.talaV.cayendo > 0 || !!{K}.talaV.tala.estado[{json.dumps(arbol['id'])}]?.vuelve", 90000)
        comprobar('a golpes, el árbol cae (el servidor lo ha talado)', cayendo, A.inner_text('#aviso'))
        A.wait_for_timeout(400); captura(A, f'{SALIDA}/pc_1_cae.png')
        d = servidorDice(lambda d: d['tala']['estado'].get(arbol['id'], {}).get('vuelve', 0) > 0 and enSuelo(d, 'rama'))
        comprobar('en el servidor: el tocón y, en su suelo, el tronco y las ramas', d is not None and (enSuelo(d, 'tronco_largo') or enSuelo(d, 'tronco_delgado')))
        comprobar('y en la página, lo mismo cuando ha caído', esperar(A, f"{K}.talaV.cayendo === 0 && {K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'rama') && !!{K}.escena.getObjectByName('tocon')", 90000))
        A.evaluate(f"{K}.cam.dist = 7; {K}.cam.pitch = 0.55"); A.wait_for_timeout(600)
        captura(A, f'{SALIDA}/pc_2_tocon.png')

        print('Soltar y coger del suelo, por el servidor')
        # un paso atrás del tocón, para que el hacha no caiga junto a él
        A.evaluate(f"(() => {{ const pj = {K}.pj, a = Math.atan2(pj.x - {arbol['x']}, pj.z - {arbol['z']}); pj.x += Math.sin(a) * 1.2; pj.z += Math.cos(a) * 1.2; }})()")
        A.wait_for_timeout(1200)
        A.evaluate(f"{K}.soltarAlSuelo('mano:der')")
        d = servidorDice(lambda d: enSuelo(d, 'hacha_hierro') and not lleva(d, yo, 'hacha_hierro'))
        comprobar('PC suelta el hacha: en el servidor está en el suelo y ya no la lleva', d is not None)
        comprobar('y la página la ve en el suelo', esperar(A, f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'hacha_hierro') && !{K}.inventario.lugares['mano:der']", 10000))
        A.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'rama'); Object.assign({K}.pj, {{ x: o.x + 0.4, z: o.z }}); }})()")
        A.wait_for_timeout(1200)
        A.evaluate(f"{K}.usar()")
        comprobar('PC coge las ramas: van a lo que lleva en el servidor', servidorDice(lambda d: lleva(d, yo, 'rama')) is not None)
        comprobar('y la página lo ve en lo que lleva', esperar(A, f"JSON.stringify({K}.inventario.lugares).includes('\"rama\"')", 10000))

        print('Recoger, por el servidor')
        punto = A.evaluate(f"""(() => {{ const pj = {K}.pj, ps = {K}.recoleccion.puntos.filter(q => ['ramas', 'piedra'].includes(q.tipo) && {K}.recoleccion.rec.disponible(q.id, Date.now()));
          ps.sort((a, b) => Math.hypot(a.x - pj.x, a.z - pj.z) - Math.hypot(b.x - pj.x, b.z - pj.z)); const q = ps[0];
          if (!q) return null; Object.assign(pj, {{ x: q.x + 0.5, z: q.z }}); return {{ id: q.id, tipo: q.tipo }}; }})()""")
        comprobar('hay algo que recoger', punto is not None, str(punto))
        A.wait_for_timeout(1500)
        A.evaluate(f"{K}.usar()")
        d = servidorDice(lambda d: d['recoleccion']['estado'].get(punto['id'], {}).get('vuelve', 0) > 0)
        comprobar('PC lo recoge: el servidor lo da por recogido y va a lo que lleva', d is not None and lleva(d, yo, 'piedra' if punto['tipo'] == 'piedra' else 'rama'))

        comprobar('nada de eso se guarda en el navegador', A.evaluate("['kinhold.inventario', 'kinhold.suelo', 'kinhold.tala', 'kinhold.recoleccion'].every(k => localStorage.getItem(k) === null)"))
        A.evaluate(f"{K}.panelInventario.abrir ? {K}.panelInventario.abrir() : document.getElementById('btnInventario').click()"); A.wait_for_timeout(800)
        captura(A, f'{SALIDA}/pc_3_inventario.png')

        print('Al recargar, vuelve del servidor')
        ctxA, A, errA = entrar(nav, 'PC otra vez', {'width': 1280, 'height': 800}, False, ctxA, A)
        comprobar('es el mismo jugador', A.evaluate(f"{K}.enLinea.red.yo") == yo)
        comprobar('lleva lo que tenía en el servidor (las ramas, sin el hacha)', esperar(A, f"JSON.stringify({K}.inventario.lugares).includes('\"rama\"') && !JSON.stringify({K}.inventario.lugares).includes('hacha_hierro')", 10000))
        comprobar('el hacha sigue en el suelo y el árbol, talado', esperar(A, f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'hacha_hierro') && !!{K}.talaV.tala.estado[{json.dumps(arbol['id'])}]?.vuelve", 10000))

        print('Otro jugador lo ve')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        comprobar('el móvil es otro jugador', B.evaluate(f"{K}.enLinea.red.yo") != yo)
        comprobar('y ve el hacha en el suelo y el árbol talado', esperar(B, f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'hacha_hierro') && !!{K}.talaV.tala.estado[{json.dumps(arbol['id'])}]?.vuelve", 10000))
        B.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'hacha_hierro'); Object.assign({K}.pj, {{ x: o.x + 1.2, z: o.z + 0.6 }}); {K}.cam.dist = 6; {K}.cam.pitch = 0.6; }})()")
        esperar(B, f"!!{K}.escena.getObjectByName('tocon')", 20000); B.wait_for_timeout(1500)
        comprobar('y el tocón se dibuja en su pantalla', B.evaluate(f"!!{K}.escena.getObjectByName('tocon')"))
        captura(B, f'{SALIDA}/movil_1_ve_el_suelo.png')
        A.evaluate(f"(() => {{ const o = {K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'hacha_hierro'); Object.assign({K}.pj, {{ x: o.x - 1.0, z: o.z + 0.8 }}); {K}.cam.dist = 6; {K}.cam.pitch = 0.6; }})()")
        A.wait_for_timeout(1500); captura(A, f'{SALIDA}/pc_4_hacha_en_el_suelo.png')

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
