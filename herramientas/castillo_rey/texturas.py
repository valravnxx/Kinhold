# Texturas del castillo del rey, por código (numpy): color y relieve (mapa de normales) que se repiten sin costuras.
# Cada una cubre un trozo de pared o de suelo de tamaño real (TAM, en metros): la malla lleva las UV en metros y el
# juego repite la textura cada TAM metros. El color es un gris cálido de media ≈ 0,85 con matices por piedra: el tono lo
# pone el color de los vértices (como el estilo v5), y la textura da la piedra, las juntas, el desgaste y el relieve.
#
# Método (el de los generadores de materiales): para cada pieza (sillar, mampuesto, losa, canto, teja, tabla) un campo
# de alturas con el borde redondeado y desportillado, ruido fractal periódico encima, juntas hundidas; del campo de
# alturas sale el mapa de normales (Sobel) y una oclusión de cavidad que oscurece juntas y grietas; el color lleva la
# variación por pieza, manchas, líquenes y la oclusión.
import os, sys, json, math
import numpy as np
from PIL import Image

AQUI = os.path.dirname(os.path.abspath(__file__))
DEST = os.environ.get('DEST_TEX', os.path.join(AQUI, '..', '..', 'docs', 'recursos', 'mundo', 'castillo-rey-v2', 'tex'))
PXM = 256    # píxeles por metro

def ruido(n, m, escala, sem, oct=5, pers=0.55):
    """ruido fractal periódico (n × m), por FFT: suma de octavas de ruido filtrado; media 0, desviación ≈ 1"""
    rng = np.random.default_rng(sem)
    tot = np.zeros((n, m)); amp = 1.0; s = escala; tam = 0
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(m)[None, :]
    f = np.sqrt(fx ** 2 + fy ** 2)
    for o in range(oct):
        w = rng.standard_normal((n, m))
        filtro = np.exp(-(f * s) ** 2 * 4.0)
        r = np.real(np.fft.ifft2(np.fft.fft2(w) * filtro))
        r /= r.std() + 1e-9
        tot += r * amp; tam += amp; amp *= pers; s /= 2.0
    return tot / tam

def suave(a, r):
    """desenfoque periódico gaussiano de radio r píxeles"""
    n, m = a.shape
    fy = np.fft.fftfreq(n)[:, None]; fx = np.fft.fftfreq(m)[None, :]
    g = np.exp(-2 * (math.pi * r) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))

def normales(alt, fuerza):
    """mapa de normales (espacio tangente, +Y arriba en la imagen = +v) del campo de alturas (en metros); sin el grano
       más fino, que de lejos y de lado hace un tramado de tela"""
    alt = suave(alt, 1.3)
    dx = (np.roll(alt, -1, 1) - np.roll(alt, 1, 1)) * PXM / 2
    dy = (np.roll(alt, -1, 0) - np.roll(alt, 1, 0)) * PXM / 2
    nx, ny, nz = -dx * fuerza, dy * fuerza, np.ones_like(alt)
    l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return np.stack([nx / l, ny / l, nz / l], -1) * 0.5 + 0.5

def cavidad(alt, r=6, k=40.0):
    """oclusión de cavidad: lo que está por debajo de su entorno se oscurece (sin el grano fino: no hace «granito»)"""
    a = suave(alt, 1.5)
    d = a - suave(a, r)
    return np.clip(1 + d * k, 0.45, 1.08)

def guardar(nombre, col, alt, fuerza=1.0, mapa_normales=True):
    os.makedirs(DEST, exist_ok=True)
    c8 = (np.clip(col, 0, 1) ** (1 / 1.0) * 255).round().astype(np.uint8)
    Image.fromarray(c8).save(os.path.join(DEST, nombre + '.webp'), quality=88, method=6)
    if mapa_normales:
        n8 = (normales(alt, fuerza) * 255).round().astype(np.uint8)
        Image.fromarray(n8).save(os.path.join(DEST, nombre + '_n.webp'), quality=92, method=6)

def tinte(rgb, n, m):
    return np.broadcast_to(np.array(rgb, dtype=np.float64), (n, m, 3)).copy()

