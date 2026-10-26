# Prueba en navegador real (Chromium sin pantalla) del hito 1 de Kinhold.
# Construye una cabaña usando el propio juego, comprueba el estado y saca capturas.
# Se sirve por HTTP con la misma estructura que la web (jugar/construccion/ y recursos/personajes/taller-v4/), porque el
# personaje del taller se carga de un .glb aparte. MUTAR=1 apunta a una carpeta de modelos que no existe: tiene que fallar.
import sys, os, json, shutil, tempfile, threading, http.server, functools, socketserver
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
sitio = tempfile.mkdtemp()
os.makedirs(f'{sitio}/jugar/construccion'); os.makedirs(f'{sitio}/recursos/personajes')
shutil.copy(RUTA, f'{sitio}/jugar/construccion/prueba.html')
shutil.copytree(os.path.join(RAIZ, 'docs/recursos/personajes/taller-v4'), f'{sitio}/recursos/personajes/taller-v4')
class Silencioso(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Silencioso, directory=sitio))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_address[1]}/jugar/construccion/prueba.html' + ('?recursosMH=../../no-existe/' if os.environ.get('MUTAR') else '')
ARGS = ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]

fallos = []
def comprobar(nombre, cond, detalle=''):
    print(('  OK   ' if cond else '  FALLA ') + nombre + (f' — {detalle}' if detalle else ''))
    if not cond: fallos.append(nombre)

def esperar(pg, ms=400):
    pg.wait_for_timeout(ms)

