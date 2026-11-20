// Capas de clan: se dibujan sobre los personajes (con el emblema en la espalda) y el aura del líder.
// Todo se dibuja con formas, así cada clan puede tener su propio diseño.

function sombra(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f)), g = Math.min(255, Math.round(((n >> 8) & 255) * f)), b = Math.min(255, Math.round((n & 255) * f));
  return `rgb(${r},${g},${b})`;
}

// ---------- emblemas ----------
export function dibujarEmblema(ctx, tipo, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color; ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, s / 6); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s / 2;
  ctx.beginPath();
  switch (tipo) {
    case 'estrella':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.42 : r;
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); break;
    case 'espadas':
      ctx.moveTo(-r, -r); ctx.lineTo(r, r); ctx.moveTo(r, -r); ctx.lineTo(-r, r);
      ctx.moveTo(-r * 0.55, r * 0.25); ctx.lineTo(-r * 0.15, r * 0.65);
      ctx.moveTo(r * 0.55, r * 0.25); ctx.lineTo(r * 0.15, r * 0.65);
      ctx.stroke(); break;
    case 'escudo':
      ctx.moveTo(-r * 0.85, -r * 0.8); ctx.lineTo(r * 0.85, -r * 0.8); ctx.lineTo(r * 0.8, 0);
      ctx.quadraticCurveTo(r * 0.5, r * 0.7, 0, r); ctx.quadraticCurveTo(-r * 0.5, r * 0.7, -r * 0.8, 0);
      ctx.closePath(); ctx.fill(); break;
    case 'calavera':
      ctx.arc(0, -r * 0.15, r * 0.75, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-r * 0.45, r * 0.35, r * 0.9, r * 0.55);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.arc(r * 0.3, -r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'corona':
      ctx.moveTo(-r, r * 0.6); ctx.lineTo(-r, -r * 0.5); ctx.lineTo(-r * 0.5, 0); ctx.lineTo(0, -r * 0.8);
      ctx.lineTo(r * 0.5, 0); ctx.lineTo(r, -r * 0.5); ctx.lineTo(r, r * 0.6); ctx.closePath(); ctx.fill(); break;
    case 'luna':
      ctx.arc(0, 0, r, Math.PI * 0.3, Math.PI * 1.7, false);
      ctx.arc(r * 0.45, 0, r * 0.8, Math.PI * 1.55, Math.PI * 0.45, true);
      ctx.closePath(); ctx.fill(); break;
    case 'sol':
      ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.moveTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.stroke(); break;
    case 'rayo':
      ctx.moveTo(r * 0.2, -r); ctx.lineTo(-r * 0.55, r * 0.1); ctx.lineTo(-r * 0.05, r * 0.1);
      ctx.lineTo(-r * 0.25, r); ctx.lineTo(r * 0.55, -r * 0.15); ctx.lineTo(r * 0.05, -r * 0.15); ctx.closePath(); ctx.fill(); break;
    case 'cruz':
      ctx.fillRect(-r * 0.2, -r, r * 0.4, r * 2); ctx.fillRect(-r * 0.75, -r * 0.45, r * 1.5, r * 0.4); break;
    case 'dragon': // alas
      ctx.moveTo(0, r * 0.6);
      ctx.quadraticCurveTo(-r * 0.4, -r * 0.2, -r, -r * 0.7); ctx.lineTo(-r * 0.75, -r * 0.05); ctx.lineTo(-r, r * 0.2); ctx.lineTo(-r * 0.55, r * 0.3);
      ctx.lineTo(0, r * 0.6);
      ctx.quadraticCurveTo(r * 0.4, -r * 0.2, r, -r * 0.7); ctx.lineTo(r * 0.75, -r * 0.05); ctx.lineTo(r, r * 0.2); ctx.lineTo(r * 0.55, r * 0.3);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.22, 0, Math.PI * 2); ctx.fill(); break;
    case 'llama':
      ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * 0.9, -r * 0.1, r * 0.55, r * 0.55); ctx.quadraticCurveTo(0, r * 1.1, -r * 0.55, r * 0.55);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.1, -r * 0.1, -r * 0.35); ctx.quadraticCurveTo(0, -r * 0.6, 0, -r); ctx.fill(); break;
    case 'ojo':
      ctx.moveTo(-r, 0); ctx.quadraticCurveTo(0, -r * 0.9, r, 0); ctx.quadraticCurveTo(0, r * 0.9, -r, 0); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2); ctx.fill(); break;
    default:
      ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- capa ----------
