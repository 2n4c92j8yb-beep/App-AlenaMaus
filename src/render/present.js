// Present-mode choreography with GSAP (vendor/gsap.min.js, loaded as a global).
//
// Each slide gets one entrance that reads as one gesture, then the presenter paces
// the rest with clicks where order carries meaning (process steps, timeline
// events, list points, the second side of a comparison). Rules, after the
// project's motion skills:
//   - one lead per slide (the headline, or the key figure); support follows with
//     smaller moves; decoration (textures, light, chrome) only fades
//   - staggers shrink as the group goes on, never a uniform metronome
//   - exits are simultaneous and shorter than entrances
//   - forward enters from the right, back from the left
//   - a click mid-animation finishes it instead of stacking a second one
//   - one ambient motion per slide at most (chrome floats, or the light drifts)
//   - reduce motion: no movement and no delays, opacity only
// Without GSAP the slides still appear: the CSS build in styles.css takes over.

const gsapLib = () => (typeof window !== 'undefined' ? window.gsap : undefined);
export const hasGsap = () => !!gsapLib();
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// slide forms whose items the presenter reveals one click at a time
const PACED = new Set(['process', 'timeline', 'points', 'comparison', 'pair']);

const els = (frame) => [...frame.querySelectorAll('.slide > [data-seq]')];
const seqOf = (n) => Number(n.dataset.seq ?? 0);

/** Slide transition between two frames, styled by the look. */
export function transition(oldFrame, newFrame, family, dir) {
  const g = gsapLib();
  if (!g || !oldFrame || reduced()) { oldFrame?.remove(); return; }
  const done = () => oldFrame.remove();
  if (family === 'poster') { done(); return; }                     // a hard cut; the photo eases in on its own
  if (family === 'glass') {
    g.to(oldFrame, { opacity: 0, filter: 'blur(10px)', duration: 0.32, ease: 'power2.in', onComplete: done });
    g.fromTo(newFrame, { opacity: 0, filter: 'blur(10px)' }, { opacity: 1, filter: 'blur(0px)', duration: 0.5, ease: 'power3.out', clearProps: 'filter' });
    return;
  }
  // editorial and texture: a calm slide-over in the direction of travel
  g.to(oldFrame, { xPercent: -4 * dir, opacity: 0, duration: 0.3, ease: 'power2.in', onComplete: done });
  g.fromTo(newFrame, { xPercent: 6 * dir, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.55, ease: 'power3.out' });
}

/**
 * Choreograph one slide. Returns a controller:
 *   next()   reveal the next click step; false when the slide is complete
 *   finish() show everything at once
 *   stop()   kill running and ambient motion (called when the slide leaves)
 */
