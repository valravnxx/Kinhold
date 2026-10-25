# Comprueba que el taller de personajes está montado con las versiones fijadas en versiones.json
# (Python, bpy = Blender por pip, numpy, Pillow, el commit de MPFB2 y los paquetes de node).
# Lo llaman al empezar vestir_mpfb.py y mpfb_prueba.py: si algo no coincide, paran y dicen qué.
# Uso:
#   python3 herramientas/taller/comprobar_taller.py                 comprueba y enseña la tabla (sale con error si no coincide)
#   python3 herramientas/taller/comprobar_taller.py --anotar f.json  además guarda lo encontrado en f.json
#   python3 herramientas/taller/comprobar_taller.py --prueba        prueba sin Blender: formato de versiones.json y que
#                                                                   una diferencia se detecta (MUTAR=1 la rompe a propósito)
import json, os, re, subprocess, sys
from importlib import metadata

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.normpath(os.path.join(AQUI, '..', '..'))
VERSIONES = os.path.join(AQUI, 'versiones.json')


def esperado():
    with open(VERSIONES, encoding='utf-8') as f:
        return json.load(f)


def carpeta_mpfb(version_bpy):
    """donde Blender busca la extensión: ~/.config/blender/<mayor.menor>/extensions/user_default/mpfb"""
    mm = '.'.join(version_bpy.split('.')[:2])
    return os.path.expanduser(f'~/.config/blender/{mm}/extensions/user_default/mpfb')


def _orden(args, cwd=None):
    try:
        return subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=30).stdout.strip()
    except Exception:
        return ''


def encontrado(esp):
    e = {'python': '%d.%d' % sys.version_info[:2], 'pip': {}, 'mpfb2': {}, 'node': '', 'npm': {}}
    for p in esp['pip']:
        try:
            e['pip'][p] = metadata.version(p)
        except metadata.PackageNotFoundError:
            e['pip'][p] = 'falta'
    mp = carpeta_mpfb(esp['pip']['bpy'])
    if os.path.isdir(mp):
        real = os.path.realpath(mp)
        e['mpfb2']['carpeta'] = real
        e['mpfb2']['commit'] = _orden(['git', 'rev-parse', 'HEAD'], cwd=real) or 'sin git'
        e['mpfb2']['cambios_locales'] = bool(_orden(['git', 'status', '--porcelain', '.'], cwd=real))
        man = os.path.join(real, 'blender_manifest.toml')
        if os.path.exists(man):
            m = re.search(r'^version\s*=\s*"([^"]+)"', open(man, encoding='utf-8').read(), re.M)
            e['mpfb2']['version'] = m.group(1) if m else '?'
    else:
        e['mpfb2'] = {'commit': 'falta', 'version': 'falta', 'carpeta': mp + ' (no existe)'}
    e['node'] = _orden(['node', '--version']).lstrip('v') or 'falta'
    for p in esp['npm']:
        f = os.path.join(RAIZ, 'node_modules', p, 'package.json')
        e['npm'][p] = json.load(open(f, encoding='utf-8'))['version'] if os.path.exists(f) else 'falta'
    return e


def diferencias(esp, enc):
    """lista de diferencias legibles entre lo fijado y lo encontrado (vacía si todo coincide)"""
    d = []
    if enc['python'] != esp['python']:
        d.append(f"Python {enc['python']} (fijado {esp['python']})")
    for p, v in esp['pip'].items():
        if enc['pip'].get(p) != v:
            d.append(f"pip {p} {enc['pip'].get(p, 'falta')} (fijado {v})")
    for k in ('commit', 'version'):
        if enc['mpfb2'].get(k) != esp['mpfb2'][k]:
            d.append(f"MPFB2 {k} {enc['mpfb2'].get(k, 'falta')} (fijado {esp['mpfb2'][k]})")
    if enc['mpfb2'].get('cambios_locales'):
        d.append('MPFB2 tiene cambios locales sin guardar en su repositorio')
    if enc['node'].split('.')[0] != esp['node']:
        d.append(f"node {enc['node']} (fijado {esp['node']}.x)")
    for p, v in esp['npm'].items():
        if enc['npm'].get(p) != v:
            d.append(f"npm {p} {enc['npm'].get(p, 'falta')} (fijado {v})")
    return d


