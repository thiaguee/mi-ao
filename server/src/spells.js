'use strict';
// Hechizos: lanzar sobre usuarios o NPCs, curar, dañar, paralizar, invisibilidad, revivir, invocar.
const G = require('./gamedata');
const World = require('./world');
const { idx, SK } = G;
const rnd = World.rnd;

const S = {};
const PARALISIS_NPC_MS = 7 * 60 * 1000; // un bicho paralizado queda así 7 minutos (o hasta que muera)
const TARGET = { USUARIO: 1, NPC: 2, AMBOS: 3, TERRENO: 4 };

S.castSpell = function (p, slot, x, y) {
  const now = Date.now();
  const sp = this.data.spells[p.spells[slot]];
  if (!sp) return this.msg(p, 'No tenés un hechizo en ese lugar.', 'warn');
  if (p.dead) return this.msg(p, '¡¡Estás muerto!!', 'warn');
  if (now - p.lastSpell < this.config.intervaloHechizo) return;
  if (this.maps[p.map].d.magiaSinEfecto && p.gm === 0) return this.msg(p, 'Una fuerza oscura te impide canalizar tu energía.', 'warn');
  const s = p.stats;
  if (s.man < sp.mana) return this.msg(p, 'No tenés suficiente maná.', 'warn');
  if (s.sta < sp.sta) return this.msg(p, 'Estás muy cansado para lanzar este hechizo.', 'warn');
  if (p.gm < 2) {
    if (p.skills[SK['Magia']] < sp.minSkill) return this.msg(p, 'No tenés suficientes puntos de magia para lanzar este hechizo.', 'warn');
  }
  // Sin límite de alcance: si lo ves en tu pantalla, lo podés atacar (el límite es sólo anti-trampas)
  if (Math.abs(x - p.x) > 40 || Math.abs(y - p.y) > 30) return this.msg(p, 'Estás demasiado lejos.', 'warn');
  const mp = this.maps[p.map];
  if (!this.inMap(x, y)) return;
  let target = null;
  const occ = mp.occ[idx(x, y)];
  if (occ) target = this.entity(occ);
  // Los fantasmas no ocupan tile: buscalos igual para poder revivirlos
  if (!target && sp.revivir) {
    for (const id of mp.players) {
      const o = this.players.get(id);
      if (o && o.x === x && o.y === y) target = o;
    }
  }
  if (sp.invoca) return this.summon(p, sp, x, y, now);
  if (sp.portalUlla) return this.portalUlla(p, sp, x, y, now);
  if (!target) return this.msg(p, 'Tenés que apuntar a alguien.', 'warn');
  if (sp.target === TARGET.USUARIO && target.kind !== 'pc') return this.msg(p, 'Este hechizo sólo afecta a usuarios.', 'warn');
  if (sp.target === TARGET.NPC && target.kind !== 'npc') return this.msg(p, 'Este hechizo sólo afecta a criaturas.', 'warn');

  const ofensivo = sp.subeHp === 2 || sp.paraliza || sp.inmoviliza || sp.envenena || sp.ceguera || sp.estupidez ||
    sp.subeMana === 2 || sp.subeSta === 2;
  if (ofensivo) {
    if (target.id === p.id) return this.msg(p, 'No podés atacarte a vos mismo.', 'warn');
    if (!this.canAttack(p, target)) return;
  }
  if (sp.revivir && (target.kind !== 'pc' || !target.dead)) return this.msg(p, 'Sólo podés revivir a los muertos.', 'warn');
  if (!sp.revivir && target.kind === 'pc' && target.dead) return this.msg(p, 'No podés lanzar hechizos a un espíritu.', 'warn');

  p.lastSpell = now;
  if (p.meditating) this.stopMeditating(p);
  s.man -= sp.mana; s.sta -= sp.sta;
  this.sendStat(p, ['man', 'sta']);
  this.trainSkill(p, SK['Magia']);
  if (sp.words) this.toMap(p.map, { t: 'say', id: p.id, text: sp.words, color: 'spell' });
  if (sp.fx) this.toMap(p.map, { t: 'fx', id: target.id, fx: sp.fx, loops: sp.loops || 0 });
  if (sp.wav) this.toMap(p.map, { t: 'snd', w: sp.wav });

  if (ofensivo && target.kind === 'pc' && !p.crim && !target.crim && !this.peleaDeGuerra(p, target) && !(this.enZonaPelea(p) && this.enZonaPelea(target))) {
    p.crim = true;
    this.msg(p, '¡Te has convertido en criminal por atacar a un ciudadano!', 'warn');
    this.sendCharToMap(p);
    this.send(p, { t: 'stats', crim: true });
  }
  this.applySpell(p, target, sp);
};

