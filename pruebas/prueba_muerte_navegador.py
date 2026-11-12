# Prueba en navegador de morir y que te saqueen (P4; src/logica/muerte.js), contra el servidor de verdad con la muerte
# rápida de sed (KINHOLD_PRUEBAS_MUERTE=rapida: los nuevos llegan con la sed al máximo y mueren a los 3 s), en PC y en
# móvil (una sola página):
#   - tu jugador muere de sed: el aviso lo dice, y vuelve a su sitio de salida (sin cama);
#   - un jugador simulado (node) a unos metros muere también: su cuerpo se queda donde cayó, tumbado y con su ropa, con
#     la mitad de lo que llevaba en el suelo alrededor, y él ya no está ahí (ha vuelto a su salida);
#   - pasado el tiempo del cuerpo (45 s en la prueba), se va.
# Uso: python3 pruebas/prueba_muerte_navegador.py <html de la demo> <carpeta_capturas>
# MUTAR=1: el navegador no tumba los cuerpos (se ven de pie): tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver, subprocess, socket, time
from playwright.sync_api import sync_playwright
from correo_prueba import Codigos, crear_y_confirmar
from sitio_prueba import montar_sitio, servir

RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'dist/kinhold_demo.html'))
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas_muerte'
os.makedirs(SALIDA, exist_ok=True)
MUTAR = os.environ.get('MUTAR', '') == '1'

sitio = montar_sitio({'demo': RUTA})   # la página y los recursos enlazados, como en la web (pruebas/sitio_prueba.py)
web = servir(sitio)