def comprobar(anotar=None):
    """para llamar al empezar los programas del taller: para si algo no coincide y deja anotado lo encontrado"""
    esp = esperado()
    enc = encontrado(esp)
    d = diferencias(esp, enc)
    print('Taller: Python %s · bpy %s · MPFB2 %s (%s) · node %s' % (
        enc['python'], enc['pip'].get('bpy'), enc['mpfb2'].get('version'), str(enc['mpfb2'].get('commit'))[:10], enc['node']))
    if anotar:
        os.makedirs(os.path.dirname(os.path.abspath(anotar)), exist_ok=True)
        with open(anotar, 'w', encoding='utf-8') as f:
            json.dump({'encontrado': enc, 'diferencias': d}, f, ensure_ascii=False, indent=1)
    if d:
        print('El taller no está montado con las versiones fijadas (herramientas/taller/versiones.json):')
        for x in d:
            print('  -', x)
        print('Para montarlo: bash herramientas/taller/montar_taller.sh  (guía: herramientas/taller/LEEME.md)')
        print('Para seguir aun así (solo para probar, no para publicar): TALLER_SIN_COMPROBAR=1')
        if os.environ.get('TALLER_SIN_COMPROBAR') != '1':
            sys.exit(1)
    return enc


def prueba():
    """sin Blender: el formato de versiones.json y que las diferencias se detectan"""
    fallos = []
    esp = esperado()
    exacta = re.compile(r'^\d+\.\d+\.\d+$')
    if not re.fullmatch(r'\d+\.\d+', esp.get('python', '')):
        fallos.append('python debe ser mayor.menor')
    for grupo in ('pip', 'npm'):
        for p, v in esp.get(grupo, {}).items():
            if not exacta.match(v):
                fallos.append(f'{grupo} {p}: versión no exacta «{v}»')
    for p in ('bpy', 'numpy', 'pillow'):
        if p not in esp.get('pip', {}):
            fallos.append(f'falta pip {p}')
    if not re.fullmatch(r'[0-9a-f]{40}', esp.get('mpfb2', {}).get('commit', '')):
        fallos.append('el commit de MPFB2 debe ser el hash completo (40 cifras)')
    if not re.fullmatch(r'\d+', esp.get('node', '')):
        fallos.append('node debe ser solo la versión mayor')
    # un entorno idéntico no da diferencias; uno con otra versión de bpy y otro commit, sí (y las dos)
    igual = {'python': esp['python'], 'pip': dict(esp['pip']), 'node': esp['node'] + '.0.0', 'npm': dict(esp['npm']),
             'mpfb2': {'commit': esp['mpfb2']['commit'], 'version': esp['mpfb2']['version'], 'cambios_locales': False}}
    if diferencias(esp, igual):
        fallos.append('un entorno igual da diferencias: ' + '; '.join(diferencias(esp, igual)))
    otro = json.loads(json.dumps(igual))
    if os.environ.get('MUTAR') != '1':
        otro['pip']['bpy'] = '5.1.0'
        otro['mpfb2']['commit'] = '0' * 40
    d = diferencias(esp, otro)
    if not (any('bpy' in x for x in d) and any('commit' in x for x in d)):
        fallos.append('no detecta otra versión de bpy ni otro commit de MPFB2')
    # la guía y el montaje leen las versiones de versiones.json, no las repiten a mano
    montar = open(os.path.join(AQUI, 'montar_taller.sh'), encoding='utf-8').read()
    if 'versiones.json' not in montar or esp['pip']['bpy'] in montar or esp['mpfb2']['commit'] in montar:
        fallos.append('montar_taller.sh debe leer las versiones de versiones.json (sin copiarlas)')
    if not os.path.exists(os.path.join(AQUI, 'LEEME.md')):
        fallos.append('falta la guía LEEME.md')
    for f in fallos:
        print('FALLA:', f)
    print('Taller (versiones fijadas): %s' % ('correcto' if not fallos else '%d fallos' % len(fallos)))
    sys.exit(1 if fallos else 0)


if __name__ == '__main__':
    if '--prueba' in sys.argv:
        prueba()
    ruta = sys.argv[sys.argv.index('--anotar') + 1] if '--anotar' in sys.argv else None
    os.environ['TALLER_SIN_COMPROBAR'] = '0'  # desde la línea de órdenes, siempre sale con error si no coincide
    enc = comprobar(ruta)
    print(json.dumps(enc, ensure_ascii=False, indent=1))
    print('Todo coincide con versiones.json.')
