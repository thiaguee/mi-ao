'use strict';
// NPCs (aparición, inteligencia, muerte) y combate cuerpo a cuerpo / a distancia.
const G = require('./gamedata');
const World = require('./world');
const { idx, SK, OBJ } = G;
const rnd = World.rnd;

const NPC_TYPE = { COMUN: 0, RESUCITADOR: 1, GUARDIA: 2, ENTRENADOR: 3, BANQUERO: 4, NOBLE: 5,
  DRAGON: 6, TIMBERO: 7, GUARDIA_CAOS: 8, GOBERNADOR: 11 };
const MOV = { QUIETO: 1, AL_AZAR: 2, HOSTIL: 3, DEFENSA: 4, GUARDIA: 5, SIGUE_AMO: 8 };
const C = {};

// ---------- aparición ----------
C.spawnAllNpcs = function () {
  let n = 0;
  for (const mp of this.maps) {
    if (!mp) continue;
    for (const s of mp.d.npcs) {
      if (this.spawnNpc(s.id, mp.n, s.x, s.y, true)) n++;
    }
  }
  // NPCs agregados por nosotros (data/npcs-extra.json)
  for (const e of this.data.npcsExtra || []) {
    if (e.spawn && this.spawnNpc(e.num, e.spawn[0], e.spawn[1], e.spawn[2], true)) n++;
  }
  console.log(`NPCs creados: ${n}`);
};

C.spawnNpc = function (num, m, x, y, orig = false) {
  const def = this.data.npcs[num];
  if (!def || !this.maps[m]) return null;
  const pos = this.closestLegalPos(m, x, y, { water: def.aguaValida, npc: true }) ||
    this.closestLegalPos(m, x, y, { water: def.aguaValida });
  if (!pos) return null;
  const hp = def.maxHp || 1;
  const npc = {
    kind: 'npc', id: this.nextId++, def, num, name: def.name,
    body: def.body, head: def.head, heading: def.heading || 3,
    hp, maxHp: hp, map: m, x: pos.x, y: pos.y,
    orig: { map: m, x: pos.x, y: pos.y }, spawnOrig: orig,
    target: 0, lastAct: 0, lastAttack: 0, paralyzed: 0, poisoned: false, attackers: new Map(),
    // inventario de comerciantes
    stock: def.comercia ? def.items.map(([id, amount]) => ({ id, amount })) : null,
  };
  this.npcs.set(npc.id, npc);
  this.place(npc, m, pos.x, pos.y);
  return npc;
};

// Los bichos puestos en el mapa siempre reaparecen en el mismo mapa, cerca de donde nacieron.
// Los que crea un GM (/ACC, /RACC) o los invocados no reaparecen.
C.respawnNpc = function (npc) {
  const def = npc.def;
  const o = npc.orig;
  setTimeout(() => {
    if (!this.maps[o.map]) return;
    if (def.posOrig || !def.attackable) return void this.spawnNpc(npc.num, o.map, o.x, o.y, true);
    for (let i = 0; i < 30; i++) {
      const x = o.x + rnd(-6, 6), y = o.y + rnd(-6, 6);
      if (this.inMap(x, y) && this.legalPos(o.map, x, y, { water: def.aguaValida, npc: true }) &&
        this.trigger(o.map, x, y) !== G.TRIGGER.ZONASEGURA) {
        this.spawnNpc(npc.num, o.map, x, y, true);
        return;
      }
    }
    this.spawnNpc(npc.num, o.map, o.x, o.y, true);
  }, this.config.respawnSegundos * 1000);
};

