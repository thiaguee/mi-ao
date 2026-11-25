'use strict';
// Carga de datos del juego: objetos, NPCs, hechizos, mapas y ciudades.
const fs = require('fs');
const path = require('path');
const { readIni, num } = require('./ini');

const DATA = path.join(__dirname, '..', 'data');
const DAT = path.join(DATA, 'dat');
const MAPS = path.join(DATA, 'mapas');

// ---- Tipos de objeto (iguales al AO original) ----
const OBJ = {
  COMIDA: 1, ARMA: 2, ARMADURA: 3, ARBOL: 4, ORO: 5, PUERTA: 6, CONTENEDOR: 7, CARTEL: 8,
  LLAVE: 9, FORO: 10, POCION: 11, BEBIDA: 13, LENA: 14, FOGATA: 15, ESCUDO: 16, CASCO: 17,
  ANILLO: 18, TELEPORT: 19, YACIMIENTO: 22, MINERAL: 23, PERGAMINO: 24, INSTRUMENTO: 26,
  YUNQUE: 27, FRAGUA: 28, BARCO: 31, FLECHA: 32, BOTELLA_VACIA: 33, BOTELLA_LLENA: 34,
  MONTURA: 25, MOCHILA: 37,
  PASAJE: 50, // pasaje de viaje (nuestro)
  APARIENCIA: 52, // cambia la cabeza al usarlo (Cabeza de Demonio)
};

// ---- Objetos de Norway AO renumerados al 2000+ (número viejo -> nuevo) ----
// Los personajes, estructuras y tiendas guardados con el número viejo se convierten solos al cargar.
const RENUMERADOS = { 1153: 2000, 484: 2001, 1241: 2002, 1242: 2003, 1243: 2004, 1244: 2005, 1245: 2006, 1246: 2007, 1247: 2008, 1248: 2009 };
const nuevoId = (id) => RENUMERADOS[id] || id;

// ---- Árbol de clases de Norway AO ----
const CLASES = {
  1: 'Ciudadano', 2: 'Trabajador', 3: 'Experto en minerales', 4: 'Minero', 8: 'Herrero',
  13: 'Experto en uso de madera', 14: 'Leñador', 18: 'Carpintero', 23: 'Pescador', 27: 'Sastre',
  31: 'Alquimista', 35: 'Luchador', 36: 'Con uso de maná', 37: 'Hechicero', 38: 'Mago',
  39: 'Nigromante', 40: 'Orden sagrada', 41: 'Paladín', 42: 'Clérigo', 43: 'Naturalista',
  44: 'Bardo', 45: 'Druida', 46: 'Sigiloso', 47: 'Asesino', 48: 'Cazador', 49: 'Sin uso de maná',
  50: 'Arquero', 51: 'Guerrero', 52: 'Caballero', 53: 'Bandido', 55: 'Pirata', 56: 'Ladrón',
};
// clase -> { nivel requerido, opciones }
const EVOLUCION = {
  1: { nivel: 3, opciones: [2, 35] },
  2: { nivel: 6, opciones: [3, 13, 23, 27, 31] },
  35: { nivel: 6, opciones: [36, 49] },
  3: { nivel: 9, opciones: [4, 8] },
  13: { nivel: 9, opciones: [14, 18] },
  36: { nivel: 9, opciones: [37, 40, 43, 46] },
  49: { nivel: 9, opciones: [52, 53] },
  37: { nivel: 12, opciones: [38, 39] },
  40: { nivel: 12, opciones: [41, 42] },
  43: { nivel: 12, opciones: [44, 45] },
  46: { nivel: 12, opciones: [47, 48] },
  52: { nivel: 12, opciones: [50, 51] },
  53: { nivel: 12, opciones: [55, 56] },
};
const esClaseBase = (c) => !!EVOLUCION[c];
const claseConMana = (c) => c >= 36 && c < 49;
// Valores de Fénix: "Resta" (vida por nivel) y "AumentoHit" (golpe por nivel)
const RESTA = { 1: 3, 2: 2.5, 3: 2.5, 4: 2.5, 8: 2.5, 13: 2.5, 14: 2.5, 18: 2.5, 23: 2.5, 27: 2.5, 31: 2.5,
  35: 3, 36: 3, 37: 3, 38: 3, 39: 3, 40: 1.5, 41: 0.5, 42: 1.5, 43: 2.5, 44: 1.5, 45: 3, 46: 1.5,
  47: 1.5, 48: 0.5, 49: 2, 50: 0.5, 51: 0, 52: 1, 53: 2, 55: 1.5, 56: 2.5 };
