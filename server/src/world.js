'use strict';
// El mundo del juego: mapas, personajes (jugadores y NPCs), movimiento y mensajes.
const G = require('./gamedata');
const { idx, XY, OBJ, TRIGGER } = G;

const DIRS = { 1: [0, -1], 2: [1, 0], 3: [0, 1], 4: [-1, 0] }; // 1 norte, 2 este, 3 sur, 4 oeste
const rnd = (a, b) => (b <= a ? a : a + Math.floor(Math.random() * (b - a + 1)));

class World {
  constructor(data, config) {
    this.data = data;
    this.config = config;
    this.nextId = 1;
    this.players = new Map(); // id -> player
    this.byName = new Map(); // nombre en minúsculas -> player
    this.npcs = new Map(); // id -> npc
    this.maps = [];
    for (let n = 1; n <= data.numMaps; n++) {
      const d = data.maps[n];
      if (!d) continue;
      this.maps[n] = {
        n, d,
        occ: new Int32Array(XY * XY), // id del personaje que ocupa el tile
        objs: new Map(d.objs), // idx -> {id, amount}
        chars: new Set(), // ids de personajes en el mapa
        players: new Set(),
      };
    }
    this.startTime = Date.now();
  }

  // ---------- utilidades ----------
  inMap(x, y) { return x >= 1 && x <= XY && y >= 1 && y <= XY; }

  entity(id) { return this.players.get(id) || this.npcs.get(id); }

  findPlayer(name) { return this.byName.get(String(name || '').toLowerCase().trim()); }

  isBlocked(m, x, y) {
    const mp = this.maps[m];
    if (!mp || !this.inMap(x, y)) return true;
    return mp.d.blocked[idx(x, y)] === 1;
  }

  isWater(m, x, y) {
    const mp = this.maps[m];
    return !!mp && this.inMap(x, y) && mp.d.water[idx(x, y)] === 1;
  }

  trigger(m, x, y) {
    const mp = this.maps[m];
    return mp && this.inMap(x, y) ? mp.d.trigger[idx(x, y)] : 0;
  }

  enZonaPelea(e) {
    return this.trigger(e.map, e.x, e.y) === TRIGGER.ZONAPELEA;
  }

  isSafe(e) {
    const mp = this.maps[e.map];
    return this.trigger(e.map, e.x, e.y) === TRIGGER.ZONASEGURA || (mp && !mp.d.pk);
  }

  // ¿Puede pararse alguien en este tile?
  legalPos(m, x, y, { water = false, npc = false, ignore = 0 } = {}) {
    const mp = this.maps[m];
    if (!mp || !this.inMap(x, y)) return false;
    const k = idx(x, y);
    if (mp.d.blocked[k]) return false;
    const occ = mp.occ[k];
    if (occ && occ !== ignore) {
      const o = this.entity(occ);
      // Los fantasmas no bloquean a los vivos
      if (!(o && o.kind === 'pc' && o.dead)) return false;
    }
    if (mp.d.water[k] && !water) return false;
    if (!mp.d.water[k] && water && npc) return false;
    if (npc && mp.d.trigger[k] === TRIGGER.POSINVALIDA) return false;
    if (npc && mp.d.exits.has(k)) return false;
    return true;
  }