C.killNpc = function (npc, killer) {
  this.remove(npc);
  this.npcs.delete(npc.id);
  const def = npc.def;
  if (killer && killer.kind === 'pc') {
    // Experiencia restante y oro
    const noche = this.esDeNoche() ? this.cfgCiclo().premioNoche : 1; // de noche dan más
    const exp = Math.floor((npc.expLeft === undefined ? def.exp * this.config.multiplicadorExp : npc.expLeft) * noche);
    if (exp > 0) this.giveExp(killer, exp);
    killer.kills.npcs++;
    if (this.misionKill) this.misionKill(killer, npc.num);
    this.msg(killer, `¡Has matado a ${npc.name}!`, 'fight');
    if (def.gld > 0) this.dropObj(npc.map, npc.x, npc.y, 12, Math.floor(def.gld * this.config.multiplicadorOro * noche));
    // Drop al azar (uno de la lista)
    if (def.drops.length && Math.random() < 0.9) {
      const [id, amount] = def.drops[rnd(0, def.drops.length - 1)];
      const o = this.data.objs[id];
      if (o) this.dropObj(npc.map, npc.x, npc.y, id, o.type === OBJ.ORO ? Math.floor(amount * this.config.multiplicadorOro) : amount);
    }
    // Matar guardias te hace criminal
    if ((def.type === NPC_TYPE.GUARDIA) && !killer.crim) {
      killer.crim = true;
      this.msg(killer, '¡Te has convertido en criminal por matar a un guardia!', 'warn');
      this.sendCharToMap(killer);
    }
  }
  if (npc.spawnOrig && !npc.summoned && !npc.sinRespawn) this.respawnNpc(npc);
};

// ---------- inteligencia artificial ----------
C.npcTick = function (now) {
  for (const npc of this.npcs.values()) {
    const mp = this.maps[npc.map];
    if (!mp || mp.players.size === 0) continue; // si no hay nadie en el mapa, no hace nada
    const def = npc.def;
    if (npc.paralyzed && now < npc.paralyzed) continue;
    npc.paralyzed = 0;
    if (npc.poisoned && now - (npc.lastPoison || 0) > 3000) {
      npc.lastPoison = now;
      npc.hp -= rnd(1, 5);
      if (npc.hp <= 0) { this.killNpc(npc, this.players.get(npc.lastHitBy)); continue; }
    }
    const speed = def.movement === MOV.HOSTIL ? 450 : 900;
    if (now - npc.lastAct < speed) continue;
    npc.lastAct = now;

    if (def.type === NPC_TYPE.GUARDIA || def.type === NPC_TYPE.GUARDIA_CAOS) {
      this.guardAI(npc, now);
      continue;
    }
    if (def.hostile && def.attackable) {
      const target = this.findTarget(npc, 8);
      if (target) {
        if (this.dist(npc, target) === 1) {
          this.faceTo(npc, target);
          if (now - npc.lastAttack > 1300) { npc.lastAttack = now; this.npcAttack(npc, target); }
        } else if (npc.def.spells.length && Math.random() < 0.35 && now - npc.lastAttack > 1800) {
          npc.lastAttack = now;
          this.npcCast(npc, target);
        } else {
          this.stepTowards(npc, target.x, target.y);
        }
        continue;
      }
    }
    // Defenderse si lo atacaron
    if (npc.target && def.attackable && !def.hostile && def.movement === MOV.DEFENSA) {
      const t = this.players.get(npc.target);
      if (t && t.map === npc.map && !t.dead && this.dist(npc, t) < 10) {
        if (this.dist(npc, t) === 1) {
          this.faceTo(npc, t);
          if (now - npc.lastAttack > 1300) { npc.lastAttack = now; this.npcAttack(npc, t); }
        } else this.stepTowards(npc, t.x, t.y);
        continue;
      }
      npc.target = 0;
    }
    if (def.movement === MOV.AL_AZAR || def.movement === MOV.HOSTIL || def.movement === MOV.DEFENSA) {
      if (Math.random() < 0.3) {
        const dir = rnd(1, 4);
        const d = World.DIRS[dir];
        // los npcs al azar no se alejan demasiado de su origen
        if (Math.abs(npc.x + d[0] - npc.orig.x) < 12 && Math.abs(npc.y + d[1] - npc.orig.y) < 12) {
          if (this.trigger(npc.map, npc.x + d[0], npc.y + d[1]) !== G.TRIGGER.ZONASEGURA || def.type !== 0 || !def.hostile) {
            this.moveChar(npc, dir);
          }
        }
      }
    }
  }
};

C.dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

C.faceTo = function (npc, t) {
  const dx = t.x - npc.x, dy = t.y - npc.y;
  const h = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 4) : (dy > 0 ? 3 : 1);
  if (npc.heading !== h) this.turn(npc, h);
};

