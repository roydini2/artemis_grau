if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-Stabilität (Rollback ohne Git: beide auf `false` setzen = Verhalten wie vor diesem Refactor).
 * - LENIS_USE_SCROLL_TRIGGER_SCROLLER_PROXY: ScrollTrigger nutzt dieselbe Scroll-Quelle wie Lenis (scrollerProxy).
 * - LENIS_DISABLE_WHEN_MOBILE_COARSE: kein Lenis bei schmal + Grobzeiger → natives Scrollen, weniger Konflikt mit Mobile-Chrome-UI.
 */
const LENIS_USE_SCROLL_TRIGGER_SCROLLER_PROXY = true;
const LENIS_DISABLE_WHEN_MOBILE_COARSE = true;

function shouldUseLenis() {
  if (!LENIS_DISABLE_WHEN_MOBILE_COARSE) return true;
  return !window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches;
}

// ===== DOM =====
const header = document.getElementById('site-header');
const menuToggle = document.getElementById('menu-toggle');
const mobileNav = document.getElementById('mobile-nav');

// ===== LENIS (optional: auf Mobile-Coarse aus) =====
let lenis = null;

function setupLenisScroll() {
  if (!shouldUseLenis()) {
    window.addEventListener('scroll', () => ScrollTrigger.update(), { passive: true });
    return;
  }

  lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.5
  });

  /* Pull-to-Refresh / natives Overscroll: Lenis touchmove ist passive:false und kann sonst preventDefault auslösen.
     virtualScroll === false beendet die Verarbeitung ohne preventDefault (Lenis-Doku). */
  lenis.options.virtualScroll = ({ deltaY, event }) => {
    if (!event?.type?.includes('touch')) return;
    const limit = typeof lenis.limit === 'number' ? lenis.limit : 0;
    const scroll = typeof lenis.scroll === 'number' ? lenis.scroll : 0;
    const edge = 2;
    if (scroll <= edge && deltaY < -0.5) return false;
    if (limit > edge && scroll >= limit - edge && deltaY > 0.5) return false;
  };

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));

  if (LENIS_USE_SCROLL_TRIGGER_SCROLLER_PROXY) {
    const root = document.documentElement;
    ScrollTrigger.scrollerProxy(root, {
      scrollTop(value) {
        if (arguments.length) {
          lenis.scrollTo(value, { immediate: true });
        }
        return lenis.scroll;
      },
      getBoundingClientRect() {
        return {
          top: 0,
          left: 0,
          width: window.innerWidth,
          height: window.innerHeight
        };
      },
      pinType: root.style.transform ? 'transform' : 'fixed'
    });
    ScrollTrigger.defaults({ scroller: root });
  }
}

setupLenisScroll();
gsap.ticker.lagSmoothing(0);

/** Touch + ScrollTrigger-Scrub: zu hoher Multiplier erzeugt mit Lenis sichtbares „Wackeln“. */
const lenisTouchCoarseMq = window.matchMedia('(max-width: 768px) and (pointer: coarse)');
function syncLenisTouchMultiplier() {
  if (!lenis) return;
  lenis.options.touchMultiplier = lenisTouchCoarseMq.matches ? 1 : 1.5;
}
syncLenisTouchMultiplier();
lenisTouchCoarseMq.addEventListener('change', syncLenisTouchMultiplier);

function syncScrollTop() {
  window.scrollTo(0, 0);
  if (lenis) {
    lenis.scrollTo(0, { immediate: true });
  }
}

syncScrollTop();

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
      if (lenis) {
        lenis.scrollTo(target, { offset: getInPageAnchorOffset(), duration: 1.35 });
      } else {
        const off = getInPageAnchorOffset();
        const top =
          target.getBoundingClientRect().top + window.scrollY + off;
        window.scrollTo({ top, behavior: 'smooth' });
      }
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

