(function () {
  "use strict";

  var invite = window.__INVITE__ || {};
  var theme = invite.theme || (document.body && document.body.getAttribute("data-theme")) || "aagman";
  var data = Object.assign({}, invite.data || {});
  var paid = !!invite.paid && !invite.preview;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function formatDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    try {
      return d.toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    } catch (e) {
      return iso;
    }
  }

  function setText(nodes, value) {
    nodes.forEach(function (el) {
      el.textContent = value || "";
    });
  }

  function apply(next) {
    if (next && typeof next === "object") {
      if (next.data) data = Object.assign({}, data, next.data);
      else data = Object.assign({}, data, next);
      if (typeof next.paid === "boolean") paid = next.paid;
      if (next.theme) theme = next.theme;
    }

    document.body.setAttribute("data-theme", theme);
    qsa(".skin").forEach(function (skin) {
      var on = skin.getAttribute("data-skin") === theme;
      skin.hidden = !on;
      skin.classList.toggle("is-on", on);
    });

    var active = qs(".skin.is-on") || qs(".skin:not([hidden])") || document;
    setText(qsa('[data-bind="name1"]', active), data.name1);
    setText(qsa('[data-bind="name2"]', active), data.name2);
    setText(qsa('[data-bind="quote"]', active), data.quote);
    setText(qsa('[data-bind="event"]', active), data.event);
    setText(qsa('[data-bind="date"]', active), formatDate(data.date) || data.date);
    setText(qsa('[data-bind="timing"]', active), data.timing);
    setText(qsa('[data-bind="venue"]', active), data.venue);

    qsa('[data-bind="photo"]', active).forEach(function (img) {
      if (data.photo) {
        img.src = data.photo;
        img.hidden = false;
      } else {
        img.hidden = true;
      }
    });
    qsa("[data-photo-wrap]", active).forEach(function (wrap) {
      wrap.hidden = !data.photo;
    });

    var mark = qs(".watermark");
    if (mark) mark.hidden = !!paid;

    var audio = qs("#bgAudio");
    if (audio) {
      var src = data.musicUrl || audio.getAttribute("data-default") || "";
      if (src && audio.getAttribute("src") !== src) audio.src = src;
    }
  }

  function restart() {
    var reel = qs(".reel");
    if (!reel) return;
    reel.classList.remove("is-playing");
    void reel.offsetWidth;
    reel.classList.add("is-playing");
    var audio = qs("#bgAudio");
    if (audio && audio.src) audio.play().catch(function () {});
  }

  window.addEventListener("message", function (e) {
    var msg = e.data;
    if (!msg || msg.type !== "utsav-video-data") return;
    apply(msg.payload || {});
    if (msg.restart) restart();
  });

  document.addEventListener("DOMContentLoaded", function () {
    apply({ theme: theme, data: data, paid: paid });
    restart();
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "utsav-video-ready", theme: theme }, "*");
    }
  });

  window.__utsavVideoApply = apply;
  window.__utsavVideoRestart = restart;
})();