C.findTarget = function (npc, range) {
  let best = null, bd = 99;
  const mp = this.maps[npc.map];
  for (const id of mp.players) {
    const p = this.players.get(id);
    if (!p || p.dead || p.invisible || p.hidden || p.gmInvis || (p.gm > 0 && !p.gmAtacable)) continue;
    if (this.isSafe(p) && this.trigger(p.map, p.x, p.y) === G.TRIGGER.ZONASEGURA) continue;
    const d = Math.max(Math.abs(p.x - npc.x), Math.abs(p.y - npc.y));
    if (d <= range && d < bd) { bd = d; best = p; }
  }
  return best;
};

C.guardAI = function (npc, now) {
  // Los guardias reales atacan a los criminales; los del caos a los ciudadanos
  const caos = npc.def.type === NPC_TYPE.GUARDIA_CAOS;
  const mp = this.maps[npc.map];
  let target = null;
  for (const id of mp.players) {
    const p = this.players.get(id);
    if (!p || p.dead || p.gmInvis || p.gm > 0) continue;
    if ((caos ? !p.crim : p.crim) && Math.max(Math.abs(p.x - npc.x), Math.abs(p.y - npc.y)) <= 6) { target = p; break; }
  }
  if (npc.target) {
    const t = this.players.get(npc.target);
    if (t && !t.dead && t.map === npc.map) target = t; else npc.target = 0;
  }
  if (!target) {
    if (npc.x !== npc.orig.x || npc.y !== npc.orig.y) this.stepTowards(npc, npc.orig.x, npc.orig.y);
    else if (npc.heading !== npc.def.heading) this.turn(npc, npc.def.heading);
    return;
  }
  if (this.dist(npc, target) === 1) {
    this.faceTo(npc, target);
    if (now - npc.lastAttack > 1100) { npc.lastAttack = now; this.npcAttack(npc, target); }
  } else this.stepTowards(npc, target.x, target.y);
};

C.stepTowards = function (npc, tx, ty) {
  const dx = tx - npc.x, dy = ty - npc.y;
  const opts = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx) opts.push(dx > 0 ? 2 : 4);
    if (dy) opts.push(dy > 0 ? 3 : 1);
  } else {
    if (dy) opts.push(dy > 0 ? 3 : 1);
    if (dx) opts.push(dx > 0 ? 2 : 4);
  }
  opts.push(rnd(1, 4));
  for (const dir of opts) {
    const d = World.DIRS[dir];
    if (npc.def.hostile && this.trigger(npc.map, npc.x + d[0], npc.y + d[1]) === G.TRIGGER.ZONASEGURA &&
      npc.def.type === 0) continue;
    if (this.moveChar(npc, dir)) return true;
  }
  return false;
};

// ---------- fórmulas de combate (basadas en el AO / Fénix) ----------
C.weaponOf = function (p) {
  const s = p.eq.weapon;
  return s >= 0 && p.inv[s] ? this.data.objs[p.inv[s].id] : null;
};

C.poderAtaque = function (p) {
  const w = this.weaponOf(p);
  const sk = w && w.proyectil ? p.skills[SK['Armas de proyectiles']] : w ? p.skills[SK['Combate con armas']] : p.skills[SK['Wrestling']];
  const ag = p.attrs[1];
  let base = sk < 31 ? sk : sk < 61 ? sk + ag : sk < 91 ? sk + 2 * ag : sk + 3 * ag;
  const lucha = [51, 52, 41, 47, 50, 48].includes(p.clase) ? 1.1 : G.claseConMana(p.clase) ? 0.8 : 0.95;
  return Math.floor((base + 2.5 * Math.max(p.stats.lvl - 12, 0)) * lucha) + 20;
};

C.poderEvasion = function (p) {
  const sk = p.skills[SK['Tácticas de combate']];
  const ag = p.attrs[1];
  const base = sk < 31 ? sk : sk < 61 ? sk + ag : sk < 91 ? sk + 2 * ag : sk + 3 * ag;
  return Math.floor((base + 2.5 * Math.max(p.stats.lvl - 12, 0)) * 0.9) + 10;
};