def bloques(n, m, filas, sem, ancho_min, ancho_max, desfase=True):
    """aparejo: filas de alturas dadas (px) y bloques de ancho variable; devuelve id del bloque, distancia al borde (px)"""
    rng = np.random.default_rng(sem)
    ids = np.zeros((n, m), dtype=np.int32); dist = np.zeros((n, m)); k = 0
    y = 0
    for fh in filas:
        x = int(rng.uniform(0, ancho_max)) if desfase else 0
        cortes = []
        while True:
            w = int(rng.uniform(ancho_min, ancho_max)); cortes.append(x % m); x += w
            if x - cortes[0] >= m - ancho_min * 0.6: break
        cortes = sorted(set(cortes))
        yy = np.arange(y, y + fh)
        for i, c0 in enumerate(cortes):
            c1 = cortes[(i + 1) % len(cortes)]
            w = (c1 - c0) % m or m
            xs = (c0 + np.arange(w)) % m
            ids[np.ix_(yy, xs)] = k
            dx = np.minimum(np.arange(w), w - 1 - np.arange(w))[None, :]
            dy = np.minimum(np.arange(fh), fh - 1 - np.arange(fh))[:, None]
            dist[np.ix_(yy, xs)] = np.minimum(dx, dy)
            k += 1
        y += fh
    return ids, dist

def por_bloque(ids, sem, f):
    rng = np.random.default_rng(sem); n = ids.max() + 1
    v = f(rng, n)
    return v[ids]

# ---------------------------------------------------------------- sillería (sillares de 0,35–0,55 m de alto)
def silleria():
    W, H = 4 * PXM, 2 * PXM
    filas = [int(x * PXM) for x in (0.42, 0.55, 0.38, 0.65)]   # suma 2,0 m
    ids, dist = bloques(H, W, filas, 3, 0.55 * PXM, 1.25 * PXM)
    N1 = ruido(H, W, 14, 1, 3); N2 = ruido(H, W, 30, 2, 4); N3 = ruido(H, W, 80, 3, 3)
    junta = 0.018 * PXM                                   # media junta (px)
    borde = dist + N2 * 2.5 + N3 * 3.0 - junta            # el borde, desportillado
    redondeo = np.clip(borde / (0.045 * PXM), 0, 1)
    perfil = np.sin(redondeo * math.pi / 2) ** 0.8         # cara del sillar, que cae hacia la junta
    cara = por_bloque(ids, 5, lambda r, n: r.normal(0, 0.006, n)) + N1 * 0.004 + N3 * 0.0012
    alt = np.where(borde > 0, 0.02 * perfil + cara, -0.004 + N1 * 0.001)
    # color: piedra (variación de tono por sillar), mortero, líquenes y manchas
    luz = por_bloque(ids, 7, lambda r, n: r.normal(1.0, 0.07, n))
    calido = por_bloque(ids, 8, lambda r, n: r.normal(0.0, 1.0, n))
    calido = np.clip(calido, -1.5, 1.5)
    piedra = np.stack([luz * (0.90 + 0.03 * calido), luz * (0.87 + 0.015 * calido), luz * (0.82 - 0.005 * calido)], -1)
    piedra *= (1 + N3[..., None] * 0.06 + N2[..., None] * 0.015)
    # regueros de agua: oscuros, verticales (a lo largo de y), más fuertes arriba de cada sillar
    reg = np.real(np.fft.ifft2(np.fft.fft2(np.random.default_rng(12).standard_normal((H, W))) * np.exp(-((np.fft.fftfreq(W)[None, :] * 25) ** 2 + (np.fft.fftfreq(H)[:, None] * 300) ** 2))))
    reg /= reg.std()
    piedra *= (1 - np.clip(reg - 1.2, 0, 1)[..., None] * 0.18)
    mortero = tinte((0.80, 0.77, 0.70), H, W) * (1 + N3[..., None] * 0.06)
    col = np.where((borde > 0)[..., None], piedra, mortero)
    liq = np.clip((ruido(H, W, 18, 9, 3) - 1.6) * 3, 0, 1)[..., None]
    col = col * (1 - liq) + liq * np.array([0.86, 0.88, 0.70])
    mancha = np.clip(ruido(H, W, 60, 11, 3) * 0.5 + 0.5, 0, 1)[..., None]
    col *= 0.9 + 0.12 * mancha
    col *= cavidad(alt, 6, 25)[..., None]
    guardar('sillar', col * 0.93, alt, 1.4)

