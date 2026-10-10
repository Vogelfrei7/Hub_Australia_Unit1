// Intro (ca. 22 s) im Reisetagebuch-Look der Karte. Fünf Kapitel:
//  1 Aufbruch (0–3 s)  2 Reise mit Tier-Stickern (3–10 s)  3 Aufgabe mit dem KI-Coach (10–15 s)
//  4 Pass mit Stärken → Klassenauswertung der Lehrkraft (15–20 s)  5 Finale (ab 20 s)
// Jedes Bild ist eine reine Funktion der Zeit t (render(t)): Skip, "Nochmal" und ?t=… (Standbild zum Prüfen) setzen nur t.
// Karte, Route, Orte und Stempel kommen aus config.json; Landschaft und Tiermotive aus scenery.js.

import { loadConfig } from './core.js?v=3.2';
import { terrainSVG, motifsSVG } from './scenery.js?v=3.2';

const $ = (s) => document.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FREEZE = parseFloat(new URLSearchParams(location.search).get('t'));
const svg = $('#stage');
const END = 21.2; // Buttons erscheinen

const C = {
  navy: '#1B2A55', cream: '#F2EADA', paper: '#FFFBF3', sky: '#8DB9E2', skyL: '#DCEAF5', ocean: '#A9CDEB', oceanInk: '#2C5E86',
  teal: '#3F8E99', tealL: '#DDEFF0', terra: '#C9643B', terraInk: '#A9502B', terraL: '#F8E1D3', sage: '#4F7449', gold: '#E0A526',
  muted: '#3D4560', line: '#E2D4BA', sand: '#EBBC8C',
};
const HAND = "'Caveat Brush', cursive", BODY = "'Atkinson Hyperlegible', system-ui, sans-serif";

/* ---------- Werkzeuge ---------- */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const k = (t, a, d) => clamp((t - a) / d);
const mix = (a, b, p) => a + (b - a) * p;
const io = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const out = (p) => 1 - Math.pow(1 - p, 3);
const back = (p) => { const c = 1.9; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
const pop = (t, a, d = 0.45) => back(k(t, a, d)); // 0 → 1 mit Überschwingen
const life = (t, a, b, fi = 0.35, fo = 0.3) => Math.min(k(t, a, fi), 1 - k(t, b - fo, fo)); // ein- und ausblenden
const TF = (x, y, s = 1, r = 0) => `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(2)}) scale(${Math.max(0.0001, s).toFixed(4)})`;
let uid = 0;

function E(tag, attrs = {}, parent, text) {
  const n = document.createElementNS(NS, tag);
  for (const [a, v] of Object.entries(attrs)) n.setAttribute(a, v);
  if (text != null) n.textContent = text;
  if (parent) parent.appendChild(n);
  return n;
}
const G = (parent, attrs) => E('g', attrs, parent);
const show = (el, on) => { el.style.display = on ? '' : 'none'; };
const op = (el, v) => el.setAttribute('opacity', clamp(v).toFixed(3));
const tf = (el, ...a) => el.setAttribute('transform', TF(...a));
const txt = (parent, s, x, y, size, fill, opts = {}) => E('text', {
  x, y, fill, 'font-size': size, 'text-anchor': opts.anchor || 'middle', style: `font-family:${opts.font || HAND};${opts.bold ? 'font-weight:700;' : ''}${opts.ls ? `letter-spacing:${opts.ls}px;` : ''}`,
}, parent, s);
const star = (r) => Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r; return `${(Math.cos(a) * q).toFixed(1)},${(Math.sin(a) * q).toFixed(1)}`; }).join(' ');

const meas = document.createElement('canvas').getContext('2d');
// Buchstaben einzeln, damit sie nacheinander hereinfallen können
function letters(parent, str, x, y, size, fill) {
  meas.font = `400 ${size}px "Caveat Brush"`;
  let cx = x - meas.measureText(str).width / 2;
  return [...str].map((ch) => {
    const w = meas.measureText(ch).width;
    const g = G(parent);
    txt(g, ch, 0, 0, size, fill);
    const l = { g, x: cx + w / 2, y };
    cx += w;
    return l;
  });
}

// Überschrift mit Pinselstrich (wie im Hub)
function headline(parent, x, y, en, de, size = 64, anchor = 'start') {
  const g = G(parent);
  meas.font = `400 ${size}px "Caveat Brush"`;
  const w = meas.measureText(en).width;
  const x0 = anchor === 'start' ? 0 : -w / 2;
  const brush = E('path', { d: `M${x0 - 6},${size * 0.16} q${w * 0.5},-${size * 0.14} ${w + 12},${size * 0.02}`, fill: 'none', stroke: C.sky, 'stroke-width': size * 0.22,
    'stroke-linecap': 'round', opacity: 0.75, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, g);
  txt(g, en, 0, 0, size, C.navy, { anchor });
  if (de) txt(g, de, 0, size * 0.62, size * 0.36, C.muted, { anchor, font: BODY });
  return { g, brush, x, y };
}
function headlineAt(h, t, a, b) {
  const v = life(t, a, b, 0.4, 0.3);
  show(h.g, v > 0);
  if (v <= 0) return;
  tf(h.g, h.x - (1 - out(k(t, a, 0.45))) * 80 - k(t, b - 0.3, 0.3) * 60, h.y);
  op(h.g, v);
  h.brush.setAttribute('stroke-dashoffset', (1 - out(k(t, a + 0.15, 0.5))).toFixed(3));
}

function smoothPath(pts) {
  let d = `M${pts[0]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${[p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]} ${[p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]} ${p2}`;
  }
  return d;
}

/* ---------- Figuren ---------- */
function vanSVG(parent, avatar) {
  const g = G(parent);
  g.innerHTML = `
    <rect x="-30" y="-36" width="58" height="27" rx="9" fill="${C.navy}"/>
    <path d="M-30,-22 V-27 a9 9 0 0 1 9 -9 H19 a9 9 0 0 1 9 9 V-22 Z" fill="${C.paper}"/>
    <rect x="10" y="-33" width="14" height="9" rx="3" fill="#BFDDF0"/>
    <rect x="-24" y="-43" width="34" height="6" rx="2" fill="${C.terra}"/>
    <path d="M-26,-17 H24" stroke="${C.gold}" stroke-width="3"/>
    <circle cx="-16" cy="-8" r="6" fill="#2A2A2E"/><circle cx="-16" cy="-8" r="2.2" fill="#D6D0C4"/>
    <circle cx="16" cy="-8" r="6" fill="#2A2A2E"/><circle cx="16" cy="-8" r="2.2" fill="#D6D0C4"/>
    <clipPath id="vanav${++uid}"><circle cx="-14" cy="-46" r="12"/></clipPath>
    <circle cx="-14" cy="-46" r="13.5" fill="${C.paper}" stroke="${C.navy}" stroke-width="1.5"/>
    <image href="${avatar}" x="-26" y="-58" width="24" height="24" clip-path="url(#vanav${uid})" preserveAspectRatio="xMidYMid slice"/>`;
  return g;
}

