'use strict';
// Chat y comandos (de usuarios y de GMs).
const G = require('./gamedata');
const { idx } = G;
const { NPC_TYPE } = require('./combat');

const K = {};
const NIVELES = { CONSEJERO: 1, SEMIDIOS: 2, DIOS: 3, ADMIN: 4 };

K.handleTalk = function (p, text) {
  text = String(text || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 300);
  if (!text) return;
  const now = Date.now();
  if (now - p.lastTalk < 300) return;
  p.lastTalk = now;
  if (text[0] === '/') return this.command(p, text);
  if (text[0] === '\\') {
    const sp = text.indexOf(' ');
    if (sp > 1) return this.whisper(p, text.slice(1, sp), text.slice(sp + 1));
    return;
  }
  if (p.silenced && now < p.silenced) return this.msg(p, 'Estás silenciado.', 'warn');
  if (p.dead) {
    // los muertos sólo se escuchan entre muertos (y los GMs)
    for (const id of this.maps[p.map].players) {
      const o = this.players.get(id);
      if (o && (o.dead || o.gm > 0)) this.send(o, { t: 'say', id: p.id, text, color: 'dead' });
    }
    return;
  }
  if (p.meditating) this.stopMeditating(p);
  const color = p.gm > 0 && !p.hideGm ? 'gm' : 'talk';
  this.toMap(p.map, { t: 'say', id: p.id, text, color });
  this.toMap(p.map, { t: 'msg', text: `${p.name}: ${text}`, color: 'talk' });
  this.chatLog(`[${p.map}] ${p.name}: ${text}`);
};

K.whisper = function (p, name, text) {
  const t = this.findPlayer(name);
  if (!t || (t.gmInvis && p.gm < t.gm)) return this.msg(p, 'El usuario no está online.', 'warn');
  if (t.map !== p.map && p.gm === 0 && t.gm === 0) return this.msg(p, 'El usuario está demasiado lejos.', 'warn');
  this.msg(t, `${p.name} te susurra: ${text}`, 'whisper');
  this.msg(p, `Le susurrás a ${t.name}: ${text}`, 'whisper');
  this.chatLog(`[susurro] ${p.name} -> ${t.name}: ${text}`);
};

// --------- ayuda ---------
const AYUDA_USUARIO = [
  'Comandos: /ONLINE /EST /MEDITAR /SEGURO /HOGAR /RESUCITAR /CURAR /DESC texto',
  '/BALANCE /DEPOSITAR cant /RETIRAR cant (cerca de un banquero) /GM mensaje (pedir ayuda a un GM)',
  '\\nombre mensaje = susurrar. /SALIR = salir del juego. /PASSWORD vieja nueva',
  'Clanes: /FUNDARCLAN (cuesta 15.000.000 de oro) · /CLANES · /CL mensaje (chat del clan) · /CAPA (ponerte o sacarte la capa)',
  'Guerra: /GUERRA (entrar) · /SALIRGUERRA · /RANKING (ranking de kills) · /PREMIOS (premios por kills)',
  'Teclas: flechas = caminar, Ctrl = atacar, A = agarrar, M = meditar, U = usar, E = equipar, T = tirar',
];
const AYUDA_GM = {
  1: ['CLIC DERECHO en el mapa = teletransportarte ahí.', '[Consejero] /MAPAGM (2 o JUZGADO) /IR nombre /DONDE nombre /INVISIBLE /RMSG mensaje /SOS (ver pedidos) /INFO nombre',
    '/CARCEL nombre minutos /SILENCIAR nombre minutos /TRABAJANDO /ONLINEGM /MOSTRARGM'],
  2: ['[Semidiós] /TELEP nombre|YO mapa x y /SUM nombre /ECHAR nombre /REVIVIR nombre /CURARU nombre',
    '/ACC numeroNPC (crear NPC) /MATAR (NPC señalado) /RMATA (mata NPCs a tu alrededor) /CAMINAR (atravesar paredes)',
    '/TELEPLOC (teleport a donde hiciste clic) /BUSCARNPC texto /BUSCAROBJ texto'],
  3: ['[Dios] /CI numeroObjeto cantidad /ORO nombre cantidad /NIVEL nombre nivel /EXP nombre cantidad',
    '/BAN nombre /UNBAN nombre /GOD (invulnerable) /LIMPIAR (objetos del piso) /HACERCRIMI nombre /HACERCIUDA nombre',
    '/SKILLS nombre valor /HECHIZO nombre numero /CLASE nombre numero /DESTRUIR (objeto del piso donde estás)',
    '/CREARTP mapa x y (crea un portal donde estás parado) /BORRARTP /TPS (lista)', '/MOD nombre (HP|MAN|STA|ATRIB|ORO|BANCO) valor /ATACABLE (que los bichos te ataquen, para probar) /GRABAR /LLUVIA'],
  4: ['[Admin] /DARGM nombre nivel(0-4) /MOTD texto /APAGAR /ANUNCIO texto (cartel en pantalla a todos)'],
};

