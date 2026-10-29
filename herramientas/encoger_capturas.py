#!/usr/bin/env python3
# Rehace más pequeñas las capturas viejas de la web (lo decidió valravnx el 29 oct: la web por debajo de 1 GB).
# «Viejas» = todas las carpetas de docs/capturas/ menos la de la última versión de cada prototipo y la prueba de estilo
# aprobada (estilo-v5, la referencia de todo lo que se ve), que se quedan como están.
# Cada imagen cuyo lado mayor pase de LADO se reduce a ese lado (sin cambiar el nombre ni el formato: JPG) y solo se
# guarda si sale más pequeña. Repetirlo no las degrada: las que ya caben no se tocan.
# Uso: python3 herramientas/encoger_capturas.py            (encoge y dice el tamaño antes y después)
#      python3 herramientas/encoger_capturas.py --medir    (solo mide)
import io, json, os, sys
from PIL import Image

RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CAPTURAS = os.path.join(RAIZ, 'docs', 'capturas')
LADO = 960
CALIDAD = 72
FIJAS = {'estilo-v5'}


def recientes():
    with open(os.path.join(RAIZ, 'proyecto', 'roadmap.json'), encoding='utf-8') as f:
        roadmap = json.load(f)
    r = set(FIJAS)
    for p in roadmap['prototipos']:
        for v in p['versiones'][-1:]:
            if v.get('capturas'):
                r.add(v['capturas'].split('/')[-1])
    return r


def tamano(ruta):
    return sum(os.path.getsize(os.path.join(d, f)) for d, _, fs in os.walk(ruta) for f in fs)


def main():
    medir = '--medir' in sys.argv
    antes = tamano(CAPTURAS)
    quedan = recientes()
    tocadas = 0
    for carpeta in sorted(os.listdir(CAPTURAS)):
        ruta = os.path.join(CAPTURAS, carpeta)
        if carpeta in quedan or not os.path.isdir(ruta):
            continue
        for nombre in sorted(os.listdir(ruta)):
            if not nombre.lower().endswith(('.jpg', '.jpeg')):
                continue
            f = os.path.join(ruta, nombre)
            im = Image.open(f)
            if max(im.size) <= LADO:
                continue
            if medir:
                tocadas += 1
                continue
            k = LADO / max(im.size)
            nueva = im.convert('RGB').resize((round(im.size[0] * k), round(im.size[1] * k)), Image.LANCZOS)
            b = io.BytesIO()
            nueva.save(b, 'JPEG', quality=CALIDAD, optimize=True, progressive=True)
            if b.tell() < os.path.getsize(f):
                with open(f, 'wb') as s:
                    s.write(b.getvalue())
                tocadas += 1
    despues = tamano(CAPTURAS)
    print(f'Se quedan como están: {", ".join(sorted(quedan))}')
    print(f'{"Por encoger" if medir else "Encogidas"}: {tocadas} capturas')
    print(f'docs/capturas: {antes / 2**20:.0f} MB antes, {despues / 2**20:.0f} MB después')


if __name__ == '__main__':
    main()
