(function () {
  "use strict";

  var intro = document.getElementById("intro");
  var invite = document.getElementById("invite");
  var audio = document.getElementById("bgAudio");
  var payload = window.__INVITE__ || {};
  var data = payload.data || {};
  var photos = [
    "https://images.unsplash.com/photo-1606800052052-a08af7148866?w=760&q=80",
    "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=760&q=80",
    "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?w=760&q=80"
  ];
  var photoIndex = 0;

  function text(id, value) {
    var el = document.getElementById(id);
    if (el && value) el.textContent = value;
  }

  function safe(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function initials(name) {
    return String(name || "?").trim().charAt(0).toUpperCase();
  }

  function apply() {
    var bride = data.bride || "Meera";
    var groom = data.groom || "Kabir";
    var mark = initials(groom) + " & " + initials(bride);
    var seal = initials(groom) + "&" + initials(bride);

    var title = document.getElementById("coupleTitle");
    if (title) title.innerHTML = safe(groom) + " <span>&amp;</span> " + safe(bride);

    text("introMark", mark);
    text("heroMono", initials(groom) + initials(bride));
    text("vinylLabel", initials(groom) + " & " + initials(bride));
    document.querySelectorAll(".seal, .curtain-seal").forEach(function (el) {
      if (el.classList.contains("curtain-seal") && /tap/i.test(el.textContent || "")) return;
      el.textContent = seal;
    });

    text("heroDate", data.dateLabel || "12 Dec 2026");
    text("heroPlace", data.city || "Udaipur, India");
    text("welcome", data.welcome);
    text("groomName", groom);
    text("brideName", bride);
    text("groomFamilyName", groom);
    text("brideFamilyName", bride);
    text("groomEdu", data.groomEdu);
    text("brideEdu", data.brideEdu);
    text("groomWork", data.groomWork);
    text("brideWork", data.brideWork);
    text("groomParents", data.groomParents);
    text("brideParents", data.brideParents);
    text("groomFamily", data.groomParents);
    text("brideFamily", data.brideParents);
    text("unionQuote", data.quote);
    text("closing", data.closing);
    text("venueName", data.venueName);
    text("venueNote", data.venueNote);
    text("stayNote", data.stayNote);
    text("travelNote", data.travelNote);
    text("rsvpBy", data.rsvpBy);
    text("hashtag", data.hashtag || "#" + groom + "And" + bride);
    text("monthLabel", data.month || "December");
    text("dayLabel", data.day || "12");
    text("yearLabel", data.year || "2026");
    text("cardPlace", data.city || "Udaipur, Rajasthan");

    var map = document.getElementById("mapLink");
    if (map && data.mapUrl) map.href = data.mapUrl;
    document.title = groom + " & " + bride + " · Wedding";

    if (Array.isArray(data.photos) && data.photos.length) {
      photos = data.photos.slice(0, 3);
      syncStack();
    }
  }

  function syncStack() {
    var items = document.querySelectorAll(".card-stack-item img");
    if (!items.length) return;
    items[0].src = photos[(photoIndex + 2) % photos.length];
    items[1].src = photos[(photoIndex + 1) % photos.length];
    items[2].src = photos[photoIndex % photos.length];
  }

  function revealAllInView(nodes) {
    nodes.forEach(function (el) {
      if (el.classList.contains("animated")) return;
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.top < vh * 0.92 && r.bottom > 40) el.classList.add("animated");
    });
  }

  function observeReveals() {
    var nodes = Array.prototype.slice.call(
      document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-fade")
    );
    if (!nodes.length) return;

    var tick = function () { revealAllInView(nodes); };
    tick();
    requestAnimationFrame(tick);

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(function (el) { el.classList.add("animated"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("animated");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -5% 0px" });

    nodes.forEach(function (el) { io.observe(el); });

    var onScroll = function () { tick(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    document.addEventListener("touchmove", onScroll, { passive: true });

    // Safety net: keep checking briefly after open, then leave IO + scroll in charge.
    var n = 0;
    var safety = setInterval(function () {
      tick();
      n += 1;
      if (n > 40 || nodes.every(function (el) { return el.classList.contains("animated"); })) {
        clearInterval(safety);
      }
    }, 250);

    // Never leave content invisible if the user has been on the page a while.
    setTimeout(function () {
      nodes.forEach(function (el) { el.classList.add("animated"); });
    }, 8000);
  }

  function openInvite() {
    intro.classList.add("is-gone");
    invite.hidden = false;
    // First tap unlocks audio — start music the same way the demo expects a gesture.
    startMusic();
    requestAnimationFrame(function () {
      observeReveals();
    });
    setTimeout(function () {
      if (intro && intro.parentNode) intro.remove();
    }, 850);
  }

  intro.addEventListener("click", openInvite);

  document.getElementById("curtainDate").addEventListener("click", function () {
    this.classList.toggle("is-open");
    this.setAttribute("aria-expanded", this.classList.contains("is-open") ? "true" : "false");
  });

  document.getElementById("dateCard").addEventListener("click", function () {
    var on = this.classList.toggle("is-open");
    this.setAttribute("aria-pressed", on ? "true" : "false");
  });

  document.getElementById("cord").addEventListener("click", function () {
    var gallery = document.getElementById("gallery");
    var on = gallery.classList.toggle("is-warm");
    this.setAttribute("aria-pressed", on ? "true" : "false");
    this.querySelector(".cord-label").textContent = on ? "Warm" : "Tap me";
  });

  /* Vinyl / music — Arjun & Sia theme soundtrack */
  var vinylBtn = document.getElementById("vinylBtn");
  var vinylDisc = document.getElementById("vinylDisc");
  var playLabel = document.getElementById("playLabel");
  var isPlaying = false;

  if (audio) {
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0.85;
  }

  function setPlayingUI(on) {
    isPlaying = !!on;
    if (vinylBtn) {
      vinylBtn.classList.toggle("is-playing", on);
      vinylBtn.setAttribute("aria-pressed", on ? "true" : "false");
    }
    if (vinylDisc) {
      vinylDisc.classList.toggle("vinyl-playing", on);
      vinylDisc.classList.toggle("vinyl-stopped", !on);
    }
    if (playLabel) playLabel.textContent = on ? "Now Playing" : "Click to Play";
  }

  function startMusic() {
    if (!audio) return;
    if (audio.ended) audio.currentTime = 0;
    audio.play().then(function () {
      setPlayingUI(true);
    }).catch(function () {
      setPlayingUI(false);
      if (playLabel) playLabel.textContent = "Click to Play";
    });
  }

  function toggleVinyl() {
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setPlayingUI(false);
    } else {
      startMusic();
    }
  }

  if (vinylBtn) vinylBtn.addEventListener("click", toggleVinyl);
  if (audio) {
    audio.addEventListener("pause", function () {
      if (!audio.ended) setPlayingUI(false);
    });
    audio.addEventListener("play", function () {
      setPlayingUI(true);
    });
    audio.addEventListener("ended", function () {
      // loop attribute should restart; keep UI in sync if it doesn't
      if (audio.loop) {
        audio.currentTime = 0;
        audio.play().catch(function () { setPlayingUI(false); });
      } else {
        setPlayingUI(false);
      }
    });
  }

  /* Card stack swipe */
  (function setupStack() {
    var front = document.getElementById("cardFront");
    if (!front) return;
    var startX = 0;
    var dx = 0;
    var dragging = false;

    function onDown(x) {
      dragging = true;
      startX = x;
      dx = 0;
      front.style.transition = "none";
    }
    function onMove(x) {
      if (!dragging) return;
      dx = x - startX;
      front.style.transform = "translateX(" + dx + "px) rotate(" + dx / 28 + "deg)";
    }
    function onUp() {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(dx) > 80) {
        var dir = dx > 0 ? 1 : -1;
        front.classList.add("is-flinging");
        front.style.transition = "";
        front.style.transform = "translateX(" + dir * 420 + "px) rotate(" + dir * 18 + "deg)";
        front.style.opacity = "0";
        setTimeout(function () {
          photoIndex = (photoIndex + 1) % photos.length;
          syncStack();
          front.classList.remove("is-flinging");
          front.style.transition = "none";
          front.style.transform = "";
          front.style.opacity = "1";
          requestAnimationFrame(function () {
            front.style.transition = "";
          });
        }, 280);
      } else {
        front.style.transition = "";
        front.style.transform = "";
      }
      dx = 0;
    }

    front.addEventListener("pointerdown", function (e) {
      front.setPointerCapture(e.pointerId);
      onDown(e.clientX);
    });
    front.addEventListener("pointermove", function (e) { onMove(e.clientX); });
    front.addEventListener("pointerup", onUp);
    front.addEventListener("pointercancel", onUp);
  })();

  /* Soft sparkles on RSVP submit */
  function spark() {
    var canvas = document.getElementById("sparkCanvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    var rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    var parts = [];
    for (var i = 0; i < 42; i++) {
      parts.push({
        x: rect.width / 2,
        y: rect.height * 0.35,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 1,
        life: 1,
        c: Math.random() > 0.5 ? "#c5a059" : "#f8f8f8"
      });
    }
    var frames = 0;
    function tick() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12;
        p.life -= 0.02;
        ctx.globalAlpha = Math.max(p.life, 0);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      });
      frames += 1;
      if (frames < 60) requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    tick();
  }

  document.getElementById("rsvpForm").addEventListener("submit", function (e) {
    e.preventDefault();
    this.hidden = true;
    document.getElementById("thanks").hidden = false;
    spark();
  });

  document.getElementById("shareBtn").addEventListener("click", function () {
    var url = location.href;
    var title = document.title;
    if (navigator.share) {
      navigator.share({ title: title, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        document.getElementById("shareBtn").textContent = "Link copied";
      });
    }
  });

  /* ─── FIRECRACKERS — Our Families Section ─── */
  (function setupFirecrackers() {
    var canvas = document.getElementById("firecrackers-canvas");
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;

    var particles = [];
    var rockets = [];
    var W = 0, H = 0;
    var running = false;
    var launchTimer = 0;

    function resize() {
      var p = canvas.parentElement;
      W = canvas.width = (p && p.offsetWidth) || window.innerWidth || 900;
      H = canvas.height = (p && p.offsetHeight) || 700;
    }

    function rnd(a, b) { return Math.random() * (b - a) + a; }

    var PALETTE = [
      "#c5a059", "#f8d98b", "#fff5cc", "#ffffff",
      "#ff6b6b", "#ff9944", "#ffdd57",
      "#a78bfa", "#60a5fa", "#34d399",
      "#f472b6", "#fb923c"
    ];

    function launchRocket() {
      rockets.push({
        x: rnd(W * 0.1, W * 0.9),
        y: H + 5,
        vx: rnd(-1.2, 1.2),
        vy: rnd(-13, -9),
        col: PALETTE[Math.floor(rnd(0, PALETTE.length))],
        age: 0,
        max: rnd(40, 65)
      });
    }

    function burst(x, y, col) {
      var n = Math.floor(rnd(55, 110));
      for (var i = 0; i < n; i++) {
        var ang = (Math.PI * 2 * i / n) + rnd(-0.08, 0.08);
        var spd = rnd(1.2, 5.5);
        var pCol = Math.random() > 0.25 ? col : PALETTE[Math.floor(rnd(0, PALETTE.length))];
        particles.push({
          x: x, y: y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          col: pCol,
          sz: rnd(1.4, 3.2),
          alpha: 1,
          fade: rnd(0.011, 0.022),
          grav: 0.065
        });
      }
      // core sparkle ring
      for (var j = 0; j < 18; j++) {
        particles.push({
          x: x + rnd(-8, 8), y: y + rnd(-8, 8),
          vx: rnd(-0.8, 0.8), vy: rnd(-1.8, 0.3),
          col: "#fffde7", sz: rnd(0.7, 1.8),
          alpha: 1, fade: rnd(0.028, 0.048), grav: 0.015
        });
      }
    }

    function tick() {
      if (!running) return;
      requestAnimationFrame(tick);

      ctx.clearRect(0, 0, W, H);

      // launch
      launchTimer++;
      if (launchTimer >= rnd(30, 55)) {
        launchRocket();
        if (Math.random() > 0.55) launchRocket();
        launchTimer = 0;
      }

      // rockets
      for (var i = rockets.length - 1; i >= 0; i--) {
        var r = rockets[i];
        r.x += r.vx; r.y += r.vy;
        r.vy += 0.22;
        r.age++;
        // draw head
        ctx.save();
        ctx.globalAlpha = 0.95;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = r.col;
        ctx.fill();
        // draw trail
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.arc(r.x - r.vx * 2.5, r.y - r.vy * 2.5, 1.3, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
        ctx.restore();

        if (r.vy >= -0.5 || r.age >= r.max) {
          burst(r.x, r.y, r.col);
          rockets.splice(i, 1);
        }
      }

      // particles
      for (var k = particles.length - 1; k >= 0; k--) {
        var p = particles[k];
        p.vx *= 0.971; p.vy *= 0.971;
        p.vy += p.grav;
        p.x += p.vx; p.y += p.vy;
        p.alpha -= p.fade;
        if (p.alpha <= 0) { particles.splice(k, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.sz, 0, Math.PI * 2);
        ctx.fillStyle = p.col;
        ctx.fill();
        ctx.restore();
      }
    }

    var section = document.getElementById("invited-by") || canvas.parentElement;

    function start() {
      if (running) return;
      resize();
      window.addEventListener("resize", resize);
      running = true;
      burst(W * 0.35, H * 0.45, PALETTE[0]);
      burst(W * 0.65, H * 0.4, PALETTE[1]);
      launchRocket();
      tick();
    }

    if ("IntersectionObserver" in window && section) {
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            start();
            obs.unobserve(section);
          }
        });
      }, { threshold: 0.1 });
      obs.observe(section);
    } else {
      start();
    }

    if (section) {
      section.addEventListener("click", function (e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        if (x >= 0 && x <= W && y >= 0 && y <= H) {
          burst(x, y, PALETTE[Math.floor(rnd(0, PALETTE.length))]);
        }
      });
    }
  })();

  apply();
})();
