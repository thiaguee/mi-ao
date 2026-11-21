'use strict';
// Interacción con el mundo: clic, doble clic, comercio, banco, sacerdotes, puertas y carteles.
const G = require('./gamedata');
const { idx, OBJ, SK } = G;
const { NPC_TYPE } = require('./combat');
const { INV_SLOTS, BANK_SLOTS } = require('./player');

const I = {};
const near = (a, b, r = 3) => a.map === b.map && Math.abs(a.x - b.x) <= r && Math.abs(a.y - b.y) <= r;

I.entityAt = function (m, x, y) {
  const mp = this.maps[m];
  if (!mp || !this.inMap(x, y)) return null;
  const id = mp.occ[idx(x, y)];
  if (id) return this.entity(id);
  // fantasmas
  for (const pid of mp.players) {
    const p = this.players.get(pid);
    if (p && p.x === x && p.y === y) return p;
  }
  return null;
};

// Clic izquierdo: mirar
I.look = function (p, x, y) {
  const e = this.entityAt(p.map, x, y);
  if (e && this.visibleTo(e, p)) {
    p.target = e.id;
    if (e.kind === 'npc') {
      let txt = e.name;
      if (e.def.attackable) {
        const r = e.hp / e.maxHp;
        const estado = r >= 1 ? 'Intacto' : r > 0.75 ? 'Levemente herido' : r > 0.5 ? 'Herido' : r > 0.25 ? 'Muy herido' : 'Agonizando';
        txt += ` [${estado}]`;
        if (p.gm > 0) txt += ` (${e.hp}/${e.maxHp})`;
      }
      if (p.gm > 0) txt += ` · NPC N° ${e.num}`; // los GMs ven el número de cualquier NPC
      this.msg(p, txt, 'info');
      if (e.def.desc && !e.def.attackable) this.send(p, { t: 'say', id: e.id, text: e.def.desc, color: 'npc' });
    } else {
      // Sólo nombre, clan y qué es (GM, ciudadano o criminal)
      const esGm = e.gm > 0 && !e.hideGm;
      this.send(p, { t: 'ver', n: e.name, clan: e.guild || '', desc: e.desc || '', noble: e.noble ? 1 : 0, muerto: e.dead ? 1 : 0,
        k: esGm ? 'gm' : e.crim ? 'cri' : 'ciu', tipo: esGm ? this.gmTitle(e.gm) : e.crim ? 'Criminal' : 'Ciudadano' });
    }
    return;
  }
  const o = this.objAt(p.map, x, y);
  if (o) {
    const od = this.data.objs[o.id];
    if (od) this.msg(p, `${od.name}${o.amount > 1 ? ' - ' + o.amount : ''}`, 'info');
    return;
  }
  p.target = null;
};

// Doble clic: usar (comerciar, banco, resucitar, puertas, carteles)
I.interact = function (p, x, y) {
  const e = this.entityAt(p.map, x, y);
  if (e && e.kind === 'npc') {
    const t = e.def.type;
    if (!near(p, e, 4)) return this.msg(p, 'Estás demasiado lejos.', 'warn');
    if (t === NPC_TYPE.RESUCITADOR) return this.priest(p, e);
    if (p.dead) return this.msg(p, '¡¡Estás muerto!! Sólo podés hablar con sacerdotes.', 'warn');
    if (e.def.misiones) return this.abrirMaestro(p);
    if (e.def.comandante) return this.abrirCanje(p, e);
    if (t === NPC_TYPE.BANQUERO) return this.openBank(p, e);
    if (e.def.comercia) return this.openTrade(p, e);
    if (t === NPC_TYPE.GOBERNADOR && e.def.ciudad) {
      this.msg(p, 'Escribí /HOGAR para viajar a tu ciudad cuando estés muerto.', 'info');
    }
    if (e.def.desc) this.send(p, { t: 'say', id: e.id, text: e.def.desc, color: 'npc' });
    return;
  }
  const o = this.objAt(p.map, x, y);
  if (o) {
    const od = this.data.objs[o.id];
    if (!od) return;
    if (od.type === OBJ.PUERTA) return this.toggleDoor(p, x, y, o, od);
    if (od.type === OBJ.CARTEL) return this.send(p, { t: 'sign', text: od.texto || od.name });
  }
};

I.priest = function (p, npc) {
  if (p.dead) {
    this.revive(p, true);
    this.send(p, { t: 'say', id: npc.id, text: '¡Volvé a la vida, hijo mío!', color: 'npc' });
    return;
  }
  const s = p.stats;
  s.hp = s.maxHp;
  p.poisoned = false;
  this.sendStat(p, ['hp']);
  this.toMap(p.map, { t: 'snd', w: G.SND.CURAR });
  this.msg(p, 'El sacerdote te ha curado.', 'info');
};

