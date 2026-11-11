# Prueba en navegador (Chromium sin pantalla) del menú con pestañas (estudio de la interfaz, aprobado por valravnx el 7 nov:
# «un solo menú con pestañas»). En el mundo de verdad (Whitholm), sin servidor, en PC (1280×800) y móvil (390×844):
#   - arriba solo queda «Menú» (Hablar, en línea; el mojón, en PC en tu tierra): nada de Equipo, Ayuda, idioma… a la vista;
#   - Menú (o Tab) abre el tablero en Equipo, con las cinco pestañas y, al pie, Ajustes, Ayuda, Decisiones, el idioma y
#     Salir, y lo de pruebas («+ Materiales», «Reiniciar») porque hay arcón de pruebas; el panel cabe entre las pestañas y
#     el pie, sin taparlos;
#   - una pestaña cambia de panel (solo uno abierto), también con su tecla (H); el mapa, bajo las pestañas;
#   - en Ajustes, los fps; Tu tierra sin mojón lleva a ponerlo (construir, con el mojón elegido); la pestaña Construir
#     cierra el menú y entra a construir; Esc (o la cruz) lo cierra;
#   - en el móvil, las pestañas son botones redondos y el Fabricar del pulgar abre el menú en Fabricar.
# Rota a propósito (9 nov): con el menú siempre escondido, falla.
# Uso: python3 pruebas/prueba_menu_navegador.py <html> <carpeta_capturas>
import sys, os, io, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_menu'
os.makedirs(SALIDA, exist_ok=True)
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v24', 'taller-anim-v1', 'taller-carga-v3']:
    o = os.path.join(RAIZ, f'docs/recursos/personajes/{c}')
    if os.path.isdir(o): shutil.copytree(o, f'{sitio}/recursos/personajes/{c}')
import re
ICONOS = re.search(r"CARPETA_ICONOS = 'recursos/([^/']+)/'", open(os.path.join(RAIZ, 'src/logica/iconos.js')).read()).group(1)
for c in ['interfaz-v1', ICONOS, 'fuentes', 'piezas-v1']:   # (la acción se ve con su imagen y su letra; construir, con las de las piezas)
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



VISIBLE = "(s) => { const e = document.querySelector(s); if (!e) return false; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return c.display !== 'none' && c.visibility !== 'hidden' && r.width > 0 && !e.closest('[hidden]'); }"
CAJA = "(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }"
def vis(pg, s): return pg.evaluate(VISIBLE, s)
def pulsar(pg, s, tactil): (pg.tap if tactil else pg.click)(s)
def cabe(pg, panel):
    p, c, pie = pg.evaluate(CAJA, panel), pg.evaluate(CAJA, '#hubCab'), pg.evaluate(CAJA, '#hubPie')
    return p and c and pie and p['t'] >= c['b'] - 1 and p['b'] <= pie['t'] + 1 and p['l'] >= 0 and p['r'] <= pg.viewport_size['width'], f'panel {p} · pestañas {c} · pie {pie}'