// fase 'atras': antes del cuerpo (de frente y de costado la capa cae detrás del personaje)
// fase 'adelante': después del cuerpo y antes de la cabeza (de espaldas tapa la espalda y muestra
// el emblema; de frente sólo se dibuja el broche en el pecho)
export function dibujarCapa(ctx, cap, px, py, h, fase, now, caminando) {
  if (!cap) return;
  const cx = px + 16;
  const top = py - 7, bot = py + 27;
  const ondeo = caminando ? Math.sin(now / 95) * 1.3 : Math.sin(now / 900) * 0.35;
  const ondeo2 = caminando ? Math.sin(now / 95 + 1.7) * 1.1 : 0;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (h === 1) {
    if (fase !== 'adelante') { ctx.restore(); return; }
    capaEspalda(ctx, cap, cx, top, bot, ondeo, ondeo2);
  } else if (h === 3) {
    if (fase === 'atras') capaFrenteAtras(ctx, cap, cx, top, bot, ondeo, ondeo2);
    else broche(ctx, cap, cx, top);
  } else if (fase === 'atras') {
    capaCostado(ctx, cap, cx, top, bot, h === 2 ? -1 : 1, caminando, ondeo);
  }
  ctx.restore();
}

// tela con volumen: más oscura en los costados y más clara en el centro
function tela(ctx, cap, x0, x1, top, bot, luz) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, sombra(cap.c, 0.5 * luz));
  g.addColorStop(0.3, sombra(cap.c, 0.95 * luz));
  g.addColorStop(0.5, sombra(cap.c, 1.12 * luz));
  g.addColorStop(0.7, sombra(cap.c, 0.95 * luz));
  g.addColorStop(1, sombra(cap.c, 0.5 * luz));
  ctx.fillStyle = g;
  ctx.fill();
  // un poco más oscura abajo
  const v = ctx.createLinearGradient(0, top, 0, bot);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = v; ctx.fill();
}

// ribete: contorno oscuro finito por fuera y el borde del color elegido por dentro
function ribete(ctx, cap) {
  ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.strokeStyle = cap.b; ctx.lineWidth = 0.7; ctx.stroke();
}

function pliegue(ctx, x0, y0, cx1, cy1, x1, y1, oscuro) {
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx1, cy1, x1, y1);
  ctx.strokeStyle = oscuro ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 0.6; ctx.stroke();
}

function capaEspalda(ctx, cap, cx, top, bot, o, o2) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 6, top + 0.5);
    ctx.quadraticCurveTo(cx, top - 1.2, cx + 6, top + 0.5); // cuello
    ctx.bezierCurveTo(cx + 9, top + 3, cx + 9.5, top + 14, cx + 10.5 + o, bot - 1); // costado derecho
    ctx.quadraticCurveTo(cx + 7.5, bot + 0.5 + o2 * 0.5, cx + 5, bot - 1.2); // ruedo en puntas suaves
    ctx.quadraticCurveTo(cx + 2.5, bot + 1.2, cx, bot - 0.6);
    ctx.quadraticCurveTo(cx - 2.5, bot + 1.2, cx - 5, bot - 1.2);
    ctx.quadraticCurveTo(cx - 7.5, bot + 0.5 - o2 * 0.5, cx - 10.5 - o, bot - 1);
    ctx.bezierCurveTo(cx - 9.5, top + 14, cx - 9, top + 3, cx - 6, top + 0.5);
    ctx.closePath();
  };
  path(); tela(ctx, cap, cx - 10.5, cx + 10.5, top, bot, 1);
  // pliegues de la tela
  ctx.save(); path(); ctx.clip();
  pliegue(ctx, cx - 3.5, top + 4, cx - 5 - o * 0.4, top + 18, cx - 6.5 - o, bot, true);
  pliegue(ctx, cx + 3.5, top + 4, cx + 5 + o * 0.4, top + 18, cx + 6.5 + o, bot, true);
  pliegue(ctx, cx - 1, top + 6, cx - 1.5, top + 20, cx - 2, bot, false);
  pliegue(ctx, cx - 7, top + 8, cx - 8.5, top + 20, cx - 9.5 - o, bot - 1, false);
  ctx.restore();
  path(); ribete(ctx, cap);
  // cuello (manto corto sobre los hombros)
  ctx.beginPath();
  ctx.moveTo(cx - 6.5, top + 0.5);
  ctx.quadraticCurveTo(cx, top - 1.4, cx + 6.5, top + 0.5);
  ctx.quadraticCurveTo(cx + 5.5, top + 3.6, cx, top + 3.2);
  ctx.quadraticCurveTo(cx - 5.5, top + 3.6, cx - 6.5, top + 0.5);
  ctx.closePath();
  ctx.fillStyle = cap.b; ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 0.6; ctx.stroke();
  // emblema con una sombra suave
  const ey = top + (bot - top) * 0.4;
  dibujarEmblema(ctx, cap.e, cx + 0.4, ey + 0.5, 8.5, 'rgba(0,0,0,0.45)');
  dibujarEmblema(ctx, cap.e, cx, ey, 8.5, cap.ce);
}

