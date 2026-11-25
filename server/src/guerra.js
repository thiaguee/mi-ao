'use strict';
// Guerra automática Ciudadanos vs Criminales.
// Cada hora (en punto) empieza una guerra de 15 minutos; 2 minutos antes se avisa a todos.
// Se entra con /GUERRA. Cada muerte del otro bando suma 1 "kill de guerra" (canjeable, no se pierde)
// y al que más mata se le dan puntos de torneo (tampoco se pierden).
const W = {};

const DEF = { cadaMinutos: 60, duracionMinutos: 15, avisoMinutos: 2, mapa: 273,
  spawnCiu: [273, 50, 16], spawnCri: [273, 50, 86], puntosTorneoGanador: 5,
  ciudadCiu: [59, 50, 50], ciudadCri: [196, 52, 75], nivelMinimo: 25 };

W.iniciarGuerras = function () {
  this.cfgGuerra = Object.assign({}, DEF, this.config.guerra || {});
  this.guerra = { estado: 'nada', participantes: new Map(), totales: { ciu: 0, cri: 0 }, proxima: this.proximaGuerra() };
  setInterval(() => { try { this.relojGuerra(Date.now()); } catch (e) { console.error('guerra', e); } }, 2000);
  console.log(`Guerras automáticas: cada ${this.cfgGuerra.cadaMinutos} min, duran ${this.cfgGuerra.duracionMinutos} min (próxima ${new Date(this.guerra.proxima).toLocaleTimeString('es-AR')})`);
};

// la próxima guerra empieza en el próximo múltiplo de "cadaMinutos" (60 = cada hora en punto)
W.proximaGuerra = function (desde = Date.now()) {
  const paso = this.cfgGuerra.cadaMinutos * 60000;
  return Math.ceil((desde + 1000) / paso) * paso;
};

// horario de Argentina (el servidor alquilado suele estar en otra zona horaria)
const hora = (t) => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }) + ' hs';
const bandoDe = (p) => (p.crim ? 'cri' : 'ciu');
const puedeGuerra = (p) => p.faccion === 'ciu' || p.faccion === 'cri';
const NOMBRE = { ciu: 'Ciudadanos', cri: 'Criminales' };

W.relojGuerra = function (now) {
  const g = this.guerra, c = this.cfgGuerra;
  if (g.estado === 'nada' && now >= g.proxima - c.avisoMinutos * 60000) {
    g.estado = 'inscripcion';
    this.toAll({ t: 'announce', text: `⚔ ¡En ${c.avisoMinutos} minutos empieza la GUERRA entre Ciudadanos y Criminales! Escribí /GUERRA para anotarte.` });
    this.toAll({ t: 'msg', text: `⚔ ¡En ${c.avisoMinutos} minutos empieza la GUERRA entre Ciudadanos y Criminales (${hora(g.proxima)})! Escribí /GUERRA para anotarte (nivel ${c.nivelMinimo}+).`, color: 'server' });
  }
  if (g.estado === 'inscripcion' && now >= g.proxima) this.empezarGuerra(now);
  if (g.estado === 'activa') {
    if (now >= g.fin) this.terminarGuerra();
    else if (now - (g.ultimoEstado || 0) > 5000) this.enviarEstadoGuerra();
  }
};

W.empezarGuerra = function (now = Date.now()) {
  const g = this.guerra;
  g.estado = 'activa';
  g.fin = now + this.cfgGuerra.duracionMinutos * 60000;
  g.totales = { ciu: 0, cri: 0 };
  for (const [nombre, part] of g.participantes) {
    const p = this.findPlayer(nombre);
    if (p) this.entrarAGuerra(p, part); else g.participantes.delete(nombre);
  }
  this.toAll({ t: 'announce', text: `⚔ ¡EMPEZÓ LA GUERRA! Ciudadanos vs Criminales durante ${this.cfgGuerra.duracionMinutos} minutos. Escribí /GUERRA para entrar.` });
  this.toAll({ t: 'msg', text: `⚔ ¡Empezó la guerra! Dura ${this.cfgGuerra.duracionMinutos} minutos (hasta las ${hora(g.fin)}). Escribí /GUERRA para entrar.`, color: 'server' });
  this.enviarEstadoGuerra();
  this.log('Empezó la guerra');
};

W.spawnBando = function (bando) { return bando === 'ciu' ? this.cfgGuerra.spawnCiu : this.cfgGuerra.spawnCri; };