C.hitChance = (atk, eva) => Math.max(10, Math.min(90, 50 + (atk - eva) * 0.4));

C.playerDamage = function (p) {
  const w = this.weaponOf(p);
  const s = p.stats;
  const userHit = rnd(s.minHit, s.maxHit);
  if (!w) return Math.max(1, Math.floor((rnd(1, 3) * 3 + userHit) * 0.6));
  const armaHit = rnd(w.minHit, w.maxHit);
  const fuerzaBonus = Math.floor((w.maxHit / 5) * Math.max(0, p.attrs[0] - 15));
  const mod = [51, 52].includes(p.clase) ? 1.1 : [41, 47, 48, 50, 55].includes(p.clase) ? 0.95 : G.claseConMana(p.clase) ? 0.7 : 0.85;
  return Math.max(1, Math.floor((3 * armaHit + fuerzaBonus + userHit) * mod));
};

C.canAttack = function (p, target) {
  if (p.dead) { this.msg(p, '¡¡Estás muerto!! Los muertos no pueden atacar.', 'warn'); return false; }
  if (target.kind === 'pc') {
    if (target.dead) { this.msg(p, 'No podés atacar a un espíritu.', 'warn'); return false; }
    const rd = this.reglaDuelo(p, target);
    if (rd !== null) return rd;
    if (this.mismoBandoGuerra(p, target)) { this.msg(p, 'Es de tu bando.', 'warn'); return false; }
    if (this.peleaDeGuerra(p, target)) return true; // en la guerra se pelea siempre
    if (target.gm > 0 && !target.gmAtacable) { this.msg(p, 'No podés atacar a un GM.', 'warn'); return false; }
    if (p.gm > 0 && p.gm < 3) { this.msg(p, 'Los GMs no pueden atacar usuarios.', 'warn'); return false; }
    // Zona de pelea (los cuadrados de "plante"): adentro se pueden pegar los dos, sin volverse criminal
    if (this.enZonaPelea(p) && this.enZonaPelea(target)) return true;
    if (this.isSafe(p) || this.isSafe(target)) {
      this.msg(p, this.enZonaPelea(p) ? 'Tu rival tiene que estar adentro de la zona de pelea.' : 'No podés pelear en zona segura.', 'warn'); return false;
    }
    if (!p.crim && !target.crim && !p.seguroOff) {
      this.msg(p, 'Para atacar ciudadanos sacá el seguro con /SEGURO (te vas a volver criminal).', 'warn');
      return false;
    }
    return true;
  }
  if (!target.def.attackable) {
    if (target.def.type !== NPC_TYPE.COMUN || !target.def.hostile) { this.msg(p, 'No podés atacar a este NPC.', 'warn'); return false; }
  }
  if ((target.def.type === NPC_TYPE.GUARDIA) && !p.crim && !p.seguroOff) {
    this.msg(p, 'Para atacar guardias sacá el seguro con /SEGURO.', 'warn'); return false;
  }
  return true;
};

// Ataque cuerpo a cuerpo hacia donde mira
C.attack = function (p) {
  const now = Date.now();
  if (now - p.lastAttack < this.config.intervaloGolpe) return;
  if (p.dead) {
    if (now - (p.lastDeadMsg || 0) > 3000) { p.lastDeadMsg = now; this.msg(p, '¡¡Estás muerto!! Escribí /HOGAR o buscá un sacerdote.', 'warn'); }
    return;
  }
  const w = this.weaponOf(p);
  if (w && w.proyectil) return this.msg(p, 'Con un arco tenés que apuntar: hacé clic sobre el objetivo.', 'info');
  if (p.stats.sta < 10) return this.msg(p, 'Estás muy cansado para luchar.', 'warn');
  p.lastAttack = now;
  if (p.meditating) this.stopMeditating(p);
  const d = World.DIRS[p.heading];
  const tx = p.x + d[0], ty = p.y + d[1];
  const mp = this.maps[p.map];
  if (!this.inMap(tx, ty)) return;
  const id = mp.occ[idx(tx, ty)];
  const target = id ? this.entity(id) : null;
  p.stats.sta = Math.max(0, p.stats.sta - rnd(1, 10));
  this.sendStat(p, ['sta']);
  if (!target) {
    this.toMap(p.map, { t: 'snd', w: G.SND.SWING });
    return;
  }
  this.hitTarget(p, target, false);
};

