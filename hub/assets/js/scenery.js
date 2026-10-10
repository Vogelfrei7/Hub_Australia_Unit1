// Landschaft und Motive der Karte (viewBox 1000×800). Rein dekorativ: liegt unter Routen und Stationen.
// Jedes Motiv gehört zu einer Station ("wake") und wird erst farbig, wenn dort der erste Stempel da ist.
// Positionen sind so gewählt, dass sie keine Station, Beschriftung oder Route überdecken.

const MOTIFS = [
  { id: 'uluru', wake: 'WRITE', x: 600, y: 505, svg: () => `
    <ellipse cx="2" cy="1" rx="62" ry="6" fill="#D9A066" opacity=".6"/>
    <path d="M-56,0 C-52,-14 -40,-31 -16,-34 C8,-37 32,-33 44,-23 C52,-15 56,-7 59,0 Z" fill="#C4552E"/>
    <path d="M-30,-29 Q-33,-14 -28,0 M-6,-35 Q-9,-17 -4,0 M20,-33 Q17,-16 22,0 M40,-24 Q38,-12 42,0" fill="none" stroke="#9C3D1D" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>` },
  { id: 'kata', wake: 'ARG', x: 355, y: 528, svg: () => `
    <ellipse cx="2" cy="1" rx="48" ry="5" fill="#D9A066" opacity=".6"/>
    <path d="M-44,0 Q-42,-24 -26,-26 Q-12,-27 -9,-12 Q-4,-34 12,-32 Q27,-30 26,-12 Q32,-22 40,-16 Q47,-9 47,0 Z" fill="#C8673A"/>` },
  { id: 'roo', wake: 'PP', x: 598, y: 338, anim: 'hop', svg: () => `
    <ellipse cx="2" cy="1" rx="22" ry="3.5" fill="#B9763F" opacity=".35"/>
    <path d="M-34,-2 Q-20,-5 -11,-15 Q-16,-31 -5,-40 Q1,-46 5,-50 L2,-60 L9,-53 L11,-61 L14,-52 Q21,-50 24,-46 Q20,-42 13,-43 Q10,-38 10,-33 L19,-29 L18,-26 L9,-28 Q11,-18 6,-10 Q11,-4 23,-3 L23,0 L-6,0 Q-14,-4 -34,-2 Z" fill="#8A5A2E"/>
    <circle cx="13" cy="-48" r="1.6" fill="#2A1A0E"/>` },
  { id: 'croc', wake: 'SPPP', x: 572, y: 186, svg: () => `
    <path d="M-38,0 Q-30,-8 -14,-8 L18,-9 Q30,-9 40,-4 L40,0 Q30,-2 20,1 L-14,2 Q-28,3 -38,0 Z" fill="#5E7F3E"/>
    <path d="M-10,-8 l3,-4 l3,4 M0,-8 l3,-4 l3,4 M10,-9 l3,-4 l3,4" fill="#4A6830"/>
    <path d="M-8,2 l-3,6 M14,2 l3,6" stroke="#4A6830" stroke-width="4" stroke-linecap="round"/>
    <circle cx="30" cy="-7" r="1.6" fill="#1E2A12"/>` },
  { id: 'reef', wake: 'SP', x: 0, y: 0, svg: () => [[814, 150, 62], [834, 196, 66], [858, 236, 58], [913, 330, 66], [936, 372, 72]]
      .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="15" ry="6" transform="rotate(${r} ${x} ${y})" fill="#5CC4BC" opacity=".75"/>
        <circle cx="${x + 4}" cy="${y - 3}" r="2.6" fill="#EE8466"/><circle cx="${x - 4}" cy="${y + 4}" r="2" fill="#F4C04E"/>`).join('') },
  { id: 'turtle', wake: 'SP', x: 960, y: 222, anim: 'drift', svg: () => `
    <ellipse cx="-12" cy="-9" rx="6" ry="3" transform="rotate(-35 -12 -9)" fill="#6FA071"/><ellipse cx="12" cy="-9" rx="6" ry="3" transform="rotate(35 12 -9)" fill="#6FA071"/>
    <ellipse cx="-11" cy="9" rx="5" ry="2.6" transform="rotate(30 -11 9)" fill="#6FA071"/><ellipse cx="11" cy="9" rx="5" ry="2.6" transform="rotate(-30 11 9)" fill="#6FA071"/>
    <circle cx="0" cy="-16" r="5" fill="#6FA071"/>
    <ellipse cx="0" cy="0" rx="11" ry="14" fill="#3E7A4E"/>
    <path d="M0,-12 V12 M-9,-4 L9,4 M-9,4 L9,-4" stroke="#2D5C39" stroke-width="1.6" opacity=".7"/>` },
  { id: 'surf', wake: 'SPR', x: 966, y: 500, svg: () => `
    <ellipse cx="0" cy="-22" rx="7" ry="27" transform="rotate(12 0 -22)" fill="#F2B33D"/>
    <path d="M-2,-48 Q8,-22 3,4" fill="none" stroke="#E2553A" stroke-width="3" transform="rotate(12 0 -22)"/>
    <path d="M-24,6 Q-12,-6 0,4 Q12,-6 24,6" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".9"/>` },
  { id: 'opera', wake: 'START', x: 934, y: 622, svg: () => `
    <rect x="-28" y="-4" width="56" height="7" rx="2" fill="#D8C7A8"/>
    <path d="M-24,-4 Q-20,-24 -6,-30 Q-10,-16 -8,-4 Z M-8,-4 Q-4,-30 12,-36 Q6,-18 8,-4 Z M8,-4 Q12,-22 24,-26 Q20,-14 22,-4 Z" fill="#FFFFFF" stroke="#9AA6B4" stroke-width="1.4" stroke-linejoin="round"/>` },
  { id: 'koala', wake: 'TEST', x: 704, y: 640, svg: () => `
    <path d="M10,8 L12,-44" stroke="#8B6B4A" stroke-width="6" stroke-linecap="round"/>
    <path d="M12,-40 Q24,-48 30,-44 M11,-26 Q-2,-34 -8,-30" fill="none" stroke="#8B6B4A" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="22" cy="-47" rx="7" ry="3" fill="#7FA35A"/><ellipse cx="-6" cy="-32" rx="7" ry="3" fill="#7FA35A"/>
    <ellipse cx="2" cy="-12" rx="11" ry="13" fill="#9A9A9F"/>
    <circle cx="-8" cy="-27" r="6" fill="#9A9A9F"/><circle cx="12" cy="-27" r="6" fill="#9A9A9F"/>
    <circle cx="-8" cy="-27" r="3" fill="#D9D3CF"/><circle cx="12" cy="-27" r="3" fill="#D9D3CF"/>
    <circle cx="2" cy="-23" r="10" fill="#A8A8AD"/>
    <ellipse cx="2" cy="-21" rx="3" ry="4" fill="#2E2E33"/>
    <circle cx="-3" cy="-26" r="1.4" fill="#2E2E33"/><circle cx="7" cy="-26" r="1.4" fill="#2E2E33"/>` },
  { id: 'swan', wake: 'PROG', x: 50, y: 512, anim: 'drift', svg: () => `
    <path d="M-20,0 Q-22,-12 -6,-12 L14,-12 Q20,-12 22,-6 Q16,-2 8,0 Z" fill="#2B2B35"/>
    <path d="M-12,-12 Q-14,-26 -6,-34 Q0,-40 4,-34" fill="none" stroke="#2B2B35" stroke-width="5" stroke-linecap="round"/>
    <path d="M4,-35 L12,-32 L4,-31 Z" fill="#D9443A"/>
    <path d="M-26,3 Q-12,-1 0,3 Q12,-1 26,3" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity=".8"/>` },
  { id: 'emu', wake: 'PROG', x: 238, y: 476, svg: () => `
    <path d="M-4,-14 L-8,0 M4,-14 L6,0" stroke="#5B4636" stroke-width="2.6" stroke-linecap="round"/>
    <ellipse cx="0" cy="-22" rx="16" ry="11" fill="#6B5642"/>
    <path d="M10,-28 Q14,-44 12,-50" fill="none" stroke="#6B5642" stroke-width="5" stroke-linecap="round"/>
    <path d="M12,-51 L19,-49 L12,-47 Z" fill="#3A2C20"/>` },
  { id: 'whale', wake: 'GOING', x: 432, y: 712, svg: () => `
    <path d="M-36,-2 Q-30,-22 -2,-22 Q26,-22 34,-6 L46,-16 L44,-2 L52,6 L36,2 Q26,10 -4,10 Q-32,10 -36,-2 Z" fill="#4C7194"/>
    <path d="M-30,2 Q-8,8 20,4" fill="none" stroke="#DCEAF5" stroke-width="2" opacity=".7"/>
    <circle cx="-22" cy="-8" r="1.8" fill="#1C2F44"/>
    <g class="sc-spout"><path d="M-18,-24 Q-22,-36 -28,-40 M-18,-24 Q-18,-38 -18,-44 M-18,-24 Q-14,-36 -8,-40" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round"/></g>` },
];

// Wellen (immer sichtbar) und Kompassrose
const WAVES = [[70, 250], [165, 168], [300, 712], [612, 742], [985, 410], [880, 62], [118, 735]];

function compass() {
  return `<g class="sc-compass" transform="translate(64 648)" opacity=".75">
    <circle r="26" fill="none" stroke="#2C5E86" stroke-width="1.5" opacity=".6"/>
    <path d="M0,-30 L6,-6 L0,0 Z" fill="#2C5E86"/><path d="M0,-30 L-6,-6 L0,0 Z" fill="#6E98BD"/>
    <path d="M0,30 L6,6 L0,0 Z" fill="#6E98BD"/><path d="M0,30 L-6,6 L0,0 Z" fill="#2C5E86"/>
    <path d="M30,0 L6,6 L0,0 Z" fill="#2C5E86"/><path d="M30,0 L6,-6 L0,0 Z" fill="#6E98BD"/>
    <path d="M-30,0 L-6,-6 L0,0 Z" fill="#2C5E86"/><path d="M-30,0 L-6,6 L0,0 Z" fill="#6E98BD"/>
    <text y="-35" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-size="13" font-weight="700" fill="#2C5E86">N</text>
  </g>`;
}

// Land mit Wüste in der Mitte, grüner Ostküste, Strand und Flachwasser
export function terrainSVG(lands) {
  const paths = (attrs) => lands.map((d) => `<path d="${d}" ${attrs}/>`).join('');
  return `<defs>
      <radialGradient id="desert" cx="470" cy="430" r="400" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#EBBC8C"/><stop offset=".55" stop-color="#EECB9F"/><stop offset="1" stop-color="#F0DEC0"/></radialGradient>
      <linearGradient id="greencoast" x1="760" y1="0" x2="905" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#9DBB7A" stop-opacity="0"/><stop offset="1" stop-color="#9DBB7A" stop-opacity=".7"/></linearGradient>
      <clipPath id="landclip">${paths('')}</clipPath>
    </defs>
    ${paths('fill="none" stroke="#C4E1F2" stroke-width="30" stroke-linejoin="round"')}
    ${paths('fill="url(#desert)" stroke="#F5E7CA" stroke-width="10" stroke-linejoin="round"')}
    <g clip-path="url(#landclip)"><rect x="760" y="0" width="240" height="800" fill="url(#greencoast)"/></g>
    ${paths('fill="none" stroke="var(--coast)" stroke-width="3" stroke-linejoin="round"')}
    ${WAVES.map(([x, y], i) => `<g transform="translate(${x} ${y})"><path class="sc-wave${i % 2 ? ' b' : ''}" d="M-14,0 q7,-6 14,0 t14,0" fill="none" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round" opacity=".7"/></g>`).join('')}
    ${compass()}`;
}

// Motive: wach (farbig) ab dem ersten Stempel der Station. "fresh" = gerade erst erwacht (Übergang).
export function motifsSVG(pr, fresh) {
  return MOTIFS.map((m) => {
    const awake = !!pr.topics[m.wake]?.stamp;
    const cls = ['sc', awake && m.wake !== fresh ? '' : 'sleep', awake && m.wake === fresh ? 'waking' : ''].join(' ').trim();
    const inner = m.anim ? `<g class="sc-${m.anim}">${m.svg()}</g>` : m.svg();
    return `<g class="${cls}" data-motif="${m.id}" transform="translate(${m.x} ${m.y})">${inner}</g>`;
  }).join('');
}

// Lagerfeuer (gemeinsame Unterrichtsphase): Holzscheite; angezündet mit flackernden Flammen und Funken
export function campSVG(lit) {
  return `<svg viewBox="0 0 40 40" width="38" height="38" aria-hidden="true">
    <ellipse cx="20" cy="35" rx="15" ry="3.5" fill="#000" opacity=".12"/>
    ${lit ? `<g class="fl">
      <path class="fl-o" d="M20,6 C26,13 30,18 28,25 C27,30 23,32 20,32 C16,32 12,30 12,25 C11,20 15,17 16,12 C18,15 19,16 20,6 Z" fill="#E8692C"/>
      <path class="fl-i" d="M20,15 C23,19 25,22 24,26 C23,29 21,30 20,30 C18,30 16,29 16,26 C16,23 18,21 20,15 Z" fill="#F7C548"/>
    </g>
    <circle class="spark s1" cx="15" cy="10" r="1.3" fill="#F7C548"/><circle class="spark s2" cx="25" cy="8" r="1.1" fill="#F0A13A"/>` : ''}
    <path d="M7,33 L33,27" stroke="#7A4E2A" stroke-width="5" stroke-linecap="round"/>
    <path d="M7,27 L33,33" stroke="#946039" stroke-width="5" stroke-linecap="round"/>
  </svg>`;
}

// Reisemobil mit Avatar an der aktuellen Station (ersetzt dort das NOW-Schild)
export function vanHTML(avatar, side) {
  return `<span class="van ${side}" aria-hidden="true">
    <svg viewBox="0 0 64 42" width="64" height="42">
      <rect x="2" y="6" width="58" height="27" rx="9" fill="var(--rc)"/>
      <path d="M2 20 V15 a9 9 0 0 1 9 -9 H51 a9 9 0 0 1 9 9 V20 Z" fill="#FFFBF3"/>
      <rect x="42" y="9" width="14" height="9" rx="3" fill="#BFDDF0"/>
      <text x="40" y="29.5" text-anchor="middle" font-family="Atkinson Hyperlegible, sans-serif" font-size="9" font-weight="700" letter-spacing="1" fill="#FFFFFF">NOW</text>
      <circle cx="16" cy="34" r="6" fill="#2A2A2E"/><circle cx="16" cy="34" r="2.2" fill="#D6D0C4"/>
      <circle cx="48" cy="34" r="6" fill="#2A2A2E"/><circle cx="48" cy="34" r="2.2" fill="#D6D0C4"/>
    </svg>
    <img src="${avatar}" alt="" onerror="this.remove()">
  </span>`;
}
