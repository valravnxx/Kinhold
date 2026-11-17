# Prueba en navegador (Chromium sin pantalla) del horno de reducción (P10, 17 nov). En el mundo de verdad (Whitholm),
# sin servidor, primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - tres hornos puestos a la vista: uno apagado con la carga al pie (mineral, carbón y yesca), uno reduciendo (humo
#     espeso y llama por la boca, el arco y la tobera al rojo) y otro con la lupia hecha delante del arco, sin humo;
#   - el que reduce deja de humear al pasar su hora, y entonces se ve la lupia;
#   - su pestaña «Horno de reducción» en el panel de fabricar, con la lupia de hierro: lo que pide y que hace falta el
#     taladro de fuego; sin salirse de lado en el móvil;
#   - sin errores en la página.
# Capturas de cerca de los tres hornos (por delante y por detrás) y del panel, en PC y en móvil; y de cerca el carbón y
# la lupia en el suelo.
# Uso: python3 pruebas/prueba_horno_navegador.py <html> <carpeta_capturas>
# Rota a propósito (17 nov): MUTAR=1 no pone el humo al horno que reduce: falla.
import sys, os, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_horno'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def esperar(pg, ms=2500):
    pg.wait_for_timeout(ms)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=180000)
    except Exception: pass
    pg.wait_for_timeout(1500)

# Los tres hornos, a unos pasos del jugador, en llano; el que reduce, con 2 min por delante (según la hora de la página).
PONER = f"""((mutar) => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x + 2, z0 = k.pj.z - 4, ahora = Date.now();
  k.__vistas = {{
    'horno:apagado': {{ id: 'horno:apagado', tipo: 'horno_reduccion', x: x0 - 2.6, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ mineral_hierro: 3, carbon: 4, yesca: 1 }} }},
    'horno:reduce':  {{ id: 'horno:reduce', tipo: 'horno_reduccion', x: x0, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, colgado: mutar ? [] : [{{ hasta: ahora + 120000 }}] }},
    'horno:lupia':   {{ id: 'horno:lupia', tipo: 'horno_reduccion', x: x0 + 2.6, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, colgado: [{{ hasta: ahora - 1000 }}] }},
  }};
  Object.assign(f.estaciones, k.__vistas); k.estacionesV.refrescar();
  return {{ x: x0, z: z0 }}; }})"""
HUMO = f"((id) => {{ const o = {K}.escena.children.flatMap(c => c.name === 'estaciones' ? c.children : []).find(o => o.userData.id === id); const f = o && o.getObjectByName('fuego'); return {{ humo: !!f && f.children.filter(m => m.name === 'humo').length, llama: !!f && f.children.some(m => m.name === 'llama'), rescoldo: !!o && !!o.getObjectByName('rescoldo') && o.getObjectByName('rescoldo').visible, lupia: !!o && !!o.getObjectByName('lupia_hecha'), carga: !!o && ['mineral_hierro', 'carbon', 'yesca'].every(t => !!o.getObjectByName('deposito_' + t)) }}; }})"

def mirar(pg, c, dx, dz, yaw, dist, pitch, lado=1.2):
    # el jugador, a un lado de lo que se mira (lado m a la derecha según la cámara) y mirándolo: no lo tapa
    pg.evaluate(f"([x, z, yaw, d, p]) => {{ const k = {K}, px = x + Math.cos(yaw) * {lado}, pz = z - Math.sin(yaw) * {lado}; k.pj.x = px; k.pj.z = pz; k.pj.y = k.alturaSuelo(px, pz); k.pj.rot = Math.atan2(x - px, z - pz); k.cam.yaw = yaw; k.cam.dist = d; k.cam.pitch = p; }}", [c['x'] + dx, c['z'] + dz, yaw, dist, pitch])
    pg.wait_for_timeout(2500)

