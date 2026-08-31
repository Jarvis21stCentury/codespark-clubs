/* ============================================================
   CodeSpark Clubs — motion system
   ------------------------------------------------------------
   Motion brief
     Metaphor : ignition. A spark jumps, a filament heats, a circuit
                closes, a machine wakes up.
     Tempo    : fast to moderate, 280-650ms. Sharp power4/expo curves.
     Settle   : precise, no overshoot. They are pitching teachers and
                principals, so the motion has to read credible, not toy.
     Motif    : the aperture. A circle that opens onto what is inside.
                It is the hero, the kit cards, and the cursor itself.

   Authored prompts implemented below
     1  Cold Boot        preloader power-on self-test, irises open
     2  Ignition Reveal  SIGNATURE. pinned scrub opens the robot's face
     3  Trace Charge     through-line rail, fills with page progress
     4  Velocity Lean    one shared scroll velocity leans the whole page
     5  Spark Field      canvas circuit nodes that stretch with velocity
     6  Knife-In Chars   masked per-char rise with a kinetic skew
     7  Wordmark Cross   the hero name printed twice, the machine between
     8  Word Ignite      manifesto resolves word by word on scrub
     9  Filament Counter stats tally with an underline drawing beneath
    10  Aperture Card    kit modules reuse the hero's reveal at card scale
    11  Rolodex Steps    the 4 steps run sideways on vertical scroll
    12  Aperture Cursor  ring with inertia, dilates over reveal surfaces
    23  Drift Plates     every photograph rides slower than its frame
    24  Idle Respiration the machine breathes when the page is still
    25  Current Run      a charge travels the length of every section rule

   Section transitions - one boundary, one mechanic, never repeated
    13  Shutter Band     hero -> marquee, opens from its own centre line
    14  Blade Wipe       marquee -> manifesto, a raking blade uncovers it
    15  Panel Split      manifesto -> stats, four panels part from centre
    16  Fan Deck         stats -> gallery, prints laid down off a stack
    17  Iris Cut         gallery -> doors, a circle opens onto both
    18  Rack Slide       doors -> kit, modules load in like trays
    19  Tilt Deck        kit -> how, the rail tips up out of the floor
    20  Column Shear     how -> story, two columns shear in past each other
    21  Warp Draw        story -> request, the frame pulls you into it
    22  Drawer           request -> footer, the wordmark rises from a slot
     +  the seam, drawn across every one of them, alternating direction

   Everything below is guarded. If a CDN fails or a library throws, the
   page still renders and reads in full - nothing is hidden by CSS that
   only JavaScript can bring back.
   ============================================================ */