const AUMENTO_HIT = { 1: 3, 2: 3, 3: 3, 4: 2, 8: 2, 13: 3, 14: 2, 18: 2, 23: 1, 27: 2, 31: 2, 35: 3,
  36: 3, 37: 3, 38: 1, 39: 1, 40: 3, 41: 3, 42: 2, 43: 3, 44: 2, 45: 2, 46: 3, 47: 3, 48: 3, 49: 2,
  50: 3, 51: 3, 52: 3, 53: 2, 55: 2, 56: 2 };
// Maná por nivel = factor * inteligencia
const MANA_POR_NIVEL = { 36: 1, 37: 2.2, 38: 3, 39: 2.2, 40: 1, 41: 1, 42: 2, 43: 2, 44: 2, 45: 2.2,
  46: 1, 47: 1, 48: 1 };
// Nombres usados en obj.dat (CP1=MAGO, etc.)
const NOMBRE_DAT_CLASE = { 38: 'MAGO', 39: 'NIGROMANTE', 41: 'PALADIN', 42: 'CLERIGO', 44: 'BARDO',
  45: 'DRUIDA', 47: 'ASESINO', 48: 'CAZADOR', 50: 'ARQUERO', 51: 'GUERRERO', 55: 'PIRATA',
  56: 'LADRON', 4: 'MINERO', 8: 'HERRERO', 14: 'LEÑADOR', 18: 'CARPINTERO', 23: 'PESCADOR' };

const RAZAS = { 1: 'Humano', 2: 'Enano', 3: 'Elfo', 4: 'Elfo oscuro', 5: 'Gnomo' };
// Modificadores de atributos por raza: [fuerza, agilidad, inteligencia, carisma, constitución]
const MOD_RAZA = {
  1: [1, 1, 0, 0, 2],
  2: [3, 0, -6, -2, 3],
  3: [-1, 3, 2, 2, 1],
  4: [2, 2, 2, -3, 1],
  5: [-5, 3, 3, 1, 0],
};
// Cabezas y cuerpos iniciales por raza y género (índices del AO Libre)
const APARIENCIA = {
  1: { h: { body: 1, heads: [1, 40] }, m: { body: 1, heads: [70, 89] } },
  2: { h: { body: 300, heads: [301, 319] }, m: { body: 300, heads: [370, 384] } },
  3: { h: { body: 2, heads: [101, 122] }, m: { body: 2, heads: [170, 188] } },
  4: { h: { body: 3, heads: [201, 221] }, m: { body: 3, heads: [270, 288] } },
  5: { h: { body: 300, heads: [401, 416] }, m: { body: 300, heads: [470, 484] } },
};
const CUERPO_MUERTO = 8;
const CABEZA_MUERTO = 500;
const FX = { WARP: 1, MEDITAR: [4, 5, 6, 16, 34], SANGRE: 14 };
const TRIGGER = { BAJOTECHO: 1, CASA: 2, POSINVALIDA: 3, ZONASEGURA: 4, ANTIPIQUETE: 5, ZONAPELEA: 6 };
const SND = { SWING: 2, WARP: 3, PUERTA: 5, NIVEL: 6, USERMUERTE: 11, IMPACTO: 10, IMPACTO2: 12,
  SACARARMA: 25, ESCUDO: 37, BEBER: 46, RESUCITAR: 213, CURAR: 214, COMER: 7 };