# ---------------------------------------------------------------- mampostería (mampuestos irregulares en hiladas)
def mamposteria():
    W, H = 4 * PXM, 2 * PXM
    rng = np.random.default_rng(21)
    # semillas en hiladas irregulares; cada píxel, a su semilla más cercana (con métrica algo aplastada: piedras tumbadas)
    pts = []
    y = 0.0
    while y < 2.0:
        hh = rng.uniform(0.16, 0.30); x = rng.uniform(0, 0.3)
        while x < 4.0:
            ww = rng.uniform(0.22, 0.48); pts.append((x + ww / 2 + rng.normal(0, 0.03), y + hh / 2 + rng.normal(0, 0.025), ww, hh)); x += ww
        y += hh
    P = np.array(pts)
    yy, xx = np.mgrid[0:H, 0:W] / PXM
    mejor = np.full((H, W), 1e9); seg = np.full((H, W), 1e9); ids = np.zeros((H, W), dtype=np.int32)
    for i, (px, py, ww, hh) in enumerate(P):
        for ox in (-4, 0, 4):
            for oy in (-2, 0, 2):
                d = np.sqrt(((xx - px - ox) / (ww * 0.55)) ** 2 + ((yy - py - oy) / (hh * 0.55)) ** 2)
                nuevo = d < mejor
                seg = np.where(nuevo, mejor, np.minimum(seg, d)); ids = np.where(nuevo, i, ids); mejor = np.where(nuevo, d, mejor)
    N2 = ruido(H, W, 24, 22, 4); N3 = ruido(H, W, 70, 23, 3); N1 = ruido(H, W, 5, 24)
    borde = (seg - mejor) * 0.5 + N2 * 0.06 + N3 * 0.05 - 0.10
    redondeo = np.clip(borde / 0.35, 0, 1)
    alt = np.where(borde > 0, 0.035 * np.sqrt(redondeo) + por_bloque(ids, 25, lambda r, n: r.normal(0, 0.008, n)) + N3 * 0.002, -0.012 + N1 * 0.002)
    luz = por_bloque(ids, 26, lambda r, n: r.normal(1.0, 0.09, n)); cal = por_bloque(ids, 27, lambda r, n: r.normal(0, 1, n))
    cal = np.clip(cal, -1.2, 1.5); luz = np.clip(luz, 0.82, 1.12)
    piedra = np.stack([luz * (0.89 + 0.035 * cal), luz * (0.86 + 0.02 * cal), luz * (0.80 + 0.0 * cal)], -1) * (1 + N3[..., None] * 0.06)
    mortero = tinte((0.78, 0.74, 0.66), H, W) * (1 + N3[..., None] * 0.08)
    col = np.where((borde > 0)[..., None], piedra, mortero)
    col *= cavidad(alt, 5, 18)[..., None]
    col *= (0.9 + 0.12 * np.clip(ruido(H, W, 50, 28, 3) * 0.5 + 0.5, 0, 1))[..., None]
    guardar('mamp', col * 0.93, alt, 1.6)

# ---------------------------------------------------------------- piedra labrada suelta (dovelas, peldaños, albardillas)
def piedra_labrada():
    W = H = 2 * PXM
    N1 = ruido(H, W, 8, 31); N2 = ruido(H, W, 30, 32, 4); N3 = ruido(H, W, 90, 33, 3)
    alt = N1 * 0.003 + N2 * 0.0015 + N3 * 0.0008
    col = tinte((0.92, 0.89, 0.83), H, W) * (1 + N3[..., None] * 0.05 + N2[..., None] * 0.05)
    # golpes de trinchante (rayado fino diagonal)
    yy, xx = np.mgrid[0:H, 0:W]
    raya = (np.sin((xx + yy * 0.6) * 0.9 + N2 * 3) > 0.92) * 0.0006
    alt += raya
    col *= cavidad(alt, 4, 60)[..., None]
    liq = np.clip((ruido(H, W, 16, 34, 3) - 1.7) * 3, 0, 1)[..., None]
    col = col * (1 - liq) + liq * np.array([0.86, 0.88, 0.70])
    guardar('piedra', col * 0.97, alt, 1.2)

