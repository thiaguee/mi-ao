"""Genera server/data/misiones.json (misiones normales, de élite, diarias y de clan).
Todas son de MATAR bichos. Las recompensas se calculan según el nivel, pero el archivo
generado se puede editar a mano. Uso: python3 tools/misiones.py"""
import json, math, os

SALIDA = os.path.join(os.path.dirname(__file__), '..', 'server', 'data', 'misiones.json')

# Tabla de experiencia (igual que el servidor)
ELU = [0, 300]
for i in range(2, 61):
    ELU.append(math.floor(ELU[-1] * (1.5 if i <= 10 else 1.3 if i <= 24 else 1.2)))

def puntos(nivel):
    return 1 if nivel <= 10 else 2 if nivel <= 20 else 3 if nivel <= 30 else 4 if nivel <= 40 else 5 if nivel <= 50 else 8 + (nivel - 51) // 4

def recompensa(nivel, factor=1.0):
    return {'oro': int((nivel * nivel * 800 + 5000) * factor), 'exp': int(ELU[nivel] * 0.6 * factor), 'puntos': max(1, round(puntos(nivel) * factor))}

# (id, nivel, nombre, descripción, [(bichos, cantidad)])  — bichos: número o lista de números
NORMALES = [
    ('murcielagos', 1, 'Bichos molestos', 'Una plaga de murciélagos invade los bosques de Ullathorpe.', [(500, 10)]),
    ('ratas', 1, 'Plaga de ratas', 'Las ratas salvajes se comen las cosechas.', [(536, 10)]),
    ('serpientes', 2, 'Serpientes en la ciudad', 'Las serpientes se meten hasta en las casas. Limpiá los alrededores.', [([504, 565], 15)]),
    ('escorpiones', 3, 'Escorpiones del desierto', 'Los viajeros del desierto piden ayuda contra los escorpiones.', [([529, 564], 15)]),
    ('esqueletos', 4, 'Huesos que caminan', 'Algo despertó a los esqueletos de los bosques.', [(503, 15)]),
    ('lobos', 5, 'Cacería de lobos', 'Los lobos atacan a los viajeros entre las ciudades.', [(501, 15)]),
    ('goblins', 6, 'Goblins revoltosos', 'Los goblins roban todo lo que encuentran.', [([505, 516], 15)]),
    ('esq_guerreros', 8, 'Guerreros del más allá', 'Los esqueletos guerreros custodian los cementerios.', [(508, 15)]),
    ('bandidos', 9, 'Bandidos del camino', 'Los bandidos asaltan las caravanas. Hacé justicia.', [(530, 15)]),
    ('duendes', 10, 'Duendes traviesos', 'Los duendes del bosque se volvieron peligrosos.', [(540, 15)]),
    ('zombies', 11, 'Los muertos se levantan', 'Zombies y sus señores avanzan hacia las ciudades.', [(502, 20), (507, 5)]),
    ('orcos', 12, 'Guerra contra los orcos', 'Los orcos de Dorck se preparan para la guerra.', [([522, 523], 20)]),
    ('hormigas', 14, 'Hormigas gigantes', 'Las hormigas gigantes destruyen los bosques.', [(534, 20)]),
    ('osos', 15, 'Osos del bosque', 'Los osos pardos atacan a los leñadores.', [(538, 15)]),
    ('tortugas', 16, 'Tortugas acorazadas', 'Las tortugas gigantes bloquean los caminos de Nix.', [(539, 20)]),
    ('tigres', 18, 'Tigres salvajes', 'Los tigres cazan a los viajeros cerca de Nix.', [(521, 20)]),
    ('asesinos', 19, 'Asesinos en las catacumbas', 'Una banda de asesinos se esconde en las catacumbas.', [(531, 15)]),
    ('aracnidos', 20, 'Arácnidos del desierto', 'Los arácnidos gigantes se multiplican en el desierto.', [(510, 25)]),
    ('gusanos', 21, 'Gusanos de arena', 'Los gusanos de arena se tragan a los viajeros.', [(519, 25)]),
    ('gorilas', 22, 'Gorilas de Dorck', 'Los gorilas salvajes dominan el bosque de Dorck.', [(515, 20)]),
    ('sirenas', 24, 'Canto de sirenas', 'Las sirenas hunden los barcos en alta mar.', [(603, 15)]),
    ('lobo_oscuro', 25, 'El lobo oscuro', 'Lobos oscuros rondan las minas de hierro.', [(703, 20)]),
    ('lord_orcos', 26, 'Señores orcos', 'Los señores orcos y sus brujos atacan la Isla Nueva Esperanza.', [(555, 15), (549, 10)]),
    ('liches', 28, 'Los liches de Marabel', 'Los liches resucitan a los muertos en Marabel.', [(554, 15)]),
    ('ogros', 30, 'Ogros y esclavos', 'Los ogros esclavizan a los pobladores de la isla.', [(541, 20), (511, 10)]),
    ('magos_malvados', 32, 'Magos malvados', 'Magos oscuros practican hechizos prohibidos.', [(551, 20)]),
    ('enanos', 33, 'Enanos de las profundidades', 'Los enanos de las profundidades tomaron las minas.', [(582, 20)]),
    ('brujas', 35, 'Brujas y djinns', 'Brujas y djinns de viento conspiran juntos.', [(550, 15), (517, 15)]),
    ('ciclopes', 37, 'El cíclope guardián', 'Los cíclopes guardan tesoros en la Cueva de la Ladera.', [(513, 10)]),
    ('dragones', 38, 'Dragones rojos', 'Los dragones rojos de Marabel deben caer.', [(509, 10)]),
    ('leviatan', 40, 'Leviatán', 'Un leviatán aterroriza los mares.', [(548, 10)]),
    ('medusas', 42, 'Las medusas de Veriil', 'Su mirada convierte en piedra a los aventureros.', [(553, 10)]),
    ('hombres_lobo', 44, 'Hombres lobo', 'Los hombres lobo cazan en la Cueva de la Ladera.', [(709, 8)]),
    ('viudas', 45, 'Viudas negras', 'Arañas gigantes tejen sus redes en las cavernas heladas.', [(706, 10)]),
    ('protectores', 47, 'Guerreros protectores', 'Guardianes antiguos protegen el Dungeon Morgolock.', [(752, 10)]),
    ('momias', 48, 'Las momias de la pirámide', 'Las momias despertaron en la pirámide.', [(758, 5), (932, 5)]),
    ('destructor', 50, 'El destructor de almas', 'Un mal antiguo devora almas en Morgolock.', [(761, 10)]),
]
ELITE = [
    ('yetis', 51, 'Yetis del Averno', 'Los yetis bloquean el camino al Averno.', [(825, 10)]),
    ('gorgonas', 52, 'Gorgonas', 'Las gorgonas custodian la pirámide.', [(807, 10)]),
    ('demonios', 53, 'Demonios', 'Los demonios escaparon del Dungeon Inferno.', [(543, 5), (584, 5)]),
    ('orcos_elite', 54, 'Orcos de élite', 'Los mejores guerreros orcos esperan en la Caverna Helada.', [(772, 8)]),
    ('jinetes', 55, 'Jinetes del apocalipsis', 'Los jinetes recorren el Limbo de los Justos.', [(768, 8)]),
    ('archimagos', 56, 'Archimagos de fuego', 'Los archimagos queman todo en el Paso del Titán.', [(762, 8)]),
    ('golems', 57, 'Golems', 'Golems de piedra y barro despertaron.', [(552, 5), (811, 3)]),
    ('olvidado', 58, 'El Olvidado', 'Raistar, el Olvidado, volvió a Marabel.', [(774, 3)]),
    ('morgolock', 59, 'Dark Morgolock', 'El señor oscuro de Morgolock debe caer.', [(558, 3)]),
    ('golem_infernal', 60, 'El golem infernal', 'La prueba final de los héroes de Norway.', [(586, 3)]),
]
# Diarias: se eligen 3 por día según el nivel del personaje (se pueden repetir cada día)
DIARIAS = [(f'd_{m[0]}', m[1], 'Diaria: ' + m[2], m[3], [(b, max(10, c * 2)) for b, c in m[4]]) for m in NORMALES + ELITE]
# De clan: semanales, cuentan las muertes de TODOS los integrantes
CLAN = [
    ('c_cazadores', 'Cazadores del clan', 'Entre todos, maten 500 bichos de cualquier tipo.', [('*', 500)], {'oro': 300000, 'puntos': 5, 'expPct': 0.3}),
    ('c_nomuertos', 'Exterminio de no-muertos', 'Entre todos, maten 150 no-muertos (esqueletos, zombies, liches, momias).', [([503, 508, 502, 507, 554, 758, 932, 583], 150)], {'oro': 500000, 'puntos': 8, 'expPct': 0.4}),
    ('c_bestias', 'Bestias salvajes', 'Entre todos, maten 200 lobos, osos, tigres o gorilas.', [([501, 703, 765, 766, 538, 521, 515, 165, 166], 200)], {'oro': 400000, 'puntos': 6, 'expPct': 0.35}),
    ('c_dragones', 'Matadragones', 'Entre todos, maten 15 dragones.', [([509, 542, 518, 585, 622, 624], 15)], {'oro': 1500000, 'puntos': 15, 'expPct': 0.6}),
]