I.toggleDoor = function (p, x, y, o, od) {
  if (Math.abs(p.x - x) > 2 || Math.abs(p.y - y) > 2) return this.msg(p, 'Estás muy lejos.', 'warn');
  // Está abierta si es el objeto "abierto" de su par (en los .dat del AO Libre el campo Abierta está al revés)
  const abierta = o.id === od.indexAbierta;
  if (!abierta && od.llave && p.gm === 0) {
    return this.msg(p, 'La puerta está cerrada con llave.', 'warn');
  }
  const newId = abierta ? od.indexCerrada : od.indexAbierta;
  const nd = this.data.objs[newId];
  if (!nd || !newId) return;
  o.id = newId;
  const mp = this.maps[p.map];
  const block = abierta ? 1 : 0; // si estaba abierta, ahora queda cerrada y bloquea
  for (const tx of [x, x - 1]) {
    if (this.inMap(tx, y)) mp.d.blocked[idx(tx, y)] = block;
  }
  this.toMap(p.map, { t: 'obj', x, y, g: nd.grh });
  this.toMap(p.map, { t: 'blk', tiles: [[x, y, block], [x - 1, y, block]] });
  this.toMap(p.map, { t: 'snd', w: G.SND.PUERTA });
};

// ---------- comercio ----------
I.buyPrice = function (p, o, npc) {
  const sk = p.skills[SK['Comercio']];
  const desc = 1 + sk / 100; // con 100 de comercio, la mitad
  const infl = 1 + (npc.def.inflacion || 0) / 100;
  return Math.max(1, Math.floor(o.value * infl / desc));
};

I.sellPrice = (o) => Math.max(0, Math.floor(o.value / 3));

I.openTrade = function (p, npc) {
  p.trade = { npc: npc.id };
  const items = npc.stock.map((it, i) => {
    const o = this.data.objs[it.id];
    return o ? { i, id: it.id, n: o.name, g: o.grh, a: it.amount, price: this.buyPrice(p, o, npc), ty: o.type,
      mh: o.minHit, xh: o.maxHit, md: o.minDef, xd: o.maxDef } : null;
  }).filter(Boolean);
  const msg = { t: 'trade', npc: npc.name, items };
  if (npc.def.hechizos) {
    // Casa de Hechizos: cada hechizo dice qué clases lo pueden comprar (una solapa por clase)
    const hc = this.hechizosClases();
    for (const it of items) it.cl = Object.keys(hc.clases).filter((c) => hc.permitido(c, it.id));
    msg.clases = Object.keys(hc.clases);
    msg.miClase = this.solapaDe(p) || '';
  }
  this.send(p, msg);
  this.trainSkill(p, SK['Comercio']);
};

// Qué hechizos puede comprar cada clase (data/hechizos-clases.json)
I.hechizosClases = function () {
  if (!this._hc) {
    const fs = require('fs'), path = require('path');
    const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'hechizos-clases.json'), 'utf8'));
    d.permitido = (c, id) => d.todas.includes(id) || (d.clases[c] || []).includes(id);
    this._hc = d;
  }
  return this._hc;
};
const SOLAPA = { 38: 'Mago', 37: 'Mago', 36: 'Mago', 39: 'Nigromante', 42: 'Clérigo', 40: 'Clérigo', 45: 'Druida', 43: 'Druida', 44: 'Bardo', 41: 'Paladín', 47: 'Asesino', 46: 'Asesino' };
I.solapaDe = function (p) { return SOLAPA[p.clase] || null; };

I.endTrade = function (p) {
  if (p.trade) { p.trade = null; this.send(p, { t: 'tradeEnd' }); }
  if (p.banking) { p.banking = null; this.send(p, { t: 'bankEnd' }); }
};

I.tradeNpc = function (p) {
  if (!p.trade) return null;
  const npc = this.npcs.get(p.trade.npc);
  if (!npc || !near(p, npc, 5)) { this.endTrade(p); return null; }
  return npc;
};

