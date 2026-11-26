'use strict';
// Jugadores: creación, ingreso, inventario, equipo, niveles, muerte y guardado.
const G = require('./gamedata');
const accounts = require('./accounts');
const World = require('./world');
const { OBJ, SK } = G;
const rnd = World.rnd;

const INV_SLOTS = 25;
const SPELL_SLOTS = 35;
const BANK_SLOTS = 40;
const MAX_STACK = 10000;
const NEWBIE_LVL = 12;
const ORO_SEGURO = 40000; // al morir con esta cantidad de oro o más, el oro no se cae
// Cuerpos "desnudos" por raza (Fénix: 1 humano, 2 enano, 3 elfo, 4 elfo oscuro, 5 gnomo)
const DESNUDO = { 1: { h: 21, m: 39 }, 2: { h: 53, m: 60 }, 3: { h: 210, m: 259 }, 4: { h: 32, m: 40 },
  5: { h: 222, m: 260 } };

const P = {};

// ---------- creación ----------
// Tirada de dados para los atributos (la hace el servidor, así nadie puede hacer trampa)
P.rollDice = () => [0, 0, 0, 0, 0].map(() => Math.max(10, rnd(1, 6) + rnd(1, 6) + rnd(1, 6)));

P.createCharacter = function (sock, req) {
  const name = String(req.name || '').trim();
  const pass = String(req.pass || '');
  const raza = +req.raza, genero = req.genero === 'm' ? 'm' : 'h';
  if (!accounts.validName(name)) return { error: 'Nombre inválido. Usá sólo letras (3 a 20).' };
  if (pass.length < 4) return { error: 'La contraseña debe tener al menos 4 caracteres.' };
  if (!G.RAZAS[raza]) return { error: 'Raza inválida.' };
  if (accounts.exists(name)) return { error: 'Ya existe un personaje con ese nombre.' };
  const reservado = accounts.esReservado(name);
  if (reservado && !this.modoLocal && !accounts.reservaValida(name, pass)) {
    return { error: 'Ese nombre está reservado.' };
  }
  if (this.config.nombresProhibidos.some((n) => name.toLowerCase().includes(n))) {
    return { error: 'Ese nombre no está permitido.' };
  }
  const rec = this.armarPersonaje(name, pass, raza, genero, +req.head, sock._dice || P.rollDice());
  accounts.save(rec);
  this.log('Personaje creado: ' + name);
  if (reservado) accounts.borrarReserva(name);
  return this.login(sock, { name, pass });
};

// Arma el registro de un personaje nuevo (nivel 1, equipo newbie, en Ullathorpe) sin guardarlo
P.armarPersonaje = function (name, pass, raza, genero, headPedida, dice) {
  const ap = G.APARIENCIA[raza][genero];
  let head = headPedida;
  if (!(head >= ap.heads[0] && head <= ap.heads[1])) head = ap.heads[0];

  // Atributos: 3d6 al estilo AO (mínimo 10) + modificador de raza, como en Fénix
  const mod = G.MOD_RAZA[raza];
  const attrs = dice.map((base, i) => Math.max(6, Math.min(23, base + mod[i])));
  const [fu, ag, int, ca, co] = attrs;
  const maxHp = 15 + rnd(1, Math.floor(co / 3));
  const maxSta = 20 * 1 + rnd(1, Math.floor(ag / 6) + 1) + 40;
  const city = this.data.cities.ULLATHORPE || { map: 1, x: 58, y: 45 };
  const rec = {
    name, pass: accounts.hashPass(pass), created: Date.now(),
    raza, genero, clase: 1, head, body: ap.body,
    attrs,
    skills: new Array(G.SKILLS.length).fill(100), // sin skills: todos al máximo
    stats: { lvl: 1, exp: 0, maxHp, hp: maxHp, maxMan: 0, man: 0, maxSta, sta: maxSta,
      ham: 100, sed: 100, gld: this.config.oroInicial || 0, minHit: 1, maxHit: 2, skillPts: 10 },
    inv: [], eq: { weapon: -1, armor: -1, shield: -1, helmet: -1, ammo: -1 },
    spells: [], bank: [], bankGld: 0,
    pos: this.inicioNewbie ? this.inicioNewbie() : { map: city.map, x: city.x, y: city.y }, // los nuevos arrancan en la Dungeon Newbie
    crim: false, faccion: '', kills: { ciu: 0, cri: 0, neu: 0, npcs: 0 }, deaths: 0,
    hogar: 'ULLATHORPE',
  };
  // Equipo inicial newbie
  const bajo = G.ES_RAZA_BAJA(raza);
  const items = [[460, 1], [461, 50], [462, 20], [bajo ? 466 : 463, 1]]; // sin comida ni bebida (no hay hambre ni sed)
  rec.inv = new Array(INV_SLOTS).fill(null);
  items.forEach(([id, amount], i) => { rec.inv[i] = { id, amount }; });
  rec.eq.weapon = 0;
  rec.eq.armor = 3;
  return rec;
};

// ---------- ingreso ----------
P.login = function (sock, req) {
  const name = String(req.name || '').trim();
  const rec = accounts.load(name);
  if (!rec || !accounts.checkPass(rec, req.pass)) return { error: 'Nombre o contraseña incorrectos.' };
  if (this.bans.has(rec.name.toLowerCase())) return { error: 'Este personaje está baneado.' };
  const prev = this.findPlayer(rec.name);
  if (prev) {
    this.msg(prev, 'Alguien entró con tu personaje desde otro lugar.', 'warn');
    this.logout(prev);
  }
  if (this.players.size >= this.config.maxJugadores) return { error: 'El servidor está lleno.' };

  const p = this.playerFromRecord(rec);
  p.sock = sock;
  p.ip = sock._ip || '';
  sock._player = p;
  this.players.set(p.id, p);
  this.byName.set(p.name.toLowerCase(), p);

  let { map, x, y } = rec.pos;
  if (!this.maps[map]) ({ map, x, y } = this.data.cities.ULLATHORPE);
  const pos = this.closestLegalPos(map, x, y) || { x, y };
  p.map = map; p.x = pos.x; p.y = pos.y;
  this.revisarGuerraAlEntrar(p);
  this.recalcEquip(p);
  this.revisarClanAlEntrar(p);
  this.misDe(p);
  this.place(p, p.map, p.x, p.y);
  this.send(p, { t: 'welcome', id: p.id, name: p.name, gm: p.gm, motd: this.config.motd, capa: p.capaOculta ? 0 : 1,
    server: this.config.nombreServidor });
  this.sendMapState(p);
  this.sendAllStats(p);
  this.sendInventory(p);
  this.sendSpells(p);
  this.sendSkills(p);
  this.msg(p, `Bienvenido a ${this.config.nombreServidor}, ${p.name}.`, 'server');
  setTimeout(() => { if (this.players.get(p.id) === p) this.ofrecerFaccion(p); }, 1500);
  for (const line of this.config.motd) this.msg(p, line, 'server');
  if (p.gm > 0) this.msg(p, `Tenés poderes de ${this.gmTitle(p.gm)}. Escribí /GMAYUDA para ver tus comandos.`, 'gm');
  this.checkClassUp(p);
  this.enviarSeguimiento(p);
  this.enviarHora(p);
  if (this.raining) this.send(p, { t: "rain", on: 1 });
  this.pagarPendientesClan(p);
  this.cobrarMercado(p);
  this.log(`Ingresó ${p.name} (${p.ip})`);
  return { ok: true };
};

