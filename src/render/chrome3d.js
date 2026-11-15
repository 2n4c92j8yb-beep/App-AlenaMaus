// Live 3D chrome for Present mode, with Three.js (vendor/three.module.min.js, MIT),
// loaded only when a presented slide has a chrome object. Each sphere, ring or
// capsule is the same polished metal in the same studio as its baked picture
// (studio.js), so nothing jumps when the live version fades in; then the
// reflections drift slowly. The baked picture stays underneath: without WebGL it
// simply remains what people see. Thumbnails, the slide list and exports use the
// baked pictures, so phones stay fast and files stay small.

import { buildEnvironment, makeChromeMesh, fitCamera } from './studio.js';

let threeP;
const loadThree = () => (threeP ??= import('../../vendor/three.module.min.js'));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = 1.0;
    const scene = new THREE.Scene();
    const studio = node.dataset.studio ?? 'prism';
    const holo = !!node.dataset.holo;
    scene.environment = buildEnvironment(THREE, renderer, studio, { holo });
    const aspect = w / h;
    const mesh = makeChromeMesh(THREE, node.dataset.kind, aspect, studio, holo);
    const camera = fitCamera(THREE, mesh, aspect);
    const base = { x: mesh.rotation.x, y: mesh.rotation.y };
    scene.add(mesh);
    const obj = node.querySelector('.chrome-obj') ?? node;
    obj.append(canvas);
    const flat = obj.querySelector('img, svg');
    let raf = 0;
    const start = performance.now();
    const draw = (t) => {
      const s = (t - start) / 1000;
      if (scene.environmentRotation) scene.environmentRotation.y = (node.dataset.kind === 'sphere' ? 0.5 : 0.2) + Math.sin(s * 0.16) * 0.5; // reflections drift slowly
      if (node.dataset.kind !== 'sphere') mesh.rotation.y = base.y + Math.sin(s * 0.35) * 0.3;
      renderer.render(scene, camera);
      if (!reduced() && !handle.stopped) raf = requestAnimationFrame(draw);
    };
    draw(start);
    requestAnimationFrame(() => {
      canvas.style.opacity = '1';
      if (flat) { flat.style.transition = 'opacity 600ms ease'; flat.style.opacity = '0'; }
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
