// ===== CONFIGURATION =====
const FOOD_FRAME_COUNT = 50;
const STATUE_FRAME_COUNT = 63;
const FRAME_SPEED = 2.6;
const IMAGE_SCALE = 0.88;
const IMAGE_SCALE_MOBILE = 0.72;

const FOOD_DRAW_OPTS = { vBiasMobile: -40 };
const STATUE_DRAW_OPTS = {
  scaleDesktop: 0.95,
  scaleMobile: 0.78,
  vBiasDesktop: 40,
  vBiasMobile: 30,
  hBiasDesktop: -60,
  hBiasMobile: -20
};

// ===== DOM =====
const canvasFood = document.getElementById('canvas-food');
const ctxFood = canvasFood.getContext('2d');
const canvasStatue = document.getElementById('canvas-statue');
const ctxStatue = canvasStatue.getContext('2d');

const canvasWrapFood = document.getElementById('canvas-wrap');
const canvasWrapStatue = document.getElementById('canvas-wrap-statue');
const darkOverlay = document.getElementById('dark-overlay');
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
menuToggle.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
  document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
});

mobileNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileNav.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// ===== CANVAS SETUP =====
function setupCanvas(canvas, ctx) {
  const dpr = window.devicePixelRatio || 1;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);
}

function isMobile() { return window.innerWidth < 768; }

function drawFrame(ctx, frames, index, bgColor, opts) {
  const img = frames[index];
  if (!img) return;
  const o = opts || {};

  const cw = window.innerWidth;
  const ch = window.innerHeight;
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;

  const mobile = isMobile();
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
}

function loadFrameSet(count, pathTemplate) {
  return new Promise((resolve) => {
    const frames = new Array(count);
    let loaded = 0;
    for (let i = 0; i < count; i++) {
      const img = new Image();
      img.onload = () => {
        frames[i] = img;
        loaded++;
        if (loaded === count) resolve(frames);
      };
      img.onerror = () => {
        loaded++;
        if (loaded === count) resolve(frames);
      };
      img.src = pathTemplate.replace('NNNN', String(i + 1).padStart(4, '0'));
    }
  });
}

// ===== HEADER SCROLL =====
function initHeader() {
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 80);
  }, { passive: true });
}

// ===== HERO ANIMATION =====
function initHeroAnimation() {
  const label = document.querySelector('.hero-content .label--hero');
  const heading = document.querySelector('.hero-heading');
  const tagline = document.querySelector('.hero-tagline');
  const cta = document.querySelector('.hero-cta');
  const indicator = document.querySelector('.scroll-indicator');

  const tl = gsap.timeline({ delay: 0.3 });

  tl.from(label, { y: 20, opacity: 0, duration: 0.7, ease: 'power3.out' })
    .from(heading, { y: 50, opacity: 0, duration: 1.1, ease: 'power3.out' }, '-=0.3')
    .from(tagline, { y: 20, opacity: 0, duration: 0.7, ease: 'power3.out' }, '-=0.4')
    .from(cta, { y: 20, opacity: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3')
    .from(indicator, { y: 15, opacity: 0, duration: 0.5, ease: 'power3.out' }, '-=0.2');
}

// ===== FOOD CANVAS SCROLL =====
function initFoodCanvasScroll() {
  const hero = document.getElementById('hero');
  const zone = document.getElementById('kueche');

  // Food canvas is visible from hero start, fades in during hero
  canvasWrapFood.style.opacity = '1';

  // Scroll-driven frame playback across hero + food zone
  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    endTrigger: zone,
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * FOOD_FRAME_COUNT), FOOD_FRAME_COUNT - 1);
      if (index !== currentFoodFrame && foodFrames[index]) {
        currentFoodFrame = index;
        requestAnimationFrame(() => drawFrame(ctxFood, foodFrames, currentFoodFrame, '#F2E4CF', FOOD_DRAW_OPTS));
      }
    }
  });

  // Fade food canvas out when leaving food zone into speisekarte
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
    iframe.src = 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2430.5!2d13.5123!3d52.4567!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sRestaurant+Artemis+Schnellerstr.+97+12439+Berlin!5e0!3m2!1sde!2sde!4v1';
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
      if (index !== currentStatueFrame && statueFrames[index]) {
        currentStatueFrame = index;
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

// ===== SECTION REVEAL ANIMATIONS =====
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
    } else {
      gsap.from(el, {
        y: 50,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        delay,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none'
        }
      });
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
          duration: 2,
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

// ===== RESIZE =====
function onResize() {
  setupCanvas(canvasFood, ctxFood);
  setupCanvas(canvasStatue, ctxStatue);
  if (foodFrames[currentFoodFrame]) drawFrame(ctxFood, foodFrames, currentFoodFrame, '#F2E4CF', FOOD_DRAW_OPTS);
  if (statueFrames[currentStatueFrame]) drawFrame(ctxStatue, statueFrames, currentStatueFrame, '#E8D5B8', STATUE_DRAW_OPTS);
}

// ===== INIT =====
async function init() {
  initHeader();
  initInPageAnchors();
  initHeroAnimation();

  setupCanvas(canvasFood, ctxFood);
  setupCanvas(canvasStatue, ctxStatue);

  const [loadedFood, loadedStatue] = await Promise.all([
    loadFrameSet(FOOD_FRAME_COUNT, 'frames/frame_NNNN.webp'),
    loadFrameSet(STATUE_FRAME_COUNT, 'frames-statue/frame_NNNN.webp')
  ]);

  loadedFood.forEach((f, i) => { if (f) foodFrames[i] = f; });
  loadedStatue.forEach((f, i) => { if (f) statueFrames[i] = f; });

  if (foodFrames[0]) drawFrame(ctxFood, foodFrames, 0, '#F2E4CF', FOOD_DRAW_OPTS);
  if (statueFrames[0]) drawFrame(ctxStatue, statueFrames, 0, '#E8D5B8', STATUE_DRAW_OPTS);

  initFoodCanvasScroll();
  initStatueCanvasScroll();
  initMapConsent();
  initRevealAnimations();
  initCounters();

  window.addEventListener('resize', onResize);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
