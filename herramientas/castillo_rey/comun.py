import json, math
import os
d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'terreno.json'))); N = d['N']; X0 = d['x0']; Z0 = d['z0']; P = d['P']   # (terreno.json: lo escribe terreno.mjs)
def h(x, z):
    i = (x - X0) / P - .5; j = (z - Z0) / P - .5
    i0, j0 = int(math.floor(i)), int(math.floor(j)); fi, fj = i - i0, j - j0
    g = lambda a, b: d['h'][min(N - 1, max(0, b)) * N + min(N - 1, max(0, a))]
    return (g(i0, j0) * (1 - fi) + g(i0 + 1, j0) * fi) * (1 - fj) + (g(i0, j0 + 1) * (1 - fi) + g(i0 + 1, j0 + 1) * fi) * fj
def t(x, z):
    i = int((x - X0) / P); j = int((z - Z0) / P)
    return d['t'][min(N - 1, max(0, j)) * N + min(N - 1, max(0, i))]
def suaviza(pts, n=3):
    for _ in range(n):
        pts = [pts[0]] + [((pts[k - 1][0] + 2 * pts[k][0] + pts[k + 1][0]) / 4, (pts[k - 1][1] + 2 * pts[k][1] + pts[k + 1][1]) / 4) for k in range(1, len(pts) - 1)] + [pts[-1]]
    return pts
def curva(altura, xa, xb, paso=4):
    """la curva de nivel: para cada x, subiendo desde el río (sur) hacia el norte, donde el suelo pasa de esa altura"""
    pts = []
    for x in range(xa, xb + 1, paso):
        z = 53130
        while z > 52850 and (t(x, z) != 0 or h(x, z) < altura): z -= 1
        pts.append((x, z))
    return suaviza(pts)
def orilla_rio(xa, xb, paso=4):
    pts = []
    for x in range(xa, xb + 1, paso):
        z = 52990
        while z < 53200 and t(x, z) == 0: z += 1
        pts.append((x, z))
    return suaviza(pts)
def largo(pts): return sum(math.dist(pts[k], pts[k + 1]) for k in range(len(pts) - 1))
def dist_seg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx * dx + dy * dy or 1
    s = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L))
    return math.hypot(p[0] - a[0] - dx * s, p[1] - a[1] - dy * s)
def dist_linea(p, pts): return min(dist_seg(p, pts[k], pts[k + 1]) for k in range(len(pts) - 1))
def dentro(p, pol):
    x, y = p; c = False
    for k in range(len(pol)):
        x1, y1 = pol[k]; x2, y2 = pol[k - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1: c = not c
    return c
def punto_en(pts, s):   # el punto a s metros a lo largo de la línea
    for k in range(len(pts) - 1):
        l = math.dist(pts[k], pts[k + 1])
        if s <= l: f = s / l; return (pts[k][0] + (pts[k + 1][0] - pts[k][0]) * f, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * f)
        s -= l
    return pts[-1]

