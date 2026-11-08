# Prueba en navegador (Chromium sin pantalla) de la acción a la vista (estudio de la interfaz, valravnx, 7 nov: «quiero que se
# vea como un VIDEOJUEGO ACABADO»). En el mundo de verdad (Whitholm), sin servidor, en PC (1280×800) y móvil (390×844):
#   - fuera los botones de la derecha: en PC, ni Usar (es la F) ni Mover ni Desmontar fuera de construir; Construir, sí;
#     en el móvil, el botón de acción grande;
#   - junto a un matorral, con el hacha, la etiqueta «Desbrozar» sobre él (con la F en PC) y un aro en el suelo bajo él;
#     en el móvil, el botón de acción dice el verbo;
#   - con unas ramas en el suelo al lado, lo primero es cogerlas, y la lista enseña también desbrozar; tocar esa fila lo hace;
#   - construyendo, ni etiqueta ni aro, y se ven Terminar y Desmontar; sin errores en la página.
# Uso: python3 pruebas/prueba_accion_navegador.py <html> <carpeta_capturas>
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_accion'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
for c in ['interfaz-v1', 'iconos-v11', 'fuentes']:   # (la acción se ve con su imagen y su letra)
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/{c}'), f'{sitio}/recursos/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/jugar/demo/prueba.html?modo=construir&sinservidor=1&salida=0&lang=es'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
K = 'window.__kinhold'
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)

def entrar(pg):
    pg.goto(BASE)
    pg.wait_for_function(f'{K} && {K}.mundoListo', timeout=300000)
    try: pg.wait_for_function(f'{K}.recoleccion.listo', timeout=180000)
    except Exception: pass
    pg.wait_for_timeout(1000)

# un matorral en pie con ningún árbol a menos de 3,5 m (así Usar no tala) ni nada que se recoja al lado
MATA = f"""(() => {{ const k = {K}, d = k.decorado; const l = d.matasCerca(k.pj.x, k.pj.z, 60).filter(m => !d.obstaculos.some(o => o.arbol && Math.hypot(o.x - m.x, o.z - m.z) < 3.5) && !k.recoleccion.puntos.some(p => Math.hypot(p.x - m.x, p.z - m.z) < 2.5));
  return l[0] ? {{ id: l[0].id, x: l[0].x, z: l[0].z }} : null; }})()"""
def buscar_mata(pg):
    for dx, dz in [(0, 0), (60, 0), (0, 60), (-60, 0), (0, -60), (120, 0), (0, 120), (-120, 0), (0, -120)]:
        if (dx, dz) != (0, 0):
            pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x; k.pj.z = z; k.pj.y = k.alturaSuelo(x, z); }}', [dx, dz])
            pg.wait_for_timeout(2500)
            try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
            except Exception: pass
            pg.wait_for_timeout(1500)
        m = pg.evaluate(MATA)
        if m: return m
    return None

def ir(pg, p, dist=3.6, pitch=0.45):
    pg.evaluate(f'([x, z]) => {{ const k = {K}; k.pj.x = x + 0.9; k.pj.z = z + 0.7; k.pj.y = k.alturaSuelo(k.pj.x, k.pj.z); k.cam.dist = {dist}; k.cam.pitch = {pitch}; k.cam.yaw = Math.atan2(0.9, 0.7) + 0.5; }}', [p['x'], p['z']])
    pg.wait_for_timeout(1500)
    try: pg.wait_for_function(f'{K}.decorado.pendientes === 0', timeout=120000)
    except Exception: pass
    pg.wait_for_timeout(2500)

# si hay un ejemplar de la malla de los matorrales puesto en (x, z)
EN_MALLA = f"""([x, z]) => {{ const k = {K}; const im = k.decorado.raiz.children.find(c => c.name === 'matorrales'); if (!im) return false;
  const m = new k.camara.matrixWorld.constructor(), v = new k.camara.position.constructor();
  for (let i = 0; i < im.count; i++) {{ im.getMatrixAt(i, m); if (Math.abs(m.determinant()) < 1e-9) continue; v.setFromMatrixPosition(m); if (Math.hypot(v.x - x, v.z - z) < 0.05) return true; }}
  return false; }}"""
ESTORBA = f"([x, z]) => {K}.decorado.obstaculos.some(o => o.mata && !o.oculto && Math.hypot(o.x - x, o.z - z) < 0.05)"
EN_SUELO = f"([x, z, t]) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t && Math.hypot(o.x - x, o.z - z) < 1).reduce((n, o) => n + o.cosa.n, 0)"


ACC = f'{K}.accionVista'
def esperar_accion(pg, patron):
    try: pg.wait_for_function(f"{ACC} && /{patron}/.test({ACC}.texto)", timeout=20000)
    except Exception: pass
    return pg.evaluate(ACC)
ETQ = """(() => { const e = document.getElementById('accionEtq'); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { txt: e.innerText, x: r.left + r.width / 2, y: r.bottom, ancho: r.width, izq: r.left, der: r.right, k: !!e.querySelector('.k'), apagada: e.classList.contains('apagada') }; })()"""
ARO = f"(() => {{ const a = {K}.aroAccion; return {{ v: a.visible, x: a.position.x, y: a.position.y, z: a.position.z }}; }})()"
VISIBLE = "(s) => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && !e.hidden; }"