P.gmTitle = (lvl) => ['Usuario', 'Consejero', 'Semidiós', 'Dios', 'Administrador'][lvl] || 'GM';

P.playerFromRecord = function (rec) {
  const p = Object.assign({}, rec);
  // objetos renumerados al 2000+: el personaje guardado con el número viejo pasa al nuevo
  for (const lista of [p.inv, p.bank]) for (const it of lista || []) if (it && it.id) it.id = G.nuevoId(it.id);
  p.kind = 'pc';
  p.id = this.nextId++;
  p.heading = 3;
  p.gm = this.gmLevel(rec.name);
  p.dead = rec.stats.hp <= 0;
  p.meditating = false; p.invisible = false; p.hidden = false; p.paralyzed = 0; p.poisoned = !!rec.poisoned;
  p.sailing = false; p.godWalk = false; p.gmInvis = false; p.godMode = false;
  p.lastMove = 0; p.lastAttack = 0; p.lastSpell = 0; p.lastUse = 0; p.lastTalk = 0; p.lastWork = 0;
  p.target = null; p.trade = null;
  p.inv = (rec.inv || []).slice(0, INV_SLOTS);
  while (p.inv.length < INV_SLOTS) p.inv.push(null);
  p.bank = (rec.bank || []).slice(0, BANK_SLOTS);
  while (p.bank.length < BANK_SLOTS) p.bank.push(null);
  p.spells = (rec.spells || []).slice(0, SPELL_SLOTS);
  p.skills = new Array(G.SKILLS.length).fill(100); p.stats.skillPts = 0; // sin skills: todos al máximo
  p.jailUntil = rec.jailUntil || 0;
  p.silenced = rec.silenced || 0;
  p.jugado = rec.jugado || 0; p._desde = Date.now(); // tiempo jugado (ms), para medir el ritmo
  p.nivelesHoras = rec.nivelesHoras || {};
  p.advertencias = rec.advertencias || 0;
  p.cabezaObj = rec.cabezaObj || 0;
  // facción: los personajes viejos sin facción guardada eligen al entrar (si son nivel 13+)
  p.faccion = ['ciu', 'cri', 'neu'].includes(rec.faccion) ? rec.faccion : '';
  p.crim = p.faccion ? p.faccion === 'cri' : !!rec.crim;
  return p;
};

P.gmLevel = function (name) {
  const n = name.toLowerCase();
  for (const [lvl, list] of Object.entries(this.config.gms)) {
    if (list.map((s) => s.toLowerCase()).includes(n)) return { admins: 4, dioses: 3, semidioses: 2, consejeros: 1 }[lvl] || 0;
  }
  return 0;
};

P.toRecord = function (p) {
  const ahora = Date.now();
  p.jugado = (p.jugado || 0) + (ahora - (p._desde || ahora)); p._desde = ahora;
  return {
    name: p.name, pass: p.pass, created: p.created, raza: p.raza, genero: p.genero, clase: p.clase,
    head: p.head, body: p.body, attrs: p.attrs, skills: p.skills, stats: p.stats, inv: p.inv,
    eq: p.eq, spells: p.spells, bank: p.bank, bankGld: p.bankGld,
    pos: { map: p.map, x: p.x, y: p.y }, crim: p.crim, faccion: p.faccion || '', kills: p.kills, deaths: p.deaths,
    hogar: p.hogar, poisoned: p.poisoned, jailUntil: p.jailUntil, silenced: p.silenced,
    lastLogin: Date.now(), guild: p.guild || '', capaOculta: !!p.capaOculta, mis: p.mis,
    killsGuerra: p.killsGuerra || 0, puntosTorneo: p.puntosTorneo || 0, canjesFaccion: p.canjesFaccion || [], pase: p.pase || null, noble: !!p.noble, tunicaNoble: p.tunicaNoble || 0,
    nivelGm: !!p.nivelGm, yaNoNewbie: !!p.yaNoNewbie,
    jugado: p.jugado, nivelesHoras: p.nivelesHoras || {}, advertencias: p.advertencias || 0, cabezaObj: p.cabezaObj || 0,
  };
};

P.savePlayer = function (p) {
  try {
    const rec = this.toRecord(p);
    // La contraseña manda la del archivo: así tools/clave-admin.js puede cambiarla con el servidor prendido
    const disco = accounts.load(p.name);
    if (disco && disco.pass) rec.pass = disco.pass;
    accounts.save(rec);
  } catch (e) { console.error('Error guardando', p.name, e); }
};

P.logout = function (p) {
  if (!this.players.has(p.id)) return;
  if (p.enGuerra && this.guerra) this.guerra.participantes.delete(p.name.toLowerCase());
  // si estaba en un duelo, lo pierde; y no queda guardado adentro del Coliseo
  let vuelta = null;
  if (p.duelo) { const d = this.duelos[p.duelo.arena]; vuelta = d && d.vuelta[p.id]; this.muerteEnDuelo(p); p.duelo = null; }
  else if (p.map === 318) vuelta = p.vueltaColiseo || [1, 58, 45];
  this.endTrade(p);
  if (p.party && this.partySalir) this.partySalir(p, 'se desconectó');
  this.savePlayer(p);
  this.remove(p);
  if (vuelta) { [p.map, p.x, p.y] = vuelta; p.vueltaColiseo = null; if (p.dead) this.revive(p, true); this.savePlayer(p); }
  this.players.delete(p.id);
  this.byName.delete(p.name.toLowerCase());
  if (p.sock) { p.sock._player = null; try { p.sock.close(); } catch (e) { /* nada */ } }
  this.log(`Salió ${p.name}`);
};

// ---------- estadísticas ----------
P.sendAllStats = function (p) {
  const s = p.stats;
  this.send(p, { t: 'stats', hp: s.hp, maxHp: s.maxHp, man: s.man, maxMan: s.maxMan, sta: s.sta,
    maxSta: s.maxSta, ham: s.ham, sed: s.sed, gld: s.gld, lvl: s.lvl, exp: s.exp,
    elu: s.lvl >= G.MAX_NIVEL ? 0 : G.ELU[s.lvl], clase: G.CLASES[p.clase], raza: G.RAZAS[p.raza],
    fu: p.attrs[0], ag: p.attrs[1], int: p.attrs[2], ca: p.attrs[3], co: p.attrs[4],
    minHit: s.minHit, maxHit: s.maxHit, crim: p.crim, faccion: p.faccion || '', skillPts: s.skillPts, bankGld: p.bankGld,
    map: p.map, x: p.x, y: p.y, dead: p.dead, mapName: this.maps[p.map].d.name,
    def: this.armorDef(p), kills: p.kills });
};

