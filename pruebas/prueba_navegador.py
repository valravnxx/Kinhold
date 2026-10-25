# Prueba en navegador real (Chromium sin pantalla) del hito 1 de Kinhold.
# Construye una cabaña usando el propio juego, comprueba el estado y saca capturas.
import sys, os, json
from playwright.sync_api import sync_playwright

RUTA = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/kinhold_hito1.html')
SALIDA = sys.argv[2] if len(sys.argv) > 2 else 'capturas'
os.makedirs(SALIDA, exist_ok=True)
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
    pg.goto('file://' + RUTA)
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
    ev(f"{K}.pj.x=12.5; {K}.pj.z=-16; {K}.pj.k=0; {K}.cam.yaw=Math.PI+0.75; {K}.cam.pitch=0.42; {K}.cam.dist=8")
    esperar(pg, 900)
    pg.screenshot(path=f'{SALIDA}/14_escalera_de_tablas.png')

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
    mv.goto('file://' + RUTA)
    mv.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    mv.evaluate(f"localStorage.setItem('kinhold_h1_v1', {json.dumps(estado)}); location.reload()")
    mv.wait_for_function('window.__kinhold !== undefined', timeout=20000)
    mv.wait_for_timeout(800)
    comprobar('joystick visible en táctil', mv.is_visible('#joystick'))
    mv.evaluate(f"{K}.pj.x=1; {K}.pj.z=-4; {K}.cam.yaw=Math.PI+0.5; {K}.cam.pitch=0.85; {K}.cam.dist=20")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06_movil_mover.png')
    mv.evaluate(f"{K}.pj.x=12.5; {K}.pj.z=-16; {K}.pj.k=0; {K}.cam.yaw=Math.PI+0.75; {K}.cam.pitch=0.5; {K}.cam.dist=10")
    mv.wait_for_timeout(900)
    mv.screenshot(path=f'{SALIDA}/06b_movil_escalera.png')
    mv.click('#modos button[data-modo=construir]')
    mv.evaluate(f"{K}.seleccionar('pieza','cim_tronco'); {K}.apuntar(-2, 2)")
    mv.wait_for_timeout(700)
    comprobar('botón Colocar visible al construir en táctil', mv.is_visible('#btnColocar'))
    mv.screenshot(path=f'{SALIDA}/07_movil_construir.png')
    comprobar('sin errores en consola (móvil)', len(err2) == 0, '; '.join(err2[:3]))
    nav.close()

print(f"\nResultado: {'TODO CORRECTO' if not fallos else str(len(fallos)) + ' fallos: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