// Der KI-Reisebegleiter: freundlicher Kopf mit Entdeckerhut und Funken
function coachSVG(parent, r = 30) {
  const g = G(parent);
  g.innerHTML = `
    <circle r="${r}" fill="${C.teal}" stroke="${C.navy}" stroke-width="${r * 0.1}"/>
    <ellipse cx="0" cy="${r * 0.12}" rx="${r * 0.68}" ry="${r * 0.52}" fill="${C.paper}"/>
    <circle cx="${-r * 0.26}" cy="${r * 0.06}" r="${r * 0.11}" fill="${C.navy}"/><circle cx="${r * 0.26}" cy="${r * 0.06}" r="${r * 0.11}" fill="${C.navy}"/>
    <path d="M${-r * 0.24},${r * 0.32} Q0,${r * 0.52} ${r * 0.24},${r * 0.32}" fill="none" stroke="${C.navy}" stroke-width="${r * 0.08}" stroke-linecap="round"/>
    <path d="M${-r * 1.0},${-r * 0.62} Q0,${-r * 0.84} ${r * 1.0},${-r * 0.62} Q0,${-r * 0.5} ${-r * 1.0},${-r * 0.62} Z" fill="${C.terraInk}"/>
    <path d="M${-r * 0.58},${-r * 0.66} Q${-r * 0.5},${-r * 1.28} 0,${-r * 1.3} Q${r * 0.5},${-r * 1.28} ${r * 0.58},${-r * 0.66} Z" fill="${C.terra}"/>
    <path d="M${-r * 0.56},${-r * 0.8} Q0,${-r * 0.92} ${r * 0.56},${-r * 0.8}" fill="none" stroke="${C.gold}" stroke-width="${r * 0.1}"/>`;
  const sp = G(g);
  E('polygon', { points: star(r * 0.28), fill: C.gold }, sp);
  return { g, sp, r };
}
const coachAt = (c, t) => tf(c.sp, c.r * 0.95, -c.r * 0.95, 0.7 + 0.35 * Math.abs(Math.sin(t * 4)), t * 90);

function motif(markup, id) {
  const tmp = document.createElementNS(NS, 'g');
  tmp.innerHTML = markup;
  return tmp.querySelector(`[data-motif="${id}"]`).innerHTML;
}

// Tier-Sticker: runde Plakette (wie die Avatare) mit Landschaft und bewegtem Tier
function sticker(parent, kind, label, motifs) {
  const g = G(parent);
  const id = `stk${++uid}`;
  E('circle', { r: 132, fill: C.navy, opacity: 0.18, cx: 6, cy: 10 }, g);
  E('clipPath', { id }, g).appendChild(E('circle', { r: 124 }));
  const inner = G(g, { 'clip-path': `url(#${id})` });
  const BG = {
    sea: `<rect x="-130" y="-130" width="260" height="260" fill="${C.ocean}"/><rect x="-130" y="10" width="260" height="130" fill="#7FB0D9"/>
          <path d="M-120,10 q15,-8 30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0 t30,0" fill="none" stroke="#fff" stroke-width="4" opacity=".8"/>`,
    deep: `<rect x="-130" y="-130" width="260" height="260" fill="#5E94C2"/><circle cx="-60" cy="-70" r="6" fill="#fff" opacity=".5"/><circle cx="70" cy="40" r="4" fill="#fff" opacity=".5"/>
           <path d="M-130,95 q30,-20 60,0 t60,0 t60,0 t60,0 V140 H-130 Z" fill="#E9A26C" opacity=".8"/>`,
    outback: `<rect x="-130" y="-130" width="260" height="260" fill="#F7D9A8"/><circle cx="58" cy="-58" r="30" fill="${C.gold}"/>
              <rect x="-130" y="60" width="260" height="80" fill="#E9A26C"/><path d="M-130,62 Q-60,40 0,58 T130,52 V64 H-130Z" fill="#D98A54"/>`,
    river: `<rect x="-130" y="-130" width="260" height="260" fill="${C.terraL}"/><rect x="-130" y="30" width="260" height="110" fill="#7BA89B"/>
            <ellipse cx="-110" cy="20" rx="60" ry="40" fill="${C.sage}"/><ellipse cx="120" cy="10" rx="55" ry="45" fill="${C.sage}"/>`,
    bush: `<rect x="-130" y="-130" width="260" height="260" fill="${C.tealL}"/><rect x="-130" y="80" width="260" height="60" fill="#9DBB7A"/>
           <ellipse cx="-80" cy="-90" rx="50" ry="30" fill="#BCD3A2"/><ellipse cx="90" cy="-70" rx="45" ry="28" fill="#BCD3A2"/>`,
  }[{ jelly: 'deep', shark: 'sea', roo: 'outback', croc: 'river', koala: 'bush' }[kind]];
  G(inner).innerHTML = BG;
  const a = G(inner);
  const parts = {};
  if (kind === 'roo') a.innerHTML = `<g transform="translate(0 64) scale(2.5)">${motif(motifs, 'roo')}</g>`;
  if (kind === 'koala') a.innerHTML = `<g transform="translate(-14 90) scale(2.4)">${motif(motifs, 'koala')}</g>`;
  if (kind === 'croc') {
    a.innerHTML = `
      <path d="M-120,40 Q-80,8 -20,6 L50,4 Q62,4 66,10 L66,40 Q20,52 -40,52 Q-100,54 -120,40 Z" fill="#5E7F3E" stroke="${C.navy}" stroke-width="3"/>
      <path d="M-60,8 l6,-10 l6,10 M-36,6 l6,-10 l6,10 M-12,5 l6,-10 l6,10 M12,4 l6,-10 l6,10" fill="#4A6830" stroke="${C.navy}" stroke-width="2"/>
      <path d="M50,34 L128,40 Q136,44 128,50 L50,48 Z" fill="#6E9049" stroke="${C.navy}" stroke-width="3"/>
      <path d="M60,40 l4,-6 l4,6 M76,41 l4,-6 l4,6 M92,42 l4,-6 l4,6 M108,43 l4,-6 l4,6" fill="#fff"/>
      <path d="M-120,52 Q0,62 130,56 V140 H-130 Z" fill="#7BA89B" opacity=".75"/>`;
    parts.jaw = G(a);
    parts.jaw.innerHTML = `<g><path d="M48,8 L128,20 Q138,26 128,32 L50,34 Q44,20 48,8 Z" fill="#6E9049" stroke="${C.navy}" stroke-width="3"/>
      <path d="M62,32 l4,6 l4,-6 M78,32 l4,6 l4,-6 M94,31 l4,6 l4,-6 M110,30 l4,6 l4,-6" fill="#fff"/>
      <circle cx="58" cy="10" r="7" fill="#FFF6DE" stroke="${C.navy}" stroke-width="2"/><circle cx="60" cy="10" r="3" fill="${C.navy}"/></g>`;
  }
  if (kind === 'shark') {
    parts.fins = [0, 1].map(() => { const f = G(a); f.innerHTML = `<path d="M-26,0 Q-8,-62 28,-70 Q14,-30 26,0 Z" fill="#5F7F98" stroke="${C.navy}" stroke-width="3"/>
      <path d="M-40,4 q14,-8 28,0 M14,4 q14,-8 28,0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`; return f; });
  }
  if (kind === 'jelly') {
    parts.body = G(a);
    parts.tent = [-24, -8, 8, 24].map(() => E('path', { fill: 'none', stroke: '#F29BB8', 'stroke-width': 5, 'stroke-linecap': 'round' }, parts.body));
    G(parts.body).innerHTML = `<path d="M-48,0 Q-48,-60 0,-60 Q48,-60 48,0 Q36,10 24,0 Q12,10 0,0 Q-12,10 -24,0 Q-36,10 -48,0 Z" fill="#F4A9C4" stroke="${C.navy}" stroke-width="3"/>
      <ellipse cx="-16" cy="-34" rx="9" ry="6" fill="#fff" opacity=".6"/><circle cx="14" cy="-26" r="5" fill="#fff" opacity=".45"/>`;
  }
  E('circle', { r: 124, fill: 'none', stroke: C.navy, 'stroke-width': 7 }, g);
  E('circle', { r: 114, fill: 'none', stroke: C.paper, 'stroke-width': 3, opacity: 0.8 }, g);
  // Namensschild auf Englisch – nebenbei Vokabeln
  meas.font = '400 40px "Caveat Brush"';
  const w = meas.measureText(label).width + 36;
  const tag = G(g, { transform: 'translate(0 126) rotate(-4)' });
  E('rect', { x: -w / 2, y: -26, width: w, height: 52, rx: 14, fill: C.terra, stroke: C.navy, 'stroke-width': 3 }, tag);
  txt(tag, label, 0, 13, 40, C.paper);
  return { g, a, kind, parts };
}