P.sendStat = function (p, fields) {
  const msg = { t: 'stats' };
  for (const f of fields) {
    msg[f] = f === 'elu' ? G.ELU[p.stats.lvl] : p.stats[f];
  }
  this.send(p, msg);
};

P.sendSkills = function (p) {
  this.send(p, { t: 'skills', names: G.SKILLS, values: p.skills, free: p.stats.skillPts });
};

P.sendInventory = function (p) {
  for (let i = 0; i < INV_SLOTS; i++) this.sendSlot(p, i);
};

P.slotInfo = function (p, i) {
  const it = p.inv[i];
  if (!it) return { i, id: 0 };
  const o = this.data.objs[it.id];
  if (!o) return { i, id: 0 };
  const eq = Object.values(p.eq).includes(i);
  return { i, id: it.id, n: o.name, g: o.grh, a: it.amount, eq: eq ? 1 : 0, ty: o.type,
    mh: o.minHit, xh: o.maxHit, md: o.minDef, xd: o.maxDef, v: Math.floor(o.value / 3),
    pr: o.proyectil ? 1 : 0, pt: o.pocion || 0 };
};

P.sendSlot = function (p, i) {
  this.send(p, Object.assign({ t: 'inv' }, this.slotInfo(p, i)));
};

P.sendSpells = function (p) {
  const list = [];
  for (let i = 0; i < SPELL_SLOTS; i++) {
    const s = this.data.spells[p.spells[i]];
    list.push(s ? { i, id: s.id, n: s.name, mana: s.mana, d: s.desc, nivel: s.nivel || 0, w: s.words } : { i, id: 0 });
  }
  this.send(p, { t: 'spells', list });
};

// ---------- inventario ----------
P.giveItem = function (p, id, amount) {
  const o = this.data.objs[id];
  if (!o || amount <= 0) return 0;
  if (o.type === OBJ.ORO) {
    p.stats.gld += amount;
    this.sendStat(p, ['gld']);
    return amount;
  }
  let left = amount;
  for (let i = 0; i < INV_SLOTS && left > 0; i++) {
    const it = p.inv[i];
    if (it && it.id === id && it.amount < MAX_STACK) {
      const add = Math.min(left, MAX_STACK - it.amount);
      it.amount += add; left -= add;
      this.sendSlot(p, i);
    }
  }
  for (let i = 0; i < INV_SLOTS && left > 0; i++) {
    if (!p.inv[i]) {
      const add = Math.min(left, MAX_STACK);
      p.inv[i] = { id, amount: add }; left -= add;
      this.sendSlot(p, i);
    }
  }
  if (left > 0) this.msg(p, 'No podés cargar más objetos.', 'warn');
  return amount - left;
};

P.removeFromSlot = function (p, i, amount) {
  const it = p.inv[i];
  if (!it) return;
  it.amount -= amount;
  if (it.amount <= 0) {
    for (const k of Object.keys(p.eq)) if (p.eq[k] === i) { p.eq[k] = -1; }
    p.inv[i] = null;
    this.recalcEquip(p);
    this.sendCharToMap(p);
  }
  this.sendSlot(p, i);
};

P.countItem = function (p, id) {
  return p.inv.reduce((a, it) => a + (it && it.id === id ? it.amount : 0), 0);
};

P.takeItem = function (p, id, amount) {
  for (let i = 0; i < INV_SLOTS && amount > 0; i++) {
    const it = p.inv[i];
    if (it && it.id === id) {
      const t = Math.min(amount, it.amount);
      this.removeFromSlot(p, i, t);
      amount -= t;
    }
  }
};

P.canUseObj = function (p, o) {
  if (p.gm >= 2) return true;
  if (o.soloGM && !p.gm) return 'Sólo los Game Masters pueden usar esto.';
  // Túnicas de noble: las usa cualquier noble, sea la clase o la raza que sea; nadie más
  if (this.esTunicaNoble && this.esTunicaNoble(o.id)) return p.noble ? true : 'Sólo los Nobles pueden usar esta túnica.';
  if (o.soloClases) {
    if (!o.soloClases.includes(G.normClase(G.CLASES[p.clase] || ''))) return 'Tu clase no puede usar este objeto.';
  } else {
    const nombre = G.NOMBRE_DAT_CLASE[p.clase];
    if (nombre && o.prohibidas.includes(nombre)) return 'Tu clase no puede usar este objeto.';
  }
  if (o.bajos && !G.ES_RAZA_BAJA(p.raza)) return 'Sólo los enanos y gnomos pueden usar esto.';
  if (!o.bajos && (o.type === OBJ.ARMADURA) && G.ES_RAZA_BAJA(p.raza) && o.ropaje !== 0 && !o.newbie && o.ropaje < 300) {
    return 'Tu raza no puede usar esta vestimenta.';
  }
  if (o.mujer && p.genero !== 'm') return 'Sólo las mujeres pueden usar esto.';
  if (o.hombre && p.genero !== 'h') return 'Sólo los hombres pueden usar esto.';
  if (o.newbie && p.stats.lvl > NEWBIE_LVL) return 'Sólo los newbies pueden usar este objeto.';
  if (this.puedeUsarPorBando) { const b = this.puedeUsarPorBando(p, o); if (b !== true) return b; }
  if (o.type === OBJ.BARCO && p.stats.lvl < 20) return 'Necesitás nivel 20 para usar una barca.';
  return true;
};

P.recalcEquip = function (p) {
  const get = (slot) => (slot >= 0 && p.inv[slot] ? this.data.objs[p.inv[slot].id] : null);
  const w = get(p.eq.weapon), a = get(p.eq.armor), s = get(p.eq.shield), h = get(p.eq.helmet);
  const bajo = G.ES_RAZA_BAJA(p.raza);
  p.weaponAnim = w ? (bajo && w.anim_bajos ? w.anim_bajos : w.anim) : 0;
  p.shieldAnim = s ? s.escudo : 0;
  p.helmetAnim = h ? h.casco : 0;
  const montura = get(p.eq.mount);
  if (!p.sailing) {
    if (montura && montura.ropaje) p.body = montura.ropaje; // se ve montado
    else if (a && a.ropaje) p.body = a.ropaje;
    else p.body = DESNUDO[p.raza][p.genero];
  }
};

// Montura de Elefante: defensa escondida que sólo sirve contra los NPCs (golpes y hechizos): 75% menos daño
const MONTURA_ELEFANTE = 1159;
P.danioDeNpc = function (t, dmg) {
  const sl = t.eq && t.eq.mount;
  if (sl >= 0 && t.inv[sl] && t.inv[sl].id === MONTURA_ELEFANTE) return Math.max(1, Math.ceil(dmg * 0.25));
  return dmg;
};