const ES_RAZA_BAJA = (r) => r === 2 || r === 5;

const SKILLS = ['Magia', 'Robar', 'Tácticas de combate', 'Combate con armas', 'Meditar', 'Apuñalar',
  'Ocultarse', 'Supervivencia', 'Talar', 'Comercio', 'Defensa con escudos', 'Pesca', 'Minería',
  'Carpintería', 'Herrería', 'Liderazgo', 'Domar animales', 'Armas de proyectiles', 'Wrestling',
  'Navegación'];
const SK = Object.fromEntries(SKILLS.map((s, i) => [s, i]));

// Tabla de experiencia de Fénix
// Nivel máximo: 50, más 10 niveles que se desbloquean al llegar al 50 (51 a 60)
const MAX_NIVEL = 60;
const NIVEL_DESBLOQUEO = 50;
const ELU = [0, 300];
for (let i = 2; i <= MAX_NIVEL; i++) {
  ELU[i] = Math.floor(ELU[i - 1] * (i <= 10 ? 1.5 : i <= 24 ? 1.3 : 1.2));
}

function loadObjs() {
  const ini = readIni(path.join(DAT, 'obj.dat'));
  const objs = [];
  for (const [sec, v] of Object.entries(ini)) {
    const m = /^OBJ(\d+)$/.exec(sec);
    if (!m) continue;
    const id = +m[1];
    const prohibidas = [];
    for (let i = 1; i <= 20; i++) if (v['CP' + i]) prohibidas.push(v['CP' + i].toUpperCase());
    objs[id] = {
      id,
      name: v.NAME || ('Objeto ' + id),
      grh: num(v.GRHINDEX),
      type: num(v.OBJTYPE),
      value: num(v.VALOR),
      minHit: num(v.MINHIT), maxHit: num(v.MAXHIT),
      minDef: num(v.MINDEF), maxDef: num(v.MAXDEF),
      ropaje: num(v.NUMROPAJE), anim: num(v.ANIM), anim_bajos: num(v.RAZAENANAANIM),
      // En los archivos del AO Libre el dibujo de cascos y escudos está en "Anim" (en otros AO en CascoAnim/EscudoAnim)
      casco: num(v.CASCOANIM) || (num(v.OBJTYPE) === 17 ? num(v.ANIM) : 0),
      escudo: num(v.ESCUDOANIM) || (num(v.OBJTYPE) === 16 ? num(v.ANIM) : 0),
      minHam: num(v.MINHAM), minSed: num(v.MINAGU),
      pocion: num(v.TIPOPOCION), minMod: num(v.MINMODIFICADOR), maxMod: num(v.MAXMODIFICADOR),
      duracion: num(v.DURACIONEFECTO),
      spell: num(v.HECHIZOINDEX),
      newbie: num(v.NEWBIE) === 1,
      noSeCae: num(v.NOSECAE) === 1,
      rayos: num(v.RAYOS) === 1, // rodea al que la tiene puesta de rayos
      aura: (v.AURA || '').trim(), // color del aura que tiene alrededor el que la tiene puesta (ej. #8fe6ff)
      agarrable: num(v.AGARRABLE) === 0,
      crucial: num(v.CRUCIAL) === 1,
      proyectil: num(v.PROYECTIL) === 1,
      municion: num(v.MUNICIONES),
      mujer: num(v.MUJER) === 1, hombre: num(v.HOMBRE) === 1,
      bajos: num(v.RAZAENANA) === 1, // sólo enanos/gnomos
      drow: num(v.RAZADROW) === 1,
      real: num(v.REAL) === 1, caos: num(v.CAOS) === 1,
      soloGM: num(v.SOLOGM) === 1, // ropa de staff: sólo la usan Consejeros y GMs
      prohibidas,
      texto: v.TEXTO || '',
      minSkill: num(v.MINSKILL),
      // oficios: lingotes y madera para fabricar, skill necesario, qué mineral da un yacimiento y qué lingote sale de un mineral
      lingH: num(v.LINGH), lingP: num(v.LINGP), lingO: num(v.LINGO), skHerreria: num(v.SKHERRERIA),
      madera: num(v.MADERA), skCarpinteria: num(v.SKCARPINTERIA),
      mineral: num(v.MINERALINDEX), lingote: num(v.LINGOTEINDEX),
      cabeza: num(v.CABEZAINDEX), // objetos de apariencia: cabeza que ponen
      cerrada: num(v.CERRADA) === 1, indexAbierta: num(v.INDEXABIERTA), indexCerrada: num(v.INDEXCERRADA),
      llave: num(v.LLAVE), clave: num(v.CLAVE),
      apunala: num(v.APUNALA) === 1,
      // efectos especiales de armas (Norway AO): % de chance por golpe a otro jugador
      sangrado: num(v.SANGRADO), // pierde 20-30 de vida por segundo durante 3-5 s
      bloqueaMana: num(v.BLOQUEAMANA), // no puede recuperar maná durante 3 s
      envenena: num(v.ENVENENA) === 1,
      staffPower: num(v.STAFFPOWER), staffDamageBonus: num(v.STAFFDAMAGEBONUS),
      defMagica: num(v.DEFENSAMAGICAMIN) + num(v.DEFENSAMAGICAMAX),
    };
  }
  return objs;
}

