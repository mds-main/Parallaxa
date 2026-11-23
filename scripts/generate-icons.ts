/**
 * Renders the Parallaxa brand mark ("the Parallax Lens") to every icon the app ships.
 *
 * Two rings are the two viewpoints, the lit lens is the ground they share, the star is the fact both can see.
 * One drawing is the source of truth: run `pnpm icons` after changing it and commit the files in public/.
 *
 * Writes:
 *   public/icons/icon.svg            SVG favicon (night tile, adds an edge in dark tab bars)
 *   public/favicon.ico               real ICO with 16, 32 and 48 px PNG frames
 *   public/icons/apple-touch-icon.png  180 px, full bleed (iOS rounds it)
 *   public/icons/icon-192.png, icon-512.png  rounded tile for installs
 *   public/icons/maskable-512.png    full bleed, mark inside the 80% safe zone
 *   public/icons/badge-96.png        monochrome notification badge (Android uses its alpha only)
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const LENS = 'M32 18.73A15 15 0 0 1 32 45.27A15 15 0 0 1 32 18.73Z';
const STAR = 'M32 25Q32.9 31.1 39 32Q32.9 32.9 32 39Q31.1 32.9 25 32Q31.1 31.1 32 25Z';

/**
 * The full mark in a 64-unit box: lens, two woven rings, star. Gradient, clip and mask ids are defined by the caller.
 * The weave: each ring casts a soft shadow only onto the other ring (masked), right where it passes over it.
 */
function mark(stroke = 3.2) {
  const shadow = stroke * 2 + 0.4;
  return [
    `<path d="${LENS}" fill="url(#lens)"/>`,
    `<circle cx="25" cy="32" r="15" fill="none" stroke="url(#ra)" stroke-width="${stroke}"/>`,
    `<circle cx="39" cy="32" r="15" fill="none" stroke="#050608" stroke-opacity=".6" stroke-width="${shadow}" clip-path="url(#bot)" mask="url(#ma)"/>`,
    `<circle cx="39" cy="32" r="15" fill="none" stroke="url(#rb)" stroke-width="${stroke}"/>`,
    `<circle cx="25" cy="32" r="15" fill="none" stroke="#050608" stroke-opacity=".6" stroke-width="${shadow}" clip-path="url(#top)" mask="url(#mb)"/>`,
    `<circle cx="25" cy="32" r="15" fill="none" stroke="url(#ra)" stroke-width="${stroke}" clip-path="url(#top)"/>`,
    `<circle cx="32" cy="32" r="7" fill="url(#sg)"/>`,
    `<path d="${STAR}" fill="#FFFDF5"/>`,
  ].join('');
}

const MARK_DEFS = [
  '<linearGradient id="lens" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7AE"/><stop offset=".5" stop-color="#E7AC45"/><stop offset="1" stop-color="#9A640C"/></linearGradient>',
  '<linearGradient id="ra" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#BFB8A8"/></linearGradient>',
  '<linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F7C873"/><stop offset="1" stop-color="#A36B0C"/></linearGradient>',
  '<radialGradient id="sg"><stop offset="0" stop-color="#FFF6DC" stop-opacity=".95"/><stop offset="1" stop-color="#FFF6DC" stop-opacity="0"/></radialGradient>',
  '<clipPath id="top"><circle cx="32" cy="18.73" r="6"/></clipPath>',
  '<clipPath id="bot"><circle cx="32" cy="45.27" r="6"/></clipPath>',
  '<mask id="ma" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><circle cx="25" cy="32" r="15" fill="none" stroke="#fff" stroke-width="4"/></mask>',
  '<mask id="mb" maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64"><circle cx="39" cy="32" r="15" fill="none" stroke="#fff" stroke-width="4"/></mask>',
].join('');

