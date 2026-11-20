"""Prepara los recursos del juego a partir de los archivos de Argentum Online Libre.

Uso: python3 -I tools/build_assets.py <carpeta ao-cliente> <carpeta ao-server> <carpeta juego>

- Convierte los gráficos a PNG con transparencia (el negro puro es transparente, como en el AO original).
- Genera índices JSON de gráficos (Grh), cuerpos, cabezas, cascos, armas, escudos y efectos.
- Copia los mapas (.map/.inf/.dat) y los archivos Dat del servidor pasándolos a UTF-8.
"""
import json
import os
import shutil
import struct
import sys
from multiprocessing import Pool

from PIL import Image

CLI, SRV, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ASSETS = os.path.join(OUT, 'client', 'assets')
DATA = os.path.join(ASSETS, 'data')
GFX = os.path.join(ASSETS, 'g')
SERVER_DATA = os.path.join(OUT, 'server', 'data')
HEADER = 263  # tCabecera: Desc(255) + CRC(4) + MagicWord(4)


def read_ini(path):
    """Lector de INI tolerante (comentarios con ' al final, claves repetidas, latin1)."""
    res, sec = {}, None
    with open(path, encoding='latin1') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith(("'", '#', ';')):
                continue
            if line.startswith('['):
                sec = line[1:line.index(']')].upper() if ']' in line else line[1:].upper()
                res.setdefault(sec, {})
                continue
            if '=' in line and sec is not None:
                k, v = line.split('=', 1)
                v = v.split("'")[0].strip()
                res[sec][k.strip().upper()] = v
    return res


def build_grh():
    grh = {}
    with open(os.path.join(CLI, 'INIT', 'Graficos.ini'), encoding='latin1') as f:
        in_graphics = False
        for line in f:
            line = line.strip()
            if line.upper() == '[GRAPHICS]':
                in_graphics = True
                continue
            if not in_graphics or not line.startswith('Grh'):
                continue
            k, v = line.split('=', 1)
            n = int(k[3:])
            p = [int(x) for x in v.split('-') if x != '']
            if p[0] == 1:
                # [archivo, x, y, ancho, alto]
                grh[n] = p[1:6]
            else:
                nf = p[0]
                # {"f": [frames], "s": velocidad}
                grh[n] = {'f': p[1:1 + nf], 's': p[1 + nf] if len(p) > 1 + nf else 1}
    return grh


def read_ind_heads(path):
    d = open(path, 'rb').read()
    i = HEADER
    (num,) = struct.unpack_from('<h', d, i)
    i += 2
    out = [None]
    for _ in range(num):
        out.append(list(struct.unpack_from('<4l', d, i)))
        i += 16
    return out


def read_ind_bodies(path):
    d = open(path, 'rb').read()
    i = HEADER
    (num,) = struct.unpack_from('<h', d, i)
    i += 2
    out = [None]
    for _ in range(num):
        w = struct.unpack_from('<4l2h', d, i)
        i += 20
        out.append({'w': list(w[:4]), 'ox': w[4], 'oy': w[5]})
    return out


def read_anims(path, sec_prefix, count_key):
    ini = read_ini(path)
    num = int(ini.get('INIT', {}).get(count_key, '0') or 0)
    out = [None]
    for i in range(1, num + 1):
        s = ini.get(f'{sec_prefix}{i}', {})
        out.append([int(s.get(f'DIR{d}', '0') or 0) for d in range(1, 5)])
    return out


def read_fxs(path):
    ini = read_ini(path)
    num = int(ini.get('INIT', {}).get('NUMFXS', '0') or 0)
    out = [None]
    for i in range(1, num + 1):
        s = ini.get(f'FX{i}', {})
        out.append([int(s.get('ANIMACION', '0') or 0), int(s.get('OFFSETX', '0') or 0), int(s.get('OFFSETY', '0') or 0)])
    return out