def armar(lista, tipo, factor=1.0):
    out = []
    for (mid, nivel, nombre, desc, obj) in lista:
        out.append({'id': mid, 'tipo': tipo, 'nivel': nivel, 'nombre': nombre, 'desc': desc,
                    'objetivos': [{'bichos': b if isinstance(b, list) else [b], 'cantidad': c} for b, c in obj],
                    'recompensa': recompensa(nivel, factor)})
    return out

data = {
    '_ayuda': ('Misiones de Norway AO. Todas son de matar bichos. "bichos" son números de NPC (ver el Excel), '
               '"*" = cualquier bicho. recompensa: oro, exp y puntos de misión (no se pierden al morir). '
               'Para regenerar este archivo: python3 tools/misiones.py'),
    'normales': armar(NORMALES, 'normal'),
    'elite': armar(ELITE, 'elite'),
    'diarias': armar(DIARIAS, 'diaria', 0.5),
    'clan': [{'id': i, 'tipo': 'clan', 'nombre': n, 'desc': d,
              'objetivos': [{'bichos': b if isinstance(b, list) else [b], 'cantidad': c} for b, c in obj], 'recompensa': r}
             for (i, n, d, obj, r) in CLAN],
}
json.dump(data, open(SALIDA, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('misiones:', {k: len(v) for k, v in data.items() if isinstance(v, list)})