def recorrido(pg, nombre, pref, tactil):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    # fuera los botones de la derecha: en PC no se ven Usar ni Mover ni Desmontar (con F y el clic derecho); Construir, sí
    if tactil:
        comprobar(f'{nombre}: el botón de acción grande se ve', pg.evaluate(VISIBLE, '#btnUsar'))
    else:
        comprobar(f'{nombre}: no hay botón Usar a la derecha (es la F)', not pg.evaluate(VISIBLE, '#btnUsar'))
    comprobar(f'{nombre}: ni Mover ni Desmontar fuera de construir', not pg.evaluate(VISIBLE, '#modos button[data-modo=mover]') and not pg.evaluate(VISIBLE, '#modos button[data-modo=desmontar]'))
    comprobar(f'{nombre}: Construir sí se ve', pg.evaluate(VISIBLE, '#modos button[data-modo=construir]'))
    m = buscar_mata(pg)
    comprobar(f'{nombre}: hay un matorral suelto cerca', bool(m))
    if not m: return
    ir(pg, m)
    # con el hacha de piedra en la mano, la acción es desbrozarlo: la etiqueta sobre él y el aro bajo él
    if not pg.evaluate(f"{K}.inventario.cuantos('hacha_piedra')"): pg.evaluate(f"{K}.inventario.coger('hacha_piedra', 1, 'mano:der')")
    a = esperar_accion(pg, 'Desbrozar')
    comprobar(f'{nombre}: con el hacha al lado de un matorral, la acción es desbrozarlo', bool(a) and 'Desbrozar' in a['texto'] and abs(a['x'] - m['x']) < 0.01, str(a))
    pg.wait_for_timeout(500)
    e, aro = pg.evaluate(ETQ), pg.evaluate(ARO)
    comprobar(f'{nombre}: la etiqueta lo dice', bool(e) and 'Desbrozar' in e['txt'], str(e))
    comprobar(f'{nombre}: el aro está en el suelo bajo el matorral', aro['v'] and abs(aro['x'] - m['x']) < 0.01 and abs(aro['z'] - m['z']) < 0.01, str(aro))
    if e:
        sc = pg.evaluate(f"([x, y, z]) => {K}.proyectar(x, y, z)", [m['x'], aro['y'], m['z']])
        comprobar(f'{nombre}: la etiqueta está sobre la cosa (encima del aro en la pantalla)', abs(e['x'] - sc['x']) < 90 and e['y'] < sc['y'], f"etiqueta {e['x']:.0f},{e['y']:.0f} · aro {sc['x']:.0f},{sc['y']:.0f}")
        comprobar(f'{nombre}: dentro de la pantalla', e['izq'] >= 0 and e['der'] <= pg.viewport_size['width'], str(e))
        comprobar(f'{nombre}: ' + ('sin la tecla en el móvil' if tactil else 'con la tecla F en PC'), e['k'] != tactil)
    if tactil:
        v = pg.evaluate("document.querySelector('#btnUsar .verbo').textContent")
        comprobar(f'{nombre}: el botón de acción dice el verbo', v == 'Desbrozar', v)
    pg.screenshot(path=f'{SALIDA}/{pref}_1_desbrozar.png', timeout=180000)
    # con varias cosas al lado (unas ramas en el suelo y el matorral), la lista: lo de Usar, marcado, y lo demás
    pg.evaluate(f"{K}.inventario.coger('rama', 2, 'mano:izq')"); pg.evaluate(f"{K}.soltarAlSuelo('mano:izq')")
    a = esperar_accion(pg, 'Coger del suelo')
    pg.wait_for_timeout(600)
    filas = pg.evaluate("[...document.querySelectorAll('#accionLista button')].map(b => ({ t: b.innerText, sel: b.classList.contains('sel') }))")
    comprobar(f'{nombre}: con unas ramas en el suelo, lo primero es cogerlas', bool(a) and 'Coger del suelo' in a['texto'], str(a))
    comprobar(f'{nombre}: y la lista enseña también desbrozar', pg.evaluate(VISIBLE, '#accionLista') and len(filas) >= 2 and filas[0]['sel'] and any('Desbrozar' in f['t'] for f in filas[1:]), str(filas))
    pg.screenshot(path=f'{SALIDA}/{pref}_2_lista.png', timeout=180000)
    # un toque (o clic) en la fila de desbrozar lo hace
    pg.evaluate("[...document.querySelectorAll('#accionLista button')].find(b => /Desbrozar/.test(b.innerText)).click()")
    pg.wait_for_timeout(700)
    comprobar(f'{nombre}: tocar una fila la hace (se pone a desbrozar)', pg.evaluate(f'!!({K}.estado.talando && {K}.estado.talando.desbroce)'))
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{SALIDA}/{pref}_3_desbrozando.png', timeout=180000)
    try: pg.wait_for_function(f'!({K}.estado.talando && {K}.estado.talando.desbroce)', timeout=150000)
    except Exception: pass
    # en construir no hay etiqueta ni aro
    pg.evaluate(f"{K}.cambiarModo('construir')"); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: construyendo, sin etiqueta ni aro', not pg.evaluate(ETQ) and not pg.evaluate(ARO)['v'])
    comprobar(f'{nombre}: y se ven Terminar y Desmontar', pg.evaluate(VISIBLE, '#modos button[data-modo=mover]') and pg.evaluate(VISIBLE, '#modos button[data-modo=desmontar]'))
    pg.screenshot(path=f'{SALIDA}/{pref}_4_construir.png', timeout=180000)
    pg.evaluate(f"{K}.cambiarModo('mover')")
    comprobar(f'{nombre}: sin errores en la página', not errores, '; '.join(errores[:3]))

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    pg = nav.new_page(viewport={'width': 1280, 'height': 800})
    print('PC'); recorrido(pg, 'PC', 'pc', False); pg.close()
    pg = nav.new_page(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=1)
    print('Móvil'); recorrido(pg, 'móvil', 'movil', True); pg.close()
    nav.close()
srv.shutdown()
print('\n' + ('TODO BIEN' if not fallos else f'{len(fallos)} FALLOS: ' + '; '.join(fallos)))
sys.exit(1 if fallos else 0)