// Daño mágico al estilo AO: base + 3% por nivel, más bonus de báculos
S.spellDamage = function (p, sp) {
  let dmg = rnd(sp.minHp, sp.maxHp);
  dmg += Math.floor(dmg * 3 * p.stats.lvl / 100);
  const w = this.weaponOf(p);
  if (w && w.staffDamageBonus) dmg += Math.floor(dmg * w.staffDamageBonus / 100);
  return dmg;
};

S.applySpell = function (p, t, sp) {
  const self = t.id === p.id;
  const tellCaster = (txt) => { if (!self && txt) this.msg(p, txt + (t.name || ''), 'spell'); };
  const tellTarget = (txt) => {
    if (t.kind !== 'pc') return;
    if (self) { if (sp.msgSelf) this.msg(t, sp.msgSelf, 'spell'); }
    else if (sp.msgTarget) this.msg(t, `${p.name} ${sp.msgTarget}`, 'spell');
  };
  if (t.kind === 'npc') {
    if (sp.subeHp === 2) {
      let dmg = this.spellDamage(p, sp);
      // Crítico y divino (por ejemplo Castigo): una sola tirada -> divino x3, crítico x2 o normal
      let golpe = '';
      if (sp.critico || sp.divino) {
        const r = Math.random() * 100;
        if (r < (sp.divino || 0)) { dmg *= 3; golpe = '¡CASTIGO DIVINO! '; }
        else if (r < (sp.divino || 0) + (sp.critico || 0)) { dmg *= 2; golpe = '¡Golpe crítico! '; }
      }
      dmg = Math.max(1, dmg - (t.def.defM || 0));
      this.msg(p, `${golpe}¡Le has quitado ${dmg} puntos de vida a ${t.name}!`, 'spell');
      this.damageNpc(t, dmg, p, true);
      return;
    }
    if (sp.subeHp === 1) {
      t.hp = Math.min(t.maxHp, t.hp + rnd(sp.minHp, sp.maxHp));
      this.msg(p, 'Has curado a la criatura.', 'spell');
    }
    if (sp.paraliza || sp.inmoviliza) {
      t.paralyzed = Date.now() + PARALISIS_NPC_MS;
      t.target = p.id;
      this.msg(p, `${t.name} quedó paralizado.`, 'spell');
    }
    if (sp.envenena) { t.poisoned = true; t.lastHitBy = p.id; this.msg(p, `Has envenenado a ${t.name}.`, 'spell'); }
    return;
  }
  // ---- sobre usuarios ----
  const s = t.stats;
  if (sp.revivir) {
    this.revive(t, false);
    tellCaster(sp.msgCaster);
    return;
  }
  if (sp.subeHp === 1) {
    const v = rnd(sp.minHp, sp.maxHp) + Math.floor(rnd(sp.minHp, sp.maxHp) * 3 * p.stats.lvl / 100);
    s.hp = Math.min(s.maxHp, s.hp + v);
    this.sendStat(t, ['hp']);
    tellCaster(sp.msgCaster); tellTarget();
    if (!self) this.msg(p, `Le has restaurado ${v} puntos de vida.`, 'spell');
  } else if (sp.subeHp === 2) {
    let dmg = this.spellDamage(p, sp);
    // defensa mágica (cascos/anillos)
    for (const k of ['helmet', 'armor']) {
      const sl = t.eq[k];
      if (sl >= 0 && t.inv[sl]) dmg -= Math.floor((this.data.objs[t.inv[sl].id] || {}).defMagica / 2 || 0);
    }
    dmg = Math.max(1, dmg);
    if (t.godMode) dmg = 0;
    s.hp -= dmg;
    this.msg(p, `¡Le has quitado ${dmg} puntos de vida a ${t.name}!`, 'spell');
    this.msg(t, `¡${p.name} te ha quitado ${dmg} puntos de vida!`, 'spell');
    this.toMap(t.map, { t: 'dmg', id: t.id, v: dmg });
    if (t.meditating) this.stopMeditating(t);
    if (s.hp <= 0) { this.killPlayer(t, p); return; }
    this.sendStat(t, ['hp']);
  }
  if (sp.subeMana === 1 && this.puedeRecuperarMana(t)) { s.man = Math.min(s.maxMan, s.man + rnd(sp.minMana, sp.maxMana)); this.sendStat(t, ['man']); }
  if (sp.subeMana === 2) { s.man = Math.max(0, s.man - rnd(sp.minMana, sp.maxMana)); this.sendStat(t, ['man']); }
  if (sp.subeSta === 1) { s.sta = Math.min(s.maxSta, s.sta + rnd(sp.minSta, sp.maxSta)); this.sendStat(t, ['sta']); }
  if (sp.subeSta === 2) { s.sta = Math.max(0, s.sta - rnd(sp.minSta, sp.maxSta)); this.sendStat(t, ['sta']); }
  if (sp.subeHam === 1) { s.ham = Math.min(100, s.ham + rnd(sp.minHam, sp.maxHam)); this.sendStat(t, ['ham']); }
  if (sp.subeSed === 1) { s.sed = Math.min(100, s.sed + rnd(sp.minSed, sp.maxSed)); this.sendStat(t, ['sed']); }
  if (sp.subeFu === 1 || sp.subeAg === 1) {
    const at = sp.subeFu === 1 ? 0 : 1;
    const v = sp.subeFu === 1 ? rnd(sp.minFu, sp.maxFu) : rnd(sp.minAg, sp.maxAg);
    t.buff = t.buff || {};
    if (!t.buff[at]) t.buff[at] = { base: t.attrs[at] };
    t.attrs[at] = Math.min(t.buff[at].base * 2, Math.min(35, t.attrs[at] + v));
    t.buff[at].until = Date.now() + 60000;
    this.send(t, { t: 'stats', fu: t.attrs[0], ag: t.attrs[1] });
  }
  if (sp.invisibilidad) {
    t.invisible = true; t.invisibleUntil = Date.now() + 45000;
    this.sendCharToMap(t);
  }
  if (sp.paraliza || sp.inmoviliza) {
    if (!t.godMode) {
      t.paralyzed = Date.now() + 8000;
      this.send(t, { t: 'para', on: 1 });
    }
  }
  if (sp.removerParalisis && t.paralyzed) { t.paralyzed = 0; this.send(t, { t: 'para', on: 0 }); }
  if (sp.envenena && !t.godMode) t.poisoned = true;
  if (sp.curaVeneno) t.poisoned = false;
  if (sp.subeHp !== 1 && sp.subeHp !== 2) { tellCaster(sp.msgCaster); tellTarget(); }
};