/** Unten: Desktop wie bisher sofort; mobil erst nach kurzer Ruhe am Ende + erneutem Impuls nach unten (Wheel/Touch). */
function initMobileNavAutoOpenAtBottom() {
  if (!mobileNav || !menuToggle) return;

  const bottomThresholdPx = 72;
  const minScrollablePx = 160;
  const mobileMq = window.matchMedia('(max-width: 768px)');
  let wasInBottomZone = false;
  let armTimer = null;
  let armed = false;
  let lastTouchY = null;

  const getLimit = () =>
    lenis && typeof lenis.limit === 'number'
      ? lenis.limit
      : Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

  const getScroll = () =>
    lenis && typeof lenis.scroll === 'number' ? lenis.scroll : window.scrollY;

  const disarm = () => {
    armed = false;
    if (armTimer != null) {
      clearTimeout(armTimer);
      armTimer = null;
    }
  };

  const tryOpenFromNudge = () => {
    if (!mobileMq.matches || !armed) return;
    const limit = getLimit();
    const scroll = getScroll();
    if (scroll < limit - bottomThresholdPx) return;
    disarm();
    setMobileNavOpen(true);
    requestAnimationFrame(() => {
      if (document.activeElement === menuToggle) menuToggle.blur();
    });
  };

  const scheduleArmAfterBottomArrival = () => {
    disarm();
    const tryWhenCalm = () => {
      armTimer = null;
      const limit = getLimit();
      const scroll = getScroll();
      if (scroll < limit - bottomThresholdPx) return;
      if (lenis && Math.abs(lenis.velocity) > 0.22) {
        armTimer = window.setTimeout(tryWhenCalm, 100);
        return;
      }
      armed = true;
    };
    armTimer = window.setTimeout(tryWhenCalm, 400);
  };

  const onScrollForBottomNav = () => {
    const limit = getLimit();
    const scroll = getScroll();
    if (limit < minScrollablePx) return;

    const inBottomZone = scroll >= limit - bottomThresholdPx;

    if (!mobileMq.matches) {
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
      return;
    }

    if (!inBottomZone) {
      disarm();
      lastTouchY = null;
      if (wasInBottomZone && mobileNav.classList.contains('open')) {
        setMobileNavOpen(false);
      }
      wasInBottomZone = false;
      return;
    }

    if (!wasInBottomZone) {
      wasInBottomZone = true;
      scheduleArmAfterBottomArrival();
    }
  };

  if (lenis) {
    lenis.on('scroll', onScrollForBottomNav);
  } else {
    window.addEventListener('scroll', onScrollForBottomNav, { passive: true });
  }

  window.addEventListener(
    'wheel',
    (e) => {
      if (!mobileMq.matches || !armed) return;
      if (e.deltaY > 8) tryOpenFromNudge();
    },
    { passive: true }
  );

  document.addEventListener(
    'touchstart',
    (e) => {
      if (!mobileMq.matches) return;
      const t = e.targetTouches && e.targetTouches[0];
      lastTouchY = t ? t.clientY : null;
    },
    { passive: true }
  );

  document.addEventListener(
    'touchmove',
    (e) => {
      if (!mobileMq.matches || !armed) return;
      const t = e.targetTouches && e.targetTouches[0];
      if (!t) return;
      if (lastTouchY == null) {
        lastTouchY = t.clientY;
        return;
      }
      const dy = lastTouchY - t.clientY;
      lastTouchY = t.clientY;
      if (dy > 10) tryOpenFromNudge();
    },
    { passive: true }
  );
}

let lastResizeWidth = document.documentElement.clientWidth;
let lastVisualViewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);

/** Breitenwechsel (z. B. Desktop-Site umschalten) — manche Webviews feuern layout-relevant nur über visualViewport. */
function onVisualViewportResizeForHero() {
  const vv = window.visualViewport;
  if (!vv) return;
  const w = Math.round(vv.width);
  if (Math.abs(w - lastVisualViewportWidth) < 32) return;
  lastVisualViewportWidth = w;
  lastResizeWidth = document.documentElement.clientWidth;
  if (heroUsesTouchFrozenLayout()) {
    applyHeroTouchLayoutLock();
  } else {
    syncHeroParallaxMetrics();
  }
  syncHtmlHeroTouchStableClass();
  ScrollTrigger.refresh();
}

/** Hero-Parallax-Endpunkt: nicht jedes Frame von innerHeight abhängig (Mobile-Leiste ein/aus beim Loslassen → sonst Schlag). */
let heroParallaxTravelPx =
  (window.visualViewport?.height ?? window.innerHeight) * 0.22;

/**
 * Mobil: ScrollTrigger end darf nicht an die live wechselnde Hero-Höhe (lvh/svh) gekoppelt sein — sonst springt
 * der Fortschritt beim Loslassen (Browser-UI), Bild wirkt „plötzlich größer“. Desktop: Range ungenutzt.
 */