P.armorDef = function (p) {
  let min = 0, max = 0;
  for (const k of ['armor', 'shield', 'helmet']) {
    const slot = p.eq[k];
    if (slot >= 0 && p.inv[slot]) {
      const o = this.data.objs[p.inv[slot].id];
      if (o) { min += o.minDef; max += o.maxDef; }
    }
  }
  return [min, max];
};

P.equip = function (p, i) {
  const it = p.inv[i];
  if (!it || p.dead) return;
  const o = this.data.objs[it.id];
  if (!o) return;
  const kind = { [OBJ.ARMA]: 'weapon', [OBJ.ARMADURA]: 'armor', [OBJ.ESCUDO]: 'shield', [OBJ.CASCO]: 'helmet',
    [OBJ.FLECHA]: 'ammo', [OBJ.MONTURA]: 'mount' }[o.type];
  if (!kind) return this.msg(p, 'No podés equipar eso.', 'warn');
  if (p.eq[kind] === i) {
    p.eq[kind] = -1;
  } else {
    const ok = kind === 'mount' ? true : this.canUseObj(p, o); // las monturas las usa cualquiera
    if (ok !== true) return this.msg(p, ok, 'warn');
    const old = p.eq[kind];
    p.eq[kind] = i;
    if (old >= 0) this.sendSlot(p, old);
    if (kind === 'weapon') this.toMap(p.map, { t: 'snd', w: G.SND.SACARARMA });
  }
  this.sendSlot(p, i);
  this.recalcEquip(p);
  this.sendCharToMap(p);
  this.send(p, { t: 'stats', def: this.armorDef(p) });
};

P.useItem = function (p, i) {
  const it = p.inv[i];
  if (!it) return;
  const now = Date.now();
  if (now - p.lastUse < 200) return;
  p.lastUse = now;
  const o = this.data.objs[it.id];
  if (!o) return;
  if (p.dead) return this.msg(p, '¡¡Estás muerto!! Los muertos no pueden usar objetos.', 'warn');
  // oficios: la herramienta equipada se usa para trabajar; los minerales se funden en la fragua
  if (this.esHerramienta && this.esHerramienta(it.id) && p.eq.weapon === i && this.usarHerramienta(p)) return;
  if (o.type === OBJ.MINERAL && this.fundir && this.fundir(p, i)) return;
  const s = p.stats;
  if (o.type === OBJ.APARIENCIA) { // Cabeza de Demonio: se pone y se saca usándola
    const puede = this.canUseObj(p, o);
    if (puede !== true) return this.msg(p, puede, 'warn');
    p.cabezaObj = p.cabezaObj === it.id ? 0 : it.id;
    this.msg(p, p.cabezaObj ? `Te pusiste: ${o.name}.` : `Te sacaste: ${o.name}.`, 'info');
    this.sendCharToMap(p);
    return;
  }
  switch (o.type) {
    case OBJ.COMIDA:
    case OBJ.BEBIDA:
      return this.msg(p, 'En Norway AO no hay hambre ni sed: no hace falta comer ni beber.', 'info');
    case OBJ.POCION: {
      const v = rnd(o.minMod, o.maxMod);
      if (o.pocion === 3) { s.hp = Math.min(s.maxHp, s.hp + v); this.sendStat(p, ['hp']); }
      else if (o.pocion === 4) {
        if (!this.puedeRecuperarMana(p)) { this.msg(p, 'Una maldición te impide recuperar maná.', 'warn'); break; }
        s.man = Math.min(s.maxMan, s.man + Math.max(v, Math.floor(s.maxMan * 0.04) + Math.floor(s.lvl / 2) + 40 / s.lvl));
        s.man = Math.floor(s.man);
        this.sendStat(p, ['man']);
      } else if (o.pocion === 1 || o.pocion === 2) {
        const at = o.pocion === 1 ? 1 : 0;
        p.buff = p.buff || {};
        if (!p.buff[at]) p.buff[at] = { base: p.attrs[at] };
        p.attrs[at] = Math.min(p.buff[at].base * 2, Math.min(35, p.attrs[at] + v));
        p.buff[at].until = now + (o.duracion || 1200) * 40;
        this.send(p, { t: 'stats', fu: p.attrs[0], ag: p.attrs[1] });
      } else if (o.pocion === 5) {
        p.poisoned = false;
        this.msg(p, 'Te has curado del envenenamiento.', 'info');
      }
      this.removeFromSlot(p, i, 1);
      this.toMap(p.map, { t: 'snd', w: G.SND.BEBER });
      break;
    }
    case OBJ.PERGAMINO:
      if (!G.claseConMana(p.clase) && p.gm < 2 && !(this.data.spells[o.spell] || {}).paraTodas) return this.msg(p, 'Tu clase no puede aprender hechizos.', 'warn');
      if (p.spells.includes(o.spell)) return this.msg(p, 'Ya conocés ese hechizo.', 'warn');
      {
        let slot = -1;
        for (let k = 0; k < SPELL_SLOTS; k++) if (!p.spells[k]) { slot = k; break; }
        if (slot < 0) return this.msg(p, 'No tenés espacio para más hechizos.', 'warn');
        p.spells[slot] = o.spell;
        this.removeFromSlot(p, i, 1);
        this.sendSpells(p);
        this.msg(p, 'Aprendiste el hechizo ' + (this.data.spells[o.spell] || {}).name + '.', 'info');
      }
      break;
    case OBJ.ARMA: case OBJ.ARMADURA: case OBJ.ESCUDO: case OBJ.CASCO: case OBJ.FLECHA: case OBJ.MONTURA:
      // "Usar" es para consumir (pociones, comida, bebida, pergaminos...). Lo que se viste se equipa aparte.
      if (now - (p.avisoEquipar || 0) > 3000) { p.avisoEquipar = now; this.msg(p, `${o.name} no se consume: para equiparlo apretá E (o doble clic).`, 'info'); }
      break;
    case OBJ.BARCO:
      this.toggleSail(p, i);
      break;
    case OBJ.PASAJE: {
      // se usa parado al lado de un Agente de Viajes (en cualquier ciudad)
      const cerca = [...this.maps[p.map].chars].some((id) => { const n = this.npcs.get(id); return n && n.def.pasajes && Math.abs(n.x - p.x) <= 4 && Math.abs(n.y - p.y) <= 4; });
      if (!cerca) return this.msg(p, 'Para viajar tenés que estar al lado de un Agente de Viajes (hay uno en cada ciudad).', 'warn');
      if (p.duelo || p.enGuerra || p.jailUntil) return this.msg(p, 'Ahora no podés viajar.', 'warn');
      const [m, x, y] = o.destino;
      this.removeFromSlot(p, i, 1);
      this.msg(p, `🐴 ¡Buen viaje! Llegaste a ${this.maps[m].d.name.replace(/\.$/, '')}.`, 'server');
      this.warp(p, m, x, y);
      break;
    }
    default:
      this.msg(p, 'No podés usar este objeto.', 'warn');
  }
};