/** App icon master, 1024 units. `rounded` draws the tile shape; iOS and maskable icons stay full bleed. */
function appIcon(rounded: boolean, stroke = 3.2) {
  const tile = rounded ? '<clipPath id="tile"><rect width="1024" height="1024" rx="230"/></clipPath>' : '';
  const stars = [
    [196, 226, 6, '#F5F2EA', 0.55],
    [822, 188, 4.5, '#F5F2EA', 0.45],
    [866, 430, 5, '#E7AC45', 0.6],
    [150, 520, 3.5, '#F5F2EA', 0.4],
    [336, 140, 3, '#F5F2EA', 0.5],
  ]
    .map(([x, y, r, c, o]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" fill-opacity="${o}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><defs>${MARK_DEFS}
<radialGradient id="bg" cx="50%" cy="40%" r="78%"><stop offset="0" stop-color="#2A2F38"/><stop offset=".55" stop-color="#15181D"/><stop offset="1" stop-color="#0A0B0E"/></radialGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#E7AC45" stop-opacity=".6"/><stop offset=".45" stop-color="#C98A1B" stop-opacity=".18"/><stop offset="1" stop-color="#C98A1B" stop-opacity="0"/></radialGradient>
<linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".16"/><stop offset=".45" stop-color="#FFFFFF" stop-opacity="0"/></linearGradient>${tile}</defs>
<g${rounded ? ' clip-path="url(#tile)"' : ''}>
<rect width="1024" height="1024" fill="url(#bg)"/>
<circle cx="512" cy="500" r="430" fill="url(#glow)"/>
<ellipse cx="512" cy="700" rx="392" ry="92" fill="none" stroke="#E7AC45" stroke-opacity=".22" stroke-width="5"/>
${stars}
<g transform="translate(512 500) scale(11.6) translate(-32 -32)">${mark(stroke)}</g>
<rect width="1024" height="1024" fill="url(#sheen)"/>
</g>${rounded ? '<rect x="2" y="2" width="1020" height="1020" rx="228" fill="none" stroke="#FFFFFF" stroke-opacity=".08" stroke-width="4"/>' : ''}</svg>`;
}

/** Favicon drawing for tab sizes: thicker rings, no weave. The edge only shows in dark tab bars. */
function favicon(withStar: boolean) {
  const star = withStar ? '<path d="M32 25.5Q32.8 31.2 38.5 32Q32.8 32.8 32 38.5Q31.2 32.8 25.5 32Q31.2 31.2 32 25.5Z" fill="#FFFFFF"/>' : '';
  const width = withStar ? 5 : 5.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE1A0"/><stop offset="1" stop-color="#C2820F"/></linearGradient></defs>
<style>.edge{stroke:#F5F2EA;stroke-opacity:0}@media (prefers-color-scheme:dark){.edge{stroke-opacity:.22}}</style>
<rect width="64" height="64" rx="14" fill="#0F1114"/>
<rect class="edge" x="1" y="1" width="62" height="62" rx="13" fill="none" stroke-width="2"/>
<path d="M32 17.58A17 17 0 0 1 32 46.42A17 17 0 0 1 32 17.58Z" fill="${withStar ? 'url(#l)' : '#F2BC55'}"/>
<circle cx="23" cy="32" r="17" fill="none" stroke="#F5F2EA" stroke-width="${width}"/>
<circle cx="41" cy="32" r="17" fill="none" stroke="#D4951F" stroke-width="${width}"/>${star}</svg>`;
}

/** Notification badge: white on transparent, star cut out of the lens. */
function badge() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="4 12 56 40"><defs><mask id="m"><rect x="0" y="0" width="64" height="64" fill="#fff"/><path d="${STAR}" fill="#000"/></mask></defs>
<path d="${LENS}" fill="#fff" mask="url(#m)"/>
<circle cx="25" cy="32" r="15" fill="none" stroke="#fff" stroke-width="4"/>
<circle cx="39" cy="32" r="15" fill="none" stroke="#fff" stroke-width="4"/></svg>`;
}

const png = (svg: string, size: number) => sharp(Buffer.from(svg), { density: 384 }).resize(size, size).png({ compressionLevel: 9, palette: true, quality: 95, effort: 10, dither: 1 }).toBuffer();

/** ICO container holding PNG frames (supported by every current browser and by Windows since Vista). */
function ico(frames: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, data }, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...frames.map((f) => f.data)]);
}

async function main() {
  const pub = path.join(process.cwd(), 'public');
  const out = path.join(pub, 'icons');
  fs.mkdirSync(out, { recursive: true });

  fs.writeFileSync(path.join(out, 'icon.svg'), favicon(true));
  const tile = appIcon(true);
  const bleed = appIcon(false);
  fs.writeFileSync(path.join(out, 'icon-192.png'), await png(appIcon(true, 3.6), 192));
  fs.writeFileSync(path.join(out, 'icon-512.png'), await png(tile, 512));
  fs.writeFileSync(path.join(out, 'maskable-512.png'), await png(bleed, 512));
  fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), await png(appIcon(false, 3.6), 180));
  fs.writeFileSync(path.join(out, 'badge-96.png'), await png(badge(), 96));
  fs.writeFileSync(
    path.join(pub, 'favicon.ico'),
    ico([
      { size: 16, data: await png(favicon(false), 16) },
      { size: 32, data: await png(favicon(true), 32) },
      { size: 48, data: await png(favicon(true), 48) },
    ]),
  );
  fs.rmSync(path.join(out, 'maskable.svg'), { force: true });
  console.log('Icons written.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