(function () {
  'use strict';

  // Gate every hidden-for-animation state on this class. Set first, so a
  // later error can never leave the page blank.
  document.documentElement.classList.add('js');

  var REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COARSE = matchMedia('(pointer: coarse)').matches;
  var hasGSAP = typeof window.gsap !== 'undefined';
  var hasST = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  var hasSplit = typeof window.SplitType !== 'undefined';

  if (hasST) {
    gsap.registerPlugin(ScrollTrigger);
    // On phones the URL bar sliding in and out fires a resize, which makes
    // ScrollTrigger recalculate every trigger mid-scroll and the page jump.
    // The viewport height has not really changed, so ignore it.
    ScrollTrigger.config({ ignoreMobileResize: true });
  }

  // One shared scroll-velocity value. The skew, the canvas and the rail
  // head all read this, so the page reacts to the user as one organism
  // instead of as a pile of separate effects.
  var vel = 0;
  var lenis = null;

  // One tempo dial for the whole page. Every duration, stagger and scrub
  // below is authored in base seconds and multiplied through d(), so the
  // pace of the site is a single number rather than sixty of them. The
  // preloader is deliberately exempt - it gates first paint.
  var TEMPO = 1.5;
  function d(sec) { return sec * TEMPO; }

  function safe(name, fn) {
    try { fn(); } catch (e) {
      if (window.console) console.warn('[site] ' + name + ' failed:', e);
    }
  }

  /* ---------- 1. smooth-scroll backbone ---------- */

  safe('lenis', function () {
    if (REDUCED || typeof window.Lenis === 'undefined' || !hasGSAP) return;
    lenis = new Lenis({
      lerp: 0.12,                   // tracks the wheel instead of coasting past it
      wheelMultiplier: 1,
      syncTouch: false,             // native momentum on touch; smoothing there feels laggy
      touchInertiaMultiplier: 12
    });
    lenis.on('scroll', function (e) {
      if (hasST) ScrollTrigger.update();
      vel = e.velocity || 0;
    });
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  });

  // Fallback velocity source when Lenis is off or absent.
  if (!lenis) {
    var lastY = window.scrollY;
    addEventListener('scroll', function () {
      vel = (window.scrollY - lastY) * 0.35;
      lastY = window.scrollY;
    }, { passive: true });
  }

  // Anchor links: route through Lenis so in-page jumps keep the same feel.
  safe('anchors', function () {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        if (lenis) lenis.scrollTo(target, { offset: -70 });
        else target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
      });
    });
  });

  /* ---------- text splitting helpers ---------- */

  // Knife-In Chars: characters rise from behind their own line mask, with a
  // slight lean in the direction of travel. Solid-colour headings only.
  function splitChars(el) {
    if (!hasSplit) return null;
    var s = new SplitType(el, { types: 'lines,chars' });
    s.lines.forEach(function (line) {
      line.style.overflow = 'hidden';
      line.style.display = 'block';
      line.style.paddingBottom = '0.06em';
      line.classList.add('split-line');
    });
    return s;
  }

  /* ---------- wordmark fit ----------
     The hero wordmark has to span the stage exactly at any viewport, which
     no vw clamp can promise once the stage stops growing with the window.
     Measured with a Range: the text overflows its own box on both sides, and
     scrollWidth only ever reports the overflow on the right. */

  function fitWordmark() {
    var stage = document.getElementById('heroStage');
    var words = document.querySelectorAll('.hero__word');
    if (!stage || !words.length || typeof document.createRange !== 'function') return;

    // Measured on a stripped clone, never on the live node: the entrance
    // tween has scale and letter-spacing in flight, and measuring through
    // those bakes the animation's midpoint into the final size.
    function measure(word, size) {
      var probe = word.cloneNode(true);
      probe.style.cssText = '';
      probe.className = 'display hero__word';
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.left = '0';
      probe.style.top = '0';
      probe.style.width = 'auto';
      probe.style.transform = 'none';
      probe.style.clipPath = 'none';
      probe.style.fontSize = size + 'px';
      stage.appendChild(probe);
      var w = probe.getBoundingClientRect().width;
      stage.removeChild(probe);
      return w;
    }

    function fit() {
      var avail = stage.clientWidth;
      if (!avail) return;
      var natural = measure(words[0], 200);
      if (!natural) return;
      var size = (200 * (avail / natural) * 0.995).toFixed(2) + 'px';
      words.forEach(function (w) { w.style.fontSize = size; });
    }

    fit();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    addEventListener('load', fit);

    var t;
    addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(fit, 140);
    }, { passive: true });
  }

  /* ---------- 2. Cold Boot preloader ---------- */

  var BOOT_LINES = [
    '> mounting curriculum.pkg',
    '> linking club network [7 regions]',
    '> loading promo assets',
    '> handshake ok'
  ];

  function coldBoot(done) {
    var boot = document.getElementById('boot');
    if (!boot) { done(); return; }
    if (REDUCED || !hasGSAP) { boot.remove(); done(); return; }

    var log = document.getElementById('bootLog');
    var count = document.getElementById('bootCount');
    var bar = document.getElementById('bootBar');
    var n = { v: 0 };

    var tl = gsap.timeline({
      onComplete: function () { boot.remove(); done(); }
    });

    BOOT_LINES.forEach(function (line, i) {
      tl.call(function () {
        log.innerHTML += (i ? '<br>' : '') + line.replace(/\[(.+?)\]/, '<b>[$1]</b>');
      }, null, i * 0.28);
    });

    tl.to(n, {
      v: 100, duration: 1.35, ease: 'power2.inOut',
      onUpdate: function () {
        count.textContent = String(Math.round(n.v)).padStart(3, '0');
      }
    }, 0)
      .to(bar, { scaleX: 1, duration: 1.35, ease: 'power2.inOut' }, 0)
      // The aperture motif announces itself before the page even loads.
      .to(boot, {
        clipPath: 'circle(0% at 50% 50%)',
        duration: 0.85, ease: 'power4.inOut'
      }, '+=0.12')
      .to(boot, { opacity: 0, duration: 0.2 }, '-=0.2');
  }

  /* ---------- 3. Trace Charge + 4. Velocity Lean ---------- */

  function flowLayer() {
    if (!hasGSAP) return;
    var fill = document.getElementById('railFill');
    var skewers = REDUCED ? [] : gsap.utils.toArray('[data-skew]');
    var setters = skewers.map(function (el) { return gsap.quickSetter(el, 'skewY', 'deg'); });
    var cur = 0;

    gsap.ticker.add(function () {
      // through-line: the rail is present in every section, so nothing
      // down the page ever feels orphaned.
      if (fill) {
        var max = document.documentElement.scrollHeight - innerHeight;
        var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        fill.style.height = (p * 100) + 'vh';
        fill.style.setProperty('--glow', (8 + Math.min(Math.abs(vel) * 1.4, 22)) + 'px');
      }
      if (setters.length) {
        var target = gsap.utils.clamp(-4, 4, vel * 0.26);
        cur += (target - cur) * 0.1;
        setters.forEach(function (fn) { fn(cur); });
      }
      vel *= 0.92; // decay so the lean settles when scrolling stops
    });
  }

  /* ---------- 5. Spark Field ---------- */

  function sparkField() {
    var cv = document.getElementById('field');
    if (!cv || REDUCED) { if (cv) cv.remove(); return; }
    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(devicePixelRatio || 1, 2);
    var nodes = [];
    var COUNT = innerWidth < 760 ? 26 : 52;
    var LINK = innerWidth < 760 ? 130 : 170;
    var raf = null;

    function size() {
      cv.width = innerWidth * dpr;
      cv.height = innerHeight * dpr;
      cv.style.width = innerWidth + 'px';
      cv.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      nodes = [];
      for (var i = 0; i < COUNT; i++) {
        // Colour is rolled once per node, never inside the draw loop -
        // per-frame allocation is what turns a canvas into jank.
        // three node types, rolled once each: warm sparks, a few cold LEDs
        // the colour of the machine's interior, and neutral filler.
        var roll = Math.random();
        var hot = roll < 0.2;
        var cold = !hot && roll < 0.3;
        nodes.push({
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          vx: (Math.random() - 0.5) * 0.13,
          vy: (Math.random() - 0.5) * 0.13,
          r: hot || cold ? 1.6 : 1,
          c: hot ? 'rgba(224,74,44,0.85)'
            : cold ? 'rgba(127,233,255,0.6)'
            : 'rgba(155,161,169,0.45)'
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      // the same shared velocity drives the field: scroll fast and the
      // circuit accelerates and its traces stretch.
      var boost = 1 + Math.min(Math.abs(vel) * 0.11, 5);

      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        n.x += n.vx * boost;
        n.y += n.vy * boost;
        if (n.x < -20) n.x = innerWidth + 20;
        if (n.x > innerWidth + 20) n.x = -20;
        if (n.y < -20) n.y = innerHeight + 20;
        if (n.y > innerHeight + 20) n.y = -20;

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, 6.2832);
        ctx.fillStyle = n.c;
        ctx.fill();
      }

      ctx.lineWidth = 1;
      for (var a = 0; a < nodes.length; a++) {
        for (var b = a + 1; b < nodes.length; b++) {
          var dx = nodes[a].x - nodes[b].x;
          var dy = nodes[a].y - nodes[b].y;
          var d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          var o = (1 - Math.sqrt(d2) / LINK) * 0.16;
          ctx.strokeStyle = 'rgba(155,161,169,' + o.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(nodes[a].x, nodes[a].y);
          ctx.lineTo(nodes[b].x, nodes[b].y);
          ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    }

    size(); seed(); draw();

    addEventListener('resize', function () { size(); seed(); }, { passive: true });
    // Stop burning frames when the tab is in the background.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(raf); raf = null; }
      else if (!raf) draw();
    });
  }

  /* ---------- 12. Aperture Cursor ---------- */

  function apertureCursor() {
    var dot = document.getElementById('cursor');
    if (!dot) return;
    if (REDUCED || COARSE || !hasGSAP) { dot.remove(); return; }

    dot.classList.add('is-live');
    var t = { x: innerWidth / 2, y: innerHeight / 2 };
    var p = { x: t.x, y: t.y };

    addEventListener('mousemove', function (e) { t.x = e.clientX; t.y = e.clientY; }, { passive: true });
    gsap.ticker.add(function () {
      p.x += (t.x - p.x) * 0.13;
      p.y += (t.y - p.y) * 0.13;
      gsap.set(dot, { x: p.x, y: p.y });
    });

    document.querySelectorAll('a, button, input, select, textarea').forEach(function (el) {
      el.addEventListener('mouseenter', function () { dot.classList.add('is-link'); });
      el.addEventListener('mouseleave', function () { dot.classList.remove('is-link'); });
    });
    // Over a reveal surface the cursor becomes the aperture it is driving.
    document.querySelectorAll('.robot-reveal').forEach(function (el) {
      el.addEventListener('mouseenter', function () { dot.classList.add('is-aperture'); });
      el.addEventListener('mouseleave', function () { dot.classList.remove('is-aperture'); });
    });
  }

  /* ---------- magnetic CTAs ---------- */

  function magnetics() {
    if (REDUCED || COARSE || !hasGSAP) return;
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        gsap.to(el, {
          x: (e.clientX - r.left - r.width / 2) * 0.28,
          y: (e.clientY - r.top - r.height / 2) * 0.4,
          duration: 0.5, ease: 'power3.out'
        });
      });
      el.addEventListener('mouseleave', function () {
        // precise return, not an elastic wobble - this brand does not bounce
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'power4.out' });
      });
    });
  }

  /* ---------- reveals: entrance choreography ---------- */

  function entrances() {
    if (!hasGSAP) return;

    if (REDUCED) {
      gsap.set('[data-reveal]', { opacity: 1 });
      return;
    }

    // generic blocks - short, sharp, never the only motion on the page
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 26 },
        {
          opacity: 1, y: 0, duration: d(0.75), ease: 'power4.out',
          scrollTrigger: hasST ? { trigger: el, start: 'top 88%' } : undefined
        });
    });

    // Knife-In Chars
    gsap.utils.toArray('[data-split-chars]').forEach(function (el) {
      var s = splitChars(el);
      if (!s || !s.chars.length) return;
      gsap.from(s.chars, {
        yPercent: 118,
        skewX: -7,
        duration: d(0.82),
        ease: 'power4.out',
        stagger: { each: d(0.014) },
        scrollTrigger: hasST ? { trigger: el, start: 'top 86%' } : undefined
      });
    });

  }

  /* ---------- 8. Word Ignite ---------- */

  function wordIgnite() {
    var el = document.getElementById('manifesto');
    if (!el || !hasSplit || !hasST || REDUCED) return;
    var s = new SplitType(el, { types: 'words' });
    s.words.forEach(function (w) { w.classList.add('w'); });
    gsap.to(s.words, {
      color: '#f1f2f4',
      ease: 'none',
      stagger: d(0.4),
      scrollTrigger: {
        trigger: el,
        start: 'top 78%',
        end: 'bottom 55%',
        scrub: d(0.6)
      }
    });
  }

  /* ---------- 9. Filament Counter ---------- */

  function counters() {
    if (!hasGSAP) return;
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var end = parseFloat(el.getAttribute('data-count'));
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var group = el.hasAttribute('data-group');
      var plus = el.hasAttribute('data-plus');
      var line = el.parentNode.querySelector('.stat__line');

      function write(v) {
        var n = Math.round(v);
        var body = group ? n.toLocaleString('en-US') : String(n);
        el.innerHTML = prefix + body +
          (plus ? '<b class="stat__plus">+</b>' : '') +
          (suffix ? '<sup>' + suffix + '</sup>' : '');
      }

      if (REDUCED || !hasST) { write(end); if (line) gsap.set(line, { scaleX: 1 }); return; }

      write(0);
      var o = { v: 0 };
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () {
          gsap.to(o, {
            v: end, duration: d(1.5), ease: 'power2.out',
            onUpdate: function () { write(o.v); }
          });
          if (line) gsap.to(line, { scaleX: 1, duration: d(1.1), ease: 'power3.inOut' });
        }
      });
    });
  }

  /* ---------- marquee ---------- */

  function marquee() {
    var track = document.getElementById('marquee');
    if (!track || !hasGSAP || REDUCED) return;
    track.innerHTML += track.innerHTML;   // duplicate for a seamless loop
    gsap.to(track, { xPercent: -50, duration: d(26), ease: 'none', repeat: -1 });
  }

  /* ---------- 2 + 10. the aperture reveals ---------- */

  function reveals() {
    if (typeof window.RobotReveal === 'undefined') return;

    // There is no cursor to "move" on a touch screen, and the scroll-pin
    // is desktop-only, so say what actually works there.
    if (COARSE) {
      var tag = document.getElementById('heroHint');
      if (tag) tag.innerHTML = '<b>\u25b8</b> Drag across the face';
    }

    // 10. Aperture Card - the hero's signature, repeated at card scale.
    // This repetition is the shared DNA that ties the page together.
    document.querySelectorAll('[data-module-reveal]').forEach(function (el) {
      new RobotReveal(el, { radiusRatio: 0.42, maxRadius: 190, ease: 0.11, core: 0.5 });
    });

    // 2. Ignition Reveal - the signature moment.
    var heroEl = document.getElementById('heroReveal');
    if (!heroEl) return;
    var hero = new RobotReveal(heroEl, {
      radiusRatio: 0.34, maxRadius: 300, ease: 0.095, core: 0.58
    });
    if (!hero.hoverLayer) return;

    if (REDUCED || !hasST) return;

    var hovering = false;
    heroEl.addEventListener('pointerenter', function () { hovering = true; });
    heroEl.addEventListener('pointerleave', function () { hovering = false; });

    // Scroll controls HOW FAR the face opens. The cursor controls WHERE you
    // look. Two inputs on one object - that is the moment worth recording.
    gsap.matchMedia().add('(min-width: 981px)', function () {
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: '+=170%',
          pin: true,
          scrub: d(1),
          anticipatePin: 1,
          onUpdate: function (self) {
            if (hovering) return;             // let the pointer win when it is there
            var rect = heroEl.getBoundingClientRect();
            hero.target.x = rect.width * 0.5;
            hero.target.y = rect.height * 0.42;
            hero.target.r = self.progress * Math.min(rect.width * 0.62, 380);
            hero.start();
          }
        }
      });

      // As the face opens the machine also comes at you: the figure grows,
      // the wordmark spreads and dims behind it, the frame furniture leaves.
      tl.to('.hero__figure', { scale: 1.12, yPercent: -3, ease: 'none' }, 0)
        .to('.hero__word--back', { scale: 1.1, opacity: 0.45, ease: 'none' }, 0)
        .to('.hero__word--front', { scale: 1.1, opacity: 0.75, ease: 'none' }, 0)
        .to('.hero__foot, .hero__eyebrow', { opacity: 0.15, y: 16, ease: 'none' }, 0)
        .to('.hero__hint', { opacity: 0, ease: 'none' }, 0);

      return function () { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); };
    });
  }

  /* ---------- 13-22. section transitions ----------
     One boundary, one mechanic, never repeated. Each is authored around
     what the section actually is: the stats row is four panels, so it
     splits; the gallery is a stack of prints, so it fans; the kit is a
     window onto six modules, so it opens through blinds.

     All of it is decorative and additive. Nothing here is the only thing
     making a section visible - kill the JS and the page still reads. */

  function sectionTransitions() {
    if (!hasGSAP || !hasST || REDUCED) return;

    function q(sel) { return document.querySelector(sel); }
    function make(tag, cls, parent) {
      var el = document.createElement(tag);
      el.className = cls;
      parent.appendChild(el);
      return el;
    }

    /* --- the through-line: one seam drawn across every boundary --- */
    ['.marquee', '.manifesto', '.stats', '.gallery', '.split',
     '.kit', '.how', '.story', '.cta', '.footer'].forEach(function (sel, i) {
      var host = q(sel);
      if (!host) return;
      var seam = make('i', 'seam', host);
      // alternate the origin so consecutive seams draw in opposite
      // directions - the page reads as stitched, not as ten copies
      gsap.set(seam, { transformOrigin: i % 2 ? 'right center' : 'left center' });
      gsap.to(seam, {
        scaleX: 1, ease: 'power2.inOut',
        scrollTrigger: { trigger: host, start: 'top 100%', end: 'top 45%', scrub: d(0.5) }
      });
    });

    /* --- 13. Shutter Band : hero -> marquee --- */
    var band = q('.marquee');
    if (band) {
      gsap.fromTo(band,
        { clipPath: 'inset(50% 0% 50% 0%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)', ease: 'power3.out',
          scrollTrigger: { trigger: band, start: 'top 100%', end: 'top 56%', scrub: d(0.6) }
        });
      gsap.from('.marquee__item', {
        opacity: 0, duration: d(0.5), stagger: d(0.03), ease: 'power2.out',
        scrollTrigger: { trigger: band, start: 'top 88%' }
      });
    }

    /* --- 14. Blade Wipe : marquee -> manifesto --- */
    var man = q('.manifesto');
    var manInner = man && man.querySelector('.section__inner');
    if (man && manInner) {
      var blade = make('i', 'blade', man);
      var bladeTl = gsap.timeline({
        scrollTrigger: { trigger: man, start: 'top 100%', end: 'top 18%', scrub: d(0.8) }
      });
      bladeTl
        .fromTo(blade, { xPercent: -60 }, { xPercent: 290, duration: d(1), ease: 'none' }, 0)
        // the copy is uncovered just behind the blade's trailing edge
        .fromTo(manInner,
          { clipPath: 'inset(0% 100% 0% 0%)' },
          { clipPath: 'inset(0% 0% 0% 0%)', duration: d(0.78), ease: 'none' }, 0.14);
    }

    /* --- 15. Panel Split : manifesto -> stats --- */
    var statGrid = q('.stats__grid');
    if (statGrid) {
      gsap.fromTo(statGrid,
        { clipPath: 'inset(0% 50% 0% 50%)' },
        {
          clipPath: 'inset(0% 0% 0% 0%)', duration: d(1.1), ease: 'power4.inOut',
          scrollTrigger: { trigger: statGrid, start: 'top 86%' }
        });
      gsap.from('.stats .stat', {
        xPercent: function (i) { return i < 2 ? -18 : 18; },
        opacity: 0, duration: d(0.9), ease: 'power4.out',
        stagger: { each: d(0.07), from: 'center' },
        scrollTrigger: { trigger: statGrid, start: 'top 86%' }
      });
    }

    /* --- 16. Fan Deck : stats -> gallery --- */
    if (q('.gallery__grid')) {
      gsap.from('.gallery .shot', {
        yPercent: 16,
        scale: 0.93,
        opacity: 0,
        rotation: function (i) { return (i % 2 ? 3.5 : -3.5); },
        transformOrigin: '50% 100%',
        duration: d(1), ease: 'power4.out',
        stagger: { each: d(0.055) },
        scrollTrigger: { trigger: '.gallery__grid', start: 'top 84%' }
      });
    }

    /* --- 17. Iris Cut : gallery -> the two doors --- */
    var split = q('.split');
    if (split) {
      gsap.fromTo(split,
        { clipPath: 'circle(0% at 50% 50%)' },
        {
          clipPath: 'circle(82% at 50% 50%)', ease: 'power2.out',
          scrollTrigger: { trigger: split, start: 'top 100%', end: 'top 26%', scrub: d(0.7) }
        });
      gsap.from('.door', {
        xPercent: function (i) { return i ? 7 : -7; },
        duration: d(1.1), ease: 'power4.out',
        scrollTrigger: { trigger: split, start: 'top 80%' }
      });
    }

    /* --- 18. Rack Slide : doors -> the kit ---
       Was a set of blinds retracting over the grid. Six thin panels scaling
       against a background of nearly the same colour read as tearing rather
       than as a mechanism, so the modules now load like trays into a rack:
       the top row slides in from the left, the bottom row from the right,
       each card wiping open in the direction it travels. Nothing overlaps
       the type, and nothing flickers. */
    var modules = gsap.utils.toArray('.kit .module');
    if (modules.length) {
      var perRow = innerWidth < 600 ? 1 : (innerWidth < 900 ? 2 : 3);
      modules.forEach(function (card, i) {
        var fromLeft = Math.floor(i / perRow) % 2 === 0;
        gsap.fromTo(card,
          {
            xPercent: fromLeft ? -22 : 22,
            opacity: 0,
            clipPath: fromLeft ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)'
          },
          {
            xPercent: 0,
            opacity: 1,
            clipPath: 'inset(0 0 0 0)',
            duration: d(1.15),
            ease: 'power3.out',
            delay: (i % perRow) * d(0.09),
            scrollTrigger: { trigger: card, start: 'top 90%' }
          });
      });
    }

    /* --- 19. Tilt Deck : kit -> how it works --- */
    if (q('.how')) {
      gsap.from('.how__head, .how .step', {
        yPercent: 14, rotateX: 18, opacity: 0,
        transformOrigin: '50% 0%',
        duration: d(0.95), ease: 'power3.out', stagger: d(0.05),
        scrollTrigger: { trigger: '.how', start: 'top 76%' }
      });
    }

    /* --- 20. Column Shear : how -> the story --- */
    var storyCol = q('.story__grid > div');
    if (storyCol) {
      gsap.from(storyCol, {
        xPercent: -8, skewY: 3, opacity: 0,
        duration: d(1), ease: 'power4.out',
        scrollTrigger: { trigger: '.story', start: 'top 76%' }
      });
      gsap.from('.timeline li', {
        xPercent: 9, skewY: -3, opacity: 0,
        duration: d(0.8), ease: 'power4.out', stagger: d(0.06),
        scrollTrigger: { trigger: '.timeline', start: 'top 84%' }
      });
      gsap.from('.founder', {
        yPercent: 20, rotateX: -16, opacity: 0,
        transformOrigin: '50% 100%',
        duration: d(0.85), ease: 'power3.out', stagger: d(0.08),
        scrollTrigger: { trigger: '.founders', start: 'top 90%' }
      });
    }

    /* --- 21. Warp Draw : story -> the request --- */
    if (q('.cta')) {
      gsap.fromTo('.cta__bg img',
        { scale: 1.32 },
        {
          scale: 1, ease: 'none',
          scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'top 12%', scrub: d(0.9) }
        });
      gsap.from('.cta__title', {
        scale: 0.86, transformOrigin: '0% 50%',
        duration: d(1.1), ease: 'power4.out',
        scrollTrigger: { trigger: '.cta', start: 'top 74%' }
      });
    }

    /* --- 22. Drawer : request -> footer --- */
    var word = q('.footer__word');
    if (word && word.parentNode) {
      var drawer = document.createElement('div');
      drawer.className = 'drawer';
      word.parentNode.insertBefore(drawer, word);
      drawer.appendChild(word);
      gsap.fromTo(word,
        { yPercent: 105 },
        {
          yPercent: 0, ease: 'power3.out',
          scrollTrigger: { trigger: '.footer', start: 'top 100%', end: 'top 40%', scrub: d(0.7) }
        });
    }
  }

  /* ---------- 11. Rolodex Steps ---------- */

  function horizontalSteps() {
    var wrap = document.getElementById('howWrap');
    var track = document.getElementById('howTrack');
    if (!wrap || !track) return;
    var steps = track.querySelectorAll('.step');

    if (REDUCED || !hasST) {
      // fall back to a readable stack
      wrap.classList.add('is-stacked');
      track.style.flexWrap = 'wrap';
      track.style.height = 'auto';
      track.style.padding = '0 var(--gutter) 2rem';
      steps.forEach(function (s) { s.classList.add('is-live'); });
      return;
    }

    // Exactly one step is ever lit. A per-step trigger with its own
    // start/end window can't promise that - the windows overlap, so two
    // light at once through the middle of the rail. Instead the rail's
    // progress is cut into one even share per step, which is both a single
    // winner by construction and a steady rhythm: each step holds the
    // highlight for exactly as long as the one before it.
    function lightStep() {
      // Progress is read back off the track's rendered x rather than off a
      // tween or a trigger, so it always describes the frame on screen.
      var travel = track.scrollWidth - innerWidth;
      var x = (hasGSAP && gsap.getProperty(track, 'x')) || 0;
      var progress = travel > 0 ? Math.min(Math.max(-x / travel, 0), 1) : 0;
      var idx = Math.min(steps.length - 1, Math.floor(progress * steps.length));
      steps.forEach(function (step, i) {
        step.classList.toggle('is-live', i === idx);
      });
    }

    gsap.matchMedia().add('(min-width: 761px)', function () {
      var tween = gsap.to(track, {
        x: function () { return -(track.scrollWidth - innerWidth); },
        ease: 'none',
        // driven by the tween's own render, not by scroll events: with scrub
        // the track is still gliding to its final x after the last scroll
        // event, and a scroll-driven check measures stale positions - which
        // left the last step permanently unlit.
        onUpdate: lightStep,
        scrollTrigger: {
          trigger: wrap,
          start: 'top top',
          // no long tail after the last step - a half-viewport of extra scroll
          // here left a dead beat where nothing moved.
          end: function () { return '+=' + ((track.scrollWidth - innerWidth) * 1.45 + innerHeight * 0.12); },
          pin: true,
          scrub: d(1),
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onRefresh: lightStep
        }
      });

      lightStep();

      return function () {
        steps.forEach(function (step) { step.classList.remove('is-live'); });
        tween.scrollTrigger && tween.scrollTrigger.kill();
        tween.kill();
      };
    });

    // narrow screens: stack it, no pin
    gsap.matchMedia().add('(max-width: 760px)', function () {
      wrap.classList.add('is-stacked');
      track.style.flexDirection = 'column';
      track.style.alignItems = 'stretch';
      track.style.height = 'auto';
      track.style.padding = '0 var(--gutter) 3rem';
      steps.forEach(function (s) { s.style.width = '100%'; s.classList.add('is-live'); });
      return function () {
        wrap.classList.remove('is-stacked');
        track.style.flexDirection = '';
        track.style.alignItems = '';
        track.style.height = '';
        track.style.padding = '';
        steps.forEach(function (s) { s.style.width = ''; s.classList.remove('is-live'); });
      };
    });
  }

  /* ---------- 23 + 24. ambient life ----------
     Everything above this point is a transition INTO something: it fires
     once at a boundary and then the section holds perfectly still. A page
     built only of those reads as static no matter how many of them there
     are. These two never stop. */

  function ambient() {
    if (!hasGSAP || REDUCED) return;

    // 23. Drift Plates - each photograph rides slower than the frame that
    // holds it, so the page reads as an assembly with depth rather than a
    // printed sheet. Three depths in rotation, so no two neighbours track
    // together and the grid never looks like one sheet sliding.
    if (hasST) {
      document.querySelectorAll('.shot img, .door__bg img').forEach(function (img, i) {
        var depth = 4.5 + (i % 3) * 2.25;
        gsap.fromTo(img,
          { yPercent: -depth },
          {
            yPercent: depth,
            ease: 'none',
            scrollTrigger: {
              trigger: img.closest('.shot, .door') || img,
              start: 'top bottom',
              end: 'bottom top',
              // welded to the scroll, not smoothed: a lagging plate reads as
              // the image sliding around loose inside its frame.
              scrub: true
            }
          });
      });
    }

    // 24. Idle Respiration - a powered machine at idle is never perfectly
    // still. The hero pin drives .hero__figure, so this breathes the layer
    // inside it and the two transforms compose instead of fighting.
    var machine = document.getElementById('heroReveal');
    if (machine && !COARSE) {
      gsap.to(machine, {
        y: -9,
        duration: d(2.6),
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });
    }
  }

  /* ---------- nav + form ---------- */

  function chrome() {
    var nav = document.getElementById('nav');
    if (nav) {
      addEventListener('scroll', function () {
        nav.classList.toggle('is-stuck', window.scrollY > 40);
      }, { passive: true });
    }

    var form = document.getElementById('requestForm');
    var status = document.getElementById('formStatus');
    if (!form) return;

    var submit = form.querySelector('button[type="submit"]');

    // Posts to the serverless endpoint, which files the submission in the
    // CodeSpark inbox and sends the requester their confirmation. If that
    // endpoint is unreachable or unconfigured — a local file:// preview, a
    // missing API key — we fall back to the mail draft rather than dropping
    // someone's request on the floor.
    function mailtoFallback(d) {
      var body = [
        'Name: ' + (d.get('name') || ''),
        'School: ' + (d.get('school') || ''),
        'Email: ' + (d.get('email') || ''),
        'Students expected: ' + (d.get('students') || ''),
        'Needs: ' + (d.get('need') || ''),
        '',
        (d.get('notes') || '')
      ].join('\n');

      if (status) status.textContent = 'Opening your mail app…';
      window.location.href = 'mailto:clubs.codespark@gmail.com' +
        '?subject=' + encodeURIComponent('Club materials request — ' + (d.get('school') || '')) +
        '&body=' + encodeURIComponent(body);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(form);

      if (!window.fetch || location.protocol === 'file:') { mailtoFallback(d); return; }

      var payload = {};
      d.forEach(function (v, k) { payload[k] = String(v); });

      if (submit) submit.disabled = true;
      if (status) status.textContent = 'Sending…';

      fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      }).then(function () {
        form.reset();
        if (status) {
          status.textContent = 'Sent — check your inbox for confirmation';
          status.classList.add('is-ok');
        }
        if (submit) submit.disabled = false;
      }).catch(function () {
        if (submit) submit.disabled = false;
        mailtoFallback(d);
      });
    });
  }

  /* ---------- boot ---------- */

  function start() {
    safe('fitWordmark', fitWordmark);
    safe('reveals', reveals);
    safe('entrances', entrances);
    safe('wordIgnite', wordIgnite);
    safe('counters', counters);
    safe('marquee', marquee);
    safe('horizontalSteps', horizontalSteps);
    safe('sectionTransitions', sectionTransitions);
    safe('sparkField', sparkField);
    safe('cursor', apertureCursor);
    safe('magnetics', magnetics);
    safe('flowLayer', flowLayer);
    safe('ambient', ambient);
    safe('chrome', chrome);

    // Hero entrance, choreographed as one gesture rather than a set of
    // independent fades: the frame opens, the wordmark rises through it.
    if (hasGSAP && !REDUCED) {
      // One gesture, not five fades: the machine is unveiled from the floor
      // up, and the wordmark spreads out of it as it lands.
      var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
      tl.from('.hero__figure', {
        clipPath: 'inset(0 0 100% 0)', yPercent: 6,
        duration: d(1.15), ease: 'power4.inOut'
      }, 0)
        .from('.hero__word', {
          scale: 1.16, opacity: 0, letterSpacing: '0.06em',
          duration: d(1.1), stagger: d(0.06)
        }, 0.18)
        .from('.hero__eyebrow', { opacity: 0, y: 14, duration: d(0.6) }, 0.3)
        .from('.hero__foot', { opacity: 0, y: 22, duration: d(0.8) }, 0.42)
        .from('.hero__hint', { opacity: 0, duration: d(0.5) }, 0.95);
    }

    // Layout settles after fonts and images land, so re-measure the pins.
    if (hasST) {
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
      }
      addEventListener('load', function () { ScrollTrigger.refresh(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { coldBoot(start); });
  } else {
    coldBoot(start);
  }
})();