function parsePair(s) {
  const [a, b] = String(s || '').split('-');
  return [num(a), num(b)];
}

function loadNpcs() {
  const ini = readIni(path.join(DAT, 'npcs.dat'));
  const npcs = [];
  for (const [sec, v] of Object.entries(ini)) {
    const m = /^NPC(\d+)$/.exec(sec);
    if (!m) continue;
    const id = +m[1];
    const items = [];
    const nItems = num(v.NROITEMS);
    for (let i = 1; i <= nItems; i++) {
      if (v['OBJ' + i]) items.push(parsePair(v['OBJ' + i]));
    }
    const drops = [];
    for (let i = 1; i <= 10; i++) if (v['DROP' + i]) drops.push(parsePair(v['DROP' + i]));
    const spells = [];
    const nSp = num(v.LANZASPELLS);
    for (let i = 1; i <= nSp; i++) if (v['SP' + i]) spells.push(num(v['SP' + i]));
    npcs[id] = {
      id,
      name: v.NAME || 'NPC',
      desc: v.DESC || '',
      type: num(v.NPCTYPE),
      body: num(v.BODY), head: num(v.HEAD), heading: num(v.HEADING, 3) || 3,
      movement: num(v.MOVEMENT, 1),
      attackable: num(v.ATTACKABLE) === 1,
      respawn: num(v.RESPAWN) === 0, // en el AO, ReSpawn=0 significa que reaparece
      hostile: num(v.HOSTILE) === 1,
      comercia: num(v.COMERCIA) === 1,
      tipoItems: num(v.TIPOITEMS),
      exp: num(v.GIVEEXP), gld: num(v.GIVEGLD),
      azar: num(v.REAPARECERALAZAR) === 1, // al morir reaparece en cualquier lugar del mapa
      minHp: num(v.MINHP), maxHp: num(v.MAXHP),
      minHit: num(v.MINHIT), maxHit: num(v.MAXHIT),
      def: num(v.DEF), defM: num(v.DEFM),
      ataque: num(v.PODERATAQUE), evasion: num(v.PODEREVASION),
      veneno: num(v.VENENO) === 1,
      aguaValida: num(v.AGUAVALIDA) === 1,
      tierraInvalida: num(v.TIERRAINVALIDA) === 1,
      posOrig: num(v.POSORIG) === 1,
      ciudad: num(v.CIUDAD),
      inflacion: num(v.INFLACION),
      items, drops, spells,
    };
  }
  return npcs;
}