P.toggleSail = function (p, i) {
  const o = this.data.objs[p.inv[i].id];
  if (!p.sailing && p.stats.lvl < 20 && p.gm < 2) return this.msg(p, 'Necesitás nivel 20 para navegar.', 'warn');
  if (!p.sailing) {
    // tiene que haber agua adelante
    const d = World.DIRS[p.heading];
    if (!this.isWater(p.map, p.x + d[0], p.y + d[1]) && !this.isWater(p.map, p.x, p.y)) {
      return this.msg(p, 'Tenés que estar al lado del agua para navegar.', 'warn');
    }
    p.sailing = true;
    p.body = o.ropaje || 84;
    p.head = p.head; p.weaponAnim = 0; p.shieldAnim = 0; p.helmetAnim = 0;
    this.msg(p, '¡Comenzaste a navegar!', 'info');
  } else {
    if (this.isWater(p.map, p.x, p.y)) {
      // debe bajar en tierra
      const d = World.DIRS[p.heading];
      const nx = p.x + d[0], ny = p.y + d[1];
      if (!this.legalPos(p.map, nx, ny, { water: false })) return this.msg(p, 'Tenés que estar al lado de la costa para bajar.', 'warn');
      const mp = this.maps[p.map];
      mp.occ[(p.y - 1) * 100 + p.x - 1] = 0;
      p.x = nx; p.y = ny;
    }
    p.sailing = false;
    this.recalcEquip(p);
    this.msg(p, 'Dejaste de navegar.', 'info');
    this.remove(p);
    this.place(p, p.map, p.x, p.y);
    this.send(p, { t: 'pos', x: p.x, y: p.y });
  }
  this.sendCharToMap(p);
};

P.dropItem = function (p, i, amount) {
  const it = p.inv[i];
  if (!it || p.dead) return;
  amount = Math.max(1, Math.min(it.amount, Math.floor(+amount || 1)));
  const o = this.data.objs[it.id];
  if (o.newbie && p.gm < 2) return this.msg(p, 'No podés tirar objetos newbie.', 'warn');
  if (this.esDeTorneo(it.id) && p.gm < 2) return this.msg(p, 'Los objetos de torneo no se pueden tirar.', 'warn');
  if (this.dropObj(p.map, p.x, p.y, it.id, amount)) {
    this.removeFromSlot(p, i, amount);
    if (p.gm > 0) this.log(`GM ${p.name} tiró ${amount} ${o.name} en ${p.map} ${p.x} ${p.y}`);
  } else {
    this.msg(p, 'No hay lugar en el piso.', 'warn');
  }
};

P.dropGold = function (p, amount) {
  amount = Math.floor(+amount || 0);
  if (amount <= 0 || amount > p.stats.gld || p.dead) return;
  if (this.dropObj(p.map, p.x, p.y, 12, amount)) {
    p.stats.gld -= amount;
    this.sendStat(p, ['gld']);
  }
};

P.pickUp = function (p) {
  if (p.dead) return this.msg(p, '¡¡Estás muerto!!', 'warn');
  const o = this.objAt(p.map, p.x, p.y);
  if (!o) return this.msg(p, 'No hay nada acá.', 'info');
  const od = this.data.objs[o.id];
  if (!od || o.fija || !od.agarrable || [OBJ.ARBOL, OBJ.PUERTA, OBJ.CARTEL, OBJ.FORO, OBJ.YACIMIENTO, OBJ.YUNQUE,
    OBJ.FRAGUA, OBJ.TELEPORT].includes(od.type)) {
    return this.msg(p, 'No podés agarrar eso.', 'warn');
  }
  const got = this.giveItem(p, o.id, o.amount);
  if (got > 0) {
    this.removeObj(p.map, p.x, p.y, got);
    if (od.type !== OBJ.ORO) this.msg(p, `Agarraste ${got} ${od.name}.`, 'info');
    else this.msg(p, `Agarraste ${got} monedas de oro.`, 'info');
  }
};

// ---------- experiencia y niveles ----------
P.giveExp = function (p, exp) {
  if (exp <= 0) return;
  const s = p.stats;
  if (s.lvl >= G.MAX_NIVEL) return;
  s.exp += Math.floor(exp);
  this.msg(p, `¡Has ganado ${Math.floor(exp)} puntos de experiencia!`, 'fight');
  this.checkLevel(p);
  this.sendStat(p, ['exp', 'elu', 'lvl']);
};

P.checkLevel = function (p) {
  const s = p.stats;
  let subio = false;
  while (s.lvl < G.MAX_NIVEL && s.exp >= G.ELU[s.lvl]) {
    // En Fénix, una clase base no puede pasar de nivel 14 sin evolucionar
    if (s.lvl >= 14 && G.esClaseBase(p.clase)) {
      s.exp = G.ELU[s.lvl] - 1;
      this.msg(p, 'No podés seguir subiendo de nivel hasta que elijas una nueva clase.', 'warn');
      break;
    }
    s.exp -= G.ELU[s.lvl];
    s.lvl++;
    subio = true;
    // a qué hora de juego llegó a cada nivel (para medir el ritmo con /RITMO)
    if (!p.nivelesHoras) p.nivelesHoras = {};
    p.nivelesHoras[s.lvl] = Math.round(((p.jugado || 0) + (Date.now() - (p._desde || Date.now()))) / 360000) / 10;
    const con = p.attrs[4];
    const prom = con / 2 - (G.RESTA[p.clase] || 2);
    const hp = Math.max(1, rnd(Math.floor(prom - 1), Math.round(prom + 1)));
    const hit = G.AUMENTO_HIT[p.clase] || 2;
    const sta = 15;
    const manaF = G.MANA_POR_NIVEL[p.clase] || 0;
    const man = Math.floor(manaF * p.attrs[2]);
    s.maxHp = Math.min(2500, s.maxHp + hp);
    s.maxSta = Math.min(999, s.maxSta + sta);
    s.maxMan = Math.min(3000, s.maxMan + man);
    s.minHit = Math.min(99, s.minHit + hit);
    s.maxHit = Math.min(99, s.maxHit + hit);
    this.msg(p, `¡Has subido al nivel ${s.lvl}!`, 'server');
    if (s.lvl === this.NIVEL_FACCION) p._aFaccion = true;
    if (this.retoPase) this.retoPase(p, 'niveles');
    if (s.lvl === G.NIVEL_DESBLOQUEO) {
      this.msg(p, `¡Llegaste al nivel ${G.NIVEL_DESBLOQUEO}! Se desbloquearon 10 niveles más (hasta el ${G.MAX_NIVEL}) y las MISIONES DE ÉLITE en los Maestros de Misiones.`, 'server');
      this.toAll({ t: 'msg', text: `¡${p.name} llegó al nivel ${G.NIVEL_DESBLOQUEO} y desbloqueó los niveles de élite!`, color: 'server' });
    }
    this.msg(p, `Ganaste ${hp} de vida, ${sta} de energía${man ? `, ${man} de maná` : ''}, ${hit} de golpe.`, 'info');
    if (s.lvl > NEWBIE_LVL && s.lvl - 1 === NEWBIE_LVL) this.dropNewbieItems(p);
  }
  if (subio) {
    s.hp = s.maxHp; s.sta = s.maxSta; s.man = s.maxMan;
    if (p._aFaccion) { p._aFaccion = false; setTimeout(() => this.graduarNewbie(p), 1200); }
    this.toMap(p.map, { t: 'snd', w: G.SND.NIVEL });
    this.sendAllStats(p);
    this.sendSkills(p);
    this.checkClassUp(p);
  }
};

