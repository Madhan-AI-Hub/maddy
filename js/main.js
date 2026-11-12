/* ============================================================
   main.js — UI behaviour
   Ready hook, navigation + active indicator, mobile drawer,
   video lightbox + showreels, cursor glow.
   ============================================================ */

(function () {
  "use strict";

  var doc = document;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ========================================================
     1. Ready — kick off the hero intro once the page loads
     ======================================================== */
  function setupReady() {
    var done = false;
    function reveal() {
      if (done) { return; }
      done = true;
      window.dispatchEvent(new Event("portfolio:ready"));
    }
    if (doc.readyState === "complete") { reveal(); }
    else { window.addEventListener("load", reveal); }
    /* Safety net */
    window.setTimeout(reveal, 2500);

    var preloader = doc.getElementById("preloader");
    if (preloader) {
      var dropPreloader = function () {
        if (preloader && preloader.parentNode) { preloader.parentNode.removeChild(preloader); }
      };
      preloader.addEventListener("animationend", function (e) {
        if (e.animationName === "pl-done") { dropPreloader(); }
      });
      window.setTimeout(dropPreloader, 1900);
    }
  }

  /* ========================================================
     2. Navigation: stuck state, active link + indicator
     ======================================================== */
  function setupNav() {
    var nav = doc.getElementById("nav");
    var linksWrap = doc.getElementById("navLinks");
    var indicator = doc.getElementById("navIndicator");
    var burger = doc.getElementById("burger");
    var drawer = doc.getElementById("drawer");

    var navLinks = [].slice.call(doc.querySelectorAll(".nav__link"));
    var drawerLinks = [].slice.call(doc.querySelectorAll(".drawer a"));
    var sections = [].slice.call(doc.querySelectorAll("main section[id]"));

    var sectionPositions = [];
    var navHeight = 74;
    var scrollRaf = 0;
    var lastWinW = window.innerWidth;

    /* --- indicator --- */
    function moveIndicator(link) {
      if (!indicator || !linksWrap || !link) { return; }
      if (!linksWrap.offsetParent) { return; } /* hidden (mobile) */
      var lb = link.getBoundingClientRect();
      var pb = linksWrap.getBoundingClientRect();
      indicator.style.width = lb.width + "px";
      indicator.style.transform = "translate(" + (lb.left - pb.left) + "px, -50%)";
      indicator.style.opacity = "1";
    }

    /* --- active section --- */
    var activeId = "";
    function setActive(id) {
      if (id === activeId) { return; }
      activeId = id;
      var activeNavLink = null;

      navLinks.forEach(function (a) {
        var on = a.getAttribute("href") === "#" + id;
        a.classList.toggle("is-active", on);
        if (on) { activeNavLink = a; }
      });
      drawerLinks.forEach(function (a) {
        a.classList.toggle("is-active", a.getAttribute("href") === "#" + id);
      });

      if (activeNavLink) { moveIndicator(activeNavLink); }
      else if (indicator) { indicator.style.opacity = "0"; }
    }

    function measureNav() {
      navHeight = nav ? nav.offsetHeight : 74;
      sectionPositions = sections.map(function (s) {
        return { id: s.id, top: s.offsetTop };
      });
    }

    function syncNavOnFrame() {
      scrollRaf = 0;
      var sy = window.scrollY;
      if (nav) {
        if (sy > 24) { nav.classList.add("is-stuck"); }
        else { nav.classList.remove("is-stuck"); }
      }
      if (!sectionPositions.length) { return; }
      var probe = sy + navHeight + 60;
      var current = "";
      for (var i = 0; i < sectionPositions.length; i++) {
        if (sectionPositions[i].top <= probe) { current = sectionPositions[i].id; }
      }
      setActive(current);
    }

    function onScroll() {
      if (scrollRaf) { return; }
      scrollRaf = window.requestAnimationFrame(syncNavOnFrame);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastWinW) { return; }
      lastWinW = window.innerWidth;
      measureNav();
      syncNavOnFrame();
    });
    window.addEventListener("load", function () { measureNav(); syncNavOnFrame(); });
    measureNav();
    syncNavOnFrame();

    /* --- mobile drawer --- */
    function openDrawer() {
      if (!drawer) { return; }
      drawer.classList.add("is-open");
      if (burger) { burger.classList.add("is-open"); burger.setAttribute("aria-expanded", "true"); burger.setAttribute("aria-label", "Close menu"); }
      doc.body.classList.add("drawer-open");
    }
    function closeDrawer() {
      if (!drawer) { return; }
      drawer.classList.remove("is-open");
      if (burger) { burger.classList.remove("is-open"); burger.setAttribute("aria-expanded", "false"); burger.setAttribute("aria-label", "Open menu"); }
      doc.body.classList.remove("drawer-open");
    }
    if (burger) {
      burger.addEventListener("click", function () {
        if (drawer && drawer.classList.contains("is-open")) { closeDrawer(); }
        else { openDrawer(); }
      });
    }
    drawerLinks.forEach(function (a) { a.addEventListener("click", closeDrawer); });

    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeDrawer(); }
    });

    /* Recompute the indicator when the active link's text size settles. */
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () { measureNav(); syncNavOnFrame(); });
    }
  }

  var reelDidDrag = false;

  /* ========================================================
     3. Video lightbox
     ======================================================== */
  var syncReelsPlaybackHook = null;

  function setupLightbox() {
    var lb = doc.getElementById("lightbox");
    var stage = lb ? lb.querySelector(".lightbox__stage") : null;
    var vid = doc.getElementById("lightboxVideo");
    var title = doc.getElementById("lightboxTitle");
    var closeBtn = doc.getElementById("lightboxClose");
    if (!lb || !vid) { return; }

    var lastFocus = null;

    function open(src, label) {
      if (!src) { return; }
      lastFocus = doc.activeElement;
      if (title) { title.textContent = label || "Reel"; }
      vid.muted = false;
      vid.setAttribute("src", src);
      try { vid.load(); } catch (err) { /* noop */ }
      lb.classList.add("is-open");
      doc.body.classList.add("is-loading");
      if (syncReelsPlaybackHook) { syncReelsPlaybackHook(); }
      var p = vid.play();
      if (p && p.catch) {
        p.catch(function () {
          vid.muted = true;
          var retry = vid.play();
          if (retry && retry.catch) { retry.catch(function () {}); }
        });
      }
      if (closeBtn) {
        try { closeBtn.focus({ preventScroll: true }); }
        catch (err) { closeBtn.focus(); }
      }
    }

    function close() {
      lb.classList.remove("is-open");
      doc.body.classList.remove("is-loading");
      try { vid.pause(); } catch (err) { /* noop */ }
      vid.removeAttribute("src");
      try { vid.load(); } catch (err) { /* noop */ }
      if (syncReelsPlaybackHook) { syncReelsPlaybackHook(); }
      if (lastFocus && lastFocus.focus) {
        try { lastFocus.focus({ preventScroll: true }); }
        catch (err) { lastFocus.focus(); }
      }
    }

    [].slice.call(doc.querySelectorAll(".reel")).forEach(function (reel) {
      reel.addEventListener("click", function (e) {
        if (reelDidDrag) { e.preventDefault(); return; }
        open(reel.getAttribute("data-video"), reel.getAttribute("data-title"));
      });
    });

    if (closeBtn) { closeBtn.addEventListener("click", close); }
    lb.addEventListener("click", function (e) {
      if (e.target === lb || (stage && e.target === stage)) { close(); }
    });
    doc.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && lb.classList.contains("is-open")) { close(); }
    });

    window.__closeLightbox = close;
  }

  /* ========================================================
     4. Card hover glow follow (projects)
     ======================================================== */
  function setupCardGlow() {
    if (!finePointer || reduce) { return; }
    [].slice.call(doc.querySelectorAll(".project")).forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var b = card.getBoundingClientRect();
        var px = ((e.clientX - b.left) / b.width) * 100;
        var py = ((e.clientY - b.top) / b.height) * 100;
        card.style.setProperty("--gx", px + "%");
        card.style.setProperty("--gy", py + "%");
      });
    });
  }

  /* ========================================================
     5. Showreel videos — sub-pixel GPU slider + lookahead playback
     ======================================================== */
  function setupReels() {
    var marquee = doc.querySelector(".video__marquee");
    var track = doc.getElementById("videoTrack");
    var reelCards = [].slice.call(doc.querySelectorAll(".reel"));
    var reels = [].slice.call(doc.querySelectorAll(".reel video"));
    var halfCount = Math.floor(reelCards.length / 2);
    var sectionInView = false;
    var metadataPrimed = false;

    reels.forEach(function (v) {
      v.muted = true;
      v.loop = true;
      v.setAttribute("muted", "");
      v.setAttribute("playsinline", "");
    });

    function primeMetadata() {
      if (metadataPrimed) { return; }
      metadataPrimed = true;
      reels.forEach(function (v, idx) {
        v.preload = (idx <= 2 || idx === halfCount - 1) ? "auto" : "metadata";
      });
    }

    if (!marquee || !track) { return; }

    var pos = 0;
    var period = 0;
    var cachedClientW = 0;
    var cardMetrics = [];
    var isTouching = false;
    var touchMode = "";
    var isDragging = false;
    var isHovering = false;
    var pauseUntil = 0;
    var inertiaVel = 0;

    var dragStartX = 0;
    var lastDragX = 0;
    var lastDragT = 0;
    var dragVel = 0;

    var touchStartX = 0;
    var touchStartY = 0;
    var lastTouchX = 0;
    var lastTouchT = 0;
    var touchVel = 0;

    var lastTs = 0;
    var rafId = 0;
    var initialized = false;
    var dragResetTimer = 0;
    var syncTimer = 0;
    var lastSyncPos = -9999;
    var lastTrackW = window.innerWidth;

    function measureMetrics() {
      cachedClientW = marquee.clientWidth;
      if (halfCount > 0 && reelCards[halfCount]) {
        period = reelCards[halfCount].offsetLeft - reelCards[0].offsetLeft;
      }
      if (!period) { period = track.scrollWidth / 2; }
      cardMetrics = reelCards.map(function (el) {
        return { el: el, video: el.querySelector("video"), left: el.offsetLeft, width: el.offsetWidth };
      });
    }

    function handoffLoopVideos(dir) {
      if (!halfCount) { return; }
      for (var i = 0; i < halfCount; i++) {
        var primary = cardMetrics[i] && cardMetrics[i].video;
        var clone = cardMetrics[i + halfCount] && cardMetrics[i + halfCount].video;
        if (!primary || !clone) { continue; }
        var src = dir > 0 ? clone : primary;
        var dst = dir > 0 ? primary : clone;
        if (src.readyState >= 1 && dst.readyState >= 1 && !src.paused) {
          try { dst.currentTime = src.currentTime; } catch (err) { /* noop */ }
          var p = dst.play();
          if (p && p.catch) { p.catch(function () {}); }
        }
      }
    }

    function wrapPos(nextPos) {
      if (!period || period <= 0) { return 0; }
      var wrapped = nextPos;
      var wrappedDir = 0;
      if (wrapped >= period) {
        wrappedDir = 1;
        handoffLoopVideos(1);
        wrapped = wrapped % period;
      } else if (wrapped < 0) {
        wrappedDir = -1;
        handoffLoopVideos(-1);
        wrapped = ((wrapped % period) + period) % period;
      }
      if (wrappedDir !== 0) { lastSyncPos = -9999; }
      return wrapped;
    }

    function renderTrack() {
      track.style.transform = "translate3d(" + (-pos).toFixed(2) + "px, 0, 0)";
      if (lastSyncPos === -9999 && sectionInView) { syncPlayback(); }
    }

    function initScroll() {
      measureMetrics();
      if (!initialized && period > 0) {
        initialized = true;
        pos = 0;
        renderTrack();
      }
    }

    function safePlay(v) {
      if (!v) { return; }
      if (v.preload !== "auto") { v.preload = "auto"; }
      if (!v.paused) { return; }
      var p = v.play();
      if (p && p.catch) { p.catch(function () {}); }
    }

    function safePause(v) {
      if (!v || v.paused) { return; }
      try { v.pause(); } catch (err) { /* noop */ }
    }

    function syncPlayback() {
      lastSyncPos = pos;
      if (!reels.length || reduce || !sectionInView || doc.body.classList.contains("is-loading")) {
        reels.forEach(safePause);
        return;
      }
      if (!cardMetrics.length) { measureMetrics(); }
      var cw = cachedClientW || marquee.clientWidth;
      var lookAhead = finePointer ? 220 : 180;
      var trailKeep = 40;
      var warmAhead = 380;
      var maxPlaying = finePointer ? 4 : 3;
      var activeCount = 0;

      for (var i = 0; i < cardMetrics.length; i++) {
        var m = cardMetrics[i];
        var relLeft = m.left - pos;
        var relRight = relLeft + m.width;
        if (relRight > -trailKeep && relLeft < cw + lookAhead && activeCount < maxPlaying) {
          safePlay(m.video);
          activeCount += 1;
        } else {
          safePause(m.video);
          if (m.video && m.video.preload === "none" &&
              ((relLeft >= cw + lookAhead && relLeft < cw + warmAhead) ||
               (relRight <= -trailKeep && relRight > -(trailKeep + 280)))) {
            m.video.preload = "metadata";
          }
        }
      }
    }
    syncReelsPlaybackHook = syncPlayback;

    function scheduleSync(delay) {
      if (syncTimer) { return; }
      syncTimer = window.setTimeout(function () {
        syncTimer = 0;
        syncPlayback();
      }, typeof delay === "number" ? delay : 100);
    }

    function stopRaf() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastTs = 0;
      track.style.willChange = "auto";
    }

    function tick(ts) {
      rafId = 0;
      if (!sectionInView || doc.hidden || reduce) { return; }
      if (!lastTs) { lastTs = ts; }
      var dt = Math.min(ts - lastTs, 64);
      lastTs = ts;

      if (!initialized) { initScroll(); }

      var moved = false;
      if (!isTouching && !isDragging && Math.abs(inertiaVel) > 0.015 && period > 0) {
        pos = wrapPos(pos + inertiaVel * dt);
        inertiaVel *= Math.pow(0.92, dt / 16);
        if (Math.abs(inertiaVel) <= 0.015) { inertiaVel = 0; }
        moved = true;
      } else if (!isTouching && !isDragging && !isHovering && Date.now() >= pauseUntil && !doc.body.classList.contains("is-loading") && period > 0) {
        pos = wrapPos(pos + dt * 0.048);
        moved = true;
      }

      if (moved) {
        renderTrack();
        if (Math.abs(pos - lastSyncPos) >= 48) { scheduleSync(60); }
      }

      rafId = window.requestAnimationFrame(tick);
    }

    function startRaf() {
      if (reduce || rafId || !sectionInView || doc.hidden) { return; }
      track.style.willChange = "transform";
      rafId = window.requestAnimationFrame(tick);
    }

    marquee._getPos = function () { return Math.round(pos); };

    window.addEventListener("load", function () { initScroll(); syncPlayback(); });
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastTrackW) { return; }
      lastTrackW = window.innerWidth;
      measureMetrics();
      pos = wrapPos(pos);
      renderTrack();
      syncPlayback();
    });
    window.setTimeout(initScroll, 150);

    marquee.addEventListener("touchstart", function (e) {
      window.clearTimeout(dragResetTimer);
      isTouching = true;
      touchMode = "";
      reelDidDrag = false;
      inertiaVel = 0;
      touchVel = 0;
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        lastTouchX = touchStartX;
        lastTouchT = performance.now();
      }
    }, { passive: true });

    marquee.addEventListener("touchmove", function (e) {
      if (!e.touches || !e.touches[0]) { return; }
      var cx = e.touches[0].clientX;
      var cy = e.touches[0].clientY;
      if (!touchMode) {
        var adx = Math.abs(cx - touchStartX);
        var ady = Math.abs(cy - touchStartY);
        if (adx < 8 && ady < 8) { return; }
        if (ady > adx) {
          touchMode = "y";
          isTouching = false;
          reelDidDrag = true;
          return;
        }
        touchMode = "x";
        reelDidDrag = true;
        marquee.classList.add("is-dragging");
      }
      if (touchMode !== "x") { return; }
      if (e.cancelable) { e.preventDefault(); }

      var now = performance.now();
      var dtMs = Math.max(now - lastTouchT, 8);
      var stepDx = cx - lastTouchX;
      lastTouchX = cx;
      lastTouchT = now;

      if (!period) { measureMetrics(); }
      pos = wrapPos(pos - stepDx);
      renderTrack();
      if (Math.abs(pos - lastSyncPos) >= 64) { scheduleSync(80); }

      var instVel = Math.max(-2.6, Math.min(2.6, -stepDx / dtMs));
      touchVel = touchVel * 0.45 + instVel * 0.55;
    }, { passive: false });

    function finishTouch() {
      isTouching = false;
      marquee.classList.remove("is-dragging");
      if (touchMode === "x") {
        if (performance.now() - lastTouchT < 90 && Math.abs(touchVel) > 0.06) {
          inertiaVel = touchVel;
        }
        pauseUntil = Date.now() + 1100;
        scheduleSync(80);
      }
      touchMode = "";
      dragResetTimer = window.setTimeout(function () { reelDidDrag = false; }, 110);
    }

    marquee.addEventListener("touchend", finishTouch, { passive: true });
    marquee.addEventListener("touchcancel", finishTouch, { passive: true });

    marquee.addEventListener("wheel", function (e) {
      var horiz = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
      if (!horiz) { return; }
      if (e.cancelable) { e.preventDefault(); }
      if (!period) { measureMetrics(); }
      inertiaVel = 0;
      pos = wrapPos(pos + horiz);
      renderTrack();
      pauseUntil = Date.now() + 900;
      scheduleSync(80);
    }, { passive: false });

    marquee.addEventListener("pointerenter", function (e) {
      if (e.pointerType === "mouse") { isHovering = true; }
    });
    marquee.addEventListener("pointerleave", function (e) {
      if (e.pointerType === "mouse") { isHovering = false; }
    });

    marquee.addEventListener("mousedown", function (e) {
      if (e.button !== 0) { return; }
      window.clearTimeout(dragResetTimer);
      isDragging = true;
      reelDidDrag = false;
      inertiaVel = 0;
      dragVel = 0;
      dragStartX = e.clientX;
      lastDragX = e.clientX;
      lastDragT = performance.now();
    });

    window.addEventListener("mousemove", function (e) {
      if (!isDragging) { return; }
      var dx = e.clientX - dragStartX;
      if (!reelDidDrag && Math.abs(dx) > 6) {
        reelDidDrag = true;
        marquee.classList.add("is-dragging");
      }
      if (!reelDidDrag) { return; }
      var now = performance.now();
      var dtMs = Math.max(now - lastDragT, 8);
      var stepDx = e.clientX - lastDragX;
      lastDragX = e.clientX;
      lastDragT = now;

      if (!period) { measureMetrics(); }
      pos = wrapPos(pos - stepDx);
      renderTrack();
      if (Math.abs(pos - lastSyncPos) >= 64) { scheduleSync(80); }

      var instVel = Math.max(-2.6, Math.min(2.6, -stepDx / dtMs));
      dragVel = dragVel * 0.45 + instVel * 0.55;
    });

    window.addEventListener("mouseup", function () {
      if (!isDragging) { return; }
      isDragging = false;
      marquee.classList.remove("is-dragging");
      if (reelDidDrag && performance.now() - lastDragT < 90 && Math.abs(dragVel) > 0.06) {
        inertiaVel = dragVel;
      }
      pauseUntil = Date.now() + 1000;
      scheduleSync(80);
      dragResetTimer = window.setTimeout(function () { reelDidDrag = false; }, 100);
    });

    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) {
        stopRaf();
        reels.forEach(safePause);
      } else if (sectionInView) {
        syncPlayback();
        startRaf();
      }
    });

    if ("IntersectionObserver" in window) {
      var preloadIO = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          primeMetadata();
          preloadIO.disconnect();
        }
      }, { rootMargin: "900px 0px" });
      preloadIO.observe(marquee);

      var viewIO = new IntersectionObserver(function (entries) {
        sectionInView = entries[0].isIntersecting;
        if (sectionInView) {
          if (!initialized) { initScroll(); }
          primeMetadata();
          syncPlayback();
          startRaf();
        } else {
          stopRaf();
          reels.forEach(safePause);
        }
      }, { rootMargin: "160px 0px", threshold: 0.01 });
      viewIO.observe(marquee);
    } else {
      sectionInView = true;
      primeMetadata();
      syncPlayback();
      startRaf();
    }
  }

  /* ========================================================
     6. Mascot — tap to return to the top
     ======================================================== */
  function setupMascotTop() {
    var hosts = [].slice.call(doc.querySelectorAll("[data-mascot]"));
    hosts.forEach(function (host) {
      var wrap = host.parentNode && host.parentNode.classList &&
        host.parentNode.classList.contains("mascot-host") ? host.parentNode : host;
      wrap.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      });
    });
  }

  /* ---- boot ---- */
  function boot() {
    setupReady();
    setupNav();
    setupLightbox();
    setupCardGlow();
    setupReels();
    setupMascotTop();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