function loadSpells() {
  const ini = readIni(path.join(DAT, 'hechizos.dat'));
  const spells = [];
  for (const [sec, v] of Object.entries(ini)) {
    const m = /^HECHIZO(\d+)$/.exec(sec);
    if (!m) continue;
    const id = +m[1];
    spells[id] = {
      id,
      name: v.NOMBRE || ('Hechizo ' + id),
      desc: v.DESC || '',
      words: v.PALABRASMAGICAS || '',
      msgCaster: v.HECHIZEROMSG || '', msgSelf: v.PROPIOMSG || '', msgTarget: v.TARGETMSG || '',
      tipo: num(v.TIPO), wav: num(v.WAV), fx: num(v.FXGRH), loops: num(v.LOOPS),
      minSkill: num(v.MINSKILL), mana: num(v.MANAREQUERIDO), sta: num(v.STAREQUERIDO),
      target: num(v.TARGET),
      subeHp: num(v.SUBEHP), minHp: num(v.MINHP), maxHp: num(v.MAXHP),
      subeMana: num(v.SUBEMANA), minMana: num(v.MINMANA), maxMana: num(v.MAXMANA),
      subeSta: num(v.SUBESTA), minSta: num(v.MINSTA), maxSta: num(v.MAXSTA),
      subeHam: num(v.SUBEHAM), minHam: num(v.MINHAM), maxHam: num(v.MAXHAM),
      subeSed: num(v.SUBESED), minSed: num(v.MINSED), maxSed: num(v.MAXSED),
      subeAg: num(v.SUBEAG), minAg: num(v.MINAG), maxAg: num(v.MAXAG),
      subeFu: num(v.SUBEFU), minFu: num(v.MINFU), maxFu: num(v.MAXFU),
      invisibilidad: num(v.INVISIBILIDAD) === 1,
      paraliza: num(v.PARALIZA) === 1, inmoviliza: num(v.INMOVILIZA) === 1,
      removerParalisis: num(v.REMOVERPARALISIS) === 1,
      envenena: num(v.ENVENENA) === 1, curaVeneno: num(v.CURAVENENO) === 1,
      revivir: num(v.REVIVIR) === 1,
      ceguera: num(v.CEGUERA) === 1, estupidez: num(v.ESTUPIDEZ) === 1,
      invoca: num(v.INVOCA) === 1, numNpc: num(v.NUMNPC), cant: num(v.CANT),
      staffAffected: num(v.STAFFAFFECTED) === 1,
      portalUlla: num(v.PORTALULLA) === 1, // abre un portal temporal a Ullathorpe
      critico: num(v.CRITICO), divino: num(v.DIVINO), // % de golpe crítico (x2) y divino (x3), una sola tirada
    };
  }
  return spells;
}

const XY = 100;
const idx = (x, y) => (y - 1) * XY + (x - 1);

