# Prueba en navegador del pozo en el juego (P11b, «El pozo (2), en el juego»), en línea con un servidor local y dos
# jugadores. Uso: python3 pruebas/prueba_pozo_navegador.py <html de la demo> <carpeta_capturas>
# En PC (1280×800), un jugador pone su mojón en la zona de al lado de la salida y coge la pala de madera: con ella en la
# mano, Usar no ofrece marcar un pozo (valravnx, 15 nov: «la pala se usa para más cosas»). El pozo se marca desde
# construir (pestaña Tierra, «Pozo»): el aviso dice a qué hondura está el agua donde apuntas (la del servidor, la que
# sale del terreno) y, al marcarlo, se ven el círculo raspado y la estaca. Junto al pozo, Usar cava a golpes de pala hasta acabar el
# tramo (sin revestirlo no deja bajar más); con piedras, Usar lo reviste (pocas: se ve el montoncito de las puestas);
# así hasta el agua. Se ven la boca con sus tramos de tierra y de piedra, la hilada de arriba, el montón de tierra sacada
# y, al final, el agua del fondo. En el móvil (390×844), el otro jugador lo ve igual.
# La pala y las piedras salen del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba el pozo en el juego; la lógica
# y el servidor, en pruebas/prueba_pozo.mjs.
# MUTAR=1 tira los mensajes de las acciones del pozo que manda la página (como si fuera solo del navegador): falla.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_pozo'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)
s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
OBJETOS = os.path.join(sitio, 'objetos.json')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_ARCON': 'si', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_TIEMPO': 'seco'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)
URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(n, c, d=''):
    print(('  OK   ' if c else '  FALLA ') + n + (f' — {d}' if d else ''))
    if not c: fallos.append(n)
def esperar(pg, cond, ms=20000):
    try: pg.wait_for_function(cond, timeout=ms, polling=250); return True
    except Exception: return False
def servidorDice(f, ms=15000):
    fin = time.time() + ms / 1000
    while True:
        try:
            d = json.load(open(OBJETOS))
            if f(d): return d
        except Exception: pass
        if time.time() > fin: return None
        time.sleep(0.25)
def cuantos(d, autor, tipo):
    j = d['inventarios']['jugadores'].get(autor)
    n = [0]
    def rec(c):
        if isinstance(c, dict):
            if c.get('tipo') == tipo: n[0] += c.get('n', 1)
            for v in c.values(): rec(v)
        elif isinstance(c, list):
            for v in c: rec(v)
    rec(j)
    return n[0]
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
_n = [0]
def crear_cuenta(pg, ms=10000):
    try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=ms)
    except Exception: return False
    _n[0] += 1
    return crear_y_confirmar(pg, codigos, f'pocero{_n[0]}', 'clave-de-prueba-123')
