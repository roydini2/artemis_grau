if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

// ===== DOM =====
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');

// ===== LENIS =====
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true,
  touchMultiplier: 1.5
});

function syncScrollTop() {
  window.scrollTo(0, 0);
  lenis.scrollTo(0, { immediate: true });
}

syncScrollTop();

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

function getInPageAnchorOffset() {
  return 0;
}

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
      lenis.scrollTo(target, { offset: getInPageAnchorOffset(), duration: 1.35 });
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
  const mobileNavPanel = mobileNav.querySelector('.mobile-nav-panel');

  menuToggle.addEventListener('click', () => {
    setMobileNavOpen(!mobileNav.classList.contains('open'));
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => setMobileNavOpen(false));
  });

  mobileNav.addEventListener('click', (e) => {
    if (!mobileNav.classList.contains('open')) return;
    if (mobileNavPanel && !mobileNavPanel.contains(e.target)) {
      setMobileNavOpen(false);
      menuToggle.focus();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !mobileNav || !mobileNav.classList.contains('open')) return;
  setMobileNavOpen(false);
  if (menuToggle) menuToggle.focus();
});

/** Unten: Menü öffnet automatisch; beim Hochscrollen (Ende verlassen) wieder zu. */
function initMobileNavAutoOpenAtBottom() {
  if (!mobileNav || !menuToggle) return;

  const bottomThresholdPx = 72;
  const minScrollablePx = 160;
  let wasInBottomZone = false;

  lenis.on('scroll', () => {
    const limit =
      typeof lenis.limit === 'number'
        ? lenis.limit
        : Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const scroll = typeof lenis.scroll === 'number' ? lenis.scroll : window.scrollY;
    if (limit < minScrollablePx) return;

    const inBottomZone = scroll >= limit - bottomThresholdPx;
    if (inBottomZone && !wasInBottomZone) {
      setMobileNavOpen(true);
      requestAnimationFrame(() => {
        if (document.activeElement === menuToggle) menuToggle.blur();
      });
    }
    if (wasInBottomZone && !inBottomZone && mobileNav.classList.contains('open')) {
      setMobileNavOpen(false);
    }
    wasInBottomZone = inBottomZone;
  });
}

let lastResizeWidth = document.documentElement.clientWidth;

/** Statue-Ebene: hart an/aus (kein weiches Einblenden über helle Fläche). */
function footerStatueVideoOpacityFromRect(r, vh) {
  if (!vh || r.bottom <= 0 || r.top >= vh) return 0;
  return 1;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

async function playPostPreloaderPageReveal() {
  const smooth = document.getElementById('smooth-content');
  const plane = document.getElementById('hero-video-plane');
  const grain = document.querySelector('.grain-overlay');
  const headerEl = document.getElementById('site-header');
  const fabCall = document.querySelector('.fab-container .fab--call');

  const layers = [smooth, plane, headerEl, fabCall].filter(Boolean);

  const finishIntro = () => {
    document.body.classList.remove('is-intro-active');
    gsap.set([...layers, grain].filter(Boolean), { clearProps: 'opacity,transform' });
  };

  if (prefersReducedMotion()) {
    finishIntro();
    return;
  }

  await new Promise((resolve) => {
    const tl = gsap.timeline({
      onComplete: () => {
        finishIntro();
        resolve();
      }
    });

    tl.fromTo(
      layers,
      { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 1.05, ease: 'power3.out', stagger: 0.07 },
      0
    );

    if (grain) {
      tl.fromTo(
        grain,
        { opacity: 0 },
        { opacity: 0.04, duration: 0.95, ease: 'power2.out' },
        0
      );
    }
  });
}

async function initPreloader() {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloader-bar');
  const percent = document.getElementById('preloader-percent');

  if (bar) bar.style.width = '100%';
  if (percent) percent.textContent = '100';

  await new Promise((r) => setTimeout(r, 300));
  if (preloader) preloader.classList.add('done');
  await new Promise((r) => setTimeout(r, 800));
  if (preloader) preloader.style.display = 'none';

  await playPostPreloaderPageReveal();
}

// ===== HEADER + FAB (one passive scroll pipeline) =====
function initScrollChrome() {
  const fabTop = document.getElementById('fab-top');
  let scheduled = false;
  const tick = () => {
    scheduled = false;
    const y = window.scrollY;
    if (header) header.classList.toggle('scrolled', y > 80);
    if (fabTop) fabTop.classList.toggle('visible', y > 400);
  };
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(tick);
  }, { passive: true });
  tick();
}