// Lee Mapa<N>.map + .inf + .dat
function loadMap(n) {
  const mp = path.join(MAPS, `mapa${n}.map`);
  if (!fs.existsSync(mp)) return null;
  const m = fs.readFileSync(mp);
  const inf = fs.readFileSync(path.join(MAPS, `mapa${n}.inf`));
  const map = {
    n,
    blocked: new Uint8Array(XY * XY),
    bancos: new Set(), // baldosas con un banco de plaza (para /SENTARSE)
    trigger: new Uint8Array(XY * XY),
    water: new Uint8Array(XY * XY),
    exits: new Map(), // idx -> {map,x,y}
    npcs: [], // {id,x,y}
    objs: new Map(), // idx -> {id, amount}
    name: 'Mapa ' + n,
    pk: true,
    music: 0,
    startPos: null,
    onDeath: null,
    zona: '',
    terreno: '',
  };
  let i = 2 + 263 + 8;
  let j = 8 + 2;
  for (let y = 1; y <= XY; y++) {
    for (let x = 1; x <= XY; x++) {
      const k = idx(x, y);
      const f = m[i++];
      if (f & 1) map.blocked[k] = 1;
      const g1 = m.readInt32LE(i); i += 4;
      if (f & 2) i += 4;
      if (f & 4) { if (m.readInt32LE(i) === 274) map.bancos.add(k); i += 4; }
      if (f & 8) i += 4;
      if (f & 16) { map.trigger[k] = m.readInt16LE(i); i += 2; }
      if (isWaterGrh(g1) && !(f & 2)) map.water[k] = 1;
      const g = inf[j++];
      if (g & 1) {
        map.exits.set(k, { map: inf.readInt16LE(j), x: inf.readInt16LE(j + 2), y: inf.readInt16LE(j + 4) });
        j += 6;
      }
      if (g & 2) { const id = inf.readInt16LE(j); j += 2; if (id > 0) map.npcs.push({ id, x, y }); }
      if (g & 4) {
        const id = inf.readInt16LE(j); const amount = inf.readInt16LE(j + 2); j += 4;
        if (id > 0) map.objs.set(k, { id, amount });
      }
    }
  }
  const datPath = path.join(MAPS, `mapa${n}.dat`);
  if (fs.existsSync(datPath)) {
    const ini = readIni(datPath);
    const s = ini['MAPA' + n] || Object.values(ini)[0] || {};
    if (s.NAME) map.name = s.NAME;
    map.music = num(s.MUSICNUMMP3) || num(s.MUSICNUM);
    map.pk = num(s.PK) === 0;
    map.zona = (s.ZONA || '').toUpperCase();
    map.terreno = (s.TERRENO || '').toUpperCase();
    map.magiaSinEfecto = num(s.MAGIASINEFECTO) === 1;
    const sp = (s.STARTPOS || '').split('-').map(Number);
    if (sp.length === 3 && sp[0] > 0) map.startPos = { map: sp[0], x: sp[1], y: sp[2] };
    const od = (s.ONDEATHGOTO || '').split('-').map(Number);
    if (od.length === 3 && od[0] > 0) map.onDeath = { map: od[0], x: od[1], y: od[2] };
  }
  return map;
}

// Rangos de gráficos de agua del AO (igual que HayAgua en el original)
function isWaterGrh(g) {
  return (g >= 1505 && g <= 1520) || (g >= 12439 && g <= 12454) || (g >= 5665 && g <= 5680) ||
    (g >= 13547 && g <= 13562);
}

// Ajustes de balance sin tocar los .dat: data/ajustes.json
// { "hechizos": { "2": { "danio": 20 } } }  -> el hechizo 2 hace 20 veces más daño
const normClase = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

