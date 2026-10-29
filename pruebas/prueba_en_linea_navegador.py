# Prueba en navegador de «Jugar en línea» en la demo única: un servidor local (servidor/servidor.mjs) y dos páginas,
# una en PC y otra en móvil, que construyen en el mismo mundo y se ven la una a la otra con su personaje del taller.
# Uso: python3 pruebas/prueba_en_linea_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1 tira los mensajes de posición que manda cada página (como si no se mandaran): la prueba tiene que fallar.
# MUTAR_FICHA=1 no deja guardar la ficha del servidor (al volver a conectar se es otro): tiene que fallar.
# MUTAR_OBRA=1 rehace todo lo construido cada vez que una obra avanza (como antes del arreglo de los fotogramas): tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_en_linea'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))
MUTAR_OBRA = bool(os.environ.get('MUTAR_OBRA'))
MUTAR_FICHA = bool(os.environ.get('MUTAR_FICHA'))   # la página no guarda su ficha: al volver sería otro jugador; tiene que fallar

# la web, como en GitHub Pages: la demo en jugar/demo/ y los personajes en recursos/personajes/
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/demo'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/demo/prueba.html')
for c in ['v1', 'taller-v10']:
    shutil.copytree(os.path.join(RAIZ, f'docs/recursos/personajes/{c}'), f'{sitio}/recursos/personajes/{c}')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
web = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=web.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html'

# el servidor del juego, en un puerto libre y con un mundo nuevo
s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
ARCHIVO = os.path.join(sitio, 'mundo.jsonl')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), ARCHIVO], cwd=RAIZ,
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()  # «Servidor de Kinhold en el puerto …»
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
K = 'window.__kinhold'
ASPECTO_PC = "{ piel: 'morena', ojos: 'verdes', pelo: 'rubio', formas: { altura: 1, peso: 0.8, cara: 0.6 } }"
def poner(pg, clase, tipo, x, z):
    pg.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('{clase}','{tipo}'); {K}.apuntar({x},{z})")
    ok = pg.evaluate(f"!!({K}.estado.candidato && {K}.estado.candidato.v.ok)")
    pg.evaluate(f"{K}.colocar(); {K}.terminarObras(); {K}.cambiarModo('mover')")
    return ok
piezas = lambda pg: pg.evaluate(f"{K}.mundo.construcciones.reduce((t, c) => t + c.piezas.size, 0)")
obras = lambda pg: pg.evaluate(f"{K}.mundo.construcciones.reduce((t, c) => t + [...c.piezas.values()].filter(p => p.obra).length, 0)")