with sync_playwright() as p:
    nav = p.chromium.launch(args=ARGS)
    # ---------- PC ----------
    pg = nav.new_page(viewport={'width': 1280, 'height': 800}, locale='es-ES')
    errores = []
    pg.on('pageerror', lambda e: errores.append(str(e)))
    pg.on('console', lambda m: errores.append(m.text) if m.type == 'error' else None)
    pg.goto(URL)
    pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    pg.evaluate('localStorage.clear(); window.__kinhold.reiniciar()')
    esperar(pg, 800)

    K = 'window.__kinhold'
    def ev(js): return pg.evaluate(js)
    def poner(clase, tipo, x, z, planta=0, girar=0):
        ev(f"{K}.cambiarModo('construir'); {K}.estado.planta={planta}; {K}.seleccionar('{clase}','{tipo}');")
        for _ in range(girar): ev(f"{K}.girar()")
        ev(f"{K}.apuntar({x},{z})")
        v = ev(f"{K}.estado.candidato && {K}.estado.candidato.v")
        ev(f"{K}.colocar()")
        return v

    print('PC: cabaña completa')
    v = poner('mojon', 'mojon', -3, -6)
    comprobar('mojón colocado', ev(f"!!{K}.mundo.mojon"))
    # cimientos 2x3 con la primera pieza en (1,1) sin giro
    for i in range(2):
        for j in range(3):
            v = poner('pieza', 'cim_piedra', 2*i+1, 2*j+1)
    comprobar('6 cimientos en una sola construcción', ev(f"{K}.mundo.construcciones.length===1 && {K}.mundo.construcciones[0].piezas.size===6"))
    # muros perimetrales
    poner('pieza', 'muro_tronco_puerta', 1, 0)
    poner('pieza', 'muro_tronco', 3, 0)
    poner('pieza', 'muro_tronco', 1, 6)
    poner('pieza', 'muro_tronco_ventana', 3, 6)
    for j in range(3):
        poner('pieza', 'muro_tronco' if j != 1 else 'muro_tronco_ventana', 0, 2*j+1)
        poner('pieza', 'muro_tronco', 4, 2*j+1)
    poner('pieza', 'puerta_varas', 1, 0)
    n = ev(f"{K}.mundo.construcciones[0].piezas.size")
    comprobar('muros y puerta colocados', n == 6 + 10 + 1, f'piezas={n}')
    # altillo en la planta 1 sobre las casillas del fondo
    for i in range(2):
        poner('pieza', 'suelo_tronco', 2*i+1, 5, planta=1)
    # tejado: lado izquierdo sube hacia +x (dir 3), derecho hacia -x (dir 1)
    for j in range(3):
        poner('pieza', 'tejado_paja', 1, 2*j+1, planta=1, girar=3)
        poner('pieza', 'tejado_paja', 3, 2*j+1, planta=1, girar=1)
    n = ev(f"{K}.mundo.construcciones[0].piezas.size")
    comprobar('altillo y tejado', n == 17 + 2 + 6, f'piezas={n}')
    rell = ev(f"(() => {{ let n=0; const r=window.__kinhold; return [...r.mundo.construcciones[0].piezas.values()].filter(p=>p.hueco==='r').length; }})()")
    ocultas = ev(f"[...document.querySelectorAll('#pestanas button')].map(b=>b.dataset.cat).includes('oculto')")
    comprobar('el hastial manual ya no aparece en el menú', not ocultas)
    # escalera hacia el altillo y decoración
    poner('pieza', 'escalera_mano', 1, 3, planta=0, girar=0)
    poner('deco', 'mesa', 3, 2)
    poner('deco', 'cama_paja', 1.2, 4.6)
    poner('deco', 'barril', 3.5, 4.5)
    poner('deco', 'candil', 0.6, 1.0)
    comprobar('decoración colocada', ev(f"{K}.mundo.decoracion.length") == 4)
    # empalizada con portón y cerca
    for x in [-5, -3, 7, 9]:
        poner('pieza', 'empalizada', x, -4)
    rots = ev(f"{K}.mundo.construcciones.map(c=>+c.rot.toFixed(3))")
    comprobar('girar tejados no tuerce construcciones nuevas', all(r == 0 for r in rots), f'giros={rots}')
    # cobertizo de una caída con pendiente continua de 2 casillas
    poner('pieza', 'cim_piedra', -11, 1)
    poner('pieza', 'cim_piedra', -11, 3)
    for x, z in [(-11, 0), (-11, 4), (-12, 1), (-12, 3), (-10, 1), (-10, 3)]:
        poner('pieza', 'muro_tabla', x, z)
    poner('pieza', 'tejado_tablilla', -11, 1, planta=1)
    poner('pieza', 'tejado_tablilla', -11, 3, planta=1)
    nt = ev(f"{K}.mundo.construcciones.find(c=>c.piezas.size>=10 && [...c.piezas.values()].some(p=>p.tipo==='tejado_tablilla')).piezas.size")
    comprobar('cobertizo de tablas con dos tramos de tejado', nt == 10, f'piezas={nt}')
    # un corral con cerca
    for z in [9, 11]:
        poner('pieza', 'cerca', 8, z)
    ev(f"{K}.cambiarModo('mover')")
    ev(f"{K}.pj.x=2; {K}.pj.z=-3; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=0.7; {K}.cam.dist=19")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/01_cabana_vista_general.png')

    print('PC: interior (tejado oculto)')
    ev(f"{K}.pj.x=2; {K}.pj.z=3; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=1.05; {K}.cam.dist=13")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/02_interior_sin_tejado.png')

    print('PC: puerta y escalera')
    ev(f"{K}.pj.x=1; {K}.pj.z=-0.8; {K}.pj.k=0")
    esperar(pg, 300)
    ev(f"{K}.usar()")
    abierta = ev(f"[...{K}.mundo.construcciones[0].piezas.values()].find(p=>p.hueco==='p').abierta")
    comprobar('la puerta se abre con Usar', abierta is True)
    ev(f"{K}.pj.x=1; {K}.pj.z=3.4")
    esperar(pg, 300)
    ev(f"{K}.usar()")
    comprobar('la escalera sube a la planta 1', ev(f"{K}.pj.k") == 1, f"planta={ev(f'{K}.pj.k')}")
    esperar(pg, 600)
    ev(f"{K}.usar()")
    comprobar('y vuelve a bajar', ev(f"{K}.pj.k") == 0)

    print('PC: rechazo por carga')
    poner('pieza', 'cim_piedra', 13, 1)
    poner('pieza', 'muro_zarzo', 13, 0)
    poner('pieza', 'tejado_paja', 13, 1, planta=1)
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','muro_tronco'); {K}.apuntar(13,0)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('muro de troncos sobre zarzo rechazado con punto débil', (not v['ok']) and bool(v.get('debil')), json.dumps(v, ensure_ascii=False))
    ev(f"{K}.pj.x=11; {K}.pj.z=-3; {K}.cam.yaw=Math.PI+0.35; {K}.cam.pitch=0.7; {K}.cam.dist=11")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/03_rechazo_por_carga.png')

    print('PC: desmontar con cascada')
    ev(f"{K}.cambiarModo('desmontar'); {K}.pj.x=12; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.25; {K}.cam.pitch=0.6; {K}.cam.dist=11")
    esperar(pg, 900)
    pt = ev(f"{K}.proyectar(13, 0.8, 0)")
    ev(f"{K}.apuntarPieza({pt['x']}, {pt['y']})")
    pd = ev(f"{K}.estado.pendienteDesmontar && {{caen: {K}.estado.pendienteDesmontar.caen, key: {K}.estado.pendienteDesmontar.key}}")
    comprobar('al desmontar el muro de zarzo cae el tejado de encima', bool(pd) and pd['caen'] == 1, json.dumps(pd))
    esperar(pg, 300)
    pg.screenshot(path=f'{SALIDA}/04_desmontar_cascada.png')
    antes = ev(f"{K}.mundo.materiales.vara")
    ev(f"{K}.confirmarDesmontaje()")
    despues = ev(f"{K}.mundo.materiales.vara")
    comprobar('recupera 3 varas (75% de 4)', despues - antes == 3, f'{antes} → {despues}')
    reg = ev(f"{K}.registroAcciones.entradas.map(e => [e.autor, e.tipo, e.ok])")
    tipos = {t for _, t, okk in reg if okk}
    comprobar('lo construido, abierto y desmontado queda en el registro de acciones con su autor',
              {'mojon', 'colocar', 'usar', 'desmontar'} <= tipos and all(a == 'jugador:local' for a, _, _ in reg) and reg[-1][1] == 'desmontar',
              f'{len(reg)} acciones: ' + ', '.join(sorted(tipos)))

    print('PC: quitar un mueble con el ratón (clic, mover el ratón hasta «Confirmar» y confirmar)')
    poner('deco', 'barril', -6, 3)
    ndeco = ev(f"{K}.mundo.decoracion.length")
    barril = ev(f"{K}.mundo.decoracion.at(-1)")
    ev(f"{K}.cambiarModo('desmontar'); {K}.pj.x=-6; {K}.pj.z=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.7; {K}.cam.dist=9")
    esperar(pg, 900)
    pt = ev(f"{K}.proyectar({barril['x']}, {barril['y']} + 0.4, {barril['z']})")
    pg.mouse.move(pt['x'], pt['y'])
    pg.mouse.click(pt['x'], pt['y'])
    esperar(pg, 200)
    comprobar('el clic elige el barril y pide confirmar', ev(f"!!({K}.estado.pendienteDesmontar && {K}.estado.pendienteDesmontar.deco)") and pg.is_visible('#btnConfirmar'))
    caja = pg.locator('#btnConfirmar').bounding_box()
    # el ratón cruza el suelo (y lo que haya) camino del botón
    pg.mouse.move(caja['x'] + caja['width'] / 2, caja['y'] + caja['height'] / 2, steps=25)
    comprobar('al mover el ratón hacia «Confirmar» el barril sigue elegido', ev(f"!!({K}.estado.pendienteDesmontar && {K}.estado.pendienteDesmontar.deco && {K}.estado.pendienteDesmontar.deco.id === {barril['id']})") and pg.is_visible('#btnConfirmar'))
    pg.screenshot(path=f'{SALIDA}/04b_quitar_mueble_confirmar.png')
    pg.click('#btnConfirmar')
    comprobar('confirmando, el barril se quita', ev(f"{K}.mundo.decoracion.length") == ndeco - 1 and not ev(f"{K}.mundo.decoracion.some(d => d.id === {barril['id']})"))
    # con nada elegido, pasar el ratón sigue enseñando qué se quitaría
    pg.mouse.move(pt['x'] + 40, pt['y'] + 40); pg.mouse.move(pt['x'], pt['y'])
    comprobar('sin nada elegido, el botón de confirmar no aparece al pasar el ratón', not pg.is_visible('#btnConfirmar'))

    print('PC: cobertizo de pendiente continua')
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-6; {K}.pj.z=1; {K}.cam.yaw=-Math.PI/2+0.5; {K}.cam.pitch=0.5; {K}.cam.dist=14")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/08_cobertizo_pendiente_continua.png')
    ev(f"{K}.pj.x=2; {K}.pj.z=12; {K}.cam.yaw=0.5; {K}.cam.pitch=0.55; {K}.cam.dist=15")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/09_cabana_desde_atras.png')

    print('PC: primer plano de muros')
    ev(f"{K}.pj.x=2.2; {K}.pj.z=-3.2; {K}.pj.rot=0; {K}.cam.yaw=Math.PI+0.45; {K}.cam.pitch=0.32; {K}.cam.dist=7.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/10_primer_plano_fachada.png')
    ev(f"{K}.pj.x=2; {K}.pj.z=9.5; {K}.cam.yaw=0.35; {K}.cam.pitch=0.32; {K}.cam.dist=8")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/11_primer_plano_trasera_ventana.png')

    print('PC: guardado')
    ev("location.reload()")
    pg.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    esperar(pg, 600)
    n2 = ev(f"{K}.mundo.construcciones.reduce((a,c)=>a+c.piezas.size,0)")
    comprobar('la partida se conserva al recargar', n2 > 20, f'piezas={n2}')

    print('PC: casa de dos plantas con tejado (madera más resistente)')
    res = ev("""(() => {
      const K = window.__kinhold, m = K.mundo;
      const c = { id: m.siguienteId++, ox: -15, oz: -3, rot: 0, piezas: new Map() }; m.construcciones.push(c);
      const H = { cim_tronco: 'f', suelo_tronco: 'f', muro_tronco: 'e', muro_tronco_puerta: 'e', muro_tronco_ventana: 'e', tejado_paja: 'r', escalera_mano: 'l' };
      const fallos = [];
      const pon = (tipo, i, j, k, d = 0, dir = 0) => { const p = { tipo, hueco: H[tipo], i, j, k, dir, abierta: false }; if (H[tipo] === 'e') p.d = d;
        const r = m.colocar({ construccion: c, nueva: false, pieza: p }); if (!r.ok) fallos.push(`${tipo} ${i},${j},${k}: ${r.motivo}`); };
      for (const k in m.materiales) m.materiales[k] += 500;
      const N = 4, M = 4;
      const celdas = []; for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) celdas.push([i, j]);
      const borde = ([i, j]) => Math.min(i, N - 1 - i, j, M - 1 - j); celdas.sort((a, b) => borde(a) - borde(b)); // de fuera hacia dentro
      for (const [i, j] of celdas) pon('cim_tronco', i, j, 0);
      for (let k = 0; k < 2; k++) {
        if (k) for (const [i, j] of celdas) if (!(i === 0 && j === 1)) pon('suelo_tronco', i, j, k);
        for (let i = 0; i < N; i++) { pon(k === 0 && i === 1 ? 'muro_tronco_puerta' : 'muro_tronco', i, 0, k, 0); pon(i === 2 ? 'muro_tronco_ventana' : 'muro_tronco', i, M, k, 0); }
        for (let j = 0; j < M; j++) { pon('muro_tronco', 0, j, k, 1); pon(j === 1 ? 'muro_tronco_ventana' : 'muro_tronco', N, j, k, 1); }
      }
      pon('escalera_mano', 0, 1, 0);
      // tejado a dos aguas: la mitad de delante sube hacia atrás y la de atrás hacia delante
      for (const [i, j] of celdas) pon('tejado_paja', i, j, 2, 0, j < M / 2 ? 0 : 2);
      K.reconstruir();
      return { fallos, n: c.piezas.size };
    })()""")
    comprobar('casa de 4×4, dos plantas y tejado de troncos: entra entera (también las esquinas del tejado)', not res['fallos'], json.dumps(res, ensure_ascii=False)[:300])
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x=-11; {K}.pj.z=-5; {K}.cam.yaw=Math.PI+0.7; {K}.cam.pitch=0.5; {K}.cam.dist=24")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/12_casa_dos_plantas.png')
    ev(f"{K}.pj.x=-11; {K}.pj.z=8; {K}.cam.yaw=0.7; {K}.cam.pitch=0.5; {K}.cam.dist=24")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/13_casa_dos_plantas_detras.png')

    print('PC: escalera de tablas (se sube andando)')
    for x, z in [(9, -13), (9, -11), (11, -13), (11, -11)]:
        poner('pieza', 'cim_piedra', x, z)
    poner('pieza', 'muro_tronco', 9, -10)
    poner('pieza', 'muro_tronco', 11, -10)
    poner('pieza', 'muro_tronco', 12, -11)
    poner('pieza', 'suelo_tronco', 9, -11, planta=1)
    poner('pieza', 'suelo_tronco', 11, -11, planta=1)
    v = poner('pieza', 'escalera_tabla', 9, -13)
    comprobar('escalera de tablas colocada desde el menú', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('construir'); {K}.estado.planta=1; {K}.seleccionar('pieza','suelo_tronco'); {K}.apuntar(9,-13)")
    v = ev(f"{K}.estado.candidato.v")
    comprobar('encima de la escalera no deja poner suelo (hueco abierto)', not v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    def andar(tecla, cond, maximo=6000):
        pg.keyboard.down(tecla)
        t = 0
        while t < maximo and not ev(cond):
            pg.wait_for_timeout(100); t += 100
        pg.keyboard.up(tecla)
        return t
    # abajo, delante de la escalera, mirando hacia donde sube (+z)
    ev(f"{K}.pj.x=9; {K}.pj.z=-14.6; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=Math.PI; {K}.cam.pitch=0.45; {K}.cam.dist=9")
    esperar(pg, 400)
    andar('w', f"{K}.pj.z > -13")
    esperar(pg, 200)
    ymedio, kmedio = ev(f"{K}.pj.y"), ev(f"{K}.pj.k")
    comprobar('a media escalera vas subiendo', 0.3 < ymedio < 2.4, f'y={ymedio:.2f} planta={kmedio}')
    ev(f"{K}.cam.yaw=Math.PI/2+0.9; {K}.cam.pitch=0.35; {K}.cam.dist=8")
    esperar(pg, 500)
    pg.screenshot(path=f'{SALIDA}/15_escalera_subiendo.png')
    ev(f"{K}.cam.yaw=Math.PI")
    andar('w', f"{K}.pj.z > -11.2")
    esperar(pg, 600)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('andando se llega arriba: planta 1, sobre el suelo', k == 1 and abs(y - 2.62) < 0.1, f'planta={k} y={y:.2f}')
    ev(f"{K}.cam.yaw=Math.PI/2+0.9; {K}.cam.pitch=0.5; {K}.cam.dist=9")
    esperar(pg, 500)
    pg.screenshot(path=f'{SALIDA}/16_escalera_arriba.png')
    ev(f"{K}.cam.yaw=Math.PI")
    andar('s', f"{K}.pj.z < -14.3")
    esperar(pg, 600)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('y andando hacia atrás se vuelve a bajar a la planta 0', k == 0 and y < 0.2, f'planta={k} y={y:.2f}')
    # por debajo del tramo alto: entrando por detrás a ras de suelo no te sube
    ev(f"{K}.pj.x=10.4; {K}.pj.z=-12.3; {K}.pj.k=0; {K}.pj.y=0.12")
    esperar(pg, 200)
    ev(f"{K}.cam.yaw=Math.PI/2")
    andar('w', f"{K}.pj.x < 9.6", 3000)
    esperar(pg, 300)
    k, y = ev(f"{K}.pj.k"), ev(f"{K}.pj.y")
    comprobar('por debajo del tramo alto se pasa sin subir', k == 0 and y < 0.3, f'planta={k} y={y:.2f}')
    ev(f"{K}.pj.x=10.2; {K}.pj.z=-15; {K}.pj.k=0; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.4; {K}.cam.dist=8.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/14_escalera_de_tablas.png')

    print('PC: barandilla (medio muro en el borde del suelo de arriba)')
    # el suelo de arriba (casillas de z=-11) da a la casilla de x=11, z=-13, que no tiene suelo en la planta 1
    v = poner('pieza', 'medio_muro', 11, -12, planta=1)
    comprobar('medio muro colocado como barandilla en la planta 1', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    ev(f"{K}.cambiarModo('mover'); {K}.estado.planta=0")
    def arriba_en(x, z):
        ev(f"{K}.pj.x={x}; {K}.pj.z={z}; {K}.pj.k=1; {K}.pj.y=2.62")
        esperar(pg, 300)
    # control: por el borde sin barandilla (hacia +x) sí se cae a la planta 0
    arriba_en(11, -11)
    ev(f"{K}.cam.yaw=-Math.PI/2")
    andar('w', f"{K}.pj.k === 0", 2500)
    esperar(pg, 300)
    comprobar('sin barandilla, por el borde se cae a la planta 0', ev(f"{K}.pj.k") == 0, f"planta={ev(f'{K}.pj.k')} x={ev(f'{K}.pj.x'):.2f}")
    # con barandilla (hacia -z) no se pasa
    arriba_en(11, -11)
    ev(f"{K}.cam.yaw=0")
    andar('w', f"{K}.pj.k === 0 || {K}.pj.z < -12.2", 2000)
    esperar(pg, 300)
    k, z = ev(f"{K}.pj.k"), ev(f"{K}.pj.z")
    comprobar('con la barandilla no se cae: sigue en la planta 1, antes del borde', k == 1 and z > -12, f'planta={k} z={z:.2f}')
    ev(f"{K}.pj.rot=0; {K}.cam.yaw=-0.55; {K}.cam.pitch=0.35; {K}.cam.dist=6.5")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/17_barandilla_planta_1.png')

    print('PC: portillo de la cerca (se abre con Usar)')
    # dentro de la tierra (mojón en -3,-6, radio 20) y lejos de lo demás
    for x in [-10, -6]:
        poner('pieza', 'cerca', x, 12)
    v = poner('pieza', 'cerca_portillo', -8, 12)
    comprobar('portillo colocado entre dos tramos de cerca', bool(v) and v['ok'], json.dumps(v, ensure_ascii=False))
    pc = ev(f"""(() => {{ for (const c of {K}.mundo.construcciones) for (const p of c.piezas.values()) if (p.tipo === 'cerca_portillo') {{
        const lx = p.d === 0 ? (p.i + 0.5) * 2 : p.i * 2, lz = p.d === 0 ? p.j * 2 : (p.j + 0.5) * 2;
        const co = Math.cos(c.rot), si = Math.sin(c.rot);
        return {{ x: c.ox + lx * co + lz * si, z: c.oz - lx * si + lz * co, d: p.d, cercas: [...c.piezas.values()].filter(q => q.tipo === 'cerca').length }}; }} return null; }})()""")
    comprobar('portillo en la misma rejilla que la cerca, en línea con ella', pc is not None and pc['d'] == 0 and pc['cercas'] == 2, json.dumps(pc))
    ev(f"{K}.cambiarModo('mover'); {K}.pj.x={pc['x']}; {K}.pj.z={pc['z']}+1.4; {K}.pj.k=0; {K}.pj.y=0; {K}.cam.yaw=0")
    esperar(pg, 300)
    andar('w', f"{K}.pj.z < {pc['z']} - 0.5", 1500)
    comprobar('cerrado no deja pasar', ev(f"{K}.pj.z") > pc['z'], f"z={ev(f'{K}.pj.z'):.2f} portillo={pc['z']:.2f}")
    ev(f"{K}.pj.rot=Math.PI; {K}.cam.yaw=0.6; {K}.cam.pitch=0.35; {K}.cam.dist=6")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/18_portillo_cerrado.png')
    ev(f"{K}.usar()")
    abierto = ev(f"[...{K}.mundo.construcciones.flatMap(c => [...c.piezas.values()])].find(p => p.tipo === 'cerca_portillo').abierta")
    comprobar('Usar abre el portillo', abierto is True)
    comprobar('y queda en el registro de acciones', ev(f"{K}.registroAcciones.entradas.at(-1).tipo === 'usar' && {K}.registroAcciones.entradas.at(-1).ok"))
    ev(f"{K}.cam.yaw=0")
    andar('w', f"{K}.pj.z < {pc['z']} - 0.8", 2500)
    comprobar('abierto se pasa al otro lado', ev(f"{K}.pj.z") < pc['z'] - 0.5, f"z={ev(f'{K}.pj.z'):.2f}")
    ev(f"{K}.pj.x={pc['x']}+0.4; {K}.pj.z={pc['z']}-1.6; {K}.pj.rot=Math.PI; {K}.cam.yaw=Math.PI+0.6; {K}.cam.pitch=0.4; {K}.cam.dist=6")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/19_portillo_abierto.png')

    print('PC: personaje del taller (camisa y calzas de lino; anda, corre y tala)')
    try:
        pg.wait_for_function(f'{K}.jugador.mh || {K}.jugador.error', timeout=180000)
    except Exception:
        pass
    mh = ev(f"!!{K}.jugador.mh")
    comprobar('carga el personaje del taller (no el muñeco)', mh, ev(f"{K}.jugador.error || ''"))
    if mh:
        vis = ev(f"""(() => {{ const v = {{}}; {K}.jugador.mh.modelo.traverse(n => {{ if (n.isMesh) v[n.name] = n.visible; }}); return v; }})()""")
        comprobar('lleva camisa y calzas', vis.get('hombre_capa_camisa') and vis.get('hombre_capa_calzas'))
        comprobar('sin túnica ni armadura (y con zapatos: sin ellos el cuerpo del taller no tiene pies)', vis.get('hombre_capa_zapatos') and not any(vis.get(f'hombre_capa_{c}') for c in ['tunica', 'gambeson', 'cota', 'sobreveste']),
                  ', '.join(k for k, x in vis.items() if x))
        modos = ev(f"(() => {{ const j = {K}.jugador, r = []; for (const [v, t] of [[1.0, false], [3.6, false], [6, false], [0, false], [0, true]]) {{ j.animar(v, 0.016, t); r.push(j.modo + ':' + j.mh.acciones[j.modo].timeScale.toFixed(2)); }} return r; }})()")
        comprobar('andar, correr, quieto y talar según la velocidad', [m.split(':')[0] for m in modos] == ['andar', 'correr', 'correr', 'quieto', 'talar'], ', '.join(modos))
        comprobar('la animación se acelera con la velocidad (tope 1,6×)', modos[1].endswith('1.39') and modos[2].endswith('1.60'), ', '.join(modos))
        # junto a un árbol: Usar tala; moverse lo para
        ev(f"""(() => {{ const K = {K}; K.cambiarModo('mover'); const a = K.obstaculos.filter(o => o.arbol).sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z))[0];
            const d = Math.hypot(a.x, a.z); K.pj.k = 0; K.pj.x = a.x - a.x / d * (a.r + 0.6); K.pj.z = a.z - a.z / d * (a.r + 0.6); K.pj.y = 0;
            K.cam.yaw = Math.atan2(-a.x, -a.z) + 0.9; K.cam.pitch = 0.3; K.cam.dist = 4.2; }})()""")
        esperar(pg, 300)
        ev(f"{K}.usar()")
        esperar(pg, 1200)
        comprobar('Usar junto a un árbol: tala', ev(f"!!{K}.estado.talando && {K}.jugador.modo === 'talar'"), ev(f"{K}.jugador.modo"))
        comprobar('el botón Usar se enciende junto al árbol', ev("document.getElementById('btnUsar').classList.contains('activo')"))
        pg.screenshot(path=f'{SALIDA}/17_personaje_talando.png')
        pg.keyboard.down('w'); esperar(pg, 500)
        comprobar('moverse deja de talar', ev(f"!{K}.estado.talando && {K}.jugador.modo !== 'talar'"), ev(f"{K}.jugador.modo"))
        pg.keyboard.up('w')
        # de cerca, quieto y andando, junto a la cabaña
        ev(f"{K}.pj.x=2; {K}.pj.z=-2.5; {K}.pj.k=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI*0.95; {K}.cam.pitch=0.25; {K}.cam.dist=3.6")
        esperar(pg, 1500)
        pg.screenshot(path=f'{SALIDA}/18_personaje_de_cerca.png')
        ev(f"{K}.pj.rot=Math.PI*0.2; {K}.cam.yaw=Math.PI*1.2")
        esperar(pg, 900)
        pg.screenshot(path=f'{SALIDA}/19_personaje_de_espaldas.png')
        pg.keyboard.down('Shift'); pg.keyboard.down('a'); esperar(pg, 700)
        pg.screenshot(path=f'{SALIDA}/20_personaje_corriendo.png')
        comprobar('corre con Mayús', ev(f"{K}.jugador.modo") == 'correr', ev(f"{K}.jugador.modo"))
        pg.keyboard.up('a'); pg.keyboard.up('Shift')

    print('PC: barra de construcción')
    ev(f"{K}.cambiarModo('construir'); {K}.seleccionar('pieza','muro_entramado'); {K}.pj.x=2; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.3; {K}.cam.pitch=0.85; {K}.cam.dist=15; {K}.estado.planta=0; {K}.apuntar(-1, 3)")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/05_barra_construccion_pc.png')

    comprobar('sin errores en consola (PC)', len(errores) == 0, '; '.join(errores[:3]))
    estado = pg.evaluate("localStorage.getItem('kinhold_h1_v1')")
    pg.close()

    # ---------- Móvil ----------
    print('Móvil')
    ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True, locale='es-ES')
    mv = ctx.new_page()
    err2 = []
    mv.on('pageerror', lambda e: err2.append(str(e)))
    mv.goto(URL)
    mv.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    mv.evaluate(f"localStorage.setItem('kinhold_h1_v1', {json.dumps(estado)}); location.reload()")
    mv.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    mv.wait_for_timeout(800)
    comprobar('joystick visible en táctil', mv.is_visible('#joystick'))
    mv.evaluate(f"{K}.pj.x=1; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.5; {K}.cam.pitch=0.85; {K}.cam.dist=20")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06_movil_mover.png')
    mv.evaluate(f"{K}.pj.x=10.2; {K}.pj.z=-15; {K}.pj.k=0; {K}.cam.yaw=Math.PI-0.6; {K}.cam.pitch=0.5; {K}.cam.dist=11")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06b_movil_escalera.png')
    mv.click('#modos button[data-modo=construir]')
    mv.evaluate(f"{K}.seleccionar('pieza','cim_tronco'); {K}.apuntar(-2, 2)")
    mv.wait_for_timeout(700)
    comprobar('botón Colocar visible al construir en táctil', mv.is_visible('#btnColocar'))
    try:
        mv.wait_for_function(f'{K}.jugador.mh || {K}.jugador.error', timeout=180000)
    except Exception:
        pass
    comprobar('carga el personaje del taller en el móvil', mv.evaluate(f"!!{K}.jugador.mh"))
    mv.screenshot(path=f'{SALIDA}/07_movil_construir.png')
    mv.click('#modos button[data-modo=mover]')
    mv.evaluate(f"{K}.pj.x=2; {K}.pj.z=-2.5; {K}.pj.k=0; {K}.pj.rot=Math.PI*0.8; {K}.cam.yaw=Math.PI*0.95; {K}.cam.pitch=0.3; {K}.cam.dist=4.5")
    mv.wait_for_timeout(1200)
    mv.screenshot(path=f'{SALIDA}/07b_movil_personaje_de_cerca.png')
    comprobar('sin errores en consola (móvil)', len(err2) == 0, '; '.join(err2[:3]))
    nav.close()

print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