# ---------------------------------------------------------------- enlosado (losas irregulares, 3 × 3 m)
def losas(nombre='losa', tam=3, sem=41, lado=(0.45, 0.85), junta=0.025, canto=False):
    W = H = tam * PXM
    rng = np.random.default_rng(sem)
    pts = []
    if canto:   # cantos rodados: puntos casi en rejilla, más pequeños
        paso = 0.17
        for j in range(int(tam / paso)):
            for i in range(int(tam / paso)):
                pts.append(((i + 0.5 + rng.normal(0, 0.18)) * paso, (j + 0.5 + rng.normal(0, 0.18)) * paso, paso, paso))
    else:
        y = 0.0
        while y < tam - 0.05:
            hh = rng.uniform(*lado); x = rng.uniform(0, 0.4)
            while x < tam:
                ww = rng.uniform(*lado); pts.append((x + ww / 2 + rng.normal(0, 0.05), y + hh / 2 + rng.normal(0, 0.05), ww, hh)); x += ww
            y += hh
    P = np.array(pts)
    yy, xx = np.mgrid[0:H, 0:W] / PXM
    mejor = np.full((H, W), 1e9); seg = np.full((H, W), 1e9); ids = np.zeros((H, W), dtype=np.int32)
    for i, (px, py, ww, hh) in enumerate(P):
        for ox in (-tam, 0, tam):
            for oy in (-tam, 0, tam):
                if abs(px + ox - tam / 2) > tam / 2 + ww or abs(py + oy - tam / 2) > tam / 2 + hh: continue
                d = np.hypot(xx - px - ox, yy - py - oy) / (0.5 * (ww + hh) / 2)
                nuevo = d < mejor
                seg = np.where(nuevo, mejor, np.minimum(seg, d)); ids = np.where(nuevo, i, ids); mejor = np.where(nuevo, d, mejor)
    N2 = ruido(H, W, 24, sem + 1, 4); N3 = ruido(H, W, 80, sem + 2, 3)
    borde = (seg - mejor) * (0.5 if not canto else 0.9) + N2 * 0.04 - (junta * 4)
    r = np.clip(borde / (0.25 if not canto else 0.6), 0, 1)
    alt = np.where(borde > 0, (0.012 if not canto else 0.022) * (np.sqrt(r) if not canto else np.sin(r * math.pi / 2)) + por_bloque(ids, sem + 3, lambda q, n: q.normal(0, 0.004, n)) + N3 * 0.001, -0.01)
    luz = por_bloque(ids, sem + 4, lambda q, n: q.normal(1.0, 0.08, n)); cal = por_bloque(ids, sem + 5, lambda q, n: q.normal(0, 1, n))
    cal = np.clip(cal, -1.2, 1.5); luz = np.clip(luz, 0.84, 1.12)
    piedra = np.stack([luz * (0.90 + 0.035 * cal), luz * (0.87 + 0.02 * cal), luz * (0.81 + 0.0 * cal)], -1) * (1 + N3[..., None] * 0.05)
    if canto: piedra *= (0.88 + 0.12 * r)[..., None]   # redondos: algo más oscuros hacia el borde
    tierra = tinte((0.74, 0.67, 0.54) if canto else (0.66, 0.59, 0.47), H, W) * (1 + N2[..., None] * 0.1)
    musgo = np.clip(ruido(H, W, 20, sem + 6, 3) * 0.6 + 0.2, 0, 1)[..., None]
    junta_col = tierra * (1 - musgo * 0.6) + musgo * 0.6 * np.array([0.42, 0.50, 0.30])
    col = np.where((borde > 0)[..., None], piedra, junta_col)
    col *= cavidad(alt, 5, 5 if canto else 18)[..., None]
    guardar(nombre, col * 0.93, alt, 1.4)

