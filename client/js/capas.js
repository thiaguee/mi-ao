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
// fase 'atras': se dibuja antes que el cuerpo (de frente y de costado se ve detrás del personaje)
// fase 'adelante': después del cuerpo y antes de la cabeza (de espaldas tapa la espalda y muestra el emblema)
export function dibujarCapa(ctx, cap, px, py, h, fase, now, caminando) {
  if (!cap) return;
  const espaldas = h === 1;
  if ((fase === 'adelante') !== espaldas) return;
  const cx = px + 16;
  const top = py - 8, bot = py + 26;
  const ondeo = caminando ? Math.sin(now / 90) * 1.6 : Math.sin(now / 700) * 0.6;
  ctx.save();
  ctx.beginPath();
  if (h === 1 || h === 3) {
    const tw = espaldas ? 7 : 9, bw = espaldas ? 11 : 13;
    ctx.moveTo(cx - tw, top);
    ctx.lineTo(cx + tw, top);
    ctx.quadraticCurveTo(cx + bw + 1, (top + bot) / 2, cx + bw + ondeo, bot);
    // ruedo ondulado
    ctx.quadraticCurveTo(cx + bw / 2, bot + 2 - ondeo, cx, bot);
    ctx.quadraticCurveTo(cx - bw / 2, bot - 2 + ondeo, cx - bw - ondeo, bot);
    ctx.quadraticCurveTo(cx - bw - 1, (top + bot) / 2, cx - tw, top);
  } else {
    // de costado: la capa cae hacia atrás
    const dir = h === 2 ? -1 : 1; // mirando al este, la capa queda hacia el oeste
    const atras = 9 + (caminando ? 4 + ondeo : 1);
    ctx.moveTo(cx - 4 * dir, top);
    ctx.lineTo(cx + 3 * dir, top + 1);
    ctx.quadraticCurveTo(cx + 2 * dir, (top + bot) / 2, cx + 1 * dir, bot - 1);
    ctx.quadraticCurveTo(cx + atras * dir * 0.5 * -1, bot + 2, cx + atras * -dir, bot - 3 + ondeo);
    ctx.quadraticCurveTo(cx - atras * dir * 0.8, (top + bot) / 2, cx - 4 * dir, top);
  }
  ctx.closePath();
  const grad = ctx.createLinearGradient(cx, top, cx, bot);
  grad.addColorStop(0, sombra(cap.c, espaldas ? 1.15 : 0.75));
  grad.addColorStop(1, sombra(cap.c, espaldas ? 0.8 : 0.5));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = cap.b;
  ctx.stroke();
  if (espaldas) {
    // broche en los hombros y emblema en la espalda
    ctx.fillStyle = cap.b;
    ctx.fillRect(cx - 8, top - 1, 16, 2);
    dibujarEmblema(ctx, cap.e, cx, top + (bot - top) * 0.45, 11, cap.ce);
  } else if (h === 3) {
    // de frente: el cuello de la capa sobre los hombros
    ctx.fillStyle = cap.b;
    ctx.fillRect(cx - 9, top, 3, 3); ctx.fillRect(cx + 6, top, 3, 3);
  }
  ctx.restore();
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
