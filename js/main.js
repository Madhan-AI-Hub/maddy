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
     5. Showreel videos — swipeable carousel + capped playback
     ======================================================== */
  function setupReels() {
    var marquee = doc.querySelector(".video__marquee");
    var track = doc.getElementById("videoTrack");
    var reelCards = [].slice.call(doc.querySelectorAll(".reel"));
    var reels = [].slice.call(doc.querySelectorAll(".reel video"));
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
      reels.forEach(function (v) { v.preload = "metadata"; });
    }

    if (!marquee || !track) { return; }

    var isTouching = false;
    var isDragging = false;
    var isHovering = false;
    var pauseUntil = 0;
    var dragStartX = 0;
    var dragStartScroll = 0;
    var touchStartX = 0;
    var touchStartY = 0;
    var virtualPos = 0;
    var lastTs = 0;
    var rafId = 0;
    var initialized = false;
    var dragResetTimer = 0;
    var playSyncTimer = 0;
    var lastTrackW = window.innerWidth;

    var cachedHalf = 0;
    var cachedClientW = 0;
    var cachedMinBound = 0;
    var cachedMaxBound = 0;
    var cardMetrics = [];

    function measureMetrics() {
      cachedClientW = marquee.clientWidth;
      cachedHalf = track.scrollWidth / 2;
      var maxScroll = Math.max(0, track.scrollWidth - cachedClientW);
      if (cachedHalf > 0 && maxScroll > cachedHalf + 60) {
        cachedMinBound = Math.min(Math.round(cachedHalf * 0.25), Math.floor((maxScroll - cachedHalf) / 2));
        cachedMaxBound = cachedMinBound + cachedHalf;
      } else {
        cachedMinBound = 0;
        cachedMaxBound = cachedHalf;
      }
      cardMetrics = reelCards.map(function (el) {
        return { el: el, video: el.querySelector("video"), left: el.offsetLeft, width: el.offsetWidth };
      });
    }

    function initScroll() {
      measureMetrics();
      if (cachedHalf > 0 && !initialized) {
        initialized = true;
        marquee.scrollLeft = Math.round(cachedHalf);
        virtualPos = marquee.scrollLeft;
      }
    }

    function wrapScroll() {
      if (!cachedHalf) { return 0; }
      var sl = marquee.scrollLeft;
      if (sl >= cachedMaxBound) {
        marquee.scrollLeft = sl - cachedHalf;
        virtualPos = marquee.scrollLeft;
        return -cachedHalf;
      }
      if (sl <= Math.max(1, cachedMinBound)) {
        marquee.scrollLeft = sl + cachedHalf;
        virtualPos = marquee.scrollLeft;
        return cachedHalf;
      }
      return 0;
    }

    function safePlay(v) {
      if (!v) { return; }
      if (v.preload === "none") { v.preload = "metadata"; }
      if (!v.paused) { return; }
      var p = v.play();
      if (p && p.catch) { p.catch(function () {}); }
    }

    function safePause(v) {
      if (!v || v.paused) { return; }
      try { v.pause(); } catch (err) { /* noop */ }
    }

    function syncPlayback() {
      if (!reels.length || reduce || !sectionInView || doc.body.classList.contains("is-loading")) {
        reels.forEach(safePause);
        return;
      }
      if (!cardMetrics.length) { measureMetrics(); }
      var sl = marquee.scrollLeft;
      var cw = cachedClientW || marquee.clientWidth;
      var maxPlaying = finePointer ? 3 : 2;
      var activeCount = 0;

      for (var i = 0; i < cardMetrics.length; i++) {
        var m = cardMetrics[i];
        var overlap = Math.min(m.left + m.width, sl + cw) - Math.max(m.left, sl);
        if (overlap > 24 && activeCount < maxPlaying) {
          safePlay(m.video);
          activeCount += 1;
        } else {
          safePause(m.video);
        }
      }
    }
    syncReelsPlaybackHook = syncPlayback;

    function schedulePlaySync() {
      if (playSyncTimer) { return; }
      playSyncTimer = window.setTimeout(function () {
        playSyncTimer = 0;
        syncPlayback();
      }, 140);
    }

    function stopRaf() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
      }
      lastTs = 0;
    }

    function tick(ts) {
      rafId = 0;
      if (!sectionInView || doc.hidden || reduce) { return; }
      if (!lastTs) { lastTs = ts; }
      var dt = Math.min(ts - lastTs, 64);
      lastTs = ts;

      if (!initialized) { initScroll(); }

      var activePause = isTouching || isDragging || isHovering || Date.now() < pauseUntil || doc.body.classList.contains("is-loading");
      if (!activePause && cachedHalf > 0) {
        if (Math.abs(virtualPos - marquee.scrollLeft) > 2) {
          virtualPos = marquee.scrollLeft;
        }
        virtualPos += dt * 0.042;
        if (virtualPos >= cachedMaxBound) {
          virtualPos -= cachedHalf;
          schedulePlaySync();
        }
        marquee.scrollLeft = virtualPos;
      }
      if (!activePause && !playSyncTimer) { schedulePlaySync(); }
      rafId = window.requestAnimationFrame(tick);
    }

    function startRaf() {
      if (reduce || rafId || !sectionInView || doc.hidden) { return; }
      rafId = window.requestAnimationFrame(tick);
    }

    window.addEventListener("load", function () { initScroll(); syncPlayback(); });
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastTrackW) { return; }
      lastTrackW = window.innerWidth;
      measureMetrics();
      syncPlayback();
    });
    window.setTimeout(initScroll, 150);

    marquee.addEventListener("touchstart", function (e) {
      window.clearTimeout(dragResetTimer);
      isTouching = true;
      reelDidDrag = false;
      if (e.touches && e.touches[0]) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    marquee.addEventListener("touchmove", function (e) {
      if (!e.touches || !e.touches[0]) { return; }
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 12) {
        reelDidDrag = true;
      }
      /* Fallback edge shift only when user actively swipes right at the left edge */
      if (cachedMinBound === 0 && dx > 10 && Math.abs(dx) > Math.abs(dy) && marquee.scrollLeft <= 2 && cachedHalf > 0) {
        marquee.scrollLeft += cachedHalf;
        virtualPos = marquee.scrollLeft;
      }
    }, { passive: true });

    marquee.addEventListener("touchend", function () {
      isTouching = false;
      pauseUntil = Date.now() + 1400;
      virtualPos = marquee.scrollLeft;
      schedulePlaySync();
      dragResetTimer = window.setTimeout(function () { reelDidDrag = false; }, 120);
    }, { passive: true });

    marquee.addEventListener("touchcancel", function () {
      isTouching = false;
      pauseUntil = Date.now() + 1400;
      virtualPos = marquee.scrollLeft;
      schedulePlaySync();
      dragResetTimer = window.setTimeout(function () { reelDidDrag = false; }, 120);
    }, { passive: true });

    marquee.addEventListener("wheel", function () {
      pauseUntil = Date.now() + 1200;
      virtualPos = marquee.scrollLeft;
    }, { passive: true });

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
      dragStartX = e.clientX;
      dragStartScroll = marquee.scrollLeft;
    });

    window.addEventListener("mousemove", function (e) {
      if (!isDragging) { return; }
      var dx = e.clientX - dragStartX;
      if (!reelDidDrag && Math.abs(dx) > 6) {
        reelDidDrag = true;
        marquee.classList.add("is-dragging");
      }
      if (!reelDidDrag) { return; }
      marquee.scrollLeft = dragStartScroll - dx;
      var delta = wrapScroll();
      if (delta) {
        dragStartScroll += delta;
        marquee.scrollLeft = dragStartScroll - dx;
      }
    });

    window.addEventListener("mouseup", function () {
      if (!isDragging) { return; }
      isDragging = false;
      pauseUntil = Date.now() + 1200;
      marquee.classList.remove("is-dragging");
      virtualPos = marquee.scrollLeft;
      schedulePlaySync();
      dragResetTimer = window.setTimeout(function () { reelDidDrag = false; }, 100);
    });

    marquee.addEventListener("scroll", function () {
      if (isTouching || isDragging || Date.now() < pauseUntil) {
        virtualPos = marquee.scrollLeft;
        wrapScroll();
        schedulePlaySync();
      }
    }, { passive: true });

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
