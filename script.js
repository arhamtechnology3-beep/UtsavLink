/* ===================================================================
   InviteO - landing page behaviour
   Self-serve funnel: choose a design -> pay -> edit -> share.
   No WhatsApp, no phone call, no human in the loop.
   =================================================================== */
(function () {
  "use strict";

  // --------------------------------------------------------------- config
  // The festival we're counting down to. Ganesh Chaturthi 2026 = 14 Sep.
  var FESTIVAL = new Date("2026-09-14T00:00:00+05:30");
  var FESTIVAL_LABEL = "Ganesh Chaturthi";
  // Live invite shown inside the hero phone - a real deployed theme, so
  // visitors watch the actual product animate before they ever pay.
  var PREVIEW_URL = "/t/fort?preview=1";
  var STORE_KEY = "inviteo.order";
  // What one invite costs. ₹99 is the price the page quotes; 18% GST is
  // added at the checkout screen and the rounded total is what PayU
  // charges, so TOTAL is the figure on the pay button and the figure the
  // bank shows. Kept in step with BASE_PAISE / GST_RATE in api/_lib/payu.js.
  var PRICE = 99;
  var GST_RATE = 0.18;
  var TOTAL = Math.round(PRICE * (1 + GST_RATE));   // ₹117
  var GST = TOTAL - PRICE;                          // ₹18
  var FREE_MODE = false;
  // Meta expects a price on ViewContent, InitiateCheckout and Purchase alike -
  // leave it off any one of them and Events Manager reports that event as
  // carrying no value at all, so all three read it from here. They report the
  // amount actually charged, which is what PayU settles and what makes the
  // pixel reconcile against the gateway.
  var CURRENCY = "INR";

  // ------------------------------------------------------------- language
  // Every design ships Marathi, Hindi and English. The choice a visitor makes
  // above the design cards follows them the whole way - hero preview, modal
  // preview, and into the order itself - so the invite they buy is in the
  // language they were shown. Marathi is each theme's own base content, so it
  // is the one value that needs no parameter.
  var LANGS = ["mr", "hi", "en"];
  var LANG_KEY = "inviteo.lang";

  var language = {
    value: "mr",
    listeners: [],

    load: function () {
      try {
        var saved = localStorage.getItem(LANG_KEY);
        if (LANGS.indexOf(saved) >= 0) this.value = saved;
      } catch (e) {}
      return this.value;
    },

    param: function (sep) {
      return this.value === "mr" ? "" : (sep || "&") + "lang=" + this.value;
    },

    set: function (next) {
      if (LANGS.indexOf(next) < 0 || next === this.value) return;
      this.value = next;
      try { localStorage.setItem(LANG_KEY, next); } catch (e) {}
      track("SelectLanguage", { content_name: next });
      this.sync();
      this.listeners.forEach(function (fn) { fn(next); });
    },

    onChange: function (fn) { this.listeners.push(fn); },

    sync: function () {
      var self = this;
      each(document.querySelectorAll("[data-lang]"), function (button) {
        var on = button.getAttribute("data-lang") === self.value;
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-checked", on ? "true" : "false");
      });
    },

    mount: function () {
      var self = this;
      this.load();
      each(document.querySelectorAll("[data-lang]"), function (button) {
        button.addEventListener("click", function () { self.set(button.getAttribute("data-lang")); });
      });
      this.sync();
    }
  };

  var $ = function (id) { return document.getElementById(id); };
  var each = function (list, fn) { Array.prototype.forEach.call(list, fn); };

  // Fire to Meta Pixel / GA4 if the tags are installed, silently otherwise.
  // `options` is Meta's own second argument - only ever an eventID, so a
  // sale reported from two places still counts once.
  function track(event, params, options) {
    try {
      if (window.fbq) {
        if (options) window.fbq("track", event, params || {}, options);
        else window.fbq("track", event, params || {});
      }
    } catch (e) {}
    try { if (window.gtag) window.gtag("event", event, params || {}); } catch (e) {}
    try { (window.dataLayer = window.dataLayer || []).push({ event: event, params: params || {} }); } catch (e) {}
  }

  // One paid invite, one Purchase - the twin of countPurchase() in
  // /edit/index.html, sharing its store and its key so the two pages
  // cannot both count the same sale. Only ever called with a reference
  // our own server has confirmed PayU actually paid.
  var PURCHASE_KEY = "inviteo.purchased";

  function markPurchase(ref) {
    if (!ref) return;
    var seen;
    try { seen = JSON.parse(localStorage.getItem(PURCHASE_KEY) || "[]"); } catch (e) { seen = []; }
    if (!Array.isArray(seen)) seen = [];
    if (seen.indexOf(ref) !== -1) return;
    seen.push(ref);
    try { localStorage.setItem(PURCHASE_KEY, JSON.stringify(seen.slice(-20))); } catch (e) {}
    track("Purchase", { value: TOTAL, currency: CURRENCY }, { eventID: "purchase_" + ref });
  }

  // ------------------------------------------------------------- countdown
  function startCountdown() {
    var host = $("countdown");
    if (!host) return;
    var render = function () {
      var days = Math.ceil((FESTIVAL - new Date()) / 86400000);
      if (days > 1) {
        host.innerHTML = "<strong>" + days + " days</strong> to " + FESTIVAL_LABEL +
          " - create your invite website before Bappa arrives";
      } else if (days === 1) {
        host.innerHTML = "<strong>Tomorrow</strong> is " + FESTIVAL_LABEL + " - send your invite link today";
      } else if (days === 0) {
        host.innerHTML = "<strong>Today</strong> is " + FESTIVAL_LABEL + " - Ganpati Bappa Morya!";
      } else {
        host.parentNode && host.parentNode.removeChild(host);
      }
    };
    render();
    setInterval(render, 60 * 60 * 1000);
  }

  // ------------------------------------------------------- live invite count
  // Real published-invite counts from /api/stats - never a decorated or
  // invented figure. A number this page cannot back up would be a lie told
  // to the very people we are about to ask for ₹99, and it only has to be
  // caught once. Below MIN_TO_SHOW the strip stays hidden: saying nothing
  // is honest, and "3 families" argues against us anyway.
  var MIN_TO_SHOW = 25;   // total published invites before we mention any
  var MIN_WEEK = 10;      // …and before the "this week" line is worth saying

  function mountLiveCount() {
    var host = $("liveCount");
    if (!host || !window.fetch) return;

    fetch("/api/stats", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (stats) {
        if (!stats || !stats.ok || stats.total < MIN_TO_SHOW) return;
        var count = stats.week >= MIN_WEEK ? stats.week : stats.total;
        var when = stats.week >= MIN_WEEK ? " this week" : " so far";
        host.innerHTML =
          '<span class="live-dot" aria-hidden="true"></span>' +
          "<span><b>" + count.toLocaleString("en-IN") + " families</b> published their invite website" + when + "</span>";
        host.removeAttribute("hidden");
      })
      .catch(function () { /* the page is complete without it */ });
  }

  // --------------------------------------------------------- hero preview
  function mountPreview() {
    var frame = document.querySelector("[data-preview-frame]");
    if (!frame) return;

    // The themes lay out for a real handset (390px). The hero frame's screen is
    // only ~280px across, so letting the iframe take that width rendered the
    // invite at a size no phone has - squeezed headings, cards reflowing
    // differently from the invite a guest actually opens. Give it a true 390px
    // viewport and scale the whole thing down, so the hero is a faithful
    // miniature rather than a redesign of the product at 280px.
    var FRAME_W = 390;
    var fit = function () {
      var screen = frame.parentNode;
      if (!screen) return;
      var w = screen.clientWidth, h = screen.clientHeight;
      if (!w || !h) return;                        // laid out but not measurable yet
      var scale = w / FRAME_W;
      frame.style.width = FRAME_W + "px";
      frame.style.height = Math.round(h / scale) + "px";
      frame.style.transform = "scale(" + scale + ")";
    };

    // Don't spend a visitor's data on the iframe until the phone is on screen.
    var load = function () {
      fit();
      frame.src = PREVIEW_URL + language.param();
      frame.addEventListener("load", function () { fit(); frame.classList.add("is-loaded"); });
    };
    window.addEventListener("resize", fit);
    fit();
    if (!("IntersectionObserver" in window)) return load();
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); load(); }
    }, { rootMargin: "200px" });
    io.observe(frame);
    // The phone is showing the wrong language the moment they switch, so
    // reload it - but only once it has actually been loaded.
    language.onChange(function () { if (frame.getAttribute("src")) load(); });
    // Belt and braces: some embedded webviews never deliver the callback.
    // The phone is the proof shot - it must not silently stay a still image.
    setTimeout(function () { if (!frame.src) { io.disconnect(); load(); } }, 2500);
  }

  // --------------------------------------------------------- preview modal
  // "See it before you pay" only works if seeing it is one tap and does not
  // navigate away: a new tab is a dead end inside the WhatsApp / Instagram
  // browsers most of this traffic arrives in.
  var preview = {
    root: null, theme: "fort", opener: null, heldScroll: null,
    draft: {}, makeTimer: 0,

    // The themes read this to put the customer back where they were editing.
    // The modal borrows the same viewer, so park the value while it is open
    // and hand it back on close - otherwise browsing a preview would move
    // the real editor's scroll position.
    SCROLL_KEY: "inviteo:preview-scroll",

    // The key a theme reads (under ?edit=1) to paint someone's content
    // instead of the sample invitation - the same channel the editor uses,
    // which is why typing here needs no account and no server round trip.
    DATA_KEY: "inviteo:preview",

    // Survives the payment hop: the editor picks this up on first load so
    // nobody retypes what they already typed before paying.
    DRAFT_KEY: "inviteo.draft",

    FIELDS: { pvFamily: "familyName", pvDate: "date", pvVenue: "venue" },

    // Each design previews in a different language, so the three cards
    // together prove the invite exists in all three - a visitor who only
    // ever opens one preview still sees the range.
    //
    // This is the language a preview OPENS in, not a lock: the moment the
    // visitor touches the language toggle, their choice wins everywhere
    // (langPinned below), because a control that visibly does nothing reads
    // as broken.
    //
    // Deliberately NOT wired to checkout. /api/order sends language.value,
    // so previewing Temple Darbar in English can never sell an English
    // invite to someone whose toggle says Marathi. Preview language and
    // purchase language are separate on purpose - keep them that way.
    PREVIEW_LANG: { fort: "mr", kailash: "hi", darbar: "en" },

    langPinned: false,

    previewLang: function () {
      if (this.langPinned) return language.value;
      return this.PREVIEW_LANG[this.theme] || language.value;
    },

    // Mirrors language.param(): Marathi is the themes' default, so it rides
    // with no query string at all.
    previewLangParam: function (sep) {
      var l = this.previewLang();
      return l === "mr" ? "" : (sep || "&") + "lang=" + l;
    },

    // The grey hints are sample content, so they belong to the language the
    // visitor is previewing in - a Marathi hint under an English invite reads
    // like a mistake we made.
    HINTS: {
      mr: { pvFamily: "पाटील परिवार", pvDate: "१४ सप्टेंबर २०२६", pvVenue: "पाटील निवास, पुणे" },
      hi: { pvFamily: "पाटील परिवार", pvDate: "14 सितंबर 2026", pvVenue: "पाटील निवास, पुणे" },
      en: { pvFamily: "Patil Parivar", pvDate: "14 September 2026", pvVenue: "Patil Nivas, Pune" }
    },

    syncHints: function () {
      var hints = this.HINTS[language.value] || this.HINTS.mr;
      Object.keys(hints).forEach(function (id) {
        var input = $(id);
        if (input) input.setAttribute("placeholder", hints[id]);
      });
    },

    NAMES: { rajutsav: "राज उत्सव (Raj Utsav)", fort: "Aapla Bappa", kailash: "Kailash", darbar: "Temple Darbar", patrika: "Shubh Patrika", deep: "Deep Utsav", nilambari: "Tulsi Angan" },
    BLURB: {
      rajutsav: "A real, live invite website - scroll it exactly like your guests will.",
      fort: "A real, live invite website - scroll it exactly like your guests will.",
      kailash: "A real, live invite website - scroll it exactly like your guests will.",
      darbar: "A real, live invite website - scroll it exactly like your guests will.",
      patrika: "A real, live invite website - scroll it exactly like your guests will.",
      deep: "A real, live invite website - scroll it exactly like your guests will.",
      nilambari: "A real, live invite website - scroll it exactly like your guests will."
    },

    // flat draft -> the nested shape the themes merge over their defaults
    themeData: function () {
      var d = this.draft, out = {};
      if (d.familyName) {
        out.hero = { invitation: { familyName: d.familyName } };
        out.footer = { family: d.familyName };
      }
      var std = {};
      if (d.date) std.dateBig = d.date;
      if (d.venue) std.location = d.venue;
      if (d.date || d.venue) out.saveTheDate = std;
      // Both venue and address, deliberately: showing their hall next to our
      // sample street address would read as two different places.
      if (d.venue) out.location = { venue: d.venue, address: d.venue };
      return out;
    },

    hasDraft: function () {
      return !!(this.draft.familyName || this.draft.date || this.draft.venue);
    },

    loadDraft: function () {
      try { this.draft = JSON.parse(localStorage.getItem(this.DRAFT_KEY) || "{}") || {}; }
      catch (e) { this.draft = {}; }
      if (typeof this.draft !== "object" || !this.draft) this.draft = {};
    },

    saveDraft: function () {
      this.draft.theme = this.theme;
      try { localStorage.setItem(this.DRAFT_KEY, JSON.stringify(this.draft)); } catch (e) {}
    },

    // Hand the current draft to the theme, then (re)paint the iframe.
    // The themes lay out for a real handset (390px). The phone frame here is
    // only ~280px across, so letting the iframe take the frame's own width
    // rendered every design at a width no phone has - squeezed timelines,
    // clipped headings, cards reflowing differently from the live invite.
    // Give the iframe a true 390px viewport and scale the whole thing down
    // instead, so the preview is a faithful miniature of the real page.
    FRAME_W: 390,

    fitFrame: function () {
      var frame = $("pvFrame");
      if (!frame || !frame.parentNode) return;
      var screen = frame.parentNode;                 // .phone-screen
      var w = screen.clientWidth, h = screen.clientHeight;
      if (!w || !h) return;                          // still hidden - open() calls again
      var scale = w / this.FRAME_W;
      frame.style.width = this.FRAME_W + "px";
      frame.style.height = Math.round(h / scale) + "px";
      frame.style.transform = "scale(" + scale + ")";
    },

    paint: function (force) {
      var frame = $("pvFrame"), loading = $("pvLoading");
      if (!frame) return;
      try {
        window.sessionStorage.setItem(this.DATA_KEY, JSON.stringify({
          slug: "", theme: this.theme, preview: true, lang: this.previewLang(), data: this.themeData()
        }));
      } catch (e) { /* private mode - the sample invitation still renders */ }

      // ?edit=1 rather than ?preview=1: it opens the curtain at once, keeps
      // the music off and leaves scrolling to the visitor. ?preview=1 runs
      // an auto-scroll tour, which drifts away under a reader's finger -
      // the cards above already play that tour.
      // nointro once they start typing: the curtain replaying on every
      // keystroke would hide the very change they just made.
      var src = "/t/" + this.theme + "?edit=1" + (this.hasDraft() ? "&nointro=1" : "") + this.previewLangParam();
      if (frame.getAttribute("src") !== src) {
        frame.classList.remove("is-loaded");
        if (loading) loading.style.display = "";
        frame.setAttribute("src", src);
      } else if (force) {
        try { frame.contentWindow.location.reload(); } catch (e) { /* cross-origin: never here */ }
      }
    },

    mountMake: function () {
      var self = this;
      Object.keys(this.FIELDS).forEach(function (id) {
        var input = $(id);
        if (!input) return;
        input.addEventListener("input", function () {
          var value = input.value.trim();
          if (value) self.draft[self.FIELDS[id]] = value;
          else delete self.draft[self.FIELDS[id]];
          self.saveDraft();
          clearTimeout(self.makeTimer);
          // long enough that the frame is not rebuilt mid-word, short
          // enough that it still feels like it is answering you
          self.makeTimer = setTimeout(function () { self.paint(true); }, 600);
        });
      });
    },

    fillMake: function () {
      var self = this;
      Object.keys(this.FIELDS).forEach(function (id) {
        var input = $(id);
        if (input) input.value = self.draft[self.FIELDS[id]] || "";
      });
    },

    mount: function () {
      this.root = $("preview");
      if (!this.root) return;
      var self = this;

      each(document.querySelectorAll("[data-preview]"), function (el) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          self.open(el.getAttribute("data-preview"), el);
        });
      });

      // the whole thumbnail is a preview target, not just the eye
      each(document.querySelectorAll("[data-shots]"), function (card) {
        card.addEventListener("click", function () { self.open(card.getAttribute("data-theme"), card); });
      });

      each(this.root.querySelectorAll("[data-pv-theme]"), function (tab) {
        tab.addEventListener("click", function () { self.load(tab.getAttribute("data-pv-theme")); });
      });

      $("pvClose") && $("pvClose").addEventListener("click", function () { self.close(); });
      this.root.addEventListener("click", function (e) { if (e.target === self.root) self.close(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !self.root.hasAttribute("hidden")) self.close();
      });

      var choose = $("pvChoose");
      if (choose) {
        choose.addEventListener("click", function () {
          var theme = self.theme;
          self.saveDraft();               // carry what they typed through checkout
          self.close();
          if (window.__inviteoCheckout) window.__inviteoCheckout.open(theme);
        });
      }

      this.loadDraft();
      this.fillMake();
      this.mountMake();
      // Switching language with the preview open should change the invite in
      // front of them, not wait for the next open.
      this.syncHints();
      language.onChange(function () {
        // An explicit tap outranks the per-design default from here on, or
        // the toggle would sit there doing nothing to the invite in front of
        // them. Deliberately not reset on theme switch: once someone has
        // told us which language they read, we keep reading it back.
        self.langPinned = true;
        self.syncHints();
        if (!self.root.hasAttribute("hidden")) self.paint(false);
      });
      window.addEventListener("resize", function () {
        if (!self.root.hasAttribute("hidden")) self.fitFrame();
      });
    },

    load: function (theme) {
      var self = this;
      if (!this.NAMES[theme]) theme = "fort";
      this.theme = theme;
      this.saveDraft();                   // remember the design they settled on
      var frame = $("pvFrame"), loading = $("pvLoading"), open = $("pvOpen"), title = $("pvTitle");
      var sub = this.root.querySelector(".pv-sub");

      each(this.root.querySelectorAll("[data-pv-theme]"), function (tab) {
        var on = tab.getAttribute("data-pv-theme") === theme;
        tab.classList.toggle("is-on", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
        // On a phone the row scrolls sideways rather than wrapping, so the
        // chosen design can be sitting off the edge of it.
        if (on && tab.scrollIntoView) {
          try { tab.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) {}
        }
      });
      if (title) title.textContent = this.NAMES[theme];
      if (sub) sub.textContent = this.BLURB[theme];
      // this.theme is already set above, so the full-page link opens in the
      // same language the framed preview is showing.
      if (open) open.href = "/t/" + theme + "?preview=1" + this.previewLangParam();

      if (frame) {
        frame.onload = function () {
          self.fitFrame();
          frame.classList.add("is-loaded");
          if (loading) loading.style.display = "none";
        };
        this.fitFrame();
        this.paint(false);
      }
      track("ViewContent", { content_name: theme, content_category: "invite-website-preview", value: TOTAL, currency: CURRENCY });
    },

    open: function (theme, opener) {
      this.opener = opener || null;
      try {
        this.heldScroll = window.sessionStorage.getItem(this.SCROLL_KEY);
        window.sessionStorage.removeItem(this.SCROLL_KEY);   // always start at the top
      } catch (e) {}
      this.root.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      this.fitFrame();                    // the frame had no size while hidden
      // A design tapped from a card wins; otherwise reopen on the one they
      // were last shaping, so a draft never appears on the wrong invitation.
      this.load(theme || this.draft.theme);
      this.fillMake();
      var close = $("pvClose");
      if (close) setTimeout(function () { close.focus(); }, 60);
    },

    close: function () {
      this.root.setAttribute("hidden", "");
      document.body.style.overflow = "";
      // stop the iframe animating (and its audio, if a theme ever adds any)
      var frame = $("pvFrame");
      if (frame) { frame.removeAttribute("src"); frame.classList.remove("is-loaded"); }
      try {
        if (this.heldScroll === null) window.sessionStorage.removeItem(this.SCROLL_KEY);
        else window.sessionStorage.setItem(this.SCROLL_KEY, this.heldScroll);
      } catch (e) {}
      this.heldScroll = null;
      if (this.opener && this.opener.focus) this.opener.focus();
    }
  };

  // ------------------------------------------------------------ nav + CTA
  function mountNav() {
    var toggle = $("navToggle");
    var menu = $("mobileMenu");
    if (toggle && menu) {
      toggle.addEventListener("click", function () {
        var opening = menu.hasAttribute("hidden");
        if (opening) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
        toggle.setAttribute("aria-expanded", opening ? "true" : "false");
      });
      each(menu.querySelectorAll("a"), function (a) {
        a.addEventListener("click", function () {
          menu.setAttribute("hidden", "");
          toggle.setAttribute("aria-expanded", "false");
        });
      });
    }

    // Sticky mobile bar: show it once the hero CTA has scrolled away, so the
    // price and the button are never more than a thumb-reach away. A plain
    // scroll listener rather than IntersectionObserver - this has to work in
    // the in-app browsers WhatsApp, Instagram and Facebook open links in,
    // which is where nearly all of this traffic arrives.
    var bar = $("stickyBar");
    var anchor = document.querySelector(".hero-cta");
    if (bar && anchor) {
      var ticking = false;
      var sync = function () {
        ticking = false;
        bar.classList.toggle("is-on", anchor.getBoundingClientRect().bottom < 0);
      };
      window.addEventListener("scroll", function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(sync);
      }, { passive: true });
      window.addEventListener("resize", sync);
      sync();
    }

    var yr = $("yr");
    if (yr) yr.textContent = new Date().getFullYear();
  }

  // ------------------------------------------------------------- checkout
  var checkout = {
    root: null, theme: "rajutsav", busy: false, opener: null,
    currentTxnid: null, currentOrder: null,

    mount: function () {
      this.root = $("checkout");
      if (!this.root) return;
      var self = this;

      // every "Create yours" button opens the modal
      each(document.querySelectorAll("[data-cta]"), function (el) {
        el.addEventListener("click", function (e) {
          e.preventDefault();
          self.open();
        });
      });
      // "Choose this design" opens it with that theme already selected
      each(document.querySelectorAll("[data-choose]"), function (el) {
        el.addEventListener("click", function () { self.open(el.getAttribute("data-choose")); });
      });

      $("coClose") && $("coClose").addEventListener("click", function () { self.close(); });
      this.root.addEventListener("click", function (e) { if (e.target === self.root) self.close(); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !self.root.hasAttribute("hidden")) self.close();
      });
      // The bill is written into the HTML too, so a visitor with no JS still
      // sees what they are about to pay - this only keeps it in step with the
      // constants above, so a price change is one edit rather than four.
      if (!FREE_MODE) {
        var bill = { coBase: PRICE, coGst: GST, coSum: TOTAL };
        Object.keys(bill).forEach(function (id) {
          if ($(id)) $(id).textContent = "₹" + bill[id].toFixed(2);
        });
      } else {
        if ($("coProceedBtn")) $("coProceedBtn").textContent = "Create my invite — free →";
      }

      // Step 1 Proceed Button
      $("coProceedBtn") && $("coProceedBtn").addEventListener("click", function () { self.proceedUpi(); });

      // Step 2 Confirm Payment Button
      $("coConfirmBtn") && $("coConfirmBtn").addEventListener("click", function () { self.confirmUpi(); });

      // Step 2 Back Button
      $("coBackBtn") && $("coBackBtn").addEventListener("click", function () { self.showStep1(); });

      // Copy UPI ID Button
      $("coCopyUpiBtn") && $("coCopyUpiBtn").addEventListener("click", function () { self.copyUpiId(); });

      // Enter anywhere submits appropriate step
      var utrInput = $("coUtr");
      if (utrInput) {
        utrInput.addEventListener("keydown", function (e) {
          if (e.key === "Enter") self.confirmUpi();
        });
      }

      this.restore();
      this.resumeBanner();
      this.handleReturn();
    },

    showStep1: function () {
      var s1 = $("coStep1"), s2 = $("coStep2");
      if (s1) s1.removeAttribute("hidden");
      if (s2) s2.setAttribute("hidden", "");
      this.error("");
    },

    showStep2: function () {
      var s1 = $("coStep1"), s2 = $("coStep2");
      if (s1) s1.setAttribute("hidden", "");
      if (s2) s2.removeAttribute("hidden");
      this.error("");
      var utr = $("coUtr");
      if (utr) setTimeout(function () { utr.focus(); }, 120);
    },

    open: function (theme, silent) {
      this.opener = document.activeElement;
      this.showStep1();
      if (theme) {
        var radio = this.root.querySelector('input[name="cotheme"][value="' + theme + '"]');
        if (radio) radio.checked = true;
      }
      this.root.removeAttribute("hidden");
      document.body.style.overflow = "hidden";
      if (!silent) track("InitiateCheckout", { content_category: "ganpati-invite", value: TOTAL, currency: CURRENCY });
      var name = $("coName");
      if (name && !name.value) setTimeout(function () { name.focus(); }, 60);
    },

    close: function () {
      if (this.busy) return;              // never trap money mid-flight
      this.root.setAttribute("hidden", "");
      document.body.style.overflow = "";
      // hand focus back to whatever opened it, rather than dropping a keyboard
      // or screen-reader user at the top of the page
      if (this.opener && this.opener.focus) this.opener.focus();
      this.opener = null;
    },

    error: function (message) {
      var box = $("coError");
      if (box) {
        if (!message) box.setAttribute("hidden", "");
        else { box.textContent = message; box.removeAttribute("hidden"); }
      }
      var upiBox = $("coUpiError");
      if (upiBox) {
        if (!message) upiBox.setAttribute("hidden", "");
        else { upiBox.textContent = message; upiBox.removeAttribute("hidden"); }
      }
    },

    // Remember what they typed so a refresh or a failed payment doesn't
    // make them fill the form again.
    remember: function (values) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(values)); } catch (e) {}
    },
    stored: function () {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch (e) { return {}; }
    },
    restore: function () {
      var saved = this.stored();
      ["Name", "Phone", "Email"].forEach(function (field) {
        var input = $("co" + field);
        var value = saved[field.toLowerCase()];
        if (input && value) input.value = value;
      });
    },

    // If someone paid but never reached the editor, put the link back in
    // front of them instead of leaving them with a charge and no invite.
    resumeBanner: function () {
      var saved = this.stored();
      var host = $("resume");
      if (!host || !saved.editUrl) return;
      host.innerHTML = 'Your invite website is waiting - <a href="' + saved.editUrl + '">continue editing →</a>';
      host.removeAttribute("hidden");
    },

    // A crashed function returns an HTML error page, not JSON - parsing that
    // raw would put "Unexpected token '<'" in front of a paying customer.
    readJson: function (response) {
      return response.text().then(function (body) {
        try {
          return JSON.parse(body);
        } catch (e) {
          throw new Error("Payment service unavailable. Please check connection and try again.");
        }
      });
    },

    proceedUpi: function () {
      var self = this;
      var picked = this.root.querySelector('input[name="cotheme"]:checked');
      var theme = picked ? picked.value : "rajutsav";
      var name = ($("coName").value || "").trim();
      var phone = ($("coPhone").value || "").trim();
      var email = ($("coEmail").value || "").trim();

      if (name.length < 2) return this.error("Please tell us your name.");
      if (phone.replace(/\D/g, "").length < 10) return this.error("Please enter a valid WhatsApp mobile number.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
        return this.error("Please enter a valid email address.");
      }

      this.error("");
      this.remember({ name: name, phone: phone, email: email, theme: theme });
      var btn = $("coProceedBtn");
      var freeLabel = FREE_MODE ? "Create my invite — free →" : ("Proceed to UPI Payment (₹" + TOTAL + ") →");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = FREE_MODE
          ? '<span class="verify-spinner"></span> Opening your editor…'
          : '<span class="verify-spinner"></span> Generating UPI QR Code…';
      }

      fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: theme, lang: language.value, name: name, phone: phone, email: email })
      })
      .then(function (r) { return self.readJson(r); })
      .then(function (order) {
        if (!order.ok) throw new Error(order.error || "Could not create your invite.");

        // Free mode: skip UPI entirely and open the editor
        if (order.free && order.editUrl) {
          var saved = self.stored();
          saved.editUrl = order.editUrl;
          self.remember(saved);
          markPurchase(order.txnid);
          if (btn) btn.textContent = "Opening editor…";
          window.location.href = order.editUrl;
          return;
        }

        if (btn) {
          btn.disabled = false;
          btn.textContent = freeLabel;
        }
        self.currentTxnid = order.txnid;
        self.currentOrder = order;

        var badge = $("coRefBadge");
        if (badge) badge.textContent = "Order " + order.txnid;

        var amt = $("coPayAmount");
        if (amt) amt.textContent = "₹" + (order.amount != null ? order.amount : TOTAL);

        var qrImg = $("coQrImg");
        if (qrImg && order.qrDataUrl) qrImg.src = order.qrDataUrl;

        var upiText = $("coUpiIdText");
        if (upiText) upiText.textContent = order.upiId;

        var deepLink = $("coUpiDeepLink");
        if (deepLink) deepLink.href = order.upiString;

        var successMsg = $("coSuccessMsg");
        if (successMsg) successMsg.setAttribute("hidden", "");

        var confirmBtn = $("coConfirmBtn");
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "I’ve paid — Confirm";
        }

        self.showStep2();
      })
      .catch(function (err) {
        if (btn) {
          btn.disabled = false;
          btn.textContent = freeLabel;
        }
        self.error(err.message || (FREE_MODE ? "Could not open the editor. Please try again." : "Failed to start UPI payment. Please try again."));
      });
    },

    pollUntilPaid: function (txnid) {
      var self = this;
      var tries = 0;
      if (self._pollTimer) clearInterval(self._pollTimer);
      self._pollTimer = setInterval(function () {
        tries += 1;
        if (tries > 120) {
          clearInterval(self._pollTimer);
          self.error("Still waiting for confirmation. Message us on WhatsApp with your UTR and order ref " + txnid + ".");
          return;
        }
        fetch("/api/order-status?txnid=" + encodeURIComponent(txnid))
          .then(function (r) { return self.readJson(r); })
          .then(function (data) {
            if (data.ok && data.status === "paid" && data.editUrl) {
              clearInterval(self._pollTimer);
              var saved = self.stored();
              saved.editUrl = data.editUrl;
              self.remember(saved);
              markPurchase(txnid);
              window.location.href = data.editUrl;
            }
          })
          .catch(function () {});
      }, 5000);
    },

    copyUpiId: function () {
      var self = this;
      var upiId = (this.currentOrder && this.currentOrder.upiId) || "9769104020@nyes";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(upiId).then(function () {
          var btn = $("coCopyUpiBtn");
          if (btn) {
            btn.textContent = "Copied! ✓";
            setTimeout(function () { btn.textContent = "Copy ID"; }, 2000);
          }
        });
      }
    },

    confirmUpi: function () {
      var self = this;
      var utr = ($("coUtr").value || "").trim().replace(/\s+/g, "");
      if (!/^[A-Za-z0-9]{12}$/.test(utr)) {
        return this.error("Enter the exact 12-character UPI Ref / UTR from your payment app. Payment not verified yet.");
      }
      if (!self.currentTxnid) {
        return this.error("Order expired. Go back and start payment again.");
      }

      this.error("");
      this.busy = true;
      var confirmBtn = $("coConfirmBtn");
      var successMsg = $("coSuccessMsg");
      if (successMsg) successMsg.style.display = "none";
      if (confirmBtn) {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<span class="verify-spinner"></span> Verifying payment…';
      }

      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnid: self.currentTxnid, utr: utr, theme: (self.currentOrder && self.currentOrder.theme) || "rajutsav" })
      })
      .then(function (r) { return self.readJson(r); })
      .then(function (result) {
        if (result.pending) {
          self.busy = false;
          if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Waiting for confirmation…";
          }
          var successMsg = $("coSuccessMsg");
          if (successMsg) {
            successMsg.removeAttribute("hidden");
            successMsg.textContent = "✓ UTR submitted. Keep this page open — editor opens after we confirm.";
          }
          self.pollUntilPaid(self.currentTxnid);
          return;
        }
        if (!result.ok) throw new Error(result.error || "Payment verification failed.");
        
        if (successMsg) {
          successMsg.removeAttribute("hidden");
          successMsg.textContent = "✓ Payment confirmed! Opening editor…";
        }
        if (confirmBtn) confirmBtn.textContent = "Opening editor…";

        var saved = self.stored();
        saved.editUrl = result.editUrl;
        self.remember(saved);
        markPurchase(self.currentTxnid);

        setTimeout(function () {
          window.location.href = result.editUrl;
        }, 1200);
      })
      .catch(function (err) {
        self.busy = false;
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = "I’ve paid — Confirm";
        }
        self.error(err.message || "Could not verify payment. Check your UTR, or try again after paying.");
      });
    },

    confirm: function (txnid, attempt) {
      var self = this;
      attempt = attempt || 0;
      this.setBusy(true, "Confirming payment\u2026");

      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnid: txnid })
      })
        .then(function (r) { return self.readJson(r); })
        .then(function (result) {
          if (result.ok) {
            var saved = self.stored();
            saved.editUrl = result.editUrl;
            saved.txnid = null;
            self.remember(saved);
            markPurchase(txnid);
            self.busy = false;
            window.location.href = result.editUrl;
            return;
          }
          // Still settling at PayU's end. Keep asking rather than telling a
          // customer who has been charged that nothing happened.
          if (result.pending && attempt < 6) {
            return setTimeout(function () { self.confirm(txnid, attempt + 1); }, 2500);
          }
          throw new Error(result.error || "We could not confirm the payment.");
        })
        .catch(function (err) {
          self.setBusy(false);
          self.open(null, true);
          self.error(err.message + (txnid ? " Your reference is " + txnid + " - keep it and message us, we'll finish it for you." : ""));
        });
    },

    // Coming back from PayU. The server has already decided the outcome and
    // says so in the query string; this only puts it into words, and picks
    // the payment back up if it was still being confirmed.
    handleReturn: function () {
      var params = new URLSearchParams(window.location.search);
      var state = params.get("pay");
      if (!state) return;
      var ref = params.get("ref") || this.stored().txnid || "";

      // Clear it from the URL: a reload should not re-announce a payment.
      try { history.replaceState(null, "", window.location.pathname); } catch (e) {}

      this.open(null, true);
      if (state === "pending") return this.confirm(ref);

      if (state === "cancelled") {
        this.error("Payment cancelled - nothing was charged. You can try again whenever you like.");
      } else if (state === "unknown") {
        this.error("We couldn't match that payment" + (ref ? " (reference " + ref + ")" : "") +
          ". If money was deducted, message us with that reference and we'll finish your invite.");
      } else {
        this.error("The payment didn't go through - no money was deducted. Please try again.");
      }
    }
  };

  // ------------------------------------------------------- design shots
  // Each design card shows a real still of that invite, and the language
  // toggle sits directly above the cards. Marathi keeps the plain filename;
  // Hindi and English get a -hi / -en still. Without this the toggle looks
  // dead: a visitor picks English, the three cards below it stay in
  // Marathi, and they conclude the switch does nothing.
  function mountShotLanguage() {
    var shots = document.querySelectorAll("[data-shots] .shot");
    if (!shots.length) return;

    // The stills keep their filenames when we retake them, so a visitor who
    // has been here before can hold an old one in cache and never see the
    // new art. The ?v= carried in the markup is what busts that - so keep it
    // when swapping languages, or the swapped-in shot loses the bust.
    //
    // Per image, not one shared value: the designs are retaken separately
    // and carry different versions, and a single variable took whichever
    // card happened to be last in the DOM and stamped it on all of them -
    // silently un-busting every other design the moment a new one shipped.
    each(shots, function (img) {
      var src = img.getAttribute("src") || "";
      var query = src.indexOf("?");
      if (query > -1) {
        img.setAttribute("data-shot-version", src.slice(query));
        src = src.slice(0, query);
      }
      // Occasion templates ship SVG posters without language variants.
      if (/\.svg$/i.test(src)) {
        img.setAttribute("data-shot-static", "1");
        img.setAttribute("data-shot-base", src);
        return;
      }
      img.setAttribute("data-shot-base", src.replace(/(-(hi|en))?\.webp$/, ""));
    });

    // The Marathi still is the one every design is guaranteed to have -
    // it is the file the card ships with, and the language variants are
    // retaken separately. Nilambari went out with only its Marathi shot,
    // so picking हिंदी or English pointed the card at a file that does not
    // exist and the gallery showed a broken frame on the page that sells
    // the product. A design missing one language now falls back to the
    // shot it does have rather than to nothing.
    var marathiSrc = function (img) {
      var base = img.getAttribute("data-shot-base");
      if (!base) return "";
      if (img.getAttribute("data-shot-static") === "1") return base + (img.getAttribute("data-shot-version") || "");
      return base + ".webp" + (img.getAttribute("data-shot-version") || "");
    };

    // The last line of defence: whatever put the src there - first paint,
    // a language swap, or a reduced-motion swap that skips preloading.
    // Guarded against the Marathi still itself failing, or this loops.
    each(shots, function (img) {
      img.addEventListener("error", function () {
        var fallback = marathiSrc(img);
        if (!fallback || img.getAttribute("src") === fallback) return;
        img.setAttribute("src", fallback);
      });
    });

    // Switching language used to swap the src underneath the reader, which
    // flashed - and on a slow connection showed a broken frame mid-load.
    // Fade the still out, swap it while it cannot be seen, fade it back.
    // Every path here ends with the new src applied and the fade removed:
    // a still left invisible would read as a card that failed to load.
    var swap = function (img, next, instant) {
      if (img.getAttribute("src") === next) return;
      if (instant || !motionOK()) { img.setAttribute("src", next); return; }

      var done = false;
      var apply = function () {
        if (done) return;
        done = true;
        img.setAttribute("src", next);
        requestAnimationFrame(function () { img.classList.remove("is-swapping"); });
      };

      img.classList.add("is-swapping");

      // Swap only once the replacement is decoded *and* the fade-out has
      // actually had time to run, or the change is visible as a jump.
      var loaded = false, faded = false;
      var ready = function () { if (loaded && faded) apply(); };
      var pre = new Image();
      pre.onload = function () { loaded = true; ready(); };
      // Caught here as well as on the element, so the fade comes back up on
      // the Marathi still rather than flashing the broken frame first.
      pre.onerror = function () {
        var fallback = marathiSrc(img);
        if (fallback) next = fallback;
        loaded = true;
        ready();
      };
      pre.src = next;
      setTimeout(function () { faded = true; ready(); }, 240);
      setTimeout(apply, 800);      // a hung load must not strand the fade
    };

    var first = true;
    var paint = function () {
      each(shots, function (img) {
        var base = img.getAttribute("data-shot-base");
        if (!base) return;
        if (img.getAttribute("data-shot-static") === "1") return;
        var version = img.getAttribute("data-shot-version") || "";
        var next = base + (language.value === "mr" ? "" : "-" + language.value) + ".webp" + version;
        swap(img, next, first);    // the first paint is a load, not a change
      });
      first = false;
    };

    paint();                       // a saved choice must show on first paint
    language.onChange(paint);
  }

  // --------------------------------------------------------------- darshan
  // The invitations open with a curtain. So does the page that sells them -
  // once, over the phone in the hero, a beat after the first paint so the
  // animation never competes with the page loading.
  function mountDarshan() {
    var curtain = document.querySelector("[data-darshan]");
    if (!curtain) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      curtain.remove();
      return;
    }
    setTimeout(function () {
      curtain.classList.add("is-open");
      // Once it is open it is scenery over a live iframe; take it out of the
      // way so nothing of it can ever intercept a tap.
      setTimeout(function () { curtain.remove(); }, 1400);
    }, 520);
  }

  // --------------------------------------------------------------- reveals
  // Content rises as it arrives, a few hundredths of a second apart, so a
  // section reads as a sequence rather than appearing all at once. Anything
  // already on screen at load is shown immediately - a reader who lands
  // mid-page must never meet a blank one.
  function mountReveals() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("IntersectionObserver" in window)) return;

    var groups = document.querySelectorAll(
      ".designs .wrap, .thread-proof .wrap, .how .wrap, .pricing .wrap, .testimonials .wrap, .faq .wrap, .cta-band .wrap"
    );
    var watched = [];
    Array.prototype.forEach.call(groups, function (group) {
      var kids = Array.prototype.filter.call(group.children, function (el) {
        return el.getBoundingClientRect().height > 0;
      });
      kids.forEach(function (el, i) {
        // A container marked data-stagger stays put and lets its own
        // children arrive one by one instead - a row of three cards reads
        // as three arrivals, not one block sliding up.
        if (el.hasAttribute("data-stagger")) return;
        el.classList.add("rise");
        el.style.setProperty("--rise-i", String(Math.min(i, 6)));
        watched.push(el);
      });
    });

    each(document.querySelectorAll("[data-stagger]"), function (host) {
      Array.prototype.forEach.call(host.children, function (child, n) {
        if (child.classList.contains("rise")) return;
        child.classList.add("rise");
        child.style.setProperty("--rise-i", String(Math.min(n, 8)));
        watched.push(child);
      });
    });

    function showAll() {
      watched.forEach(function (el) { el.classList.add("is-in"); });
    }

    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

      watched.forEach(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
        else io.observe(el);
      });
    } catch (e) {
      showAll();
      return;
    }

    // A reveal that never fires is a blank sales page - but a blanket reveal
    // on a timer was not the way to guarantee that. Four seconds is shorter
    // than anyone spends reading the hero, so it fired on every ordinary
    // visit, revealed all forty-odd elements at once, and the page was
    // already up by the time the reader scrolled to it. The safety net was
    // running as the normal path and there was no scroll animation left.
    //
    // So the net is a scroll-position sweep now. It reveals only what has
    // actually reached the viewport, so it can never get ahead of the
    // reader, and it still covers what the timer was there for: an observer
    // that exists but never delivers, in a tab that is throttled or never
    // gets a frame. Whatever the observer misses, the next scroll catches.
    var sweeping = false;
    function sweep() {
      sweeping = false;
      var pending = false;
      watched.forEach(function (el) {
        if (el.classList.contains("is-in")) return;
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
        else pending = true;
      });
      // Nothing left below the fold - stop listening rather than measure
      // forty elements on every scroll for the rest of the visit.
      if (!pending) window.removeEventListener("scroll", onScroll);
    }
    function onScroll() {
      if (sweeping) return;
      sweeping = true;
      requestAnimationFrame(sweep);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    setTimeout(sweep, 4000);
  }

  // --------------------------------------------------------------- parallax
  // The toran hangs in front of the page and the malas hang beside it, so
  // they should not travel with the text as if painted on it. A few pixels
  // of drift on scroll is enough to put them in front - more than that and
  // the hero starts to feel like a slideshow.
  function mountParallax() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var toran = document.querySelector(".hero-toran");
    var malas = document.querySelectorAll(".hero-mala");
    // The phone carries a CSS float animation of its own now, and an
    // animation beats an inline transform - so the drift is applied to the
    // frame around it instead. The badges are positioned inside that frame,
    // so they travel with the handset exactly as they did before.
    var visual = document.querySelector(".hero-visual");
    if (!toran && !malas.length && !visual) return;

    var ticking = false;
    function frame() {
      ticking = false;
      var y = window.pageYOffset || 0;
      if (y > 900) return;                       // only while the hero is in play
      if (toran) toran.style.transform = "translateY(" + (y * 0.16).toFixed(1) + "px)";
      Array.prototype.forEach.call(malas, function (m, i) {
        m.style.transform = "translateY(" + (y * (0.1 + i * 0.05)).toFixed(1) + "px)";
      });
      if (visual) visual.style.transform = "translateY(" + (y * -0.045).toFixed(1) + "px)";
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(frame);
    }, { passive: true });
  }

  // --------------------------------------------------------------- motion
  // One question asked once: may this page move at all? Everything below
  // and the whole `anim-on` layer in styles.css hangs off the answer.
  function motionOK() {
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  // Wrap every word of an element in its own span so it can be animated
  // separately. Walks the tree rather than rewriting innerHTML, so inline
  // markup inside the heading - the gold <span class="hl"> - survives with
  // its words wrapped in place. The text itself is never touched.
  function splitWords(el) {
    var i = 0;
    function walk(node) {
      var kids = Array.prototype.slice.call(node.childNodes);
      kids.forEach(function (kid) {
        if (kid.nodeType === 3) {
          var parts = kid.nodeValue.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          var wrapped = false;
          parts.forEach(function (part) {
            if (!part) return;
            if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
            var span = document.createElement("span");
            span.className = "hw";
            span.style.setProperty("--w", String(i++));
            span.textContent = part;
            frag.appendChild(span);
            wrapped = true;
          });
          if (wrapped) node.replaceChild(frag, kid);
        } else if (kid.nodeType === 1) {
          walk(kid);
        }
      });
    }
    walk(el);
    return i;
  }

  // The hero is above the fold, so it does not wait for a scroll - it plays
  // once, on load. Anything that throws here leaves the hero exactly as the
  // HTML delivered it, which is a finished hero.
  function mountHeroEntrance() {
    if (!motionOK()) return;
    var copy = document.querySelector(".hero-copy");
    if (!copy) return;

    try {
      var h1 = copy.querySelector("h1");
      if (h1) splitWords(h1);

      var steps = [
        copy.querySelector(".pill"),
        copy.querySelector(".lede"),
        document.querySelector(".hero-cta"),
        document.querySelector(".hero-trust")
      ];
      steps.forEach(function (el, n) {
        if (el) el.style.setProperty("--hero-i", String(n));
      });

      // Two frames: one for the browser to take the starting state, one to
      // move off it. A single frame is sometimes coalesced and the whole
      // hero snaps in with no transition at all.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          if (h1) h1.classList.add("is-in");
          steps.forEach(function (el) { if (el) el.classList.add("is-in"); });
        });
      });

      // Belt and braces: whatever happens to those frames, the hero is
      // readable a second in. A blank hero is a lost sale.
      setTimeout(function () {
        if (h1) h1.classList.add("is-in");
        steps.forEach(function (el) { if (el) el.classList.add("is-in"); });
      }, 1200);
    } catch (e) {
      document.documentElement.classList.remove("anim-on");
    }
  }

  // The masthead earns a shadow once the page has moved under it.
  function mountHeaderScroll() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var ticking = false;
    function sync() {
      ticking = false;
      header.classList.toggle("is-scrolled", (window.pageYOffset || 0) > 8);
    }
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    }, { passive: true });
    sync();
  }

  // ------------------------------------------------------------------ lit
  // A lighter touch than a reveal. `is-lit` only says "this is on screen
  // now"; it hides nothing. Sections that play a sequence - the chat, the
  // price, the stars - hang off it, so if the observer never fires the
  // worst case is a section that is fully readable and simply did not
  // animate. Reveals hide first and show later; this never hides.
  function mountLit() {
    var marks = document.querySelectorAll("[data-lit]");
    if (!marks.length) return;

    function lightAll() { each(marks, function (el) { el.classList.add("is-lit"); }); }
    if (!motionOK() || !("IntersectionObserver" in window)) return lightAll();

    try {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-lit");
          io.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -10% 0px", threshold: 0.18 });
      each(marks, function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) el.classList.add("is-lit");
        else io.observe(el);
      });
    } catch (e) {
      lightAll();
      return;
    }
    setTimeout(lightAll, 6000);
  }

  // The thread plays in order, so each bubble needs to know its place in it.
  function mountThread() {
    var body = document.querySelector(".wa-thread .wa-body");
    if (!body) return;
    var n = 0;
    each(body.querySelectorAll(".wa-msg"), function (msg) {
      msg.style.setProperty("--m", String(n++));
    });
  }

  // Five stars that fill left to right. The row is already aria-hidden -
  // the rating is stated in words beside it - so splitting it costs nothing.
  function mountStars() {
    each(document.querySelectorAll(".quote .stars"), function (row) {
      var text = (row.textContent || "").trim();
      if (!text || row.querySelector(".st")) return;
      row.textContent = "";
      text.split("").forEach(function (ch, i) {
        var star = document.createElement("span");
        star.className = "st";
        star.style.setProperty("--s", String(i));
        star.textContent = ch;
        row.appendChild(star);
      });
    });
  }

  // On a phone the three quotes become one swipeable row that advances by
  // itself - and stops for good the moment the reader takes hold of it.
  function mountQuoteCarousel() {
    var grid = document.querySelector(".quote-grid");
    if (!grid) return;
    var count = grid.children.length;
    if (count < 2) return;

    var stopped = false;
    // Desktop lays these out as a static three-column grid, where there is
    // nothing to scroll - this is the test for "am I a carousel right now",
    // and it re-answers itself on every tick, so a rotation does the right
    // thing without a resize listener.
    function scrollable() { return grid.scrollWidth - grid.clientWidth > 20; }

    var timer = setInterval(function () {
      if (stopped || document.hidden || !motionOK() || !scrollable()) return;
      var step = grid.scrollWidth / count;
      var next = (Math.round(grid.scrollLeft / step) + 1) % count;
      try { grid.scrollTo({ left: next * step, behavior: "smooth" }); }
      catch (e) { grid.scrollLeft = next * step; }
    }, 4600);

    ["pointerdown", "touchstart", "wheel", "keydown"].forEach(function (ev) {
      grid.addEventListener(ev, function () {
        stopped = true;
        clearInterval(timer);
      }, { passive: true });
    });
  }

  // ------------------------------------------------------------------ faq
  // <details> snaps. Driving it by hand buys the open/close a height it can
  // be animated over, and lets one answer close as the next one opens.
  // The element stays a real <details>, so the markup a crawler reads and
  // the FAQ schema in the head are untouched.
  function mountFaq() {
    var items = document.querySelectorAll(".faq-item");
    if (!items.length) return;

    // Every open/close carries a token. Handlers from a superseded click -
    // a cancelled animation, a late timeout - check it and do nothing, so a
    // fast double-click can never leave an answer half-open or reopen one
    // the reader has just shut.
    var tokens = 0;

    function settle(item, token, opened) {
      if (item.__faqToken !== token) return;
      if (!opened) item.removeAttribute("open");
      var body = item.querySelector("p");
      if (body) body.style.overflow = "";
    }

    function clearAnims(body) {
      if (!body.getAnimations) return;
      body.getAnimations().forEach(function (a) {
        try { a.cancel(); } catch (e) {}
      });
    }

    // The height animation is decoration. The `open` attribute is state, and
    // it is never allowed to depend on an animation finishing: a background
    // tab does not advance the document timeline, so `onfinish` may simply
    // never arrive. Each path therefore also settles on a timer.
    function openItem(item) {
      var token = ++tokens;
      item.__faqToken = token;
      item.setAttribute("open", "");

      var body = item.querySelector("p");
      if (!body || !motionOK() || !body.animate) return;
      var height = body.scrollHeight;
      clearAnims(body);
      body.style.overflow = "hidden";
      var anim;
      try {
        anim = body.animate(
          [{ height: "0px", opacity: 0 }, { height: height + "px", opacity: 1 }],
          { duration: 320, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      } catch (e) {
        body.style.overflow = "";
        return;
      }
      anim.onfinish = anim.oncancel = function () { settle(item, token, true); };
      setTimeout(function () { settle(item, token, true); }, 500);
    }

    function closeItem(item) {
      var token = ++tokens;
      item.__faqToken = token;

      var body = item.querySelector("p");
      var done = function () { settle(item, token, false); };
      if (!body || !motionOK() || !body.animate) return done();

      var height = body.scrollHeight;
      clearAnims(body);
      body.style.overflow = "hidden";
      var anim;
      try {
        anim = body.animate(
          [{ height: height + "px", opacity: 1 }, { height: "0px", opacity: 0 }],
          { duration: 260, easing: "cubic-bezier(.4,0,.2,1)" }
        );
      } catch (e) {
        return done();
      }
      anim.onfinish = anim.oncancel = done;
      setTimeout(done, 420);
    }

    each(items, function (item) {
      var summary = item.querySelector("summary");
      if (!summary) return;
      summary.addEventListener("click", function (e) {
        e.preventDefault();                    // we drive `open` ourselves
        var opening = !item.hasAttribute("open");
        each(items, function (other) {
          if (other !== item && other.hasAttribute("open")) closeItem(other);
        });
        if (opening) openItem(item); else closeItem(item);
      });
    });
  }

  // ----------------------------------------------------------------- boot
  function boot() {
    // Arms every `html.anim-on` rule in styles.css. Set before the first
    // mount so nothing paints in a visible state and then hides itself.
    if (motionOK()) document.documentElement.classList.add("anim-on");
    language.mount();
    mountShotLanguage();           // before mountNav: the cards paint on load
    mountNav();
    mountPreview();
    startCountdown();
    mountLiveCount();
    checkout.mount();
    // the preview modal hands the chosen design to checkout
    window.__inviteoCheckout = checkout;
    preview.mount();
    mountDarshan();
    mountHeroEntrance();
    mountHeaderScroll();
    mountThread();
    mountStars();
    mountReveals();
    mountLit();
    mountFaq();
    mountQuoteCarousel();
    mountParallax();
    mountSiteShare();
  }

  // Share this marketing page. Tested: sticky bar was covering footer taps;
  // WhatsApp must open via real navigation (wa.me), not window.open.
  function mountSiteShare() {
    var SHARE_URL = "https://utsavlink.arhamtechnology.com/";
    var SHARE_TITLE = "Create Your Personalized Ganpati Invitation Website | UtsavLink";
    var SHARE_TEXT =
      "Create your own digital Ganpati invitation — Starting at ₹99 + GST\n" + SHARE_URL;
    var WA_HREF = "https://wa.me/?text=" + encodeURIComponent(SHARE_TEXT);
    var FB_HREF =
      "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(SHARE_URL);

    function markCopied(el) {
      if (!el) return;
      var prev = el.getAttribute("data-label");
      if (!prev) {
        prev = (el.textContent || "Copy link").replace(/\s+/g, " ").trim();
        el.setAttribute("data-label", prev);
      }
      el.classList.add("is-copied");
      el.setAttribute("aria-label", "Link copied");
      var textNode = null;
      each(el.childNodes, function (n) {
        if (!textNode && n.nodeType === 3 && n.textContent.trim()) textNode = n;
      });
      if (textNode) textNode.textContent = " Copied!";
      clearTimeout(el._copyT);
      el._copyT = setTimeout(function () {
        el.classList.remove("is-copied");
        el.setAttribute("aria-label", prev);
        if (textNode) textNode.textContent = " " + prev;
      }, 1800);
      var toast = document.getElementById("shareToast");
      if (toast) {
        toast.hidden = false;
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { toast.hidden = true; }, 1800);
      }
    }

    function copyLink(el) {
      // Always show feedback first — clipboard APIs fail silently in many
      // mobile / in-app browsers even when the copy actually worked.
      markCopied(el);

      var ok = false;
      try {
        var ta = document.createElement("textarea");
        ta.value = SHARE_URL;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;z-index:99999";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, SHARE_URL.length);
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch (err) {
        ok = false;
      }
      if (ok) return;

      if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
        navigator.clipboard.writeText(SHARE_URL).catch(function () {});
      }
    }

    // Wire hrefs + click handlers (delegation so dynamically fine)
    each(document.querySelectorAll("[data-share]"), function (el) {
      var kind = el.getAttribute("data-share");
      if (kind === "whatsapp") {
        el.setAttribute("href", WA_HREF);
        el.removeAttribute("target"); // same-tab opens WhatsApp app on phones
        el.setAttribute("rel", "noopener noreferrer");
      } else if (kind === "facebook") {
        el.setAttribute("href", FB_HREF);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      } else if (kind === "native") {
        if (typeof navigator.share === "function") el.hidden = false;
      }
    });

    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("[data-share]");
      if (!el) return;
      var kind = el.getAttribute("data-share");

      if (kind === "whatsapp") {
        // Force navigation even if something else tries to block it
        e.preventDefault();
        window.location.href = WA_HREF;
        return;
      }
      if (kind === "facebook") {
        e.preventDefault();
        // Prefer new tab on desktop; same-tab fallback if blocked
        var w = window.open(FB_HREF, "_blank", "noopener,noreferrer");
        if (!w) window.location.href = FB_HREF;
        return;
      }
      if (kind === "copy") {
        e.preventDefault();
        copyLink(el);
        return;
      }
      if (kind === "native") {
        e.preventDefault();
        if (typeof navigator.share === "function") {
          navigator.share({ title: SHARE_TITLE, text: SHARE_TEXT, url: SHARE_URL }).catch(function () {
            copyLink(el);
          });
        } else {
          copyLink(el);
        }
      }
    }, false);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
