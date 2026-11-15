// The photo studio the Glass look's chrome objects are rendered in, shared by the
// baking script (tools/render-chrome.html → src/render/chrome/*.webp, used in previews,
// thumbnails and the PowerPoint export) and by Present mode's live 3D (chrome3d.js),
// so both show the same metal in the same light.
//
// What makes chrome read as real is what it reflects: a bright sky, a crisp dark
// horizon, a lighter floor, soft-edged light panels (a large key box, two strip
// lights, a rim light) and coloured cards in the direction's own palette, so each
// object picks up the colours of the slide it sits on.

/** One studio per Glass direction: metal tint, coloured cards, and the light it throws onto the slide. */
export const STUDIOS = {
  prism: {
    tint: 'silver', cards: ['#6CF0E0', '#B9A4FF', '#FF9CCF'],
    sky: '#6E7385', horizon: '#05060A', floor: '#4D5366',
    shadow: { color: '#000000', alpha: 0.55 }, bounce: { color: '#6CF0E0', alpha: 0.16 },
  },
  pearl: {
    tint: 'silver', cards: ['#B9A4FF', '#6CF0E0', '#FF9CCF'],
    sky: '#D3D5E0', horizon: '#545270', floor: '#B4B2C6',
    shadow: { color: '#1E1C3C', alpha: 0.18 }, bounce: { color: '#B9A4FF', alpha: 0.12 },
  },
  halo: {
    tint: 'gold', cards: ['#E2B66B', '#8A5A26', '#FFE7B8'],
    sky: '#FFF4E0', horizon: '#120C05', floor: '#6B5232',
    shadow: { color: '#000000', alpha: 0.6 }, bounce: { color: '#E2B66B', alpha: 0.2 },
  },
};

export const METAL = {
  silver: { color: 0xf1f3f7, roughness: 0.07 },
  gold: { color: 0xe9c27a, roughness: 0.11 },
};

/** The baked picture of a chrome element: one per studio, shape and finish. */
export function chromeSrc(el) {
  if (!el.studio || !STUDIOS[el.studio]) return null;
  const shape = el.kind === 'capsule' ? (el.h >= el.w ? 'capsule-v' : 'capsule-h') : el.kind;
  return `src/render/chrome/${el.studio}-${shape}${el.holo ? '-holo' : ''}.webp`;
}

/** Aspect (width / height) each baked capsule is rendered at; boxes within ±15% stretch to fit. */
export const CAPSULE_ASPECT = 3.4;

/** A soft-edged light panel texture: bright core, feathered edges (like a softbox's diffuser). */
function softbox(THREE, feather = 0.18) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = Math.min(x, 255 - x) / 255;
    const dy = Math.min(y, 255 - y) / 255;
    const e = Math.min(1, Math.min(dx, dy) / feather);
    const v = Math.round(255 * e * e * (3 - 2 * e));
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
    img.data[i + 3] = v;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Build the studio as an environment map for physically based metal. With `holo`, the sky
 * becomes a sweep of the direction's colours around the object: holographic chrome gets its
 * rainbow from what it reflects, the thin-film shimmer only adds to it.
 */
export function buildEnvironment(THREE, renderer, studioId, { holo = false } = {}) {
  const s = STUDIOS[studioId] ?? STUDIOS.prism;
  const env = new THREE.Scene();
  // the dome: sky above, a crisp dark horizon band, a lighter floor below
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 32),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true, toneMapped: false }),
  );
  const pos = dome.geometry.attributes.position;
  const sky = new THREE.Color(s.sky); const hor = new THREE.Color(s.horizon); const floor = new THREE.Color(s.floor);
  const colors = [];
  const sweep = s.cards.map((x) => new THREE.Color(x));
  const skyAt = (i) => {
    if (!holo) return sky;
    // hue sweep by azimuth, a little lighter towards the zenith
    const a = (Math.atan2(pos.getZ(i), pos.getX(i)) / (2 * Math.PI) + 1) % 1;
    const k = a * sweep.length;
    const c = sweep[Math.floor(k) % sweep.length].clone().lerp(sweep[(Math.floor(k) + 1) % sweep.length], k % 1);
    return c.multiplyScalar(0.8).lerp(sky, 0.25);
  };
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / 20; // -1 floor … 1 zenith
    let c;
    if (t > 0.06) c = hor.clone().lerp(skyAt(i), Math.min(1, (t - 0.06) / 0.22) ** 0.6);
    else if (t > -0.04) c = hor.clone();
    else c = hor.clone().lerp(floor, Math.min(1, (-0.04 - t) / 0.5));
    colors.push(c.r, c.g, c.b);
  }
  dome.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  env.add(dome);

  const tex = softbox(THREE);
  const panel = (color, w, h, x, y, z, intensity, feathered = true) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), map: feathered ? tex : null, transparent: feathered, side: THREE.DoubleSide, toneMapped: false }),
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel('#FFFFFF', 9, 4, -1.5, 9, 6, 7);        // large key softbox above and in front
  panel('#FFFFFF', 1.6, 9, -9, 1.5, 3, 4.2);    // tall strip light, left
  panel('#FFFFFF', 1.2, 7, 8, 2, -2, 2.6);      // narrower strip, right
  panel('#FFFFFF', 7, 1.4, 0, 3, -10, 3);       // rim light behind
  panel(s.cards[0], 5, 6, 9, -1, 4, 3);         // coloured cards pick up the slide's palette
  panel(s.cards[1], 6, 4, -6, -3, -7, 2.6);
  panel(s.cards[2], 5, 3, 2, -7, 5, 2.4);
  panel(s.cards[0], 3, 3, -7, -4, 6, 2);
  panel('#FFFFFF', 0.7, 0.7, -3, 6, 9, 14);     // a small hot spot: the specular sparkle

  const pmrem = new THREE.PMREMGenerator(renderer);
  const map = pmrem.fromScene(env, 0.012).texture;
  pmrem.dispose();
  tex.dispose();
  return map;
}

