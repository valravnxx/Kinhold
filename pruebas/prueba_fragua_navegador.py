# Prueba en navegador (Chromium sin pantalla) de la fragua y la barra de hierro (P10, 19 nov). En el mundo de verdad
# (Whitholm), sin servidor, primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - dos fraguas a la vista: una apagada con el carbón puesto en la cubeta y la lupia y el carbón dejados al pie, y
#     otra encendida (el fuego arde sobre el lecho);
#   - su pestaña «Fragua» en el panel de fabricar, con la barra de hierro: lo que pide y que hace falta el mazo de
#     piedra; y su fuego, que solo come carbón (ni ramas ni leña); sin salirse de lado en el móvil;
#   - el fuelle y la barra de hierro, en el suelo;
#   - sin errores en la página.
# Capturas de cerca de las dos fraguas (por delante, de lado y por detrás) y del panel, en PC y en móvil; y de cerca el
# fuelle y la barra en el suelo.
# Uso: python3 pruebas/prueba_fragua_navegador.py <html> <carpeta_capturas>
# Rota a propósito (19 nov): MUTAR=1 deja apagada la fragua encendida: falla.
import sys, os, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_fragua'
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

# Las dos fraguas, a unos pasos del jugador; la encendida, con 10 min de fuego por delante (según la hora de la página).
PONER = f"""((mutar) => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x + 2, z0 = k.pj.z - 4, ahora = Date.now();
  k.__vistas = {{
    'fragua:apagada':   {{ id: 'fragua:apagada', tipo: 'fragua', x: x0 - 1.7, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ lupia: 1, carbon: 1 }}, fuego: {{ hasta: 0, combustible: 900, cenizas: false }} }},
    'fragua:encendida': {{ id: 'fragua:encendida', tipo: 'fragua', x: x0 + 1.7, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, fuego: mutar ? {{ hasta: 0, combustible: 0, cenizas: false }} : {{ hasta: ahora + 600000, combustible: 0, cenizas: false }} }},
  }};
  Object.assign(f.estaciones, k.__vistas); k.estacionesV.refrescar();
  return {{ x: x0, z: z0 }}; }})"""
FUEGO = f"((id) => {{ const o = {K}.escena.children.flatMap(c => c.name === 'estaciones' ? c.children : []).find(o => o.userData.id === id); const f = o && o.getObjectByName('fuego'); const r = o && o.getObjectByName('ramas'); return {{ hay: !!o, llama: !!f && f.children.some(m => m.name === 'llama'), carbon: !!r && r.visible, carga: !!o && ['lupia', 'carbon'].every(t => !!o.getObjectByName('deposito_' + t)) }}; }})"

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
    a, e = (pg.evaluate(FUEGO, i) for i in ['fragua:apagada', 'fragua:encendida'])
    comprobar(f'{nombre}: la fragua apagada, sin llama, con el carbón puesto en la cubeta y la lupia y el carbón al pie', a['hay'] and not a['llama'] and a['carbon'] and a['carga'], str(a))
    comprobar(f'{nombre}: la encendida, con su fuego sobre el lecho', e['hay'] and e['llama'], str(e))
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.25 if movil else 1   # (en el móvil, estrecho, algo más lejos para que quepan, y el jugador más cerca de lo mirado)
    LADO = 0.55 if movil else 1.2
    mirar(pg, c, 0, 1.4, 0, 6.0 * D, 0.3)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SALIDA}/{pref}_fraguas.png', timeout=180000)
    mirar(pg, c, 1.7, 0.4, 0.35, 3.0 * D, 0.25, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_fragua_fuego.png', timeout=180000)
    mirar(pg, c, -1.7, 0.4, -0.3, 2.8 * D, 0.4, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_fragua_apagada.png', timeout=180000)
    mirar(pg, c, -1.2, 0, 1.5, 2.8 * D, 0.3, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_fragua_fuelle.png', timeout=180000)
    mirar(pg, c, -1.7, -0.3, 3.0, 3.0 * D, 0.25, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_fragua_detras.png', timeout=180000)
    # el panel: su pestaña, la barra de hierro, y el fuego (solo carbón)
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"(() => {{ const k = {K}, inv = k.inventario; if (inv) {{ inv.meterDonde('carbon', 3); inv.meterDonde('rama', 2); }} const e = k.fabCliente.estaciones['fragua:apagada']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.3; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('fragua:apagada')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: su pestaña «Fragua», con la barra de hierro', pg.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"forjar\"]')") and 'Barra de hierro' in texto, texto[:300])
    echar = pg.evaluate("[...document.querySelectorAll('#panelFabricar .fab-echar')].map(b => b.dataset.objeto)")
    comprobar(f'{nombre}: a su fuego solo se le echa carbón', echar == ['carbon'], str(echar))
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_fragua.png', timeout=180000)
    if movil: pg.tap('#panelFabricar .fab-carta[data-fila="barra_hierro"]')
    else: pg.click('#panelFabricar .fab-carta[data-fila="barra_hierro"]')
    pg.wait_for_timeout(800)
    ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha pide la lupia y el carbón y el mazo de piedra', re.search('lupia', ficha, re.I) and re.search('carb', ficha, re.I) and re.search('mazo', ficha, re.I), ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_fragua_ficha.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
    if not movil:   # el fuelle y la barra de hierro en el suelo, de cerca, lejos de las fraguas
        p0 = {'x': c['x'] - 1.0, 'z': c['z'] + 3.0}
        pg.evaluate(f"(([x, z]) => {{ const k = {K}; k.sueloObjetos.suelo.dejar({{ tipo: 'fuelle', n: 1 }}, x - 0.35, z, Date.now(), 'vista', false); k.sueloObjetos.suelo.dejar({{ tipo: 'barra_hierro', n: 3 }}, x + 0.35, z + 0.05, Date.now(), 'vista', false); k.sueloObjetos.refrescar(); }})", [p0['x'], p0['z']])
        n = pg.evaluate(f"{K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => ['fuelle', 'barra_hierro'].includes(o.cosa.tipo)).length")
        comprobar(f'{nombre}: el fuelle y la barra se dejan en el suelo', n == 2, str(n))
        pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
        mirar(pg, p0, 0, 0, 0.5, 2.2, 0.95, 0.7)
        pg.screenshot(path=f'{SALIDA}/{pref}_fuelle_barra.png', timeout=180000)
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