def entrar(nav, nombre, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    if MUTAR:
        ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
          WebSocket.prototype.send = function (d) { if (String(d).includes('"tipo":"accion"') && /"tipo":"(pozo|cavar_pozo|revestir_pozo|rematar_pozo)"/.test(String(d))) return; return s.call(this, d); }; })()""")
    # el tiempo, sin llover (como el servidor, KINHOLD_PRUEBAS_TIEMPO): lo regado y lo mustio, igual en todos (P11b)
    ctx.add_init_script("globalThis.__tiempo = 'seco';")
    pg = ctx.new_page(); err = []
    pg.on('pageerror', lambda e, err=err: err.append(str(e)))
    pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
    esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo", 300000)
    crear_cuenta(pg, 60000)   # (en el móvil de la nube la pantalla de la cuenta tarda en salir)
    comprobar(f'{nombre}: entra y le llega lo que lleva en el servidor', esperar(pg, f"{K}.enLinea.red.yo && {K}.objetosRed.deServidor", 120000), str(err[:2]))
    comprobar(f'{nombre}: sin la pantalla de la cuenta delante', esperar(pg, "!document.getElementById('pantallaCuenta') || document.getElementById('pantallaCuenta').hidden || getComputedStyle(document.getElementById('pantallaCuenta')).display === 'none'", 30000))
    return ctx, pg, err
def lineas_mundo():
    try: return [json.loads(l) for l in open(os.path.join(sitio, 'mundo.jsonl')) if l.strip()]
    except Exception: return []
def servidorMundo(f, ms=15000):
    fin = time.time() + ms / 1000
    while True:
        l = lineas_mundo()
        if f(l): return l
        if time.time() > fin: return None
        time.sleep(0.25)
def estacas_ok(l): return [e for e in l if e.get('tipo') == 'estaca' and e.get('ok')]
def ir(pg, x, z, rot=None):
    pg.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {x}, z: {z}{', rot: ' + str(rot) if rot is not None else ''} }}); }})()")
    pg.wait_for_timeout(700)   # (que el servidor sepa dónde está)
def usar(pg):
    pg.keyboard.press('f'); pg.wait_for_timeout(500)
def texto_usar(pg):
    return pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : ''; }})()")
AVISO = "document.getElementById('aviso').textContent"
def coger(pg, objeto, n, a):
    r = pg.evaluate(f"""(() => {{ const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{objeto}', cantidad: {n}, a: '{a}' }}); return r && r.ok === false ? r.motivo : ''; }})()""")
    if r: print(f'  (coger {n} {objeto} a {a}: {r})')
    return not r
def soltar_manos(pg):
    pg.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.accion({{ tipo: 'dejar_arcon', de: m, cantidad: l[m].n }}); }})()"); pg.wait_for_timeout(600)
def sitio_pozo():
    # en la zona de al lado de la salida, al oeste: un sitio llano y seco, sin nada alrededor, donde el agua no pase del tope
    js = """import { terrenoWhitholm } from './src/logica/terreno_servidor.js';
import { honduraEn } from './src/logica/pozo.js';
const T = terrenoWhitholm(), zs = T.zona(0, 4);
const pend = (x, z) => Math.hypot(T.suelo(x + 1.5, z) - T.suelo(x - 1.5, z), T.suelo(x, z + 1.5) - T.suelo(x, z - 1.5)) / 3;
for (let r = 20; r < 3000; r += 10) { const id = T.zona(-r, 4); if (id === null || id === zs || T.esZonaRey(id)) continue;
  let mejor = null;
  for (let dx = -40; dx > -500; dx -= 9) for (let dz = -150; dz < 150; dz += 9) {
    const x = -r + dx, z = 4 + dz; if (T.zona(x, z) !== id || !T.enIsla(x, z)) continue;
    let bien = true;
    for (let i = -8; i <= 4 && bien; i++) for (let j = -4; j <= 4 && bien; j++) if (T.zona(x + i, z + j) !== id || T.aguaEn(x + i, z + j) !== null || pend(x + i, z + j) > 0.15) bien = false;
    if (!bien) continue;
    const q = T.cercaDe(x, z, 5); if (q.arboles.length || q.matas.length || q.piedras.length) continue;
    const h = honduraEn(T, x, z); if (h === null) continue;
    if (!mejor || h < mejor.h) mejor = { x, z, h };
  }
  console.log(JSON.stringify(mejor)); process.exit(0); }
console.log('null');"""
    out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=600).stdout.strip().splitlines()
    return json.loads(out[-1]) if out else None
def pozo(pg): return pg.evaluate(f"JSON.stringify(({K}.mundo.pozos || [])[0] || null)")
def ver(pg, x, z, yaw, dist, pitch, ruta, ms=2500):
    pg.evaluate(f"{K}.cam.yaw = {yaw}; {K}.cam.dist = {dist}; {K}.cam.pitch = {pitch}"); pg.wait_for_timeout(ms)
    captura(pg, ruta)