// ===== HERO PARALLAX — normal scroll; Bild-Ebene fixed; nur #hero-video-media bewegt sich langsamer (wie vorher beim Video) =====
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const media = document.getElementById('hero-video-media');
  const plane = document.getElementById('hero-video-plane');
  if (!hero || !media) return;

  const statuePlane = document.getElementById('footer-statue-video-wrap');

  const hideVideoPlane = () => {
    if (plane) plane.style.visibility = 'hidden';
    /* Statue-MP4 über z-index 2 legen, sobald der Hero-Bereich verlassen ist (Hero blieb sonst optisch darüber). */
    if (statuePlane) statuePlane.style.zIndex = '3';
  };

  const showVideoPlane = () => {
    if (plane) plane.style.visibility = 'visible';
    if (statuePlane) statuePlane.style.zIndex = '1';
  };

  gsap.fromTo(
    media,
    { y: 0 },
    {
      y: () => -window.innerHeight * 0.22,
      ease: 'none',
      scrollTrigger: {
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        scrub: 0.45,
        invalidateOnRefresh: true
      }
    }
  );

  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: 'bottom top',
    onLeave: hideVideoPlane,
    onEnterBack: showVideoPlane,
    onRefresh: (self) => {
      if (self.progress >= 0.999) hideVideoPlane();
      else showVideoPlane();
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

// ===== GÄSTEBEWERTUNGEN: Pfeile + Zähler (zyklisch) =====
function initGuestReviewsCarousel() {
  const root = document.getElementById('bewertungen');
  if (!root) return;
  const slides = root.querySelectorAll('.review-slide');
  const prevBtn = document.getElementById('review-prev');
  const nextBtn = document.getElementById('review-next');
  const curEl = document.getElementById('reviews-pager-current');
  const totalEl = document.getElementById('reviews-pager-total');
  const toolbar = root.querySelector('.reviews-editorial-toolbar');
  if (!slides.length) return;

  const n = slides.length;
  if (totalEl) totalEl.textContent = String(n).padStart(2, '0');

  let idx = 0;

  const activate = (nextIdx) => {
    idx = ((nextIdx % n) + n) % n;
    slides.forEach((slide, i) => {
      const on = i === idx;
      slide.classList.toggle('is-active', on);
      slide.toggleAttribute('hidden', !on);
    });
    if (curEl) curEl.textContent = String(idx + 1).padStart(2, '0');
  };

  prevBtn?.addEventListener('click', () => activate(idx - 1));
  nextBtn?.addEventListener('click', () => activate(idx + 1));

  if (toolbar) {
    toolbar.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        activate(idx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        activate(idx + 1);
      }
    });
  }
}

/** Frame 1:1 in den Canvas-Puffer; Anzeige ohne Verzerrung über CSS object-fit am Canvas. */
function drawFooterStatueFrame(ctx, canvasW, canvasH, img) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return;
  ctx.drawImage(img, 0, 0, canvasW, canvasH);
}

// ===== STATUE-FOOTER: WebP-Frame-Sequenz + Canvas (Lenis + ScrollTrigger scrub) =====
function initFooterStatueFrameScroll() {
  const zone = document.getElementById('site-footer');
  const wrap = document.getElementById('footer-statue-video-wrap');
  const canvas = document.getElementById('footer-statue-canvas');
  if (!zone || !wrap || !canvas) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    wrap.style.opacity = '0';
    return;
  }

  const count = parseInt(wrap.dataset.statueFrames || '152', 10);
  const base = wrap.dataset.statueFrameBase || 'frames-statue/frame_';
  if (!Number.isFinite(count) || count < 2) return;

  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) return;

  const proxy = { p: 0 };
  const images = new Array(count);
  let lastDrawnIdx = -1;

  const paintProgress = (progress) => {
    const idx = Math.min(count - 1, Math.max(0, Math.round(progress * (count - 1))));
    if (idx === lastDrawnIdx) return;
    const img = images[idx];
    if (!img || !img.complete || img.naturalWidth === 0) return;
    lastDrawnIdx = idx;
    drawFooterStatueFrame(ctx, canvas.width, canvas.height, img);
  };

  const syncFromScrollTrigger = () => {
    const st = ScrollTrigger.getById('footer-statue-frame-scrub');
    if (!st) return;
    lastDrawnIdx = -1;
    paintProgress(st.progress);
  };

  const loadFrames = () =>
    Promise.all(
      Array.from({ length: count }, (_, i) => {
        const n = String(i + 1).padStart(4, '0');
        return new Promise((resolve, reject) => {
          const im = new Image();
          im.decoding = 'async';
          im.onload = () => {
            im.decode?.()
              .then(() => resolve(im))
              .catch(() => resolve(im));
          };
          im.onerror = () => reject(new Error(`Statue-Frame ${n}`));
          im.src = `${base}${n}.webp`;
        });
      })
    );

  loadFrames()
    .then((loaded) => {
      loaded.forEach((im, i) => {
        images[i] = im;
      });
      const first = loaded[0];
      canvas.width = first.naturalWidth;
      canvas.height = first.naturalHeight;

      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          id: 'footer-statue-frame-scrub',
          trigger: zone,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.65,
          invalidateOnRefresh: true
        },
        onUpdate: () => {
          const r = zone.getBoundingClientRect();
          const vh = window.innerHeight || 1;
          wrap.style.opacity = String(footerStatueVideoOpacityFromRect(r, vh));
          paintProgress(proxy.p);
        }
      });

      invalidateFooterStatueFrames = () => {
        lastDrawnIdx = -1;
        syncFromScrollTrigger();
      };

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        syncFromScrollTrigger();
      });
    })
    .catch(() => {
      wrap.style.opacity = '0';
    });
}

