if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// ===== CONFIGURATION =====
const FOOD_FRAME_COUNT = 50;
const STATUE_FRAME_COUNT = 63;
const FRAME_SPEED = 2.6;
const IMAGE_SCALE = 1.0;
const IMAGE_SCALE_MOBILE = 0.72;

const FOOD_DRAW_OPTS = { vBiasMobile: -40 };
const STATUE_DRAW_OPTS = {
  scaleDesktop: 1.0,
  scaleMobile: 1.05,
  vBiasDesktop: 40,
  vBiasMobile: 50,
  hBiasDesktop: 0,
  hBiasMobile: -220,
  feather: true
};

// ===== DOM =====
const canvasFood = document.getElementById('canvas-food');
const ctxFood = canvasFood.getContext('2d');
const canvasStatue = document.getElementById('canvas-statue');
const ctxStatue = canvasStatue.getContext('2d');

const canvasWrapFood = document.getElementById('canvas-wrap');
const canvasWrapStatue = document.getElementById('canvas-wrap-statue');
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');

// ===== STATE =====
const foodFrames = [];
const statueFrames = [];
let currentFoodFrame = 0;
let currentStatueFrame = 0;

// ===== LENIS =====
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.5
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

const HEADER_SCROLL_OFFSET = 96;

function initInPageAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const id = href.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      lenis.scrollTo(target, { offset: -HEADER_SCROLL_OFFSET, duration: 1.35 });
    });
  });
}

// ===== MOBILE MENU =====
function setMobileNavOpen(open) {
  if (!mobileNav || !menuToggle) return;
  mobileNav.classList.toggle('open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  menuToggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
}

if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    setMobileNavOpen(!mobileNav.classList.contains('open'));
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMobileNavOpen(false));
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !mobileNav || !mobileNav.classList.contains('open')) return;
  setMobileNavOpen(false);
  if (menuToggle) menuToggle.focus();
});

// ===== CANVAS SETUP =====
let stableW = document.documentElement.clientWidth;
let stableH = window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
let stableDPR = window.devicePixelRatio || 1;
let stableMobile = stableW < 768;

function getStableHeight() {
  return window.visualViewport ? window.visualViewport.height : document.documentElement.clientHeight;
}

function updateStableDimensions(forceHeight) {
  const newW = document.documentElement.clientWidth;
  stableW = newW;
  stableMobile = newW < 768;
  stableDPR = window.devicePixelRatio || 1;
  if (forceHeight) {
    stableH = getStableHeight();
  }
}

function setupCanvas(canvas, ctx) {
  const pad = 2;
  canvas.width = (stableW + pad) * stableDPR;
  canvas.height = (stableH + pad) * stableDPR;
  canvas.style.width = (stableW + pad) + 'px';
  canvas.style.height = (stableH + pad) + 'px';
  ctx.setTransform(stableDPR, 0, 0, stableDPR, 0, 0);
}

function isMobile() { return stableMobile; }

function drawFrame(ctx, frames, index, bgColor, opts) {
  const img = frames[index];
  if (!img) return;
  const o = opts || {};

  const cw = stableW;
  const ch = stableH;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const mobile = stableMobile;
  const scaleOverride = mobile ? (o.scaleMobile || IMAGE_SCALE_MOBILE) : (o.scaleDesktop || IMAGE_SCALE);
  const scale = Math.max(cw / iw, ch / ih) * scaleOverride;

  const dw = iw * scale;
  const dh = ih * scale;

  const hBias = mobile ? (o.hBiasMobile || 0) : (o.hBiasDesktop || 0);
  const vBias = mobile ? (o.vBiasMobile || 0) : (o.vBiasDesktop || 0);
  const dx = (cw - dw) / 2 + hBias;
  const dy = (ch - dh) / 2 + vBias;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);

  if (mobile && o.feather) {
    const f = 80;
    const topG = ctx.createLinearGradient(0, 0, 0, f);
    topG.addColorStop(0, bgColor);
    topG.addColorStop(1, 'transparent');
    ctx.fillStyle = topG;
    ctx.fillRect(0, 0, cw, f);

    const botG = ctx.createLinearGradient(0, ch - f, 0, ch);
    botG.addColorStop(0, 'transparent');
    botG.addColorStop(1, bgColor);
    ctx.fillStyle = botG;
    ctx.fillRect(0, ch - f, cw, f);
  }
}

