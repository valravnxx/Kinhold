# Prueba en navegador (Chromium sin pantalla): la tala en la construcción (hito de equipo).
# Sin hacha no se tala; con el hacha de piedra en la mano, Usar junto a un árbol joven da golpes hasta que cae hacia el
# lado contrario, queda el tocón, y en el suelo el tronco delgado y las ramas, que se cogen con Usar. Se guarda al
# recargar y, pasado su tiempo, el árbol vuelve a crecer. El adulto con hacha de piedra pide muchos golpes.
# Capturas de cerca en PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_tala_navegador.py dist/kinhold_hito1.html <carpeta>
# MUTAR=1: el árbol talado sigue «en pie» (sin tocón ni caída): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes', TALLER), f'{sitio}/recursos/personajes/{TALLER}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
MUTAR = os.environ.get('MUTAR') == '1'

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

K = 'window.__kinhold'

def abrir(nav, w, h, movil=False, limpiar=True, pg=None):
    if pg is None:
        pg = nav.new_page(viewport={'width': w, 'height': h}, locale='es-ES', is_mobile=movil, has_touch=movil, device_scale_factor=2 if movil else 1)
        pg.errores = []
        pg.on('pageerror', lambda e: pg.errores.append(str(e)))
        pg.on('console', lambda m: pg.errores.append(m.text) if m.type == 'error' else None)
        pg.goto(URL)
    else:
        pg.reload()
    pg.wait_for_function('window.__kinhold !== undefined', timeout=30000)
    if limpiar: pg.evaluate(f'localStorage.clear(); {K}.reiniciar()')
    if MUTAR: pg.evaluate(f"{K}.talaV.tala.enPie = () => true")
    pg.wait_for_timeout(800)
    return pg

# el árbol más cercano al centro de la edad pedida (un obstáculo del decorado, con su id)
def arbol(pg, edad):
    return pg.evaluate(f"""(() => {{ const k = {K}, t = k.talaV.tala;
      const a = k.obstaculos.filter(o => o.arbol && o.id && t.porId.get(o.id).edad === '{edad}').sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
      return {{ id: a.id, x: a.x, z: a.z, r: a.r }}; }})()""")

# el jugador junto al árbol, del lado del centro, mirándolo, y la cámara de lado
def junto(pg, a, dist=4.6, pitch=0.32, giro=1.1):
    pg.evaluate(f"""(() => {{ const k = {K}, a = {{ x: {a['x']}, z: {a['z']}, r: {a['r']} }}, d = Math.hypot(a.x, a.z);
      k.pj.k = 0; k.pj.x = a.x - a.x / d * (a.r + 0.6); k.pj.z = a.z - a.z / d * (a.r + 0.6); k.pj.y = 0;
      k.pj.rot = Math.atan2(a.x - k.pj.x, a.z - k.pj.z);
      k.cam.yaw = Math.atan2(-a.x, -a.z) + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()""")

def en_mano(pg, tipo, lugar='mano:der'):
    return pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{tipo}', cantidad: 1, a: '{lugar}' }}); {K}.pintarLlevas(); {K}.vestir(); return r.ok; }})()")

def aviso(pg): return pg.evaluate("document.getElementById('aviso').textContent")

def foto(pg, nombre):
    pg.wait_for_timeout(300); pg.evaluate(f"{K}.render()"); pg.screenshot(path=f'{SALIDA}/{nombre}.png')

# golpes seguidos con la hora adelantada (lo que tarda el gesto lo frena la lógica: aquí no se espera de verdad)
def golpes(pg, a, n, desde=1):
    return pg.evaluate(f"""(() => {{ const k = {K}, o = k.obstaculos.find(x => x.id === '{a['id']}'); let r;
      for (let i = 0; i < {n}; i++) {{ r = k.talaV.golpe(k.inventarios, k.registroAcciones, 'jugador:local', o, k.pj.x, k.pj.z, Date.now() + ({desde} + i) * 1000);
        if (!r.ok || r.cae) break; }}
      return {{ ok: r.ok, cae: !!r.cae, faltan: r.faltan, motivo: r.motivo || '', dir: r.dir }}; }})()""")