// Teleport a Ullathorpe: a los 3 segundos aparece un portal donde se hizo clic, dura 10 segundos
// y lleva a quien lo pise a la plaza de Ullathorpe.
const PORTAL_ULLA = { espera: 3000, dura: 10000, destino: [1, 58, 44], obj: 378 };
S.portalUlla = function (p, sp, x, y, now) {
  const mp = this.maps[p.map];
  const k = idx(x, y);
  if (p.duelo || p.enGuerra || p.jailUntil > now) return this.msg(p, 'Acá no podés abrir un portal.', 'warn');
  if (mp.d.blocked[k] || mp.d.water[k]) return this.msg(p, 'No podés abrir un portal ahí.', 'warn');
  if (mp.d.exits.has(k) || mp.objs.has(k)) return this.msg(p, 'Ya hay algo en ese lugar.', 'warn');
  if (this.portalesUlla && [...this.portalesUlla].some((t) => t.map === p.map && t.k === k)) return this.msg(p, 'Ya hay un portal abriéndose ahí.', 'warn');
  p.lastSpell = now;
  if (p.meditating) this.stopMeditating(p);
  p.stats.man -= sp.mana; p.stats.sta -= sp.sta;
  this.sendStat(p, ['man', 'sta']);
  this.trainSkill(p, SK['Magia']);
  if (sp.words) this.toMap(p.map, { t: 'say', id: p.id, text: sp.words, color: 'spell' });
  if (sp.wav) this.toMap(p.map, { t: 'snd', w: sp.wav });
  this.msg(p, 'El portal a Ullathorpe se abre en 3 segundos...', 'info');
  const portal = { map: p.map, k, x, y };
  this.portalesUlla = this.portalesUlla || new Set();
  this.portalesUlla.add(portal);
  const [dm, dx, dy] = PORTAL_ULLA.destino;
  setTimeout(() => {
    const m = this.maps[portal.map];
    if (m.d.exits.has(k) || m.objs.has(k)) { this.portalesUlla.delete(portal); return; } // se ocupó mientras tanto
    m.d.exits.set(k, { map: dm, x: dx, y: dy });
    m.objs.set(k, { id: PORTAL_ULLA.obj, amount: 1 });
    this.toMap(portal.map, { t: 'obj', x, y, g: this.data.objs[PORTAL_ULLA.obj].grh });
    this.toMap(portal.map, { t: 'snd', w: G.SND.WARP || 3 });
    // si alguien ya está parado encima, lo lleva
    const occ = m.occ[k];
    const o = occ && this.entity(occ);
    if (o && o.kind === 'pc' && !o.dead) this.warp(o, dm, dx, dy);
    setTimeout(() => {
      this.portalesUlla.delete(portal);
      const e = m.d.exits.get(k);
      if (e && e.map === dm && e.x === dx && e.y === dy) m.d.exits.delete(k);
      const ob = m.objs.get(k);
      if (ob && ob.id === PORTAL_ULLA.obj) { m.objs.delete(k); this.toMap(portal.map, { t: 'obj', x, y, g: 0 }); }
    }, PORTAL_ULLA.dura);
  }, PORTAL_ULLA.espera);
};

