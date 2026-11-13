# Prueba en navegador de marcar el campo con estacas (P11, la granja básica), en línea con un servidor local y dos
# jugadores. Uso: python3 pruebas/prueba_campos_navegador.py <html de la demo> <carpeta_capturas>
# En PC (1280×800), un jugador pone su mojón en la zona de al lado de la salida (la de la salida es del rey), se hace
# una estaca con 1 rama desde el panel de fabricar (con las manos) y, con estacas en la mano, va clavándolas con Usar
# (F) en las cuatro esquinas de un campo de 12 × 10 m; la quinta, junto a la primera, lo cierra (sin gastar otra) y el
# servidor lo guarda con su superficie (120 m²). Se ven las estacas clavadas y el linde de tierra pisada. Junto a una
# estaca, Usar la quita (vuelve a la mano) y el campo queda abierto; clavada otra vez, se cierra de nuevo. Fuera de su
# tierra no se clava. Con la azada, Usar labra un círculo de tierra delante de él (P11), lo guarda el servidor con su hora y
# se ve la tierra labrada; labrado, las estacas ya no se quitan. Con las semillas en la mano, se siembra la cebada a voleo y
# se plantan las habas, la col y el nabo (P11), y se ven sus fases; lo maduro se siega con la hoz (gavillas al suelo) o se
# coge a mano. En el móvil (390×844), el otro jugador lo ve igual.
# Las ramas y las estacas de más salen del arcón de pruebas (KINHOLD_PRUEBAS_ARCON): esto prueba los campos en el
# juego; la lógica y el servidor, en pruebas/prueba_campos.mjs.
# MUTAR=1 tira los mensajes de acciones que manda la página (como si el campo fuera solo del navegador): falla.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_campos'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = bool(os.environ.get('MUTAR'))

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)
s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
OBJETOS = os.path.join(sitio, 'objetos.json')
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_ARCON': 'si', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_HORA': 'campos'},
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
    return crear_y_confirmar(pg, codigos, f'labrador{_n[0]}', 'clave-de-prueba-123')
def entrar(nav, nombre, vista, movil):
    ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
    if MUTAR:
        ctx.add_init_script("""(() => { const s = WebSocket.prototype.send;
          WebSocket.prototype.send = function (d) { if (String(d).includes('"tipo":"accion"')) return; return s.call(this, d); }; })()""")
    pg = ctx.new_page(); err = []
    pg.on('pageerror', lambda e, err=err: err.append(str(e)))
    pg.on('console', lambda m, err=err: err.append(m.text) if m.type == 'error' else None)
    pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
    esperar(pg, f"{K} && {K}.enLinea && {K}.enLinea.estado === 'conectado' && {K}.mundoListo", 300000)
    crear_cuenta(pg, 60000)   # (en el móvil de la nube la pantalla de la cuenta tarda en salir)
    comprobar(f'{nombre}: entra y le llega lo que lleva en el servidor', esperar(pg, f"{K}.enLinea.red.yo && {K}.objetosRed.deServidor", 120000), str(err[:2]))
    comprobar(f'{nombre}: sin la pantalla de la cuenta delante', esperar(pg, "!document.getElementById('pantallaCuenta') || document.getElementById('pantallaCuenta').hidden || getComputedStyle(document.getElementById('pantallaCuenta')).display === 'none'", 30000))
    return ctx, pg, err
TEXTO = "document.getElementById('panelFabricar').innerText"
def fila(pg, clave):
    return pg.evaluate(f"(() => {{ const f = document.querySelector('#panelFabricar [data-fila=\"{clave}\"]'); return f ? {{ cls: f.className, txt: f.innerText, sec: f.closest('section').className }} : null; }})()")
def elegir(pg, clave):   # toca la carta y devuelve el texto de su ficha
    pg.evaluate(f"(() => {{ const f = document.querySelector('#panelFabricar .fab-carta[data-fila=\"{clave}\"]'); if (f) f.click(); }})()")
    pg.wait_for_timeout(250)
    return pg.evaluate("document.querySelector('#panelFabricar .fab-ficha').innerText")
def pestana(pg, k):
    pg.evaluate(f"document.querySelector('#panelFabricar .fab-pest[data-pestana=\"{k}\"]').click()"); pg.wait_for_timeout(250)



