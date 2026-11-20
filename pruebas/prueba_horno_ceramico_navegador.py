# Prueba en navegador (Chromium sin pantalla) de la arcilla y el horno cerámico (P10, 19 nov). En el mundo de verdad
# (Whitholm), sin servidor, junto al banco de arcilla del río del norte (a unos 800 m de la salida), primero en PC
# (1280×800) y luego en móvil (390×844), una cosa cada vez:
#   - el banco de arcilla se ve en la ribera; sin la pala, Usar dice que hace falta la pala de madera; con ella, Usar
#     dice «Cavar: Banco de arcilla» y da una cesta de arcilla, y el banco sigue ahí (inagotable);
#   - dos hornos cerámicos a la vista: uno apagado con la leña puesta en la boca y otro encendido (fuego en la boca y
#     humo por el respiradero);
#   - su pestaña «Horno cerámico» en el panel de fabricar, con su fuego, que solo come leña; sin salirse de lado en el
#     móvil;
#   - sin errores en la página.
# Capturas de cerca del banco de arcilla y de los dos hornos (por delante, de lado y por detrás) y del panel.
# Uso: python3 pruebas/prueba_horno_ceramico_navegador.py <html> <carpeta_capturas>
# Rota a propósito (19 nov): MUTAR=1 deja apagado el horno encendido: falla. (20 nov) MUTAR=choque quita el choque del
# horno: falla «no se atraviesa».
import sys, os
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_horno_ceramico'
MUTAR = os.environ.get('MUTAR')
os.makedirs(SALIDA, exist_ok=True)
sitio = montar_sitio({'demo': RUTA})
srv = servir(sitio)
BANCO = (184617.04, 45474.37)   # (el banco de arcilla del río del norte: pruebas/prueba_horno_ceramico.mjs; el río, al oeste)
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida={round(BANCO[0]) + 3},{round(BANCO[1])}&lang=es'
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

ID_BANCO = 'arcilla:1846170,454744'   # (su nombre, por su sitio en el mundo; en la página, las x y z van desde la salida)
EL_BANCO = f"(() => {{ const p = {K}.recoleccion.puntos.find(p => p.id === '{ID_BANCO}'); return p ? {{ id: p.id, x: p.x, z: p.z }} : null; }})()"
SE_VE = f"""([x, z]) => {{ const k = {K}; const g = k.recoleccion.grupo; let n = 0;
  const m = new k.camara.matrixWorld.constructor(), v = new k.camara.position.constructor();
  for (const im of g.children.filter(c => c.name === 'recoger_arcilla')) for (let i = 0; i < im.count; i++) {{ im.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-12) continue; v.setFromMatrixPosition(m); if (Math.hypot(v.x - x, v.z - z) < 0.5) n++; }}
  return n; }}"""
# Los dos hornos, al este del banco (lejos del agua); el encendido, con 1 h de fuego por delante (según la hora de la página).
PONER = f"""(([bx, bz, mutar]) => {{ const k = {K}, f = k.fabCliente, x0 = bx + 5.5, z0 = bz, ahora = Date.now();
  k.__vistas = {{
    'horno_ceramico:apagado':   {{ id: 'horno_ceramico:apagado', tipo: 'horno_ceramico', x: x0 - 1.8, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, fuego: {{ hasta: 0, combustible: 1800, cenizas: false }} }},
    'horno_ceramico:encendido': {{ id: 'horno_ceramico:encendido', tipo: 'horno_ceramico', x: x0 + 1.8, z: z0, giro: 0, autor: 'vista', cola: [], deposito: {{}}, fuego: mutar === true ? {{ hasta: 0, combustible: 0, cenizas: false }} : {{ hasta: ahora + 3600000, combustible: 0, cenizas: false }} }},
  }};
  Object.assign(f.estaciones, k.__vistas); k.estacionesV.refrescar();
  return {{ x: x0, z: z0 }}; }})"""