def recorrido(pg, nombre, pref, tactil):
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    entrar(pg)
    arriba = [s for s in ['#btnInventario', '#tabFabricar', '#btnMapa', '#btnAyuda', '#btnRegistro', '#btnAjustes', '#btnRellenar', '#btnReiniciar', '#btnDemoMenu', '#btnDemoFps', 'button.idioma', 'select.idioma'] if vis(pg, s)]
    comprobar(f'{nombre}: arriba solo «Menú» (nada de Equipo, Ayuda, idioma… a la vista)', vis(pg, '#btnMenu') and not arriba, str(arriba))
    comprobar(f'{nombre}: sin mojón no sale el de tu tierra', not vis(pg, '#btnMojon'))
    pg.screenshot(path=f'{SALIDA}/{pref}_0_mundo.png', timeout=180000)
    if tactil: pg.tap('#btnMenu')
    else: pg.keyboard.press('Tab')
    pg.wait_for_timeout(500)
    comprobar(f'{nombre}: «Menú» (Tab en PC) abre el tablero en Equipo', vis(pg, '#hub') and vis(pg, '#panelInventario') and pg.evaluate("document.getElementById('btnInventario').classList.contains('sel')"))
    pest = [s for s in ['#btnInventario', '#tabFabricar', '#tabConstruir', '#btnMapa', '#tabTierra'] if vis(pg, s)]
    comprobar(f'{nombre}: con las cinco pestañas', len(pest) == 5, str(pest))
    pie = pg.evaluate("[...document.querySelectorAll('#menu > *')].filter(e => e.offsetParent !== null).map(e => e.tagName === 'SELECT' ? e.value.toUpperCase() : e.textContent.trim())")
    comprobar(f'{nombre}: al pie, Ajustes, Ayuda, Decisiones, lo de pruebas, Salir y el idioma', all(t in pie for t in ['Ajustes', 'Ayuda', 'Decisiones', '+ Materiales', 'Reiniciar', 'Salir']) and ('ES' in pie or 'es' in pie), str(pie))
    ok, det = cabe(pg, '#panelInventario'); comprobar(f'{nombre}: el equipo cabe entre las pestañas y el pie', ok, det)
    if tactil: comprobar(f'{nombre}: las pestañas son botones redondos', vis(pg, '#btnInventario .o'))
    pg.screenshot(path=f'{SALIDA}/{pref}_1_equipo.png', timeout=180000)
    pulsar(pg, '#tabFabricar', tactil); pg.wait_for_timeout(500)
    comprobar(f'{nombre}: la pestaña Fabricar cambia de panel (solo uno abierto)', vis(pg, '#panelFabricar') and not vis(pg, '#panelInventario') and vis(pg, '#hub'))
    ok, det = cabe(pg, '#panelFabricar'); comprobar(f'{nombre}: fabricar cabe entre las pestañas y el pie', ok, det)
    if not tactil:
        pg.keyboard.press('i'); pg.wait_for_timeout(500)
        comprobar(f'{nombre}: con su tecla (I) también, y se cierra el de antes', vis(pg, '#panelInventario') and not vis(pg, '#panelFabricar') and vis(pg, '#hub'))
    pulsar(pg, '#btnAjustes', tactil); pg.wait_for_timeout(500)
    comprobar(f'{nombre}: en Ajustes, los fps', vis(pg, '#panelAjustes') and vis(pg, '#btnDemoFps') and pg.inner_text('#btnDemoFps').lower().endswith('fps'), pg.inner_text('#btnDemoFps') if vis(pg, '#btnDemoFps') else '')
    pg.screenshot(path=f'{SALIDA}/{pref}_2_ajustes.png', timeout=180000)
    pulsar(pg, '#btnMapa', tactil); pg.wait_for_timeout(1500)
    m, c = pg.evaluate(CAJA, '#mapaRey .mr-botones'), pg.evaluate(CAJA, '#hubCab')
    comprobar(f'{nombre}: el mapa, con sus botones bajo las pestañas', pg.evaluate(f'{K}.mapaRey.abierto') and vis(pg, '#hubCab') and m and m['t'] >= c['b'] - 10, f'{m} {c}')
    pg.screenshot(path=f'{SALIDA}/{pref}_3_mapa.png', timeout=180000)
    pulsar(pg, '#tabTierra', tactil); pg.wait_for_timeout(500)
    comprobar(f'{nombre}: Tu tierra, sin mojón, dice cómo ponerlo', vis(pg, '#panelTierra') and not pg.evaluate(f'{K}.mapaRey.abierto') and 'Poner el mojón' in pg.inner_text('#panelTierra'))
    pg.screenshot(path=f'{SALIDA}/{pref}_4_tierra.png', timeout=180000)
    pulsar(pg, '#tierraPoner', tactil); pg.wait_for_timeout(600)
    comprobar(f'{nombre}: «Poner el mojón» cierra el menú y entra a construir con el mojón', not vis(pg, '#hub') and pg.evaluate(f'{K}.estado.modo') == 'construir' and pg.evaluate(f'{K}.estado.sel.clase') == 'mojon')
    pg.evaluate(f"{K}.cambiarModo('mover')"); pg.wait_for_timeout(300)
    pulsar(pg, '#btnMenu', tactil); pg.wait_for_timeout(400)
    pulsar(pg, '#tabConstruir', tactil); pg.wait_for_timeout(500)
    comprobar(f'{nombre}: la pestaña Construir cierra el menú y entra a construir', not vis(pg, '#hub') and pg.evaluate(f'{K}.estado.modo') == 'construir')
    pg.evaluate(f"{K}.cambiarModo('mover')"); pg.wait_for_timeout(300)
    if tactil:
        pg.tap('#btnFabricar'); pg.wait_for_timeout(500)
        comprobar(f'{nombre}: el Fabricar del pulgar abre el menú en Fabricar', vis(pg, '#hub') and vis(pg, '#panelFabricar') and pg.evaluate("document.getElementById('tabFabricar').classList.contains('sel')"))
        pg.tap('#hubCerrar')
    else:
        pg.keyboard.press('Tab'); pg.wait_for_timeout(400); pg.keyboard.press('Escape')
    pg.wait_for_timeout(400)
    comprobar(f'{nombre}: ' + ('la cruz' if tactil else 'Esc') + ' cierra el menú, y vuelve lo de arriba', not vis(pg, '#hub') and vis(pg, '#btnMenu') and pg.evaluate(f'{K}.estado.modo') == 'mover')
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