# ---------------------------------------------------------------- madera (vetas a lo largo de v), tablas de suelo
def madera(nombre='madera', tablas=False):
    W = H = 2 * PXM
    yy, xx = np.mgrid[0:H, 0:W]
    N1 = ruido(H, W, 40, 51, 3)
    # vetas: ruido alargado a lo largo de y
    rng = np.random.default_rng(52)
    w = rng.standard_normal((H, W))
    fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.fftfreq(W)[None, :]
    veta = np.real(np.fft.ifft2(np.fft.fft2(w) * np.exp(-((fx * 4) ** 2 + (fy * 90) ** 2))))
    veta /= veta.std()
    fina = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((H, W))) * np.exp(-((fx * 1.5) ** 2 + (fy * 30) ** 2)))); fina /= fina.std()
    alt = veta * 0.0015 + fina * 0.0006
    l = 0.88 + veta * 0.06 + fina * 0.035 + N1 * 0.03
    if tablas:   # juntas entre tablas y clavos
        ancho = int(0.28 * PXM)
        j = (xx % ancho) < 3
        alt = np.where(j, alt - 0.006, alt); l = np.where(j, 0.45, l)
        for cx in range(ancho // 2, W, ancho):
            for cy in (int(0.3 * PXM), int(1.3 * PXM)):
                for dx in (-ancho // 4, ancho // 4):
                    d = np.hypot(xx - cx - dx, yy - cy); l = np.where(d < 3, 0.35, l)
    col = np.stack([l * 0.96, l * 0.9, l * 0.82], -1)
    col *= cavidad(alt, 3, 80)[..., None]
    guardar(nombre, col, alt, 1.0)

# ---------------------------------------------------------------- teja (piezas en hiladas: cada hilada 1/4 de la textura)
def teja():
    W, H = 2 * PXM, 1 * PXM          # 2 m de ancho, 4 hiladas de 0,25 m (la malla pone una hilada en cada 0,25 de v)
    rng = np.random.default_rng(61)
    fh = H // 4
    ids = np.zeros((H, W), dtype=np.int32); t_loc = np.zeros((H, W)); s_loc = np.zeros((H, W)); k = 0
    for r in range(4):
        x = int(rng.uniform(0, 40))
        cortes = []
        while x < W + 40:
            cortes.append(x); x += int(rng.uniform(0.16, 0.24) * PXM)
        for i in range(len(cortes) - 1):
            c0, c1 = cortes[i], cortes[i + 1]
            xs = np.arange(c0, c1) % W; yy = np.arange(r * fh, (r + 1) * fh)
            ids[np.ix_(yy, xs)] = k
            s_loc[np.ix_(yy, xs)] = ((np.arange(c0, c1) - c0) / (c1 - c0))[None, :]
            t_loc[np.ix_(yy, xs)] = (np.arange(fh) / fh)[:, None]
            k += 1
    N2 = ruido(H, W, 20, 62, 4); N3 = ruido(H, W, 60, 63, 3)
    # cada pieza: abombada a lo ancho, con el borde de abajo redondeado (en la imagen, abajo = el alero: t pequeño)
    comba = np.sin(s_loc * math.pi) ** 0.6
    alt = 0.01 * comba + t_loc * 0.006 + N3 * 0.0008
    canto = (s_loc < 0.04) | (s_loc > 0.96)
    alt = np.where(canto, alt - 0.006, alt)
    luz = por_bloque(ids, 64, lambda q, n: q.normal(1.0, 0.1, n)); cal = por_bloque(ids, 65, lambda q, n: q.normal(0, 1, n))
    cal = np.clip(cal, -1.5, 1.5)
    col = np.stack([luz * (0.93 + 0.035 * cal), luz * (0.87 + 0.015 * cal), luz * (0.81 - 0.02 * cal)], -1)
    gris = np.clip(ruido(H, W, 40, 68, 3) * 0.5 + 0.5, 0, 1)[..., None]
    col = col * (1 - 0.35 * gris) + 0.35 * gris * col.mean(-1, keepdims=True)   # tejas grises (las más viejas)
    col *= (0.85 + 0.15 * comba)[..., None] * (1 + N2[..., None] * 0.06)
    # el borde de abajo de cada pieza, oscuro (la sombra sobre la de debajo); líquenes y musgo
    col *= np.clip(0.55 + t_loc * 3, 0.55, 1)[..., None]
    liq = np.clip((ruido(H, W, 14, 66, 3) - 1.0) * 2.5, 0, 1)[..., None]
    col = col * (1 - liq) + liq * np.array([0.80, 0.83, 0.62])
    musgo = np.clip((ruido(H, W, 30, 67, 3) - 1.0) * 2, 0, 1)[..., None]
    col = col * (1 - musgo * 0.7) + musgo * 0.7 * np.array([0.45, 0.52, 0.30])
    col = np.flipud(col); alt = np.flipud(alt)    # (la fila 0 de la imagen es la v alta)
    guardar('teja', col, alt, 1.2)

# ---------------------------------------------------------------- paja, tela, tierra
def paja():
    W = H = 1 * PXM
    rng = np.random.default_rng(71)
    fy = np.fft.fftfreq(H)[:, None]; fx = np.fft.fftfreq(W)[None, :]
    f = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((H, W))) * np.exp(-((fx * 70) ** 2 + (fy * 3) ** 2)))); f /= f.std()
    alt = f * 0.004
    l = 0.85 + f * 0.1
    col = np.stack([l, l * 0.92, l * 0.72], -1) * cavidad(alt, 3, 60)[..., None]
    guardar('paja', col, alt, 1.4)