s = socket.socket(); s.bind(('127.0.0.1', 0)); PUERTO = s.getsockname()[1]; s.close()
servidor = subprocess.Popen(['node', os.path.join(RAIZ, 'servidor/servidor.mjs'), str(PUERTO), os.path.join(sitio, 'mundo.jsonl')], cwd=RAIZ,
                            env={**os.environ, 'KINHOLD_PRUEBAS_ALTAS': 'libres', 'KINHOLD_PRUEBAS_MOVIMIENTO': 'libre', 'KINHOLD_PRUEBAS_SALIDA': 'comun', 'KINHOLD_PRUEBAS_MUERTE': 'rapida'},
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
servidor.stdout.readline()
codigos = Codigos(servidor)

def bot_codigo(OTRO, capas): return f"""import {{ WebSocket }} from 'ws';
import {{ terrenoWhitholm }} from './src/logica/terreno_servidor.js';
const T = terrenoWhitholm();
let p = {{ x: {OTRO[0]}, z: {OTRO[1]} }};
const ws = new WebSocket('ws://127.0.0.1:{PUERTO}');
ws.on('open', () => {{ setInterval(() => ws.send(JSON.stringify({{ tipo: 'estado', x: p.x, y: T.suelo(p.x, p.z), z: p.z, giro: 0.6, anim: 'quieto' }})), 200); }});
ws.on('message', (d) => {{ const m = JSON.parse(d.toString());
  if (m.tipo === 'bienvenida') {{ console.log('yo ' + m.autor); ws.send(JSON.stringify({{ tipo: 'aspecto', sexo: 'hombre', capas: {json.dumps(capas)} }})); }}
  if (m.tipo === 'muerte') {{ p = {{ x: m.posicion.x, z: m.posicion.z }}; console.log('muerto ' + m.motivo); }} }});"""
def bot_nuevo(OTRO, capas):
    b = subprocess.Popen(['node', '--input-type=module', '-e', bot_codigo(OTRO, capas)], cwd=RAIZ, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    return b, b.stdout.readline().strip()[3:]

URL = f'http://127.0.0.1:{web.server_address[1]}/jugar/demo/prueba.html?modo=construir&enlinea=1&servidor=ws://127.0.0.1:{PUERTO}'
K = 'window.__kinhold'
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
fallos = []
def comprobar(nombre, ok, detalle=''):
    print(('  OK   ' if ok else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not ok: fallos.append(nombre)
def esperar(pg, cond, ms=30000):
    try: pg.wait_for_function(cond, timeout=ms); return True
    except Exception: return False
def captura(pg, ruta):
    try: pg.screenshot(path=ruta)
    except Exception as e: print('  (sin captura:', str(e)[:80], ')')
# los cuerpos que se ven (presencias «cuerpo:…»): de quién, dónde y si está tumbado
CUERPOS = f"""() => [...{K}.enLineaRemotos().entries()].filter(([a]) => a.startsWith('cuerpo:')).map(([a, r]) => ({{ id: a, de: a.split(':').slice(2).join(':'), x: r.j.raiz.position.x, z: r.j.raiz.position.z, tumbado: !!r.j.durmiendo }}))"""
# si se ve el cuerpo de alguien
HAY_CUERPO = f"""(autor) => {K} && ({CUERPOS})().some(c => c.de === autor)"""
bots = []
try:
    with sync_playwright() as p:
        nav = p.chromium.launch(args=ARGS)
        for nombre, vista, movil, OTRO in [('pc', {'width': 1280, 'height': 800}, False, (3.0, -5.0)), ('movil', {'width': 390, 'height': 844}, True, (-3.0, -5.0))]:
            print('Vista', nombre)
            ctx = nav.new_context(viewport=vista, device_scale_factor=2 if movil else 1, is_mobile=movil, has_touch=movil, locale='es-ES')
            if MUTAR: ctx.add_init_script('window.__mutarMuerto = true')
            pg = ctx.new_page()
            err = []
            pg.on('pageerror', lambda e, err=err: err.append(str(e)))
            pg.goto(URL, wait_until='domcontentloaded', timeout=180000)
            try: pg.wait_for_function("!!document.getElementById('pantallaCuenta')", timeout=20000); crear_y_confirmar(pg, codigos, 'muerte' + nombre)
            except Exception: pass
            listo = esperar(pg, f"{K} && {K}.mundoListo && {K}.yo && !document.getElementById('pantallaCuenta')", 300000)
            comprobar(f'{nombre}: en línea', listo)
            # tu jugador: llega con la sed al máximo y muere de sed
            muere = esperar(pg, f"!!{K}.ultimaMuerte", 60000)
            m = pg.evaluate(f"(() => {{ const k = {K}; return {{ m: k.ultimaMuerte, x: k.pj.x, z: k.pj.z, aviso: document.getElementById('aviso').textContent }}; }})()")
            comprobar(f'{nombre}: tu jugador muere de sed, y el aviso lo dice', muere and m['m']['motivo'] == 'De sed' and 'Has muerto de sed' in m['m'].get('aviso', '') and 'sitio de salida' in m['m'].get('aviso', ''), json.dumps(m, ensure_ascii=False))
            comprobar(f'{nombre}: vuelve a su sitio de salida (sin cama)', muere and not m['m']['enCama'] and abs(m['x']) < 1 and abs(m['z']) < 1, json.dumps(m, ensure_ascii=False))
            captura(pg, f'{SALIDA}/{nombre}_muere.png')
            # otro jugador muere a unos metros: su cuerpo se queda allí, tumbado y con su ropa, y lo suyo alrededor
            bot, autor = bot_nuevo(OTRO, ['camisa', 'calzas']); bots.append(bot)
            try: pg.wait_for_function(HAY_CUERPO, arg=autor, timeout=60000); hay = True
            except Exception: hay = False
            pg.evaluate(f"""(() => {{ const k = {K}, dx = {OTRO[0]} - k.pj.x, dz = {OTRO[1]} - k.pj.z; k.cam.yaw = Math.atan2(-dx, -dz) + {0.25 if movil else 0.5}; k.cam.pitch = 0.45; k.cam.dist = 5.5; }})()""")
            pg.wait_for_timeout(20000)   # que se tumbe (sin tarjeta gráfica va a 1 fotograma por segundo)
            cs = pg.evaluate(CUERPOS)
            c = next((c for c in cs if c['de'] == autor), None)
            comprobar(f'{nombre}: el cuerpo del otro se queda donde cayó', hay and c and abs(c['x'] - OTRO[0]) < 0.3 and abs(c['z'] - OTRO[1]) < 0.3, json.dumps(cs))
            comprobar(f'{nombre}: tumbado', bool(c and c['tumbado']), json.dumps(c))
            vivo = pg.evaluate(f"""(() => {{ const r = {K}.enLineaRemotos().get({json.dumps(autor)}); return r ? [r.j.raiz.position.x, r.j.raiz.position.z] : null; }})()""")
            comprobar(f'{nombre}: y él ya no está ahí (ha vuelto a su salida)', vivo is None or abs(vivo[0] - OTRO[0]) + abs(vivo[1] - OTRO[1]) > 2, json.dumps(vivo))
            suelo = pg.evaluate(f"""(() => {K}.sueloObjetos.suelo.visibles(Date.now()).filter(o => Math.hypot(o.x - {OTRO[0]}, o.z - {OTRO[1]}) < 2).map(o => o.cosa.tipo))()""")
            comprobar(f'{nombre}: lo suyo que queda, en el suelo a su lado (la mitad: una de sus dos prendas)', len(suelo) == 1, json.dumps(suelo))
            captura(pg, f'{SALIDA}/{nombre}_cuerpo.png')
            pg.evaluate(f"(() => {{ const k = {K}; k.cam.pitch = 0.25; k.cam.dist = 3.2; }})()"); pg.wait_for_timeout(4000)
            captura(pg, f'{SALIDA}/{nombre}_cuerpo_cerca.png')
            try: pg.wait_for_function(f"(autor) => !({CUERPOS})().some(c => c.de === autor)", arg=autor, timeout=70000); se_va = True
            except Exception: se_va = False
            comprobar(f'{nombre}: pasado su tiempo, el cuerpo se va', se_va)
            comprobar(f'{nombre}: sin errores en la página', not err, '; '.join(err[:3]))
            bot.kill(); bot.wait()
            ctx.close()
            time.sleep(1.0)
        nav.close()
finally:
    for b in bots:
        try: b.kill()
        except Exception: pass
    servidor.kill()
print('\n' + (f'{len(fallos)} fallos: ' + '; '.join(fallos) if fallos else 'Todo bien'))
sys.exit(1 if fallos else 0)