FUEGO = f"((id) => {{ const o = {K}.escena.children.flatMap(c => c.name === 'estaciones' ? c.children : []).find(o => o.userData.id === id); const f = o && o.getObjectByName('fuego'); const r = o && o.getObjectByName('ramas'); const b = o && o.getObjectByName('rescoldo'); return {{ hay: !!o, llama: !!f && f.children.some(m => m.name === 'llama'), humo: !!f && f.children.some(m => m.name === 'humo'), lena: !!r && r.visible, rojo: !!b && b.visible }}; }})"

def mirar(pg, c, dx, dz, yaw, dist, pitch, lado=1.2):
    # el jugador, a un lado de lo que se mira (lado m a la derecha según la cámara) y mirándolo: no lo tapa
    pg.evaluate(f"([x, z, yaw, d, p]) => {{ const k = {K}, px = x + Math.cos(yaw) * {lado}, pz = z - Math.sin(yaw) * {lado}; k.pj.x = px; k.pj.z = pz; k.pj.y = k.alturaSuelo(px, pz); k.pj.rot = Math.atan2(x - px, z - pz); k.cam.yaw = yaw; k.cam.dist = d; k.cam.pitch = p; }}", [c['x'] + dx, c['z'] + dz, yaw, dist, pitch])
    pg.wait_for_timeout(2500)

def tener(pg, tipo):
    return pg.evaluate(f"(() => {{ const i = {K}.inventario; i.sacar('mano:der'); const r = i.coger('{tipo}', 1, 'mano:der'); {K}.pintarTodoInventario(); return r; }})()")

