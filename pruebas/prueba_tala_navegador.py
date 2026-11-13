# Prueba en navegador (Chromium sin pantalla): la tala en la construcción (hito de equipo).
# Sin hacha no se tala; con el hacha de piedra en la mano, Usar junto a un árbol joven da golpes hasta que cae hacia la
# boca (el lado desde el que talas), queda el tocón, y en el suelo el tronco delgado y las varas, que se cogen con Usar (el tronco, también al
# hombro). Se guarda al
# recargar y, pasado su tiempo, el árbol vuelve a crecer. El adulto con hacha de piedra pide muchos golpes.
# Capturas de cerca en PC (1280×800) y móvil (390×844).
# Uso: python3 pruebas/prueba_tala_navegador.py dist/kinhold_demo.html <carpeta>
# Caído, el árbol se queda entero en el suelo (valravnx, 12 nov) y Usar con el hacha junto a su tronco lo limpia: al
# terminar, deja el tronco y lo menudo.
# Y (P11, 13 nov) el tocón se arranca con Usar llevando la azada o el palo cavador: se va, deja leña y no vuelve a crecer.
# MUTAR=1: el árbol talado sigue «en pie» (sin tocón ni caída): tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TALLER = re.search(r"TALLER = '(taller-v\d+)'", open(os.path.join(RAIZ, 'src/mundo/eleccion.js'), encoding='utf8').read()).group(1)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1'
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
        if (!r.ok || r.cae || r.limpio) break; }}
      return {{ ok: r.ok, cae: !!r.cae, limpio: !!r.limpio, faltan: r.faltan, motivo: r.motivo || '', dir: r.dir }}; }})()""")

# el jugador al lado del árbol caído, a media altura de su tronco tumbado, mirándolo; la cámara de lado
def junto_caido(pg, a, dist=5.5, pitch=0.45, giro=0.9, en=0.5):
    pg.evaluate(f"""(() => {{ const k = {K}, t = k.talaV.tala.tendido('{a['id']}', Date.now());
      const mx = t.x0 + (t.x1 - t.x0) * {en}, mz = t.z0 + (t.z1 - t.z0) * {en}, l = Math.hypot(t.x1 - t.x0, t.z1 - t.z0) || 1;
      const px = -(t.z1 - t.z0) / l, pz = (t.x1 - t.x0) / l;
      k.pj.k = 0; k.pj.x = mx + px * 1.0; k.pj.z = mz + pz * 1.0; k.pj.y = 0; k.pj.rot = Math.atan2(mx - k.pj.x, mz - k.pj.z);
      k.cam.yaw = k.pj.rot + Math.PI + {giro}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()""")

# golpes al tocón con la hora adelantada (P11, arrancar el tocón: src/logica/tala.js)
def arranques(pg, a, n, desde=1):
    return pg.evaluate(f"""(() => {{ const k = {K}, o = k.obstaculos.find(x => x.id === '{a['id']}'); let r;
      for (let i = 0; i < {n}; i++) {{ r = k.talaV.arrancar(k.inventarios, k.registroAcciones, 'jugador:local', o, k.pj.x, k.pj.z, Date.now() + ({desde} + i) * 1000);
        if (!r.ok || r.arrancado) break; }}
      return {{ ok: r.ok, arrancado: !!r.arrancado, faltan: r.faltan, motivo: r.motivo || '' }}; }})()""")
def tocones(pg): return pg.evaluate(f"{K}.talaV.grupo.children.filter(c => c.name === 'tocon').length")
def lena(pg): return pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === 'lena').reduce((n, o) => n + o.cosa.n, 0)")

def accion(pg): return pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : null; }})()")

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
    # la caída (12 nov): con la gravedad, rebota y se asienta según el terreno (o apoyado en lo que tenga delante)
    c = pg.evaluate(f"{K}.talaV.caidas[0] || null")
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=60000)
    ang = pg.evaluate(f"(() => {{ const p = {K}.escena.getObjectByName('arbol_caido'); return p ? 2 * Math.acos(Math.min(1, Math.abs(p.quaternion.w))) : null; }})()")
    comprobar('se asienta: acaba tumbado en el suelo (o apoyado) y se queda así (12 nov: entero, hasta que se limpia)', c is not None and ang is not None and abs(ang - c['final']) < 0.01 and (c['final'] > 1.1 or c['apoyo'] is not None), f"{c} · se queda a {ang}")
    comprobar('al soltarse suena el chasquido y, al dar en el suelo, el golpe', pg.evaluate(f"(() => {{ const q = {K}.talaV.oidos.map(o => o.que); return q.includes('chasquido') && q.includes('suelo'); }})()"))
    foto(pg, 'tala_03_asentado')
    # el crujido de aviso (12 nov): a punto de caer, cruje (suena) y el árbol tiembla un momento
    otro = pg.evaluate(f"(() => {{ const k = {K}, t = k.talaV.tala; const o = k.obstaculos.filter(x => x.arbol && x.id && x.malla && x.id !== '{j['id']}' && t.enPie(x.id, Date.now()))[0]; if (!o) return null; k.talaV.crujir(o); return o.id; }})()")
    comprobar('un árbol que cruje suena y tiembla', otro is not None and pg.evaluate(f"{K}.talaV.temblando === 1 && {K}.talaV.oidos.at(-1).que === 'crujido'"), str(otro))
    pg.wait_for_function(f"{K}.talaV.temblando === 0", timeout=30000)
    comprobar('y luego se queda como estaba', pg.evaluate(f"(() => {{ const k = {K}, o = k.obstaculos.find(x => x.id === '{otro}'), m = new k.escena.matrixWorld.constructor(); o.malla.getMatrixAt(o.instancia, m); return m.equals(o.matriz); }})()"))
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=90000)
    # caído, se queda entero (valravnx, 12 nov) hasta que se limpia con el hacha
    comprobar('caído, se queda entero en el suelo donde se asentó', pg.evaluate(f"{K}.talaV.tumbados === 1 && !!{K}.escena.getObjectByName('arbol_caido') && !{K}.escena.getObjectByName('arbol_cayendo')"))
    comprobar('y aún no ha dejado nada en el suelo', not pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.length"))
    junto_caido(pg, j, dist=8, pitch=0.85, giro=0.6)
    pg.wait_for_timeout(500)
    comprobar('junto a su tronco, con el hacha, la acción es limpiarlo', accion(pg) == 'Limpiar el árbol caído', str(accion(pg)))
    foto(pg, 'tala_03b_caido')
    junto_caido(pg, j, dist=4.2, pitch=0.8, giro=0.5, en=0.3)
    foto(pg, 'tala_03c_caido_de_cerca')
    junto_caido(pg, j)
    pg.evaluate(f"{K}.usar()")
    comprobar('Usar lo empieza a limpiar', pg.evaluate(f"!!{K}.estado.talando"))
    pg.wait_for_function(f"{K}.talaV.tala.progresoLimpiar('{j['id']}') > 0", timeout=60000)
    comprobar('cada golpe lo dice', 'Limpias el árbol caído' in aviso(pg), aviso(pg))
    foto(pg, 'tala_03d_limpiando')
    pg.evaluate(f"{K}.estado.talando = null")
    rl = golpes(pg, j, 10, desde=40)
    comprobar('con sus golpes queda limpio', rl['ok'] and rl['limpio'], str(rl))
    comprobar('limpio, el árbol caído ya no está', pg.evaluate(f"{K}.talaV.tumbados === 0 && !{K}.escena.getObjectByName('arbol_caido')"))
    junto(pg, j)
    comprobar('queda el tocón en el sitio', pg.evaluate(f"(() => {{ const t = {K}.talaV.grupo.children.filter(c => c.name === 'tocon'); return t.length === 1 && Math.hypot(t[0].position.x - {j['x']}, t[0].position.z - {j['z']}) < 0.01; }})()"))
    comprobar('el árbol del bosque ya no se dibuja', pg.evaluate(f"(() => {{ const o = {K}.obstaculos.find(x => x.id === '{j['id']}'), m = new {K}.escena.matrixWorld.constructor(); o.malla.getMatrixAt(o.instancia, m); return Math.abs(m.determinant()) < 1e-9; }})()"))
    suelo = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.map(o => ({{ tipo: o.cosa.tipo, n: o.cosa.n, x: o.x, z: o.z }}))")
    tronco = next((o for o in suelo if o['tipo'] == 'tronco_delgado'), None)
    varas = next((o for o in suelo if o['tipo'] == 'vara'), None)
    comprobar('en el suelo, un tronco delgado y de 2 a 4 varas (no ramas)', tronco is not None and varas is not None and 2 <= varas['n'] <= 4 and not any(o['tipo'] == 'rama' for o in suelo), str(suelo))
    giro = pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.find(o => o.cosa.tipo === 'tronco_delgado').giro")
    comprobar('el tronco queda tumbado a lo largo de donde cayó', giro is not None and abs(giro - (r['dir'] - 1.5708)) < 0.02, f'{giro} y {r["dir"]}')
    comprobar('se ven, donde cayó el árbol', pg.evaluate(f"!!{K}.escena.getObjectByName('suelo_tronco_delgado') && !!{K}.escena.getObjectByName('suelo_vara')"))
    # las varas tienen su modelo (palos rectos), no el hatillo de lino de lo que aún no lo tiene
    largo = pg.evaluate(f"(() => {{ const o = {K}.escena.getObjectByName('suelo_vara'); const b = new ({K}.escena.position.constructor)(); const c = {{ min: 1e9, max: -1e9 }}; o.updateMatrixWorld(true); o.traverse(m => {{ if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) {{ b.fromBufferAttribute(a, i); c.min = Math.min(c.min, b.x); c.max = Math.max(c.max, b.x); }} }}); return c.max - c.min; }})()")
    comprobar('las varas se ven como palos de 1,6 m tumbados', 1.5 < largo < 2.0, f'{largo:.2f} m')
    foto(pg, 'tala_03_tocon_y_tronco')
    junto(pg, j, dist=3.2, pitch=0.5, giro=0.4)
    foto(pg, 'tala_04_tocon_de_cerca')
    # coger el tronco: con las dos manos (es grande), así que primero se suelta el hacha
    pg.evaluate(f"{K}.soltarAlSuelo('mano:der')")
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.x = {tronco['x']}; k.pj.z = {tronco['z']} - 0.6; }})()")
    pg.evaluate(f"{K}.usar()")
    comprobar('el tronco delgado se coge con Usar (en las dos manos)', pg.evaluate(f"{K}.inventario.lugares['mano:der']?.tipo") == 'tronco_delgado', pg.evaluate(f"JSON.stringify({K}.inventario.lugares['mano:der'])"))
    # y se lo echa al hombro (7 nov: es la madera de la casa humilde y se lleva así a la obra)
    r = pg.evaluate(f"(() => {{ const r = {K}.accionInventario({{ tipo: 'ponerse', de: 'mano:der' }}); {K}.pintarLlevas(); {K}.vestir(); return r; }})()")
    comprobar('el tronco delgado se echa al hombro y deja las manos libres', r['ok'] and pg.evaluate(f"{K}.inventario.lugares.hombro?.tipo") == 'tronco_delgado' and not pg.evaluate(f"{K}.inventario.lugares['mano:der']"), str(r))
    try: pg.wait_for_function(f"{K}.jugador.modo === 'hombroQuieto'", timeout=8000)
    except Exception: pass
    pg.wait_for_timeout(1200)
    comprobar('con la postura de llevarlo al hombro', pg.evaluate(f"{K}.jugador.modo") == 'hombroQuieto', pg.evaluate(f"{K}.jugador.modo"))
    pg.evaluate(f"(() => {{ const K = {K}; K.cam.dist = 2.2; K.cam.pitch = 0.3; K.cam.yaw = K.jugador.raiz.rotation.y + 0.6; }})()")
    pg.wait_for_timeout(600)
    foto(pg, 'tala_04c_tronco_delgado_al_hombro')
    # las varas, de cerca
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.x = {varas['x']} + 1.3; k.pj.z = {varas['z']} + 0.4; k.cam.dist = 3.4; k.cam.pitch = 0.75; k.cam.yaw = 0.9; }})()")
    pg.wait_for_timeout(900)
    foto(pg, 'tala_04b_varas_de_cerca')
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
    comprobar('con el hacha de hierro cae enseguida', r['cae'], str(r))
    pg.wait_for_function(f"{K}.talaV.cayendo === 0", timeout=90000)
    junto_caido(pg, ad, dist=11, pitch=0.8, giro=0.7)
    pg.wait_for_timeout(500)
    foto(pg, 'tala_05_adulto_caido')
    rl = golpes(pg, ad, 30, desde=60)
    comprobar('y limpio, deja un tronco largo y las ramas', rl['limpio'] and pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'tronco_largo') && {K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'rama')"), str(rl))
    junto(pg, ad, dist=7.5, pitch=0.42, giro=1.3)
    foto(pg, 'tala_05_adulto_talado')
    print('PC: arrancar el tocón con la azada (P11, limpiar el campo)')
    pg.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.soltarAlSuelo(m); }})()")
    junto(pg, ad, dist=3.6, pitch=0.42, giro=1.0)
    comprobar('sin azada ni palo cavador, Usar junto al tocón no lo arranca', accion(pg) != 'Arrancar el tocón', str(accion(pg)))
    en_mano(pg, 'azada')
    comprobar('con la azada en la mano, junto al tocón, la acción es «Arrancar el tocón»', accion(pg) == 'Arrancar el tocón', str(accion(pg)))
    pg.keyboard.press('f')
    comprobar('Usar empieza a arrancarlo', pg.evaluate(f"!!({K}.estado.talando && {K}.estado.talando.arranque)"))
    pg.wait_for_function(f"({K}.talaV.tala.estado['{ad['id']}'].arranca || 0) > 0", timeout=60000)
    comprobar('cada golpe lo dice', 'Arrancas el tocón' in aviso(pg), aviso(pg))
    foto(pg, 'tala_05b_arrancando')
    pg.evaluate(f"{K}.estado.talando = null")
    l0 = lena(pg)
    ra = arranques(pg, ad, 40, desde=100)
    comprobar('con sus golpes queda arrancado', ra['ok'] and ra['arrancado'], str(ra))
    comprobar('arrancado: el tocón ya no está', tocones(pg) == 0)
    comprobar('deja 4 de leña en el suelo', lena(pg) - l0 == 4, str(lena(pg) - l0))
    pg.evaluate(f"{K}.talaV.tala.estado['{ad['id']}'].vuelve = Date.now() - 1; {K}.talaV.refrescar()")
    comprobar('arrancado, ya no vuelve a crecer aunque pase su tiempo', not en_pie(pg, ad) and tocones(pg) == 0)
    junto(pg, ad, dist=4.2, pitch=0.5, giro=1.0)
    foto(pg, 'tala_05c_tocon_arrancado')
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
    comprobar('móvil: cae y queda caído, entero', r['cae'] and not en_pie(pg, j) and pg.evaluate(f"{K}.talaV.tumbados === 1"))
    junto_caido(pg, j, dist=6.5, pitch=0.85, giro=0.5)
    pg.wait_for_timeout(500)
    foto(pg, 'tala_07_movil_caido')
    pg.locator('#btnUsar').tap()
    pg.wait_for_function(f"{K}.talaV.tala.progresoLimpiar('{j['id']}') > 0", timeout=60000)
    comprobar('móvil: el botón Usar lo limpia', pg.evaluate(f"!!{K}.estado.talando"))
    pg.evaluate(f"{K}.estado.talando = null")
    rl = golpes(pg, j, 10, desde=40)
    comprobar('móvil: limpio, deja el tronco delgado', rl['limpio'] and pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'tronco_delgado')"), str(rl))
    junto(pg, j, dist=4.2)
    foto(pg, 'tala_07_movil_tocon')
    print('Móvil: arrancar el tocón con el palo cavador')
    pg.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.soltarAlSuelo(m); }})()")
    junto(pg, j, dist=3.4, pitch=0.45)
    en_mano(pg, 'palo_cavador')
    comprobar('móvil: con el palo cavador, «Arrancar el tocón»', accion(pg) == 'Arrancar el tocón', str(accion(pg)))
    pg.locator('#btnUsar').tap()
    pg.wait_for_function(f"({K}.talaV.tala.estado['{j['id']}'].arranca || 0) > 0", timeout=60000)
    comprobar('móvil: el botón Usar lo arranca', pg.evaluate(f"!!({K}.estado.talando && {K}.estado.talando.arranque)"))
    foto(pg, 'tala_08_movil_arrancando')
    pg.evaluate(f"{K}.estado.talando = null")
    ra = arranques(pg, j, 20, desde=100)
    comprobar('móvil: con el palo cavador, el doble de golpes: arrancado', ra['ok'] and ra['arrancado'] and tocones(pg) == 0, str(ra))
    comprobar('sin errores en la consola (móvil)', not pg.errores, '; '.join(pg.errores[:3]))
    nav.close()

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
