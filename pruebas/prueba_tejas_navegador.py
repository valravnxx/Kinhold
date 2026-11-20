# Prueba en navegador (Chromium sin pantalla) de las tejas (P10, 20 nov): en el horno cerámico encendido, 2 cestas de
# arcilla dan 10 tejas al cabo de media hora real; con ellas, el tejado y el remate de teja. Sin servidor y en un llano,
# primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - el horno cerámico encendido con 2 cestas de arcilla dejadas: en su pestaña del panel, «Tejas», que se pueden hacer
#     ya: piden 2 cestas de arcilla, dan 10 tejas y tardan 30 min;
#   - «Hacer» las mete a cocer (se gasta la arcilla del horno y entran en su cola, con media hora por delante); pasada
#     la media hora, «Recoger» da 10 tejas;
#   - las tejas y la arcilla, en el suelo, de cerca;
#   - en Construir, pestaña Tejados, el tejado de teja (10 tejas y 1 tronco) y el remate de teja (5 tejas y 1 tronco),
#     con su imagen cargada;
#   - una casa con su tejado de teja a dos aguas y los remates de teja en un hastial, de cerca;
#   - sin errores en la página.
# Uso: python3 pruebas/prueba_tejas_navegador.py <html> <carpeta_capturas>
# Rota a propósito (20 nov): MUTAR=1 recoge antes de la media hora: falla «pasada la media hora».
import sys, os, json, shutil
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_tejas'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
srv = servir(sitio)
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&llano=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
OX, OZ = 4, -3   # la esquina de la casa
HX, HZ = -3.0, 4.0   # el horno
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

# Una casa de 3 × 2 casillas: cimiento, muros de tronco (con su puerta) y, encima, el tejado de teja a dos aguas en las
# dos primeras columnas y el remate de teja en la tercera (el hastial a cuatro aguas).
CASA = f"""(() => {{
  const K = {K}, m = K.mundo;
  const c = {{ id: m.siguienteId++, ox: {OX}, oz: {OZ}, rot: 0, piezas: new Map() }}; m.construcciones.push(c);
  const H = {{ cim_tronco: 'f', muro_tronco: 'e', muro_tronco_puerta: 'e', tejado_teja: 'r', remate_teja: 'r' }}, fallos = [];
  const pon = (tipo, i, j, k, d = 0, dir = 0) => {{ const p = {{ tipo, hueco: H[tipo], i, j, k, dir, abierta: false }}; if (H[tipo] === 'e') p.d = d;
    const r = m.colocar({{ construccion: c, nueva: false, pieza: p }}); if (!r.ok) fallos.push(`${{tipo}} ${{i}},${{j}},${{k}}: ${{r.motivo}}`); }};
  for (const k in m.materiales) m.materiales[k] += 500;
  const NI = 3, NJ = 2;
  for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) pon('cim_tronco', i, j, 0);
  for (let i = 0; i < NI; i++) {{ pon(i === 1 ? 'muro_tronco_puerta' : 'muro_tronco', i, 0, 0, 0); pon('muro_tronco', i, NJ, 0, 0); }}
  for (let j = 0; j < NJ; j++) {{ pon('muro_tronco', 0, j, 0, 1); pon('muro_tronco', NI, j, 0, 1); }}
  for (let i = 0; i < 2; i++) {{ pon('tejado_teja', i, 0, 1, 0, 0); pon('tejado_teja', i, 1, 1, 0, 2); }}
  pon('remate_teja', 2, 0, 1, 0, 1); pon('remate_teja', 2, 1, 1, 0, 2);
  for (const c2 of m.construcciones) for (const p of c2.piezas.values()) delete p.obra;
  K.reconstruir();
  return {{ fallos, n: c.piezas.size, teja: [...c.piezas.values()].filter(p => p.tipo === 'tejado_teja').length, remate: [...c.piezas.values()].filter(p => p.tipo === 'remate_teja').length }};
}})()"""

# El horno cerámico, ya levantado y encendido (con 1 h de fuego por delante, como lo manda el servidor), con 2 cestas
# de arcilla dejadas en él.
HORNO = f"""(() => {{ const k = {K}, f = k.fabCliente, ahora = Date.now();
  f.estaciones['horno_ceramico:tejas'] = {{ id: 'horno_ceramico:tejas', tipo: 'horno_ceramico', x: {HX}, z: {HZ}, giro: 0, autor: k.yo, cola: [], deposito: {{ arcilla: 2 }}, fuego: {{ encendida: true, queda: 3600, combustible: 0, cenizas: false }} }};
  k.estacionesV.poner(Object.values(f.estaciones)); }})()"""

def entrar(nav, vista, movil):
    ctx = nav.new_context(viewport=vista, locale='es-ES', **({'is_mobile': True, 'has_touch': True, 'device_scale_factor': 2} if movil else {}))
    pg = ctx.new_page(); err = []
    pg.on('pageerror', lambda e: err.append(str(e)))
    pg.goto(URL); pg.wait_for_function(f'{K} !== undefined', timeout=60000)
    pg.evaluate(f'localStorage.clear(); {K}.reiniciar()'); pg.wait_for_timeout(2000)
    return ctx, pg, err