def coger(pg, objeto, n, a):
    r = pg.evaluate(f"""(() => {{ const l = {K}.inventario.lugares, a = !l['{a}'] ? '{a}' : ['mano:der', 'mano:izq'].find(m => !l[m]);
      if (!a) return 'manos llenas: ' + JSON.stringify([l['mano:der'], l['mano:izq']]);
      const r = {K}.accionInventario({{ tipo: 'coger', objeto: '{objeto}', cantidad: {n}, a }}); return r && r.ok === false ? r.motivo : ''; }})()""")
    if r: print(f'  (coger {n} {objeto}: {r})')
def sitio_campo():
    # en la zona de al lado de la salida, al oeste: un rectángulo de 12 × 10 m en seco, llano y todo de la misma zona
    js = """import { terrenoWhitholm } from './src/logica/terreno_servidor.js';
const T = terrenoWhitholm(), zs = T.zona(0, 4);
const pend = (x, z) => Math.hypot(T.suelo(x + 1.5, z) - T.suelo(x - 1.5, z), T.suelo(x, z + 1.5) - T.suelo(x, z - 1.5)) / 3;
for (let r = 20; r < 3000; r += 10) { const id = T.zona(-r, 4); if (id === null || id === zs || T.esZonaRey(id)) continue;
  for (let dx = -40; dx > -400; dx -= 7) for (let dz = -60; dz < 60; dz += 7) {
    const x0 = -r + dx, z0 = 4 + dz; let bien = true;
    for (let i = -2; i <= 14 && bien; i += 1) for (let j = -2; j <= 12 && bien; j += 1) { const x = x0 + i, z = z0 + j; if (T.zona(x, z) !== id || T.aguaEn(x, z) !== null || pend(x, z) > 0.2 || !T.enIsla(x, z)) bien = false; }
    // (y nada por limpiar en medio, para labrarlo: P11)
    if (bien) { const q = T.cercaDe(x0 + 6, z0 + 5, 6); if (q.arboles.length || q.matas.length || q.piedras.length) bien = false; }
    if (bien) { console.log(JSON.stringify({ x: x0, z: z0 })); process.exit(0); } }
  break; }
console.log('null');"""
    out = subprocess.run(['node', '--input-type=module', '-e', js], cwd=RAIZ, capture_output=True, text=True, timeout=600).stdout.strip().splitlines()
    return json.loads(out[-1])
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

