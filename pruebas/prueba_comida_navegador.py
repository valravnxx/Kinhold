# Prueba en navegador de despiezar y asar (P4; src/logica/comida.js, src/juego/main.js, src/juego/modelos_objetos.js),
# contra el servidor de verdad con Whitholm, en PC y en móvil. Es la parte de esta tarea que ve el jugador:
#   - con la lasca encima y la liebre cazada a sus pies, Usar dice «Despiezar la liebre»; al usarlo, la liebre sale del
#     suelo y, pasado su tiempo, la carne cruda y la piel llegan solas a lo que lleva (el servidor las da);
#   - la carne cruda y la asada se ven en el suelo (capturas de cerca, con la piel al lado).
# (Asar y comer van por el servidor en el recorrido: pruebas/prueba_recorrido.mjs.)
# Uso: python3 pruebas/prueba_comida_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: Usar no ofrece despiezar: tiene que fallar.
import sys, os, json, math, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_comida'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_ARCON': 'si'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(nombre, ok, detalle=''):
    print(('  OK   ' if ok else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not ok: fallos.append(nombre)
def esperar(pg, cond, ms=30000, arg=None):
    try: pg.wait_for_function(cond, arg=arg, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
EN_SUELO = f"(t) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t).map(o => ({{ id: o.id, x: o.x, z: o.z }}))"
CUANTOS = f"(t) => {K}.inventario.cuantos(t)"
def poner(pg, x, z):
    for _ in range(4):
        pg.evaluate(f"(() => {{ Object.assign({K}.pj, {{ x: {x}, z: {z}, vel: 0 }}); }})()")
        pg.wait_for_timeout(2500)
        if pg.evaluate(f"Math.hypot({K}.pj.x - ({x}), {K}.pj.z - ({z})) < 1"): return True
    return False
def coger(pg, t, a):
    pg.evaluate(f"{K}.accionInventario({{ tipo: 'coger', objeto: '{t}', cantidad: 1, a: '{a}' }})")
    return esperar(pg, f"(() => {{ const c = {K}.inventario.lugares['{a}']; return !!c && c.tipo === '{t}'; }})()", 10000)
def al_suelo(pg, a, t):
    antes = len(pg.evaluate(EN_SUELO, t))
    pg.evaluate(f"{K}.soltarAlSuelo('{a}')")
    return esperar(pg, f"(t) => {K}.sueloObjetos.suelo.objetos.filter(o => o.cosa.tipo === t).length > {antes}", 10000, t)
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil in [('pc', {'width': 1280, 'height': 800}, False), ('movil', {'width': 390, 'height': 844}, True)]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'comida' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea', listo)
            esperar(pg, f"{K}.objetosRed && {K}.objetosRed.deServidor", 30000)
            # (en el móvil, unos metros más allá: donde se quedó el de PC, dormido, no tapa nada)
            if movil: pj0 = pg.evaluate(f"[{K}.pj.x, {K}.pj.z]"); poner(pg, pj0[0] + 9, pj0[1] + 3)
            # la liebre cazada a sus pies y la lasca en la mano (del arcón de pruebas: la caza y la lasca de verdad, en el recorrido)
            ok = coger(pg, 'liebre', 'mano:izq') and al_suelo(pg, 'mano:izq', 'liebre') and coger(pg, 'lasca_silex', 'mano:der')
            comprobar(f'{nombre}: (la liebre a sus pies y la lasca en la mano)', ok)
            if MUTAR: pg.evaluate(f"{K}.sueloObjetos.suelo.objetos.forEach(o => {{ if (o.cosa.tipo === 'liebre') o.cosa.tipo = 'rama'; }})")
            texto = pg.evaluate(f"(() => {{ const a = {K}.accionPrincipal(); return a ? a.texto : null; }})()")
            comprobar(f'{nombre}: Usar dice «Despiezar la liebre»', texto == 'Despiezar la liebre', str(texto))
            if texto == 'Despiezar la liebre':
                pg.evaluate(f"{K}.usar()")
                comprobar(f'{nombre}: la liebre sale del suelo', esperar(pg, f"{K}.sueloObjetos.suelo.objetos.every(o => o.cosa.tipo !== 'liebre')", 10000))
                llega = esperar(pg, f"{K}.inventario.cuantos('carne_cruda') === 1 && ({K}.inventario.cuantos('piel') === 1 || {K}.sueloObjetos.suelo.objetos.some(o => o.cosa.tipo === 'piel'))", 45000)
                comprobar(f'{nombre}: pasados sus 30 s, la carne cruda y la piel llegan solas', llega, json.dumps({t: pg.evaluate(CUANTOS, t) for t in ['carne_cruda', 'piel', 'lasca_silex']}))
                comprobar(f'{nombre}: la lasca no se gasta', pg.evaluate(CUANTOS, 'lasca_silex') == 1)
            # de cerca: la carne cruda, la piel y una carne asada en la hierba
            pg.evaluate(f"(() => {{ const inv = {K}.inventario; for (const l of ['mano:der', 'mano:izq']) if (inv.lugares[l]) {K}.soltarAlSuelo(l); }})()")
            pg.wait_for_timeout(1500)
            for t in ['carne_cruda', 'piel']:
                if pg.evaluate(CUANTOS, t) and not pg.evaluate(EN_SUELO, t):
                    r = pg.evaluate(f"{K}.inventario.rutasCon('{t}')[0]")
                    if r: pg.evaluate(f"{K}.soltarAlSuelo('{r}')"); pg.wait_for_timeout(1200)
            if coger(pg, 'carne_asada', 'mano:der'): pg.evaluate(f"(() => {{ const k = {K}; k.pj.x += 0.5; }})()"); pg.wait_for_timeout(800); al_suelo(pg, 'mano:der', 'carne_asada')
            hay = {t: len(pg.evaluate(EN_SUELO, t)) for t in ['carne_cruda', 'carne_asada', 'piel']}
            comprobar(f'{nombre}: (la carne cruda, la asada y la piel, en el suelo)', all(hay.values()), json.dumps(hay))
            c = pg.evaluate(EN_SUELO, 'carne_cruda')
            if c:
                # el centro de lo que hay en el suelo, de cerca: el personaje a 1,3 m a un lado y la cámara cerca y baja
                todo = [o for t in ['carne_cruda', 'carne_asada', 'piel'] for o in pg.evaluate(EN_SUELO, t)]
                cx = sum(o['x'] for o in todo) / len(todo); cz = sum(o['z'] for o in todo) / len(todo)
                # (la cámara está del lado de yaw: el personaje, 1 m hacia ella y 0,9 m a un lado; lo del suelo, detrás de
                # él y al lado, a la vista)
                yaw = 0.5
                px = cx + math.sin(yaw) * 1.0 + math.cos(yaw) * 0.9; pz = cz + math.cos(yaw) * 1.0 - math.sin(yaw) * 0.9
                poner(pg, px, pz)
                pg.evaluate(f"(() => {{ const k = {K}; k.cam.yaw = {yaw}; k.cam.pitch = 0.6; k.cam.dist = 2.6; k.pj.rot = {yaw}; }})()")
                pg.wait_for_timeout(5000)
                captura(pg, f'{SALIDA}/{nombre}_carne_de_cerca.png')
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