def en_pie(pg, a): return pg.evaluate(f"(() => {{ const k = {K}, o = k.obstaculos.find(x => x.id === '{a['id']}'); return k.talaV.enPie(o); }})()")

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    print('PC: talar un árbol joven con hacha de piedra')
    pg = abrir(nav, 1280, 800)
    j = arbol(pg, 'joven')
    junto(pg, j)
    pg.evaluate(f"{K}.usar()")
    comprobar('sin hacha no se tala: lo dice', not pg.evaluate(f"!!{K}.estado.talando") and 'hacha' in aviso(pg), aviso(pg))
    comprobar('el hacha de piedra está en el catálogo y se coge con la mano', en_mano(pg, 'hacha_piedra'))
    pg.evaluate(f"{K}.usar()")
    comprobar('con el hacha en la mano, Usar junto al árbol tala', pg.evaluate(f"!!{K}.estado.talando"))
    pg.wait_for_function(f"{K}.talaV.tala.progreso('{j['id']}') > 0", timeout=60000)
    comprobar('cada golpe se cuenta y dice cuántos faltan', 'faltan' in aviso(pg), aviso(pg))
    comprobar('el golpe va al registro con su autor', pg.evaluate(f"{K}.registroAcciones.entradas.some(e => e.tipo === 'talar' && e.autor === 'jugador:local' && e.ok)"))
    pg.wait_for_timeout(400)
    foto(pg, 'tala_01_golpes')
    pg.evaluate(f"{K}.estado.talando = null")
    r = golpes(pg, j, 20)
    comprobar('con los golpes que pide, cae', r['ok'] and r['cae'], str(r))
    comprobar('ya no está en pie (queda el tocón) y Usar no lo encuentra', not en_pie(pg, j) and pg.evaluate(f"(() => {{ const a = {K}.arbolCercano(); return !a || a.id !== '{j['id']}'; }})()"))
    comprobar('el árbol cae (se ve caer)', pg.evaluate(f"{K}.talaV.cayendo === 1 && !!{K}.escena.getObjectByName('arbol_cayendo')"))
    comprobar('lo que deja no se ve mientras cae', not pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_tronco_delgado')"))
    pg.wait_for_function(f"(() => {{ const c = {K}.escena.getObjectByName('arbol_cayendo'); return !c || c.quaternion.w < 0.94; }})()", timeout=60000)
    foto(pg, 'tala_02_cae')
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=90000)
    comprobar('queda el tocón en el sitio', pg.evaluate(f"(() => {{ const t = {K}.talaV.grupo.children.filter(c => c.name === 'tocon'); return t.length === 1 && Math.hypot(t[0].position.x - {j['x']}, t[0].position.z - {j['z']}) < 0.01; }})()"))
    comprobar('el árbol del bosque ya no se dibuja', pg.evaluate(f"(() => {{ const o = {K}.obstaculos.find(x => x.id === '{j['id']}'), m = new {K}.escena.matrixWorld.constructor(); o.malla.getMatrixAt(o.instancia, m); return Math.abs(m.determinant()) < 1e-9; }})()"))
    suelo = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.map(o => ({{ tipo: o.cosa.tipo, n: o.cosa.n, x: o.x, z: o.z }}))")
    tronco = next((o for o in suelo if o['tipo'] == 'tronco_delgado'), None)
    ramas = next((o for o in suelo if o['tipo'] == 'rama'), None)
    comprobar('en el suelo, un tronco delgado y de 2 a 4 ramas', tronco is not None and ramas is not None and 2 <= ramas['n'] <= 4, str(suelo))
    giro = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'tronco_delgado').giro")
    comprobar('el tronco queda tumbado a lo largo de donde cayó', giro is not None and abs(giro - (r['dir'] - 1.5708)) < 0.02, f'{giro} y {r["dir"]}')
    comprobar('se ven, donde cayó el árbol', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_tronco_delgado') && !!{K}.escena.getObjectByName('suelo_rama')"))
    foto(pg, 'tala_03_tocon_y_tronco')
    junto(pg, j, dist=3.2, pitch=0.5, giro=0.4)
    foto(pg, 'tala_04_tocon_de_cerca')
    # coger el tronco: con las dos manos (es grande), así que primero se suelta el hacha
    pg.evaluate(f"{K}.soltarAlSuelo('mano:der')")
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.x = {tronco['x']}; k.pj.z = {tronco['z']} - 0.6; }})()")
    pg.evaluate(f"{K}.usar()")
    comprobar('el tronco delgado se coge con Usar (en las dos manos)', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'tronco_delgado', pg.evaluate(f"JSON.stringify({K}.inventario.lugares['mano:der'])"))
    print('PC: se guarda y vuelve a crecer')
    pg = abrir(nav, 1280, 800, limpiar=False, pg=pg)
    comprobar('al recargar sigue el tocón', not en_pie(pg, j) and pg.evaluate(f"{K}.talaV.grupo.children.filter(c => c.name === 'tocon').length") == 1)
    pg.evaluate(f"{K}.talaV.tala.estado['{j['id']}'].vuelve = Date.now() - 1; {K}.talaV.refrescar()")
    comprobar('pasado su tiempo, vuelve a crecer: sin tocón y otra vez en el bosque', en_pie(pg, j) and pg.evaluate(f"{K}.talaV.grupo.children.filter(c => c.name === 'tocon').length") == 0
              and pg.evaluate(f"(() => {{ const o = {K}.obstaculos.find(x => x.id === '{j['id']}'), m = new {K}.escena.matrixWorld.constructor(); o.malla.getMatrixAt(o.instancia, m); return Math.abs(m.determinant()) > 1e-6; }})()"))
    print('PC: el adulto con hacha de piedra, muy lento')
    pg.evaluate(f"localStorage.clear(); {K}.reiniciar()")
    ad = arbol(pg, 'adulto')
    junto(pg, ad)
    en_mano(pg, 'hacha_piedra')
    r = golpes(pg, ad, 1, desde=5)
    comprobar('un golpe de piedra a un adulto: faltan 55', r['ok'] and not r['cae'] and r['faltan'] == 55, str(r))
    pg.evaluate(f"{K}.soltarAlSuelo('mano:der')"); en_mano(pg, 'hacha_hierro')
    r = golpes(pg, ad, 30, desde=10)
    comprobar('con el hacha de hierro cae enseguida y deja un tronco largo', r['cae'] and pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'tronco_largo')"), str(r))
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=90000)
    junto(pg, ad, dist=7.5, pitch=0.42, giro=1.3)
    foto(pg, 'tala_05_adulto_talado')
    comprobar('sin errores en la consola (PC)', not pg.errores, '; '.join(pg.errores[:3]))
    pg.close()

    print('Móvil: talar con el botón Usar')
    pg = abrir(nav, 390, 844, movil=True)
    j = arbol(pg, 'joven')
    junto(pg, j, dist=4.2)
    en_mano(pg, 'hacha_piedra')
    pg.locator('#btnUsar').tap()
    pg.wait_for_function(f"{K}.talaV.tala.progreso('{j['id']}') > 0", timeout=60000)
    comprobar('móvil: el botón Usar tala', pg.evaluate(f"!!{K}.estado.talando"))
    foto(pg, 'tala_06_movil_golpes')
    pg.evaluate(f"{K}.estado.talando = null")
    r = golpes(pg, j, 20)
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=90000)
    comprobar('móvil: cae y queda el tocón', r['cae'] and not en_pie(pg, j))
    foto(pg, 'tala_07_movil_tocon')
    comprobar('sin errores en la consola (móvil)', not pg.errores, '; '.join(pg.errores[:3]))
    nav.close()

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
