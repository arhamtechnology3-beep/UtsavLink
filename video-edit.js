(function () {
  "use strict";

  var params = new URLSearchParams(location.search);
  var theme = params.get("theme") || "aagman";
  var token = params.get("token") || "";
  var paid = params.get("paid") === "1";
  var catalog = { price: 299, templates: [] };
  var tpl = null;
  var draft = {};
  var frameReady = false;
  var saveTimer = null;

  var $ = function (id) { return document.getElementById(id); };
  var fields = ["name1", "name2", "quote", "event", "date", "timing", "venue"];

  function readJson(res) {
    return res.text().then(function (body) {
      try { return JSON.parse(body); }
      catch (e) { throw new Error("Could not reach the server. Try again."); }
    });
  }

  function formData() {
    var data = {};
    fields.forEach(function (k) {
      data[k] = ($(k) && $(k).value) || "";
    });
    if (draft.photo) data.photo = draft.photo;
    if (draft.musicUrl) data.musicUrl = draft.musicUrl;
    else if (tpl && tpl.music) data.musicUrl = tpl.music;
    return data;
  }

  function fill(data) {
    fields.forEach(function (k) {
      if ($(k) && data[k] != null) $(k).value = data[k];
    });
    if (data.photo) draft.photo = data.photo;
    if (data.musicUrl) draft.musicUrl = data.musicUrl;
  }

  function pushPreview(restart) {
    var frame = $("player");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({
      type: "utsav-video-data",
      restart: !!restart,
      payload: { theme: theme, paid: paid, data: formData() }
    }, "*");
  }

  function loadFrame() {
    var src = "/v/" + encodeURIComponent(theme) + "?preview=1";
    $("player").src = src;
  }

  function setPaidUi() {
    paid = true;
    $("payBtn").hidden = true;
    $("payBtn").style.display = "none";
    $("publishBtn").hidden = false;
    $("publishBtn").style.display = "";
    $("slugField").hidden = false;
    $("musicBtn").hidden = false;
    $("musicHint").textContent = "Default track, or upload an MP3 (max 10 MB).";
    $("previewHint").textContent = "Paid — the preview mark is off. Publish to get your WhatsApp link.";
    $("payNote").innerHTML = "<b>Unlocked</b> · choose a link and publish";
    pushPreview(true);
  }

  function livePath(slug) {
    return location.origin + "/i/" + slug;
  }

  function showLive(slug) {
    if (!slug) return;
    $("livebox").classList.add("show");
    $("liveUrl").textContent = livePath(slug);
    var text = encodeURIComponent("You're invited — " + (formData().event || "UtsavLink") + "\n" + livePath(slug));
    $("shareBtn").onclick = function () {
      window.open("https://wa.me/?text=" + text, "_blank", "noopener");
    };
    $("copyBtn").onclick = function () {
      navigator.clipboard.writeText(livePath(slug)).then(function () {
        $("copyBtn").textContent = "Copied";
      }).catch(function () {});
    };
  }

  function saveRemote(publish) {
    if (!token || !paid) return Promise.resolve();
    var slug = ($("slug") && $("slug").value || "").trim();
    return fetch("/api/edit?token=" + encodeURIComponent(token), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: formData(), slug: slug, publish: !!publish })
    }).then(readJson).then(function (res) {
      if (!res.ok) {
        if ($("slugMsg")) $("slugMsg").textContent = res.error || "Could not save.";
        throw new Error(res.error || "Save failed");
      }
      if ($("slugMsg")) $("slugMsg").textContent = "Saved.";
      if (res.invite && res.invite.published && res.invite.slug) showLive(res.invite.slug);
      return res;
    });
  }

  function scheduleSave() {
    draft = formData();
    try { localStorage.setItem("utsav.video." + theme, JSON.stringify(draft)); } catch (e) {}
    pushPreview(false);
    if (!token || !paid) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveRemote(false).catch(function () {}); }, 500);
  }

  function uploadFile(file, asAudio) {
    if (!token || !paid) throw new Error("Pay first to upload.");
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        fetch("/api/upload?token=" + encodeURIComponent(token), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contentType: file.type || (asAudio ? "audio/mpeg" : "image/jpeg"),
            dataBase64: reader.result
          })
        }).then(readJson).then(function (res) {
          if (!res.ok) throw new Error(res.error || "Upload failed");
          resolve(res.url);
        }).catch(reject);
      };
      reader.onerror = function () { reject(new Error("Could not read file")); };
      reader.readAsDataURL(file);
    });
  }

  var checkout = {
    txnid: null,
    pollTimer: null,

    error: function (msg, upi) {
      var box = upi ? $("coUpiError") : $("coError");
      var other = upi ? $("coError") : $("coUpiError");
      if (other) other.hidden = true;
      if (!box) return;
      if (!msg) { box.hidden = true; box.textContent = ""; return; }
      box.hidden = false; box.textContent = msg;
    },

    open: function () {
      $("checkout").hidden = false;
      $("coStep1").hidden = false;
      $("coStep2").hidden = true;
      this.error("");
    },
    close: function () {
      $("checkout").hidden = true;
    },

    proceed: function () {
      var self = this;
      var name = ($("coName").value || "").trim();
      var phone = ($("coPhone").value || "").trim();
      var email = ($("coEmail").value || "").trim();
      if (name.length < 2) return this.error("Please tell us your name.");
      if (phone.replace(/\D/g, "").length < 10) return this.error("Enter a valid WhatsApp number.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return this.error("Enter a valid email.");
      this.error("");
      var btn = $("coProceedBtn");
      btn.disabled = true;
      btn.textContent = "Starting payment…";
      fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video",
          theme: theme,
          name: name,
          phone: phone,
          email: email,
          draft: formData()
        })
      })
        .then(readJson)
        .then(function (order) {
          btn.disabled = false;
          btn.textContent = "Proceed to UPI · ₹299";
          if (!order.ok) throw new Error(order.error || "Could not start checkout.");
          if (order.free && order.editUrl) {
            location.href = order.editUrl;
            return;
          }
          self.txnid = order.txnid;
          $("coPayAmount").textContent = "₹" + order.amount;
          if (order.qrDataUrl) $("coQrImg").src = order.qrDataUrl;
          $("coUpiIdText").textContent = order.upiId || "";
          $("coUpiDeepLink").href = order.upiString || "#";
          $("coRefBadge").textContent = "Order " + order.txnid;
          $("coStep1").hidden = true;
          $("coStep2").hidden = false;
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = "Proceed to UPI · ₹299";
          self.error(err.message);
        });
    },

    confirm: function () {
      var self = this;
      var utr = ($("coUtr").value || "").trim();
      if (!self.txnid) return this.error("Start checkout again.", true);
      var btn = $("coConfirmBtn");
      btn.disabled = true;
      btn.textContent = "Checking…";
      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txnid: self.txnid, utr: utr })
      })
        .then(readJson)
        .then(function (res) {
          if (res.ok && res.editUrl) {
            location.href = res.editUrl;
            return;
          }
          if (res.pending) {
            $("coSuccessMsg").hidden = false;
            self.poll(self.txnid);
            return;
          }
          btn.disabled = false;
          btn.textContent = "I’ve paid — Confirm";
          self.error(res.error || "Could not confirm payment.", true);
        })
        .catch(function (err) {
          btn.disabled = false;
          btn.textContent = "I’ve paid — Confirm";
          self.error(err.message, true);
        });
    },

    poll: function (txnid) {
      var self = this;
      if (self.pollTimer) clearInterval(self.pollTimer);
      var tries = 0;
      self.pollTimer = setInterval(function () {
        tries += 1;
        if (tries > 120) { clearInterval(self.pollTimer); return; }
        fetch("/api/order-status?txnid=" + encodeURIComponent(txnid))
          .then(readJson)
          .then(function (res) {
            if (res.ok && res.status === "paid" && res.editUrl) {
              clearInterval(self.pollTimer);
              location.href = res.editUrl;
            }
          })
          .catch(function () {});
      }, 2500);
    }
  };

  window.addEventListener("message", function (e) {
    if (e.data && e.data.type === "utsav-video-ready") {
      frameReady = true;
      pushPreview(true);
    }
  });

  function bind() {
    fields.forEach(function (k) {
      if ($(k)) $(k).addEventListener("input", scheduleSave);
    });
    $("replayBtn").addEventListener("click", function () { pushPreview(true); });
    $("payBtn").addEventListener("click", function () { checkout.open(); });
    $("coClose").addEventListener("click", function () { checkout.close(); });
    $("coBackBtn").addEventListener("click", function () {
      $("coStep2").hidden = true;
      $("coStep1").hidden = false;
    });
    $("coProceedBtn").addEventListener("click", function () { checkout.proceed(); });
    $("coConfirmBtn").addEventListener("click", function () { checkout.confirm(); });
    $("coCopyUpiBtn").addEventListener("click", function () {
      var id = $("coUpiIdText").textContent;
      navigator.clipboard.writeText(id).catch(function () {});
    });
    $("publishBtn").addEventListener("click", function () {
      var slug = ($("slug").value || "").trim();
      if (slug.length < 3) {
        $("slugMsg").textContent = "Use at least 3 letters or numbers.";
        return;
      }
      $("publishBtn").disabled = true;
      saveRemote(true)
        .then(function () { $("publishBtn").disabled = false; })
        .catch(function () { $("publishBtn").disabled = false; });
    });
    $("musicBtn").addEventListener("click", function () { $("musicFile").click(); });
    $("musicFile").addEventListener("change", function () {
      var file = $("musicFile").files && $("musicFile").files[0];
      if (!file) return;
      uploadFile(file, true).then(function (url) {
        draft.musicUrl = url;
        scheduleSave();
        pushPreview(true);
      }).catch(function (err) { $("musicHint").textContent = err.message; });
    });
  }

  function bootCatalog(then) {
    fetch("/api/video-templates")
      .then(readJson)
      .then(function (data) {
        catalog = data && data.templates ? data : catalog;
        tpl = (catalog.templates || []).filter(function (t) { return t.id === theme; })[0] || catalog.templates[0];
        if (tpl) theme = tpl.id;
        then();
      })
      .catch(then);
  }

  function applyTemplateChrome() {
    if (!tpl) return;
    $("crumb").textContent = tpl.category + " · " + tpl.collection;
    $("pageTitle").textContent = tpl.title;
    document.title = "Customize " + tpl.title + " · UtsavLink";
    if (!paid) {
      try {
        var saved = JSON.parse(localStorage.getItem("utsav.video." + theme) || "null");
        fill(Object.assign({}, tpl.defaults || {}, saved || {}));
      } catch (e) {
        fill(tpl.defaults || {});
      }
    }
  }

  function bootPaid() {
    fetch("/api/edit?token=" + encodeURIComponent(token))
      .then(readJson)
      .then(function (res) {
        if (!res.ok) throw new Error(res.error || "This edit link is not valid.");
        var invite = res.invite || {};
        theme = invite.theme || theme;
        tpl = (catalog.templates || []).filter(function (t) { return t.id === theme; })[0] || tpl;
        fill(Object.assign({}, (tpl && tpl.defaults) || {}, invite.data || {}));
        if (invite.slug && $("slug")) $("slug").value = invite.slug;
        applyTemplateChrome();
        setPaidUi();
        loadFrame();
        if (invite.published && invite.slug) showLive(invite.slug);
      })
      .catch(function (err) {
        var note = $("bootErr");
        if (note) {
          note.hidden = false;
          note.textContent = err.message + " — start from the designs page.";
        }
      });
  }

  bind();
  bootCatalog(function () {
    if (token) {
      paid = true;
      bootPaid();
      return;
    }
    applyTemplateChrome();
    $("publishBtn").style.display = "none";
    $("musicBtn").hidden = true;
    loadFrame();
  });
})();