function aplicarAjustes(spells, objs) {
  const p = path.join(DATA, 'ajustes.json');
  if (!fs.existsSync(p)) return;
  let aj;
  try { aj = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { console.error('ajustes.json tiene un error:', e.message); return; }
  for (const [id, a] of Object.entries(aj.hechizos || {})) {
    const s = spells[+id];
    if (!s) continue;
    if (a.danio) { s.minHp = Math.round(s.minHp * a.danio); s.maxHp = Math.round(s.maxHp * a.danio); }
    if (a.mana !== undefined) s.mana = a.mana;
    if (a.skill !== undefined) s.minSkill = a.skill;
    console.log(`Ajuste: ${s.name} -> daño ${s.minHp}-${s.maxHp}, maná ${s.mana}`);
  }
  for (const [id, a] of Object.entries(aj.objetos || {})) {
    const o = objs[+id];
    if (!o) continue;
    if (a.valor !== undefined) o.value = a.valor;
    if (Array.isArray(a.clases)) o.soloClases = a.clases.map(normClase); // sólo estas clases lo pueden usar
    console.log(`Ajuste: ${o.name} -> valor ${o.value}${o.soloClases ? ', clases: ' + a.clases.join(', ') : ''}`);
  }
}

// NPCs nuevos (que no están en los .dat del AO): data/npcs-extra.json
function cargarNpcsExtra(npcs) {
  const p = path.join(DATA, 'npcs-extra.json');
  if (!fs.existsSync(p)) return [];
  let lista;
  try { lista = JSON.parse(fs.readFileSync(p, 'utf8')).npcs || []; } catch (e) { console.error('npcs-extra.json tiene un error:', e.message); return []; }
  for (const e of lista) {
    npcs[e.num] = {
      id: e.num, name: e.name, desc: e.desc || '', type: e.tipo || 0, body: e.body, head: e.head || 0,
      heading: e.heading || 3, movement: e.movimiento || 1, attackable: false, respawn: true, hostile: false,
      comercia: !!e.items, tipoItems: e.tipoItems || 0, exp: 0, gld: 0, minHp: 1, maxHp: 1, minHit: 0, maxHit: 0,
      def: 0, defM: 0, ataque: 0, evasion: 0, veneno: false, aguaValida: false, tierraInvalida: false,
      posOrig: true, ciudad: 0, inflacion: 0, items: e.items || [], drops: [], spells: [], misiones: !!e.misiones, comandante: e.comandante || '', hechizos: !!e.hechizos, mercado: !!e.mercado, pasajes: !!e.pasajes,
    };
  }
  return lista;
}

function loadCities() {
  const ini = readIni(path.join(DAT, 'ciudades.dat'));
  const out = {};
  for (const [k, v] of Object.entries(ini)) out[k] = { map: num(v.MAPA), x: num(v.X), y: num(v.Y) };
  return out;
}

function loadAll() {
  const t = Date.now();
  const objs = loadObjs();
  const npcs = loadNpcs();
  const spells = loadSpells();
  const mapIni = readIni(path.join(DAT, 'map.dat'));
  const numMaps = num((mapIni.INIT || {}).NUMMAPS, 0);
  const maps = [];
  for (let n = 1; n <= numMaps; n++) {
    try { maps[n] = loadMap(n); } catch (e) { console.error('Error cargando mapa', n, e.message); }
  }
  const cities = loadCities();
  aplicarAjustes(spells, objs);
  // Pasajes de viaje (data/pasajes.json): objetos nuevos armados a partir de uno común
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(DATA, 'pasajes.json'), 'utf8'));
    for (const c of pj.ciudades) {
      objs[c.obj] = Object.assign({}, objs[41], { id: c.obj, name: `Pasaje a ${c.nombre}`, grh: pj.grh, type: OBJ.PASAJE, value: pj.precio, destino: c.destino, newbie: false, agarrable: true, prohibidas: [], soloClases: null });
    }
  } catch (e) { console.error('pasajes.json:', e.message); }
  const npcsExtra = cargarNpcsExtra(npcs);
  // objetos agregados a la venta de NPCs (data/ajustes.json -> vendedores)
  try {
    const aj = JSON.parse(fs.readFileSync(path.join(DATA, 'ajustes.json'), 'utf8'));
    for (const [id, lista] of Object.entries(aj.vendedores || {})) {
      const n = npcs[+id];
      if (!n || !Array.isArray(lista)) continue;
      for (const o of lista) if (objs[o] && !n.items.some((x) => x[0] === o)) n.items.push([o, 1000]);
    }
  } catch (e) { /* sin ajustes */ }
  console.log(`Datos cargados en ${Date.now() - t}ms: ${objs.filter(Boolean).length} objetos, ` +
    `${npcs.filter(Boolean).length} NPCs, ${spells.filter(Boolean).length} hechizos, ` +
    `${maps.filter(Boolean).length} mapas`);
  return { objs, npcs, spells, maps, cities, numMaps, npcsExtra };
}

module.exports = {
  loadAll, normClase, RENUMERADOS, nuevoId, idx, XY, OBJ, CLASES, EVOLUCION, esClaseBase, claseConMana, RESTA, AUMENTO_HIT,
  MANA_POR_NIVEL, NOMBRE_DAT_CLASE, RAZAS, MOD_RAZA, APARIENCIA, ES_RAZA_BAJA, SKILLS, SK, ELU,
  MAX_NIVEL, NIVEL_DESBLOQUEO, CUERPO_MUERTO, CABEZA_MUERTO, FX, TRIGGER, SND,
};