function loadImagePromise(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('img'));
    img.src = src;
  });
}

function nearestLoadedFrameIndex(frames, wantIdx) {
  for (let k = wantIdx; k >= 0; k--) {
    const im = frames[k];
    if (im && im.complete && im.naturalWidth) return k;
  }
  return 0;
}

function kickoffParallelFrameLoad(count, pathTemplate, targetArr, startIndex) {
  const start = startIndex == null ? 0 : startIndex;
  for (let i = start; i < count; i++) {
    if (targetArr[i]) continue;
    const img = new Image();
    const idx = i;
    img.onload = () => { targetArr[idx] = img; };
    img.onerror = () => {};
    img.src = pathTemplate.replace('NNNN', String(idx + 1).padStart(4, '0'));
  }
}

let statueLoadTriggered = false;
function triggerStatueFramesLoad() {
  if (statueLoadTriggered) return;
  statueLoadTriggered = true;
  kickoffParallelFrameLoad(STATUE_FRAME_COUNT, 'frames-statue/frame_NNNN.webp', statueFrames, 0);
}

function initStatueIdlePreload() {
  const zone = document.getElementById('artemis');
  const run = () => triggerStatueFramesLoad();
  if (zone) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { rootMargin: '480px 0px' }
    );
    io.observe(zone);
  }
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => run(), { timeout: 2800 });
  } else {
    setTimeout(run, 2200);
  }
}

async function initPreloaderQuick() {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloader-bar');
  const percent = document.getElementById('preloader-percent');
  try {
    const first = await loadImagePromise('frames/frame_0001.webp');
    foodFrames[0] = first;
    if (bar) bar.style.width = '100%';
    if (percent) percent.textContent = '100';
  } catch {
    if (bar) bar.style.width = '100%';
    if (percent) percent.textContent = '100';
  }
  await new Promise((r) => setTimeout(r, 220));
  if (preloader) preloader.classList.add('done');
  await new Promise((r) => setTimeout(r, 800));
  if (preloader) preloader.style.display = 'none';
}

// ===== HEADER SCROLL =====
function initHeader() {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

// ===== HERO ANIMATION — Letter Reveal =====
function initHeroAnimation() {
  const label = document.querySelector('.hero-content .label--hero');
  const letters = document.querySelectorAll('.hero-letter');
  const tagline = document.querySelector('.hero-tagline');
  const cta = document.querySelector('.hero-cta');
  const note = document.querySelector('.hero-reservation-note');
  const indicator = document.getElementById('scroll-indicator');

  const heroContent = document.querySelector('.hero-content');
  heroContent.style.visibility = 'visible';

  const tl = gsap.timeline({ delay: 0.15 });

  tl.from(label, { y: 10, opacity: 0, duration: 0.4, ease: 'power3.out' })
    .from(letters, {
      y: 40,
      opacity: 0,
      stagger: 0.035,
      duration: 0.5,
      ease: 'power4.out'
    }, '-=0.15')
    .from(tagline, { y: 10, opacity: 0, duration: 0.4, ease: 'power3.out' }, '-=0.15')
    .from(cta, { y: 10, opacity: 0, duration: 0.35, ease: 'power3.out' }, '-=0.15')
    .from(note, { opacity: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1')
    .from(indicator, { opacity: 0, duration: 0.3, ease: 'power2.out' }, '-=0.1');
}

// ===== HERO PARALLAX =====
function initHeroParallax() {
  const heroContent = document.querySelector('.hero-content');
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      const yShift = self.progress * 80;
      const fade = 1 - self.progress * 1.5;
      heroContent.style.transform = `translateY(${-yShift}px)`;
      heroContent.style.opacity = Math.max(0, fade);
    }
  });
}