function capaFrenteAtras(ctx, cap, cx, top, bot, o, o2) {
  // de frente sólo asoman los bordes de la capa a los costados y abajo (se ve el forro, más oscuro)
  ctx.beginPath();
  ctx.moveTo(cx - 7, top + 1.5);
  ctx.bezierCurveTo(cx - 10, top + 5, cx - 10.5, top + 15, cx - 11 - o, bot - 1);
  ctx.quadraticCurveTo(cx - 6, bot + 0.8 + o2 * 0.4, cx, bot);
  ctx.quadraticCurveTo(cx + 6, bot + 0.8 - o2 * 0.4, cx + 11 + o, bot - 1);
  ctx.bezierCurveTo(cx + 10.5, top + 15, cx + 10, top + 5, cx + 7, top + 1.5);
  ctx.closePath();
  tela(ctx, cap, cx - 11, cx + 11, top, bot, 0.62);
  ribete(ctx, cap);
}

function broche(ctx, cap, cx, top) {
  // cadenita y dos broches sobre los hombros
  ctx.beginPath();
  ctx.moveTo(cx - 5, top + 2.2);
  ctx.quadraticCurveTo(cx, top + 4.5, cx + 5, top + 2.2);
  ctx.strokeStyle = cap.b; ctx.lineWidth = 0.6; ctx.stroke();
  for (const dx of [-5, 5]) {
    ctx.beginPath(); ctx.arc(cx + dx, top + 2.2, 1.25, 0, Math.PI * 2);
    ctx.fillStyle = cap.b; ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + dx, top + 2.2, 0.55, 0, Math.PI * 2);
    ctx.fillStyle = cap.ce; ctx.fill();
  }
}

function capaCostado(ctx, cap, cx, top, bot, dir, caminando, o) {
  // dir: hacia dónde queda la espalda (-1 = izquierda)
  const vuelo = caminando ? 3.5 + o : 0.5;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(cx + 1.5 * -dir, top + 0.5);
    ctx.quadraticCurveTo(cx + 5 * dir, top + 1, cx + 6.5 * dir, top + 6);
    ctx.bezierCurveTo(cx + 8 * dir, top + 15, cx + (9 + vuelo) * dir, bot - 6, cx + (10 + vuelo) * dir, bot - 1.5);
    ctx.quadraticCurveTo(cx + (5 + vuelo / 2) * dir, bot + 1, cx + 1 * dir, bot - 0.5);
    ctx.bezierCurveTo(cx + 2.5 * dir, top + 18, cx + 1.5 * dir, top + 8, cx + 1.5 * -dir, top + 0.5);
    ctx.closePath();
  };
  path();
  tela(ctx, cap, cx + dir * 1, cx + dir * (10 + vuelo), top, bot, 0.85);
  ctx.save(); path(); ctx.clip();
  pliegue(ctx, cx + 4 * dir, top + 5, cx + 5.5 * dir, top + 17, cx + (6.5 + vuelo * 0.6) * dir, bot, true);
  ctx.restore();
  path(); ribete(ctx, cap);
}

// ---------- aura del líder ----------
export function dibujarAura(ctx, cap, px, py, now) {
  if (!cap || !cap.ld) return;
  const cx = px + 16, cy = py + 29;
  const pulso = 0.6 + Math.sin(now / 300) * 0.25;
  ctx.save();
  // brillo en el piso
  const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 20);
  g.addColorStop(0, hexA(cap.ce, 0.55 * pulso));
  g.addColorStop(1, hexA(cap.ce, 0));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
  // anillo
  ctx.strokeStyle = hexA(cap.ce, 0.75 * pulso);
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(cx, cy, 15, 5.5, 0, 0, Math.PI * 2); ctx.stroke();
  // chispas que suben girando alrededor
  for (let i = 0; i < 6; i++) {
    const t = ((now / 1600) + i / 6) % 1;
    const a = now / 650 + i * (Math.PI * 2 / 6);
    const x = cx + Math.cos(a) * 14, y = cy + Math.sin(a) * 5 - t * 34;
    ctx.fillStyle = hexA(i % 2 ? cap.ce : cap.b, (1 - t) * 0.9);
    ctx.fillRect(Math.round(x * 2) / 2 - 0.75, Math.round(y * 2) / 2 - 0.75, 1.5, 1.5);
  }
  ctx.restore();
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
}