export function playSlide(frame, slide, { complete = false } = {}) {
  const g = gsapLib();
  const nodes = els(frame);
  const noop = { next: () => false, finish() {}, stop() {} };
  if (!g) return noop;
  frame.querySelector('.slide')?.classList.add('is-gsap');
  const still = reduced();
  const form = slide.form;
  const paced = PACED.has(form);
  const groups = [...new Set(nodes.map(seqOf))].filter((s) => s > 0).sort((a, b) => a - b);
  // the entrance shows the headline and the first content group; later groups wait for clicks
  const autoUpTo = paced ? 2 : Infinity;
  const pending = groups.filter((s) => s > autoUpTo);
  const deco = nodes.filter((n) => seqOf(n) === 0 && n !== nodes[0] && ['svg', 'chrome'].includes(n.dataset.type) || n.dataset.soft);
  let tl = null;
  let ambient = null;

  // many elements carry their own transparency (soft light, timeline segments, textures):
  // every fade ends at the element's own opacity, never at full strength
  nodes.forEach((n) => { if (n.dataset.o === undefined) n.dataset.o = n.style.opacity || '1'; });
  const own = (i, n) => Number(n.dataset.o);
  const hide = (list) => g.set(list, { autoAlpha: 0 });
  const show = (list) => g.set(list, { autoAlpha: own, x: 0, y: 0, scaleX: 1, filter: 'none' });

  if (complete) {
    show(nodes);
    startAmbient();
    return controller();
  }

  hide(nodes.filter((n) => seqOf(n) > 0));
  hide(deco);
  tl = g.timeline({ defaults: { ease: 'power3.out' } });
  // decoration fades in place, never moves in
  if (deco.length) tl.to(deco, { autoAlpha: own, duration: still ? 0.2 : 0.9, ease: 'power1.out' }, 0);
  // Poster: the mood photo settles from a slight zoom while the words arrive
  const mood = nodes.filter((n) => n.dataset.mood);
  if (mood.length && !still) tl.fromTo(mood, { scale: 1.06 }, { scale: 1, duration: 1.4, ease: 'power2.out' }, 0);

  const auto = groups.filter((s) => s <= autoUpTo);
  // shrinking gaps: 0, 120, 200, 260 … so the group reads as one wave, not a queue
  const at = (k) => (still ? 0 : [0, 0.12, 0.2, 0.26, 0.31, 0.35][Math.min(k, 5)] + Math.max(0, k - 5) * 0.03);
  auto.forEach((s, k) => {
    const list = nodes.filter((n) => seqOf(n) === s);
    enter(tl, list, k === 0 ? 'lead' : 'support', at(k) + (deco.length && !still ? 0.1 : 0), s);
  });
  countUp(tl);
  startAmbient();
  return controller();

  // ---------------------------------------------------------------- helpers

  function enter(timeline, list, role, position, s) {
    if (!list.length) return;
    if (still) { timeline.to(list, { autoAlpha: own, duration: 0.2 }, position); return; }
    const rise = role === 'lead' ? 14 : 8;
    const dur = role === 'lead' ? 0.62 : 0.48;
    // timeline bars grow along the time axis; the second side of a comparison comes from its side
    const bars = form === 'timeline' ? list.filter((n) => n.dataset.type === 'rect') : [];
    const rest = list.filter((n) => !bars.includes(n));
    if (bars.length) timeline.fromTo(bars, { autoAlpha: own, scaleX: 0, transformOrigin: '0% 50%' }, { autoAlpha: own, scaleX: 1, duration: 0.55, ease: 'power2.out' }, position);
    if (form === 'comparison' && s >= 2) {
      const fromX = s >= 4 ? 18 : -18;
      timeline.fromTo(rest, { autoAlpha: 0, x: fromX }, { autoAlpha: own, x: 0, duration: dur }, position);
      return;
    }
    // quotes and statements sharpen into focus instead of travelling
    if (role === 'lead' && ['quote', 'statement', 'definition', 'question'].includes(form)) {
      timeline.fromTo(rest, { autoAlpha: 0, filter: 'blur(6px)', y: 6 }, { autoAlpha: own, filter: 'blur(0px)', y: 0, duration: 0.8, clearProps: 'filter' }, position);
      return;
    }
    timeline.fromTo(rest, { autoAlpha: 0, y: rise }, { autoAlpha: own, y: 0, duration: dur, stagger: rest.length > 1 ? 0.04 : 0 }, position);
  }

  /** The key figure counts up to its value (bigNumber slides only). */
  function countUp(timeline) {
    if (form !== 'bigNumber' || still) return;
    const texts = nodes.filter((n) => n.dataset.type === 'text');
    if (!texts.length) return;
    const fig = texts.reduce((p, q) => (Number(q.dataset.size) > Number(p.dataset.size) ? q : p));
    const p = fig.querySelector('p');
    const m = p && /^(\D*?)(\d+(?:[.,]\d+)?)(.*)$/.exec(p.textContent);
    if (!m) return;
    const [, pre, num, post] = m;
    const sep = num.includes(',') ? ',' : '.';
    const decimals = (num.split(/[.,]/)[1] ?? '').length;
    const target = Number(num.replace(',', '.'));
    const counter = { v: 0 };
    const final = p.textContent;
    timeline.to(counter, {
      v: target, duration: Math.min(1.4, 0.6 + target / 100), ease: 'power2.out',
      onUpdate: () => { p.textContent = `${pre}${counter.v.toFixed(decimals).replace('.', sep)}${post}`; },
      onComplete: () => { p.textContent = final; },
    }, 0.15);
  }

  /** One gentle ambient motion: the largest chrome object floats, otherwise the light drifts. */
  function startAmbient() {
    if (still) return;
    const chrome = nodes.filter((n) => n.dataset.type === 'chrome');
    const light = nodes.filter((n) => n.dataset.soft);
    if (chrome.length) {
      const big = chrome.reduce((a, b) => (a.offsetWidth * a.offsetHeight >= b.offsetWidth * b.offsetHeight ? a : b));
      ambient = g.to(big, { y: -8, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    } else if (light.length) {
      ambient = g.to(light, { x: 'random(-24, 24)', y: 'random(-16, 16)', duration: 9, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: 0.6 });
    }
  }

  function controller() {
    return {
      next() {
        if (tl && tl.isActive()) { tl.progress(1); return true; }   // finish, don't stack
        const s = pending.shift();
        if (s === undefined) return false;
        const list = nodes.filter((n) => seqOf(n) === s);
        tl = g.timeline({ defaults: { ease: 'power3.out' } });
        enter(tl, list, 'support', 0, s);
        return true;
      },
      finish() {
        tl?.progress(1);
        pending.splice(0).forEach((s) => show(nodes.filter((n) => seqOf(n) === s)));
      },
      remaining: () => pending.length,
      stop() { tl?.kill(); ambient?.kill(); g.killTweensOf(nodes); },
    };
  }
}