// ===== FOOD CANVAS SCROLL =====
function initFoodCanvasScroll() {
  const hero = document.getElementById('hero');
  const zone = document.getElementById('kueche');

  canvasWrapFood.style.opacity = '1';

  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    endTrigger: zone,
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * FOOD_FRAME_COUNT), FOOD_FRAME_COUNT - 1);
      const useIdx = nearestLoadedFrameIndex(foodFrames, index);
      if (useIdx !== currentFoodFrame && foodFrames[useIdx]) {
        currentFoodFrame = useIdx;
        requestAnimationFrame(() => drawFrame(ctxFood, foodFrames, currentFoodFrame, '#F2E4CF', FOOD_DRAW_OPTS));
      }
    }
  });

  const speisekarte = document.getElementById('speisekarte');
  ScrollTrigger.create({
    trigger: speisekarte,
    start: 'top 80%',
    end: 'top top',
    scrub: true,
    onUpdate: (self) => {
      canvasWrapFood.style.opacity = 1 - self.progress;
    }
  });
}

// ===== MAP CONSENT =====
function initMapConsent() {
  const btn = document.getElementById('map-consent-btn');
  const consent = document.getElementById('map-consent');
  const iframe = document.getElementById('map-iframe');
  if (!btn || !consent || !iframe) return;

  btn.addEventListener('click', () => {
    iframe.src = 'https://www.google.com/maps?q=Restaurant+Artemis+Schnellerstra%C3%9Fe+97+12439+Berlin&output=embed';
    consent.classList.add('hidden');
  });
}

// ===== STATUE CANVAS SCROLL =====
function initStatueCanvasScroll() {
  const zone = document.getElementById('artemis');

  ScrollTrigger.create({
    trigger: zone,
    start: 'top 70%',
    end: 'top 20%',
    scrub: true,
    onUpdate: (self) => {
      canvasWrapStatue.style.opacity = self.progress;
    }
  });

  ScrollTrigger.create({
    trigger: zone,
    start: 'top 80%',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * STATUE_FRAME_COUNT), STATUE_FRAME_COUNT - 1);
      const useIdx = nearestLoadedFrameIndex(statueFrames, index);
      if (useIdx !== currentStatueFrame && statueFrames[useIdx]) {
        currentStatueFrame = useIdx;
        requestAnimationFrame(() => drawFrame(ctxStatue, statueFrames, currentStatueFrame, '#E8D5B8', STATUE_DRAW_OPTS));
      }
    }
  });

  ScrollTrigger.create({
    trigger: zone,
    start: 'bottom 60%',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      canvasWrapStatue.style.opacity = 1 - self.progress;
    }
  });
}

// ===== SECTION REVEAL ANIMATIONS — Varied per data-anim =====
function initRevealAnimations() {
  document.querySelectorAll('[data-anim]').forEach(el => {
    const type = el.dataset.anim;
    const delay = parseFloat(el.dataset.delay || '0');

    if (type === 'stagger-up') {
      const children = el.querySelectorAll('.stat, .review-card');
      gsap.from(children, {
        y: 50,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          toggleActions: 'play none none none'
        }
      });
      return;
    }

    const animProps = { opacity: 0, duration: 0.9, ease: 'power3.out', delay };

    switch (type) {
      case 'fade-up':
        animProps.y = 50;
        break;
      case 'slide-left':
        animProps.x = -60;
        animProps.y = 20;
        break;
      case 'slide-right':
        animProps.x = 60;
        animProps.y = 20;
        break;
      case 'scale-up':
        animProps.scale = 0.92;
        animProps.y = 30;
        animProps.duration = 1.0;
        animProps.ease = 'power2.out';
        break;
      case 'clip-reveal':
        animProps.clipPath = 'inset(8% 8% 8% 8%)';
        animProps.duration = 1.2;
        animProps.ease = 'power4.inOut';
        delete animProps.opacity;
        break;
      default:
        animProps.y = 50;
    }

    animProps.scrollTrigger = {
      trigger: el,
      start: 'top 85%',
      toggleActions: 'play none none none'
    };

    gsap.from(el, animProps);
  });
}

// ===== TERRASSE KEN BURNS =====
function initKenBurns() {
  const wrap = document.querySelector('.terrasse-image-wrap');
  if (!wrap) return;

  ScrollTrigger.create({
    trigger: wrap,
    start: 'top 80%',
    onEnter: () => wrap.classList.add('ken-burns'),
    once: true
  });
}