/** A chrome object as polished, clear-coated metal; iridescent ones get a thin-film shimmer. */
export function makeChromeMesh(THREE, kind, aspect, studioId, holo) {
  const metal = METAL[STUDIOS[studioId]?.tint ?? 'silver'];
  let geo;
  if (kind === 'sphere') geo = new THREE.SphereGeometry(0.5, 128, 96);
  else if (kind === 'ring') geo = new THREE.TorusGeometry(0.4, 0.09, 96, 256);
  else {
    const long = Math.max(aspect, 1 / aspect);
    const r = 0.5 / long;
    geo = new THREE.CapsuleGeometry(r, 1 - 2 * r, 32, 96);
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: metal.color, metalness: 1, roughness: holo ? 0.06 : metal.roughness,
    // a clear coat adds the lacquered sparkle of polished chrome; on iridescent pieces it would wash out the film
    clearcoat: holo ? 0 : 1, clearcoatRoughness: 0.03, envMapIntensity: holo ? 1.35 : 1.2,
    iridescence: holo ? 1 : 0, iridescenceIOR: 2.2, iridescenceThicknessRange: [280, 1150],
  });
  const mesh = new THREE.Mesh(geo, mat);
  // turn the shapes so their volume reads: a ring tilted towards the camera, a capsule slightly rolled
  // a capsule tipped slightly towards the camera reflects sky, horizon and floor along its length
  if (kind === 'capsule') { mesh.rotation.x = aspect > 1 ? 0 : 0.42; if (aspect > 1) { mesh.rotation.z = Math.PI / 2; mesh.rotation.y = 0.42; } }
  if (kind === 'ring') { mesh.rotation.x = 0.55; mesh.rotation.y = -0.3; }
  if (kind === 'sphere') mesh.rotation.y = 0.6;
  return mesh;
}

/** An orthographic camera and scale that make the mesh fill a w × h box. */
export function fitCamera(THREE, mesh, aspect, fill = 0.97) {
  const camera = new THREE.OrthographicCamera(-0.5 * Math.max(aspect, 1), 0.5 * Math.max(aspect, 1), 0.5 * Math.max(1 / aspect, 1), -0.5 * Math.max(1 / aspect, 1), 0.1, 10);
  camera.position.set(0, 0, 3);
  const size = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
  mesh.scale.setScalar(Math.min((camera.right - camera.left) / size.x, (camera.top - camera.bottom) / size.y) * fill);
  return camera;
}

/**
 * The soft shadow (and, on dark slides, the coloured light bounce) a floating object throws
 * onto the slide, as ellipses in inches relative to the element's box. Shared by the preview
 * (html.js) and the PowerPoint export, so both ground the object the same way.
 */
export function groundFor(el) {
  const s = STUDIOS[el.studio];
  if (!s) return [];
  // the object's visual footprint, after rotation
  const a = ((el.rotate ?? 0) * Math.PI) / 180;
  const bw = Math.abs(el.w * Math.cos(a)) + Math.abs(el.h * Math.sin(a));
  const bh = Math.abs(el.w * Math.sin(a)) + Math.abs(el.h * Math.cos(a));
  const cx = el.x + el.w / 2;
  const bottom = el.y + el.h / 2 + bh / 2;
  const w = bw * 0.82;
  const h = Math.max(0.18, Math.min(bw, bh) * 0.16);
  return [
    { x: cx - (w * 1.25) / 2, y: bottom - h * 0.2, w: w * 1.25, h: h * 2.2, color: s.bounce.color, alpha: s.bounce.alpha },
    { x: cx - w / 2, y: bottom + h * 0.15, w, h, color: s.shadow.color, alpha: s.shadow.alpha },
  ];
}