try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        paginas = {}
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Página', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR:
                ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
                  WebSocket.prototype.send = function (d) { if (String(d).includes('"estado"')) return; return s.call(this, d); }; })()""")
            if MUTAR_FICHA:
                ctx.add_init_script("(() => { const s = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith('kinhold_ficha')) return; return s.call(this, k, v); }; })()")
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
            # la de PC eligió una mujer con vestido y gambesón, morena, alta y de más peso; la del móvil no eligió (hombre con camisa y calzas)
            if not movil:
                pg.goto(URL)
                pg.evaluate("localStorage.setItem('kinhold_personaje_v2', JSON.stringify({ sexo: 'mujer', capas: { mujer: ['vestido', 'gambeson'] }, aspecto: { mujer: " + ASPECTO_PC + " } }))")
            pg.goto(URL); pg.wait_for_function('window.__demo && window.__demo.listo')
            comprobar(f'{nombre}: el menú tiene «Jugar en línea»', pg.locator('#demoEnLinea').count() == 1 and 'enlinea=1' in pg.get_attribute('#demoEnLinea', 'href'))
            # Opciones: la dirección del servidor
            pg.click('#btnDemoOpciones')
            comprobar(f'{nombre}: Opciones enseña la dirección (por defecto, la del propio aparato)', pg.input_value('#demoServidor') == 'ws://localhost:8080', pg.input_value('#demoServidor'))
            pg.fill('#demoServidor', 'http://mal'); pg.click('#btnDemoGuardar')
            comprobar(f'{nombre}: una dirección que no es ws:// no se guarda', 'ws://' in pg.inner_text('#demoServidorNota'))
            pg.fill('#demoServidor', DIRECCION); pg.click('#btnDemoGuardar')
            comprobar(f'{nombre}: la dirección se guarda', pg.evaluate("localStorage.getItem('kinhold_servidor')") == DIRECCION)
            t = tapado(pg, '#btnDemoGuardar'); comprobar(f'{nombre}: el botón Guardar se ve entero', t == '', t)
            pg.screenshot(path=f'{SALIDA}/{nombre}_1_menu_opciones.png')
            pg.click('#demoEnLinea'); pg.wait_for_load_state('load')
            comprobar(f'{nombre}: la construcción carga', esperar(pg, 'window.__demo && window.__demo.listo', 60000), str(err[:2]))
            comprobar(f'{nombre}: se conecta al servidor', esperar(pg, f"{K}.enLinea && {K}.enLinea.estado === 'conectado'"))
            comprobar(f'{nombre}: «Reiniciar» no está en línea', pg.is_hidden('#btnReiniciar'))
            comprobar(f'{nombre}: el estado de la conexión se ve arriba', 'En línea' in pg.inner_text('#estadoRed') and tapado(pg, '#estadoRed') == '', pg.inner_text('#estadoRed'))
            paginas[nombre] = (pg, err)
        A, errA = paginas['pc']; B, errB = paginas['movil']

        print('Construir en el mundo del servidor')
        comprobar('PC pone el mojón', poner(A, 'mojon', 'mojon', 0, 0))
        comprobar('el móvil ve el mojón de PC', esperar(B, f"!!{K}.mundo.mojon", 5000))
        for x, z in [(1, 1), (3, 1)]: poner(A, 'pieza', 'cim_piedra', x, z)
        comprobar('PC pone dos cimientos y los termina (llevando material y trabajando, por el servidor)', piezas(A) == 2 and esperar(A, f"{K}.enLinea.red.pendientes.length === 0", 15000) and obras(A) == 0, f'{piezas(A)} piezas, {obras(A)} obras')
        poner(B, 'pieza', 'cim_piedra', 1, 3)
        comprobar('el móvil construye sobre la obra de PC', esperar(B, f"{K}.enLinea.red.pendientes.length === 0", 15000) and piezas(B) == 3 and obras(B) == 0)
        comprobar('PC ve el cimiento del móvil, terminado', esperar(A, f"{K}.mundo.construcciones.reduce((t, c) => t + c.piezas.size, 0) === 3", 5000) and obras(A) == 0)
        armazon = f"!{K}.escena.getObjectByName('armazon')"
        comprobar('y las dos lo dibujan terminado (sin el armazón de obra)', esperar(A, armazon, 5000) and esperar(B, armazon, 5000))
        foto = lambda pg: pg.evaluate(f"JSON.stringify({K}.mundo.exportar())")
        comprobar('las dos páginas tienen el mismo mundo', esperar(A, 'true') and foto(A) == foto(B))
        comprobar('en línea no se guarda nada en el navegador', A.evaluate("localStorage.getItem('kinhold_h1_v1')") is None and B.evaluate("localStorage.getItem('kinhold_h1_v1')") is None)
        lineas = [json.loads(l) for l in open(ARCHIVO) if l.strip()]
        autores = {e['autor'] for e in lineas}
        yoA, yoB = A.evaluate(f"{K}.enLinea.red.yo"), B.evaluate(f"{K}.enLinea.red.yo")
        comprobar('el servidor guarda las acciones con el autor de cada página', autores == {yoA, yoB} and all(e['ok'] for e in lineas), f'{len(lineas)} acciones de {len(autores)} autores')

        print('Verse el uno al otro')
        # cada uno en un sitio, mirándose; la cámara de cada uno los enseña a los dos
        A.evaluate(f"Object.assign({K}.pj, {{ x: 1.2, z: 6.5, rot: Math.PI * 0.75 }}); {K}.cam.yaw = Math.PI * 0.15; {K}.cam.dist = 9; {K}.cam.pitch = 0.45")
        B.evaluate(f"Object.assign({K}.pj, {{ x: -1.0, z: 5.0, rot: -Math.PI * 0.25 }}); {K}.cam.yaw = Math.PI * 1.15; {K}.cam.dist = 8; {K}.cam.pitch = 0.45")
        vistoEn = lambda pg, x, z: f"(() => {{ const r = [...{K}.enLinea.remotos.values()][0]; return r && Math.hypot(r.j.raiz.position.x - ({x}), r.j.raiz.position.z - ({z})) < 0.15; }})()"
        comprobar('el móvil ve a PC donde está', esperar(B, vistoEn(B, 1.2, 6.5), 8000))
        comprobar('PC ve al móvil donde está', esperar(A, vistoEn(A, -1.0, 5.0), 8000))
        comprobar('cada uno ve a uno solo (no a sí mismo)', A.evaluate(f"{K}.enLinea.remotos.size") == 1 and B.evaluate(f"{K}.enLinea.remotos.size") == 1)
        comprobar('el móvil ve a PC con el cuerpo y la ropa que eligió', B.evaluate(f"[...{K}.enLinea.remotos.values()][0].clave").startswith('mujer:vestido,gambeson:'),
                   B.evaluate(f"[...{K}.enLinea.remotos.values()][0].clave"))
        comprobar('PC ve al móvil como el de por defecto', A.evaluate(f"[...{K}.enLinea.remotos.values()][0].clave").startswith('hombre::'))
        comprobar('los dos son personajes del taller (no el muñeco)', esperar(A, f"[...{K}.enLinea.remotos.values()][0].j.mh !== null", 30000) and esperar(B, f"[...{K}.enLinea.remotos.values()][0].j.mh !== null", 30000))
        # el aspecto (forma, colores, peinado y barba): el otro lo ve igual que uno mismo se ve
        aspRemoto = lambda pg: pg.evaluate(f"JSON.stringify([...{K}.enLinea.remotos.values()][0].j.mh.aspecto)")
        aspPropio = lambda pg: (esperar(pg, f"{K}.jugador.mh !== null", 30000), pg.evaluate(f"JSON.stringify({K}.jugador.mh.aspecto)"))[1]
        comprobar('el móvil ve a PC con su aspecto (morena, ojos verdes, alta, de más peso)', aspRemoto(B) == aspPropio(A) and json.loads(aspRemoto(B))['piel'] == 'morena', aspRemoto(B))
        comprobar('y a su altura (escala del modelo)', abs(B.evaluate(f"[...{K}.enLinea.remotos.values()][0].j.mh.modelo.scale.y") - A.evaluate(f"{K}.jugador.mh.modelo.scale.y")) < 1e-6 and A.evaluate(f"{K}.jugador.mh.modelo.scale.y") > 1.05)
        colorPiel = f"(mh => {{ let c = null; mh.modelo.traverse(n => {{ if (!c && n.isMesh && n.userData.tinte === 'piel') c = n.material.color.getHexString(); }}); return c; }})"
        comprobar('con el mismo color de piel en las dos pantallas', B.evaluate(f"{colorPiel}([...{K}.enLinea.remotos.values()][0].j.mh)") == A.evaluate(f"{colorPiel}({K}.jugador.mh)") is not None)
        comprobar('PC ve al móvil con el aspecto por defecto, igual que el móvil se ve', aspRemoto(A) == aspPropio(B), aspRemoto(A))
        # andar: el otro lo ve moverse y con la animación de andar
        A.evaluate(f"{K}.pj.z = 6.5; window.__andar = setInterval(() => {{ {K}.pj.x += 0.05; }}, 33)")
        comprobar('cuando PC anda, el móvil lo ve andar', esperar(B, f"[...{K}.enLinea.remotos.values()][0].j.modo !== 'quieto'", 6000), B.evaluate(f"[...{K}.enLinea.remotos.values()][0].j.modo"))
        A.evaluate("clearInterval(window.__andar)")
        A.evaluate(f"Object.assign({K}.pj, {{ x: 1.2, z: 6.5, rot: Math.PI * 0.75 }})")
        esperar(B, vistoEn(B, 1.2, 6.5), 8000); A.wait_for_timeout(800)
        for nombre, (pg, _) in paginas.items():
            pg.screenshot(path=f'{SALIDA}/{nombre}_2_en_linea.png')
        # de cerca, para ver los personajes
        A.evaluate(f"{K}.cam.dist = 4.5; {K}.cam.pitch = 0.25"); B.evaluate(f"{K}.cam.dist = 4.5; {K}.cam.pitch = 0.25")
        A.wait_for_timeout(600)
        for nombre, (pg, _) in paginas.items():
            pg.screenshot(path=f'{SALIDA}/{nombre}_3_de_cerca.png')
        # el móvil, al lado de PC: así se ve su aspecto de cerca (morena, alta y de más peso)
        B.evaluate(f"Object.assign({K}.pj, {{ x: 0.0, z: 5.9, rot: Math.atan2(1.2, 0.6) }}); {K}.cam.yaw = Math.atan2(-1.2, -0.6) + 0.45; {K}.cam.dist = 3.2; {K}.cam.pitch = 0.18")
        esperar(A, vistoEn(A, 0.0, 5.9), 8000); B.wait_for_timeout(800)
        B.screenshot(path=f'{SALIDA}/movil_3b_ve_a_pc.png')

        print('Construir una obra sin rehacer todo')
        # mientras alguien trabaja en una obra, solo se rehace esa pieza (en su página y en la del otro), no lo construido entero
        if MUTAR_OBRA:
            for pg in (A, B): pg.evaluate('window.__rehacerTodo = true')
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','cim_piedra'); {K}.apuntar(3,3); {K}.colocar(); {K}.cambiarModo('mover')")
        A.evaluate(f"Object.assign({K}.pj, {{ x: 4.6, z: 3.2 }})"); A.wait_for_timeout(400)
        comprobar('PC tiene la obra al alcance', A.evaluate(f"!!{K}.obraCercana()"))
        esperar(B, f"{K}.mundo.construcciones.reduce((t, c) => t + c.piezas.size, 0) === 4", 5000); B.wait_for_timeout(500)
        for pg in (A, B): pg.evaluate("window.__rehechos.todo = 0; window.__rehechos.pieza = 0")
        A.evaluate(f"{K}.usar()")
        comprobar('PC se pone a construir', A.evaluate(f"!!{K}.obrando"))
        A.wait_for_timeout(7000)
        ra, rb = A.evaluate("window.__rehechos"), B.evaluate("window.__rehechos")
        comprobar('mientras construye, PC rehace solo la obra (nada entero)', ra['todo'] == 0 and ra['pieza'] >= 1, str(ra))
        comprobar('y el otro tampoco rehace todo al verla avanzar', rb['todo'] == 0 and rb['pieza'] >= 1, str(rb))
        A.evaluate(f"{K}.estado.obrando = null")  # deja de construir (como al moverse)
        piezasAntes = piezas(A)

        print('Abrir un portillo en línea sin rehacer todo')
        # valravnx, 28 oct: abrir o cerrar puertas daba tirones horribles a los dos (se rehacía todo lo construido)
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','cerca_portillo'); {K}.apuntar(-2,3); {K}.colocar(); {K}.cambiarModo('mover')")
        donde = f"""(() => {{ for (const c of {K}.mundo.construcciones) for (const p of c.piezas.values()) if (p.tipo === 'cerca_portillo') {{
            const lx = p.d === 0 ? (p.i + 0.5) * 2 : p.i * 2, lz = p.d === 0 ? p.j * 2 : (p.j + 0.5) * 2, co = Math.cos(c.rot), si = Math.sin(c.rot);
            return {{ x: c.ox + lx * co + lz * si, z: c.oz - lx * si + lz * co, obra: !!p.obra, abierta: !!p.abierta }}; }} return null; }})()"""
        g = A.evaluate(donde)
        comprobar('PC pone el marco de un portillo', g is not None, str(g))
        if g:
            A.evaluate(f"Object.assign({K}.pj, {{ x: {g['x']} + 0.3, z: {g['z']} + 1.1, rot: Math.PI }})"); A.wait_for_timeout(300)
            A.evaluate(f"{K}.usar()")
            comprobar('PC termina el portillo', esperar(A, f"!({donde}).obra && {K}.enLinea.red.pendientes.length === 0", 30000) and esperar(B, f"({donde}) && !({donde}).obra", 10000))
            A.evaluate(f"{K}.estado.obrando = null"); A.wait_for_timeout(500)
            if MUTAR_OBRA:
                for pg in (A, B): pg.evaluate('window.__rehacerTodo = true')
            for pg in (A, B): pg.evaluate("window.__rehechos.todo = 0; window.__rehechos.pieza = 0")
            A.evaluate(f"{K}.usar()")
            comprobar('el móvil lo ve abrirse', esperar(B, f"({donde}).abierta", 8000))
            B.wait_for_timeout(500)
            ra, rb = A.evaluate("window.__rehechos"), B.evaluate("window.__rehechos")
            comprobar('al abrirlo, PC rehace solo el portillo (nada entero)', ra['todo'] == 0 and ra['pieza'] == 1, str(ra))
            comprobar('y el móvil, también solo el portillo', rb['todo'] == 0 and rb['pieza'] == 1, str(rb))
            hoja = f"(() => {{ let r = null; {K}.escena.traverse(o => {{ if (o.name !== 'hoja') return; let q = o.parent; while (q && !(q.userData && q.userData.key)) q = q.parent; if (q && q.userData.c && q.userData.c.piezas.get(q.userData.key)?.tipo === 'cerca_portillo') r = Math.abs(o.rotation.y) + Math.abs(o.rotation.x) + Math.abs(o.rotation.z); }}); return r; }})()"
            comprobar('y en el móvil el portillo se ve abierto (la hoja girada)', (B.evaluate(hoja) or 0) > 0.5, str(B.evaluate(hoja)))
            for pg in (A, B): pg.evaluate('window.__rehacerTodo = false')
        piezasAntes = piezas(A)   # con el portillo

        print('Salir al menú y volver: sigue siendo el mismo')
        yoB = B.evaluate(f"{K}.enLinea.red.yo")
        B.click('#btnDemoMenu'); B.wait_for_function('window.__demo && window.__demo.listo')
        B.click('#demoEnLinea'); B.wait_for_load_state('load')
        # La página se carga entera otra vez: sin tarjeta gráfica, conectar tardó a veces más de 20 s (medido el 28 oct: 27 s).
        comprobar('el móvil vuelve a entrar en línea', esperar(B, 'window.__demo && window.__demo.listo', 60000) and esperar(B, f"{K}.enLinea && {K}.enLinea.estado === 'conectado'", 60000))
        comprobar('con el mismo personaje (mismo autor)', B.evaluate(f"{K}.enLinea.red.yo") == yoB, B.evaluate(f"{K}.enLinea.red.yo"))
        B.evaluate(f"Object.assign({K}.pj, {{ x: -1.0, z: 5.0, rot: -Math.PI * 0.25 }})")
        comprobar('PC sigue viendo a uno solo, no a uno más', esperar(A, f"{K}.enLinea.remotos.size === 1", 8000) and A.wait_for_timeout(1500) is None and A.evaluate(f"{K}.enLinea.remotos.size") == 1
                   and '1 más' in A.inner_text('#estadoRed'), A.inner_text('#estadoRed'))

        print('El servidor se apaga y vuelve')
        servidor.terminate(); servidor.wait(5)
        comprobar('PC dice que se ha cortado y que vuelve a conectar', esperar(A, "document.getElementById('estadoRed').textContent === 'Volviendo a conectar…'", 5000) and 'volviendo a conectar' in A.inner_text('#aviso'), A.inner_text('#aviso'))
        comprobar('y ya no ve al otro', A.evaluate(f"{K}.enLinea.remotos.size") == 0)
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','cim_piedra'); {K}.apuntar(5,1); {K}.colocar()")
        comprobar('sin conexión no se construye', piezas(A) == piezasAntes and 'conexión' in A.inner_text('#aviso'), A.inner_text('#aviso'))
        A.evaluate(f"{K}.cambiarModo('mover')")
        A.screenshot(path=f'{SALIDA}/pc_4_sin_conexion.png')
        B.screenshot(path=f'{SALIDA}/movil_4_sin_conexion.png')
        servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), ARCHIVO], cwd=RAIZ,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        servidor.stdout.readline()
        for nombre, pg, yo in [('PC', A, yoA), ('el móvil', B, yoB)]:
            comprobar(f'{nombre} vuelve a conectar solo, sin recargar', esperar(pg, f"{K}.enLinea.estado === 'conectado'", 20000))
            comprobar(f'{nombre} sigue con el mismo personaje (la ficha vale tras reiniciar el servidor)', pg.evaluate(f"{K}.enLinea.red.yo") == yo)
        comprobar('PC avisa de que ha vuelto', 'recuperada' in A.inner_text('#aviso'), A.inner_text('#aviso'))
        comprobar('el mundo es el de antes', piezas(A) == piezasAntes and foto(A) == foto(B))
        comprobar('y se vuelven a ver', esperar(A, f"{K}.enLinea.remotos.size === 1", 8000) and esperar(B, f"{K}.enLinea.remotos.size === 1", 8000))
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','cim_piedra'); {K}.apuntar(5,1); {K}.colocar(); {K}.cambiarModo('mover')")
        comprobar('y se puede construir otra vez', esperar(A, f"{K}.enLinea.red.pendientes.length === 0", 8000) and piezas(A) == piezasAntes + 1, f'{piezas(A)} piezas')
        A.wait_for_timeout(800)
        A.screenshot(path=f'{SALIDA}/pc_5_vuelve.png')
        B.screenshot(path=f'{SALIDA}/movil_5_vuelve.png')
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