def convert_image(args):
    src, dst = args
    if os.path.exists(dst):
        return
    try:
        im = Image.open(src).convert('RGBA')
        px = im.load()
        w, h = im.size
        # El AO usa el negro puro como color transparente.
        data = [(0, 0, 0, 0) if p[0] == 0 and p[1] == 0 and p[2] == 0 else p for p in im.getdata()]
        im.putdata(data)
        im.save(dst, optimize=False)
    except Exception as e:  # noqa
        print('ERROR imagen', src, e)


def main():
    os.makedirs(DATA, exist_ok=True)
    os.makedirs(GFX, exist_ok=True)
    os.makedirs(SERVER_DATA, exist_ok=True)

    grh = build_grh()
    json.dump(grh, open(os.path.join(DATA, 'grh.json'), 'w'), separators=(',', ':'))
    print('Grh:', len(grh))

    init = os.path.join(CLI, 'INIT')
    bodies = read_ind_bodies(os.path.join(init, 'Personajes.ind'))
    heads = read_ind_heads(os.path.join(init, 'Cabezas.ind'))
    helmets = read_ind_heads(os.path.join(init, 'Cascos.ind'))
    weapons = read_anims(os.path.join(init, 'Armas.dat'), 'ARMA', 'NUMARMAS')
    shields = read_anims(os.path.join(init, 'Escudos.dat'), 'ESC', 'NUMESCUDOS')
    fxs = read_fxs(os.path.join(init, 'fxs.ini'))
    json.dump({'bodies': bodies, 'heads': heads, 'helmets': helmets, 'weapons': weapons,
               'shields': shields, 'fxs': fxs},
              open(os.path.join(DATA, 'chars.json'), 'w'), separators=(',', ':'))
    print('Cuerpos', len(bodies), 'Cabezas', len(heads), 'Cascos', len(helmets),
          'Armas', len(weapons), 'Escudos', len(shields), 'Fxs', len(fxs))

    # Mapas: el cliente y el servidor usan los mismos archivos del servidor (mundo Alkon).
    maps_src = os.path.join(SRV, 'Mundos', 'Alkon')
    cmaps = os.path.join(ASSETS, 'mapas')
    smaps = os.path.join(SERVER_DATA, 'mapas')
    os.makedirs(cmaps, exist_ok=True)
    os.makedirs(smaps, exist_ok=True)
    n = 0
    for f in os.listdir(maps_src):
        low = f.lower()
        src = os.path.join(maps_src, f)
        if low.endswith('.map'):
            shutil.copy(src, os.path.join(cmaps, low))
            shutil.copy(src, os.path.join(smaps, low))
            n += 1
        elif low.endswith('.inf'):
            shutil.copy(src, os.path.join(smaps, low))
        elif low.endswith('.dat'):
            raw = open(src, 'rb').read()
            try:
                txt = raw.decode('utf-8')
            except UnicodeDecodeError:
                txt = raw.decode('latin1')
            open(os.path.join(smaps, low), 'w', encoding='utf-8').write(txt)
    print('Mapas:', n)

    # Dats del servidor -> UTF-8
    dat_dst = os.path.join(SERVER_DATA, 'dat')
    os.makedirs(dat_dst, exist_ok=True)
    for f in os.listdir(os.path.join(SRV, 'Dat')):
        raw = open(os.path.join(SRV, 'Dat', f), 'rb').read()
        try:
            txt = raw.decode('utf-8')
        except UnicodeDecodeError:
            txt = raw.decode('latin1')
        open(os.path.join(dat_dst, f.lower()), 'w', encoding='utf-8').write(txt)

    # Imágenes (sólo las que usan los Grh)
    files = sorted({v[0] for v in grh.values() if isinstance(v, list)})
    jobs = []
    for num in files:
        src = os.path.join(CLI, 'Graficos', f'{num}.png')
        if not os.path.exists(src):
            src = os.path.join(CLI, 'Graficos', f'{num}.PNG')  # algunos vienen con la extensión en mayúsculas
        if os.path.exists(src):
            jobs.append((src, os.path.join(GFX, f'{num}.png')))
    print('Convirtiendo', len(jobs), 'imágenes de', len(files), 'referenciadas')
    with Pool(os.cpu_count() or 2) as p:
        p.map(convert_image, jobs, chunksize=16)
    print('Listo')


if __name__ == '__main__':
    main()