// ===== TERRASSE PARALLAX =====
function initTerrasseParallax() {
  const img = document.querySelector('.terrasse-image');
  if (!img) return;

  gsap.to(img, {
    yPercent: -12,
    ease: 'none',
    scrollTrigger: {
      trigger: '.section-terrasse',
      start: 'top bottom',
      end: 'bottom top',
      scrub: true
    }
  });
}

// ===== SCROLL-ZONE TEXT ENTRANCE =====
function initScrollZoneTextReveal() {
  document.querySelectorAll('.scroll-zone-text').forEach(el => {
    gsap.from(el, {
      y: 30,
      opacity: 0,
      duration: 0.5,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',
        toggleActions: 'play none none none'
      }
    });
  });
}

// ===== MARQUEE SCROLL =====
function initMarquee() {
  const track = document.getElementById('marquee-track');
  if (!track) return;

  gsap.to(track, {
    xPercent: -33.33,
    ease: 'none',
    scrollTrigger: {
      trigger: track.parentElement,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true
    }
  });
}

// ===== COUNTER ANIMATIONS =====
function initCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    const target = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');
    const obj = { val: 0 };

    ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        gsap.to(obj, {
          val: target,
          duration: 0.8,
          ease: 'power1.out',
          onUpdate: () => {
            el.textContent = decimals > 0
              ? obj.val.toFixed(decimals).replace('.', ',')
              : Math.round(obj.val).toLocaleString('de-DE');
          }
        });
      },
      once: true
    });
  });
}

// ===== FLOATING BACK-TO-TOP =====
function initBackToTop() {
  const btn = document.getElementById('fab-top');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 400);
  }, { passive: true });

  btn.addEventListener('click', () => {
    lenis.scrollTo(0, { duration: 1.5 });
  });
}

// ===== RESIZE =====
let resizeTimer = null;

function onResize() {
  const newW = document.documentElement.clientWidth;
  if (newW === stableW) return;

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    updateStableDimensions(true);
    setupCanvas(canvasFood, ctxFood);
    setupCanvas(canvasStatue, ctxStatue);
    if (foodFrames[currentFoodFrame]) drawFrame(ctxFood, foodFrames, currentFoodFrame, '#F2E4CF', FOOD_DRAW_OPTS);
    if (statueFrames[currentStatueFrame]) drawFrame(ctxStatue, statueFrames, currentStatueFrame, '#E8D5B8', STATUE_DRAW_OPTS);
    ScrollTrigger.refresh();
  }, 150);
}

// ===== INIT =====
async function init() {
  initHeader();
  initInPageAnchors();

  setupCanvas(canvasFood, ctxFood);
  setupCanvas(canvasStatue, ctxStatue);

  await initPreloaderQuick();

  kickoffParallelFrameLoad(FOOD_FRAME_COUNT, 'frames/frame_NNNN.webp', foodFrames, 1);
  initStatueIdlePreload();

  if (foodFrames[0]) drawFrame(ctxFood, foodFrames, 0, '#F2E4CF', FOOD_DRAW_OPTS);

  initHeroAnimation();
  initHeroParallax();
  initFoodCanvasScroll();
  initStatueCanvasScroll();
  initMapConsent();
  initRevealAnimations();
  initScrollZoneTextReveal();
  initKenBurns();
  initTerrasseParallax();
  initMarquee();
  initCounters();
  initBackToTop();

  window.addEventListener('resize', onResize);

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      updateStableDimensions(true);
      setupCanvas(canvasFood, ctxFood);
      setupCanvas(canvasStatue, ctxStatue);
      if (foodFrames[currentFoodFrame]) drawFrame(ctxFood, foodFrames, currentFoodFrame, '#F2E4CF', FOOD_DRAW_OPTS);
      if (statueFrames[currentStatueFrame]) drawFrame(ctxStatue, statueFrames, currentStatueFrame, '#E8D5B8', STATUE_DRAW_OPTS);
      ScrollTrigger.refresh();
    }, 300);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
