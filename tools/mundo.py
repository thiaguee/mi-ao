"""Arma el mapa del mundo: ubica cada mapa en una grilla según sus salidas por los bordes
y genera una imagen de cada mapa (colores promedio de las baldosas).
Uso: python3 -I tools/mundo.py <carpeta juego>"""
import json, os, struct, sys
from collections import deque
from PIL import Image

ROOT = sys.argv[1]
MAPS = os.path.join(ROOT, 'server', 'data', 'mapas')
GFX = os.path.join(ROOT, 'client', 'assets', 'g')
OUT = os.path.join(ROOT, 'client', 'assets', 'mundo')
os.makedirs(OUT, exist_ok=True)
grh = json.load(open(os.path.join(ROOT, 'client', 'assets', 'data', 'grh.json')))

def read_map(n):
    p = os.path.join(MAPS, f'mapa{n}.map')
    if not os.path.exists(p): return None
    d = open(p, 'rb').read(); inf = open(os.path.join(MAPS, f'mapa{n}.inf'), 'rb').read()
    i = 2 + 263 + 8; j = 10
    L1 = [0] * 10000; L2 = [0] * 10000; L3 = [0] * 10000; B = [0] * 10000; exits = []
    for y in range(1, 101):
        for x in range(1, 101):
            k = (y - 1) * 100 + x - 1
            f = d[i]; i += 1
            B[k] = f & 1
            L1[k] = struct.unpack_from('<i', d, i)[0]; i += 4
            if f & 2: L2[k] = struct.unpack_from('<i', d, i)[0]; i += 4
            if f & 4: L3[k] = struct.unpack_from('<i', d, i)[0]; i += 4
            if f & 8: i += 4
            if f & 16: i += 2
            g = inf[j]; j += 1
            if g & 1:
                m, ex, ey = struct.unpack_from('<hhh', inf, j); j += 6
                exits.append((x, y, m, ex, ey))
            if g & 2: j += 2
            if g & 4: j += 4
    return L1, L2, L3, B, exits

def name_of(n):
    p = os.path.join(MAPS, f'mapa{n}.dat')
    try:
        for line in open(p, encoding='utf-8', errors='ignore'):
            if line.lower().startswith('name='): return line.split('=', 1)[1].strip()
    except OSError: pass
    return f'Mapa {n}'

def zona_of(n):
    p = os.path.join(MAPS, f'mapa{n}.dat')
    try:
        for line in open(p, encoding='utf-8', errors='ignore'):
            if line.lower().startswith('zona='): return line.split('=', 1)[1].strip().upper()
    except OSError: pass
    return ''

# --- color promedio de cada gráfico ---
imgs = {}; colors = {}
def frame(g):
    v = grh.get(str(g))
    if isinstance(v, dict): v = grh.get(str(v['f'][0])) if v['f'] else None
    return v if isinstance(v, list) else None
def color(g):
    if g in colors: return colors[g]
    c = None; fr = frame(g)
    if fr:
        f, sx, sy, w, h = fr
        if f not in imgs:
            p = os.path.join(GFX, f'{f}.png')
            imgs[f] = Image.open(p).convert('RGBA') if os.path.exists(p) else None
        im = imgs[f]
        if im is not None:
            px = im.crop((sx, sy, sx + min(w, 32), sy + min(h, 32))).resize((1, 1), Image.BOX).getpixel((0, 0))
            if px[3] > 40: c = px[:3]
    colors[g] = c
    return c

data = {}
for n in range(1, 400):
    m = read_map(n)
    if m: data[n] = m
print('mapas', len(data))

# --- imagen de cada mapa (100x100, 1 píxel por baldosa) ---
for n, (L1, L2, L3, B, ex) in data.items():
    im = Image.new('RGB', (100, 100))
    px = im.load()
    for k in range(10000):
        c = color(L1[k]) or (0, 0, 0)
        for g, a in ((L2[k], 0.6), (L3[k], 0.55)):
            if g:
                c2 = color(g)
                if c2: c = tuple(int(c[t] * (1 - a) + c2[t] * a) for t in range(3))
        if B[k] and not L3[k]: c = tuple(int(v * 0.8) for v in c)
        px[k % 100, k // 100] = c
    im.save(os.path.join(OUT, f'{n}.png'))

# --- ubicar los mapas en la grilla del mundo usando las salidas por los bordes ---
def direction(x, y):
    # los mapas del AO tienen las salidas en y=10 (norte), y=91 (sur), x=13 (oeste) y x=88 (este)
    if 10 < y < 91 and x <= 13: return (-1, 0)
    if 10 < y < 91 and x >= 88: return (1, 0)
    if y <= 10: return (0, -1)
    if y >= 91: return (0, 1)
    return None
links = {n: {} for n in data}
for n, (*_, ex) in data.items():
    for (x, y, m, tx, ty) in ex:
        d = direction(x, y)
        if d and m in data and m != n:
            links[n][d] = links[n].get(d, {})
            links[n][d][m] = links[n][d].get(m, 0) + 1
pos = {}; used = {}
grupos = []
def place(start, origin):
    q = deque([start]); pos[start] = origin; used[origin] = start; comp = [start]
    while q:
        n = q.popleft()
        for d, ms in links[n].items():
            m = max(ms, key=ms.get)
            if m in pos: continue
            p = (pos[n][0] + d[0], pos[n][1] + d[1])
            if p in used: continue
            pos[m] = p; used[p] = m; comp.append(m); q.append(m)
    return comp
# componente principal desde Ullathorpe (mapa 1), después los demás continentes/islas
order = [1] + sorted(data, key=lambda n: -sum(len(v) for v in links[n].values()))
for n in order:
    if n in pos: continue
    if not links[n]: continue
    # se coloca a la derecha de lo ya ubicado
    maxx = max((p[0] for p in used), default=-2)
    miny = min((p[1] for p in used), default=0)
    comp = place(n, (maxx + 3, 0))
    if len(comp) < 3:  # grupos chicos (casas, dungeons sueltos) no van al mundo
        for c in comp: used.pop(pos.pop(c))
        continue
    grupos.append(comp)
# cada grupo (el continente y cada dungeon) con sus propias coordenadas desde 0
mundo = {'mapas': {}, 'grupos': []}
grupo_de = {}
for gi, comp in enumerate(grupos):
    xs = [pos[c][0] for c in comp]; ys = [pos[c][1] for c in comp]
    mx, my = min(xs), min(ys)
    mundo['grupos'].append({'w': max(xs) - mx + 1, 'h': max(ys) - my + 1})
    for c in comp: grupo_de[c] = (gi, pos[c][0] - mx, pos[c][1] - my)
for n in data:
    e = {'n': name_of(n), 'z': zona_of(n)}
    if n in grupo_de: e['g'], e['x'], e['y'] = grupo_de[n]
    mundo['mapas'][n] = e
json.dump(mundo, open(os.path.join(OUT, 'mundo.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print('en el mundo', len(grupo_de), 'grupos', [(len(g), mundo['grupos'][i]) for i, g in enumerate(grupos)][:3])