let heroParallaxScrollRangePx = 720;

/**
 * Typisch „Desktop-Website“ am Phone: kurze physische Kante (Handy), aber Layout-Viewport breit.
 * Kein ontouchstart / maxTouchPoints — auf Desktop-Chrome oft false positives.
 */
function likelyCompactScreenWithWideLayoutViewport() {
  try {
    const sw = Math.min(window.screen.width, window.screen.height);
    const iw = window.innerWidth;
    if (sw <= 0 || iw <= 0) return false;
    if (sw <= 560 && iw >= 620) return true;
  } catch (e) {
    /* ignore */
  }
  return false;
}

function heroUsesTouchFrozenLayout() {
  const narrow = window.matchMedia('(max-width: 768px)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const anyCoarse = window.matchMedia('(any-pointer: coarse)').matches;
  const touchPts =
    typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
  return (
    narrow ||
    coarse ||
    anyCoarse ||
    touchPts ||
    likelyCompactScreenWithWideLayoutViewport()
  );
}

function syncHtmlHeroTouchStableClass() {
  document.documentElement.classList.toggle(
    'hero-touch-stable',
    heroUsesTouchFrozenLayout()
  );
}

/** Touch / schmale Viewport: Travel, Scroll-Range, Media-Höhe fest — inkl. „Desktop-Ansicht“ am Handy (Breite >768). */
function applyHeroTouchLayoutLock() {
  if (!heroUsesTouchFrozenLayout()) return;
  const el = document.querySelector('.hero');
  const plane = document.getElementById('hero-video-plane');
  const vh = window.visualViewport?.height ?? window.innerHeight;
  heroParallaxTravelPx = vh * 0.22;
  if (el) {
    heroParallaxScrollRangePx = Math.max(400, Math.round(el.getBoundingClientRect().height));
  }
  if (plane) {
    plane.style.setProperty('--hero-media-locked-h', `${Math.round(vh * 1.28)}px`);
  }
}

function syncHeroParallaxMetrics() {
  const plane = document.getElementById('hero-video-plane');
  if (heroUsesTouchFrozenLayout()) {
    return;
  }
  heroParallaxTravelPx =
    (window.visualViewport?.height ?? window.innerHeight) * 0.22;
  plane?.style.removeProperty('--hero-media-locked-h');
}

function getHeroParallaxScrollEnd() {
  return heroUsesTouchFrozenLayout()
    ? `+=${heroParallaxScrollRangePx}`
    : 'bottom top';
}

/** Wartet auf Hero-WebP (load + decode), damit nach dem Preloader kein spätes Nachziehen hackt. Kein Bild-Resize — nur Timing. */
function waitForHeroImage(maxWaitMs = 14000) {
  const img = document.querySelector('.hero-video');
  if (!img) return Promise.resolve();

  const decodeIfPossible = () => {
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => {});
    }
    return Promise.resolve();
  };

  if (img.complete && img.naturalWidth > 0) {
    return decodeIfPossible();
  }

  return new Promise((resolve) => {
    const done = () => {
      decodeIfPossible().finally(resolve);
    };
    const failSafe = setTimeout(done, maxWaitMs);
    const cleanup = () => {
      clearTimeout(failSafe);
    };
    img.addEventListener(
      'load',
      () => {
        cleanup();
        done();
      },
      { once: true }
    );
    img.addEventListener(
      'error',
      () => {
        cleanup();
        resolve();
      },
      { once: true }
    );
  });
}

/** Kein Fade/Slide nach Preloader — nur Klasse entfernen, GSAP-Reste löschen, Lenis neu messen. */
function finishPreloaderReveal() {
  const smooth = document.getElementById('smooth-content');
  const plane = document.getElementById('hero-video-plane');
  const grain = document.querySelector('.grain-overlay');
  const headerEl = document.getElementById('site-header');
  const fabCall = document.querySelector('.fab-container .fab--call');
  const layers = [plane, smooth, headerEl, fabCall].filter(Boolean);
  document.body.classList.remove('is-intro-active');
  gsap.set([...layers, grain].filter(Boolean), { clearProps: 'opacity,transform' });
  if (grain) gsap.set(grain, { opacity: 0.04 });
  if (lenis && typeof lenis.resize === 'function') lenis.resize();
}