K.command = function (p, text) {
  const parts = text.slice(1).split(' ');
  const cmd = parts[0].toUpperCase();
  const args = parts.slice(1);
  const rest = args.join(' ');
  const gm = p.gm;
  const need = (lvl) => {
    if (gm >= lvl) return true;
    this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
    return false;
  };
  const target = (name) => {
    const t = this.findPlayer(name);
    if (!t) this.msg(p, 'Usuario offline o inexistente.', 'warn');
    return t;
  };
  const gmLog = () => { if (gm > 0) this.gmLog(`${p.name}: ${text}`); };

  switch (cmd) {
    // ===================== USUARIOS =====================
    case 'AYUDA':
      AYUDA_USUARIO.forEach((l) => this.msg(p, l, 'info'));
      if (gm > 0) this.msg(p, 'Sos GM: escribí /GMAYUDA para ver tus comandos.', 'gm');
      return;
    case 'ONLINE': {
      const names = [...this.players.values()].filter((o) => !o.gmInvis || gm >= o.gm).map((o) => o.name);
      this.msg(p, `Usuarios online (${names.length}): ${names.join(', ')}`, 'info');
      return;
    }
    case 'SALIR':
      this.send(p, { t: 'bye', text: 'Hasta pronto.' });
      return this.logout(p);
    case 'MEDITAR':
      return this.toggleMeditate(p);
    case 'SEGURO':
      p.seguroOff = !p.seguroOff;
      return this.msg(p, p.seguroOff ? 'Seguro DESACTIVADO: ahora podés atacar ciudadanos (te volverás criminal).' : 'Seguro ACTIVADO.', 'warn');
    case 'EST': {
      const s = p.stats;
      this.msg(p, `${p.name} - ${G.CLASES[p.clase]} ${G.RAZAS[p.raza]} - Nivel ${s.lvl} (${s.exp}/${G.ELU[s.lvl]})`, 'info');
      this.msg(p, `Vida ${s.hp}/${s.maxHp} Maná ${s.man}/${s.maxMan} Energía ${s.sta}/${s.maxSta} Golpe ${s.minHit}/${s.maxHit}`, 'info');
      this.msg(p, `Fuerza ${p.attrs[0]} Agilidad ${p.attrs[1]} Inteligencia ${p.attrs[2]} Carisma ${p.attrs[3]} Constitución ${p.attrs[4]}`, 'info');
      this.msg(p, `Ciudadanos matados: ${p.kills.ciu} Criminales matados: ${p.kills.cri} NPCs matados: ${p.kills.npcs}`, 'info');
      return;
    }
    case 'HOGAR': {
      if (!p.dead) return this.msg(p, 'Sólo podés usar /HOGAR estando muerto.', 'warn');
      if (p.jailUntil) return this.msg(p, 'Estás en la cárcel.', 'warn');
      if (p.enGuerra) return this.msg(p, 'Estás en la guerra: vas a reaparecer en tu base. Para irte: /SALIRGUERRA', 'warn');
      const c = this.data.cities[p.hogar] || this.data.cities.ULLATHORPE;
      return this.warp(p, c.map, c.x, c.y);
    }
    case 'RESUCITAR': case 'CURAR': {
      const npc = this.nearNpcType(p, NPC_TYPE.RESUCITADOR, 5);
      if (!npc) return this.msg(p, 'No hay ningún sacerdote cerca.', 'warn');
      return this.priest(p, npc);
    }
    case 'DESC':
      p.desc = rest.slice(0, 80);
      return this.msg(p, 'Descripción cambiada.', 'info');
    case 'BALANCE':
      return this.msg(p, `Tenés ${p.bankGld || 0} monedas de oro en el banco.`, 'info');
    case 'DEPOSITAR': case 'RETIRAR': {
      const npc = this.nearNpcType(p, NPC_TYPE.BANQUERO, 5);
      if (!npc) return this.msg(p, 'No hay ningún banquero cerca.', 'warn');
      p.banking = { npc: npc.id };
      this.bankGold(p, args[0], cmd === 'DEPOSITAR');
      return this.msg(p, `Ahora tenés ${p.bankGld || 0} monedas en el banco.`, 'info');
    }
    case 'GM': {
      if (!rest) return this.msg(p, 'Escribí /GM y tu consulta.', 'warn');
      this.sos.push({ name: p.name, text: rest, t: Date.now() });
      if (this.sos.length > 50) this.sos.shift();
      this.toGMs({ t: 'msg', text: `[SOS] ${p.name}: ${rest}`, color: 'gm' });
      return this.msg(p, 'Tu mensaje fue enviado a los GMs.', 'info');
    }
    case 'PASSWORD': {
      const accounts = require('./accounts');
      if (args.length < 2) return this.msg(p, 'Uso: /PASSWORD vieja nueva', 'warn');
      if (!accounts.checkPass(p, args[0])) return this.msg(p, 'La contraseña actual no es correcta.', 'warn');
      if (args[1].length < 4) return this.msg(p, 'La contraseña nueva es muy corta.', 'warn');
      p.pass = accounts.hashPass(args[1]);
      this.savePlayer(p);
      return this.msg(p, 'Contraseña cambiada.', 'info');
    }
    case 'GLOBAL': case 'G': {
      if (!this.config.chatGlobal && gm === 0) return this.msg(p, 'El chat global está desactivado.', 'warn');
      if (!rest) return;
      if (p.silenced && Date.now() < p.silenced) return this.msg(p, 'Estás silenciado.', 'warn');
      this.toAll({ t: 'msg', text: `[Global] ${p.name}: ${rest}`, color: 'global' });
      return this.chatLog(`[global] ${p.name}: ${rest}`);
    }
    case 'CAPA':
      return this.alternarCapa(p);
    case 'GUERRA':
      return this.comandoGuerra(p, rest);
    case 'SALIRGUERRA':
      return this.salirDeGuerra(p, 'Saliste de la guerra.');
    case 'PREMIOS':
      return this.enviarCanje(p, p.crim ? 'cri' : 'ciu', true);
    case 'RANKING':
      return this.mostrarRanking(p);
    case 'MISIONES':
      return this.enviarMisiones(p, !!this.cercaDeMaestro(p));
    case 'FUNDARCLAN':
      return this.abrirFundar(p);
    case 'CLANES':
      return this.send(p, { t: 'abrirClanes' });
    case 'CL': case 'CLAN':
      return this.chatClan(p, rest);
    case 'GMAYUDA':
      if (!need(1)) return;
      for (let l = 1; l <= gm; l++) (AYUDA_GM[l] || []).forEach((x) => this.msg(p, x, 'gm'));
      return;

    // ===================== CONSEJERO (1) =====================
    case 'IR': {
      if (!need(1)) return;
      const t = target(rest); if (!t) return;
      gmLog();
      return this.warp(p, t.map, t.x, t.y + 1);
    }
    case 'MAPAGM': { // mapas de GMs: /MAPAGM (49), /MAPAGM 2 (169), /MAPAGM JUZGADO (280)
      if (!need(1)) return;
      const destino = { '': 49, '1': 49, '2': 169, 'JUZGADO': 280, '3': 280 }[rest.toUpperCase()] || 49;
      return this.warp(p, destino, 50, 50);
    }
    case 'DONDE': {
      if (!need(1)) return;
      const t = target(rest); if (!t) return;
      return this.msg(p, `${t.name} está en el mapa ${t.map} (${this.maps[t.map].d.name}) ${t.x} ${t.y}.`, 'gm');
    }
    case 'INFO': {
      if (!need(1)) return;
      const t = target(rest); if (!t) return;
      const s = t.stats;
      this.msg(p, `${t.name}: ${G.CLASES[t.clase]} ${G.RAZAS[t.raza]} nivel ${s.lvl} | HP ${s.hp}/${s.maxHp} MAN ${s.man}/${s.maxMan} | Oro ${s.gld} Banco ${t.bankGld || 0}`, 'gm');
      return this.msg(p, `Mapa ${t.map} ${t.x} ${t.y} | IP ${t.ip} | ${t.crim ? 'Criminal' : 'Ciudadano'} | Muertes ${t.deaths || 0}`, 'gm');
    }
    case 'INVISIBLE':
      if (!need(1)) return;
      p.gmInvis = !p.gmInvis;
      this.remove(p);
      this.place(p, p.map, p.x, p.y);
      this.sendMapState(p);
      return this.msg(p, p.gmInvis ? 'Ahora sos invisible.' : 'Ahora sos visible.', 'gm');
    case 'MOSTRARGM':
      if (!need(1)) return;
      p.hideGm = !p.hideGm;
      this.sendCharToMap(p);
      return this.msg(p, p.hideGm ? 'Tu nombre se ve como el de un usuario común.' : 'Tu nombre se ve como GM.', 'gm');
    case 'RMSG':
      if (!need(1) || !rest) return;
      gmLog();
      return this.toAll({ t: 'msg', text: `${p.name}> ${rest}`, color: 'server' });
    case 'SOS':
      if (!need(1)) return;
      if (!this.sos.length) return this.msg(p, 'No hay pedidos de ayuda.', 'gm');
      this.sos.forEach((s) => this.msg(p, `${s.name}: ${s.text}`, 'gm'));
      this.sos = [];
      return;
    case 'ONLINEGM': {
      if (!need(1)) return;
      const list = [...this.players.values()].filter((o) => o.gm > 0).map((o) => `${o.name} (${this.gmTitle(o.gm)})`);
      return this.msg(p, 'GMs online: ' + (list.join(', ') || 'ninguno'), 'gm');
    }
    case 'CARCEL': {
      if (!need(1)) return;
      const t = target(args[0]); if (!t) return;
      if (t.gm >= gm) return this.msg(p, 'No podés encarcelar a alguien de tu rango.', 'warn');
      const mins = Math.max(1, Math.min(60, +args[1] || 5));
      const j = this.config.carcel;
      t.jailUntil = Date.now() + mins * 60000;
      this.warp(t, j.map, j.x, j.y);
      this.msg(t, `${p.name} te encarceló por ${mins} minutos.`, 'warn');
      gmLog();
      return this.msg(p, `${t.name} encarcelado por ${mins} minutos.`, 'gm');
    }
    case 'SILENCIAR': {
      if (!need(1)) return;
      const t = target(args[0]); if (!t) return;
      const mins = Math.max(0, Math.min(600, +args[1] || 10));
      t.silenced = mins ? Date.now() + mins * 60000 : 0;
      this.msg(t, mins ? `Fuiste silenciado por ${mins} minutos.` : 'Ya podés hablar de nuevo.', 'warn');
      gmLog();
      return this.msg(p, `${t.name} ${mins ? `silenciado ${mins} min` : 'des-silenciado'}.`, 'gm');
    }
    case 'TRABAJANDO':
      if (!need(1)) return;
      return this.msg(p, `Usuarios online: ${this.players.size}. Uptime: ${this.uptime()}.`, 'gm');

    // ===================== SEMIDIOS (2) =====================
    case 'TELEP': {
      if (!need(2)) return;
      const t = args[0] && args[0].toUpperCase() === 'YO' ? p : target(args[0]); if (!t) return;
      const m = +args[1], x = +args[2] || 50, y = +args[3] || 50;
      if (!this.maps[m]) return this.msg(p, 'Mapa inexistente.', 'warn');
      gmLog();
      this.warp(t, m, x, y);
      if (t !== p) this.msg(t, `${p.name} te transportó.`, 'gm');
      return;
    }
    case 'TELEPLOC':
      if (!need(2)) return;
      if (!p.lastClick) return this.msg(p, 'Primero hacé clic en el mapa.', 'warn');
      return this.warp(p, p.map, p.lastClick.x, p.lastClick.y);
    case 'SUM': {
      if (!need(2)) return;
      const t = target(rest); if (!t) return;
      gmLog();
      this.warp(t, p.map, p.x, p.y + 1);
      return this.msg(t, `${p.name} te ha trasportado.`, 'gm');
    }
    case 'ECHAR': {
      if (!need(2)) return;
      const t = target(rest); if (!t) return;
      if (t.gm >= gm) return this.msg(p, 'No podés echar a alguien de tu rango.', 'warn');
      gmLog();
      this.send(t, { t: 'bye', text: `${p.name} te echó del servidor.` });
      this.logout(t);
      return this.toAll({ t: 'msg', text: `${p.name} echó a ${t.name}.`, color: 'server' });
    }
    case 'REVIVIR': {
      if (!need(2)) return;
      const t = rest ? target(rest) : p; if (!t) return;
      gmLog();
      if (!t.dead) { t.stats.hp = t.stats.maxHp; this.sendStat(t, ['hp']); return; }
      return this.revive(t, true);
    }
    case 'CURARU': {
      if (!need(2)) return;
      const t = rest ? target(rest) : p; if (!t) return;
      const s = t.stats;
      s.hp = s.maxHp; s.man = s.maxMan; s.sta = s.maxSta; s.ham = 100; s.sed = 100; t.poisoned = false;
      return this.sendAllStats(t);
    }
    case 'ACC': case 'RACC': {
      if (!need(2)) return;
      const n = this.spawnNpc(+args[0], p.map, p.x, p.y + 1);
      gmLog();
      if (!n) return this.msg(p, 'NPC inexistente.', 'warn');
      n.spawnOrig = cmd === 'RACC'; // /ACC: no reaparece · /RACC: reaparece en este lugar
      return this.msg(p, `Creaste a ${n.name}${cmd === 'RACC' ? ' (reaparece cuando muere)' : ''}.`, 'gm');
    }
    case 'MATAR': {
      if (!need(2)) return;
      const t = p.target && this.npcs.get(p.target);
      if (!t) return this.msg(p, 'Primero hacé clic en un NPC.', 'warn');
      gmLog();
      return this.killNpc(t, null);
    }
    case 'RMATA': {
      if (!need(2)) return;
      let c = 0;
      for (const id of [...this.maps[p.map].chars]) {
        const n = this.npcs.get(id);
        if (n && Math.abs(n.x - p.x) <= 8 && Math.abs(n.y - p.y) <= 7 && n.def.hostile) { this.killNpc(n, null); c++; }
      }
      gmLog();
      return this.msg(p, `Mataste ${c} NPCs.`, 'gm');
    }
    case 'CAMINAR':
      if (!need(2)) return;
      p.godWalk = !p.godWalk;
      return this.msg(p, p.godWalk ? 'Ahora podés atravesar todo.' : 'Volvés a caminar normal.', 'gm');
    case 'BUSCARNPC': case 'BUSCAROBJ': {
      if (!need(2) || !rest) return;
      const list = cmd === 'BUSCARNPC' ? this.data.npcs : this.data.objs;
      const q = rest.toLowerCase();
      const found = list.filter((o) => o && o.name.toLowerCase().includes(q)).slice(0, 25);
      if (!found.length) return this.msg(p, 'No se encontró nada.', 'gm');
      return this.msg(p, found.map((o) => `${o.id}: ${o.name}`).join(' | '), 'gm');
    }

    // ===================== DIOS (3) =====================
    case 'CI': {
      if (!need(3)) return;
      const id = +args[0], amount = Math.max(1, Math.min(10000, +args[1] || 1));
      const o = this.data.objs[id];
      if (!o) return this.msg(p, 'Objeto inexistente.', 'warn');
      gmLog();
      const got = this.giveItem(p, id, amount);
      if (got < amount) this.dropObj(p.map, p.x, p.y, id, amount - got);
      return this.msg(p, `Creaste ${amount} ${o.name}.`, 'gm');
    }
    case 'ORO': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      t.stats.gld = Math.max(0, Math.min(1e9, t.stats.gld + (+args[1] || 0)));
      gmLog();
      this.sendStat(t, ['gld']);
      return this.msg(p, `${t.name} ahora tiene ${t.stats.gld} de oro.`, 'gm');
    }
    case 'NIVEL': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      const lvl = Math.max(1, Math.min(G.MAX_NIVEL, +args[1] || 1));
      gmLog();
      while (t.stats.lvl < lvl) {
        const prev = t.stats.lvl;
        t.stats.exp = G.ELU[t.stats.lvl];
        this.checkLevel(t);
        if (t.stats.lvl === prev) {
          // clase base trabada en 14: la evoluciona automáticamente
          const ev = G.EVOLUCION[t.clase];
          if (!ev) break;
          this.chooseClass(t, ev.opciones[0]);
        }
      }
      this.sendAllStats(t);
      return this.msg(p, `${t.name} ahora es nivel ${t.stats.lvl}.`, 'gm');
    }
    case 'EXP': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      gmLog();
      return this.giveExp(t, Math.max(0, +args[1] || 0));
    }
    case 'BAN': {
      if (!need(3)) return;
      const name = rest.toLowerCase();
      if (!name) return;
      const t = this.findPlayer(name);
      if (t && t.gm >= gm) return this.msg(p, 'No podés banear a alguien de tu rango.', 'warn');
      this.bans.add(name);
      this.saveBans();
      if (t) { this.send(t, { t: 'bye', text: 'Fuiste baneado del servidor.' }); this.logout(t); }
      gmLog();
      return this.toAll({ t: 'msg', text: `${p.name} baneó a ${rest}.`, color: 'server' });
    }
    case 'UNBAN':
      if (!need(3)) return;
      this.bans.delete(rest.toLowerCase());
      this.saveBans();
      gmLog();
      return this.msg(p, `${rest} desbaneado.`, 'gm');
    case 'GOD':
      if (!need(3)) return;
      p.godMode = !p.godMode;
      return this.msg(p, p.godMode ? 'Modo DIOS activado: sos invulnerable y matás de un golpe.' : 'Modo DIOS desactivado.', 'gm');
    case 'ATACABLE':
      if (!need(1)) return;
      p.gmAtacable = !p.gmAtacable;
      return this.msg(p, p.gmAtacable ? 'Ahora los bichos y usuarios te pueden atacar (para probar).' : 'Ya no te pueden atacar.', 'gm');
    case 'LIMPIAR': {
      if (!need(3)) return;
      const mp = this.maps[p.map];
      let c = 0;
      for (const [k, o] of [...mp.objs]) {
        const od = this.data.objs[o.id];
        if (od && od.agarrable && ![G.OBJ.PUERTA, G.OBJ.CARTEL, G.OBJ.ARBOL, G.OBJ.YACIMIENTO, G.OBJ.TELEPORT, G.OBJ.FORO].includes(od.type) && o.t) {
          mp.objs.delete(k);
          this.toMap(p.map, { t: 'obj', x: k % 100 + 1, y: Math.floor(k / 100) + 1, g: 0 });
          c++;
        }
      }
      gmLog();
      return this.msg(p, `Se limpiaron ${c} objetos tirados en el mapa.`, 'gm');
    }
    case 'DESTRUIR': {
      if (!need(3)) return;
      const o = this.objAt(p.map, p.x, p.y);
      if (!o) return this.msg(p, 'No hay objetos acá.', 'warn');
      return this.removeObj(p.map, p.x, p.y, o.amount);
    }
    case 'HACERCRIMI': case 'HACERCIUDA': {
      if (!need(3)) return;
      const t = target(rest); if (!t) return;
      t.crim = cmd === 'HACERCRIMI';
      this.sendCharToMap(t);
      this.send(t, { t: 'stats', crim: t.crim });
      gmLog();
      return this.msg(p, `${t.name} ahora es ${t.crim ? 'criminal' : 'ciudadano'}.`, 'gm');
    }
    case 'SKILLS': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      const v = Math.max(0, Math.min(100, +args[1] || 0));
      t.skills = t.skills.map(() => v);
      gmLog();
      this.sendSkills(t);
      return this.msg(p, `Skills de ${t.name} en ${v}.`, 'gm');
    }
    case 'HECHIZO': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      const sp = this.data.spells[+args[1]];
      if (!sp) return this.msg(p, 'Hechizo inexistente. Hechizos: ' + this.data.spells.filter(Boolean).map((s) => `${s.id}:${s.name}`).join(', '), 'gm');
      if (t.spells.includes(sp.id)) return this.msg(p, 'Ya lo conoce.', 'warn');
      let slot = 0; while (t.spells[slot]) slot++;
      t.spells[slot] = sp.id;
      this.sendSpells(t);
      gmLog();
      return this.msg(p, `${t.name} aprendió ${sp.name}.`, 'gm');
    }
    case 'CLASE': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      const c = +args[1];
      if (!G.CLASES[c]) return this.msg(p, 'Clases: ' + Object.entries(G.CLASES).map(([k, v]) => `${k}:${v}`).join(', '), 'gm');
      t.clase = c;
      if (G.claseConMana(c) && t.stats.maxMan === 0) {
        t.stats.maxMan = Math.floor((G.MANA_POR_NIVEL[c] || 1) * t.attrs[2] * Math.max(1, t.stats.lvl - 5));
        t.stats.man = t.stats.maxMan;
      }
      this.sendAllStats(t);
      gmLog();
      return this.msg(p, `${t.name} ahora es ${G.CLASES[c]}.`, 'gm');
    }
    case 'MOD': {
      if (!need(3)) return;
      const t = target(args[0]); if (!t) return;
      const campo = (args[1] || '').toUpperCase(), v = Math.floor(+args[2] || 0);
      const s = t.stats;
      if (campo === 'HP') { s.maxHp = Math.max(1, Math.min(9999, v)); s.hp = s.maxHp; }
      else if (campo === 'MAN') { s.maxMan = Math.max(0, Math.min(9999, v)); s.man = s.maxMan; }
      else if (campo === 'STA') { s.maxSta = Math.max(1, Math.min(9999, v)); s.sta = s.maxSta; }
      else if (campo === 'ATRIB') t.attrs = t.attrs.map(() => Math.max(1, Math.min(40, v)));
      else if (campo === 'ORO') s.gld = Math.max(0, v);
      else if (campo === 'BANCO') t.bankGld = Math.max(0, v);
      else if (campo === 'GOLPE') { s.minHit = Math.max(1, v); s.maxHit = Math.max(1, v); }
      else return this.msg(p, 'Campos: HP MAN STA ATRIB ORO BANCO GOLPE', 'warn');
      this.sendAllStats(t);
      gmLog();
      return this.msg(p, `Modificado ${campo} de ${t.name} a ${v}.`, 'gm');
    }
    case 'CREARTP': // crea un portal donde estás parado: /CREARTP mapa x y
      if (!need(3)) return;
      gmLog();
      return this.crearTeleport(p, +args[0], +args[1], +args[2]);
    case 'BORRARTP':
      if (!need(3)) return;
      gmLog();
      return this.borrarTeleport(p);
    case 'TPS':
      if (!need(2)) return;
      return this.listarTeleports(p);
    case 'GRABAR':
      if (!need(3)) return;
      this.saveAll();
      return this.msg(p, 'Se guardaron todos los personajes.', 'gm');
    case 'LLUVIA':
      if (!need(3)) return;
      this.raining = !this.raining;
      return this.toAll({ t: 'rain', on: this.raining ? 1 : 0 });

    // ===================== ADMIN (4) =====================
    case 'DARGM': {
      if (!need(4)) return;
      const name = args[0], lvl = Math.max(0, Math.min(4, +args[1] || 0));
      if (!name) return;
      for (const k of Object.keys(this.config.gms)) {
        this.config.gms[k] = this.config.gms[k].filter((n) => n.toLowerCase() !== name.toLowerCase());
      }
      const key = { 1: 'consejeros', 2: 'semidioses', 3: 'dioses', 4: 'admins' }[lvl];
      if (key) this.config.gms[key].push(name);
      this.saveConfig();
      const t = this.findPlayer(name);
      if (t) { t.gm = lvl; this.sendCharToMap(t); this.msg(t, lvl ? `Ahora sos ${this.gmTitle(lvl)}. Escribí /GMAYUDA.` : 'Ya no sos GM.', 'gm'); }
      gmLog();
      return this.msg(p, `${name} ahora es ${this.gmTitle(lvl)}.`, 'gm');
    }
    case 'MOTD':
      if (!need(4)) return;
      this.config.motd = rest ? [rest] : [];
      this.saveConfig();
      return this.msg(p, 'Mensaje de bienvenida cambiado.', 'gm');
    case 'ANUNCIO':
      if (!need(4) || !rest) return;
      return this.toAll({ t: 'announce', text: rest });
    case 'APAGAR':
      if (!need(4)) return;
      gmLog();
      return this.shutdown(`${p.name} apagó el servidor.`);
    default:
      return this.msg(p, 'Comando inexistente. Escribí /AYUDA.', 'warn');
  }
};

K.nearNpcType = function (p, type, r) {
  for (const id of this.maps[p.map].chars) {
    const n = this.npcs.get(id);
    if (n && n.def.type === type && Math.abs(n.x - p.x) <= r && Math.abs(n.y - p.y) <= r) return n;
  }
  return null;
};

void idx; void NIVELES;
module.exports = K;