C.hitTarget = function (p, target, ranged) {
  if (!this.canAttack(p, target)) return;
  if (p.hidden) { p.hidden = false; this.sendCharToMap(p); }
  if (target.kind === 'pc' && !p.crim && !target.crim && !this.peleaDeGuerra(p, target) && !(this.enZonaPelea(p) && this.enZonaPelea(target))) {
    p.crim = true;
    this.msg(p, '¡Te has convertido en criminal por atacar a un ciudadano!', 'warn');
    this.sendCharToMap(p);
    this.send(p, { t: 'stats', crim: true });
  }
  const atk = this.poderAtaque(p);
  const eva = target.kind === 'pc' ? this.poderEvasion(target) : target.def.evasion;
  const sk = ranged ? SK['Armas de proyectiles'] : this.weaponOf(p) ? SK['Combate con armas'] : SK['Wrestling'];
  if (Math.random() * 100 > this.hitChance(atk, eva)) {
    this.toMap(p.map, { t: 'snd', w: G.SND.SWING });
    this.msg(p, '¡Has fallado el golpe!', 'fight');
    if (target.kind === 'pc') {
      this.msg(target, `¡${p.name} te atacó y falló!`, 'fight');
      // chance de subir tácticas al esquivar
      this.trainSkill(target, SK['Tácticas de combate']);
    }
    return;
  }
  let dmg = this.playerDamage(p);
  // Apuñalar (asesinos)
  const w = this.weaponOf(p);
  if (w && w.apunala && p.clase === 47 && Math.random() * 100 < 10 + p.skills[SK['Apuñalar']] / 4) {
    dmg = Math.floor(dmg * 1.5);
    this.msg(p, `¡Has apuñalado a ${target.name}!`, 'fight');
    this.trainSkill(p, SK['Apuñalar']);
  }
  this.trainSkill(p, sk);
  if (target.kind === 'npc') this.damageNpc(target, dmg, p);
  else if (this.damagePlayer(target, dmg, p) && w) this.efectosDeArma(p, target, w);
};

// Efectos especiales de armas sobre jugadores (campos Sangrado y BloqueaMana de obj.dat)
C.efectosDeArma = function (p, t, w) {
  if (t.dead || t.godMode) return;
  const now = Date.now();
  if (w.sangrado && Math.random() * 100 < w.sangrado) {
    t.sangrado = { hasta: now + rnd(3, 5) * 1000, por: p.id };
    this.msg(t, '¡Estás sangrando!', 'warn');
    this.msg(p, `¡${t.name} está sangrando!`, 'fight');
  }
  if (w.bloqueaMana && Math.random() * 100 < w.bloqueaMana) {
    t.sinManaHasta = now + 3000;
    this.msg(t, '¡Una maldición celestial te impide recuperar maná por 3 segundos!', 'warn');
    this.msg(p, `¡Maldijiste a ${t.name}: no puede recuperar maná por 3 segundos!`, 'fight');
  }
};

// ¿Puede recuperar maná ahora? (la maldición de la Daga Celestial lo impide)
C.puedeRecuperarMana = function (p) { return !(p.sinManaHasta && Date.now() < p.sinManaHasta); };

C.damageNpc = function (npc, dmg, p, magic = false) {
  if (!magic) dmg = Math.max(1, dmg - (npc.def.def || 0));
  if (p && p.godMode) dmg = npc.hp;
  const real = Math.min(dmg, Math.max(0, npc.hp));
  npc.hp -= dmg;
  npc.lastHitBy = p ? p.id : 0;
  if (p) {
    npc.target = p.id;
    this.toMap(npc.map, { t: 'snd', w: G.SND.IMPACTO });
    this.toMap(npc.map, { t: 'dmg', id: npc.id, v: dmg });
    if (!magic) this.msg(p, `¡Le has pegado a ${npc.name} por ${dmg}!`, 'fight');
    // Fénix: la experiencia se gana en proporción al daño hecho
    if (npc.expLeft === undefined) npc.expLeft = Math.floor(npc.def.exp * this.config.multiplicadorExp);
    if (npc.hp > 0) {
      const exp = Math.min(npc.expLeft, Math.floor(npc.def.exp * this.config.multiplicadorExp * real / npc.maxHp));
      if (exp > 0) { npc.expLeft -= exp; this.giveExp(p, exp); }
    }
  }
  if (npc.hp <= 0) this.killNpc(npc, p);
};