async function initPreloader() {
  const preloader = document.getElementById('preloader');
  const bar = document.getElementById('preloader-bar');
  const percent = document.getElementById('preloader-percent');

  const setProgress = (p) => {
    const v = Math.min(100, Math.max(0, p));
    if (bar) bar.style.width = `${v}%`;
    if (percent) percent.textContent = String(Math.round(v));
  };

  let barVal = 0;
  const barTimer = setInterval(() => {
    if (barVal < 90) {
      barVal += (90 - barVal) * 0.06 + 0.35;
      setProgress(barVal);
    }
  }, 48);

  await Promise.all([
    waitForHeroImage(),
    new Promise((r) => setTimeout(r, 420)),
  ]);

  clearInterval(barTimer);
  setProgress(100);

  await new Promise((r) => setTimeout(r, 220));
  if (preloader) preloader.classList.add('done');
  await new Promise((r) => setTimeout(r, 800));
  /* Aus dem Layout entfernen (nicht nur display:none): vermeidet Rest-Box/Webview-Mess-Artefakte. */
  if (preloader?.parentNode) preloader.remove();

  finishPreloaderReveal();
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

// ===== HERO PARALLAX — Mobil: fixe Scroll-Distanz (+=px), nicht end bottom top (lvh-Resize beim Loslassen). =====
function initHeroParallax() {
  const hero = document.querySelector('.hero');
  const media = document.getElementById('hero-video-media');
  const plane = document.getElementById('hero-video-plane');
  if (!hero || !media) return;

  const touchHero = heroUsesTouchFrozenLayout();
  if (touchHero) {
    applyHeroTouchLayoutLock();
  } else {
    syncHeroParallaxMetrics();
  }
  syncHtmlHeroTouchStableClass();

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

  const parallaxEnd = {
    y: () => -heroParallaxTravelPx,
    ease: 'none',
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end: () => getHeroParallaxScrollEnd(),
      /* Touch: fixe Scroll-Distanz + Media-Lock verringern Sprünge; Parallax bleibt aktiv. */
      scrub: touchHero ? 0.65 : 0.45,
      invalidateOnRefresh: !touchHero
    }
  };
  gsap.fromTo(media, { y: 0 }, parallaxEnd);

  ScrollTrigger.create({
    trigger: hero,
    start: 'top top',
    end: () => getHeroParallaxScrollEnd(),
    onLeave: hideVideoPlane,
    onEnterBack: showVideoPlane,
    onRefresh: (self) => {
      if (self.progress >= 0.999) hideVideoPlane();
      else showVideoPlane();
    }
  });

  requestAnimationFrame(() => {
    if (!touchHero) {
      syncHeroParallaxMetrics();
    }
    syncHtmlHeroTouchStableClass();
    ScrollTrigger.refresh();
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

      const statueNarrowViewport = window.matchMedia('(max-width: 768px)').matches;

      const setWrapOpacityFromSt = (active) => {
        wrap.style.opacity = active ? '1' : '0';
      };

      gsap.to(proxy, {
        p: 1,
        ease: 'none',
        scrollTrigger: {
          id: 'footer-statue-frame-scrub',
          trigger: zone,
          start: 'top bottom',
          end: 'bottom top',
          scrub: statueNarrowViewport ? true : 0.65,
          invalidateOnRefresh: !statueNarrowViewport,
          onToggle: (self) => {
            setWrapOpacityFromSt(self.isActive);
          },
          onUpdate: () => {
            paintProgress(proxy.p);
          }
        }
      });

      invalidateFooterStatueFrames = () => {
        lastDrawnIdx = -1;
        syncFromScrollTrigger();
      };

      requestAnimationFrame(() => {
        ScrollTrigger.refresh();
        const st = ScrollTrigger.getById('footer-statue-frame-scrub');
        if (st) setWrapOpacityFromSt(st.isActive);
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
  const playBtn = document.getElementById('cinematic-mobile-play');
  if (!pin || !stage || !video) return;

  initCinematicVideoPlayback(video);

  const copyFollow = document.getElementById('cinematic-copy-follow');
  const copyLead = copyFollow?.querySelector('.cinematic-copy--lead');
  const copyTrail = copyFollow?.querySelector('.cinematic-copy--trail');
  const cinematicSection = document.getElementById('stimmung');

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    requestAnimationFrame(() => {
      gsap.set(stage, { scale: 1, borderRadius: '0px' });
      if (copyLead && copyTrail) {
        gsap.set([copyLead, copyTrail], { clearProps: 'transform' });
      }
      playBtn?.classList.add('is-concealed');
    });
    playCinematicFromStart(video);
    return;
  }

  const videoTweenDur = 1;
  const textShiftX = () => Math.min(window.innerWidth * 0.032, 48);

  ScrollTrigger.matchMedia({
    '(min-width: 769px)': function setupCinematicDesktop() {
      const startScale = 0.52;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: '+=120%',
          pin: true,
          scrub: 0.55,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });

      const visibilityST = ScrollTrigger.create({
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

      if (copyLead && copyTrail) {
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
      }

      return function cleanupCinematicDesktop() {
        visibilityST.kill();
        tl.scrollTrigger?.kill();
        tl.kill();
      };
    },
    '(max-width: 768px)': function setupCinematicMobile() {
      video.preload = 'metadata';
      try {
        video.pause();
        video.currentTime = 0;
      } catch (e) { /* ignore */ }

      gsap.set(stage, { scale: 1, borderRadius: '0px', clearProps: 'will-change' });
      if (copyLead && copyTrail) {
        gsap.set([copyLead, copyTrail], { clearProps: 'transform' });
      }
      playBtn?.classList.remove('is-concealed');

      const resetMobileCinematic = () => {
        try {
          video.pause();
          video.currentTime = 0;
        } catch (e) { /* ignore */ }
        playBtn?.classList.remove('is-concealed');
      };

      const onPlayClick = () => {
        playCinematicFromStart(video);
        playBtn?.classList.add('is-concealed');
      };

      playBtn?.addEventListener('click', onPlayClick);

      const visibilityST = ScrollTrigger.create({
        trigger: cinematicSection || pin,
        start: 'top bottom',
        end: 'bottom top',
        invalidateOnRefresh: true,
        onLeave: resetMobileCinematic,
        onLeaveBack: resetMobileCinematic
      });

      return function cleanupCinematicMobile() {
        playBtn?.removeEventListener('click', onPlayClick);
        visibilityST.kill();
        video.preload = 'auto';
        playBtn?.classList.remove('is-concealed');
      };
    }
  });
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
/** Ganze Bild-Spalten (figure) verschieben. Editorial: Desktop Drift auf A, Mobil Bewegung auf B. Feiern-Trio: Außen-Spalten, Mobil halbe Amplitude. */
function initGalleryPairParallax() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('[data-parallax-pair]').forEach((root) => {
    const colA = root.querySelector('.gallery-pair__col--a');
    const colB = root.querySelector('.gallery-pair__col--b');
    const colC = root.querySelector('.gallery-pair__col--c');
    if (!colA || !colB) return;
    if (root.classList.contains('gallery-pair--feier-trio') && !colC) return;

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
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.5 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });
}

function configureScrollTriggerGlobals() {
  ScrollTrigger.config({
    ignoreMobileResize: false,
    anticipatePin: 1
  });
}

/** Nach Preloader + Intro: Scroll/Lenis und ST auf dasselbe Layout bringen (verhindert initialen „Hüpfer“ bei Pins). */
async function refreshScrollLayoutAfterBoot() {
  syncScrollTop();
  if (lenis && typeof lenis.resize === 'function') lenis.resize();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  ScrollTrigger.refresh();
  await new Promise((r) => setTimeout(r, 48));
  ScrollTrigger.refresh();
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
    if (heroUsesTouchFrozenLayout()) {
      applyHeroTouchLayoutLock();
    } else {
      syncHeroParallaxMetrics();
    }
    syncHtmlHeroTouchStableClass();
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

  configureScrollTriggerGlobals();

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
    if (heroUsesTouchFrozenLayout()) {
      applyHeroTouchLayoutLock();
    } else {
      syncHeroParallaxMetrics();
    }
    syncHtmlHeroTouchStableClass();
    ScrollTrigger.refresh();
  });

  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      syncScrollTop();
      ScrollTrigger.refresh();
    }
  });

  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onVisualViewportResizeForHero);

  await refreshScrollLayoutAfterBoot();

  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      lastResizeWidth = document.documentElement.clientWidth;
      if (heroUsesTouchFrozenLayout()) {
        applyHeroTouchLayoutLock();
      } else {
        syncHeroParallaxMetrics();
      }
      syncHtmlHeroTouchStableClass();
      ScrollTrigger.refresh();
    }, 300);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