try:
    S0 = sitio_pozo()
    comprobar('hay un sitio llano y seco para el pozo en la zona de al lado', S0 is not None, str(S0))
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")
        x0, z0, H = S0['x'], S0['z'], S0['h']
        TR = int(-(-H // 1))   # tramos: hasta el agua, de 1 m
        print(f'Sitio del pozo: ({x0}, {z0}), agua a {H} m ({TR} tramos)')

        print('Pone su mojón cerca')
        ir(A, x0 - 6, z0); A.wait_for_timeout(800)
        A.evaluate(f"{K}.llevarPara('mojon', 'mojon')"); A.wait_for_timeout(800)
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon')")
        A.evaluate(f"(() => {{ const x = {K}.pj.x - 1, z = {K}.pj.z; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        comprobar('pone su mojón (en el servidor)', esperar(A, f"!!{K}.miMojon", 15000), A.evaluate(AVISO))
        A.evaluate(f"{K}.cambiarModo('mover')")
        soltar_manos(A)

        print('Con la pala de madera en la mano, no sale «Marcar aquí un pozo» (valravnx, 15 nov)')
        coger(A, 'pala_madera', 1, 'mano:der')
        comprobar('lleva la pala de madera en la mano', esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'pala_madera'", 8000))
        ir(A, x0 - 0.9, z0, 1.5708); A.wait_for_timeout(500)
        comprobar('con la pala en la mano, en su tierra, Usar no ofrece marcar un pozo', 'pozo' not in texto_usar(A).lower(), texto_usar(A))
        usar(A); A.wait_for_timeout(800)
        comprobar('y Usar con la pala no marca ninguno', A.evaluate(f"({K}.mundo.pozos || []).length") == 0, pozo(A))

        print('Marca el pozo desde construir (pestaña Tierra)')
        A.evaluate(f"{K}.cambiarModo('construir')")
        A.evaluate("[...document.querySelectorAll('#pestanas button')].find(b => b.dataset.cat === 'tierra').click()"); A.wait_for_timeout(400)
        nb = A.evaluate("[...document.querySelectorAll('#piezas button')].map(b => b.textContent).join(' | ')")
        comprobar('en construir, pestaña Tierra, está el pozo', 'Pozo' in nb, nb)
        A.evaluate("[...document.querySelectorAll('#piezas button')].find(b => b.textContent.startsWith('Pozo')).click()"); A.wait_for_timeout(400)
        comprobar('elegido el pozo', A.evaluate(f"{K}.estado.sel.clase") == 'pozo', A.evaluate(f"JSON.stringify({K}.estado.sel)"))
        A.evaluate(f"{K}.apuntar({x0}, {z0}, {K}.alturaSuelo({x0}, {z0}))"); A.wait_for_timeout(500)
        hs = str(H).replace('.', ',')
        comprobar(f'antes de marcarlo, el aviso dice a qué hondura está el agua ahí ({hs} m)', esperar(A, f"{AVISO}.includes('a unos {hs} m') && {AVISO}.includes('{TR} tramos')", 5000), A.evaluate(AVISO))
        comprobar('se ve el fantasma del pozo', A.evaluate(f"(() => {{ let v = false; {K}.escena.traverse(o => {{ if (o.userData && o.userData.fantasma && o.visible) v = true; }}); return v; }})()"))
        A.add_style_tag(content='#menuUsar { visibility: hidden !important; }')
        A.evaluate(f"{K}.cam.yaw = {1.1 + 3.1416}; {K}.cam.dist = 6; {K}.cam.pitch = 0.6"); A.wait_for_timeout(2000)
        captura(A, f'{SALIDA}/PC_construir_pozo.png')
        A.evaluate(f"{K}.colocar()"); A.wait_for_timeout(500)
        l = servidorMundo(lambda l: any(e.get('tipo') == 'pozo' and e.get('ok') for e in l))
        e = next((e for e in (l or []) if e.get('tipo') == 'pozo' and e.get('ok')), None)
        comprobar('el pozo se marca en el servidor, con la hondura del terreno', e is not None and abs(((e.get('datos') or {}).get('hondura') or 0) - H) < 0.05, json.dumps(e)[:300] if e else A.evaluate(AVISO))
        comprobar(f'el aviso dice a qué hondura está el agua ({hs} m, {TR} tramos) y que se cava con la pala', esperar(A, f"{AVISO}.includes('a unos {hs} m') && {AVISO}.includes('{TR} tramos') && {AVISO}.includes('pala')", 5000), A.evaluate(AVISO))
        comprobar('y vuelve a moverse (para ir a cavarlo)', A.evaluate(f"{K}.estado.modo") == 'mover')
        comprobar('en el navegador, el pozo donde apuntó', esperar(A, f"({K}.mundo.pozos || []).length === 1 && Math.hypot({K}.mundo.pozos[0].x - {x0}, {K}.mundo.pozos[0].z - {z0}) < 0.1", 8000), pozo(A))
        comprobar('se dibuja su boca', esperar(A, f"!!{K}.escena.getObjectByName('boca_pozo')", 8000))
        A.evaluate(f"{K}.cambiarModo('construir')"); A.evaluate(f"{K}.seleccionar('pozo', 'pozo')")
        A.evaluate(f"{K}.apuntar({x0} + 1.5, {z0}, {K}.alturaSuelo({x0} + 1.5, {z0}))"); A.wait_for_timeout(300)
        comprobar('pegado a otro pozo, construir no deja marcar otro', A.evaluate(f"{K}.estado.candidato.v.ok") is False and 'ya hay un pozo' in A.evaluate(AVISO), A.evaluate(AVISO))
        A.evaluate(f"{K}.cambiarModo('mover')")
        ir(A, x0 - 2.2, z0 - 1.2, 1.1)
        ver(A, x0, z0, 1.1 + 3.1416, 3.2, 0.6, f'{SALIDA}/PC_pozo_marcado_de_cerca.png')

        print('Cava el primer tramo con la pala')
        ir(A, x0 - 1.3, z0, 1.5708)
        comprobar(f'junto al pozo, Usar dice «Cavar el pozo: tramo 1 de {TR}»', texto_usar(A) == f'Cavar el pozo: tramo 1 de {TR}', texto_usar(A))
        A.evaluate(f"{K}.usar()")
        comprobar('Usar empieza a cavar', A.evaluate(f"!!({K}.estado.talando && {K}.estado.talando.pozo)"))
        for g in range(10):
            A.evaluate(f"if ({K}.estado.talando) {K}.estado.golpeEn = 0"); A.wait_for_timeout(350)
        l = servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'cavar_pozo' and e.get('ok')) >= 10, 20000)
        comprobar('diez golpes de pala, seguidos, en el servidor', l is not None, A.evaluate(AVISO))
        comprobar('acaba el tramo y para de cavar', esperar(A, f"!{K}.estado.talando && {K}.mundo.pozos[0].cavados === 1", 8000), pozo(A))
        comprobar('el aviso pide revestirlo de piedra antes de bajar', esperar(A, f"/Tramo 1 cavado: revístelo de piedra/.test({AVISO})", 5000), A.evaluate(AVISO))
        comprobar(f'Usar dice «Revestir de piedra el tramo 1 de {TR} (0 de 8 piedras)»', texto_usar(A) == f'Revestir de piedra el tramo 1 de {TR} (0 de 8 piedras)', texto_usar(A))
        comprobar('sin revestir, el servidor no deja bajar más', A.evaluate(f"(() => {{ const r = {K}.accion({{ tipo: 'cavar_pozo', pozo: {K}.mundo.pozos[0].id }}); return r.ok ? 'cavó' : r.motivo; }})()").startswith('Reviste antes de piedra'))
        ir(A, x0 - 2.2, z0 - 1.2, 1.1)
        ver(A, x0, z0, 1.1 + 3.1416, 3.2, 0.75, f'{SALIDA}/PC_pozo_tramo_cavado_de_cerca.png')

        print('Lo reviste de piedra (primero con pocas)')
        coger(A, 'piedra', 3, 'mano:izq')
        esperar(A, f"{K}.inventario.cuantos('piedra') === 3", 8000)
        ir(A, x0 - 1.3, z0, 1.5708)
        usar(A)
        comprobar('pone las 3 piedras que lleva (faltan 5)', esperar(A, f"{K}.mundo.pozos[0].piedras === 3 && /faltan 5/.test({AVISO})", 8000), pozo(A) + ' · ' + A.evaluate(AVISO))
        ir(A, x0 - 2.2, z0 + 1.4, 2.2)
        ver(A, x0, z0, 2.2 + 3.1416, 3.2, 0.7, f'{SALIDA}/PC_pozo_piedras_puestas_de_cerca.png')

        print(f'Y así hasta el agua ({TR} tramos)')
        ir(A, x0 - 1.3, z0, 1.5708)
        def revestir_entero():
            for _ in range(12):
                if A.evaluate(f"{K}.mundo.pozos[0].revestidos >= {K}.mundo.pozos[0].cavados"): return True
                if A.evaluate(f"{K}.inventario.cuantos('piedra')") == 0:
                    coger(A, 'piedra', 3, 'mano:izq')   # (en una mano caben 3)
                    esperar(A, f"{K}.inventario.cuantos('piedra') > 0", 8000)
                n = A.evaluate(f"{K}.mundo.pozos[0].revestidos")
                usar(A)
                esperar(A, f"{K}.mundo.pozos[0].revestidos > {n} || {K}.mundo.pozos[0].piedras > 0", 6000)
            return A.evaluate(f"{K}.mundo.pozos[0].revestidos >= {K}.mundo.pozos[0].cavados")
        comprobar('tramo 1 revestido', revestir_entero(), pozo(A) + ' · ' + A.evaluate(AVISO))
        for t in range(2, TR + 1):
            A.evaluate(f"(() => {{ const id = {K}.mundo.pozos[0].id; for (let i = 0; i < 10; i++) {K}.accion({{ tipo: 'cavar_pozo', pozo: id }}); }})()")
            ok = esperar(A, f"{K}.mundo.pozos[0].cavados === {t}", 10000)
            ok = ok and revestir_entero()
            if not ok: comprobar(f'tramo {t}, cavado y revestido', False, pozo(A) + ' · ' + A.evaluate(AVISO)); break
            if t == min(3, TR - 1):
                ir(A, x0 - 2.2, z0 - 1.2, 1.1)
                ver(A, x0, z0, 1.1 + 3.1416, 3.0, 0.85, f'{SALIDA}/PC_pozo_tres_tramos_de_cerca.png')
                ir(A, x0 - 1.3, z0, 1.5708)
        # en el servidor: 10 golpes por tramo y 8 piedras puestas por tramo, hasta el agua
        l = servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'cavar_pozo' and e.get('ok')) >= 10 * TR and sum((e.get('datos') or {}).get('piedras') or 0 for e in l if e.get('tipo') == 'revestir_pozo' and e.get('ok')) >= 8 * TR, 15000)
        comprobar(f'en el servidor: {10 * TR} golpes de pala y {8 * TR} piedras, hasta el agua', l is not None, str(sum(1 for e in lineas_mundo() if e.get('tipo') == 'cavar_pozo' and e.get('ok'))))
        comprobar('el aviso lo dice', esperar(A, f"/ya tiene agua/.test({AVISO})", 8000), A.evaluate(AVISO))
        comprobar('Usar pide el brocal: «Levantar el brocal de piedra (0 de 12 piedras)»', texto_usar(A) == 'Levantar el brocal de piedra (0 de 12 piedras)', texto_usar(A))
        n_tierra = A.evaluate(f"(() => {{ const r = {K}.escena.getObjectByName('pozos'); let n = 0; if (r) r.traverse(o => {{ if (o.isMesh) n++; }}); return n; }})()")
        comprobar('se dibujan la boca, la piedra y el montón de tierra', n_tierra >= 2, str(n_tierra))
        ir(A, x0 - 2.2, z0 - 1.2, 1.1)
        ver(A, x0, z0, 1.1 + 3.1416, 2.8, 0.95, f'{SALIDA}/PC_pozo_con_agua_de_cerca.png')
        ver(A, x0, z0, 1.1 + 3.1416, 9, 0.6, f'{SALIDA}/PC_pozo_con_agua.png')

        print('El pozo (3): el brocal, el travesaño y sacar agua')
        ir(A, x0 - 1.3, z0, 1.5708)
        for _ in range(8):
            b = A.evaluate(f"{K}.mundo.pozos[0].brocal || 0")
            if b >= 12: break
            if A.evaluate(f"{K}.inventario.cuantos('piedra')") == 0:
                coger(A, 'piedra', 3, 'mano:izq'); esperar(A, f"{K}.inventario.cuantos('piedra') > 0", 8000)
            usar(A)
            esperar(A, f"({K}.mundo.pozos[0].brocal || 0) > {b}", 6000)
            if b < 6 <= A.evaluate(f"{K}.mundo.pozos[0].brocal || 0"):
                ir(A, x0 - 2.2, z0 - 1.2, 1.1)
                ver(A, x0, z0, 1.1 + 3.1416, 3.0, 0.8, f'{SALIDA}/PC_pozo_brocal_a_medias_de_cerca.png')
                ir(A, x0 - 1.3, z0, 1.5708)
        comprobar('el brocal, entero (12 piedras), y el aviso pide el travesaño', esperar(A, f"{K}.mundo.pozos[0].brocal === 12 && /falta el travesaño/.test({AVISO})", 8000), pozo(A) + ' · ' + A.evaluate(AVISO))
        comprobar('Usar dice «Poner el travesaño (3 varas y una cuerda)»', texto_usar(A) == 'Poner el travesaño (3 varas y una cuerda)', texto_usar(A))
        usar(A)
        comprobar('sin las varas y la cuerda, no se pone (y el aviso lo dice)', esperar(A, f"/hacen falta 3 varas y una cuerda/.test({AVISO})", 5000) and not A.evaluate(f"!!{K}.mundo.pozos[0].travesano"), A.evaluate(AVISO))
        soltar_manos(A); esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000)
        coger(A, 'vara', 3, 'mano:der'); coger(A, 'cuerda', 1, 'mano:izq')
        esperar(A, f"{K}.inventario.cuantos('vara') === 3 && {K}.inventario.cuantos('cuerda') === 1", 8000)
        usar(A)
        comprobar('con 3 varas y la cuerda, el travesaño puesto: ya se saca agua', esperar(A, f"!!{K}.mundo.pozos[0].travesano && /ya se saca agua/.test({AVISO})", 8000), pozo(A) + ' · ' + A.evaluate(AVISO))
        l = servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'rematar_pozo' and e.get('ok')) >= 2, 15000)
        comprobar('en el servidor: el brocal y el travesaño, con su autor', l is not None and all(e.get('autor') == yo for e in l if e.get('tipo') == 'rematar_pozo'), str([e for e in lineas_mundo() if e.get('tipo') == 'rematar_pozo'][-2:]))
        soltar_manos(A); esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 8000)
        coger(A, 'cubo', 1, 'mano:der'); esperar(A, f"{K}.inventario.cuantos('cubo') === 1", 8000)
        comprobar('con el cubo vacío, Usar dice «Sacar agua del pozo» (sin río cerca)', texto_usar(A) == 'Sacar agua del pozo', texto_usar(A))
        usar(A)
        comprobar('saca del pozo un cubo de agua (lo llena el servidor)', esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'cubo_agua' && /Sacas del pozo/.test({AVISO})", 8000) and servidorDice(lambda d: cuantos(d, yo, 'cubo_agua') == 1) is not None, A.evaluate(AVISO))
        ir(A, x0 - 2.2, z0 - 1.2, 1.1)
        ver(A, x0, z0, 1.1 + 3.1416, 3.4, 0.55, f'{SALIDA}/PC_pozo_rematado_de_cerca.png')
        ver(A, x0, z0, 2.4 + 3.1416, 2.6, 0.25, f'{SALIDA}/PC_pozo_rematado_de_lado.png')
        ver(A, x0, z0, 1.1 + 3.1416, 9, 0.6, f'{SALIDA}/PC_pozo_rematado.png')

        print('El otro jugador, en el móvil, lo ve')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        ir(B, x0 + 2.0, z0 + 1.2, -2.1)
        comprobar('le llega el pozo, rematado', esperar(B, f"({K}.mundo.pozos || []).length === 1 && {K}.mundo.pozos[0].revestidos === {TR} && !!{K}.mundo.pozos[0].travesano", 45000), B.evaluate(f"JSON.stringify({K}.mundo.pozos || null)"))
        comprobar('y ve su boca', esperar(B, f"!!{K}.escena.getObjectByName('boca_pozo')", 20000))
        B.add_style_tag(content='#menuUsar { visibility: hidden !important; }')
        # (al llegar el pozo se quita la hierba de su boca: la de alrededor se rehace poco a poco; se espera a que esté; en el
        # móvil de la nube, su perfil gráfico no lleva hierba densa: entonces se espera a que cargue lo de alrededor)
        comprobar('la hierba de alrededor vuelve a estar (solo falta en la boca)', esperar(B, f"!{K}.hierbaDensa || !{K}.hierbaDensa.activa || ({K}.hierbaDensa.porRehacer === 0 && {K}.hierbaDensa.cuenta.matas > 0)", 90000), B.evaluate(f"{K}.hierbaDensa ? JSON.stringify([{K}.hierbaDensa.porRehacer, {K}.hierbaDensa.cuenta]) : 'sin hierba densa'"))
        B.wait_for_timeout(15000)
        ver(B, x0, z0, -2.1 + 3.1416, 3.4, 0.55, f'{SALIDA}/movil_pozo_rematado_de_cerca.png', 3000)
        ver(B, x0, z0, -2.1 + 3.1416, 9, 0.6, f'{SALIDA}/movil_pozo_rematado.png')
        print('En el móvil, el pozo está en construir, pestaña Tierra')
        B.evaluate(f"{K}.cambiarModo('construir')")
        B.evaluate("[...document.querySelectorAll('#pestanas button')].find(b => b.dataset.cat === 'tierra').click()"); B.wait_for_timeout(400)
        B.evaluate("[...document.querySelectorAll('#piezas button')].find(b => b.textContent.startsWith('Pozo')).click()"); B.wait_for_timeout(400)
        comprobar('móvil: en construir, pestaña Tierra, se elige el pozo', B.evaluate(f"{K}.estado.sel.clase") == 'pozo', B.evaluate(f"JSON.stringify({K}.estado.sel)"))
        B.evaluate(f"{K}.apuntar({x0} + 2, {z0} + 1, {K}.alturaSuelo({x0} + 2, {z0} + 1))"); B.wait_for_timeout(1500)
        captura(B, f'{SALIDA}/movil_construir_pozo.png')
        B.evaluate(f"{K}.cambiarModo('mover')")
        comprobar('a él no le deja cavar en el pozo de otro', B.evaluate(f"(() => {{ const r = {K}.accion({{ tipo: 'revestir_pozo', pozo: {K}.mundo.pozos[0].id }}); return r.ok ? 'sí' : r.motivo; }})()") != 'sí')

        for nombre, err in [('PC', errA), ('móvil', errB)]:
            malos = [e for e in err if 'WebSocket' not in e and 'ERR_CONNECTION_REFUSED' not in e]
            comprobar(f'{nombre}: sin errores en la consola', not malos, str(malos[:3]))
        nav.close()
finally:
    if servidor.poll() is None: servidor.terminate()
    web.shutdown()
    shutil.rmtree(sitio, ignore_errors=True)

print(f"\n{'TODO CORRECTO' if not fallos else str(len(fallos)) + ' FALLOS'}")
sys.exit(1 if fallos else 0)