def tocar(pg, sel, movil):
    if movil: pg.tap(sel)
    else: pg.click(sel)
    pg.wait_for_timeout(900)

def mirar(pg, px, pz, yaw, pitch, dist, rot=0):
    pg.evaluate(f"(() => {{ const k = {K}; k.cambiarModo('mover'); Object.assign(k.pj, {{ x: {px}, z: {pz}, rot: {rot} }}); k.pj.y = k.alturaSuelo({px}, {pz}); k.cam.yaw = {yaw}; k.cam.pitch = {pitch}; k.cam.dist = {dist}; }})()")
    pg.wait_for_timeout(2500)

def recorrido(nav, nombre, vista, movil):
    print(nombre)
    ctx, pg, err = entrar(nav, vista, movil)
    ev = pg.evaluate
    # ---- el horno, el panel, cocer y recoger ----
    ev(HORNO)
    ev(f"(() => {{ const k = {K}; k.cambiarModo('mover'); Object.assign(k.pj, {{ x: {HX} + 0.3, z: {HZ} + 1.4 }}); const i = k.inventario; i.sacar('mano:der'); i.sacar('mano:izq'); k.pintarTodoInventario(); }})()")
    pg.wait_for_timeout(1500)
    ev(f"{K}.panelFabricar.abrirEstacion('horno_ceramico:tejas')"); pg.wait_for_timeout(1200)
    texto = ev("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: en la pestaña «Horno cerámico», las tejas', ev("!!document.querySelector('#panelFabricar .fab-pest.fab-sel[data-pestana=\"cocer\"]')") and 'Tejas' in texto, texto[:300])
    comprobar(f'{nombre}: se pueden hacer ya (el horno encendido y la arcilla dejada en él)', ev("!!document.querySelector('#panelFabricar .fab-carta[data-fila=\"tejas\"]')") and ev(f"{K}.fabCliente.lista({{ x: {HX} + 0.3, z: {HZ} + 1.4 }}, {K}.inventario, {K}.sueloObjetos.suelo, Date.now()).find(x => x.receta === 'tejas').grupo") == 'ya')
    tocar(pg, '#panelFabricar .fab-carta[data-fila="tejas"]', movil)
    ficha = ev("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha: 2 cestas de arcilla, 10 tejas, 30 min', 'arcilla' in ficha.lower() and '10' in ficha and '30 min' in ficha, ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', ev("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{nombre}_panel_tejas.png', timeout=180000)
    tocar(pg, '#panelFabricar .fab-hacer[data-receta="tejas"]', movil)
    pg.wait_for_timeout(1000)
    cola = ev(f"(() => {{ const e = {K}.fabCliente.estaciones['horno_ceramico:tejas']; return {{ cola: e.cola.map(c => ({{ receta: c.receta, dura: c.fin - c.empieza }})), arcilla: e.deposito.arcilla || 0 }}; }})()")
    comprobar(f'{nombre}: «Hacer» las mete a cocer: se gasta la arcilla del horno y entran en su cola con media hora', cola['arcilla'] == 0 and len(cola['cola']) == 1 and cola['cola'][0]['receta'] == 'tejas' and cola['cola'][0]['dura'] == 1800000, json.dumps(cola))
    pg.screenshot(path=f'{SALIDA}/{nombre}_panel_cociendo.png', timeout=180000)
    # pasada la media hora: el reloj de la página, media hora y un poco más adelante (como si hubiera pasado)
    ev(f"(() => {{ const d = Date.now.bind(Date); Date.now = () => d() + {'1700000' if MUTAR == '1' else '1801000'}; }})()")
    ev(f"{K}.panelFabricar.cerrar()"); ev(f"{K}.panelFabricar.abrirEstacion('horno_ceramico:tejas')"); pg.wait_for_timeout(1200)
    hay = ev("!!document.querySelector('#panelFabricar .fab-recoger')")
    if hay: tocar(pg, '#panelFabricar .fab-recoger', movil); pg.wait_for_timeout(800)
    n = ev(f"{K}.inventario.cuantos('teja')")
    comprobar(f'{nombre}: pasada la media hora, «Recoger» da 10 tejas', hay and n == 10, f'recoger={hay} tejas={n}')
    ev(f"{K}.panelFabricar.cerrar()")
    # ---- en el suelo, de cerca ----
    if not movil:
        ev(f"(() => {{ const k = {K}, t = Date.now(); k.sueloObjetos.suelo.dejar({{ tipo: 'teja', n: 10 }}, {HX} + 3.0, {HZ} + 0.4, t, 'vista', false); k.sueloObjetos.suelo.dejar({{ tipo: 'teja', n: 3 }}, {HX} + 3.7, {HZ} + 0.9, t, 'vista', false); k.sueloObjetos.suelo.dejar({{ tipo: 'arcilla', n: 2 }}, {HX} + 2.3, {HZ} + 1.0, t, 'vista', false); k.sueloObjetos.refrescar(); }})()")
        n = ev(f"{K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => ['teja', 'arcilla'].includes(o.cosa.tipo)).length")
        comprobar(f'{nombre}: las tejas y la arcilla se dejan en el suelo', n == 3, str(n))
        pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
        # con la cámara libre (la del admin), de cerca y algo desde arriba; el jugador, lejos (no las tapa)
        ev(f"(() => {{ const k = {K}; k.cambiarModo('mover'); Object.assign(k.pj, {{ x: {HX} - 3, z: {HZ} + 9 }}); Object.assign(k.camLibre, {{ activa: true, x: {HX} + 3.1, y: 1.15, z: {HZ} + 2.3 }}); k.cam.yaw = 0.1; k.cam.pitch = 0.62; }})()")
        pg.wait_for_timeout(2500)
        pg.screenshot(path=f'{SALIDA}/{nombre}_tejas_suelo.png', timeout=180000)
        ev(f"{K}.camLibre.activa = false")
        mirar(pg, HX + 1.5, HZ + 3.6, -0.9, 0.35, 4.5, 2.5)
        pg.screenshot(path=f'{SALIDA}/{nombre}_horno_tejas.png', timeout=180000)
        pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    # ---- en Construir: el tejado y el remate de teja ----
    ev(f"{K}.llevarPara('mojon', 'mojon'); {K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon'); {K}.apuntar({OX - 3}, {OZ - 3}); {K}.colocar()")
    comprobar(f'{nombre}: su mojón (para construir la casa)', ev(f'!!{K}.miMojon'))
    ev(f"{K}.cambiarModo('mover'); {K}.cambiarModo('construir')"); pg.wait_for_timeout(1000)
    pg.click('#pestanas button[data-cat="tejado"]'); pg.wait_for_timeout(1500)
    lista = []
    for paso in range(0, 7):   # (las de fuera se cargan al deslizar: poco a poco, que cada una pase por la vista)
        ev(f"(() => {{ const e = document.getElementById('piezas'); e.scrollLeft = e.scrollWidth * {paso} / 6; }})()"); pg.wait_for_timeout(700)
        for e in ev("[...document.querySelectorAll('#piezas button.pieza')].map(b => { const i = b.querySelector('img.pz-img'); return [b.querySelector('b').textContent, !!i && i.complete && i.naturalWidth > 0, [...b.querySelectorAll('.cc')].map(c => c.title).join(' ')]; })"):
            if e[1] or e[0] not in [x[0] for x in lista]: lista = [x for x in lista if x[0] != e[0]] + [e]
    tj = {e[0]: e for e in lista}
    for n, coste in [('Tejado de teja', '10 teja'), ('Remate de teja (esquina)', '5 teja')]:
        e = tj.get(n)
        comprobar(f'{nombre}: en «Tejados», {n.lower()} a la vista, con su imagen cargada', bool(e) and e[1], str(list(tj)))
        comprobar(f'{nombre}:   y cuesta {coste}s y 1 tronco', bool(e) and e[2].startswith(coste) and '1 tronco' in e[2], e[2] if e else '')
    ev("(() => { const e = document.getElementById('piezas'); e.scrollLeft = e.scrollWidth; })()"); pg.wait_for_timeout(1200)
    pg.screenshot(path=f'{SALIDA}/{nombre}_menu_tejados.png', timeout=180000)
    # ---- la casa con su tejado de teja ----
    r = ev(CASA)
    comprobar(f'{nombre}: la casa de 3 × 2 con el tejado de teja (4 tramos) y 2 remates de teja', not r['fallos'] and r['teja'] == 4 and r['remate'] == 2, json.dumps(r, ensure_ascii=False)[:300])
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.3 if movil else 1
    mirar(pg, OX + 3.0, OZ + 6.0, 0.45, 0.32, 9.0 * D)
    pg.screenshot(path=f'{SALIDA}/{nombre}_casa_teja.png', timeout=180000)
    mirar(pg, OX + 7.5, OZ + 2.0, 1.25, 0.28, 6.0 * D, 1.5)
    pg.screenshot(path=f'{SALIDA}/{nombre}_casa_teja_remate.png', timeout=180000)
    mirar(pg, OX + 3.0, OZ + 4.6, 0.15, 0.15, 3.6 * D)
    pg.screenshot(path=f'{SALIDA}/{nombre}_casa_teja_alero.png', timeout=180000)
    malos = [x for x in err if 'WebSocket' not in x]
    comprobar(f'{nombre}: sin errores en la página', not malos, str(malos[:3]))
    ctx.close()

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    recorrido(nav, 'PC', {'width': 1280, 'height': 800}, False)   # una cosa cada vez: el PC termina y se cierra
    if os.environ.get('SOLO') != 'PC': recorrido(nav, 'movil', {'width': 390, 'height': 844}, True)
    nav.close()
srv.shutdown(); shutil.rmtree(sitio, ignore_errors=True)
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