function initCinematicVideoPlayback(video) {
  if (!video) return;
  video.addEventListener('ended', () => {
    try {
      video.currentTime = 0;
    } catch (e) { /* ignore */ }
    video.play().catch(() => {});
  });
}

function playCinematicFromStart(video) {
  if (!video) return;
  const playNow = () => {
    video.play().catch(() => {});
  };
  const resetAndPlay = () => {
    try {
      video.currentTime = 0;
    } catch (e) { /* ignore */ }
    if (video.seeking) {
      video.addEventListener('seeked', () => playNow(), { once: true });
    } else {
      playNow();
    }
  };
  if (video.readyState >= 3) {
    resetAndPlay();
    return;
  }
  let fired = false;
  const fire = () => {
    if (fired) return;
    fired = true;
    resetAndPlay();
  };
  video.addEventListener('canplay', fire, { once: true });
  video.addEventListener('loadeddata', fire, { once: true });
}

function initCinematicVideo() {
  const pin = document.getElementById('cinematic-pin');
  const stage = document.getElementById('cinematic-stage');
  const video = document.getElementById('cinematic-video');
  if (!pin || !stage) return;

  initCinematicVideoPlayback(video);

  const copyFollow = document.getElementById('cinematic-copy-follow');
  const copyLead = copyFollow?.querySelector('.cinematic-copy--lead');
  const copyTrail = copyFollow?.querySelector('.cinematic-copy--trail');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(() => {
      gsap.set(stage, { scale: 1, borderRadius: '0px' });
      if (copyLead && copyTrail) {
        gsap.set([copyLead, copyTrail], { clearProps: 'transform' });
      }
    });
    playCinematicFromStart(video);
    return;
  }

  const isMobile = window.innerWidth < 769;
  const startScale = isMobile ? 1 : 0.52;
  const videoTweenDur = 1;

  const textShiftX = () => Math.min(window.innerWidth * 0.032, 48);

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: pin,
      start: 'top top',
      end: isMobile ? '+=50%' : '+=120%',
      pin: true,
      scrub: 0.55,
      anticipatePin: 1,
      invalidateOnRefresh: true
    }
  });

  /* Video unabhängig vom Pin: startet, sobald die Sektion sichtbar wird (vor „Einrasten“) */
  const cinematicSection = document.getElementById('stimmung');
  ScrollTrigger.create({
    trigger: cinematicSection || pin,
    start: 'top bottom',
    end: 'bottom top',
    invalidateOnRefresh: true,
    onEnter: () => playCinematicFromStart(video),
    onEnterBack: () => playCinematicFromStart(video),
    onLeave: () => {
      if (video) video.pause();
    },
    onLeaveBack: () => {
      if (video) video.pause();
    }
  });

  tl.fromTo(
    stage,
    { scale: startScale, transformOrigin: '50% 50%' },
    { scale: 1, ease: 'power2.out', duration: videoTweenDur },
    0
  );

  if (copyLead && copyTrail && !isMobile) {
    tl.fromTo(
      copyLead,
      {
        x: () => textShiftX(),
        scale: 0.94,
        yPercent: -50,
        transformOrigin: 'left center',
        force3D: true
      },
      {
        x: 0,
        scale: 1,
        yPercent: -50,
        ease: 'power1.inOut',
        duration: videoTweenDur,
        force3D: true
      },
      0
    ).fromTo(
      copyTrail,
      {
        x: () => -textShiftX(),
        scale: 0.94,
        yPercent: -50,
        transformOrigin: 'right center',
        force3D: true
      },
      {
        x: 0,
        scale: 1,
        yPercent: -50,
        ease: 'power1.inOut',
        duration: videoTweenDur,
        force3D: true
      },
      0
    );
  } else if (copyLead && copyTrail) {
    gsap.set([copyLead, copyTrail], { clearProps: 'transform' });
  }
}