try:
    S0 = sitio_campo()
    comprobar('hay un sitio llano y seco para el campo en la zona de al lado', S0 is not None)
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        ctxA, A, errA = entrar(nav, 'PC', {'width': 1280, 'height': 800}, False)
        yo = A.evaluate(f"{K}.enLinea.red.yo")
        x0, z0 = S0['x'], S0['z']

        print('Pone su mojón junto al campo')
        ir(A, x0 - 1, z0 + 5); A.wait_for_timeout(800)
        A.evaluate(f"{K}.llevarPara('mojon', 'mojon')"); A.wait_for_timeout(800)
        A.evaluate(f"{K}.cambiarModo('construir'); {K}.seleccionar('mojon', 'mojon')")
        A.evaluate(f"(() => {{ const x = {K}.pj.x - 1, z = {K}.pj.z; {K}.apuntar(x, z, {K}.alturaSuelo(x, z)); {K}.colocar(); }})()")
        comprobar('pone su mojón (en el servidor)', esperar(A, f"!!{K}.miMojon", 15000), A.evaluate(AVISO))
        A.evaluate(f"{K}.cambiarModo('mover')")
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.accion({{ tipo: 'dejar_arcon', de: m, cantidad: l[m].n }}); }})()"); A.wait_for_timeout(500)

        print('Se hace una estaca con 1 rama, con las manos')
        coger(A, 'rama', 1, 'mano:der')
        servidorDice(lambda d: cuantos(d, yo, 'rama') == 1)
        A.keyboard.press('h'); A.wait_for_timeout(400)
        esperar(A, "!!document.querySelector('#panelFabricar .fab-carta[data-fila=\"estaca\"]')", 8000)
        t = elegir(A, 'estaca')
        comprobar('en el panel: la estaca, con 1 rama y para qué sirve', '1' in t and 'Rama' in t and 'Marca el campo' in t, t[:200])
        comprobar('con su imagen, que carga', esperar(A, "(() => { const i = document.querySelector('#panelFabricar .fab-carta[data-fila=\"estaca\"] img'); return !!i && i.complete && i.naturalWidth > 0 && /\\/estaca\\.webp/.test(i.src); })()", 8000))
        captura(A, f'{SALIDA}/PC_panel_estaca.png')
        A.click('#panelFabricar .fab-ficha .fab-hacer')
        comprobar('terminada, sale «Recoger»', esperar(A, "!!document.querySelector('#panelFabricar .fab-recoger')", 30000))
        A.click('#panelFabricar .fab-recoger')
        comprobar('y la estaca es suya en el servidor (la rama, gastada)', servidorDice(lambda d: cuantos(d, yo, 'estaca') == 1 and cuantos(d, yo, 'rama') == 0) is not None)
        A.evaluate(f"{K}.panelFabricar.cerrar()"); A.wait_for_timeout(300)

        print('Clava las estacas en las esquinas y cierra el campo')
        ESQ = [(x0, z0), (x0 + 12, z0), (x0 + 12, z0 + 10), (x0, z0 + 10)]
        coger(A, 'estaca', 2, 'mano:der'); servidorDice(lambda d: cuantos(d, yo, 'estaca') == 3)
        esperar(A, f"{K}.inventario.cuantos('estaca') === 3", 5000)
        ir(A, *ESQ[0])
        comprobar('con la estaca en la mano, Usar dice «Clavar una estaca»', texto_usar(A) == 'Clavar una estaca', texto_usar(A))
        for k, (x, z) in enumerate(ESQ):
            if k == 3:
                coger(A, 'estaca', 1, 'mano:der'); esperar(A, f"{K}.inventario.cuantos('estaca') >= 1", 5000); A.wait_for_timeout(500)
            ir(A, x, z)
            if k == 1: comprobar('la segunda dice cuántas lleva («2 de 16»)', texto_usar(A) == 'Clavar una estaca (2 de 16)', texto_usar(A))
            usar(A)
            comprobar(f'estaca {k + 1}, clavada (en el servidor)', servidorMundo(lambda l: len(estacas_ok(l)) >= k + 1) is not None, A.evaluate(AVISO))
        comprobar('y las tres primeras salen de lo que lleva', servidorDice(lambda d: cuantos(d, yo, 'estaca') == 0) is not None)
        ir(A, x0 + 0.7, z0 + 0.5)
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; if (!l['mano:der']) {K}.accionInventario({{ tipo: 'coger', objeto: 'estaca', cantidad: 1, a: 'mano:der' }}); }})()")
        esperar(A, f"{K}.inventario.cuantos('estaca') >= 1", 5000); A.wait_for_timeout(600)
        comprobar('junto a la primera, Usar dice «Cerrar el campo»', texto_usar(A) == 'Cerrar el campo', texto_usar(A))
        usar(A)
        l = servidorMundo(lambda l: any(e.get('tipo') == 'estaca' and e.get('ok') and (e.get('resultado') or {}).get('cerrado') for e in l) or len(estacas_ok(l)) >= 5)
        comprobar('cierra el campo (en el servidor)', l is not None, A.evaluate(AVISO))
        comprobar('el aviso dice su superficie: 120 m²', esperar(A, f"/Campo cerrado: 120 m²/.test({AVISO})", 5000), A.evaluate(AVISO))
        comprobar('cerrarlo no gasta otra estaca', A.evaluate(f"{K}.inventario.cuantos('estaca')") == 1)
        comprobar('en el navegador: un campo cerrado de 4 estacas y 120 m²', esperar(A, f"{K}.mundo.campos.length === 1 && {K}.mundo.campos[0].cerrado && {K}.mundo.campos[0].puntos.length === 4 && {K}.mundo.campos[0].area === 120", 5000), A.evaluate(f"JSON.stringify({K}.mundo.campos)"))
        comprobar('se dibujan las estacas y el linde', A.evaluate(f"(() => {{ const r = {K}.escena.getObjectByName('campos'); let n = 0; if (r) r.traverse(o => {{ if (o.isMesh) n++; }}); return n; }})()") >= 2)

        A.add_style_tag(content='#menuUsar { visibility: hidden !important; }')
        ir(A, x0 - 3, z0 - 3, 3.93); A.evaluate(f"{K}.cam.yaw = 3.93 - Math.PI; {K}.cam.dist = 14; {K}.cam.pitch = 0.75"); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_campo_cerrado.png')
        ir(A, x0 + 12 + 1.2, z0 + 1.1, 0.8); A.evaluate(f"{K}.cam.yaw = 0.8 + Math.PI; {K}.cam.dist = 3.2; {K}.cam.pitch = 0.35"); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_estaca_de_cerca.png')

        print('Quitar una estaca y volver a clavarla')
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.accion({{ tipo: 'dejar_arcon', de: m, cantidad: l[m].n }}); }})()"); A.wait_for_timeout(600)
        ir(A, x0 + 12.5, z0 + 10.4)
        comprobar('junto a una estaca, Usar dice «Quitar la estaca (campo de 120 m²)»', texto_usar(A) == 'Quitar la estaca (campo de 120 m²)', texto_usar(A))
        usar(A)
        # lo que lleva en línea es lo que dice el servidor (la actualiza con su mensaje 'inventario'): al quitar la estaca,
        # vuelve a la mano. (Se mira ahí, no en objetos.json, que se guarda con retraso.)
        cuenta_estaca = K + '.inventario.cuantos("estaca")'
        comprobar('quitada: vuelve a lo que lleva (lo dice el servidor)', esperar(A, cuenta_estaca + ' >= 1', 8000), f'lleva {A.evaluate(cuenta_estaca)} · {A.evaluate(AVISO)}')
        comprobar('y el campo queda abierto, con 3 estacas', esperar(A, f"!{K}.mundo.campos[0].cerrado && {K}.mundo.campos[0].puntos.length === 3", 5000))
        ir(A, x0 + 11, z0 + 9)
        usar(A)
        comprobar('clavada un poco más allá', esperar(A, f"{K}.mundo.campos[0].puntos.length === 4", 8000), A.evaluate(AVISO))
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; if (!l['mano:der']) {K}.accionInventario({{ tipo: 'coger', objeto: 'estaca', cantidad: 1, a: 'mano:der' }}); }})()"); A.wait_for_timeout(800)
        p0 = A.evaluate(f"{K}.mundo.campos[0].puntos[0]")
        ir(A, p0['x'] + 0.5, p0['z'] + 0.5); usar(A)
        comprobar('y se cierra otra vez (11 × 9 + … m²)', esperar(A, f"{K}.mundo.campos[0].cerrado && {K}.mundo.campos[0].area > 100 && {K}.mundo.campos[0].area < 120", 8000), A.evaluate(f"JSON.stringify({K}.mundo.campos[0])"))

        print('Labra con la azada (P11)')
        A.evaluate(f"(() => {{ const l = {K}.inventario.lugares; for (const m of ['mano:der', 'mano:izq']) if (l[m]) {K}.soltarAlSuelo(m); }})()"); A.wait_for_timeout(600)
        coger(A, 'azada', 1, 'mano:der')
        comprobar('el servidor le da la azada (arcón de pruebas)', servidorDice(lambda d: cuantos(d, yo, 'azada') == 1) is not None)
        esperar(A, f"{K}.inventario.cuantos('azada') === 1", 5000)
        ir(A, x0 + 6, z0 + 3.4, 0)
        comprobar('con la azada, dentro de su campo, Usar dice «Labrar»', texto_usar(A) == 'Labrar', texto_usar(A))
        A.evaluate(f"{K}.usar()")
        comprobar('Usar empieza a labrar (unos 2 s)', A.evaluate(f"!!({K}.estado.talando && {K}.estado.talando.labranza)"))
        A.evaluate(f"{K}.estado.golpeEn = 0")
        l = servidorMundo(lambda l: any(e.get('tipo') == 'labrar' and e.get('ok') for e in l))
        comprobar('la pasada se labra en el servidor, con su hora', l is not None and any(e.get('tipo') == 'labrar' and e.get('ok') and (e.get('datos') or {}).get('t', 0) > 1e12 for e in l), A.evaluate(AVISO))
        comprobar('el aviso dice cuánto lleva labrado', esperar(A, f"/Tierra labrada: \\d+ de \\d+ m²/.test({AVISO})", 5000), A.evaluate(AVISO))
        comprobar('se ve la tierra labrada', esperar(A, f"!!{K}.escena.getObjectByName('tierra_labrada')", 8000))
        for dx in (-1.6, 1.6, 3.2):
            ir(A, x0 + 6 + dx, z0 + 3.4, 0); A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0"); A.wait_for_timeout(500)
        servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'labrar' and e.get('ok')) >= 4)
        ir(A, x0 + 6, z0 + 3.4, 0)
        comprobar('donde ya está labrado lo dice', texto_usar(A) == 'Ya está labrado aquí', texto_usar(A))
        comprobar('labrado, sus estacas ya no se quitan', A.evaluate(f"(() => {{ const r = {K}.accion({{ tipo: 'quitar_estaca', campo: {K}.mundo.campos[0].id, i: 0 }}); return r.ok ? 'quitó' : r.motivo; }})()") == 'El campo ya está labrado: sus estacas no se mueven.')
        A.add_style_tag(content='#menuUsar { visibility: hidden !important; }')
        ir(A, x0 + 6, z0 - 2.5, 0); A.evaluate(f"{K}.cam.yaw = Math.PI; {K}.cam.dist = 7; {K}.cam.pitch = 0.5"); A.wait_for_timeout(2500)
        captura(A, f'{SALIDA}/PC_labrado.png')
        ir(A, x0 + 7.5, z0 + 2.2, 0); A.evaluate(f"{K}.cam.yaw = Math.PI + 0.6; {K}.cam.dist = 3; {K}.cam.pitch = 0.42"); A.wait_for_timeout(2000)
        captura(A, f'{SALIDA}/PC_labrado_de_cerca.png')

        print('Siembra: la cebada a voleo y las habas, la col y el nabo planta a planta (P11)')
        for zz in (z0 + 5.0, z0 + 6.6):
            for dx in (-1.6, 0, 1.6, 3.2):
                ir(A, x0 + 6 + dx, zz, 0); A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0"); A.wait_for_timeout(450)
        servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'labrar' and e.get('ok')) >= 10)
        def manos_vacias():
            A.evaluate(f"(() => {{ for (const m of ['mano:der', 'mano:izq']) if ({K}.inventario.lugares[m]) {K}.accionInventario({{ tipo: 'soltar', de: m, cantidad: {K}.inventario.lugares[m].n }}); }})()")
            esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 5000)
        manos_vacias()
        coger(A, 'semilla_cebada', 3, 'mano:der')
        comprobar('coge la cebada silvestre en la mano', esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'semilla_cebada'", 5000))
        ir(A, x0 + 5, z0 + 4.8, 0)
        comprobar('con la cebada en la mano, sobre lo labrado, Usar dice «Sembrar cebada a voleo»', texto_usar(A) == 'Sembrar cebada a voleo', texto_usar(A))
        A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0")
        l = servidorMundo(lambda l: any(e.get('tipo') == 'sembrar' and e.get('ok') for e in l))
        comprobar('la cebada se siembra en el servidor, con su hora', l is not None and any(e.get('tipo') == 'sembrar' and e.get('ok') and (e.get('datos') or {}).get('t', 0) > 1e12 for e in l), A.evaluate(AVISO))
        comprobar('el aviso dice cuánto lleva sembrado y lo que gasta', esperar(A, f"/Cebada sembrada: \\d+ de \\d+ m² del campo \\(gastas 1\\)/.test({AVISO})", 5000), A.evaluate(AVISO))
        comprobar('gasta un puñado', servidorDice(lambda d: cuantos(d, yo, 'semilla_cebada') == 2) is not None)
        comprobar('se ven las matas de cebada (brote)', esperar(A, f"!!{K}.escena.getObjectByName('planta_cebada_0')", 8000))
        comprobar('donde ya está sembrado lo dice', texto_usar(A) == 'Ahí no queda tierra labrada sin sembrar.', texto_usar(A))
        plantadas = 0
        for semilla, cultivo, zz in (('habas', 'habas', z0 + 4.3), ('semilla_col', 'col', z0 + 5.6), ('semilla_nabo', 'nabo', z0 + 6.9)):
            manos_vacias()
            coger(A, semilla, 6, 'mano:der')
            esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === '{semilla}'", 5000)
            for i, xx in enumerate((x0 + 7.5, x0 + 8.15, x0 + 8.8, x0 + 9.45)):
                ir(A, xx, zz, 0)
                if i == 0: comprobar(f'con {cultivo} en la mano, Usar dice «Plantar»', texto_usar(A).startswith('Plantar:'), texto_usar(A))
                A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0"); A.wait_for_timeout(500)
                plantadas += 1
            ir(A, x0 + 7.6, zz, 0)
            comprobar(f'{cultivo}: junto a otra, demasiado cerca (lo dice)', texto_usar(A) == 'Demasiado cerca de otra planta.', texto_usar(A))
        l = servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'sembrar' and e.get('ok')) >= 1 + plantadas)
        comprobar('las 12 plantas, en el servidor', l is not None, str(sum(1 for e in lineas_mundo() if e.get('tipo') == 'sembrar' and e.get('ok'))))
        comprobar('y en el campo, cada una a su sitio', esperar(A, f"({K}.mundo.campos[0].plantas || []).length === 12", 8000), A.evaluate(f"JSON.stringify({K}.mundo.campos[0].plantas || [])"))
        A.add_style_tag(content='#menuUsar { visibility: hidden !important; }')
        ir(A, x0 + 6.5, z0 + 1.6, 0); A.evaluate(f"{K}.cam.yaw = Math.PI; {K}.cam.dist = 5; {K}.cam.pitch = 0.42"); A.wait_for_timeout(2000)
        captura(A, f'{SALIDA}/PC_sembrado.png')
        # las fases: se adelanta la hora de lo sembrado solo en este navegador (lo del servidor no cambia), para verlas todas
        DIA = 24 * 3600 * 1000
        def edades(cebada, plantas):
            A.evaluate(f"(() => {{ const c = {K}.mundo.campos[0], ahora = Date.now(), e = {plantas}; c.voleo = {{ ...c.voleo, t: c.voleo.t.map(() => ahora - {cebada}) }}; c.plantas = c.plantas.map((p, i) => ({{ ...p, t: ahora - e[i % 4] }})); {K}.camposV.poner({K}.mundo.campos); }})()")
            A.wait_for_timeout(1500)
        edades(2.5 * DIA, [0.5 * DIA, 2.5 * DIA, 5 * DIA, 8 * DIA])
        comprobar('crecido: la cebada verde y las plantas en sus cuatro fases', A.evaluate(f"['planta_cebada_1', 'planta_habas_0', 'planta_habas_1', 'planta_habas_2', 'planta_habas_3', 'planta_col_2', 'planta_nabo_3'].every(n => !!{K}.escena.getObjectByName(n))"))
        ir(A, x0 + 8.5, z0 + 3.2, 0); A.evaluate(f"{K}.cam.yaw = Math.PI + 0.35; {K}.cam.dist = 2.6; {K}.cam.pitch = 0.5"); A.wait_for_timeout(1500)
        captura(A, f'{SALIDA}/PC_plantas_fases_de_cerca.png')
        edades(5 * DIA, [5 * DIA] * 4)
        comprobar('a los cinco días, la cebada en espiga y la col y el nabo con su cabeza', A.evaluate(f"['planta_cebada_2', 'planta_col_2', 'planta_nabo_2', 'planta_habas_2'].every(n => !!{K}.escena.getObjectByName(n))"))
        ir(A, x0 + 6.5, z0 + 3.4, 0); A.evaluate(f"{K}.cam.yaw = Math.PI + 0.3; {K}.cam.dist = 3.2; {K}.cam.pitch = 0.35"); A.wait_for_timeout(1500)
        captura(A, f'{SALIDA}/PC_espiga_de_cerca.png')
        edades(8 * DIA, [8 * DIA] * 4)
        comprobar('a la semana, todo maduro', A.evaluate(f"['planta_cebada_3', 'planta_col_3', 'planta_nabo_3', 'planta_habas_3'].every(n => !!{K}.escena.getObjectByName(n))"))
        ir(A, x0 + 6.5, z0 + 1.6, 0); A.evaluate(f"{K}.cam.yaw = Math.PI; {K}.cam.dist = 5; {K}.cam.pitch = 0.42"); A.wait_for_timeout(1500)
        captura(A, f'{SALIDA}/PC_maduro.png')
        ir(A, x0 + 6, z0 - 70, 0)
        comprobar('de lejos (a 70 m) las plantas no se dibujan', esperar(A, f"(() => {{ const g = {K}.camposV.raiz.children.filter(g => g.name === 'sembrado'); return g.length > 0 && g.every(g => !g.visible); }})()", 10000))
        A.evaluate(f"{K}.camposV.poner({K}.mundo.campos)")   # (lo adelantado se queda en este navegador: no se manda)
        ir(A, x0 + 6, z0 + 3.4, 0)

        print('Cosecha (P11): lo sembrado «hace ocho días» (la hora la pone aquí el navegador: KINHOLD_PRUEBAS_HORA=campos)')
        manos_vacias()
        coger(A, 'azada', 1, 'mano:der'); esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'azada'", 5000)
        for dx in (-1.6, 0, 1.6, 3.2):
            ir(A, x0 + 6 + dx, z0 + 0.4, 0); A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0"); A.wait_for_timeout(450)
        servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'labrar' and e.get('ok')) >= 14)
        sembradas_antes = sum(1 for e in lineas_mundo() if e.get('tipo') == 'sembrar' and e.get('ok'))
        for semilla, cultivo, xx, zz in (('semilla_cebada', 'cebada', x0 + 5, z0 + 2.0), ('habas', 'habas', x0 + 7.9, z0 + 2.3), ('semilla_col', 'col', x0 + 8.7, z0 + 1.6), ('semilla_nabo', 'nabo', x0 + 9.4, z0 + 2.4)):
            manos_vacias()
            coger(A, semilla, 2, 'mano:der'); esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === '{semilla}'", 5000)
            ir(A, xx, zz - 0.8, 0)
            r = A.evaluate(f"(() => {{ const c = {K}.mundo.campos[0]; const r = {K}.accion({{ tipo: 'sembrar', campo: c.id, cultivo: '{cultivo}', x: {xx}, z: {zz}, t: Date.now() - 8 * 86400000 }}); return r.ok ? '' : r.motivo; }})()")
            if r: print(f'  (sembrar {cultivo}: {r})')
            A.wait_for_timeout(600)
        l = servidorMundo(lambda l: sum(1 for e in l if e.get('tipo') == 'sembrar' and e.get('ok')) >= sembradas_antes + 4)
        comprobar('lo de hace ocho días, sembrado en el servidor', l is not None, str(sum(1 for e in lineas_mundo() if e.get('tipo') == 'sembrar' and e.get('ok')) - sembradas_antes))
        A.wait_for_timeout(1500)
        comprobar('y se ve maduro', esperar(A, f"!!{K}.escena.getObjectByName('planta_cebada_3') && !!{K}.escena.getObjectByName('planta_col_3')", 8000))
        manos_vacias()
        coger(A, 'hoz_silex', 1, 'mano:der'); esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'hoz_silex'", 5000)
        ir(A, x0 + 3.5, z0 + 5.4 - 1.4, 0)
        comprobar('con la hoz, junto a la cebada verde, dice que aún no está madura', texto_usar(A) == 'La cebada aún no está madura.', texto_usar(A))
        ir(A, x0 + 5, z0 + 0.6, 0)
        comprobar('con la hoz, junto a la cebada madura, Usar dice «Segar»', texto_usar(A) == 'Segar', texto_usar(A))
        A.evaluate(f"{K}.usar()")
        comprobar('Usar empieza a segar (unos 2 s)', A.evaluate(f"!!({K}.estado.talando && {K}.estado.talando.siega)"))
        A.evaluate(f"{K}.estado.golpeEn = 0")
        l = servidorMundo(lambda l: any(e.get('tipo') == 'segar' and e.get('ok') for e in l))
        comprobar('se siega en el servidor', l is not None, A.evaluate(AVISO))
        comprobar('el aviso dice lo segado y las gavillas', esperar(A, f"/Segados \\d+ m²: (una gavilla|\\d+ gavillas) al suelo/.test({AVISO})", 5000), A.evaluate(AVISO))
        comprobar('las gavillas quedan en el suelo y se ven', esperar(A, f"{K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'gavilla') && !!{K}.escena.getObjectByName('suelo_gavilla')", 8000), A.evaluate(f"JSON.stringify({K}.sueloObjetos.suelo.objetos.map(o => o.cosa))"))
        for xx in (x0 + 3.8, x0 + 6.2):
            ir(A, xx, z0 + 0.6, 0); A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0"); A.wait_for_timeout(600)
        manos_vacias()
        ir(A, x0 + 8.7, z0 + 0.9, 0)
        comprobar('delante de la col madura, Usar dice «Coger: col»', texto_usar(A) == 'Coger: col', texto_usar(A))
        A.evaluate(f"{K}.usar()"); A.evaluate(f"{K}.estado.golpeEn = 0")
        comprobar('la col se coge a mano (y las semillas)', servidorDice(lambda d: cuantos(d, yo, 'col') == 1) is not None, A.evaluate(AVISO))
        comprobar('el aviso dice lo cosechado', esperar(A, f"/Cosechado: /.test({AVISO})", 5000), A.evaluate(AVISO))
        ir(A, x0 + 6.6, z0 - 1.4, 0); A.evaluate(f"{K}.cam.yaw = Math.PI; {K}.cam.dist = 4.5; {K}.cam.pitch = 0.45"); A.wait_for_timeout(2000)
        captura(A, f'{SALIDA}/PC_segado.png')
        ir(A, x0 + 4.8, z0 - 0.2, 0); A.evaluate(f"{K}.cam.yaw = Math.PI + 0.4; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.5"); A.wait_for_timeout(1500)
        captura(A, f'{SALIDA}/PC_gavillas_de_cerca.png')

        print('Fuera de su tierra, no')
        # deja la azada (y lo que lleve en las manos) y coge una estaca en la mano derecha
        A.evaluate(f"(() => {{ for (const m of ['mano:der', 'mano:izq']) if ({K}.inventario.lugares[m]) {K}.accionInventario({{ tipo: 'soltar', de: m, cantidad: {K}.inventario.lugares[m].n }}); }})()")
        esperar(A, f"!{K}.inventario.lugares['mano:der'] && !{K}.inventario.lugares['mano:izq']", 5000)
        coger(A, 'estaca', 1, 'mano:der')
        comprobar('deja la azada y coge una estaca', esperar(A, f"({K}.inventario.lugares['mano:der'] || {{}}).tipo === 'estaca'", 5000), A.evaluate(f"JSON.stringify({K}.inventario.lugares['mano:der'] || null)")); A.wait_for_timeout(500)
        ir(A, 3, 6); usar(A)
        # (3,6) está en la zona del rey, a ~590 m del campo: su trozo no lleva el campo, así que no hay ninguno cargado aquí;
        # si la estaca se clavara (mal), aparecería un campo nuevo. Se comprueba que la rechaza y que no crea ninguno.
        comprobar('en la zona del rey no se clava, y no crea campo', esperar(A, f"/Fuera de tu tierra/.test({AVISO})", 5000) and A.evaluate(f"{K}.mundo.campos.length") == 0, f"aviso={A.evaluate(AVISO)} · campos={A.evaluate(f'{K}.mundo.campos.length')}")

        print('El otro jugador, en el móvil, lo ve')
        ctxB, B, errB = entrar(nav, 'móvil', {'width': 390, 'height': 844}, True)
        ir(B, x0 - 3, z0 + 5, 2.4)
        comprobar('y ve la tierra labrada', esperar(B, f"!!{K}.escena.getObjectByName('tierra_labrada')", 45000))
        comprobar('y ve lo sembrado (la cebada y las plantas, recién brotadas)', esperar(B, f"!!{K}.escena.getObjectByName('planta_cebada_0') && !!{K}.escena.getObjectByName('planta_col_0')", 20000))
        comprobar('le llega el campo, cerrado', esperar(B, f"{K}.mundo.campos.length === 1 && {K}.mundo.campos[0].cerrado", 20000), B.evaluate(f"JSON.stringify({K}.mundo.campos)"))
        B.evaluate(f"{K}.cam.yaw = 2.4 + Math.PI; {K}.cam.dist = 11; {K}.cam.pitch = 0.7"); B.wait_for_timeout(3000)
        captura(B, f'{SALIDA}/movil_campo.png')
        ir(B, x0 + 0.9, z0 - 1.1, 2.6); B.evaluate(f"{K}.cam.yaw = 2.6 + Math.PI; {K}.cam.dist = 3; {K}.cam.pitch = 0.35"); B.wait_for_timeout(2500)
        captura(B, f'{SALIDA}/movil_estaca_de_cerca.png')
        ir(B, x0 + 8.5, z0 + 3.2, 0); B.evaluate(f"{K}.cam.yaw = Math.PI + 0.3; {K}.cam.dist = 2.4; {K}.cam.pitch = 0.6"); B.wait_for_timeout(2000)
        captura(B, f'{SALIDA}/movil_sembrado_de_cerca.png')
        comprobar('y ve las gavillas en el suelo', esperar(B, f"!!{K}.escena.getObjectByName('suelo_gavilla')", 20000))
        ir(B, x0 + 5, z0 - 0.6, 0); B.evaluate(f"{K}.cam.yaw = Math.PI + 0.3; {K}.cam.dist = 2.6; {K}.cam.pitch = 0.6"); B.wait_for_timeout(2000)
        captura(B, f'{SALIDA}/movil_cosecha_de_cerca.png')
        comprobar('a Bruno no le deja quitar las estacas de otro (lo dice)', (B.evaluate(f"(() => {{ const r = {K}.accion({{ tipo: 'quitar_estaca', campo: {K}.mundo.campos[0].id, i: 0 }}); return r.ok ? 'quitó' : r.motivo; }})()") == 'Fuera de tu tierra.'))

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