def tela():
    W = H = PXM // 2
    yy, xx = np.mgrid[0:H, 0:W]
    t = (np.sin(xx * 1.6) * np.sin(yy * 1.6)) * 0.0004
    N = ruido(H, W, 30, 81, 3)
    l = 0.88 + np.sin(xx * 1.6) * 0.03 + np.sin(yy * 1.6) * 0.03 + N * 0.03
    guardar('tela', np.stack([l, l, l], -1), t, 0.6)

def tierra():
    W = H = 4 * PXM
    N0 = ruido(H, W, 160, 90, 2); N1 = ruido(H, W, 24, 91, 2); N2 = ruido(H, W, 40, 92, 3); N3 = ruido(H, W, 120, 93, 3)
    alt = N1 * 0.002 + N2 * 0.002 + N3 * 0.002
    rng = np.random.default_rng(94); yy, xx = np.mgrid[0:H, 0:W]
    piedras = np.zeros((H, W))
    for _ in range(700):
        cx, cy, r = rng.uniform(0, W), rng.uniform(0, H), rng.uniform(1.5, 6)
        d = np.hypot((xx - cx + W / 2) % W - W / 2, (yy - cy + H / 2) % H - H / 2)
        piedras = np.maximum(piedras, np.sqrt(np.clip(1 - (d / r) ** 2, 0, 1)))
    alt += piedras * 0.004
    l = 0.86 + N0 * 0.07 + N2 * 0.05 + N3 * 0.04
    col = np.stack([l, l * 0.92, l * 0.80], -1)
    col = np.where((piedras > 0.05)[..., None], np.stack([l * 1.05, l * 1.03, l * 0.98], -1), col)
    # briznas y manchas de hierba seca
    seca = np.clip((ruido(H, W, 30, 95, 3) - 0.8) * 1.5, 0, 1)[..., None]
    col = col * (1 - seca * 0.5) + seca * 0.5 * np.array([0.80, 0.80, 0.55])
    col *= cavidad(alt, 4, 30)[..., None]
    guardar('tierra', col, alt, 1.0)

if __name__ == '__main__':
    pedidas = sys.argv[1:]
    hechas = {'sillar': silleria, 'mamp': mamposteria, 'piedra': piedra_labrada, 'losa': lambda: losas('losa'),
              'canto': lambda: losas('canto', 2, 45, canto=True), 'madera': madera, 'tabla': lambda: madera('tabla', True),
              'teja': teja, 'paja': paja, 'tela': tela, 'tierra': tierra}
    for k, fn in hechas.items():
        if pedidas and k not in pedidas: continue
        fn(); print('textura', k, flush=True)