// ===== SECTION REVEAL ANIMATIONS — Varied per data-anim =====
function initRevealAnimations() {
  document.querySelectorAll('[data-anim]').forEach(el => {
    const type = el.dataset.anim;
    const delay = parseFloat(el.dataset.delay || '0');

    if (type === 'stagger-up') {
      const children = el.querySelectorAll('.stat, .review-card, .review-slide');
      gsap.from(children, {
        y: 50,
        opacity: 0,
        stagger: 0.12,
        duration: 0.8,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: 'top 80%',
          toggleActions: 'play none none none',
          once: true
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
      toggleActions: 'play none none none',
      once: true
    };

    gsap.from(el, animProps);
  });
}

// ===== EDITORIAL GALLERY PAIR PARALLAX =====
/** Ganze Bild-Spalten (figure) verschieben — nicht der Bild-Inhalt. Editorial Desktop: Drift A. Editorial ≤768px: unteres Bild wandert beim Runterscrollen leicht nach unten. */
function initGalleryPairParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('[data-parallax-pair]').forEach((root) => {
    const colA = root.querySelector('.gallery-pair__col--a');
    const colB = root.querySelector('.gallery-pair__col--b');
    const colC = root.querySelector('.gallery-pair__col--c');
    if (!colA || !colB) return;

    const st = {
      trigger: root,
      start: 'top bottom',
      end: 'bottom top',
      scrub: true,
      invalidateOnRefresh: true
    };

    const tl = gsap.timeline({ scrollTrigger: st });

    if (root.classList.contains('gallery-pair--editorial')) {
      const isEditorialMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isEditorialMobile) {
        const bAmp = 32;
        tl.fromTo(
          colB,
          { y: -bAmp, force3D: true },
          { y: bAmp, ease: 'none', duration: 1, force3D: true },
          0
        );
      } else {
        const bH = colB.offsetHeight || 500;
        const aH = colA.offsetHeight || 400;
        const drift = Math.max(0, bH - aH);
        tl.fromTo(colA, { y: 0, force3D: true }, { y: drift, ease: 'none', duration: 1, force3D: true }, 0);
      }
    } else if (root.classList.contains('gallery-pair--feier-trio')) {
      if (!colC) return;
      const feierM = window.matchMedia('(max-width: 768px)').matches ? 0.5 : 1;
      tl.fromTo(
        colA,
        { y: 36 * feierM, force3D: true },
        { y: -30 * feierM, ease: 'none', duration: 1, force3D: true },
        0
      ).fromTo(
        colC,
        { y: -38 * feierM, force3D: true },
        { y: 28 * feierM, ease: 'none', duration: 1, force3D: true },
        0
      );
    } else {
      tl.fromTo(colA, { y: 40, force3D: true }, { y: -32, ease: 'none', duration: 1, force3D: true }, 0).fromTo(
        colB,
        { y: -44, force3D: true },
        { y: 28, ease: 'none', duration: 1, force3D: true },
        0
      );
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
        toggleActions: 'play none none none',
        once: true
      }
    });
  });
}

// ===== COUNTER ANIMATIONS =====
function initCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    if (el.closest('#hero')) return;

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
  btn.addEventListener('click', () => {
    lenis.scrollTo(0, { duration: 1.5 });
  });
}

// ===== RESIZE =====
let resizeTimer = null;
let invalidateFooterStatueFrames = () => {};

function onResize() {
  const newW = document.documentElement.clientWidth;
  if (newW === lastResizeWidth) return;
  lastResizeWidth = newW;

  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    ScrollTrigger.refresh();
    invalidateFooterStatueFrames();
  }, 150);
}

// ===== INIT =====
async function init() {
  initScrollChrome();
  initInPageAnchors();
  initMobileNavAutoOpenAtBottom();

  await initPreloader();

  initHeroParallax();
  initCinematicVideo();
  initFooterStatueFrameScroll();
  initGuestReviewsCarousel();
  initMapConsent();
  initRevealAnimations();
  initScrollZoneTextReveal();
  initGalleryPairParallax();
  initCounters();
  initBackToTop();

  window.addEventListener('load', () => {
    syncScrollTop();
    ScrollTrigger.refresh();
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      syncScrollTop();
      ScrollTrigger.refresh();
    }
  });

  window.addEventListener('resize', onResize);

  requestAnimationFrame(() => {
    ScrollTrigger.refresh();
  });

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      lastResizeWidth = document.documentElement.clientWidth;
      ScrollTrigger.refresh();
    }, 300);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