S.summon = function (p, sp, x, y, now) {
  if (this.isSafe(p)) return this.msg(p, 'No podés invocar criaturas en zona segura.', 'warn');
  p.summons = (p.summons || []).filter((id) => this.npcs.has(id));
  if (p.summons.length >= 3) return this.msg(p, 'No podés invocar más criaturas.', 'warn');
  p.lastSpell = now;
  p.stats.man -= sp.mana; p.stats.sta -= sp.sta;
  this.sendStat(p, ['man', 'sta']);
  for (let i = 0; i < Math.max(1, sp.cant); i++) {
    const n = this.spawnNpc(sp.numNpc, p.map, x, y);
    if (n) {
      n.summoned = true; n.owner = p.id;
      p.summons.push(n.id);
      setTimeout(() => { if (this.npcs.has(n.id)) { this.remove(n); this.npcs.delete(n.id); } }, 60000);
    }
  }
  if (sp.words) this.toMap(p.map, { t: 'say', id: p.id, text: sp.words, color: 'spell' });
};

S.npcCast = function (npc, t) {
  const sp = this.data.spells[npc.def.spells[rnd(0, npc.def.spells.length - 1)]];
  if (!sp) return;
  if (sp.fx) this.toMap(npc.map, { t: 'fx', id: t.id, fx: sp.fx, loops: sp.loops || 0 });
  if (sp.wav) this.toMap(npc.map, { t: 'snd', w: sp.wav });
  if (sp.subeHp === 2) {
    const dmg = this.danioDeNpc(t, Math.max(1, rnd(sp.minHp, sp.maxHp))); // montura de elefante
    if (t.godMode) return;
    t.stats.hp -= dmg;
    this.msg(t, `¡${npc.name} te ha quitado ${dmg} puntos de vida!`, 'spell');
    this.toMap(t.map, { t: 'dmg', id: t.id, v: dmg });
    if (t.stats.hp <= 0) this.killPlayer(t, npc); else this.sendStat(t, ['hp']);
  } else if (sp.paraliza || sp.inmoviliza) {
    if (t.godMode) return;
    t.paralyzed = Date.now() + 5000;
    this.send(t, { t: 'para', on: 1 });
    this.msg(t, `¡${npc.name} te ha paralizado!`, 'spell');
  } else if (sp.envenena) {
    t.poisoned = true;
    this.msg(t, `¡${npc.name} te ha envenenado!`, 'spell');
  }
};

module.exports = S;
