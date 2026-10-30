# Prueba en navegador del «Duelo en línea» en la demo única: un servidor local (servidor/servidor.mjs) y dos páginas,
# una en PC y otra en móvil, que pelean entre sí. El servidor resuelve los golpes y las dos ven los mismos golpes y heridas.
# Uso: python3 pruebas/prueba_duelo_en_linea_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1 tira las intenciones de combate que manda cada página (como si no se mandaran): la prueba tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_duelo_en_linea'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

# la web, como en GitHub Pages: la demo en jugar/demo/ y los personajes en recursos/personajes/
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v12', 'taller-v17', 'taller-anim-v1']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html'

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
ARCHIVO = os.path.join(sitio, 'mundo.jsonl')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), ARCHIVO], cwd=RAIZ,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
DIRECCION = f'ws://127.0.0.1:{PUERTO}'

ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def tapado(pg, sel):
    return pg.evaluate("""s => { const e = document.querySelector(s); if (!e) return 'no está'; const r = e.getBoundingClientRect();
      if (r.width === 0) return 'invisible'; const x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return x === e || e.contains(x) ? '' : (x ? x.id || x.tagName : 'nada'); }""", sel)
def esperar(pg, cond, ms=20000):
    try: pg.wait_for_function(cond, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    # con la otra página dibujando sin tarjeta gráfica, a veces la captura falla a la primera
    for i in range(4):
        try: pg.screenshot(path=ruta, timeout=60000); return
        except Exception as e:
            if i == 3: comprobar('captura ' + os.path.basename(ruta), False, str(e)[:120])
            else: pg.wait_for_timeout(1500)
D = 'window.__duelo'
golpes = lambda pg: pg.evaluate(f"JSON.stringify({D}.eventosRed.filter(e => e.tipo === 'golpe'))")
otro = lambda pg: f"[...{D}.otros.values()][0]"

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        paginas = {}
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Página', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR:
                ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
                  WebSocket.prototype.send = function (d) { if (String(d).includes('"combate"')) return; return s.call(this, d); }; })()""")
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
            pg.goto(URL)
            # la de PC eligió una mujer con vestido y lucha con gambesón; la del móvil, el de por defecto y sin armadura
            if not movil:
                pg.evaluate("localStorage.setItem('kinhold_personaje_v2', JSON.stringify({ sexo: 'mujer', capas: { mujer: ['vestido'] }, aspecto: { mujer: { piel: 'oscura', ojos: 'azules', formas: { altura: -1, musculo: 0.7 } } } }))")
                pg.evaluate("localStorage.setItem('kinhold_combate_v2', JSON.stringify({ armadura: 'gambeson' }))")
            pg.evaluate(f"localStorage.setItem('kinhold_servidor', '{DIRECCION}')")
            pg.goto(URL); pg.wait_for_function('window.__demo && window.__demo.listo')
            comprobar(f'{nombre}: el menú tiene «Duelo en línea»', 'modo=duelo' in (pg.get_attribute('#demoDueloEnLinea', 'href') or '') and 'enlinea=1' in pg.get_attribute('#demoDueloEnLinea', 'href'))
            t = tapado(pg, '#demoDueloEnLinea'); comprobar(f'{nombre}: «Duelo en línea» se ve entero', t == '', t)
            captura(pg, f'{SALIDA}/{nombre}_1_menu.png')
            pg.click('#demoDueloEnLinea'); pg.wait_for_load_state('load')
            comprobar(f'{nombre}: el duelo carga', esperar(pg, 'window.__demo && window.__demo.listo', 90000), str(err[:2]))
            comprobar(f'{nombre}: se conecta al servidor', esperar(pg, f"{D}.red && {D}.red.estado === 'conectado'"))
            comprobar(f'{nombre}: en línea no están las opciones del rival', pg.evaluate("['selModo','selArmaRival','selArmaduraRival'].every(i => document.getElementById(i).hidden)"))
            paginas[nombre] = (pg, err)
        A, errA = paginas['pc']; B, errB = paginas['movil']
        yoA, yoB = A.evaluate(f"{D}.red.yo"), B.evaluate(f"{D}.red.yo")

        print('Verse en la liza')
        comprobar('PC ve al móvil en la liza', esperar(A, f"{D}.otros.size === 1 && {otro(A)}.visto && {otro(A)}.m", 15000))
        comprobar('el móvil ve a PC en la liza', esperar(B, f"{D}.otros.size === 1 && {otro(B)}.visto && {otro(B)}.m", 30000))
        comprobar('el móvil ve a PC con el cuerpo y la ropa que eligió y su armadura', B.evaluate(f"{otro(B)}.clave").startswith('mujer:gambeson:gambeson:'), B.evaluate(f"{otro(B)}.clave"))
        comprobar('PC ve al móvil como el de por defecto, sin armadura', A.evaluate(f"{otro(A)}.clave").startswith('hombre::lino:'), A.evaluate(f"{otro(A)}.clave"))
        # el aspecto (forma, colores, peinado y barba): el otro lo ve igual que uno mismo se ve
        listo = lambda m: f"({m}.userData.taller && {m}.userData.taller.estado === 'listo')"
        asp = lambda pg, m: (esperar(pg, listo(m), 30000), pg.evaluate(f"JSON.stringify({m}.userData.taller.mh.aspecto)"))[1]
        aB, aA = asp(B, f"{otro(B)}.m"), asp(A, f"{D}.mJugador")
        comprobar('el móvil ve a PC con su aspecto (piel oscura, ojos azules, baja y musculosa)', aB == aA and json.loads(aB)['piel'] == 'oscura' and json.loads(aB)['formas']['musculo'] == 0.7, aB)
        comprobar('PC ve al móvil con el aspecto por defecto, igual que el móvil se ve', asp(A, f"{otro(A)}.m") == asp(B, f"{D}.mJugador"))
        comprobar('cada uno dice que tiene un rival en la liza', 'en la liza' in A.inner_text('#estadoRed') and 'en la liza' in B.inner_text('#estadoRed'), A.inner_text('#estadoRed'))
        # frente a frente, a 1,5 m
        A.evaluate(f"Object.assign({D}.jugador, {{ x: 0, z: -0.75, rot: 0 }})")
        B.evaluate(f"Object.assign({D}.jugador, {{ x: 0, z: 0.75, rot: Math.PI }})")
        cerca = lambda pg, x, z: f"{D}.rival && Math.hypot({D}.rival.x - ({x}), {D}.rival.z - ({z})) < 0.1"
        comprobar('PC ve al móvil donde está', esperar(A, cerca(A, 0, 0.75), 8000))
        comprobar('el móvil ve a PC donde está', esperar(B, cerca(B, 0, -0.75), 15000))
        comprobar('la rosa de golpes sale sobre el rival', esperar(A, f"{D}.rosa.visible", 5000) and esperar(B, f"{D}.rosa.visible", 15000))

        print('Un golpe que hiere')
        A.evaluate(f"{D}.atacar('alto')")
        comprobar('PC prepara el golpe al momento (sin esperar a la red)', A.evaluate(f"{D}.jugador.accion") == 'preparando')
        comprobar('el móvil ve a PC preparando el golpe', esperar(B, f"{otro(B)}.L.accion === 'preparando' || {D}.eventosRed.some(e => e.tipo === 'golpe')", 8000))
        comprobar('el golpe llega a las dos páginas', esperar(A, f"{D}.eventosRed.some(e => e.tipo === 'golpe')", 8000) and esperar(B, f"{D}.eventosRed.some(e => e.tipo === 'golpe')", 8000))
        gA, gB = json.loads(golpes(A)), json.loads(golpes(B))
        g = gA[0] if gA else {}
        comprobar('lo resuelve el servidor, con el autor de PC y el móvil de objetivo', g.get('autor') == yoA and g.get('objetivo') == yoB, json.dumps(g))
        comprobar('las dos ven el mismo golpe', gA == gB, f'{g.get("resultado")} en {g.get("zona")} ({g.get("gravedad")})')
        heridasB = f"{D}.jugador.heridas.map(h => h.zona + ':' + h.gravedad).join(',')"
        heridasDeB = f"{otro(A)}.L.heridas.map(h => h.zona + ':' + h.gravedad).join(',')"
        esperar(B, f"{D}.jugador.heridas.length === 1", 5000); esperar(A, f"{otro(A)}.L.heridas.length === 1", 5000)
        comprobar('el móvil tiene la herida y PC se la ve igual', g.get('resultado') == 'herida' and B.evaluate(heridasB) == f"{g['zona']}:{g['gravedad']}" and A.evaluate(heridasDeB) == B.evaluate(heridasB),
                   f"móvil: {B.evaluate(heridasB)} · PC ve: {A.evaluate(heridasDeB)}")
        comprobar('cada una lo cuenta a su manera (hieres / te hieren)', 'Hieres' in A.inner_text('#registro') and 'Te hieren' in B.inner_text('#registro'),
                  A.inner_text('#registro').split('\n')[0] + ' | ' + B.inner_text('#registro').split('\n')[0])
        comprobar('el móvil ve el aviso de su herida', esperar(B, "document.querySelectorAll('#avisos .aviso').length >= 1", 5000))
        A.wait_for_timeout(500)
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_2_golpe.png')

        if B.evaluate(f"{D}.jugador.fuera"):
            # el azar de las heridas: si el primer golpe ya lo tumba, vuelve a empezar (la pelea sigue para PC)
            B.evaluate(f"{D}.otraPartida()")
            comprobar('(cayó pronto: vuelve a empezar y la pelea sigue para PC)', esperar(B, f"!{D}.jugador.fuera && {D}.jugador.heridas.length === 0", 10000) and esperar(A, f"!{D}.terminado", 8000),
                      B.evaluate(f"JSON.stringify([{D}.jugador.fuera, {D}.red.estado, {D}.eventosRed.slice(-2)])") + ' · ' + B.inner_text('#registro')[:200])

        print('Una parada')
        n0 = len(gA)
        B.evaluate(f"{D}.parar(true)"); B.wait_for_timeout(300); A.wait_for_timeout(1200)  # el aturdimiento del golpe se pasa
        A.evaluate(f"{D}.atacar('izquierda')")
        comprobar('la parada llega a las dos', esperar(A, f"{D}.eventosRed.filter(e => e.tipo === 'golpe').length > {n0}", 8000) and esperar(B, f"{D}.eventosRed.filter(e => e.tipo === 'golpe').length > {n0}", 8000))
        g2 = json.loads(golpes(A))[n0:]
        comprobar('el móvil para el golpe de PC (lo dice el servidor)', bool(g2) and g2[0]['resultado'] in ('parada', 'parada perfecta'), g2[0]['resultado'] if g2 else '—')
        comprobar('y las dos lo ven igual', json.loads(golpes(A)) == json.loads(golpes(B)))
        B.evaluate(f"{D}.parar(false)")
        # de cerca, para ver a los dos
        for pg in (A, B): pg.evaluate(f"{D}.cam.dist = 5; {D}.cam.manual = 1e9")
        A.evaluate(f"{D}.atacar('derecha')"); A.wait_for_timeout(250)
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_3_de_cerca.png')

        print('Hasta que uno cae')
        for i in range(40):
            if A.evaluate(f"{otro(A)}.L.fuera"): break
            A.evaluate(f"{D}.jugador.cansancio = 0; {D}.atacar(['alto','izquierda','derecha','bajo','estocada'][{i} % 5])")
            A.wait_for_timeout(1400)
        comprobar('el móvil cae (lo decide el servidor)', esperar(B, f"{D}.jugador.fuera", 10000) and esperar(A, f"{otro(A)}.L.fuera", 5000))
        comprobar('PC ve la victoria y el móvil la derrota', esperar(A, f"{D}.terminado", 5000) and esperar(B, f"{D}.terminado", 10000)
                  and 'vencido' in A.inner_text('#tituloFinal') and 'caído' in B.inner_text('#tituloFinal'))
        comprobar('las dos han visto los mismos golpes, en el mismo orden', json.loads(golpes(A)) == json.loads(golpes(B)), f"{len(json.loads(golpes(A)))} golpes")
        lineas = [json.loads(l) for l in open(os.path.join(sitio, 'combate.jsonl')) if l.strip()]
        heridas = [e for e in lineas if e.get('tipo') == 'golpe' and e.get('zona')]
        comprobar('el servidor guarda cada herida con su autor', heridas and all(e['autor'] == yoA and e['datos']['objetivo'] == yoB for e in heridas), f'{len(heridas)} heridas')
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_4_final.png')

        print('Volver a empezar')
        B.click('#btnOtra')
        comprobar('el móvil vuelve a empezar, sano', esperar(B, f"!{D}.terminado && !{D}.jugador.fuera && {D}.jugador.heridas.length === 0", 10000) and B.is_hidden('#final'))
        comprobar('PC lo ve sano', esperar(A, f"!{otro(A)}.L.fuera && {otro(A)}.L.heridas.length === 0", 8000))
        comprobar('y para PC la pelea sigue: se quita su pantalla final', esperar(A, f"!{D}.terminado", 8000) and A.is_hidden('#final'))
        A.wait_for_timeout(1500)
        comprobar('y no vuelve a salir', A.is_hidden('#final') and not A.evaluate(f"{D}.terminado"))
        A.evaluate(f"{D}.otraPartida()")
        comprobar('con el rival en pie al lado no se puede volver a empezar sano', esperar(A, "document.getElementById('registro').textContent.includes('Hay alguien cerca')", 8000), A.inner_text('#registro').split('\n')[0])
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_5_otra.png')

        print('Se corta la conexión del móvil y vuelve')
        # que el móvil tenga alguna herida (el golpe puede fallar o pararse: se intenta unas cuantas veces)
        for i in range(8):
            if B.evaluate(f"{D}.jugador.heridas.length > 0"): break
            A.evaluate(f"{D}.jugador.cansancio = 0; {D}.atacar(['bajo','alto','izquierda','derecha'][{i} % 4])")
            esperar(B, f"{D}.jugador.heridas.length > 0", 1600)
        B.wait_for_timeout(600)
        antes = B.evaluate(f"JSON.stringify({{ yo: {D}.red.yo, heridas: {D}.jugador.heridas.map(h => h.zona + ':' + h.gravedad), fuera: {D}.jugador.fuera }})")
        B.evaluate(f"{D}.red.cortar()")
        comprobar('PC lo ve irse', esperar(A, f"{D}.otros.size === 0", 5000))
        comprobar('el móvil vuelve a conectar solo', esperar(B, f"{D}.red.estado === 'conectado'", 15000) and 'recuperada' in B.inner_text('#registro') + B.inner_text('body'))
        comprobar('PC lo vuelve a ver', esperar(A, f"{D}.otros.size === 1", 8000))
        esperar(B, f"{D}.jugador.heridas.length === {len(json.loads(antes)['heridas'])}", 5000)
        despues = B.evaluate(f"JSON.stringify({{ yo: {D}.red.yo, heridas: {D}.jugador.heridas.map(h => h.zona + ':' + h.gravedad), fuera: {D}.jugador.fuera }})")
        comprobar('y vuelve el mismo luchador, con sus heridas (no sano)', antes == despues and len(json.loads(antes)['heridas']) > 0, f'{antes} → {despues}')
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_6_vuelve.png')

        print('Del duelo a construir, en la misma pestaña')
        # valravnx, 28 oct: al pasar del duelo a construir, el servidor los seguía teniendo en la liza (la pestaña es el
        # mismo jugador) y en la construcción no se veían el uno al otro; las obras sí
        K = 'window.__kinhold'
        for nombre, (pg, _) in paginas.items():
            pg.goto(URL); pg.wait_for_function('window.__demo && window.__demo.listo')
            pg.click('#demoEnLinea'); pg.wait_for_load_state('load')
            comprobar(f'{nombre}: entra a construir en línea', esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado'", 90000))
        comprobar('sigue siendo el mismo jugador que en el duelo', A.evaluate(f"{K}.enLinea.red.yo") == yoA and B.evaluate(f"{K}.enLinea.red.yo") == yoB)
        comprobar('PC ve al móvil construyendo', esperar(A, f"{K}.enLinea.remotos.size === 1", 20000), str(A.evaluate(f"{K}.enLinea.remotos.size")))
        comprobar('el móvil ve a PC construyendo', esperar(B, f"{K}.enLinea.remotos.size === 1", 30000), str(B.evaluate(f"{K}.enLinea.remotos.size")))
        comprobar('y ninguno dice que el servidor sea antiguo', not A.evaluate(f"{K}.enLinea.antiguo") and not B.evaluate(f"{K}.enLinea.antiguo"))
        for nombre, (pg, _) in paginas.items(): captura(pg, f'{SALIDA}/{nombre}_7_construir_tras_duelo.png')
        # PC vuelve al duelo para lo que sigue
        A.goto(URL); A.wait_for_function('window.__demo && window.__demo.listo')
        A.click('#demoDueloEnLinea'); A.wait_for_load_state('load')
        comprobar('PC vuelve al duelo', esperar(A, f"window.__demo && window.__demo.listo && {D}.red && {D}.red.estado === 'conectado'", 90000))

        print('El servidor se apaga')
        servidor.terminate(); servidor.wait(5)
        comprobar('PC dice que se ha cortado (y que vuelve a conectar) y ya no ve al otro', esperar(A, "document.getElementById('estadoRed').textContent === 'Volviendo a conectar…'", 10000) and A.evaluate(f"{D}.otros.size") == 0,
                  f"estado: {A.inner_text('#estadoRed')} · otros: {A.evaluate(f'{D}.otros.size')}")
        comprobar('sin conexión no se ataca', not A.evaluate(f"{D}.atacar('alto')"))
        for nombre, (pg, err) in paginas.items():
            malos = [e for e in err if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e]
            comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        nav.close()
finally:
    if servidor.poll() is None: servidor.terminate()
    web.shutdown()
    shutil.rmtree(sitio, ignore_errors=True)

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
