# Prueba en navegador del combate dentro del mundo (valravnx, 30 oct), en el prototipo de construcción:
#  - la cámara se inclina hasta casi a ras de suelo;
#  - con el arma sacada (C), el ratón elige la dirección: la del último movimiento al pulsar, entre cuatro (arriba,
#    izquierda, derecha y abajo, que es clavar; sin movimiento, la última usada; valravnx, 31 oct); mantener carga el
#    golpe, que va comprometido (moverse no lo cambia); el botón derecho lo cancela (finta) y para, también con el
#    ratón de verdad (los dos botones a la vez); después se puede empezar otro golpe por otro lado; el botón derecho
#    para por el lado del ratón y se cambia sin soltar;
#  - un rival de práctica viene, pelea y sus golpes pasan por las acciones con autor; Tab lo fija y la cámara se
#    pone detrás de ti mirándole;
#  - en el móvil, la rosa (cuatro sectores) queda fija a un lado con «Parar», «Fijar» y «Rival», tocarla carga el
#    golpe, deslizar el dedo no lo cambia y «Parar» lo cancela (finta).
# Uso: python3 pruebas/prueba_combate_mundo_navegador.py <html de la construcción> <carpeta de capturas>
#      MUTAR=1: el ratón no cambia de lado sin soltar, la cámara no baja y el botón de parar no finta: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes'), f'{sitio}/recursos/personajes')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def handle(self):
        try: super().handle()
        except Exception: pass
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
C = K + '.combate'
def listo(pg):
    pg.wait_for_function(f'{K} && {K}.jugador && {K}.jugador.mh', timeout=180000)
    if MUTAR:
        pg.evaluate("window.__kinhold.combate.raton.mover = (dx, dy) => {}")
def estado(pg):
    return pg.evaluate(f"(() => {{ const L = {C}.L; return L ? {{ accion: L.accion, linea: L.linea, finta: L.finta, carga: L.carga(), bloq: L.bloqueando, lb: L.lineaBloqueo }} : null; }})()")
def mover(pg, dx, dy, pasos=5):
    # en un solo paso de la página: sin tarjeta gráfica cada llamada puede tardar más que la ventana del ratón
    pg.evaluate(f'(() => {{ for (let i = 0; i < {pasos}; i++) {C}.raton.mover({dx / pasos}, {dy / pasos}); }})()')
def golpe(pg, dx, dy, boton=0):
    # moverse y pulsar seguidos, como al jugar
    pg.evaluate(f'(() => {{ for (let i = 0; i < 5; i++) {C}.raton.mover({dx / 5}, {dy / 5}); {C}.raton.pulsar({boton}); }})()')