W.entrarAGuerra = function (p, part) {
  part.prev = part.prev || { map: p.map, x: p.x, y: p.y };
  p.enGuerra = part.bando;
  if (p.meditating) this.stopMeditating(p);
  this.endTrade(p);
  const [m, x, y] = this.spawnBando(part.bando);
  if (p.dead) this.revive(p, true);
  const s = p.stats; s.hp = s.maxHp; s.man = s.maxMan; s.sta = s.maxSta;
  this.warp(p, m, x, y);
  this.sendAllStats(p);
  this.msg(p, `Entraste a la guerra con los ${NOMBRE[part.bando]}. ¡Matá a los del otro bando! /SALIRGUERRA para irte.`, 'server');
  this.enviarEstadoGuerra(p);
};

// /GUERRA
W.comandoGuerra = function (p, arg) {
  const g = this.guerra;
  arg = String(arg || '').toUpperCase();
  if (arg === 'INICIAR' && p.gm >= 3) { if (g.estado !== 'activa') { g.estado = 'inscripcion'; g.proxima = Date.now(); this.empezarGuerra(); } return; }
  if (arg === 'TERMINAR' && p.gm >= 3) { if (g.estado === 'activa') this.terminarGuerra(); return; }
  if (p.gm > 0 && !arg) {
    const restan = g.estado === 'activa' ? `termina a las ${hora(g.fin)}` : `la próxima es a las ${hora(g.proxima)}`;
    return this.msg(p, `Guerra: ${g.estado} (${restan}). Ciudadanos ${g.totales.ciu} · Criminales ${g.totales.cri} · ${g.participantes.size} participantes. GM: /GUERRA INICIAR o /GUERRA TERMINAR.`, 'gm');
  }
  if (p.stats.lvl < (this.cfgGuerra.nivelMinimo || 25) && p.gm === 0) return this.msg(p, `Para entrar a la guerra necesitás nivel ${this.cfgGuerra.nivelMinimo || 25}.`, 'warn');
  if (!puedeGuerra(p) && p.gm === 0) return this.msg(p, p.faccion === 'neu' ? 'Los neutrales no participan de la guerra.' : 'Primero elegí tu facción (Ciudadano o Criminal).', 'warn');
  if (p.dead) return this.msg(p, 'Estás muerto. Resucitá antes de ir a la guerra.', 'warn');
  if (p.jailUntil) return this.msg(p, 'Estás en la cárcel.', 'warn');
  if (g.estado === 'nada') return this.msg(p, `No hay ninguna guerra ahora. La próxima empieza a las ${hora(g.proxima)}.`, 'info');
  const nombre = p.name.toLowerCase();
  if (g.participantes.has(nombre) && p.enGuerra) return this.msg(p, 'Ya estás en la guerra.', 'info');
  const part = g.participantes.get(nombre) || { bando: bandoDe(p), kills: 0, nombre: p.name };
  g.participantes.set(nombre, part);
  if (g.estado === 'inscripcion') {
    return this.msg(p, `Te anotaste en la guerra con los ${NOMBRE[part.bando]}. Empieza a las ${hora(g.proxima)}: te vamos a llevar automáticamente.`, 'server');
  }
  this.entrarAGuerra(p, part);
};

// /SALIRGUERRA
W.salirDeGuerra = function (p, motivo) {
  const g = this.guerra;
  const part = g.participantes.get(p.name.toLowerCase());
  if (!p.enGuerra && !part) return this.msg(p, 'No estás en la guerra.', 'info');
  g.participantes.delete(p.name.toLowerCase());
  p.enGuerra = null;
  if (p.dead) this.revive(p, true);
  const prev = part && part.prev;
  if (prev && this.maps[prev.map] && prev.map !== this.cfgGuerra.mapa) this.warp(p, prev.map, prev.x, prev.y);
  else { const c = bandoDe(p) === 'ciu' ? this.cfgGuerra.ciudadCiu : this.cfgGuerra.ciudadCri; this.warp(p, c[0], c[1], c[2]); }
  this.send(p, { t: 'guerraEstado', activa: 0 });
  if (motivo) this.msg(p, motivo, 'info');
};

// ¿Se pueden pelear? (ambos en guerra y de bandos distintos)
W.peleaDeGuerra = (a, b) => !!(a && b && a.enGuerra && b.enGuerra && a.enGuerra !== b.enGuerra);
W.mismoBandoGuerra = (a, b) => !!(a && b && a.enGuerra && b.enGuerra && a.enGuerra === b.enGuerra);

