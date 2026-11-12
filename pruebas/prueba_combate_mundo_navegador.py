# Prueba en navegador del combate dentro del mundo (valravnx, 30 oct), en el prototipo de construcción:
#  - la cámara se inclina hasta casi a ras de suelo;
#  - con el arma sacada (C), el ratón elige la dirección: la del último movimiento al pulsar, entre cuatro (arriba,
#    izquierda, derecha y abajo, que es clavar; sin movimiento, la última usada; valravnx, 31 oct); mantener carga el
#    golpe, que va comprometido (moverse no lo cambia); el botón derecho lo cancela (finta) y para, también con el
#    ratón de verdad (los dos botones a la vez); después se puede empezar otro golpe por otro lado; el botón derecho
#    para por el lado del ratón y se cambia sin soltar;
#  - un rival de práctica viene, pelea y sus golpes pasan por las acciones con autor; Tab lo fija y la cámara se
#    pone detrás de ti mirándole;
#  - en el móvil, dos rosas fijas (cuatro sectores cada una; valravnx, 1 nov): la de atacar carga el golpe al tocarla y
#    deslizar el dedo no lo cambia; la de parar para por el lado que se toca, cambia al deslizar y, con un golpe
#    cargándose, lo cancela (finta). Nada se tapa: ni con el mapa, el admin, el estado de la red ni lo que llevas.
# Uso: python3 pruebas/prueba_combate_mundo_navegador.py <html de la construcción> <carpeta de capturas>
#      MUTAR=1: el ratón no cambia de lado sin soltar, la cámara no baja y el botón de parar no finta: tiene que fallar.
import sys, os, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright
from sitio_prueba import montar_sitio, servir

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_demo.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
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
# lo que se ve encima del juego (botones, rosas, paneles), y qué pares se tapan
SOLAPES = """(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };
  const els = [...document.querySelectorAll('#menu > *, #modos > *, #btnUsar, #cmbBotones button, #cmbRosa, #cmbRosaParar, #cmbEstado, #joystick, #llevas, #aviso, #materiales, #btnDemoFps, #btnDemoMenu')].filter(vis);
  const malos = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
    const r = a.getBoundingClientRect(), q = b.getBoundingClientRect();
    if (r.left < q.right - 1 && q.left < r.right - 1 && r.top < q.bottom - 1 && q.top < r.bottom - 1) malos.push((a.id || a.textContent.trim().slice(0, 10)) + '/' + (b.id || b.textContent.trim().slice(0, 10)));
  }
  return malos;
})()"""

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
    # suelta el ratón cogido (si no, el lienzo tapa los botones del panel)
    pg.evaluate('document.exitPointerLock && document.exitPointerLock()'); pg.wait_for_timeout(300)
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
    # en línea, lo que dice el servidor (aquí sin servidor: se le pasan sus mensajes): la foto propia trae tus heridas
    # y un golpe de otro jugador contra ti se dice (valravnx, 31 oct: «los ataques no nos hacían nada»)
    libre(pg)
    pg.evaluate(f"""{C}.recibir({{ tipo: 'luchadores', t: 1, lista: [{{ autor: 'jugador:yo', arma: 'espada_larga', armadura: 'lino', accion: 'libre', linea: 'alto',
      duracion: 0, tAccion: 0, bloqueando: false, lineaBloqueo: 'alto', sacada: true, cansancio: 10, sangre: 92, heridas: 1,
      lista: [['brazoD', 'grave', 'corte', 0.4, '']], botiquin: {{}}, contra: false, fuera: false }}] }}, 'jugador:yo')""")
    pg.evaluate(f"""{C}.recibir({{ tipo: 'combate', eventos: [{{ tipo: 'golpe', autor: 'jugador:otro', objetivo: 'jugador:yo', linea: 'derecha', resultado: 'herida', zona: 'brazoD', gravedad: 'grave', danio: 'corte', t: 1 }}] }}, 'jugador:yo')""")
    h = pg.evaluate(f"({{ heridas: {C}.L.heridas.map(h => h.zona + ':' + h.gravedad), sangre: {C}.L.sangre, msg: document.getElementById('cmbMsg').textContent }})")
    comprobar('en línea, la foto del servidor trae tus heridas y el golpe de otro jugador se dice', h['heridas'] == ['brazoD:grave'] and abs(h['sangre'] - 92) < 1 and 'Te hieren' in h['msg'], str(h))
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
    # PC, con lo que llevas en las manos a la vista: el aliento no va encima (iban los dos abajo en el centro)
    pg.evaluate("""(() => { const l = document.getElementById('llevas'); l.hidden = false; l.innerHTML = '<span class=llevo><span>En la mano:</span><b>Hacha</b><button>Soltar</button></span>'; })()""")
    pg.wait_for_timeout(200)
    solapes = pg.evaluate(SOLAPES)
    comprobar('PC: nada tapa nada con el arma sacada (aliento, lo que llevas, botones, menú)', not solapes, str(solapes))
    pg.evaluate("document.getElementById('llevas').hidden = true")
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
    # lo que sale en el juego de verdad y aquí no: el estado de la red, el mapa, el admin y lo que llevas en las manos
    mv.evaluate("""(() => { const m = document.getElementById('menu'); const s = document.createElement('span'); s.id = 'estadoRed'; s.textContent = 'En línea · 1 más';
      s.style.cssText = 'align-self:center;padding:6px 9px;font-size:12px'; m.prepend(s);
      for (const [id, t] of [['btnMapaPrueba', 'Mapa'], ['btnAdminPrueba', 'Admin']]) { const b = document.createElement('button'); b.id = id; b.textContent = t; m.appendChild(b); }
      const l = document.getElementById('llevas'); l.hidden = false; l.innerHTML = '<span class=llevo><span>En la mano:</span><b>Hacha</b><button>Soltar</button></span>'; })()""")
    mv.wait_for_timeout(300)
    vis = mv.evaluate("['cmbRosa', 'cmbRosaParar', 'cmbFijar', 'cmbRival'].map(id => { const e = document.getElementById(id); const b = e.getBoundingClientRect(); return [id, !e.closest('[hidden]') && b.width > 0, Math.round(b.right), Math.round(b.bottom)]; })")
    comprobar('móvil: las rosas de atacar y de parar y los botones Fijar y Rival salen y caben', all(v[1] and v[2] <= 390 and v[3] <= 844 for v in vis), str(vis))
    # todo lo que se ve, con todo lo que se ve: ningún botón ni panel encima de otro
    solapes = mv.evaluate(SOLAPES)
    comprobar('móvil: nada tapa nada (rosas, botones, aliento, joystick, menú, aviso)', not solapes, str(solapes))
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
    # la rosa de parar con el golpe cargado: finta, y para por el lado que se toca
    cp = mv.evaluate("(() => { const b = document.getElementById('cmbRosaParar').getBoundingClientRect(); return [b.left, b.top, b.width]; })()")
    px0, py0, pw = cp
    mv.evaluate(f"""(() => {{ const r = document.getElementById('cmbRosaParar'); window.__parar = (t, x, y) => r.dispatchEvent(new PointerEvent(t, {{ pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }}));
      window.__parar('pointerdown', {px0 + pw * 0.15}, {py0 + pw / 2}); }})()"""); e = estado(mv)
    comprobar('móvil: la rosa de parar con el golpe cargado lo cancela (finta) y para por el lado tocado (izquierda)', e['accion'] == 'libre' and e['finta'] and e['bloq'] and e['lb'] == 'izquierda', str(e))
    mv.evaluate(f"window.__parar('pointermove', {px0 + pw / 2}, {py0 + pw * 0.12})"); e = estado(mv)
    comprobar('móvil: deslizando en la rosa de parar cambia de lado (arriba)', e['bloq'] and e['lb'] == 'alto', str(e))
    mv.evaluate(f"window.__parar('pointerup', {px0 + pw / 2}, {py0 + pw * 0.12})"); e = estado(mv)
    comprobar('móvil: al soltar la rosa de parar, deja de parar', not e['bloq'], str(e))
    mv.evaluate(f"window.__rosa('pointerup', {x0 + w * 0.12}, {y0 + w / 2})")
    libre(mv)
    mv.evaluate(f"window.__rosa('pointerdown', {x0 + w / 2}, {y0 + w * 0.85})")
    mv.wait_for_function(f'{C}.L.carga() > 0.05', timeout=60000); e = estado(mv)
    comprobar('móvil: abajo en la rosa es clavar (la estocada)', e['accion'] == 'preparando' and e['linea'] == 'estocada', str(e))
    mv.evaluate(f"window.__rosa('pointerup', {x0 + w / 2}, {y0 + w * 0.85})")
    # soltado pronto, sale al llegar a la carga mínima (con tarjeta gráfica se llega aquí antes de eso)
    try: mv.wait_for_function(f'{C}.L.accion !== "preparando"', timeout=10000)
    except Exception: pass
    e = estado(mv)
    comprobar('móvil: levantar el dedo lanza el golpe', e['accion'] in ('lanzando', 'golpeando', 'recuperando'), str(e))
    libre(mv)
    mv.evaluate(f"window.__parar('pointerdown', {px0 + pw * 0.88}, {py0 + pw / 2})"); e = estado(mv)
    comprobar('móvil: la rosa de parar, a la derecha, para por la derecha', e['bloq'] and e['lb'] == 'derecha', str(e))
    mv.wait_for_timeout(300); mv.screenshot(path=f'{SALIDA}/movil_parando.png')
    mv.evaluate(f"window.__parar('pointerup', {px0 + pw * 0.88}, {py0 + pw / 2})")
    comprobar('sin errores en consola (móvil)', not err2, str(err2[:3]))
    nav.close()

print('\nResultado:', 'TODO CORRECTO' if not fallos else f'{len(fallos)} fallos: ' + ', '.join(fallos))
sys.exit(1 if fallos else 0)