P.dropNewbieItems = function (p) {
  for (let i = 0; i < INV_SLOTS; i++) {
    const it = p.inv[i];
    if (it && this.data.objs[it.id] && this.data.objs[it.id].newbie) this.removeFromSlot(p, i, it.amount);
  }
  this.msg(p, 'Ya no sos newbie: tus objetos newbie desaparecieron.', 'warn');
  this.darSetPostNewbie(p);
};

// Set que se recibe al dejar de ser newbie (nivel 13). No se cae al morir hasta el nivel 30.
const SET_POST_NEWBIE = {
  38: [239, 661, 659], // Mago: Túnica Roja, Sombrero de Aprendiz, Bastón Nudoso
  44: [239, 165, 404, 132], // Bardo: Túnica Roja, Daga +1, Escudo de Tortuga, Casco de Hierro
  42: [239, 2, 404, 132], // Clérigo: Túnica Roja, Espada Larga, Escudo de Tortuga, Casco de Hierro
  41: [239, 2, 404, 132], // Paladín
};
const SET_RESTO = [239, 15]; // las demás clases: Túnica Roja y Daga
const TUNICA_CHICOS = { 239: 524 }; // enanos y gnomos: Túnica Roja Especial (E/G)
const SET_NO_CAE_HASTA = 30;
P.darSetPostNewbie = function (p) {
  let ids = SET_POST_NEWBIE[p.clase] || SET_RESTO;
  if (G.ES_RAZA_BAJA(p.raza)) ids = ids.map((id) => TUNICA_CHICOS[id] || id);
  const nombres = [];
  for (const id of ids) {
    const o = this.data.objs[id];
    if (!o) continue;
    const slot = p.inv.findIndex((x) => !x);
    if (slot < 0) { this.msg(p, 'No tenés lugar en el inventario para recibir todo el set.', 'warn'); break; }
    p.inv[slot] = { id, amount: 1, nc: SET_NO_CAE_HASTA };
    nombres.push(o.name);
    this.sendSlot(p, slot);
    if (this.canUseObj(p, o) === true) this.equip(p, slot);
  }
  if (nombres.length) {
    this.msg(p, `¡Recibiste tu set de aventurero! ${nombres.join(', ')}. No se te cae al morir hasta el nivel ${SET_NO_CAE_HASTA}.`, 'server');
  }
};

P.checkClassUp = function (p) {
  const ev = G.EVOLUCION[p.clase];
  if (ev && p.stats.lvl >= ev.nivel) {
    this.send(p, { t: 'classup', actual: G.CLASES[p.clase],
      opciones: ev.opciones.map((c) => ({ id: c, n: G.CLASES[c] })) });
  }
};

P.chooseClass = function (p, c) {
  const ev = G.EVOLUCION[p.clase];
  c = +c;
  if (!ev || p.stats.lvl < ev.nivel || !ev.opciones.includes(c)) return;
  p.clase = c;
  // Al volverse clase mágica, recibe el maná que le corresponde por los niveles ya hechos
  if (G.claseConMana(c) && p.stats.maxMan === 0) {
    const f = G.MANA_POR_NIVEL[c] || 1;
    p.stats.maxMan = Math.floor(f * p.attrs[2] * Math.max(1, p.stats.lvl - 5));
    p.stats.man = p.stats.maxMan;
  }
  // Al elegir "Con uso de maná" recibe el Dardo Mágico enseguida (y maná para usarlo), para levelear rápido
  if (c === 36) {
    p.stats.maxMan = Math.max(p.stats.maxMan, 100 + p.attrs[2] * 3);
    p.stats.man = p.stats.maxMan;
    const dardo = this.data.spells.findIndex((s) => s && /dardo m/i.test(s.name));
    if (dardo > 0 && !p.spells.includes(dardo)) {
      let slot = 0; while (p.spells[slot]) slot++;
      p.spells[slot] = dardo;
      this.sendSpells(p);
      this.msg(p, '¡Aprendiste el hechizo Dardo Mágico! Abrí la pestaña HECHIZOS, tocá LANZAR y hacé clic en un bicho.', 'server');
    }
  }
  this.msg(p, `¡Ahora sos ${G.CLASES[c]}!`, 'server');
  // Si el nivel lo puso un GM con /NIVEL, los stats se recalculan con la clase elegida
  if (p.nivelGm) {
    this.ponerStatsMaximos(p);
    const ev = G.EVOLUCION[p.clase];
    if (!ev || p.stats.lvl < ev.nivel) p.nivelGm = false; // no quedan carteles por elegir
  }
  this.toMap(p.map, { t: 'fx', id: p.id, fx: G.FX.WARP, loops: 0 });
  this.sendAllStats(p);
  this.checkClassUp(p);
};

P.assignSkills = function (p, values) {
  return; // sin skills: todos tienen el máximo
  // eslint-disable-next-line no-unreachable
  if (!Array.isArray(values)) return;
  let total = 0;
  const add = values.map((v) => Math.max(0, Math.floor(+v || 0)));
  for (const v of add) total += v;
  if (total === 0 || total > p.stats.skillPts) return;
  for (let i = 0; i < p.skills.length; i++) {
    if (p.skills[i] + (add[i] || 0) > 100) return this.msg(p, 'Un skill no puede pasar de 100.', 'warn');
  }
  for (let i = 0; i < p.skills.length; i++) p.skills[i] += add[i] || 0;
  p.stats.skillPts -= total;
  this.sendSkills(p);
  this.msg(p, 'Skills asignados.', 'info');
};

