'use strict';
// Emotes: /SALUDAR /BAILAR /SENTARSE /REIR /APLAUDIR /LLORAR /ENOJAR /AMOR /PENSAR
// El cliente muestra un ícono arriba de la cabeza (y baila o se sienta). Sentarse sigue hasta que te movés.
const { idx } = require('./gamedata');

const E = {};
const EMOTES = {
  SALUDAR: { e: 'saludar', txt: 'saluda' },
  BAILAR: { e: 'bailar', txt: 'baila' },
  REIR: { e: 'reir', txt: 'se ríe' },
  APLAUDIR: { e: 'aplaudir', txt: 'aplaude' },
  LLORAR: { e: 'llorar', txt: 'llora' },
  ENOJAR: { e: 'enojar', txt: 'está enojado' },
  AMOR: { e: 'amor', txt: 'tira amor' },
  PENSAR: { e: 'pensar', txt: 'se queda pensando' },
};
E.esEmote = (cmd) => !!EMOTES[cmd] || cmd === 'SENTARSE' || cmd === 'SENTAR' || cmd === 'PARARSE' || cmd === 'EMOTES';

E.emote = function (p, cmd) {
  if (cmd === 'EMOTES') return this.msg(p, 'Emotes: /SALUDAR /BAILAR /SENTARSE /REIR /APLAUDIR /LLORAR /ENOJAR /AMOR /PENSAR', 'info');
  if (p.dead) return this.msg(p, 'Los muertos no hacen emotes.', 'warn');
  const now = Date.now();
  if (now - (p.lastEmote || 0) < 1500) return;
  p.lastEmote = now;
  if (cmd === 'PARARSE') return this.pararse(p);
  if (cmd === 'SENTARSE' || cmd === 'SENTAR') {
    if (p.sentado) return this.pararse(p);
    // ¿hay un banco al lado? (arriba, o en la misma fila a los costados): se sienta en el banco
    const mp = this.maps[p.map];
    let banco = 0;
    for (const [dx, dy] of [[0, -1], [-1, -1], [1, -1]]) {
      const x = p.x + dx, y = p.y + dy;
      if (this.inMap(x, y) && mp.d.bancos.has(idx(x, y))) banco = 1;
    }
    p.sentado = banco ? 2 : 1; // 2 = en un banco, 1 = en el piso
    p.heading = 3;
    this.sendCharToMap(p);
    return this.toMap(p.map, { t: 'msg', text: `* ${p.name} se sienta${banco ? ' en el banco' : ''} *`, color: 'emote' });
  }
  const em = EMOTES[cmd];
  this.toMap(p.map, { t: 'emote', id: p.id, e: em.e });
  this.toMap(p.map, { t: 'msg', text: `* ${p.name} ${em.txt} *`, color: 'emote' });
};

E.pararse = function (p) {
  if (!p.sentado) return;
  p.sentado = 0;
  this.sendCharToMap(p);
};

module.exports = E;
