/* ============================================================
   animations.js — GSAP + ScrollTrigger + SplitText
   Cinematic entrance, typography reveals, parallax, marquee.
   Progressive enhancement: if GSAP is missing or the user
   prefers reduced motion, everything is shown statically.
   ============================================================ */

(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Safety: no GSAP (or reduced motion) → show all content ---- */
  function showStatically() {
    root.classList.remove("js-anim");
    root.classList.add("no-anim");
  }

  if (!window.gsap || !window.ScrollTrigger || reduce) {
    showStatically();
  } else {
    boot();
  }

  function boot() {
    var gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);
    if (window.SplitText) { gsap.registerPlugin(window.SplitText); }

    gsap.defaults({ ease: "power3.out", duration: 1 });
    window.ScrollTrigger.config({ ignoreMobileResize: true });

    var introPlayed = false;

    /* ========================================================
       Utilities
       ======================================================== */
    function trySplit(el, opts) {
      if (!window.SplitText || !el) { return null; }
      try { return new window.SplitText(el, opts); }
      catch (err) { return null; }
    }

    /* ========================================================
       Hero name — letter scramble
       MADHAN → DEVELOPER → EDITOR
       Each character shuffles through random glyphs, then
       resolves into the next name.
       ======================================================== */
    function setupHeroName() {
      var host = doc.getElementById("heroName");
      if (!host) { return null; }

      var line = host.querySelector(".scramble-text");
      if (!line) { return null; }

      var words = ["MADHAN", "DEVELOPER", "EDITOR", "CONTENT WRITER"];
      var GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$*+/";
      var index = 0;
      var frameTimer = null;
      var loopTimer = null;
      var currentWord = words[0];

      function glyph() {
        return GLYPHS.charAt(Math.floor(Math.random() * GLYPHS.length));
      }

      function randColor() {
        return "hsl(" + Math.floor(Math.random() * 360) + ", 88%, 64%)";
      }

      /* Keep longer names inside the container by scaling the type down. */
      function fitTo(word) {
        currentWord = word;
        line.style.fontSize = "";
        var box = host.parentNode;
        var cs = box ? window.getComputedStyle(box) : null;
        var pad = cs ? (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) : 0;
        var avail = box ? box.clientWidth - pad : 0;
        if (!avail) { return; }
        var probe = line.cloneNode(false);
        probe.textContent = word;
        probe.style.position = "absolute";
        probe.style.left = "-9999px";
        probe.style.top = "0";
        probe.style.visibility = "hidden";
        probe.style.pointerEvents = "none";
        host.appendChild(probe);
        var natural = probe.getBoundingClientRect().width;
        var size = parseFloat(window.getComputedStyle(probe).fontSize) || 16;
        host.removeChild(probe);
        if (natural > avail) {
          line.style.fontSize = (size * (avail / natural) * (avail < 520 ? 0.93 : 0.98)) + "px";
        }
      }

      window.addEventListener("resize", function () { fitTo(currentWord); });
      window.addEventListener("orientationchange", function () {
        window.setTimeout(function () { fitTo(currentWord); refresh(); }, 180);
      });

      function scrambleTo(word, onDone) {
        fitTo(word);
        var chars = word.split("");
        var revealAt = chars.map(function (_, i) {
          return i * 2 + Math.floor(Math.random() * 7) + 3;
        });
        var maxFrame = revealAt[revealAt.length - 1] + 3;
        var frame = 0;

        window.clearInterval(frameTimer);
        frameTimer = window.setInterval(function () {
          var out = "";
          for (var i = 0; i < chars.length; i++) {
            if (frame >= revealAt[i]) {
              out += "<span>" + chars[i] + "</span>";
            } else {
              out += '<span style="color:' + randColor() + '">' + glyph() + "</span>";
            }
          }
          line.innerHTML = out;
          frame += 1;
          if (frame > maxFrame) {
            window.clearInterval(frameTimer);
            line.textContent = word;
            if (onDone) { onDone(); }
          }
        }, 45);
      }

      function next() {
        index = (index + 1) % words.length;
        scrambleTo(words[index], function () {
          loopTimer = window.setTimeout(next, 1500);
        });
      }

      return {
        start: function () {
          if (reduce) {
            window.setInterval(function () {
              index = (index + 1) % words.length;
              fitTo(words[index]);
              line.textContent = words[index];
            }, 2600);
            return;
          }
          /* Open with MADHAN scrambling into place, then cycle. */
          line.textContent = "";
          scrambleTo(words[index], function () {
            loopTimer = window.setTimeout(next, 1500);
          });
        }
      };
    }

    var heroName = setupHeroName();

    function playIntro() {
      if (introPlayed) { return; }
      introPlayed = true;
      if (heroName) { heroName.start(); }
    }

    /* Fired by main.js once the page is ready. */
    window.addEventListener("portfolio:ready", playIntro, { once: true });
    /* Fallback if the event never arrives. */
    window.setTimeout(playIntro, 4000);

    /* ========================================================
       Scroll-triggered reveals (outside the hero)
       ======================================================== */
    function isOutsideHero(el) { return !el.closest("#hero"); }

    function setupReveals() {
      var singles = gsap.utils.toArray("[data-reveal]").filter(isOutsideHero);
      singles.forEach(function (el) {
        var useBlur = el.hasAttribute("data-blur");
        var from = { autoAlpha: 0, y: 34 };
        var to = {
          autoAlpha: 1, y: 0, duration: 1, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 86%" }
        };
        if (useBlur) { from.filter = "blur(12px)"; to.filter = "blur(0px)"; }
        gsap.fromTo(el, from, to);
      });

      var groups = gsap.utils.toArray("[data-stagger]").filter(isOutsideHero);
      groups.forEach(function (group) {
        var kids = Array.prototype.slice.call(group.children);
        if (!kids.length) { return; }
        gsap.fromTo(kids, { autoAlpha: 0, y: 28 }, {
          autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.08, ease: "power3.out",
          scrollTrigger: { trigger: group, start: "top 84%" }
        });
      });
    }

    /* ========================================================
       Animated section headings (line mask reveal)
       ======================================================== */
    function setupHeadings() {
      gsap.utils.toArray('[data-split="lines"]').forEach(function (el) {
        var split = trySplit(el, { type: "lines", mask: "lines", linesClass: "st-line" });
        var targets = split && split.lines.length ? split.lines : [el];

        if (!split) {
          /* Fallback: slide the whole heading in */
          gsap.fromTo(el, { y: 40, autoAlpha: 0 }, {
            y: 0, autoAlpha: 1, duration: 1, ease: "power3.out",
            scrollTrigger: { trigger: el, start: "top 88%" }
          });
          return;
        }

        gsap.fromTo(targets, { yPercent: 118 }, {
          yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.12,
          scrollTrigger: { trigger: el, start: "top 86%" }
        });
      });
    }

    /* ========================================================
       Parallax
       ======================================================== */
    function setupParallax() {
      var bg = null; /* Background movement disabled */
      if (bg) {
        gsap.to(bg, {
          yPercent: 10, ease: "none",
          scrollTrigger: { trigger: doc.body, start: "top top", end: "bottom bottom", scrub: true }
        });
      }

      var portrait = doc.getElementById("portraitImg");
      if (portrait) {
        gsap.fromTo(portrait, { yPercent: -4 }, {
          yPercent: 6, ease: "none",
          scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: true }
        });
      }

      var aboutImg = doc.getElementById("aboutImg");
      if (aboutImg) {
        /* Slight scale gives the image headroom so the parallax shift
           never exposes the container edges. */
        gsap.fromTo(aboutImg, { yPercent: -3, scale: 1.08 }, {
          yPercent: 3, scale: 1.08, ease: "none",
          scrollTrigger: { trigger: "#about", start: "top bottom", end: "bottom top", scrub: true }
        });
      }
    }

    /* ========================================================
       Marquee (seamless loop)
       ======================================================== */
    function setupMarquee() {
      var track = doc.getElementById("marqueeTrack");
      if (!track) { return; }
      /* duplicate children once so the loop is seamless */
      track.innerHTML += track.innerHTML;
      gsap.to(track, { xPercent: -50, duration: 34, ease: "none", repeat: -1 });
    }

    /* ========================================================
       Section transitions — subtle depth on scroll
       ======================================================== */
    function setupSectionDepth() {
      gsap.utils.toArray("main > .section").forEach(function (section) {
        gsap.fromTo(section, { opacity: 0.55 }, {
          opacity: 1, ease: "none",
          scrollTrigger: { trigger: section, start: "top 92%", end: "top 55%", scrub: true }
        });
      });
    }

    /* ========================================================
       Refresh once fonts + media are settled
       ======================================================== */
    function refresh() {
      window.ScrollTrigger.refresh();
    }
    if (doc.fonts && doc.fonts.ready) { doc.fonts.ready.then(refresh); }
    window.addEventListener("load", refresh);
    window.setTimeout(refresh, 900);

    /* ---- init ---- */
    setupHeadings();
    setupReveals();
    setupParallax();
    setupMarquee();
    setupSectionDepth();

    /* expose intro for debugging / manual trigger */
    window.__portfolioIntro = playIntro;
  }
})();
