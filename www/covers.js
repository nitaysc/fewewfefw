'use strict';

// Hand-drawn cartoon cover art for each deck (inline SVG, 300x400 canvas).
// The title chip covers the top ~75px and the badges the bottom-right corner,
// so each scene keeps its subject around the middle.
const INK = '#2a1650';
const ol = (w = 5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

function star4(x, y, r) {
  return `M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`;
}
function star5(x, y, r) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}
function heart(x, y, s) {
  return `M${x} ${y + s * 0.9} C${x - s * 1.6} ${y - s * 0.1} ${x - s * 0.6} ${y - s * 1.2} ${x} ${y - s * 0.35} C${x + s * 0.6} ${y - s * 1.2} ${x + s * 1.6} ${y - s * 0.1} ${x} ${y + s * 0.9}Z`;
}
function note(x, y, fill = '#fff') {
  return `<g ${ol(4)}>
    <path d="M${x + 11} ${y} V${y - 46} Q${x + 30} ${y - 38} ${x + 28} ${y - 22}" fill="none"/>
    <ellipse cx="${x}" cy="${y}" rx="13" ry="10" fill="${fill}" transform="rotate(-20 ${x} ${y})"/></g>`;
}
const shadow = (x, y, rx) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.16}" fill="rgba(0,0,0,.18)"/>`;
const shine = (x, y, w, h, rot = -30) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="rgba(255,255,255,.55)" transform="rotate(${rot} ${x} ${y})"/>`;

function sparkles() {
  const s = [[42, 105, 10], [262, 92, 8], [28, 300, 7], [275, 238, 9], [70, 355, 6]];
  return s.map(([x, y, r], i) => `<path class="tw" style="animation-delay:${i * 0.4}s" d="${star4(x, y, r)}" fill="#fff"/>`).join('')
    + '<circle cx="250" cy="330" r="4" fill="rgba(255,255,255,.7)"/><circle cx="55" cy="160" r="3" fill="rgba(255,255,255,.7)"/>';
}

const SCENES = {
  mix: () => `
    ${shadow(150, 300, 70)}
    <g class="f1"><g transform="rotate(-12 150 225)">
      <rect x="95" y="170" width="110" height="110" rx="24" fill="#fff" ${ol(6)}/>
      <rect x="95" y="250" width="110" height="30" rx="14" fill="#e3dcf5"/>
      <rect x="95" y="170" width="110" height="110" rx="24" fill="none" ${ol(6)}/>
      ${[[122, 197], [150, 225], [178, 253], [178, 197], [122, 253]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="10" fill="${INK}"/>`).join('')}
    </g></g>
    <g class="f2"><g transform="rotate(18 225 135)">
      <rect x="198" y="108" width="56" height="56" rx="14" fill="#ffcc33" ${ol(5)}/>
      <circle cx="214" cy="124" r="6" fill="${INK}"/><circle cx="238" cy="148" r="6" fill="${INK}"/>
    </g></g>
    <g class="f3"><path d="M60 300 m-24 0 a24 24 0 1 1 48 0 a17 17 0 1 1 -34 0 a9 9 0 1 1 18 0" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/></g>
    <g class="f2" style="animation-delay:.8s"><polygon points="${star5(80, 140, 24)}" fill="#ff5c8a" ${ol(4)}/></g>`,

  general: () => `
    ${shadow(150, 322, 60)}
    <g class="f1">
      <path d="M150 220 V305 Q150 325 132 325 Q116 325 116 310" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
      <path d="M150 220 V305 Q150 325 132 325 Q116 325 116 310" fill="none" stroke="#8d6e63" stroke-width="5" stroke-linecap="round"/>
      <path d="M62 222 Q150 105 238 222 Q216 204 194 222 Q172 204 150 222 Q128 204 106 222 Q84 204 62 222Z" fill="#ff5c8a" ${ol(6)}/>
      <path d="M150 128 Q122 170 106 222 Q128 204 150 222 Q172 204 194 222 Q178 170 150 128Z" fill="#ffcc33" ${ol(5)}/>
      <line x1="150" y1="128" x2="150" y2="112" ${ol(6)}/>
      ${shine(105, 175, 16, 7, -45)}
    </g>
    <g class="f2">
      <path d="M236 168 Q228 200 244 225 Q256 250 240 280" fill="none" stroke="#fff" stroke-width="3"/>
      <ellipse cx="236" cy="128" rx="28" ry="34" fill="#4fc3ff" ${ol(5)}/>
      <path d="M230 162 L242 162 L236 170Z" fill="#4fc3ff" ${ol(4)}/>
      ${shine(224, 114, 8, 13, 20)}
    </g>
    <g class="f3">
      <circle cx="68" cy="138" r="24" fill="#fff59d" ${ol(5)}/>
      <rect x="57" y="160" width="22" height="18" rx="4" fill="#b0bec5" ${ol(4)}/>
      <path d="M62 140 Q68 128 74 140" fill="none" stroke="#f9a825" stroke-width="3"/>
      ${[[40, 112], [96, 112], [36, 150], [100, 150]].map(([x, y]) => `<line x1="${x}" y1="${y}" x2="${x + (x < 68 ? -8 : 8)}" y2="${y + (y < 130 ? -6 : 4)}" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`).join('')}
    </g>`,

  food: () => `
    ${shadow(155, 320, 80)}
    <g class="f1">
      <path d="M78 246 Q100 222 118 244 Q134 220 152 242 Q168 220 186 242 Q204 220 222 244 Q236 230 234 250 L76 250Z" fill="#43a047" ${ol(5)}/>
      <circle cx="118" cy="236" r="19" fill="#8d5524" ${ol(5)}/><circle cx="155" cy="226" r="20" fill="#9c5f2a" ${ol(5)}/><circle cx="192" cy="236" r="19" fill="#8d5524" ${ol(5)}/>
      <circle cx="140" cy="244" r="10" fill="#e53935" ${ol(4)}/><circle cx="172" cy="246" r="9" fill="#e53935" ${ol(4)}/>
      ${[[112, 230], [150, 220], [188, 230], [160, 232]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#f0c27b"/>`).join('')}
      <path d="M70 248 A85 85 0 0 0 240 248Z" fill="#f2c27b" ${ol(6)}/>
      <path d="M92 268 Q155 300 218 268" fill="none" stroke="#d9a35b" stroke-width="4" stroke-linecap="round"/>
      ${shine(105, 270, 14, 6, 25)}
    </g>
    <g class="f2"><g transform="rotate(-15 235 140)">
      <path d="M185 130 A50 50 0 0 0 285 130Z" fill="#2e9e4f" ${ol(5)}/>
      <path d="M194 130 A41 41 0 0 0 276 130Z" fill="#ff4d6d"/>
      ${[[215, 142], [235, 152], [255, 142], [235, 138]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3" ry="5" fill="${INK}"/>`).join('')}
    </g></g>
    <g class="f3">
      <rect x="20" y="132" width="34" height="12" rx="6" fill="#455a64" ${ol(4)}/>
      <circle cx="80" cy="138" r="38" fill="#37474f" ${ol(5)}/>
      <circle cx="80" cy="138" r="30" fill="#e53935"/>
      <path d="M58 132 Q62 116 76 122 Q86 114 92 128 Q98 144 82 146 Q64 152 58 132Z" fill="#fff"/>
      <circle cx="76" cy="133" r="8" fill="#ffb300"/>
      <path d="M84 150 Q90 142 100 148 Q104 160 92 160 Q80 162 84 150Z" fill="#fff"/><circle cx="92" cy="153" r="5" fill="#ffb300"/>
      <circle cx="66" cy="152" r="3" fill="#2e7d32"/><circle cx="100" cy="130" r="3" fill="#2e7d32"/>
    </g>`,

  places: () => `
    <g class="f2"><circle cx="222" cy="128" r="30" fill="#ffd54f" ${ol(5)}/>
      ${Array.from({ length: 8 }, (_, i) => { const a = i * Math.PI / 4; return `<line x1="${222 + 40 * Math.cos(a)}" y1="${128 + 40 * Math.sin(a)}" x2="${222 + 52 * Math.cos(a)}" y2="${128 + 52 * Math.sin(a)}" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`; }).join('')}
      <circle cx="213" cy="124" r="3.5" fill="${INK}"/><circle cx="231" cy="124" r="3.5" fill="${INK}"/><path d="M212 136 Q222 144 232 136" fill="none" ${ol(3)}/></g>
    <g class="f1">
      <path d="M30 300 L105 175 L150 245 L195 190 L270 300Z" fill="#a1887f" ${ol(6)}/>
      <path d="M105 175 L88 203 L104 196 L118 207Z" fill="#fff" ${ol(4)}/>
      <path d="M195 190 L182 210 L196 204 L207 212Z" fill="#fff" ${ol(4)}/>
      <path d="M150 245 L170 300 L120 300Z" fill="#8d6e63"/>
      <path d="M20 300 Q50 286 80 300 T140 300 T200 300 T260 300 T290 300 V345 H20Z" fill="#29b6f6" ${ol(5)}/>
      <path d="M50 318 Q65 310 80 318 M170 322 Q185 314 200 322" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    </g>
    <g class="f3">
      <path d="M62 300 Q52 250 74 205" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
      <path d="M62 300 Q52 250 74 205" fill="none" stroke="#8d6e63" stroke-width="8" stroke-linecap="round"/>
      ${[[-50, -10], [-15, -35], [25, -30], [50, 0]].map(([dx, dy]) => `<path d="M74 205 Q${74 + dx * 0.6} ${205 + dy - 18} ${74 + dx} ${205 + dy} Q${74 + dx * 0.5} ${205 + dy * 0.3} 74 205Z" fill="#43a047" ${ol(4)}/>`).join('')}
      <circle cx="80" cy="212" r="7" fill="#795548" ${ol(3)}/>
    </g>`,

  slang: () => `
    ${shadow(150, 318, 64)}
    <g class="f1">
      <circle cx="150" cy="235" r="72" fill="#ffcc33" ${ol(6)}/>
      <path d="M96 205 H204" ${ol(6)}/>
      <rect x="100" y="198" width="44" height="30" rx="12" fill="${INK}"/>
      <rect x="156" y="198" width="44" height="30" rx="12" fill="${INK}"/>
      <path d="M108 206 L120 206 M164 206 L176 206" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <path d="M112 255 Q150 300 190 255 Q150 272 112 255Z" fill="#fff" ${ol(5)}/>
      ${shine(112, 178, 16, 8, -35)}
      <circle cx="98" cy="252" r="9" fill="#ff8a80" opacity=".7"/><circle cx="202" cy="252" r="9" fill="#ff8a80" opacity=".7"/>
    </g>
    <g class="f2">
      <ellipse cx="230" cy="125" rx="44" ry="30" fill="#fff" ${ol(5)}/>
      <path d="M205 145 L196 168 L222 152" fill="#fff" ${ol(5)}/>
      <ellipse cx="230" cy="125" rx="38" ry="24" fill="#fff"/>
      <circle cx="213" cy="125" r="6" fill="${INK}"/><circle cx="230" cy="125" r="6" fill="${INK}"/><circle cx="247" cy="125" r="6" fill="${INK}"/>
    </g>
    <g class="f3"><path d="${heart(66, 140, 20)}" fill="#ff5c8a" ${ol(4)}/></g>`,

  army: () => `
    ${shadow(150, 300, 85)}
    <g class="f1">
      <path d="M78 258 Q78 160 150 160 Q222 160 222 258Z" fill="#6b7d34" ${ol(6)}/>
      <ellipse cx="118" cy="205" rx="18" ry="11" fill="#55652a" transform="rotate(-20 118 205)"/>
      <ellipse cx="170" cy="190" rx="20" ry="10" fill="#7f9440"/>
      <ellipse cx="185" cy="232" rx="16" ry="9" fill="#55652a"/>
      <ellipse cx="135" cy="240" rx="14" ry="8" fill="#7f9440"/>
      <path d="M78 258 Q78 160 150 160 Q222 160 222 258" fill="none" ${ol(6)}/>
      <rect x="62" y="252" width="176" height="20" rx="10" fill="#55652a" ${ol(5)}/>
      ${shine(112, 180, 18, 8, -35)}
    </g>
    <g class="f2"><g transform="rotate(15 230 140)">
      <path d="M230 82 Q215 95 222 110" fill="none" stroke="#cfd8dc" stroke-width="3" stroke-dasharray="3 4"/>
      <rect x="208" y="108" width="44" height="60" rx="14" fill="#cfd8dc" ${ol(5)}/>
      <circle cx="230" cy="120" r="5" fill="${INK}"/>
      <path d="M218 138 H242 M218 150 H236" stroke="#90a4ae" stroke-width="4" stroke-linecap="round"/>
    </g></g>
    <g class="f3">
      <path d="M50 130 Q46 118 54 110 M66 128 Q62 116 70 108" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 140 H90 L84 182 Q65 192 46 182Z" fill="#ffb74d" ${ol(5)}/>
      <path d="M86 150 L118 140" ${ol(7)}/><path d="M86 150 L118 140" stroke="#ffb74d" stroke-width="3" stroke-linecap="round"/>
      <path d="M44 150 H86" stroke="#e65100" stroke-width="4"/>
    </g>`,

  holidays: () => {
    const cols = ['#4fc3ff', '#ff5c8a', '#ffcc33', '#22c55e', '#fff', '#b388ff', '#ff9f1c', '#4fc3ff', '#ff5c8a'];
    const candles = cols.map((c, i) => {
      const x = 62 + i * 22, y = i === 4 ? 150 : 172;
      return `<rect x="${x - 6}" y="${y}" width="12" height="${i === 4 ? 50 : 28}" rx="3" fill="${c}" ${ol(3.5)}/>
        <g class="flame" style="animation-delay:${i * 0.13}s"><path d="M${x} ${y - 22} Q${x + 9} ${y - 8} ${x} ${y - 3} Q${x - 9} ${y - 8} ${x} ${y - 22}Z" fill="#ff9f1c" ${ol(2.5)}/>
        <path d="M${x} ${y - 14} Q${x + 4} ${y - 7} ${x} ${y - 5} Q${x - 4} ${y - 7} ${x} ${y - 14}Z" fill="#fff59d"/></g>`;
    }).join('');
    return `${shadow(150, 322, 70)}
      <g class="f1">
        <rect x="143" y="210" width="14" height="96" fill="#ffcc33" ${ol(4)}/>
        <path d="M98 322 H202 L186 298 H114Z" fill="#ffcc33" ${ol(5)}/>
        <rect x="50" y="198" width="200" height="16" rx="8" fill="#ffcc33" ${ol(5)}/>
        ${candles}
        ${shine(85, 204, 14, 3, 0)}
      </g>
      <g class="f2"><circle cx="248" cy="296" r="22" fill="#e53935" ${ol(4)}/><path d="M248 274 Q252 262 260 260" fill="none" ${ol(3)}/>
        <path d="M252 268 Q264 258 270 268 Q260 274 252 268Z" fill="#43a047" ${ol(3)}/>${shine(240, 288, 5, 8, 20)}</g>`;
  },

  celebs: () => `
    <path d="M10 0 L120 330 L60 330Z" fill="rgba(255,255,255,.15)"/><path d="M290 0 L180 330 L240 330Z" fill="rgba(255,255,255,.15)"/>
    ${shadow(150, 330, 40)}
    <g class="f1">
      <path d="M128 214 L172 214 L162 318 Q150 330 138 318Z" fill="#37474f" ${ol(5)}/>
      <rect x="124" y="206" width="52" height="16" rx="6" fill="#ffcc33" ${ol(4)}/>
      <circle cx="150" cy="172" r="44" fill="#b0bec5" ${ol(6)}/>
      <path d="M118 150 Q150 140 182 150 M110 172 H190 M118 194 Q150 204 182 194 M150 128 V216 M128 134 Q120 172 128 210 M172 134 Q180 172 172 210" fill="none" stroke="#78909c" stroke-width="3"/>
      <circle cx="150" cy="172" r="44" fill="none" ${ol(6)}/>
      ${shine(132, 150, 12, 7, -35)}
    </g>
    <g class="f2"><polygon points="${star5(70, 150, 30)}" fill="#ffcc33" ${ol(5)}/></g>
    <g class="f3"><polygon points="${star5(232, 270, 24)}" fill="#fff" ${ol(4)}/></g>
    <g class="f2" style="animation-delay:1s"><polygon points="${star5(236, 132, 16)}" fill="#ff5c8a" ${ol(4)}/></g>`,

  tv: () => `
    ${shadow(150, 312, 75)}
    <g class="f1">
      <line x1="150" y1="168" x2="112" y2="118" ${ol(5)}/><line x1="150" y1="168" x2="190" y2="112" ${ol(5)}/>
      <circle cx="112" cy="116" r="8" fill="#ff5c8a" ${ol(4)}/><circle cx="190" cy="110" r="8" fill="#ffcc33" ${ol(4)}/>
      <path d="M100 292 L90 310 M200 292 L210 310" ${ol(6)}/>
      <rect x="66" y="166" width="168" height="130" rx="22" fill="#ff7043" ${ol(6)}/>
      <rect x="84" y="184" width="108" height="94" rx="16" fill="#80deea" ${ol(5)}/>
      <circle cx="120" cy="222" r="7" fill="${INK}"/><circle cx="156" cy="222" r="7" fill="${INK}"/>
      <path d="M118 244 Q138 262 158 244" fill="none" ${ol(5)}/>
      ${shine(104, 200, 12, 6, -30)}
      <circle cx="212" cy="204" r="9" fill="#ffcc33" ${ol(4)}/><circle cx="212" cy="234" r="9" fill="#ffcc33" ${ol(4)}/>
      <path d="M204 258 H220 M204 268 H220" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="f3">
      ${[[50, 290], [66, 282], [82, 290], [58, 276], [74, 272]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="#fff8e1" ${ol(3.5)}/>`).join('')}
      <path d="M36 296 H96 L88 350 H44Z" fill="#fff" ${ol(5)}/>
      <path d="M52 296 L56 350 M68 296 V350 M84 296 L80 350" stroke="#e53935" stroke-width="7"/>
      <path d="M36 296 H96 L88 350 H44Z" fill="none" ${ol(5)}/>
    </g>`,

  songs: () => `
    ${shadow(150, 330, 60)}
    <g class="f1"><g transform="rotate(-24 150 230)">
      <rect x="141" y="80" width="18" height="140" rx="4" fill="#6d4c41" ${ol(5)}/>
      <rect x="134" y="62" width="32" height="34" rx="8" fill="#4e342e" ${ol(5)}/>
      ${[70, 80, 90].map((y) => `<circle cx="131" cy="${y}" r="3.5" fill="#ffcc33"/><circle cx="169" cy="${y}" r="3.5" fill="#ffcc33"/>`).join('')}
      <path d="M150 196 C108 196 106 236 120 248 C92 262 98 322 150 322 C202 322 208 262 180 248 C194 236 192 196 150 196Z" fill="#ef6c00" ${ol(6)}/>
      <circle cx="150" cy="250" r="16" fill="${INK}"/>
      <rect x="132" y="286" width="36" height="9" rx="3" fill="#4e342e"/>
      <path d="M146 96 V290 M150 96 V290 M154 96 V290" stroke="#fff" stroke-width="1.3" opacity=".8"/>
      ${shine(124, 286, 10, 18, 20)}
    </g></g>
    <g class="f2">${note(66, 170, '#ffcc33')}</g>
    <g class="f3">${note(228, 150, '#fff')}</g>
    <g class="f2" style="animation-delay:1.2s">${note(238, 290, '#ff5c8a')}</g>`,

  animals: () => `
    ${shadow(150, 322, 62)}
    <g class="f1">
      <ellipse cx="96" cy="250" rx="16" ry="38" fill="#263238" ${ol(5)} transform="rotate(20 96 250)"/>
      <ellipse cx="204" cy="250" rx="16" ry="38" fill="#263238" ${ol(5)} transform="rotate(-20 204 250)"/>
      <ellipse cx="128" cy="318" rx="20" ry="9" fill="#ff9f1c" ${ol(4)}/><ellipse cx="172" cy="318" rx="20" ry="9" fill="#ff9f1c" ${ol(4)}/>
      <ellipse cx="150" cy="238" rx="58" ry="80" fill="#263238" ${ol(6)}/>
      <ellipse cx="150" cy="256" rx="40" ry="58" fill="#fff"/>
      <ellipse cx="132" cy="198" rx="13" ry="15" fill="#fff"/><ellipse cx="168" cy="198" rx="13" ry="15" fill="#fff"/>
      <circle cx="134" cy="200" r="7" fill="${INK}"/><circle cx="166" cy="200" r="7" fill="${INK}"/>
      <circle cx="136" cy="197" r="2.5" fill="#fff"/><circle cx="168" cy="197" r="2.5" fill="#fff"/>
      <path d="M138 216 L162 216 L150 232Z" fill="#ff9f1c" ${ol(4)}/>
      <circle cx="118" cy="226" r="8" fill="#ff8a80" opacity=".8"/><circle cx="182" cy="226" r="8" fill="#ff8a80" opacity=".8"/>
      ${shine(118, 175, 12, 6, -35)}
    </g>
    ${[[60, 140, -20], [238, 128, 15], [240, 290, 10]].map(([x, y, r], i) => `<g class="f${2 + (i % 2)}"><g fill="#fff" opacity=".85" transform="rotate(${r} ${x} ${y})">
      <ellipse cx="${x}" cy="${y + 8}" rx="11" ry="9"/><circle cx="${x - 12}" cy="${y - 6}" r="5"/><circle cx="${x - 4}" cy="${y - 12}" r="5"/><circle cx="${x + 5}" cy="${y - 12}" r="5"/><circle cx="${x + 13}" cy="${y - 6}" r="5"/></g></g>`).join('')}`,

  jobs: () => `
    ${shadow(150, 300, 62)}
    <g class="f1">
      <circle cx="112" cy="178" r="32" fill="#fff" ${ol(5)}/>
      <circle cx="188" cy="178" r="32" fill="#fff" ${ol(5)}/>
      <circle cx="150" cy="156" r="40" fill="#fff" ${ol(5)}/>
      <rect x="106" y="190" width="88" height="96" rx="10" fill="#fff" ${ol(5)}/>
      <path d="M118 160 Q150 140 182 160 Q190 190 170 205 H130 Q110 190 118 160Z" fill="#fff"/>
      <path d="M128 222 V270 M150 222 V274 M172 222 V270" stroke="#d1c4e9" stroke-width="5" stroke-linecap="round"/>
      <rect x="106" y="190" width="88" height="22" fill="#ff5c8a" ${ol(5)}/>
    </g>
    <g class="f2"><g transform="rotate(35 236 280)">
      <rect x="229" y="250" width="14" height="80" rx="6" fill="#8d6e63" ${ol(5)}/>
      <path d="M208 236 H262 Q268 250 262 262 H208Z" fill="#90a4ae" ${ol(5)}/>
      ${shine(222, 244, 8, 3, 0)}
    </g></g>
    <g class="f3"><g transform="rotate(-25 66 150)">
      <rect x="40" y="135" width="52" height="30" rx="6" fill="#ffcc33" ${ol(4)}/>
      <path d="M40 150 H92" ${ol(3)}/><path d="M66 135 V125" ${ol(4)}/>
      <circle cx="66" cy="120" r="7" fill="#ff5c8a" ${ol(3)}/>
    </g></g>`,

  actions: () => {
    const limb = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#ffcc33" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`;
    return `${shadow(160, 330, 50)}
      <g class="f1">
        ${limb('M150 190 L112 158 L96 118')}
        ${limb('M150 190 L196 204 L232 178')}
        ${limb('M152 250 L122 292 L104 324')}
        ${limb('M152 250 L190 284 L222 276')}
        <path d="M150 182 L152 252" fill="none" stroke="${INK}" stroke-width="34" stroke-linecap="round"/>
        <path d="M150 182 L152 252" fill="none" stroke="#ff5c8a" stroke-width="24" stroke-linecap="round"/>
        <circle cx="148" cy="148" r="28" fill="#ffcc33" ${ol(6)}/>
        <circle cx="140" cy="146" r="4" fill="${INK}"/><circle cx="158" cy="146" r="4" fill="${INK}"/>
        <path d="M138 158 Q149 168 160 158" fill="none" ${ol(4)}/>
      </g>
      <path class="tw" d="M74 126 Q64 140 74 154 M64 118 Q48 140 64 162" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <path class="tw" style="animation-delay:.6s" d="M244 168 Q256 180 246 194 M254 160 Q272 180 256 202" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <g class="f3">${note(232, 300, '#fff')}</g>`;
  },

  sports: () => `
    ${shadow(132, 312, 60)}
    <g class="f1">
      <circle cx="132" cy="250" r="58" fill="#fff" ${ol(6)}/>
      <polygon points="${Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `${(132 + 20 * Math.cos(a)).toFixed(1)},${(250 + 20 * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="${INK}"/>
      ${Array.from({ length: 5 }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; const x1 = 132 + 20 * Math.cos(a), y1 = 250 + 20 * Math.sin(a), x2 = 132 + 44 * Math.cos(a), y2 = 250 + 44 * Math.sin(a); return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${INK}" stroke-width="4"/><circle cx="${(132 + 52 * Math.cos(a)).toFixed(1)}" cy="${(250 + 52 * Math.sin(a)).toFixed(1)}" r="10" fill="${INK}"/>`; }).join('')}
      <circle cx="132" cy="250" r="58" fill="none" ${ol(6)}/>
      ${shine(108, 222, 14, 7, -35)}
    </g>
    <g class="f2">
      <circle cx="228" cy="150" r="36" fill="#ff7a1a" ${ol(5)}/>
      <path d="M228 114 V186 M192 150 H264 M202 124 Q222 150 202 176 M254 124 Q234 150 254 176" fill="none" stroke="${INK}" stroke-width="3.5"/>
      ${shine(214, 134, 8, 4, -35)}
    </g>
    <g class="f3">
      <path d="M48 120 H92 V140 Q92 168 70 172 Q48 168 48 140Z" fill="#ffcc33" ${ol(5)}/>
      <path d="M48 128 Q32 128 34 142 Q36 154 50 152 M92 128 Q108 128 106 142 Q104 154 90 152" fill="none" ${ol(4)}/>
      <rect x="64" y="172" width="12" height="14" fill="#ffcc33" ${ol(4)}/>
      <rect x="52" y="186" width="36" height="10" rx="3" fill="#8d6e63" ${ol(4)}/>
      ${shine(60, 134, 4, 9, 0)}
    </g>`,

  childhood: () => `
    ${shadow(150, 336, 30)}
    <g class="f1">
      <path d="M118 232 H182 L150 334Z" fill="#e0a96d" ${ol(5)}/>
      <path d="M126 250 L166 290 M138 236 L174 272 M176 248 L136 290 M164 236 L128 272" stroke="#c48a4a" stroke-width="3"/>
      <path d="M118 232 H182 L150 334Z" fill="none" ${ol(5)}/>
      <circle cx="132" cy="220" r="28" fill="#ff8fb1" ${ol(5)}/>
      <circle cx="168" cy="220" r="28" fill="#7ee0c3" ${ol(5)}/>
      <circle cx="150" cy="190" r="28" fill="#8d5524" ${ol(5)}/>
      <path d="M128 196 Q140 186 150 196 Q160 206 172 196" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
      <circle cx="150" cy="158" r="10" fill="#e53935" ${ol(4)}/><path d="M150 148 Q154 138 162 136" fill="none" ${ol(3)}/>
      ${shine(122, 210, 6, 10, 30)}
    </g>
    <g class="f2">
      <path d="M232 168 Q220 200 238 220 Q254 240 236 262" fill="none" stroke="#fff" stroke-width="3"/>
      <path d="M240 225 l-8 -6 v12Z M238 248 l-8 -6 v12Z" fill="#ff5c8a"/>
      <polygon points="232,92 266,130 232,168 198,130" fill="#4fc3ff" ${ol(5)}/>
      <polygon points="232,92 266,130 232,130" fill="#ffcc33"/><polygon points="232,130 198,130 232,168" fill="#ff5c8a"/>
      <polygon points="232,92 266,130 232,168 198,130" fill="none" ${ol(5)}/>
      <path d="M232 92 V168 M198 130 H266" stroke="${INK}" stroke-width="3"/>
    </g>
    <g class="f3">
      <line x1="66" y1="92" x2="66" y2="146" stroke="#fff" stroke-width="3"/>
      <circle cx="66" cy="172" r="26" fill="#e53935" ${ol(5)}/>
      <circle cx="66" cy="172" r="12" fill="#ffcc33" ${ol(4)}/>
      ${shine(56, 160, 5, 8, 30)}
    </g>`,

  kids: () => `
    ${shadow(150, 316, 66)}
    <g class="f1">
      <circle cx="96" cy="178" r="28" fill="#a1887f" ${ol(5)}/><circle cx="96" cy="178" r="14" fill="#d7ccc8"/>
      <circle cx="204" cy="178" r="28" fill="#a1887f" ${ol(5)}/><circle cx="204" cy="178" r="14" fill="#d7ccc8"/>
      <circle cx="150" cy="236" r="72" fill="#a1887f" ${ol(6)}/>
      <ellipse cx="150" cy="262" rx="36" ry="28" fill="#d7ccc8"/>
      <ellipse cx="150" cy="250" rx="12" ry="9" fill="${INK}"/>
      <path d="M150 259 V268 M136 270 Q150 282 164 270" fill="none" ${ol(4)}/>
      <circle cx="124" cy="222" r="9" fill="${INK}"/><circle cx="176" cy="222" r="9" fill="${INK}"/>
      <circle cx="127" cy="219" r="3" fill="#fff"/><circle cx="179" cy="219" r="3" fill="#fff"/>
      <circle cx="108" cy="250" r="9" fill="#ff8a80" opacity=".7"/><circle cx="192" cy="250" r="9" fill="#ff8a80" opacity=".7"/>
      ${shine(116, 190, 14, 7, -35)}
    </g>
    <g class="f2">
      <ellipse cx="62" cy="322" rx="34" ry="20" fill="#ffd54f" ${ol(5)}/>
      <circle cx="80" cy="294" r="17" fill="#ffd54f" ${ol(5)}/>
      <path d="M94 294 L110 298 L94 304Z" fill="#ff9f1c" ${ol(4)}/>
      <circle cx="84" cy="290" r="3.5" fill="${INK}"/>
      <path d="M44 316 Q58 304 70 318" fill="none" ${ol(3.5)}/>
    </g>
    <g class="f3">
      <path d="M236 160 Q244 190 232 214" fill="none" stroke="#fff" stroke-width="3"/>
      <ellipse cx="236" cy="128" rx="24" ry="30" fill="#ff5c8a" ${ol(5)}/>
      <path d="M231 158 H241 L236 165Z" fill="#ff5c8a" ${ol(3.5)}/>
      ${shine(226, 116, 6, 11, 20)}
    </g>`,

  tech: () => `
    ${shadow(150, 340, 56)}
    <g class="f1"><g transform="rotate(-8 150 245)">
      <rect x="94" y="148" width="112" height="190" rx="24" fill="#263238" ${ol(6)}/>
      <rect x="105" y="170" width="90" height="146" rx="10" fill="#4fc3ff"/>
      <rect x="114" y="182" width="56" height="18" rx="9" fill="#fff"/>
      <rect x="130" y="208" width="56" height="18" rx="9" fill="#ffcc33"/>
      <rect x="114" y="234" width="44" height="18" rx="9" fill="#fff"/>
      <rect x="130" y="260" width="56" height="18" rx="9" fill="#ffcc33"/>
      <rect x="132" y="326" width="36" height="5" rx="2.5" fill="#90a4ae"/>
      <rect x="135" y="156" width="30" height="6" rx="3" fill="${INK}"/>
      ${shine(112, 190, 4, 16, 0)}
    </g></g>
    <g class="f2"><circle cx="232" cy="140" r="27" fill="#ff5c8a" ${ol(5)}/><path d="${heart(232, 140, 11)}" fill="#fff"/></g>
    <g class="f3"><circle cx="66" cy="150" r="24" fill="#22c55e" ${ol(5)}/>
      <path d="M54 150 L63 160 L79 141" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="f2" style="animation-delay:.9s"><g transform="rotate(12 66 300)">
      <path d="M30 290 Q30 272 50 272 H82 Q102 272 102 290 L108 318 Q110 332 96 332 Q86 332 80 320 H52 Q46 332 36 332 Q22 332 24 318Z" fill="#b388ff" ${ol(5)}/>
      <path d="M44 294 H60 M52 286 V302" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="80" cy="290" r="4.5" fill="#ffcc33"/><circle cx="90" cy="298" r="4.5" fill="#ff5c8a"/>
    </g></g>`,

  football: () => `
    ${shadow(150, 322, 66)}
    <g class="f1">
      <path d="M96 172 L126 158 Q150 176 174 158 L204 172 L236 206 L210 228 L200 216 V312 H100 V216 L90 228 L64 206Z" fill="#1e88e5" ${ol(6)}/>
      <path d="M118 162 V312 M182 162 V312" stroke="#90caf9" stroke-width="10"/>
      <path d="M96 172 L126 158 Q150 176 174 158 L204 172 L236 206 L210 228 L200 216 V312 H100 V216 L90 228 L64 206Z" fill="none" ${ol(6)}/>
      <path d="M126 158 Q150 182 174 158" fill="#fff" ${ol(4)}/>
      <text x="150" y="282" text-anchor="middle" font-size="64" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="4" paint-order="stroke" font-family="Rubik, Arial">10</text>
      ${shine(112, 190, 6, 14, 30)}
    </g>
    <g class="f2">
      <circle cx="238" cy="128" r="28" fill="#fff" ${ol(5)}/>
      <polygon points="${[0, 1, 2, 3, 4].map((i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `${(238 + 11 * Math.cos(a)).toFixed(1)},${(128 + 11 * Math.sin(a)).toFixed(1)}`; }).join(' ')}" fill="${INK}"/>
      <path d="M216 116 L226 120 M260 116 L250 120 M226 150 L231 140 M250 150 L245 140" stroke="${INK}" stroke-width="3"/>
    </g>
    <g class="f3"><polygon points="${star5(66, 146, 26)}" fill="#ffcc33" ${ol(5)}/></g>`,

  worldstars: () => `
    <path d="M10 0 L110 330 L50 330Z" fill="rgba(255,255,255,.14)"/><path d="M290 0 L190 330 L250 330Z" fill="rgba(255,255,255,.14)"/>
    ${shadow(150, 318, 70)}
    <g class="f1">
      <polygon points="${star5(150, 232, 82)}" fill="#ffcc33" ${ol(6)}/>
      <polygon points="${star5(150, 238, 44)}" fill="#ffe082"/>
      <circle cx="134" cy="228" r="7" fill="${INK}"/><circle cx="166" cy="228" r="7" fill="${INK}"/>
      <path d="M134 248 Q150 262 166 248" fill="none" ${ol(4)}/>
      <circle cx="122" cy="246" r="7" fill="#ff8a80" opacity=".8"/><circle cx="178" cy="246" r="7" fill="#ff8a80" opacity=".8"/>
    </g>
    <g class="f2"><g transform="rotate(-12 70 150)">
      <rect x="40" y="132" width="64" height="44" rx="10" fill="#37474f" ${ol(5)}/>
      <rect x="52" y="122" width="20" height="12" rx="3" fill="#37474f" ${ol(4)}/>
      <circle cx="72" cy="154" r="14" fill="#80deea" ${ol(4)}/><circle cx="68" cy="150" r="4" fill="#fff"/>
    </g><path class="tw" d="${star4(42, 112, 16)}" fill="#fff"/></g>
    <g class="f3"><path d="${heart(236, 136, 18)}" fill="#ff5c8a" ${ol(4)}/></g>`,

  trends: () => `
    <g class="f1">
      <path d="M46 300 L112 236 L156 266 L236 166" fill="none" stroke="${INK}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M46 300 L112 236 L156 266 L236 166" fill="none" stroke="#22c55e" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M200 160 L250 146 L244 198Z" fill="#22c55e" ${ol(5)}/>
      <circle cx="112" cy="236" r="9" fill="#fff" ${ol(4)}/><circle cx="156" cy="266" r="9" fill="#fff" ${ol(4)}/>
    </g>
    <g class="f2">
      <path d="M78 186 Q42 160 66 116 Q70 134 82 138 Q78 108 102 92 Q100 120 116 132 Q128 150 114 172 Q102 192 78 186Z" fill="#ff7a1a" ${ol(5)}/>
      <path d="M86 178 Q70 162 82 144 Q86 154 94 154 Q96 140 104 134 Q112 152 104 166 Q98 180 86 178Z" fill="#ffcc33"/>
    </g>
    <g class="f3"><text x="214" y="300" text-anchor="middle" font-size="76" font-weight="900" fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke" font-family="Rubik, Arial">#</text></g>
    <g class="f2" style="animation-delay:.7s"><path d="${heart(238, 112, 14)}" fill="#ff5c8a" ${ol(4)}/></g>`,

  characters: () => `
    ${shadow(150, 300, 70)}
    <g class="f1">
      <path d="M150 230 L84 300 Q150 320 216 300Z" fill="#e53935" ${ol(5)}/>
      <path d="M78 214 Q76 182 114 186 Q150 196 186 186 Q224 182 222 214 Q220 252 186 250 Q160 248 150 232 Q140 248 114 250 Q80 252 78 214Z" fill="#ffcc33" ${ol(6)}/>
      <ellipse cx="117" cy="216" rx="19" ry="13" fill="#fff" ${ol(4)}/><ellipse cx="183" cy="216" rx="19" ry="13" fill="#fff" ${ol(4)}/>
      <circle cx="121" cy="216" r="6" fill="${INK}"/><circle cx="179" cy="216" r="6" fill="${INK}"/>
      ${shine(100, 196, 12, 5, -15)}
    </g>
    <g class="f2"><path d="M238 96 L210 146 H232 L216 190 L262 128 H240 L256 96Z" fill="#ffcc33" ${ol(5)}/></g>
    <g class="f3"><g transform="rotate(-10 66 150)">
      <rect x="34" y="140" width="66" height="46" rx="6" fill="#37474f" ${ol(5)}/>
      <path d="M34 140 L40 118 L106 128 L100 140Z" fill="#fff" ${ol(4)}/>
      <path d="M52 121 L46 139 M70 124 L64 140 M88 126 L82 140" stroke="${INK}" stroke-width="7"/>
      <path d="M44 154 H90 M44 168 H76" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    </g></g>`,

  worldplaces: () => `
    ${shadow(150, 322, 70)}
    <g class="f1">
      <path d="M150 104 L160 150 L174 230 L198 318 H172 Q150 280 128 318 H102 L126 230 L140 150Z" fill="#8d6e63" ${ol(5)}/>
      <rect x="130" y="146" width="40" height="10" rx="3" fill="#6d4c41" ${ol(4)}/>
      <rect x="114" y="226" width="72" height="12" rx="3" fill="#6d4c41" ${ol(4)}/>
      <path d="M140 170 L160 210 M160 170 L140 210 M128 250 L172 300 M172 250 L128 300" stroke="#5d4037" stroke-width="3"/>
      <line x1="150" y1="104" x2="150" y2="88" ${ol(4)}/>
    </g>
    <g class="f2">
      <circle cx="238" cy="140" r="32" fill="#4fc3ff" ${ol(5)}/>
      <path d="M220 124 Q232 116 240 126 Q236 138 224 136Z M244 146 Q258 140 262 154 Q252 166 244 158Z M222 152 Q230 150 232 160 Q224 166 220 160Z" fill="#43a047"/>
      <circle cx="238" cy="140" r="32" fill="none" ${ol(5)}/>
      ${shine(226, 124, 7, 4, -35)}
    </g>
    <g class="f3"><g transform="rotate(-20 66 150)">
      <path d="M30 150 H96 Q106 150 106 156 Q106 162 96 162 H30Z" fill="#fff" ${ol(4)}/>
      <path d="M60 150 L46 124 H58 L80 150Z M60 162 L46 186 H58 L80 162Z M34 150 L28 136 H36 L44 150Z" fill="#fff" ${ol(4)}/>
    </g></g>`,

  anime: () => `
    ${shadow(150, 318, 76)}
    <g class="f1">
      <path d="M200 160 L120 220 M220 168 L132 222" ${ol(7)}/><path d="M200 160 L120 220 M220 168 L132 222" stroke="#ffcc80" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="150" cy="232" rx="72" ry="16" fill="#ffcc80" ${ol(5)}/>
      <path d="M100 230 Q110 218 120 230 T140 230 T160 230 T180 230 T200 230" fill="none" stroke="#fff3c4" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="124" cy="226" rx="16" ry="10" fill="#fff" ${ol(3)}/><circle cx="124" cy="226" r="6" fill="#ffb300"/>
      <circle cx="176" cy="225" r="12" fill="#fff" ${ol(3)}/><path d="M176 225 m-6 0 a6 6 0 1 1 6 6" fill="none" stroke="#ff5c8a" stroke-width="3"/>
      <path d="M76 232 H224 Q218 304 150 308 Q82 304 76 232Z" fill="#e53935" ${ol(6)}/>
      <path d="M96 258 H204" stroke="#fff" stroke-width="5" stroke-dasharray="10 8"/>
      ${shine(98, 270, 6, 14, 20)}
    </g>
    <g class="f2">
      <path d="M66 112 Q74 112 98 150 Q104 164 92 166 H40 Q28 164 34 150 Q58 112 66 112Z" fill="#fff" ${ol(5)}/>
      <rect x="50" y="146" width="32" height="20" fill="${INK}"/>
      <circle cx="58" cy="136" r="3" fill="${INK}"/><circle cx="74" cy="136" r="3" fill="${INK}"/>
    </g>
    <g class="f3"><path d="${star4(236, 136, 22)}" fill="#fff" ${ol(4)}/></g>`,

  kpop: () => `
    ${shadow(150, 336, 34)}
    <g class="f1">
      <rect x="140" y="228" width="20" height="104" rx="8" fill="#fff" ${ol(5)}/>
      <rect x="136" y="226" width="28" height="14" rx="5" fill="#b388ff" ${ol(4)}/>
      <circle cx="150" cy="182" r="62" fill="rgba(255,255,255,.25)"/>
      <circle cx="150" cy="182" r="48" fill="#e1bee7" ${ol(6)}/>
      <path d="${heart(150, 184, 22)}" fill="#ff5c8a" ${ol(4)}/>
      ${shine(130, 162, 12, 6, -35)}
    </g>
    <g class="f2"><path d="${heart(66, 140, 18)}" fill="#fff" ${ol(4)}/></g>
    <g class="f3"><path d="${heart(236, 128, 15)}" fill="#ffcc33" ${ol(4)}/></g>
    <g class="f2" style="animation-delay:1s">${note(226, 300, '#fff')}</g>
    <g class="f3" style="animation-delay:.5s"><path d="${heart(70, 296, 12)}" fill="#ff5c8a" ${ol(3.5)}/></g>`,

  sweets: () => `
    ${shadow(150, 336, 34)}
    <g class="f1">
      <rect x="144" y="226" width="12" height="108" rx="5" fill="#fff" ${ol(4)}/>
      <circle cx="150" cy="182" r="56" fill="#ff5c8a" ${ol(6)}/>
      <path d="M150 182 m0 -8 a8 8 0 1 1 -8 8 a16 16 0 1 1 16 16 a24 24 0 1 1 -24 -24 a32 32 0 1 1 32 32 a40 40 0 1 1 -40 -40" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"/>
      ${shine(126, 158, 10, 6, -35)}
    </g>
    <g class="f2"><g transform="rotate(-20 236 136)">
      <path d="M206 136 L190 120 V152Z M266 136 L282 120 V152Z" fill="#ffcc33" ${ol(4)}/>
      <ellipse cx="236" cy="136" rx="32" ry="20" fill="#4fc3ff" ${ol(5)}/>
      <path d="M222 122 Q228 136 222 150 M248 122 Q242 136 248 150" fill="none" stroke="#fff" stroke-width="4"/>
    </g></g>
    <g class="f3">
      <circle cx="68" cy="296" r="34" fill="#f2c27b" ${ol(5)}/>
      <path d="M40 290 Q42 264 68 262 Q96 262 98 288 Q92 300 84 292 Q74 304 62 294 Q50 304 40 290Z" fill="#ff8fb1" ${ol(4)}/>
      <circle cx="68" cy="292" r="10" fill="#fce4ec" ${ol(4)}/>
      <path d="M52 276 l6 -3 M80 274 l5 4 M64 268 l-3 -5 M88 288 l4 -4" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
    </g>`,

  spooky: () => `
    <circle cx="232" cy="118" r="26" fill="#fff59d" opacity=".9"/>
    ${shadow(150, 318, 76)}
    <g class="f1">
      <path d="M150 192 Q146 176 156 166" fill="none" stroke="#2e7d32" stroke-width="10" stroke-linecap="round"/>
      <ellipse cx="116" cy="258" rx="42" ry="56" fill="#ff7a1a" ${ol(5)}/>
      <ellipse cx="184" cy="258" rx="42" ry="56" fill="#ff7a1a" ${ol(5)}/>
      <ellipse cx="150" cy="256" rx="40" ry="60" fill="#ff8f33" ${ol(5)}/>
      <path d="M114 236 L134 236 L124 218Z M166 236 L186 236 L176 218Z" fill="#ffcc33" ${ol(4)}/>
      <path d="M112 272 L124 286 L136 272 L150 288 L164 272 L176 286 L188 272 Q176 304 150 304 Q124 304 112 272Z" fill="#ffcc33" ${ol(4)}/>
      ${shine(102, 230, 7, 16, 15)}
    </g>
    <g class="f2">
      <path d="M210 186 V146 Q210 116 236 116 Q262 116 262 146 V186 L253 176 L244 186 L236 176 L227 186 L218 176Z" fill="#fff" ${ol(5)}/>
      <ellipse cx="227" cy="146" rx="5" ry="7" fill="${INK}"/><ellipse cx="245" cy="146" rx="5" ry="7" fill="${INK}"/>
      <ellipse cx="236" cy="162" rx="5" ry="6" fill="${INK}"/>
    </g>
    <g class="f3">
      <path d="M66 146 Q54 128 34 134 Q44 140 40 150 Q50 146 56 156 Q60 150 66 152 Q72 150 76 156 Q82 146 92 150 Q88 140 98 134 Q78 128 66 146Z" fill="${INK}"/>
      <circle cx="62" cy="144" r="2" fill="#ffcc33"/><circle cx="70" cy="144" r="2" fill="#ffcc33"/>
    </g>`,

  custom: () => `
    ${shadow(150, 320, 60)}
    <g class="f1">
      <rect x="92" y="170" width="100" height="136" rx="14" fill="#b388ff" ${ol(5)} transform="rotate(-14 142 238)"/>
      <rect x="108" y="166" width="100" height="136" rx="14" fill="#fff" ${ol(5)} transform="rotate(8 158 234)"/>
      <path d="M128 214 H188 M128 236 H180 M128 258 H170" stroke="#d1c4e9" stroke-width="6" stroke-linecap="round" transform="rotate(8 158 234)"/>
    </g>
    <g class="f2"><g transform="rotate(30 226 140)">
      <rect x="218" y="96" width="16" height="78" rx="4" fill="#ffcc33" ${ol(4)}/>
      <path d="M218 174 L226 192 L234 174Z" fill="#f2c27b" ${ol(4)}/>
      <rect x="218" y="96" width="16" height="12" fill="#ff5c8a" ${ol(4)}/>
    </g></g>
    <g class="f3"><polygon points="${star5(70, 150, 24)}" fill="#ffcc33" ${ol(4)}/></g>`,
};

function coverSVG(id, variant) {
  const scene = (SCENES[id] || SCENES.custom)();
  const vb = variant === 'sheet' ? '-70 95 440 260' : '0 0 300 400';
  return `<svg class="cover" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">${variant === 'sheet' ? '' : sparkles()}${scene}</svg>`;
}