C.damagePlayer = function (t, dmg, attacker) {
  if (t.godMode) return;
  const [dmin, dmax] = this.armorDef(t);
  dmg = Math.max(1, dmg - rnd(dmin, dmax));
  if (attacker && attacker.kind !== 'pc') dmg = this.danioDeNpc(t, dmg); // montura de elefante
  // Escudo: chance de bloquear
  if (t.eq.shield >= 0 && Math.random() * 100 < 5 + t.skills[SK['Defensa con escudos']] / 5) {
    this.toMap(t.map, { t: 'snd', w: G.SND.ESCUDO });
    this.msg(t, '¡Has rechazado el ataque con el escudo!', 'fight');
    if (attacker && attacker.kind === 'pc') this.msg(attacker, '¡El usuario rechazó el ataque con su escudo!', 'fight');
    this.trainSkill(t, SK['Defensa con escudos']);
    return false;
  }
  t.stats.hp -= dmg;
  if (t.meditating) this.stopMeditating(t);
  this.toMap(t.map, { t: 'snd', w: G.SND.IMPACTO2 });
  this.toMap(t.map, { t: 'dmg', id: t.id, v: dmg });
  const name = attacker ? attacker.name : 'Algo';
  this.msg(t, `¡${name} te ha pegado por ${dmg}!`, 'fight');
  if (attacker && attacker.kind === 'pc') this.msg(attacker, `¡Le has pegado a ${t.name} por ${dmg}!`, 'fight');
  if (t.stats.hp <= 0) this.killPlayer(t, attacker);
  else this.sendStat(t, ['hp']);
  return t.stats.hp > 0;
};

C.npcAttack = function (npc, t) {
  if (t.dead || t.gmInvis) return;
  const def = npc.def;
  const eva = this.poderEvasion(t);
  if (Math.random() * 100 > this.hitChance(def.ataque, eva)) {
    this.toMap(npc.map, { t: 'snd', w: G.SND.SWING });
    this.msg(t, `¡${npc.name} te atacó y falló!`, 'fight');
    this.trainSkill(t, SK['Tácticas de combate']);
    return;
  }
  // de noche los bichos pegan más fuerte
  const dmg = Math.round(rnd(def.minHit, def.maxHit) * (this.esDeNoche() ? this.cfgCiclo().danioNoche : 1));
  this.damagePlayer(t, dmg, npc);
  if (def.veneno && !t.dead && Math.random() < 0.1) {
    t.poisoned = true;
    this.msg(t, '¡¡La criatura te ha envenenado!!', 'warn');
  }
};

// Disparo con arco
C.shoot = function (p, x, y) {
  const now = Date.now();
  if (now - p.lastAttack < this.config.intervaloGolpe) return;
  const w = this.weaponOf(p);
  if (!w || !w.proyectil) return;
  if (p.dead) return;
  const ammoSlot = p.eq.ammo;
  if (w.municion && (ammoSlot < 0 || !p.inv[ammoSlot])) return this.msg(p, 'No tenés municiones equipadas.', 'warn');
  if (Math.abs(x - p.x) > 40 || Math.abs(y - p.y) > 30) return this.msg(p, 'Estás muy lejos para disparar.', 'warn');
  const mp = this.maps[p.map];
  const id = mp.occ[idx(x, y)];
  const target = id ? this.entity(id) : null;
  if (!target || target.id === p.id) return;
  p.lastAttack = now;
  if (w.municion) this.removeFromSlot(p, ammoSlot, 1);
  this.toMap(p.map, { t: 'shot', from: p.id, to: target.id });
  this.hitTarget(p, target, true);
};

module.exports = Object.assign(C, { NPC_TYPE, MOV });