I.buy = function (p, i, amount) {
  const npc = this.tradeNpc(p);
  if (!npc) return;
  const it = npc.stock[i];
  if (!it || it.amount <= 0) return;
  amount = Math.max(1, Math.min(10000, Math.floor(+amount || 1), it.amount));
  const o = this.data.objs[it.id];
  if (npc.def.hechizos && p.gm < 2) {
    const c = this.solapaDe(p);
    if (!c || !this.hechizosClases().permitido(c, it.id)) return this.msg(p, 'Ese hechizo no es para tu clase.', 'warn');
  }
  const price = this.buyPrice(p, o, npc);
  const total = price * amount;
  if (p.stats.gld < total) return this.msg(p, 'No tenés suficiente oro.', 'warn');
  const got = this.giveItem(p, it.id, amount);
  if (got <= 0) return;
  p.stats.gld -= price * got;
  // Los vendedores originales tienen stock "infinito" de lo que venden de fábrica
  if (it.amount < 10000) it.amount -= got;
  this.sendStat(p, ['gld']);
  this.msg(p, `Compraste ${got} ${o.name} por ${price * got} monedas.`, 'info');
  this.openTrade(p, npc);
};

I.sell = function (p, slot, amount) {
  const npc = this.tradeNpc(p);
  if (!npc) return;
  const it = p.inv[slot];
  if (!it) return;
  const o = this.data.objs[it.id];
  if (o.newbie) return this.msg(p, 'No podés vender objetos newbie.', 'warn');
  if (this.esDeTorneo(it.id)) return this.msg(p, 'Los objetos de torneo no se pueden vender.', 'warn');
  const tipo = npc.def.tipoItems;
  if (tipo && tipo !== 1000 && tipo !== o.type) return this.msg(p, 'El comerciante no está interesado en ese objeto.', 'warn');
  amount = Math.max(1, Math.min(it.amount, Math.floor(+amount || 1)));
  const price = this.sellPrice(o);
  this.removeFromSlot(p, slot, amount);
  p.stats.gld += price * amount;
  this.sendStat(p, ['gld']);
  const st = npc.stock.find((s) => s.id === o.id);
  if (st) { if (st.amount < 10000) st.amount += amount; } else npc.stock.push({ id: o.id, amount });
  this.msg(p, `Vendiste ${amount} ${o.name} por ${price * amount} monedas.`, 'info');
  this.openTrade(p, npc);
};

// ---------- banco ----------
I.openBank = function (p, npc) {
  p.banking = { npc: npc.id };
  this.sendBank(p);
};

I.sendBank = function (p) {
  const items = [];
  for (let i = 0; i < BANK_SLOTS; i++) {
    const it = p.bank[i];
    const o = it && this.data.objs[it.id];
    items.push(o ? { i, id: it.id, n: o.name, g: o.grh, a: it.amount } : { i, id: 0 });
  }
  this.send(p, { t: 'bank', items, gld: p.bankGld || 0 });
};

I.bankOk = function (p) {
  if (!p.banking) return false;
  const npc = this.npcs.get(p.banking.npc);
  if (!npc || !near(p, npc, 5)) { this.endTrade(p); return false; }
  return true;
};

I.bankDeposit = function (p, slot, amount) {
  if (!this.bankOk(p)) return;
  const it = p.inv[slot];
  if (!it) return;
  amount = Math.max(1, Math.min(it.amount, Math.floor(+amount || 1)));
  let target = p.bank.findIndex((b) => b && b.id === it.id && b.amount + amount <= 10000);
  if (target < 0) target = p.bank.findIndex((b) => !b);
  if (target < 0) return this.msg(p, 'No tenés más lugar en el banco.', 'warn');
  if (p.bank[target]) p.bank[target].amount += amount; else p.bank[target] = { id: it.id, amount };
  this.removeFromSlot(p, slot, amount);
  this.sendBank(p);
};

I.bankWithdraw = function (p, slot, amount) {
  if (!this.bankOk(p)) return;
  const it = p.bank[slot];
  if (!it) return;
  amount = Math.max(1, Math.min(it.amount, Math.floor(+amount || 1)));
  const got = this.giveItem(p, it.id, amount);
  it.amount -= got;
  if (it.amount <= 0) p.bank[slot] = null;
  this.sendBank(p);
};

I.bankGold = function (p, amount, deposit) {
  if (!this.bankOk(p)) return;
  amount = Math.floor(+amount || 0);
  if (amount <= 0) return;
  if (deposit) {
    if (amount > p.stats.gld) amount = p.stats.gld;
    p.stats.gld -= amount; p.bankGld = (p.bankGld || 0) + amount;
  } else {
    if (amount > (p.bankGld || 0)) amount = p.bankGld || 0;
    p.bankGld -= amount; p.stats.gld += amount;
  }
  this.sendStat(p, ['gld']);
  this.sendBank(p);
};

module.exports = I;
void INV_SLOTS;