function stickerAt(s, t, x, y, a, b, scale = 1) {
  const v = b === Infinity ? k(t, a, 0.01) : life(t, a, b, 0.01, 0.3);
  show(s.g, v > 0);
  if (v <= 0) return;
  const inS = pop(t, a, 0.5), outS = b === Infinity ? 0 : k(t, b - 0.3, 0.3);
  tf(s.g, x, y + Math.sin(t * 2 + x) * 4, scale * inS * (1 - outS * 0.6), (1 - inS) * -25 + Math.sin(t * 1.6 + y) * 2);
  op(s.g, 1 - outS);
  const L = t - a;
  if (s.kind === 'roo') tf(s.a, 0, -Math.abs(Math.sin(L * 5.5)) * 46, 1, Math.sin(L * 5.5) * 4);
  if (s.kind === 'koala') tf(s.a, 0, 0, 1, Math.sin(L * 2.4) * 5);
  if (s.kind === 'croc') {
    s.parts.jaw.firstChild.setAttribute('transform', `rotate(${(-Math.pow(Math.abs(Math.sin(L * 3.6)), 3) * 24).toFixed(1)} 50 30)`);
    tf(s.a, Math.sin(L * 1.5) * 8, 0);
  }
  if (s.kind === 'shark') s.parts.fins.forEach((f, i) => {
    const ang = L * 2.6 + i * Math.PI, depth = Math.sin(ang);
    f.setAttribute('transform', TF(Math.cos(ang) * 64, 14 + depth * 10, 0.75 + 0.25 * depth) + (depth < 0 ? ' scale(-1 1)' : ''));
    op(f, 0.55 + 0.45 * (depth + 1) / 2);
  });
  if (s.kind === 'jelly') {
    const bob = Math.sin(L * 3) * 16, sq = 1 + Math.sin(L * 6) * 0.07;
    s.parts.body.setAttribute('transform', `translate(0 ${(-10 + bob).toFixed(1)}) scale(${(1 / sq).toFixed(3)} ${sq.toFixed(3)})`);
    s.parts.tent.forEach((p, i) => {
      const x0 = [-24, -8, 8, 24][i], w1 = Math.sin(L * 5 + i) * 10, w2 = Math.sin(L * 5 + i + 1.4) * 12;
      p.setAttribute('d', `M${x0},0 Q${(x0 + w1).toFixed(1)},26 ${x0},50 T${(x0 + w2 * 0.4).toFixed(1)},100`);
    });
  }
}

/* ---------- Aufbau ---------- */
let R = null; // alle Szenen-Referenzen