// Sube un skill por uso (estilo Fénix: probabilidad que baja con el nivel del skill)
P.trainSkill = function (p, sk) {
  return; // sin skills: todos tienen el máximo, no se entrenan
  // eslint-disable-next-line no-unreachable
  if (p.skills[sk] >= 100) return;
  const cap = Math.min(100, 3 + p.stats.lvl * 3);
  if (p.skills[sk] >= cap) return;
  const chance = p.skills[sk] < 10 ? 0.35 : p.skills[sk] < 30 ? 0.2 : p.skills[sk] < 60 ? 0.1 : 0.05;
  if (Math.random() < chance) {
    p.skills[sk]++;
    this.msg(p, `¡Has mejorado tu skill ${G.SKILLS[sk]} en un punto! Ahora tenés ${p.skills[sk]} pts.`, 'info');
    this.giveExp(p, 50);
    this.sendSkills(p);
  }
};

// ---------- muerte ----------
P.killPlayer = function (p, killer) {
  if (p.dead) return;
  const s = p.stats;
  s.hp = 0;
  p.dead = true;
  p.meditating = false; p.invisible = false; p.hidden = false; p.paralyzed = 0; p.poisoned = false;
  p.sangrado = null; p.sinManaHasta = 0;
  p.deaths = (p.deaths || 0) + 1;
  this.msg(p, '¡¡¡Estás muerto!!! Buscá un sacerdote para que te resucite, o escribí /HOGAR.', 'warn');
  this.toMap(p.map, { t: 'snd', w: G.SND.USERMUERTE });
  // en la guerra (o en zona de pelea) no se cae nada ni cambia ciudadano/criminal
  const enGuerra = !!p.enGuerra;
  const zonaPelea = enGuerra || this.trigger(p.map, p.x, p.y) === G.TRIGGER.ZONAPELEA;
  // Se caen los objetos (no los newbies ni los "no se cae"), salvo en zona de pelea o si es newbie
  if (!zonaPelea && s.lvl > NEWBIE_LVL && p.gm === 0) {
    for (let i = 0; i < INV_SLOTS; i++) {
      const it = p.inv[i];
      if (!it) continue;
      const o = this.data.objs[it.id];
      if (!o || o.newbie || o.noSeCae || this.esDeTorneo(it.id)) continue; // los de torneo no se caen
      if (it.nc && s.lvl <= it.nc) continue; // set post-newbie: no se cae hasta el nivel indicado
      if (this.dropObj(p.map, p.x, p.y, it.id, it.amount)) {
        for (const k of Object.keys(p.eq)) if (p.eq[k] === i) p.eq[k] = -1;
        p.inv[i] = null;
      }
    }
    // El oro se cae sólo si tenés menos de 40.000: con 40.000 o más no se pierde nada
    if (s.gld > 0 && s.gld < ORO_SEGURO) {
      this.dropObj(p.map, p.x, p.y, 12, s.gld);
      s.gld = 0;
    }
    this.sendInventory(p);
  }
  if (p.sailing) { p.sailing = false; }
  this.recalcEquip(p);
  this.sendCharToMap(p);
  this.sendAllStats(p);
  if (enGuerra) this.muerteEnGuerra(p, killer);
  if (p.duelo) this.muerteEnDuelo(p);
  if (killer && killer.kind === 'pc' && killer.id !== p.id && !zonaPelea) {
    // ya nadie se vuelve criminal por matar: sólo se cuenta a quién mataste
    const victimaEraCrim = !!p.crim;
    const fv = p.faccion === 'neu' ? 'neu' : p.crim ? 'cri' : 'ciu';
    killer.kills[fv] = (killer.kills[fv] || 0) + 1;
    this.msg(killer, `Has matado a ${p.name}!`, 'fight');
    this.msg(p, `${killer.name} te ha matado!`, 'fight');
    this.giveExp(killer, Math.floor(p.stats.lvl * 2));
    this.send(killer, { t: 'stats', kills: killer.kills, crim: killer.crim });
    this.sumarKillRanking(killer);
    if (this.misionPk) this.misionPk(killer, p, victimaEraCrim, fv);
  }
};

P.revive = function (p, full = false) {
  if (!p.dead) return;
  p.dead = false;
  p.stats.hp = full ? p.stats.maxHp : Math.max(1, Math.floor(p.stats.maxHp * 0.1));
  if (full) { p.stats.man = p.stats.maxMan; p.stats.sta = p.stats.maxSta; }
  this.recalcEquip(p);
  this.sendCharToMap(p);
  this.sendAllStats(p);
  this.toMap(p.map, { t: 'snd', w: G.SND.RESUCITAR });
  this.msg(p, '¡Has sido resucitado!', 'info');
};

// ---------- meditación ----------
P.toggleMeditate = function (p) {
  if (p.dead) return this.msg(p, '¡¡Estás muerto!!', 'warn');
  if (p.meditating) return this.stopMeditating(p);
  if (p.stats.maxMan === 0) return this.msg(p, 'Tu clase no usa maná, no podés meditar.', 'warn');
  if (p.stats.man >= p.stats.maxMan) return this.msg(p, 'Tu maná ya está completo.', 'info');
  p.meditating = true;
  p.medStart = Date.now();
  const lvl = p.stats.lvl;
  const fx = lvl < 13 ? G.FX.MEDITAR[0] : lvl < 25 ? G.FX.MEDITAR[1] : lvl < 35 ? G.FX.MEDITAR[2] : lvl < 42 ? G.FX.MEDITAR[3] : G.FX.MEDITAR[4];
  p.medFx = fx;
  this.toMap(p.map, { t: 'fx', id: p.id, fx, loops: -1 });
  this.msg(p, 'Comenzás a meditar.', 'info');
  this.send(p, { t: 'meditate', on: 1 });
};

P.stopMeditating = function (p) {
  if (!p.meditating) return;
  p.meditating = false;
  this.toMap(p.map, { t: 'fx', id: p.id, fx: 0, loops: 0 });
  this.msg(p, 'Dejás de meditar.', 'info');
  this.send(p, { t: 'meditate', on: 0 });
};