  // Busca un tile libre cerca de (x,y)
  closestLegalPos(m, x, y, opts = {}) {
    if (this.legalPos(m, x, y, opts)) return { x, y };
    for (let r = 1; r <= 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const nx = x + dx, ny = y + dy;
          if (this.legalPos(m, nx, ny, opts)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  // ---------- envío de mensajes ----------
  send(p, msg) {
    if (p && p.sock && p.sock.readyState === 1) p.sock.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }

  toMap(m, msg, exceptId = 0) {
    const mp = this.maps[m];
    if (!mp) return;
    const s = JSON.stringify(msg);
    for (const id of mp.players) {
      if (id === exceptId) continue;
      const p = this.players.get(id);
      if (p) this.send(p, s);
    }
  }

  toAll(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) this.send(p, s);
  }

  toGMs(msg) {
    const s = JSON.stringify(msg);
    for (const p of this.players.values()) if (p.gm > 0) this.send(p, s);
  }

  // Mensaje de consola. Colores: info, fight, warn, gm, talk, guild, party, server
  msg(p, text, color = 'info') { this.send(p, { t: 'msg', text, color }); }

  // ---------- personajes visibles ----------
  // cabeza que se ve: la de un objeto de apariencia (si todavía lo tiene) o la propia
  cabezaDe(e) {
    if (e.cabezaObj && this.countItem(e, e.cabezaObj) > 0) { const o = this.data.objs[e.cabezaObj]; if (o && o.cabeza) return o.cabeza; }
    return e.head;
  }

  // aura que da la ropa puesta (campo Aura del objeto)
  auraRopa(e) {
    const it = e.eq && e.eq.armor >= 0 && e.inv[e.eq.armor];
    const o = it && this.data.objs[it.id];
    return (o && o.aura) || '';
  }

  charInfo(e) {
    if (e.kind === 'npc') {
      return { id: e.id, n: e.name, x: e.x, y: e.y, h: e.heading, b: e.body, hd: e.head,
        npc: 1, col: e.def.hostile ? 'npc_h' : 'npc', w: 0, s: 0, c: 0, mis: e.def.misiones ? 1 : 0 };
    }
    return {
      id: e.id, n: e.name + (e.guild ? ` <${e.guild}>` : ''), x: e.x, y: e.y, h: e.heading,
      b: e.dead ? G.CUERPO_MUERTO : e.body,
      hd: e.dead ? G.CABEZA_MUERTO : this.cabezaDe ? this.cabezaDe(e) : e.head,
      w: e.dead ? 0 : e.weaponAnim, s: e.dead ? 0 : e.shieldAnim, c: e.dead ? 0 : e.helmetAnim,
      col: e.gm > 0 && !e.hideGm ? 'gm' : (e.crim ? 'cri' : e.faccion === 'neu' ? 'neu' : e.faccion || e.stats.lvl >= 13 ? 'ciu' : 'nov'),
      inv: e.invisible || e.hidden ? 1 : 0, dead: e.dead ? 1 : 0,
      nav: e.sailing ? 1 : 0,
      cap: e.dead || e.sailing || !this.capaInfo ? null : this.capaInfo(e), // capa del clan (o la del pase)
      tt: this.cosmeticosDe ? this.cosmeticosDe(e).titulo : '', // título del pase
      au: e.dead || e.sailing || !this.cosmeticosDe ? '' : this.cosmeticosDe(e).aura, // aura del pase
      al: e.dead || e.sailing ? '' : this.auraRopa(e), // luz de fondo que da la ropa (campo Aura)
      lf: this.liderDe ? this.liderDe(e) : '', // líder faccionario: cri, ciu o neu
      ry: !e.dead && e.eq && e.eq.armor >= 0 && e.inv[e.eq.armor] && (this.data.objs[e.inv[e.eq.armor].id] || {}).rayos ? 1 : 0, // ropa con rayos
      sit: e.sentado || 0, // sentado: 1 en el piso, 2 en un banco
      nb: e.noble ? 1 : 0, // noble: nombre en amarillo
      rk: this.puestoDe ? this.puestoDe(e) : 0, // puesto en el ranking de kills (1, 2 o 3 = estrella)
    };
  }

  // Visible para el observador (los invisibles sólo los ven los GMs y ellos mismos)
  visibleTo(e, viewer) {
    if (e.kind === 'pc' && e.gmInvis && viewer.id !== e.id && !(viewer.gm >= e.gm && viewer.gm > 0)) return false;
    return true;
  }

  sendCharToMap(e) {
    const info = this.charInfo(e);
    const mp = this.maps[e.map];
    if (!mp) return;
    for (const id of mp.players) {
      const p = this.players.get(id);
      if (p && this.visibleTo(e, p)) this.send(p, { t: 'char', c: info });
    }
  }

  // Agrega un personaje al mapa
  place(e, m, x, y) {
    const mp = this.maps[m];
    e.map = m; e.x = x; e.y = y;
    mp.chars.add(e.id);
    if (e.kind === 'pc') mp.players.add(e.id);
    const k = idx(x, y);
    if (!mp.occ[k]) mp.occ[k] = e.id;
    this.sendCharToMap(e);
  }

  remove(e) {
    const mp = this.maps[e.map];
    if (!mp) return;
    mp.chars.delete(e.id);
    mp.players.delete(e.id);
    const k = idx(e.x, e.y);
    if (mp.occ[k] === e.id) mp.occ[k] = 0;
    this.toMap(e.map, { t: 'rm', id: e.id }, e.id);
  }

  // Le manda al jugador todo lo que hay en su mapa
  sendMapState(p) {
    const mp = this.maps[p.map];
    const chars = [];
    for (const id of mp.chars) {
      const e = this.entity(id);
      if (e && this.visibleTo(e, p)) chars.push(this.charInfo(e));
    }
    const objs = [];
    for (const [k, o] of mp.objs) {
      const od = this.data.objs[o.id];
      if (od) objs.push([k % XY + 1, Math.floor(k / XY) + 1, od.grh]);
    }
    this.send(p, { t: 'map', map: p.map, name: mp.d.name, music: mp.d.music, pk: mp.d.pk, ter: mp.d.terreno, zona: mp.d.zona,
      chars, objs, me: p.id, blk: mp.blkCambios ? [...mp.blkCambios].map(([k, b]) => [k % XY + 1, Math.floor(k / XY) + 1, b]) : [] });
  }

  // ---------- movimiento ----------
  moveChar(e, dir) {
    const d = DIRS[dir];
    if (!d) return false;
    const nx = e.x + d[0], ny = e.y + d[1];
    if (e.sentado) e.sentado = 0; // al caminar se para
    e.heading = dir;
    const mp = this.maps[e.map];
    const isPc = e.kind === 'pc';
    const opts = isPc ? { water: !!e.sailing } : { water: e.def.aguaValida, npc: true };
    if (isPc && e.gm >= 2 && e.godWalk) opts.ignore = 0;
    let ok = this.legalPos(e.map, nx, ny, opts);
    // Los GMs con /CAMINAR pueden atravesar todo
    if (!ok && isPc && e.godWalk && this.inMap(nx, ny)) ok = !mp.occ[idx(nx, ny)];
    if (!ok) {
      // Si hay un fantasma o es un muerto caminando sobre alguien, igual se rechaza
      return false;
    }
    const ok_ = idx(e.x, e.y);
    if (mp.occ[ok_] === e.id) mp.occ[ok_] = 0;
    e.x = nx; e.y = ny;
    const nk = idx(nx, ny);
    if (!mp.occ[nk]) mp.occ[nk] = e.id;
    const moveMsg = { t: 'mv', id: e.id, x: nx, y: ny, h: dir };
    for (const id of mp.players) {
      if (id === e.id) continue;
      const p = this.players.get(id);
      if (p && this.visibleTo(e, p)) this.send(p, moveMsg);
    }
    if (isPc) this.afterPlayerMove(e);
    return true;
  }

  afterPlayerMove(p) {
    const mp = this.maps[p.map];
    if (p.dead && p.kind === 'pc' && this.reviveCercaDeSacerdote) this.reviveCercaDeSacerdote(p);
    const k = idx(p.x, p.y);
    let ex = mp.d.exits.get(k);
    // Salir de la Dungeon Newbie por la salida te deja en Ullathorpe
    if (ex && this.maps[ex.map] && /newbie/i.test(mp.d.name) && !/newbie/i.test(this.maps[ex.map].d.name)) ex = { map: 1, x: 55, y: 49 };
    if (ex && this.maps[ex.map]) {
      const dest = this.maps[ex.map].d;
      if (p.kind === 'pc' && p.sailing && dest.zona === 'DUNGEON') {
        // al entrar a una dungeon (por ejemplo desde un portal en el mar) se baja del barco
        p.sailing = false; this.recalcEquip(p);
      } else if (p.kind === 'pc' && !p.sailing && dest.water[idx(ex.x, ex.y)]) {
        // al salir a un portal en el agua se sube al barco (si tiene uno)
        const barco = p.inv.find((it) => it && this.data.objs[it.id] && this.data.objs[it.id].type === 31);
        if (barco) { p.sailing = true; p.body = this.data.objs[barco.id].ropaje || 84; p.weaponAnim = 0; p.shieldAnim = 0; p.helmetAnim = 0; }
      }
      const pos = this.closestLegalPos(ex.map, ex.x, ex.y, { water: !!p.sailing }) || { x: ex.x, y: ex.y };
      this.warp(p, ex.map, pos.x, pos.y, false);
      return;
    }
    if (p.meditating) this.stopMeditating(p);
    if (p.hidden) { p.hidden = false; this.sendCharToMap(p); }
  }

  turn(e, dir) {
    if (!DIRS[dir]) return;
    e.heading = dir;
    this.toMap(e.map, { t: 'turn', id: e.id, h: dir }, e.id);
  }

  warp(p, m, x, y, fx = true) {
    if (!this.maps[m]) return false;
    if (p.kind === 'pc' && m >= 319 && m <= 333 && this.retoPase) this.retoPase(p, 'dungeons', 1, Math.floor((m - 319) / 3)); // dungeons nuevas (3 pisos cada una)
    const pos = this.closestLegalPos(m, x, y, { water: !!p.sailing }) || { x, y };
    const changed = m !== p.map;
    this.remove(p);
    p.map = m; p.x = pos.x; p.y = pos.y;
    if (changed) {
      this.place(p, m, pos.x, pos.y);
      this.sendMapState(p);
    } else {
      this.place(p, m, pos.x, pos.y);
      this.send(p, { t: 'pos', x: p.x, y: p.y });
    }
    if (fx) {
      this.toMap(m, { t: 'fx', id: p.id, fx: G.FX.WARP, loops: 0 });
      this.toMap(m, { t: 'snd', w: G.SND.WARP });
    }
    if (p.meditating) this.stopMeditating(p);
    return true;
  }

  // ---------- objetos en el piso ----------
  objAt(m, x, y) {
    const mp = this.maps[m];
    return mp ? mp.objs.get(idx(x, y)) : null;
  }

  dropObj(m, x, y, id, amount) {
    const mp = this.maps[m];
    if (!mp || !this.data.objs[id]) return false;
    // Busca un tile sin objeto cerca
    let pos = null;
    for (let r = 0; r <= 4 && !pos; r++) {
      for (let dy = -r; dy <= r && !pos; dy++) {
        for (let dx = -r; dx <= r && !pos; dx++) {
          const nx = x + dx, ny = y + dy;
          if (!this.inMap(nx, ny)) continue;
          const k = idx(nx, ny);
          const cur = mp.objs.get(k);
          if (mp.d.blocked[k] || mp.d.water[k]) continue;
          if (!cur) pos = { nx, ny, k };
          else if (cur.id === id && cur.amount + amount <= 10000) pos = { nx, ny, k, stack: cur };
        }
      }
    }
    if (!pos) return false;
    if (pos.stack) pos.stack.amount += amount;
    else mp.objs.set(pos.k, { id, amount, t: Date.now() });
    this.toMap(m, { t: 'obj', x: pos.nx, y: pos.ny, g: this.data.objs[id].grh });
    return true;
  }

  removeObj(m, x, y, amount) {
    const mp = this.maps[m];
    const k = idx(x, y);
    const o = mp.objs.get(k);
    if (!o) return;
    o.amount -= amount;
    if (o.amount <= 0) {
      mp.objs.delete(k);
      this.toMap(m, { t: 'obj', x, y, g: 0 });
    }
  }

  // ---------- tiempo ----------
  uptime() {
    const s = Math.floor((Date.now() - this.startTime) / 1000);
    const h = Math.floor(s / 3600), mi = Math.floor((s % 3600) / 60);
    return `${h}h ${mi}m`;
  }
}

World.rnd = rnd;
World.DIRS = DIRS;
module.exports = World;
