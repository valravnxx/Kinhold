# Prueba en navegador (Chromium sin pantalla) de la carbonera (oficios, 18 nov). En el mundo de verdad (Whitholm),
# sin servidor, primero en PC (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - tres carboneras puestas a la vista: una sin encender con la yesca al pie, una ardiendo (humo blanquecino por el
#     tiro, sin llama, y el tiro y los respiraderos al rojo) y otra con el carbón hecho delante, sin humo;
#   - la que arde deja de humear al pasar su hora, y entonces se ve el carbón;
#   - recogido el carbón (el servidor la quita), no queda nada de ella;
#   - su pestaña «Carbonera» en el panel de fabricar, con el carbón vegetal: lo que pide (la yesca), que hace falta el
#     taladro de fuego y lo que tarda (4 h); sin salirse de lado en el móvil;
#   - sin errores en la página.
# Capturas de cerca de las tres (por delante y por detrás) y del panel, en PC y en móvil.
# Uso: python3 pruebas/prueba_carbonera_navegador.py <html> <carpeta_capturas>
# Rota a propósito (18 nov): MUTAR=1 no pone el humo a la carbonera que arde: falla.
import sys, os, re
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_carbonera'
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

# Las tres carboneras, a unos pasos del jugador; la que arde, con 2 min por delante (según la hora de la página).
PONER = f"""((mutar) => {{ const k = {K}, f = k.fabCliente, x0 = k.pj.x + 2, z0 = k.pj.z - 4, ahora = Date.now();
  k.__vistas = {{
    'carb:apagada': {{ id: 'carb:apagada', tipo: 'carbonera', x: x0 - 3.2, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{ yesca: 1 }} }},
    'carb:arde':    {{ id: 'carb:arde', tipo: 'carbonera', x: x0, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, colgado: mutar ? [] : [{{ hasta: ahora + 120000 }}] }},
    'carb:hecha':   {{ id: 'carb:hecha', tipo: 'carbonera', x: x0 + 3.2, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, colgado: [{{ hasta: ahora - 1000 }}] }},
  }};
  Object.assign(f.estaciones, k.__vistas); k.estacionesV.refrescar();
  return {{ x: x0, z: z0 }}; }})"""
HUMO = f"((id) => {{ const o = {K}.escena.children.flatMap(c => c.name === 'estaciones' ? c.children : []).find(o => o.userData.id === id); const f = o && o.getObjectByName('fuego'); const rojos = []; if (o) o.traverse(m => {{ if (m.name === 'respiradero' || m.name === 'tiro') rojos.push(m.material.emissiveIntensity > 0 && m.material.emissive && m.material.emissive.getHex() !== 0); }}); return {{ hay: !!o, humo: !!f && f.children.filter(m => m.name === 'humo').length, llama: !!f && f.children.some(m => m.name === 'llama'), rojo: rojos.length > 0 && rojos.every(Boolean), huecos: rojos.length, carbon: !!o && !!o.getObjectByName('carbon_hecho'), yesca: !!o && !!o.getObjectByName('deposito_yesca') }}; }})"

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
    a, r, l = (pg.evaluate(HUMO, i) for i in ['carb:apagada', 'carb:arde', 'carb:hecha'])
    comprobar(f'{nombre}: la carbonera sin encender, sin humo, con el tiro y los respiraderos apagados y la yesca al pie', not a['humo'] and a['huecos'] >= 6 and not any([a['rojo']]) and a['yesca'], str(a))
    comprobar(f'{nombre}: la que arde, con humo y el tiro y los respiraderos al rojo, sin llama (arde ahogada)', r['humo'] >= 6 and not r['llama'] and r['rojo'] and not r['carbon'], str(r))
    comprobar(f'{nombre}: la del carbón hecho, sin humo y con el carbón delante', not l['humo'] and not l['rojo'] and l['carbon'], str(l))
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.25 if movil else 1
    LADO = 0.55 if movil else 1.2
    mirar(pg, c, 0, 1.2, 0, 7.0 * D, 0.32)
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{SALIDA}/{pref}_carboneras.png', timeout=180000)
    mirar(pg, c, 0, 0.6, 0.25, 3.4 * D, 0.14, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_carbonera_humo.png', timeout=180000)
    mirar(pg, c, 3.2, 0.9, -0.2, 2.8 * D, 0.32, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_carbonera_carbon.png', timeout=180000)
    mirar(pg, c, -3.2, 0.9, 0.2, 2.8 * D, 0.3, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_carbonera_yesca.png', timeout=180000)
    mirar(pg, c, 0, -0.6, 2.6, 3.4 * D, 0.2, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_carbonera_detras.png', timeout=180000)
    # al pasar su hora deja de humear y se ve el carbón; recogido, se deshace (el servidor la quita)
    pg.evaluate(f"(() => {{ const k = {K}; k.__vistas['carb:arde'].colgado = [{{ hasta: Date.now() - 1 }}]; Object.assign(k.fabCliente.estaciones, k.__vistas); k.estacionesV.refrescar(); }})()")
    pg.wait_for_timeout(2500)
    r2 = pg.evaluate(HUMO, 'carb:arde')
    comprobar(f'{nombre}: al pasar su hora deja de humear y se ve el carbón', not r2['humo'] and not r2['rojo'] and r2['carbon'], str(r2))
    pg.evaluate(f"(() => {{ const k = {K}; delete k.fabCliente.estaciones['carb:hecha']; k.estacionesV.refrescar(); }})()")
    pg.wait_for_timeout(1500)
    comprobar(f'{nombre}: deshecha, no queda nada de ella', not pg.evaluate(HUMO, 'carb:hecha')['hay'])
    # el panel: su pestaña, el carbón
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"(() => {{ const k = {K}, e = k.fabCliente.estaciones['carb:apagada']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.2; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('carb:apagada')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: su pestaña «Carbonera», con el carbón vegetal', pg.evaluate("!!document.querySelector('#panelFabricar .fab-pest[data-pestana=\"carbonear\"]')") and 'Carbón vegetal' in texto, texto[:300])
    if movil: pg.tap('#panelFabricar .fab-carta[data-fila="carbonear"]')
    else: pg.click('#panelFabricar .fab-carta[data-fila="carbonear"]')
    pg.wait_for_timeout(800)
    ficha = pg.evaluate("(document.querySelector('#panelFabricar .fab-ficha') || {}).innerText || ''")
    comprobar(f'{nombre}: la ficha pide la yesca y el taladro de fuego, da 4 y dice lo que tarda (4 h)', re.search('yesca', ficha, re.I) and re.search('taladro', ficha, re.I) and '4 h' in ficha and '4' in ficha, ficha[:400])
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.evaluate("(() => { const f = document.querySelector('#panelFabricar .fab-ficha'); const u = f && f.lastElementChild; if (u) u.scrollIntoView({ block: 'end' }); })()")
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_carbonera.png', timeout=180000)
    pg.evaluate(f"{K}.panelFabricar.cerrar()")
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
