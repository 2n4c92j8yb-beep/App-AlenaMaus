// Real 3D chrome for Present mode, with Three.js (vendor/three.module.min.js, MIT),
// loaded only when a presented slide has a chrome object. Each sphere, ring or
// capsule is rendered as polished metal that reflects a small studio (softboxes
// and coloured light), and the reflections drift slowly. The flat vector drawing
// stays underneath: if WebGL is missing, it simply remains what people see.
// Thumbnails, the slide list and exports keep the vector drawings, so phones stay
// fast and files stay small.

let threeP;
const loadThree = () => (threeP ??= import('../../vendor/three.module.min.js'));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const STUDIO = {
  silver: { base: 0xffffff, lights: [0xffffff, 0x6cf0e0, 0xb9a4ff, 0xff9ccf] },
  gold: { base: 0xe9c48a, lights: [0xfff3dd, 0xe2b66b, 0xffd9a8, 0x8a5a26] },
};

/** A small studio for the metal to reflect: dark floor, bright sky, softboxes and coloured cards. */
function environment(THREE, renderer, tint) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(10, 32, 16),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }),
  );
  const pos = dome.geometry.attributes.position;
  const colors = [];
  // classic chrome: bright sky, a dark horizon band, a lighter floor
  const sky = new THREE.Color(0xf4f5f8); const horizon = new THREE.Color(0x16181f); const floor = new THREE.Color(0x9a9eab);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 10 + 1) / 2;
    const c = t > 0.53 ? horizon.clone().lerp(sky, Math.min(1, (t - 0.53) / 0.3))
      : t < 0.45 ? horizon.clone().lerp(floor, Math.min(1, (0.45 - t) / 0.35))
      : horizon.clone();
    colors.push(c.r, c.g, c.b);
  }
  dome.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  env.add(dome);
  const lights = STUDIO[tint]?.lights ?? STUDIO.silver.lights;
  const card = (color, w, h, x, y, z, intensity) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  card(lights[0], 6, 2.2, 0, 6, 3, 3.2);     // key softbox above
  card(lights[0], 1.4, 5, -6, 1, 2, 2.2);    // strip light left
  card(lights[1], 3, 4, 6, 0, -1, 1.6);      // coloured card right
  card(lights[2], 4, 2, -2, -1, -6, 1.3);    // coloured card behind
  card(lights[3], 2, 2, 3, -4, 4, 1.0);      // low accent
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return tex;
}

function makeObject(THREE, kind, aspect, tint, holo) {
  let geo;
  if (kind === 'sphere') geo = new THREE.SphereGeometry(0.5, 96, 64);
  else if (kind === 'ring') geo = new THREE.TorusGeometry(0.42, 0.075, 64, 160);
  else {
    // capsule: length along the longer side of its box
    const long = Math.max(aspect, 1 / aspect);
    const r = 0.5 / long;
    geo = new THREE.CapsuleGeometry(r, 1 - 2 * r, 24, 64);
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: STUDIO[tint]?.base ?? 0xffffff, metalness: 1, roughness: 0.1,
    clearcoat: 0.6, clearcoatRoughness: 0.08,
    iridescence: holo ? 1 : 0, iridescenceIOR: 1.7, iridescenceThicknessRange: [250, 900],
  });
  const mesh = new THREE.Mesh(geo, mat);
  if (kind === 'capsule' && aspect > 1) mesh.rotation.z = Math.PI / 2;
  if (kind === 'ring') mesh.rotation.x = 0.35;
  return mesh;
}

/**
 * Upgrade the chrome objects on a presented slide to 3D.
 * Returns { stop() } so the slide can release the GPU when it leaves.
 */
export async function upgradeChrome(frame) {
  const nodes = [...frame.querySelectorAll('.slide > [data-type="chrome"]')];
  const handle = { stopped: false, parts: [], stop() { this.stopped = true; this.parts.forEach((p) => p()); this.parts = []; } };
  if (!nodes.length) return handle;
  let THREE;
  try { THREE = await loadThree(); } catch { return handle; }
  if (handle.stopped) return handle;
  const scale = frame.getBoundingClientRect().width / 1280; // the slide is drawn at 1280 px and scaled
  for (const node of nodes) {
    if (handle.stopped) break;
    const w = node.offsetWidth; const h = node.offsetHeight;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, { position: 'absolute', inset: '0', width: `${w}px`, height: `${h}px`, opacity: '0', transition: 'opacity 600ms ease' });
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    } catch { continue; } // no WebGL: the vector drawing stays
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);
    renderer.setSize(Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale)), false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const scene = new THREE.Scene();
    const tint = node.dataset.tint ?? 'silver';
    scene.environment = environment(THREE, renderer, tint);
    const aspect = w / h;
    const camera = new THREE.OrthographicCamera(-0.5 * Math.max(aspect, 1), 0.5 * Math.max(aspect, 1), 0.5 * Math.max(1 / aspect, 1), -0.5 * Math.max(1 / aspect, 1), 0.1, 10);
    camera.position.set(0, 0, 3);
    const mesh = makeObject(THREE, node.dataset.kind, aspect, tint, !!node.dataset.holo);
    // fill the box like the vector drawing does
    const box = new THREE.Box3().setFromObject(mesh);
    const size = box.getSize(new THREE.Vector3());
    const fit = Math.min((camera.right - camera.left) / size.x, (camera.top - camera.bottom) / size.y) * 0.98;
    mesh.scale.setScalar(fit);
    scene.add(mesh);
    node.append(canvas);
    const svg = node.querySelector('svg');
    let raf = 0;
    const start = performance.now();
    const draw = (t) => {
      const s = (t - start) / 1000;
      if (scene.environmentRotation) scene.environmentRotation.y = s * 0.18; // reflections drift slowly
      if (node.dataset.kind !== 'sphere') mesh.rotation.y = Math.sin(s * 0.35) * 0.35;
      renderer.render(scene, camera);
      if (!reduced() && !handle.stopped) raf = requestAnimationFrame(draw);
    };
    draw(start);
    requestAnimationFrame(() => {
      canvas.style.opacity = '1';
      if (svg) { svg.style.transition = 'opacity 600ms ease'; svg.style.opacity = '0'; }
    });
    handle.parts.push(() => {
      cancelAnimationFrame(raf);
      scene.environment?.dispose();
      mesh.geometry.dispose();
      mesh.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    });
  }
  return handle;
}