function build(cfg) {
  svg.innerHTML = '';
  const motifs = motifsSVG({ topics: Object.fromEntries(Object.keys(cfg.topics).map((id) => [id, { stamp: 1 }])) }, null);
  const avatar = 'assets/img/animals/fox.webp';
  const road = cfg.routeById.grammar;
  const T = cfg.topics;

  const defs = E('defs', {}, svg);
  defs.innerHTML = `
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .3  0 0 0 .08 0"/></filter>
    <radialGradient id="vig" cx="50%" cy="45%" r="75%"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#6A2C12" stop-opacity=".12"/></radialGradient>
    <clipPath id="iris"><circle id="irisC" cx="800" cy="780" r="0"/></clipPath>
    <clipPath id="wipe3"><circle id="wipe3C" cx="1150" cy="520" r="0"/></clipPath>
    <clipPath id="avP"><circle cx="0" cy="0" r="84"/></clipPath>`;
  E('rect', { width: 1600, height: 1000, fill: C.cream }, svg);

  /* 1 Aufbruch */
  const s1 = G(svg);
  const sun = G(s1); E('circle', { r: 120, fill: C.gold, opacity: 0.25 }, sun); E('circle', { r: 80, fill: C.gold, opacity: 0.35 }, sun);
  const rays = G(sun); for (let i = 0; i < 12; i++) E('path', { d: 'M0,-150 L0,-200', stroke: C.gold, 'stroke-width': 8, 'stroke-linecap': 'round', opacity: 0.5, transform: `rotate(${i * 30})` }, rays);
  const road1 = E('path', { d: 'M-50,800 Q400,760 800,790 T1650,770', fill: 'none', stroke: C.terra, 'stroke-width': 10, 'stroke-dasharray': '4 22', 'stroke-linecap': 'round', opacity: 0.6 }, s1);
  const brush1 = E('path', { d: 'M360,470 q420,-60 880,-10', fill: 'none', stroke: C.sky, 'stroke-width': 70, 'stroke-linecap': 'round', opacity: 0.6, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, s1);
  const kick = txt(s1, 'AN ENGLISH ADVENTURE  ·  HEADLIGHT 5  ·  UNIT 1', 800, 270, 24, C.terraInk, { font: BODY, bold: true, ls: 6 });
  const L1 = letters(G(s1), 'Australia', 800, 450, 210, C.navy);
  const L2 = letters(G(s1), 'Road Trip', 800, 590, 130, C.terra);
  const van1 = G(s1); vanSVG(van1, avatar).setAttribute('transform', 'scale(3)');
  const dust1 = G(s1); const puffs = Array.from({ length: 10 }, () => E('circle', { r: 14, fill: C.sand }, dust1));
  const speed1 = G(s1); Array.from({ length: 9 }, (_, i) => E('path', { d: 'M0,0 H-160', stroke: C.navy, 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.5, transform: `translate(0 ${-150 + i * 18})` }, speed1));

  /* 2 Reise über die Karte */
  const s2 = G(svg, { 'clip-path': 'url(#iris)' });
  E('rect', { width: 1600, height: 1000, fill: C.ocean }, s2);
  const cam = G(s2);
  G(cam).innerHTML = terrainSVG(cfg.map.land);
  G(cam).innerHTML = motifs;
  const d = smoothPath(road.path);
  E('path', { d, fill: 'none', stroke: '#7D6A52', 'stroke-width': 3, 'stroke-dasharray': '2 10', 'stroke-linecap': 'round' }, cam);
  const ink = E('path', { d, fill: 'none', stroke: C.navy, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, cam);
  const RL = ink.getTotalLength();
  ink.setAttribute('stroke-dasharray', `${RL} ${RL + 10}`);
  const LBL = { below: [0, 34, 'middle'], above: [0, -24, 'middle'], left: [-22, 8, 'end'], right: [22, 8, 'start'] };
  let from = 0;
  const stops = road.stops.map((id) => {
    const t = T[id];
    let best = Infinity, bl = from;
    for (let l = from; l <= RL; l += 2) {
      const p = ink.getPointAtLength(l), dd = Math.hypot(p.x - t.x, p.y - t.y);
      if (dd < best) { best = dd; bl = l; }
      if (dd < 1.5) break;
    }
    from = bl + 5;
    const g = G(cam, { transform: `translate(${t.x} ${t.y})` });
    const dot = G(g);
    E('circle', { r: 14, fill: C.navy, stroke: C.paper, 'stroke-width': 3 }, dot);
    txt(dot, id === 'START' ? '★' : id === 'TEST' ? '✓' : String(t.number), 0, 5, 14, C.paper, { font: BODY, bold: true });
    const [dx, dy, anchor] = LBL[t.label] || LBL.below;
    const lab = txt(g, t.place, dx, dy, 24, C.navy, { anchor });
    lab.setAttribute('style', lab.getAttribute('style') + `paint-order:stroke;stroke:${C.paper};stroke-width:5px;stroke-linejoin:round;`);
    return { id, t, len: bl, g, dot, lab };
  });
  const van2 = G(cam); vanSVG(van2, avatar);
  const stk = G(s2);
  const stickers = {
    jelly: sticker(stk, 'jelly', 'Jellyfish', motifs), shark: sticker(stk, 'shark', 'Shark', motifs),
    roo: sticker(stk, 'roo', 'Kangaroo', motifs), croc: sticker(stk, 'croc', 'Crocodile', motifs), koala: sticker(stk, 'koala', 'Koala', motifs),
  };
  const h2 = headline(s2, 70, 110, 'Travel across Australia', '(Reise durch Australien)', 66);
  // Plakette, damit die Überschrift auf der Karte lesbar bleibt
  h2.g.insertBefore(E('rect', { x: -30, y: -70, width: 680, height: 128, rx: 22, fill: C.paper, opacity: 0.9 }), h2.g.firstChild);

  /* 3 Aufgabe mit dem KI-Coach */
  const s3 = G(svg);
  const s3c = G(s3, { 'clip-path': 'url(#wipe3)' });
  E('rect', { width: 1600, height: 1000, fill: C.cream }, s3c);
  const h3 = headline(s3c, 110, 300, 'Solve tasks', null, 104);
  const h3b = headline(s3c, 110, 410, 'with your AI coach', '(Löse Aufgaben mit deinem KI-Coach)', 76);
  const sheet = G(s3c);
  sheet.innerHTML = `<g transform="rotate(-6)"><rect x="-150" y="-190" width="300" height="380" rx="8" fill="${C.paper}" stroke="${C.line}" stroke-width="3"/>
    <text x="-120" y="-140" font-size="34" fill="${C.navy}" style="font-family:${HAND}">Worksheet</text>
    <rect x="58" y="-168" width="62" height="26" rx="6" fill="${C.gold}" opacity=".85"/>
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M-120,${-90 + i * 56} H120" stroke="${C.line}" stroke-width="3"/><path d="M-120,${-104 + i * 56} H${-10 + (i % 3) * 30}" stroke="${C.muted}" stroke-width="5" stroke-linecap="round" opacity=".55"/>
      <rect x="${30 + (i % 2) * 20}" y="${-118 + i * 56}" width="70" height="22" rx="4" fill="none" stroke="${C.teal}" stroke-width="3" stroke-dasharray="6 5"/>`).join('')}</g>`;
  const pad = G(s3c);
  E('rect', { x: -290, y: -390, width: 580, height: 780, rx: 50, fill: C.navy }, pad);
  E('rect', { x: -266, y: -366, width: 532, height: 732, rx: 30, fill: C.paper }, pad);
  E('circle', { cx: 0, cy: -378, r: 4, fill: '#3A4A78' }, pad);
  const coachH = coachSVG(G(pad, { transform: 'translate(-200 -300)' }), 34);
  txt(pad, 'Past Coach', -150, -308, 30, C.navy, { anchor: 'start', font: BODY, bold: true });
  txt(pad, 'your AI travel coach', -150, -278, 20, C.muted, { anchor: 'start', font: BODY });
  E('path', { d: 'M-266,-246 H266', stroke: C.line, 'stroke-width': 3 }, pad);
  const kid = G(pad); // Foto-Nachricht des Kindes
  kid.innerHTML = `<rect x="-10" y="-80" width="250" height="170" rx="20" fill="${C.navy}"/>
    <rect x="10" y="-62" width="140" height="134" rx="6" fill="${C.paper}" transform="rotate(-4 80 5)"/>
    ${[0, 1, 2, 3].map((i) => `<path d="M26,${-34 + i * 28} H130" stroke="${C.muted}" stroke-width="5" stroke-linecap="round" opacity=".5" transform="rotate(-4 80 5)"/>`).join('')}
    <circle cx="200" cy="-40" r="18" fill="${C.paper}" opacity=".9"/><rect x="190" y="-48" width="20" height="15" rx="3" fill="${C.navy}"/><circle cx="200" cy="-40" r="4" fill="${C.paper}"/>`;
  const typing = G(pad);
  E('rect', { x: 0, y: -30, width: 120, height: 60, rx: 26, fill: C.tealL }, typing);
  const dots = [0, 1, 2].map((i) => E('circle', { cx: 32 + i * 28, cy: 0, r: 8, fill: C.teal }, typing));
  const b1 = G(pad);
  E('rect', { x: 0, y: -34, width: 410, height: 68, rx: 22, fill: C.tealL }, b1);
  txt(b1, 'Nice work! 3 of 4 correct.', 22, 9, 25, C.navy, { anchor: 'start', font: BODY, bold: true });
  const b2 = G(pad);
  E('rect', { x: 0, y: -50, width: 410, height: 100, rx: 22, fill: C.tealL }, b2);
  txt(b2, 'Tip: in questions use', 22, -8, 24, C.navy, { anchor: 'start', font: BODY });
  txt(b2, 'did + verb: “Did you see …?”', 22, 26, 24, C.terraInk, { anchor: 'start', font: BODY, bold: true });
  [b1, b2, typing].forEach((b) => coachSVG(G(b, { transform: 'translate(-40 0)' }), 22));
  const btn = G(pad);
  E('rect', { x: -170, y: -36, width: 340, height: 72, rx: 36, fill: C.terra, stroke: C.navy, 'stroke-width': 3 }, btn);
  E('polygon', { points: star(18), fill: C.gold, transform: 'translate(-120 0)' }, btn);
  txt(btn, 'Get your stamp', 16, 10, 30, C.paper, { font: BODY, bold: true });
  const tap = E('circle', { r: 30, fill: 'none', stroke: C.navy, 'stroke-width': 5 }, pad);
  const flash = E('rect', { x: -266, y: -366, width: 532, height: 732, rx: 30, fill: '#fff', opacity: 0 }, pad);
  const stamp3 = G(pad);
  E('image', { href: T.SP?.stamp?.image || T.START.stamp.image, x: -150, y: -150, width: 300, height: 300 }, stamp3);
  const stars3 = [0, 1, 2].map(() => { const s = G(pad); E('polygon', { points: star(36), fill: C.gold, stroke: C.navy, 'stroke-width': 4, 'stroke-linejoin': 'round' }, s); return s; });

  /* 4 Pass → Klassenauswertung */
  const s4 = G(svg);
  E('rect', { width: 1600, height: 1000, fill: C.cream }, s4);
  const h4 = headline(s4, 800, 170, 'See your strengths', '(Sieh deine Stärken)', 84, 'middle');
  const h4b = headline(s4, 90, 150, 'Your teacher sees what the class needs', '(Deine Lehrkraft sieht, was die Klasse braucht)', 64);
  const grid = G(s4);
  const cells = Array.from({ length: 29 }, (_, i) => {
    const c = i % 6, r = Math.floor(i / 6);
    const g = G(grid);
    g.innerHTML = `<rect x="-40" y="-30" width="80" height="60" rx="8" fill="${C.navy}"/><rect x="-34" y="-24" width="68" height="48" rx="4" fill="${C.paper}"/>
      ${[0, 1, 2].map((j) => `<polygon points="${star(9)}" transform="translate(${-20 + j * 20} 6)" fill="${j < 1 + ((i * 7) % 3) ? C.gold : 'none'}" stroke="${C.navy}" stroke-width="1.5"/>`).join('')}
      <circle cx="-22" cy="-12" r="5" fill="${[C.terra, C.teal, C.sky, C.sage][i % 4]}"/>`;
    return { g, x: 150 + c * 108, y: 330 + r * 118 };
  });
  const pass = G(s4);
  E('rect', { x: -460, y: -290, width: 920, height: 580, rx: 26, fill: C.navy }, pass);
  E('rect', { x: -440, y: -272, width: 436, height: 544, rx: 10, fill: C.paper }, pass);
  E('rect', { x: 4, y: -272, width: 436, height: 544, rx: 10, fill: C.paper }, pass);
  E('path', { d: 'M0,-272 V272', stroke: C.line, 'stroke-width': 4 }, pass);
  txt(pass, 'My Passport', -222, -190, 62, C.navy);
  const av = G(pass, { transform: 'translate(-222 -20)' });
  E('circle', { r: 92, fill: C.cream, stroke: C.navy, 'stroke-width': 5 }, av);
  E('image', { href: avatar, x: -84, y: -84, width: 168, height: 168, 'clip-path': 'url(#avP)', preserveAspectRatio: 'xMidYMid slice' }, av);
  txt(pass, 'Australia Road Trip', -222, 140, 26, C.muted, { font: BODY, bold: true });
  const pStamps = ['START', 'SPR', 'SP'].map((id, i) => { const g = G(pass); E('image', { href: T[id].stamp.image, x: -70, y: -70, width: 140, height: 140 }, g); g.dataset.x = 92 + i * 128; return g; });
  const skills = [['Simple present', 3], ['Simple past', 2], ['Present perfect', 1]].map(([name, n], i) => {
    const y = 60 + i * 70;
    txt(pass, name, 40, y + 9, 26, C.navy, { anchor: 'start', font: BODY, bold: true });
    return [0, 1, 2].map((j) => {
      const g = G(pass, { transform: `translate(${300 + j * 42} ${y})` });
      E('polygon', { points: star(17), fill: 'none', stroke: C.navy, 'stroke-width': 2.5 }, g);
      const f = E('polygon', { points: star(17), fill: C.gold, stroke: C.navy, 'stroke-width': 2.5 }, g);
      return { f, on: j < n };
    });
  });
  const tip = G(pass, { transform: 'translate(40 250)' });
  txt(tip, 'Next: practise present perfect', 0, 0, 22, C.terraInk, { anchor: 'start', font: BODY, bold: true });
  const flow = G(s4); const flowDots = Array.from({ length: 16 }, (_, i) => E('circle', { r: 7, fill: [C.terra, C.teal, C.gold][i % 3] }, flow));
  const dash = G(s4, { transform: 'translate(1140 590)' });
  E('rect', { x: -350, y: -330, width: 700, height: 660, rx: 26, fill: C.navy, opacity: 0.12, transform: 'translate(8 10)' }, dash);
  E('rect', { x: -350, y: -330, width: 700, height: 660, rx: 26, fill: C.paper, stroke: C.line, 'stroke-width': 3 }, dash);
  txt(dash, 'Class overview', -310, -260, 56, C.navy, { anchor: 'start' });
  txt(dash, '(Klassenüberblick)', -310, -226, 22, C.muted, { anchor: 'start', font: BODY });
  E('rect', { x: 90, y: -268, width: 22, height: 14, rx: 3, fill: C.skyL, stroke: C.sky }, dash); txt(dash, 'Check-in', 120, -256, 18, C.muted, { anchor: 'start', font: BODY });
  E('rect', { x: 210, y: -268, width: 22, height: 14, rx: 3, fill: C.navy }, dash); txt(dash, 'Now', 240, -256, 18, C.muted, { anchor: 'start', font: BODY });
  const bars = [['Simple present', 150, 330], ['Simple past', 110, 290], ['Present perfect', 40, 170]].map(([name, w0, w1], i) => {
    const y = -160 + i * 78;
    txt(dash, name, -310, y + 14, 24, C.navy, { anchor: 'start', font: BODY, bold: true });
    E('rect', { x: -60, y: y - 6, width: w0, height: 16, rx: 8, fill: C.skyL, stroke: C.sky, 'stroke-width': 1.5 }, dash);
    const now = E('rect', { x: -60, y: y + 16, width: 0, height: 16, rx: 8, fill: C.navy }, dash);
    const arrow = txt(dash, '▲', -40, y + 30, 20, C.sage, { anchor: 'start', font: BODY });
    return { now, w1, arrow };
  });
  txt(dash, 'Error areas', -310, 110, 40, C.navy, { anchor: 'start' });
  txt(dash, '(Fehlerbereiche)', -140, 110, 20, C.muted, { anchor: 'start', font: BODY });
  const chips = [['since / for', C.terra, C.paper, 190], ['did + verb', C.terraL, C.terraInk, 170], ['irregular verbs', '#F3E3C6', C.muted, 200]].map(([s, bg, fg, w], i) => {
    const pos = `translate(${-310 + [0, 205, 390][i] + w / 2} 160)`;
    const g = G(dash, { transform: pos });
    E('rect', { x: -w / 2, y: -24, width: w, height: 48, rx: 24, fill: bg, stroke: C.navy, 'stroke-width': 2 }, g);
    txt(g, s, 0, 8, 22, fg, { font: BODY, bold: true });
    return { g, pos };
  });
  const ai = G(dash, { transform: 'translate(-280 250)' });
  coachSVG(ai, 26);
  const aiClip = `aic${++uid}`;
  const aiRect = E('rect', { x: 40, y: -30, width: 0, height: 60 });
  E('clipPath', { id: aiClip }, ai).appendChild(aiRect);
  const aiTxt = G(ai, { 'clip-path': `url(#${aiClip})` });
  txt(aiTxt, 'AI summary: practise since / for tomorrow.', 46, 9, 24, C.navy, { anchor: 'start', font: BODY, bold: true });

  /* 5 Finale */
  const s5 = G(svg);
  E('rect', { width: 1600, height: 1000, fill: C.cream }, s5);
  const ghost = G(s5, { transform: 'translate(300 120)', opacity: 0.18 });
  cfg.map.land.forEach((p) => E('path', { d: p, fill: C.sand, stroke: C.terra, 'stroke-width': 4, 'stroke-linejoin': 'round' }, ghost));
  E('path', { d, fill: 'none', stroke: C.navy, 'stroke-width': 6, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round' }, ghost);
  const brush5 = E('path', { d: 'M420,470 q380,-50 770,-6', fill: 'none', stroke: C.sky, 'stroke-width': 60, 'stroke-linecap': 'round', opacity: 0.6, pathLength: 1, 'stroke-dasharray': 1, 'stroke-dashoffset': 1 }, s5);
  const L5 = letters(G(s5), 'Your trip starts now!', 800, 470, 140, C.navy);
  const de5 = txt(s5, '(Deine Reise beginnt jetzt!)', 800, 545, 32, C.muted, { font: BODY });
  const stk5 = G(s5);
  const fin = {
    roo: sticker(stk5, 'roo', 'Kangaroo', motifs), koala: sticker(stk5, 'koala', 'Koala', motifs), croc: sticker(stk5, 'croc', 'Crocodile', motifs),
    shark: sticker(stk5, 'shark', 'Shark', motifs), jelly: sticker(stk5, 'jelly', 'Jellyfish', motifs),
  };
  const coach5 = coachSVG(G(s5), 46);
  const van5 = G(s5); vanSVG(van5, avatar).setAttribute('transform', 'scale(2.2)');

  E('rect', { width: 1600, height: 1000, filter: 'url(#grain)', 'pointer-events': 'none' }, svg);
  E('rect', { width: 1600, height: 1000, fill: 'url(#vig)', 'pointer-events': 'none' }, svg);

  // Wann erreicht das Mobil welche Station?
  const vanLen = (t) => RL * mix(k(t, 3.5, 5.7), io(k(t, 3.5, 5.7)), 0.55);
  stops.forEach((s) => { let t = 3.5; while (t < 9.3 && vanLen(t) < s.len - 1) t += 0.01; s.at = t; });

  R = { s1, sun, rays, road1, brush1, kick, L1, L2, van1, puffs, speed1, s2, cam, ink, RL, stops, van2, stickers, h2, vanLen,
    s3, h3, h3b, sheet, pad, coachH, kid, typing, dots, b1, b2, btn, tap, flash, stamp3, stars3,
    s4, h4, h4b, cells, pass, pStamps, skills, tip, flowDots, dash, bars, chips, ai, aiRect,
    s5, brush5, L5, de5, fin, coach5, van5 };
}

/* ---------- Bild zu Zeitpunkt t ---------- */
const stopAt = (id) => R.stops.find((s) => s.id === id)?.at ?? 99;

function render(t) {
  /* 1 Aufbruch (0–3,3 s) */
  show(R.s1, t < 3.4);
  if (t < 3.4) {
    tf(R.sun, 800, 420, 0.6 + 0.4 * out(k(t, 0, 1)) + Math.sin(t * 2) * 0.02);
    R.rays.setAttribute('transform', `rotate(${(t * 20).toFixed(1)})`);
    op(R.sun, k(t, 0, 0.6));
    R.brush1.setAttribute('stroke-dashoffset', (1 - out(k(t, 0.5, 0.6))).toFixed(3));
    op(R.kick, k(t, 0.15, 0.4) * (1 - k(t, 2.5, 0.3)));
    R.kick.setAttribute('transform', `translate(0 ${((1 - out(k(t, 0.15, 0.5))) * -20).toFixed(1)})`);
    [...R.L1, ...R.L2].forEach((l, i) => {
      const a = 0.3 + i * 0.05, p = k(t, a, 0.5), e = back(p);
      const exit = io(k(t, 2.45 + i * 0.015, 0.4));
      tf(l.g, l.x, l.y - (1 - e) * 220 - exit * 600, 1 + (1 - p) * 0.6, (1 - e) * -25 + exit * 20 * (i % 2 ? 1 : -1));
      op(l.g, Math.min(p * 3, 1) * (1 - exit));
    });
    // Mobil fährt rein, bremst, wackelt, rast los
    const vin = out(k(t, 0.2, 1.0)), vgo = Math.pow(k(t, 2.1, 0.9), 2.2);
    const vx = mix(-250, 800, vin) + vgo * 1200, vy = 790 - Math.abs(Math.sin(t * 14)) * 3 * (1 - k(t, 1.2, 0.3) + vgo);
    tf(R.van1, vx, vy, 1, (k(t, 1.15, 0.12) - k(t, 1.3, 0.25)) * -4 + vgo * -3);
    R.puffs.forEach((p, i) => {
      const age = ((t * 6 + i) % 10) / 10, moving = t < 1.3 || t > 2.1;
      p.setAttribute('cx', (vx - 90 - age * 140).toFixed(1)); p.setAttribute('cy', (vy - 10 - age * 40).toFixed(1));
      p.setAttribute('r', (8 + age * 26).toFixed(1)); op(p, moving ? (1 - age) * 0.55 : 0);
    });
    op(R.speed1, k(t, 2.2, 0.2)); tf(R.speed1, vx - 120, vy - 30);
    op(R.road1, k(t, 0, 0.5));
  }

  /* 2 Reise (Iris öffnet sich ab 2,7 s) */
  show(R.s2, t > 2.6 && t < 10.5);
  if (t > 2.6 && t < 10.5) {
    $('#irisC').setAttribute('r', (io(k(t, 2.7, 0.65)) * 1900).toFixed(1));
    const len = R.vanLen(t);
    R.ink.setAttribute('stroke-dashoffset', (R.RL - len).toFixed(1));
    const p = R.ink.getPointAtLength(len), p2 = R.ink.getPointAtLength(Math.min(R.RL, len + 2));
    const dir = p2.x - p.x < -0.2 ? -1 : 1;
    R.van2.setAttribute('transform', `${TF(p.x, p.y - Math.abs(Math.sin(t * 16)) * 1.2)} scale(${dir} 1)`);
    R.stops.forEach((s) => {
      const v = pop(t, s.at, 0.5);
      tf(s.dot, 0, 0, t < s.at ? 0.6 : v + Math.max(0, 0.6 * (1 - k(t, s.at, 0.5))));
      op(s.dot, t < s.at ? 0.45 : 1); op(s.lab, k(t, s.at, 0.3));
    });
    // Kamera: Überblick → folgt dem Mobil → taucht in die letzte Station
    const b = io(k(t, 3.2, 0.9)), e = io(k(t, 9.35, 0.85));
    const last = R.stops[R.stops.length - 1].t;
    let cx = mix(500, p.x, b), cy = mix(415, p.y, b), z = mix(1.15, 2.05, b);
    cx = mix(cx, last.x, e); cy = mix(cy, last.y, e); z = mix(z, 9, Math.pow(e, 1.6));
    const punch = R.stops.reduce((a, s) => a + (t > s.at ? 0.06 * Math.exp(-(t - s.at) * 7) : 0), 0);
    R.cam.setAttribute('transform', `translate(800 520) scale(${(z * (1 + punch)).toFixed(4)}) translate(${(-cx).toFixed(1)} ${(-cy).toFixed(1)})`);
    const S = R.stickers;
    stickerAt(S.jelly, t, 1330, 330, stopAt('SPR') + 0.05, stopAt('SPR') + 1.6, 0.95);
    stickerAt(S.shark, t, 280, 640, stopAt('SP') + 0.05, stopAt('SP') + 1.6, 0.95);
    stickerAt(S.roo, t, 1320, 640, stopAt('PP') + 0.05, stopAt('PP') + 1.6, 0.95);
    stickerAt(S.croc, t, 290, 330, stopAt('SPPP') + 0.05, stopAt('SPPP') + 1.7, 0.95);
    stickerAt(S.koala, t, 1310, 360, stopAt('GOING') + 0.05, Math.min(10.0, stopAt('GOING') + 1.6), 0.95);
    headlineAt(R.h2, t, 3.3, 9.4);
  }

  /* 3 KI-Coach (Kreis wischt ab 10,0 s auf; ab 14,6 s nach links geschoben) */
  show(R.s3, t > 9.9 && t < 15.2);
  if (t > 9.9 && t < 15.2) {
    $('#wipe3C').setAttribute('r', (io(k(t, 9.95, 0.5)) * 1500).toFixed(1));
    const push = io(k(t, 14.6, 0.5));
    const shake = t > 13.75 ? Math.exp(-(t - 13.75) * 12) * 10 : 0;
    R.s3.setAttribute('transform', `translate(${(-push * 1600 + Math.sin(t * 90) * shake).toFixed(1)} ${(Math.cos(t * 80) * shake).toFixed(1)})`);
    headlineAt(R.h3, t, 10.35, 99); headlineAt(R.h3b, t, 10.55, 99);
    const pin = back(k(t, 10.2, 0.6));
    tf(R.pad, 1150, 540 + (1 - pin) * 700, 1, (1 - pin) * 8);
    // Arbeitsblatt → Foto → Nachricht
    const sIn = back(k(t, 10.7, 0.5)), sFly = io(k(t, 11.15, 0.4));
    tf(R.sheet, mix(mix(-200, 420, sIn), 1250, sFly), mix(760, 330, sFly), mix(0.75, 0.25, sFly), mix(-8, 0, sFly) + (1 - sIn) * -20);
    op(R.sheet, 1 - k(t, 11.4, 0.15));
    op(R.flash, Math.max(0, 1 - Math.abs(t - 11.15) / 0.12) * 0.9);
    const kv = pop(t, 11.4, 0.4);
    R.kid.setAttribute('transform', `translate(240 -160) scale(${kv.toFixed(3)}) translate(-240 0)`); op(R.kid, k(t, 11.4, 0.1));
    const ty = life(t, 11.7, 12.3, 0.15, 0.1);
    op(R.typing, ty); tf(R.typing, -160, 0, 0.5 + 0.5 * Math.min(1, ty * 2));
    R.dots.forEach((d, i) => d.setAttribute('cy', (-Math.max(0, Math.sin(t * 12 - i * 0.8)) * 8).toFixed(1)));
    [[R.b1, 12.3, 0], [R.b2, 12.75, 90]].forEach(([b, a, y]) => {
      b.setAttribute('transform', `translate(-160 ${y}) scale(${pop(t, a, 0.4).toFixed(3)})`); op(b, k(t, a, 0.1));
    });
    const bv = pop(t, 13.15, 0.4);
    R.btn.setAttribute('transform', `translate(0 250) scale(${(bv * (1 - 0.08 * Math.max(0, 1 - Math.abs(t - 13.55) / 0.08))).toFixed(3)})`);
    op(R.btn, k(t, 13.15, 0.1) * (1 - k(t, 13.7, 0.2)));
    const tv = k(t, 13.45, 0.35);
    R.tap.setAttribute('cx', 60); R.tap.setAttribute('cy', 260); R.tap.setAttribute('r', (16 + tv * 60).toFixed(1)); op(R.tap, t > 13.45 ? 1 - tv : 0);
    coachAt(R.coachH, t);
    // Stempel kracht auf den Bildschirm, Sterne ploppen
    const st = k(t, 13.7, 0.22);
    tf(R.stamp3, 20, 40, mix(2.6, 1, out(st)), mix(-40, -12, out(st))); op(R.stamp3, st > 0 ? Math.min(1, st * 3) : 0);
    R.stars3.forEach((s, i) => { const v = pop(t, 13.95 + i * 0.12, 0.4); tf(s, -90 + i * 90, 250 - (i === 1 ? 14 : 0), v, (1 - v) * 90); op(s, k(t, 13.95 + i * 0.12, 0.05)); });
  }

  /* 4 Pass → Klasse (15,0–20,2 s) */
  show(R.s4, t > 14.55 && t < 20.3);
  if (t > 14.55 && t < 20.3) {
    const push = io(k(t, 14.6, 0.5)), fade = io(k(t, 19.75, 0.45));
    R.s4.setAttribute('transform', `translate(${((1 - push) * 1600).toFixed(1)} 0) translate(800 500) scale(${(1 - fade * 0.12).toFixed(3)}) translate(-800 -500)`);
    op(R.s4, 1 - fade);
    headlineAt(R.h4, t, 15.0, 17.4);
    headlineAt(R.h4b, t, 17.75, 99);
    // Pass: Stempel und Sterne, dann schrumpft er in die Klassenübersicht
    const shrink = io(k(t, 17.35, 0.6));
    const cell = R.cells[14];
    tf(R.pass, mix(800, cell.x, shrink), mix(560, cell.y, shrink), mix(1, 0.087, shrink));
    op(R.pass, 1 - k(t, 17.85, 0.15));
    R.pStamps.forEach((g, i) => { const a = 15.35 + i * 0.28, v = k(t, a, 0.2); tf(g, +g.dataset.x, -150 + (i % 2) * 14, mix(2.4, 1, out(v)), mix(-40, i % 2 ? 8 : -10, out(v))); op(g, Math.min(1, v * 3)); });
    R.skills.forEach((row, i) => row.forEach((s, j) => {
      const a = 16.25 + i * 0.22 + j * 0.07, v = s.on ? pop(t, a, 0.35) : 0;
      s.f.setAttribute('transform', `scale(${Math.max(0.0001, v).toFixed(3)})`); op(s.f, s.on ? k(t, a, 0.05) : 0);
    }));
    op(R.tip, k(t, 16.95, 0.25));
    R.cells.forEach((c, i) => { const a = 17.6 + ((i * 11) % 29) * 0.012, v = pop(t, a, 0.35); tf(c.g, c.x, c.y, v * (1 + 0.05 * Math.sin(t * 3 + i)), (1 - v) * 30); op(c.g, k(t, a, 0.05)); });
    // Daten fließen von den Pässen ins Dashboard
    R.flowDots.forEach((dd, i) => {
      const p = io(k(t, 18.0 + i * 0.04, 0.55)), c = R.cells[(i * 5) % 29];
      dd.setAttribute('cx', mix(c.x, 860, p).toFixed(1)); dd.setAttribute('cy', (mix(c.y, 420 + (i % 4) * 80, p) - Math.sin(p * Math.PI) * 160).toFixed(1));
      op(dd, p > 0 && p < 1 ? 1 : 0);
    });
    const dv = back(k(t, 17.75, 0.55));
    tf(R.dash, 1140 + (1 - dv) * 900, 590, 1, (1 - dv) * 10);
    R.bars.forEach((b, i) => {
      const v = out(k(t, 18.3 + i * 0.15, 0.6));
      b.now.setAttribute('width', (b.w1 * v).toFixed(1)); b.arrow.setAttribute('x', (-50 + b.w1 * v).toFixed(1)); op(b.arrow, k(t, 18.8 + i * 0.15, 0.2));
    });
    R.chips.forEach((c, i) => c.g.setAttribute('transform', `${c.pos} scale(${Math.max(0.0001, pop(t, 18.85 + i * 0.12, 0.35)).toFixed(3)})`));
    op(R.ai, k(t, 19.15, 0.15));
    R.aiRect.setAttribute('width', (out(k(t, 19.2, 0.5)) * 560).toFixed(1));
  }

  /* 5 Finale (ab 19,8 s) */
  show(R.s5, t > 19.75);
  if (t > 19.75) {
    const fi = io(k(t, 19.8, 0.45));
    op(R.s5, fi);
    R.s5.setAttribute('transform', `translate(800 500) scale(${(1.08 - 0.08 * fi).toFixed(4)}) translate(-800 -500)`);
    R.brush5.setAttribute('stroke-dashoffset', (1 - out(k(t, 20.2, 0.5))).toFixed(3));
    R.L5.forEach((l, i) => { const a = 20.05 + i * 0.03, p = k(t, a, 0.45), e = back(p); tf(l.g, l.x, l.y - (1 - e) * 140 + Math.sin(t * 3 + i * 0.5) * 2, 1 + (1 - p) * 0.8, (1 - e) * 20); op(l.g, Math.min(1, p * 3)); });
    op(R.de5, k(t, 20.55, 0.3));
    const F = R.fin;
    stickerAt(F.roo, t, 210, 250, 20.4, Infinity, 0.82);
    stickerAt(F.koala, t, 1390, 250, 20.52, Infinity, 0.82);
    stickerAt(F.croc, t, 230, 720, 20.64, Infinity, 0.82);
    stickerAt(F.shark, t, 1370, 720, 20.76, Infinity, 0.82);
    stickerAt(F.jelly, t, 1120, 175, 20.88, Infinity, 0.6);
    const cv = pop(t, 21.0, 0.5);
    tf(R.coach5.g, 480, 180 + Math.sin(t * 2.2) * 8, cv * 1.1, (1 - cv) * -40 + Math.sin(t * 1.7) * 6); coachAt(R.coach5, t);
    tf(R.van5, mix(-200, 800, out(k(t, 20.3, 1.1))), 700 - Math.abs(Math.sin(t * 9)) * 2);
  }
}

/* ---------- Ablauf ---------- */
let t0 = 0, endShown = false;
function loop(now) {
  const t = Number.isFinite(FREEZE) ? FREEZE : REDUCE ? END + 1 : (now - t0) / 1000;
  render(t);
  if (t > END && !endShown) {
    endShown = true;
    $('#end').classList.add('on');
    $('#skip').hidden = true;
    $('#tomap').focus({ preventScroll: true });
  }
  requestAnimationFrame(loop);
}
function play() { endShown = false; $('#end').classList.remove('on'); $('#skip').hidden = false; t0 = performance.now(); }

async function main() {
  const cfg = await loadConfig();
  await Promise.all(['400 100px "Caveat Brush"', '700 20px "Atkinson Hyperlegible"', '400 20px "Atkinson Hyperlegible"']
    .map((f) => document.fonts.load(f).catch(() => {})));
  build(cfg);
  $('#tomap').href = 'index.html' + location.search.replace(/[?&]t=[^&]*/, '').replace(/^&/, '?');
  $('#again').addEventListener('click', play);
  const skip = () => { t0 = performance.now() - END * 1000; };
  $('#skip').addEventListener('click', skip);
  addEventListener('keydown', (e) => { if (e.key === 'Escape') skip(); });
  if (REDUCE) $('#skip').hidden = true;
  play();
  requestAnimationFrame(loop);
}

main();