// ---------- regeneración, hambre y sed (cada segundo) ----------
P.playerTick = function (p, now) {
  const s = p.stats;
  let changed = [];
  if (p.buff) {
    for (const at of Object.keys(p.buff)) {
      if (now > p.buff[at].until) {
        p.attrs[at] = p.buff[at].base; delete p.buff[at];
        this.send(p, { t: 'stats', fu: p.attrs[0], ag: p.attrs[1] });
        this.msg(p, 'El efecto de la poción terminó.', 'info');
      }
    }
  }
  if (p.paralyzed && now > p.paralyzed) { p.paralyzed = 0; this.send(p, { t: 'para', on: 0 }); }
  if (p.invisible && now > p.invisibleUntil) { p.invisible = false; this.sendCharToMap(p); this.msg(p, 'Volvés a ser visible.', 'info'); }
  if (p.jailUntil && now > p.jailUntil) {
    p.jailUntil = 0;
    const c = this.data.cities.ULLATHORPE;
    this.warp(p, c.map, c.x, c.y);
    this.msg(p, 'Cumpliste tu condena. Sos libre.', 'info');
  }
  if (p.dead) return;
  p.tick = (p.tick || 0) + 1;
  if (p.tick % 3 === 0 && this.revisarTunicaDeBando) this.revisarTunicaDeBando(p);
  // Sin hambre ni sed: el sistema se sacó (siempre quedan llenos)
  s.ham = 100; s.sed = 100;
  const hungry = false;
  // Energía
  if (p.tick % 2 === 0 && !hungry && s.sta < s.maxSta) {
    s.sta = Math.min(s.maxSta, s.sta + Math.max(1, Math.floor(s.maxSta * 0.04)));
    changed.push('sta');
  }
  // Vida (sólo descansando y sin hambre)
  if (p.tick % 8 === 0 && !hungry && s.hp < s.maxHp && !p.poisoned) {
    s.hp = Math.min(s.maxHp, s.hp + Math.max(1, Math.floor(s.maxHp * 0.02) + rnd(0, 2)));
    changed.push('hp');
  }
  // Sangrado (Daga Sangrienta): 20-30 de vida por segundo mientras dure
  if (p.sangrado) {
    if (now > p.sangrado.hasta || p.dead) p.sangrado = null;
    else if (!p.godMode) {
      const d = rnd(20, 30);
      s.hp -= d;
      this.toMap(p.map, { t: 'dmg', id: p.id, v: d });
      changed.push('hp');
      if (s.hp <= 0) { const k = this.players.get(p.sangrado.por); p.sangrado = null; this.killPlayer(p, k || null); return; }
    }
  }
  // Veneno
  if (p.poisoned && p.tick % 3 === 0) {
    s.hp -= rnd(1, 5);
    this.msg(p, 'Estás envenenado, si no te curás vas a morir.', 'warn');
    changed.push('hp');
    if (s.hp <= 0) { this.killPlayer(p, null); return; }
  }
  // Meditación
  if (p.meditating) {
    const med = p.skills[SK['Meditar']];
    if (now - p.medStart > 1500 && this.puedeRecuperarMana(p)) {
      const gain = Math.max(1, Math.floor(s.maxMan * (0.015 + med / 2500))) + Math.floor(s.lvl / 4);
      s.man = Math.min(s.maxMan, s.man + gain);
      changed.push('man');
      if (Math.random() < 0.3) this.trainSkill(p, SK['Meditar']);
      if (s.man >= s.maxMan) { this.msg(p, 'Terminaste de meditar.', 'info'); this.stopMeditating(p); }
    }
  }
  if (changed.length) this.sendStat(p, [...new Set(changed)]);
};

// ---------- /NIVEL: llevar a un personaje directo a un nivel ----------
// Camino de clases desde Ciudadano hasta la clase actual, con el nivel en que empieza cada una
P.caminoDeClases = function (clase) {
  const padre = {};
  for (const [c, ev] of Object.entries(G.EVOLUCION)) for (const h of ev.opciones) padre[h] = { c: +c, nivel: ev.nivel };
  const camino = [];
  let c = clase;
  while (padre[c]) { camino.unshift({ clase: c, desde: padre[c].nivel }); c = padre[c].c; }
  camino.unshift({ clase: c, desde: 1 });
  return camino;
};

// Vida, energía, maná y golpe máximos posibles para su nivel, según su raza (sus atributos)
// y las clases por las que pasó: como si hubiera sacado la mejor tirada en cada nivel.
P.ponerStatsMaximos = function (p) {
  const s = p.stats;
  const [, ag, int, , co] = p.attrs;
  const camino = this.caminoDeClases(p.clase);
  // El nivel L se gana con la clase que tenía en el nivel L-1
  const claseEn = (nivel) => { let c = camino[0]; for (const x of camino) if (x.desde <= nivel) c = x; return c.clase; };
  let hp = 15 + Math.floor(co / 3);
  let sta = 20 + Math.floor(ag / 6) + 1 + 40;
  let man = 0, hit = 0, conMana = false;
  for (let L = 2; L <= s.lvl; L++) {
    const c = claseEn(L - 1);
    // Al volverse clase mágica recibe el maná de los niveles anteriores (igual que al elegirla jugando)
    if (!conMana && G.claseConMana(c)) {
      conMana = true;
      man += Math.floor((G.MANA_POR_NIVEL[c] || 1) * int * Math.max(1, L - 1 - 5));
      if (c === 36) man = Math.max(man, 100 + int * 3);
    }
    const prom = co / 2 - (G.RESTA[c] || 2);
    hp += Math.max(1, Math.round(prom + 1));
    sta += 15;
    man += Math.floor((G.MANA_POR_NIVEL[c] || 0) * int);
    hit += G.AUMENTO_HIT[c] || 2;
  }
  if (!conMana && G.claseConMana(p.clase)) man = Math.max(Math.floor((G.MANA_POR_NIVEL[p.clase] || 1) * int * Math.max(1, s.lvl - 5)), p.clase === 36 ? 100 + int * 3 : 0);
  s.maxHp = Math.min(2500, hp); s.hp = s.maxHp;
  s.maxSta = Math.min(999, sta); s.sta = s.maxSta;
  s.maxMan = Math.min(3000, man); s.man = s.maxMan;
  s.minHit = Math.min(99, 1 + hit); s.maxHit = Math.min(99, 2 + hit);
  this.sendAllStats(p);
};

const skillPtsHasta = (lvl) => (lvl >= 2 ? 10 + 5 * (lvl - 2) : 0);

P.ponerNivel = function (p, lvl) {
  const s = p.stats;
  const antes = s.lvl;
  s.lvl = lvl;
  s.exp = 0;
  // Skillpoints: suma los de los niveles ganados o quita de los libres los de los niveles perdidos
  s.skillPts = 0; void skillPtsHasta; // sin skills
  // Al pasar el nivel newbie pierde lo newbie y recibe el set de aventurero, una sola vez
  // (si un GM lo bajó y lo vuelve a subir, no se le da otro set)
  if (antes > NEWBIE_LVL && lvl <= NEWBIE_LVL) p.yaNoNewbie = true;
  if (antes <= NEWBIE_LVL && lvl > NEWBIE_LVL && !p.yaNoNewbie) this.dropNewbieItems(p);
  p.nivelGm = true;
  this.ponerStatsMaximos(p);
  const ev = G.EVOLUCION[p.clase];
  if (!ev || lvl < ev.nivel) p.nivelGm = false;
  this.msg(p, 'Ahora sos nivel ' + lvl + '.', 'server');
  this.sendSkills(p);
  this.checkClassUp(p); // si le faltan evoluciones, le aparece el cartel (y después los siguientes)
  if (lvl >= this.NIVEL_FACCION && this.enDungeonNewbie(p)) this.graduarNewbie(p); else this.ofrecerFaccion(p);
};

module.exports = Object.assign(P, { INV_SLOTS, SPELL_SLOTS, BANK_SLOTS, NEWBIE_LVL });