def libre(pg):
    # sin tarjeta gráfica el juego va a cámara lenta (cada fotograma avanza como mucho 0,05 s): se espera al estado
    pg.wait_for_function(f'{C}.L && {C}.L.accion === "libre" && !{C}.L.bloqueando', timeout=120000)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    errores = []
    # ---------- PC ----------
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.goto(URL); listo(pg)
    pg.keyboard.press('c'); pg.wait_for_timeout(300)
    act = pg.evaluate(f'({{ a: {C}.activo, m: !!{C}.L, mira: !document.getElementById("cmbMira").hidden, arma: document.getElementById("btnArma").classList.contains("sel"), pj: {K}.jugador.raiz.visible }})')
    comprobar('C saca el arma: el luchador sale, con la mira, y el personaje de andar se esconde', act['a'] and act['m'] and act['mira'] and act['arma'] and not act['pj'], str(act))
    if MUTAR: pg.evaluate(f'{C}.L.fintar = () => false')
    n_mira = pg.evaluate("document.querySelectorAll('#cmbMira b').length")
    comprobar('la mira tiene cuatro direcciones', n_mira == 4, str(n_mira))
    # cámara: con el ratón cogido, moverlo hacia arriba la baja hasta casi a ras de suelo
    for _ in range(12): mover(pg, 0, -60, 2)
    pitch = pg.evaluate(f'{K}.cam.pitch')
    comprobar('la cámara se inclina hasta casi a ras de suelo', pitch < 0.15, f'{pitch:.2f} rad')
    pg.evaluate(f'{K}.cam.pitch = 0.35'); pg.wait_for_timeout(600)
    pg.screenshot(path=f'{SALIDA}/pc_camara_baja.png')
    # golpes: dirección del último movimiento al pulsar
    for dx, dy, quiero in [(-45, 0, 'izquierda'), (0, -45, 'alto'), (45, 0, 'derecha'), (0, 45, 'estocada')]:
        libre(pg); golpe(pg, dx, dy); e = estado(pg)
        comprobar(f'ratón hacia {quiero} y clic: carga el golpe {quiero}', e['accion'] == 'preparando' and e['linea'] == quiero, str(e))
        pg.evaluate(f'{C}.raton.soltar(0)')
    libre(pg); pg.wait_for_timeout(400); pg.evaluate(f'{C}.raton.pulsar(0)'); e = estado(pg)
    comprobar('sin mover el ratón: la última dirección usada (abajo, clavar)', e['linea'] == 'estocada', str(e))
    pg.evaluate(f'{C}.raton.soltar(0)')
    # mantener carga; el golpe va comprometido: moverse no lo cambia
    libre(pg); golpe(pg, 0, -45)
    pg.wait_for_function(f'{C}.L.carga() > 0.6', timeout=120000)
    e1 = estado(pg)
    pg.screenshot(path=f'{SALIDA}/pc_cargando_alto.png')
    mover(pg, 60, 0); e2 = estado(pg)
    comprobar('mantener el clic carga el golpe', e1['accion'] == 'preparando' and e1['carga'] > 0.5, str(e1))
    comprobar('a mitad del clic, mover el ratón no cambia el golpe (va comprometido)', e2['accion'] == 'preparando' and e2['linea'] == 'alto' and not e2['finta'], str(e2))
    # el botón derecho lo cancela (finta) y para
    pg.evaluate(f'{C}.raton.pulsar(2)'); e = estado(pg)
    comprobar('con el golpe cargado, el botón derecho lo cancela (finta) y para', e['accion'] == 'libre' and e['finta'] and e['bloq'], str(e))
    pg.wait_for_timeout(300); pg.screenshot(path=f'{SALIDA}/pc_finta.png')
    pg.evaluate(f'{C}.raton.soltar(2)'); pg.evaluate(f'{C}.raton.soltar(0)')
    # y después, otro golpe por otro lado
    libre(pg); golpe(pg, 45, 0); e = estado(pg)
    comprobar('tras la finta se empieza otro golpe por otro lado', e['accion'] == 'preparando' and e['linea'] == 'derecha', str(e))
    pg.evaluate(f'{C}.raton.soltar(0)')
    try: pg.wait_for_function(f'{C}.L.accion !== "preparando"', timeout=60000)
    except Exception: pass
    # con el ratón de verdad: el izquierdo pulsado y el derecho a la vez (el navegador no da un «pulsar» para el
    # segundo botón, sino un movimiento con los dos botones)
    libre(pg)
    pg.mouse.move(640, 400); pg.mouse.down(); pg.mouse.up()          # el primer clic solo coge el ratón
    libre(pg)
    pg.mouse.down()
    try: pg.wait_for_function(f'{C}.L.carga() > 0.2', timeout=60000)
    except Exception: pass
    e1 = estado(pg)
    pg.mouse.down(button='right'); e2 = estado(pg)
    pg.mouse.up(button='right'); pg.mouse.up(); e3 = estado(pg)
    comprobar('ratón de verdad: el botón izquierdo carga el golpe', e1['accion'] == 'preparando', str(e1))
    comprobar('ratón de verdad: el derecho a la vez lo cancela (finta) y para', e2['accion'] == 'libre' and e2['finta'] and e2['bloq'], str(e2))
    comprobar('ratón de verdad: al soltar los dos, ni golpe ni parada', e3['accion'] == 'libre' and not e3['bloq'], str(e3))
    # al soltar sale
    libre(pg); golpe(pg, 0, -45)
    pg.evaluate(f'{C}.raton.soltar(0)')
    try: pg.wait_for_function(f'{C}.L.accion !== "preparando"', timeout=60000)
    except Exception: pass
    e3 = estado(pg)
    comprobar('al soltar, el golpe sale', e3['accion'] in ('lanzando', 'golpeando', 'recuperando'), str(e3))
    # parar con el botón derecho, cambiando de lado sin soltar
    libre(pg); golpe(pg, -45, 0, 2); e = estado(pg)
    comprobar('botón derecho: para por el lado del ratón', e['bloq'] and e['lb'] == 'izquierda', str(e))
    pg.wait_for_timeout(300); pg.screenshot(path=f'{SALIDA}/pc_parando_izquierda.png')
    mover(pg, 0, -60); e = estado(pg)
    comprobar('sin soltar, el ratón hacia arriba pasa a parar arriba', e['bloq'] and e['lb'] == 'alto', str(e))
    pg.evaluate(f'{C}.raton.soltar(2)'); e = estado(pg)
    comprobar('soltar el botón derecho deja de parar', not e['bloq'], str(e))
    # rival de práctica: viene, pelea y sus golpes pasan por las acciones con autor
    pg.click('#cmbRival'); pg.wait_for_timeout(200)
    n = pg.evaluate(f'{C}.rivales.length')
    comprobar('el botón «Rival» trae un rival de práctica', n == 1, str(n))
    pg.wait_for_function(f'{C}.rivales[0].m.userData.taller && {C}.rivales[0].m.userData.taller.estado === "listo"', timeout=120000)
    pg.keyboard.press('Tab'); pg.wait_for_timeout(200)
    fij = pg.evaluate(f'!!{C}.fijado')
    comprobar('Tab fija al rival', fij)
    golpes = 0
    for _ in range(40):
        pg.wait_for_timeout(500)
        golpes = pg.evaluate(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'golpe' && e.autor === 'rival1').length")
        if golpes: break
    comprobar('el rival te ataca y sus golpes pasan por las acciones con autor', golpes > 0, f'{golpes} golpes')
    cam = pg.evaluate(f"(() => {{ const k = {K}, r = k.combate.rivales[0].L, a = Math.atan2(k.pj.x - r.x, k.pj.z - r.z); let d = k.cam.yaw - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return {{ d: Math.abs(d), dist: Math.hypot(k.pj.x - r.x, k.pj.z - r.z) }}; }})()")
    comprobar('con el rival fijado, la cámara va detrás de ti mirándole', cam['d'] < 0.9, f"{cam['d']:.2f} rad")
    pg.screenshot(path=f'{SALIDA}/pc_rival_fijado.png')
    # atacar al rival fijado: el golpe del jugador también va con autor
    for _ in range(6):
        try: pg.wait_for_function(f'{C}.L.accion === "libre"', timeout=60000)
        except Exception: pass
        pg.evaluate(f'{C}.raton.pulsar(0)'); pg.evaluate(f'{C}.raton.soltar(0)')
        pg.wait_for_function(f'{C}.L.accion !== "preparando"', timeout=60000)
    pg.wait_for_function(f"{K}.registroAcciones.entradas.some(e => e.tipo === 'golpe' && e.autor === 'jugador')", timeout=60000)
    mios = pg.evaluate(f"{K}.registroAcciones.entradas.filter(e => e.tipo === 'golpe' && e.autor === 'jugador').length")
    comprobar('tus golpes al rival pasan por las acciones con autor', mios > 0, f'{mios} golpes')
    pg.keyboard.press('c'); pg.wait_for_timeout(200)
    g = pg.evaluate(f'({{ a: {C}.activo, pj: {K}.jugador.raiz.visible }})')
    comprobar('C guarda el arma y vuelve el personaje de andar', not g['a'] and g['pj'], str(g))
    pg.keyboard.press('b'); pg.wait_for_timeout(200)
    b = pg.evaluate("document.getElementById('btnArma').hidden")
    comprobar('en «Construir» no sale el botón del arma', b)
    comprobar('sin errores en consola (PC)', not errores, str(errores[:3]))

    # ---------- Móvil ----------
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    mv = ctx.new_page(); err2 = []
    mv.on('pageerror', lambda e: err2.append(str(e)))
    mv.goto(URL); listo(mv)
    mv.tap('#btnArma'); mv.wait_for_timeout(400)
    vis = mv.evaluate("['cmbRosa', 'cmbParar', 'cmbFijar', 'cmbRival'].map(id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return [id, !e.closest('[hidden]') && b.width > 0, Math.round(b.right), Math.round(b.bottom)]; })")
    comprobar('móvil: la rosa fija y los botones Parar, Fijar y Rival salen y caben', all(v[1] and v[2] <= 390 and v[3] <= 844 for v in vis), str(vis))
    solapes = mv.evaluate("""(() => {
      const caja = id => document.getElementById(id).getBoundingClientRect();
      const choca = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      const malos = [];
      for (const a of ['cmbParar', 'cmbFijar', 'cmbRival', 'cmbEstado', 'joystick']) for (const b of ['cmbRosa', 'joystick', 'cmbEstado'])
        if (a !== b && !document.getElementById(a).hidden && !document.getElementById(b).hidden && choca(caja(a), caja(b))) malos.push(a + '/' + b);
      return [...new Set(malos)];
    })()""")
    comprobar('móvil: los botones no tapan la rosa, y el aliento no tapa el joystick', not solapes, str(solapes))
    mira = mv.evaluate("document.getElementById('cmbMira').hidden")
    comprobar('móvil: sin la mira del ratón', mira)
    caja = mv.evaluate("(() => { const b = document.getElementById('cmbRosa').getBoundingClientRect(); return [b.left, b.top, b.width]; })()")
    x0, y0, w = caja
    n_rosa = mv.evaluate("document.querySelectorAll('#cmbRosa b').length")
    comprobar('móvil: la rosa tiene cuatro sectores', n_rosa == 4, str(n_rosa))
    # tocar el sector de arriba y mantener: carga alto; deslizar a la izquierda: no cambia (va comprometido)
    mv.evaluate(f"""(() => {{ const r = document.getElementById('cmbRosa'); const ev = (t, x, y) => r.dispatchEvent(new PointerEvent(t, {{ pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }}));
      window.__rosa = ev; ev('pointerdown', {x0 + w / 2}, {y0 + w * 0.15}); }})()""")
    mv.wait_for_function(f'{C}.L.carga() > 0.05', timeout=60000); e = estado(mv)
    comprobar('móvil: tocar arriba en la rosa y mantener carga el golpe alto', e['accion'] == 'preparando' and e['linea'] == 'alto', str(e))
    mv.screenshot(path=f'{SALIDA}/movil_rosa_cargando.png')
    mv.evaluate(f"window.__rosa('pointermove', {x0 + w * 0.12}, {y0 + w / 2})"); e = estado(mv)
    comprobar('móvil: deslizar el dedo no cambia el golpe (va comprometido)', e['linea'] == 'alto' and not e['finta'], str(e))
    # «Parar» con el golpe cargado: finta
    mv.evaluate("document.getElementById('cmbParar').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true }))"); e = estado(mv)
    comprobar('móvil: «Parar» con el golpe cargado lo cancela (finta) y para', e['accion'] == 'libre' and e['finta'] and e['bloq'], str(e))
    mv.evaluate("document.getElementById('cmbParar').dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', bubbles: true }))")
    mv.evaluate(f"window.__rosa('pointerup', {x0 + w * 0.12}, {y0 + w / 2})")
    libre(mv)
    mv.evaluate(f"window.__rosa('pointerdown', {x0 + w / 2}, {y0 + w * 0.85})")
    mv.wait_for_function(f'{C}.L.carga() > 0.05', timeout=60000); e = estado(mv)
    comprobar('móvil: abajo en la rosa es clavar (la estocada)', e['accion'] == 'preparando' and e['linea'] == 'estocada', str(e))
    mv.evaluate(f"window.__rosa('pointerup', {x0 + w / 2}, {y0 + w * 0.85})"); mv.wait_for_timeout(120); e = estado(mv)
    comprobar('móvil: levantar el dedo lanza el golpe', e['accion'] in ('lanzando', 'golpeando', 'recuperando'), str(e))
    libre(mv)
    mv.evaluate("document.getElementById('cmbParar').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 8, pointerType: 'touch', bubbles: true }))")
    mv.evaluate(f"window.__rosa('pointerdown', {x0 + w * 0.88}, {y0 + w / 2})"); e = estado(mv)
    comprobar('móvil: con «Parar» pulsado, la rosa elige el lado de la parada', e['bloq'] and e['lb'] == 'derecha', str(e))
    mv.wait_for_timeout(300); mv.screenshot(path=f'{SALIDA}/movil_parando.png')
    comprobar('sin errores en consola (móvil)', not err2, str(err2[:3]))
    nav.close()

print('\nResultado:', 'TODO CORRECTO' if not fallos else f'{len(fallos)} fallos: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