// Muerte dentro de la guerra: no se cae nada, no cambia ciudadano/criminal; reaparece en su base
W.muerteEnGuerra = function (victima, asesino) {
  const g = this.guerra;
  if (asesino && asesino.kind === 'pc' && this.peleaDeGuerra(victima, asesino)) {
    const part = g.participantes.get(asesino.name.toLowerCase());
    if (part) part.kills++;
    g.totales[asesino.enGuerra]++;
    asesino.killsGuerra = (asesino.killsGuerra || 0) + 1;
    if (victima.enGuerra === 'ciu') asesino.kills.ciu++; else asesino.kills.cri++;
    this.sumarKillRanking(asesino);
    const k = asesino.enGuerra === 'cri' ? asesino.kills.ciu : asesino.kills.cri;
    this.msg(asesino, `¡Mataste a ${victima.name}! Llevás ${k} ${asesino.enGuerra === 'cri' ? 'ciudadanos' : 'criminales'} matados (los premios se reclaman en ${asesino.enGuerra === 'cri' ? 'Arghal' : 'Banderbill'}).`, 'fight');
    this.msg(victima, `${asesino.name} te mató. Volvés a tu base en unos segundos.`, 'fight');
    this.enviarEstadoGuerra();
  }
  setTimeout(() => {
    if (!this.players.has(victima.id)) return;
    if (victima.enGuerra && g.estado === 'activa') {
      this.revive(victima, true);
      const [m, x, y] = this.spawnBando(victima.enGuerra);
      this.warp(victima, m, x, y);
    }
  }, 3000);
};

W.enviarEstadoGuerra = function (solo) {
  const g = this.guerra;
  g.ultimoEstado = Date.now();
  const base = { t: 'guerraEstado', activa: g.estado === 'activa' ? 1 : 0, quedan: Math.max(0, (g.fin || 0) - Date.now()), ciu: g.totales.ciu, cri: g.totales.cri };
  const enviar = (p) => {
    const part = g.participantes.get(p.name.toLowerCase());
    this.send(p, Object.assign({}, base, { bando: p.enGuerra || '', mias: part ? part.kills : 0, total: p.killsGuerra || 0 }));
  };
  if (solo) return enviar(solo);
  for (const p of this.players.values()) if (p.enGuerra) enviar(p);
};

W.terminarGuerra = function () {
  const g = this.guerra;
  const lista = [...g.participantes.values()].sort((a, b) => b.kills - a.kills);
  const { ciu, cri } = g.totales;
  const ganador = ciu === cri ? 'Empate' : ciu > cri ? '¡Ganaron los Ciudadanos!' : '¡Ganaron los Criminales!';
  let texto = `⚔ Terminó la guerra. ${ganador} (Ciudadanos ${ciu} · Criminales ${cri}).`;
  const top = lista[0];
  if (top && top.kills > 0) {
    // puntos de torneo para el que más mató (si hay empate, para todos los empatados)
    const ganadores = lista.filter((x) => x.kills === top.kills);
    for (const gw of ganadores) {
      const p = this.findPlayer(gw.nombre);
      const pts = this.cfgGuerra.puntosTorneoGanador;
      if (p) { p.puntosTorneo = (p.puntosTorneo || 0) + pts; this.msg(p, `¡Fuiste el que más mató en la guerra! Ganaste ${pts} puntos de torneo (tenés ${p.puntosTorneo}).`, 'server'); this.savePlayer(p); }
      else { const acc = require('./accounts'); const rec = acc.load(gw.nombre); if (rec) { rec.puntosTorneo = (rec.puntosTorneo || 0) + pts; acc.save(rec); } }
    }
    texto += ` El que más mató: ${ganadores.map((x) => x.nombre).join(', ')} con ${top.kills} kills.`;
  }
  for (const part of g.participantes.values()) { const x = this.findPlayer(part.nombre); if (x && this.sumarXpPase) { this.sumarXpPase(x, this.cfgPase.xp.guerra + part.kills * this.cfgPase.xp.killGuerra); this.retoPase(x, 'guerras'); } }
  this.toAll({ t: 'announce', text: texto });
  this.toAll({ t: 'msg', text: texto, color: 'server' });
  this.log(texto);
  g.estado = 'nada';
  for (const p of [...this.players.values()]) if (p.enGuerra) this.salirDeGuerra(p);
  g.participantes = new Map();
  g.totales = { ciu: 0, cri: 0 };
  g.proxima = this.proximaGuerra();
};

// Al entrar al juego: si quedó adentro de la arena sin guerra activa, se lo lleva a su ciudad
W.revisarGuerraAlEntrar = function (p) {
  if (p.map !== this.cfgGuerra.mapa) return;
  const c = bandoDe(p) === 'ciu' ? this.cfgGuerra.ciudadCiu : this.cfgGuerra.ciudadCri;
  p.map = c[0]; p.x = c[1]; p.y = c[2];
};

module.exports = W;
