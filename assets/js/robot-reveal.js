/*!
 * RobotReveal — cursor-driven aperture that dissolves one image into another.
 *
 * UMD build: works as a plain <script src> (including from file://), as a
 * CommonJS require, and as an ES module import via a bundler.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    var api = factory();
    root.RobotReveal = api.RobotReveal;
    root.initRobotReveals = api.initRobotReveals;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var REDUCED = typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  function RobotReveal(el, options) {
    options = options || {};

    this.el = el;
    this.hoverLayer = el.querySelector('.robot-reveal__img--hover');
    if (!this.hoverLayer) return;

    // `radius` may be a number of pixels, or 'auto' to scale with the element
    // so the aperture stays proportional at any size. A fixed pixel radius on a
    // small element reveals the whole image and kills the effect entirely.
    this.radius = options.radius != null ? options.radius : 'auto';
    this.radiusRatio = options.radiusRatio != null ? options.radiusRatio : 0.3;
    this.maxRadius = options.maxRadius != null ? options.maxRadius : 260;

    // Feather: fraction of the radius that stays fully opaque before the edge
    // falls off. Without a solid core the reveal never reaches full opacity
    // even at the cursor, which reads as a washed-out smudge.
    this.core = options.core != null ? options.core : 0.55;

    // Ease is expressed per-frame-at-60fps but applied frame-rate independently,
    // so the glide feels identical on 60Hz and 120Hz displays.
    this.ease = REDUCED ? 1 : (options.ease != null ? options.ease : 0.12);

    this.target = { x: 0, y: 0, r: 0 };
    this.current = { x: 0, y: 0, r: 0 };
    this.rect = null;
    this.raf = null;
    this.running = false;
    this.lastTime = 0;
    this.destroyed = false;

    this.onMove = this.onMove.bind(this);
    this.onLeave = this.onLeave.bind(this);
    this.onResize = this.onResize.bind(this);
    this.loop = this.loop.bind(this);

    // pointer events already cover mouse, pen and touch — binding touch* as
    // well made every touch move fire the handler twice.
    el.addEventListener('pointermove', this.onMove, { passive: true });
    el.addEventListener('pointerdown', this.onMove, { passive: true });
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('pointercancel', this.onLeave);
    addEventListener('resize', this.onResize, { passive: true });

    this.measure();
    this.preload();
    this.render();
  }

  RobotReveal.prototype.measure = function () {
    this.rect = this.el.getBoundingClientRect();
    if (this.radius === 'auto') {
      var base = Math.min(this.rect.width, this.rect.height) || 0;
      this.resolvedRadius = Math.min(base * this.radiusRatio, this.maxRadius);
    } else {
      this.resolvedRadius = this.radius;
    }
    if (this.target.r > 0) this.target.r = this.resolvedRadius;
  };

  RobotReveal.prototype.onResize = function () {
    this.measure();
    if (!this.running) this.render();
  };

  // Decode the hover image up front so the first reveal doesn't flash blank
  // while the browser is still fetching it.
  RobotReveal.prototype.preload = function () {
    var img = this.hoverLayer;
    if (img && img.decode) img.decode().catch(function () {});
  };

  RobotReveal.prototype.onMove = function (e) {
    // Re-measure per move: the cached rect goes stale as soon as the page
    // scrolls or the layout shifts under a hovering cursor.
    this.rect = this.el.getBoundingClientRect();
    this.target.x = e.clientX - this.rect.left;
    this.target.y = e.clientY - this.rect.top;
    this.target.r = this.resolvedRadius;

    // First contact: drop the aperture straight onto the cursor rather than
    // gliding it in from wherever it was last left.
    if (this.current.r === 0) {
      this.current.x = this.target.x;
      this.current.y = this.target.y;
    }
    this.start();
  };

  RobotReveal.prototype.onLeave = function () {
    this.target.r = 0;
    this.start();
  };

  RobotReveal.prototype.start = function () {
    if (this.running || this.destroyed) return;
    this.running = true;
    this.lastTime = 0;
    this.raf = requestAnimationFrame(this.loop);
  };

  RobotReveal.prototype.render = function () {
    var r = Math.max(this.current.r, 0);
    var core = Math.round(this.core * 100);
    var value = r <= 0.1
      ? 'radial-gradient(circle 0px at 50% 50%, #000 0%, transparent 100%)'
      : 'radial-gradient(circle ' + r.toFixed(1) + 'px at ' +
        this.current.x.toFixed(1) + 'px ' + this.current.y.toFixed(1) + 'px, ' +
        '#000 0%, #000 ' + core + '%, transparent 100%)';
    this.hoverLayer.style.webkitMaskImage = value;
    this.hoverLayer.style.maskImage = value;
  };

  RobotReveal.prototype.loop = function (time) {
    if (this.destroyed) return;

    // Frame-rate independent lerp.
    var dt = this.lastTime ? Math.min((time - this.lastTime) / 16.667, 4) : 1;
    this.lastTime = time;
    var k = 1 - Math.pow(1 - this.ease, dt);

    this.current.x += (this.target.x - this.current.x) * k;
    this.current.y += (this.target.y - this.current.y) * k;
    this.current.r += (this.target.r - this.current.r) * k;

    this.render();

    // Park the loop once the aperture has settled. The original ran a rAF
    // callback 60x a second forever, on every instance, even at rest.
    var settled = Math.abs(this.target.r - this.current.r) < 0.15 &&
      (this.target.r === 0 ||
        (Math.abs(this.target.x - this.current.x) < 0.15 &&
         Math.abs(this.target.y - this.current.y) < 0.15));

    if (settled) {
      this.current.r = this.target.r;
      if (this.target.r === 0) { this.current.x = this.target.x; this.current.y = this.target.y; }
      this.render();
      this.running = false;
      this.raf = null;
      return;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  RobotReveal.prototype.destroy = function () {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.running = false;
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerdown', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
    this.el.removeEventListener('pointercancel', this.onLeave);
    removeEventListener('resize', this.onResize);
  };

  function initRobotReveals(selector, options) {
    selector = selector || '[data-robot-reveal]';
    options = options || {};
    var nodes = document.querySelectorAll(selector);
    return Array.prototype.map.call(nodes, function (el) {
      return new RobotReveal(el, options);
    });
  }

  return { RobotReveal: RobotReveal, initRobotReveals: initRobotReveals };
});