def recorrido(nav, nombre, pref, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    pg = ctx.new_page(); errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    esperar(pg, 3000)
    c = pg.evaluate(f"{PONER}({'true' if MUTAR else 'false'})")
    pg.evaluate(f"(() => {{ const k = {K}; k.pj.x = {c['x']}; k.pj.z = {c['z']} + 3; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); }})()")
    esperar(pg, 2500)
    a, r, l = (pg.evaluate(HUMO, i) for i in ['horno:apagado', 'horno:reduce', 'horno:lupia'])
    comprobar(f'{nombre}: el horno apagado, sin humo y con la carga al pie (mineral, carbón y yesca)', not a['humo'] and not a['rescoldo'] and a['carga'], str(a))
    comprobar(f'{nombre}: el que reduce, con humo, llama por la boca y el arco al rojo', r['humo'] >= 6 and r['llama'] and r['rescoldo'] and not r['lupia'], str(r))
    comprobar(f'{nombre}: el de la lupia hecha, sin humo y con la lupia delante del arco', not l['humo'] and not l['rescoldo'] and l['lupia'], str(l))
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.25 if movil else 1   # (en el móvil, estrecho, algo más lejos para que quepan, y el jugador más cerca de lo mirado)
    LADO = 0.55 if movil else 1.2
    mirar(pg, c, 0, 1.2, 0, 6.0 * D, 0.3)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SALIDA}/{pref}_hornos.png', timeout=180000)
    mirar(pg, c, 0, 0.6, 0.25, 3.2 * D, 0.12, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_humo.png', timeout=180000)
    mirar(pg, c, 2.6, 0.7, -0.2, 2.6 * D, 0.3, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_lupia.png', timeout=180000)
    mirar(pg, c, -2.6, 0.7, 0.2, 2.8 * D, 0.35, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_carga.png', timeout=180000)
    mirar(pg, c, 0, -0.6, 2.6, 3.2 * D, 0.2, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_detras.png', timeout=180000)
    # al pasar su hora deja de humear y se ve la lupia
    pg.evaluate(f"(() => {{ const k = {K}; k.__vistas['horno:reduce'].colgado = [{{ hasta: Date.now() - 1 }}]; Object.assign(k.fabCliente.estaciones, k.__vistas); k.estacionesV.refrescar(); }})()")
    pg.wait_for_timeout(2500)
    r2 = pg.evaluate(HUMO, 'horno:reduce')
    comprobar(f'{nombre}: al pasar su hora deja de humear y se ve la lupia', not r2['humo'] and not r2['rescoldo'] and r2['lupia'], str(r2))
    # el panel: su pestaña, la lupia
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"(() => {{ const k = {K}, e = k.fabCliente.estaciones['horno:apagado']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.1; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('horno:apagado')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: su pestaña «Horno de reducción», con la lupia de hierro', pg.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"reducir\"]')") and 'Lupia de hierro' in texto, texto[:300])
    if movil: pg.tap('#panelFabricar .fab-carta[data-fila="reducir"]')
    else: pg.click('#panelFabricar .fab-carta[data-fila="reducir"]')
    pg.wait_for_timeout(800)
    ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha pide el mineral y el carbón y el taladro de fuego, y dice lo que tarda (1 h)', re.search('mineral', ficha, re.I) and re.search('carb', ficha, re.I) and re.search('taladro', ficha, re.I) and '1 h' in ficha, ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")   # (en el móvil la hoja se desplaza: lo de abajo, entero)
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_horno.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
    if not movil:   # el carbón y la lupia en el suelo, de cerca, lejos de los hornos
        p0 = {'x': c['x'] - 1.4, 'z': c['z'] + 2.6}
        pg.evaluate(f"(([x, z]) => {{ const k = {K}; k.sueloObjetos.suelo.dejar({{ tipo: 'carbon', n: 4 }}, x - 0.25, z, Date.now(), 'vista', false); k.sueloObjetos.suelo.dejar({{ tipo: 'lupia', n: 1 }}, x + 0.25, z + 0.05, Date.now(), 'vista', false); k.sueloObjetos.refrescar(); }})", [p0['x'], p0['z']])
        n = pg.evaluate(f"{K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => ['carbon', 'lupia'].includes(o.cosa.tipo)).length")
        comprobar(f'{nombre}: el carbón y la lupia se dejan en el suelo', n == 2, str(n))
        pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
        mirar(pg, p0, 0, 0, 0.5, 2.2, 0.95, 0.7)
        pg.screenshot(path=f'{SALIDA}/{pref}_carbon_lupia.png', timeout=180000)
    comprobar(f'{nombre}: sin errores en la página', not errores, str(errores[:3]))
    ctx.close()

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    recorrido(nav, 'PC', 'PC', {'width': 1280, 'height': 800}, False)   # una cosa cada vez: el PC termina y se cierra
    if os.environ.get('SOLO') != 'PC': recorrido(nav, 'móvil', 'movil', {'width': 390, 'height': 844}, True)
    nav.close()
srv.shutdown()
print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