def recorrido(nav, nombre, pref, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    pg = ctx.new_page(); errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=180000)
    except Exception: pass
    esperar(pg, 3000)
    try: pg.wait_for_function(f"{K}.recoleccion.puntos.some(p => p.id === '{ID_BANCO}')", timeout=120000)
    except Exception: pass
    b = pg.evaluate(EL_BANCO)
    comprobar(f'{nombre}: el banco de arcilla del río del norte está en su sitio', b is not None, str(b))
    if b is None: ctx.close(); return
    comprobar(f'{nombre}: y se ve', pg.evaluate(SE_VE, [b['x'], b['z']]) >= 1)
    # cavarla: sin la pala, no; con la pala de madera, una cesta, y el banco sigue
    pg.evaluate(f"(([x, z]) => {{ const k = {K}, i = k.inventario; i.sacar('mano:der'); i.sacar('mano:izq'); k.pj.x = x + 0.9; k.pj.z = z + 0.2; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.pj.rot = -Math.PI / 2; k.pintarTodoInventario(); }})", [b['x'], b['z']])
    pg.wait_for_timeout(800)
    v = pg.evaluate(f'{K}.accionVista')
    comprobar(f'{nombre}: junto al banco, Usar dice «Cavar: Banco de arcilla»', v is not None and v['texto'] == 'Cavar: Banco de arcilla', str(v))
    antes = pg.evaluate(f"{K}.inventario.cuantos('arcilla')")
    pg.evaluate(f'{K}.usar()'); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: sin la pala de madera, no cava', pg.evaluate(f"{K}.inventario.cuantos('arcilla')") == antes)
    tener(pg, 'pala_madera'); pg.wait_for_timeout(400)
    pg.evaluate(f'{K}.usar()'); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: con la pala de madera, una cesta de arcilla', pg.evaluate(f"{K}.inventario.cuantos('arcilla')") == antes + 1)
    comprobar(f'{nombre}: y el banco sigue ahí (inagotable)', pg.evaluate(SE_VE, [b['x'], b['z']]) >= 1 and pg.evaluate(f"{K}.recoleccion.puntos.some(p => p.id === '{b['id']}')"))
    pg.evaluate(f"(() => {{ const i = {K}.inventario; i.sacar('mano:der'); i.sacar('mano:izq'); {K}.pintarTodoInventario(); }})()")
    c = pg.evaluate(f"{PONER}", [b['x'], b['z'], MUTAR == '1'])
    esperar(pg, 2000)
    a, e = (pg.evaluate(FUEGO, i) for i in ['horno_ceramico:apagado', 'horno_ceramico:encendido'])
    comprobar(f'{nombre}: el horno apagado, sin llama, con la leña puesta en la boca', a['hay'] and not a['llama'] and a['lena'] and not a['rojo'], str(a))
    comprobar(f'{nombre}: el encendido, con fuego en la boca, al rojo por dentro y humo', e['hay'] and e['llama'] and e['humo'] and e['rojo'], str(e))
    # (20 nov) el horno no se atraviesa: quien anda hacia su centro se queda fuera de la cúpula y del anillo de piedras
    if True:
        dist = pg.evaluate(f"(() => {{ window.__sinChoqueHorno = {'true' if MUTAR == 'choque' else 'false'}; const k = {K}, e = k.fabCliente.estaciones['horno_ceramico:apagado']; const r = k.resolverColision(e.x + 0.1, e.z + 0.3, 0); return Math.hypot(r.x - e.x, r.z - e.z); }})()")
        comprobar(f'{nombre}: el horno no se atraviesa (el jugador se queda fuera del anillo de piedras)', dist >= 0.95, f'{dist:.2f} m del centro')
    pg.add_style_tag(content='body > :not(canvas) { visibility: hidden !important; }')
    D = 1.25 if movil else 1   # (en el móvil, estrecho, algo más lejos para que quepan, y el jugador más cerca de lo mirado)
    LADO = 0.55 if movil else 1.2
    mirar(pg, b, 0, 0, 0.4, 3.2 * D, 0.65, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_banco_arcilla.png', timeout=180000)
    mirar(pg, c, 0, 1.6, 0, 7.5 * D, 0.3)
    pg.screenshot(path=f'{SALIDA}/{pref}_hornos.png', timeout=180000)
    mirar(pg, c, 1.8, 0.4, 0.35, 3.6 * D, 0.22, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_fuego.png', timeout=180000)
    mirar(pg, c, -1.8, 0.7, 0.3, 2.6 * D, 0.32, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_boca_apagado.png', timeout=180000)
    mirar(pg, c, 1.8, 0.7, 0.3, 2.6 * D, 0.32, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_boca_fuego.png', timeout=180000)
    mirar(pg, c, -1.8, 0.4, -0.3, 3.4 * D, 0.3, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_apagado.png', timeout=180000)
    mirar(pg, c, 1.8, -0.3, 3.0, 3.6 * D, 0.35, LADO)
    pg.screenshot(path=f'{SALIDA}/{pref}_horno_detras.png', timeout=180000)
    # el panel: su pestaña y su fuego (solo leña)
    pg.add_style_tag(content='body > :not(canvas) { visibility: visible !important; }')
    pg.evaluate(f"(() => {{ const k = {K}, inv = k.inventario; if (inv) {{ inv.meterDonde('lena', 2); inv.meterDonde('rama', 2); }} const e = k.fabCliente.estaciones['horno_ceramico:apagado']; k.pj.x = e.x + 0.3; k.pj.z = e.z + 1.5; }})()")
    pg.evaluate(f"{K}.panelFabricar.abrirEstacion('horno_ceramico:apagado')"); pg.wait_for_timeout(1200)
    texto = pg.evaluate("document.getElementById('panelFabricar').innerText")
    comprobar(f'{nombre}: su pestaña «Horno cerámico», con su fuego apagado y la leña puesta', pg.evaluate("!!document.querySelector('#panelFabricar .fab-pest.fab-sel[data-pestana=\"cocer\"]')") and 'Horno cerámico' in texto and 'Tiene puesto para arder 30 min' in texto, texto[:400])
    echar = pg.evaluate("[...document.querySelectorAll('#panelFabricar .fab-echar')].map(b => b.dataset.objeto)")
    comprobar(f'{nombre}: a su fuego solo se le echa leña', echar == ['lena'], str(echar))
    comprobar(f'{nombre}: el panel no se sale de lado', pg.evaluate("document.getElementById('panelFabricar').scrollWidth <= document.getElementById('panelFabricar').clientWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1"))
    pg.wait_for_function("[...document.querySelectorAll('#panelFabricar img')].every(i => i.complete && i.naturalWidth > 0)", timeout=60000)
    pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/{pref}_panel_horno.png', timeout=180000)
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
