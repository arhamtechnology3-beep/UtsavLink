const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const crypto = require("crypto");
const QRCode = require("qrcode");

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const UPLOAD_DIR = path.join(ROOT_DIR, "media", "uploads");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const STATIC_UPI_QR_CANDIDATES = [
  path.join(ROOT_DIR, "assets", "upi-qr.png"),
  path.join(ROOT_DIR, "assets", "upi-qr.jpg"),
  path.join(ROOT_DIR, "assets", "upi-qr.jpeg"),
  path.join(ROOT_DIR, "assets", "upi-qr.webp")
];

function findStaticUpiQr() {
  return STATIC_UPI_QR_CANDIDATES.find((p) => fs.existsSync(p)) || null;
}

// Jesal / Navi UPI — override with env if needed
const UPI_ID = process.env.UPI_ID || "9769104020@nyes";
const UPI_NAME = process.env.UPI_NAME || "JESAL UTTAM PANCHAL";
const BASE_PRICE = Number(process.env.BASE_PRICE || 99);
const GST_RATE = 0.18;
const TOTAL_AMOUNT = Math.round(BASE_PRICE * (1 + GST_RATE));
const GST_AMOUNT = TOTAL_AMOUNT - BASE_PRICE;
const VIDEO_TOTAL = Number(process.env.VIDEO_PRICE || 299);
const VIDEO_BASE = Math.round(VIDEO_TOTAL / (1 + GST_RATE));
const VIDEO_GST = VIDEO_TOTAL - VIDEO_BASE;

// free = no payment (unlock immediately)
// auto = unlock after valid UTR (honour-based, no bank check)
// manual = UTR → you confirm in /admin, then customer gets access (recommended with personal UPI)
const PAYMENT_MODE = (process.env.PAYMENT_MODE || "manual").toLowerCase();
const IS_FREE = PAYMENT_MODE === "free";
const ADMIN_KEY = process.env.ADMIN_KEY || "utsav-admin-change-me";
const DEMO_EDIT = process.env.DEMO_EDIT === "1";
// Where YOU get the “someone paid” note (optional)
const OWNER_EMAIL = (process.env.OWNER_EMAIL || "jesalp85@gmail.com").trim();
const OWNER_WHATSAPP = (process.env.OWNER_WHATSAPP || "919769104020").replace(/\D/g, "");
const PUBLIC_BASE = (process.env.PUBLIC_BASE || "http://localhost:3000").replace(/\/$/, "");

const SITE_THEMES = [
  "rajutsav", "fort", "kailash", "deep", "patrika", "darbar", "nilambari",
  "celestial", "lanterns", "grandreveal", "bloom", "sultanemerald",
  "jaipur", "royalmaharashtrian", "cathedral", "voyage", "luminous",
  "heritage", "seaside", "promise"
];
const VIDEO_THEMES = [];
const THEMES = SITE_THEMES;
const VIDEO_CATALOG_FILE = path.join(ROOT_DIR, "v", "templates.json");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

ensureDirs();
const store = loadStore();

function ensureDirs() {
  for (const dir of [DATA_DIR, UPLOAD_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, "utf8"));
      return {
        orders: raw.orders || {},
        invites: raw.invites || {},
        usedUtrs: raw.usedUtrs || {},
        slugs: raw.slugs || {}
      };
    }
  } catch (err) {
    console.error("Failed to load store, starting fresh:", err.message);
  }
  return { orders: {}, invites: {}, usedUtrs: {}, slugs: {} };
}

function saveStore() {
  const tmp = STORE_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, STORE_FILE);
}

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 12_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function isVideoTheme(theme) {
  return VIDEO_THEMES.includes(theme);
}

function normalizeSiteTheme(theme) {
  return SITE_THEMES.includes(theme) ? theme : "fort";
}

function normalizeVideoTheme(theme) {
  if (VIDEO_THEMES.includes(theme)) return theme;
  return VIDEO_THEMES[0] || "";
}

function normalizeTheme(theme) {
  if (isVideoTheme(theme)) return theme;
  return normalizeSiteTheme(theme);
}

function loadVideoCatalog() {
  try {
    return JSON.parse(fs.readFileSync(VIDEO_CATALOG_FILE, "utf8"));
  } catch (err) {
    return { price: VIDEO_TOTAL, templates: [] };
  }
}

function priceForKind(kind) {
  if (IS_FREE) return { amount: 0, basePrice: 0, gst: 0 };
  if (kind === "video") return { amount: VIDEO_TOTAL, basePrice: VIDEO_BASE, gst: VIDEO_GST };
  return { amount: TOTAL_AMOUNT, basePrice: BASE_PRICE, gst: GST_AMOUNT };
}

function normalizeLang(lang) {
  return ["mr", "hi", "en"].includes(lang) ? lang : "mr";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function validUtr(utr) {
  return /^[A-Za-z0-9]{12}$/.test(String(utr || "").trim());
}

function publicInvite(invite) {
  return {
    paid: !!invite.paid,
    kind: invite.kind || (isVideoTheme(invite.theme) ? "video" : "site"),
    theme: invite.theme,
    lang: invite.lang,
    slug: invite.slug,
    published: !!invite.published,
    txnid: invite.txnid,
    paidAt: invite.paidAt || null,
    data: invite.data || {}
  };
}

function getInvite(token) {
  return store.invites[token] || null;
}

function requirePaidInvite(token) {
  if (DEMO_EDIT && token === "demo") {
    if (!store.invites.demo) {
      store.invites.demo = {
        txnid: "demo",
        paid: true,
        theme: "fort",
        lang: "mr",
        slug: "demo-invite",
        published: false,
        paidAt: new Date().toISOString(),
        data: { lang: "mr" }
      };
      saveStore();
    }
    return store.invites.demo;
  }
  const invite = getInvite(token);
  if (!invite) return { error: "This edit link is not valid. Complete payment to get your invite.", status: 404 };
  if (!invite.paid) return { error: "Payment is not confirmed yet. Access opens only after successful payment.", status: 403 };
  return { invite };
}

function sendFile(req, res, filePath, contentType) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const range = req.headers.range;
    if (range && (contentType.startsWith("audio/") || contentType.startsWith("video/"))) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stats.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const noStore = [".html", ".js", ".css"].includes(ext);
    res.writeHead(200, {
      "Content-Length": stats.size,
      "Content-Type": contentType,
      "Cache-Control": noStore ? "no-store" : "public, max-age=3600"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function buildUpiPayload(txnid, amount) {
  const payAmount = amount || TOTAL_AMOUNT;
  // Always generate a clean QR with exact amount — the Navi poster is too busy for checkout
  const upiString = `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${payAmount}&cu=INR&tn=${encodeURIComponent(txnid)}`;
  let qrDataUrl = "";
  try {
      qrDataUrl = await QRCode.toDataURL(upiString, {
        width: 280,
        margin: 2,
        color: { dark: "#9F1239", light: "#FFFFFF" }
      });
  } catch (qrErr) {
    console.error("QR Code generation error:", qrErr);
    const staticPath = findStaticUpiQr();
    if (staticPath) qrDataUrl = "/assets/" + path.basename(staticPath);
  }

  return {
    upiId: UPI_ID,
    upiName: UPI_NAME,
    upiString,
    qrDataUrl,
    amount: payAmount,
    staticQr: false
  };
}

function injectInviteHtml(themeHtml, invitePayload) {
  const boot = `<script>window.__INVITE__=${JSON.stringify(invitePayload).replace(/</g, "\\u003c")};</script>`;
  if (themeHtml.includes("</head>")) return themeHtml.replace("</head>", boot + "\n</head>");
  if (themeHtml.includes("<body>")) return themeHtml.replace("<body>", "<body>\n" + boot);
  return boot + themeHtml;
}

function serveVideoPlayer(req, res, theme, extra) {
  const id = normalizeVideoTheme(theme);
  const playPath = path.join(ROOT_DIR, "v", "play.html");
  if (!fs.existsSync(playPath)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Video player missing");
    return;
  }
  let html = fs.readFileSync(playPath, "utf8");
  const payload = Object.assign({
    slug: "",
    theme: id,
    kind: "video",
    preview: true,
    paid: false,
    data: {}
  }, extra || {});
  html = injectInviteHtml(html, payload);
  html = html.replace('data-theme="aagman"', 'data-theme="' + id + '"');
  if (payload.paid) html = html.replace('class="watermark"', 'class="watermark" hidden');
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

function servePublishedInvite(req, res, slug) {
  const txnid = store.slugs[slug];
  const invite = txnid ? store.invites[txnid] : null;
  if (!invite || !invite.published || !invite.paid) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h1>Invite not found</h1><p>This invitation link is not live yet.</p>");
    return;
  }

  const theme = invite.kind === "video" ? invite.theme : normalizeTheme(invite.theme);
  if (invite.kind === "video" || VIDEO_THEMES.includes(invite.theme)) {
    if (!isVideoTheme(theme)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Invite not found</h1><p>This invitation is no longer available.</p>");
      return;
    }
    return serveVideoPlayer(req, res, theme, {
      slug: invite.slug,
      preview: false,
      paid: true,
      data: invite.data || {}
    });
  }

  const themePath = path.join(ROOT_DIR, "t", theme, "index.html");
  if (!fs.existsSync(themePath)) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Theme missing");
    return;
  }

  let html = fs.readFileSync(themePath, "utf8");
  const payload = {
    slug: invite.slug,
    theme: invite.theme,
    preview: false,
    lang: invite.lang,
    data: invite.data || {}
  };
  html = injectInviteHtml(html, payload);
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(html);
}

async function handleOrder(req, res) {
  try {
    const data = JSON.parse((await readBody(req)) || "{}");
    const kind = data.kind === "video" || isVideoTheme(data.theme) ? "video" : "site";
    const theme = kind === "video" ? normalizeVideoTheme(data.theme) : normalizeSiteTheme(data.theme);
    if (kind === "video" && !theme) {
      json(res, 400, { ok: false, error: "This video design is no longer available." });
      return;
    }
    const pricing = priceForKind(kind);
    const txnid = "UTSAV" + Date.now() + crypto.randomBytes(2).toString("hex");
    const order = {
      txnid,
      kind,
      theme,
      lang: normalizeLang(data.lang),
      name: String(data.name || "Customer").trim().slice(0, 80),
      phone: String(data.phone || "").trim().slice(0, 20),
      email: String(data.email || "").trim().slice(0, 120),
      amount: pricing.amount,
      basePrice: pricing.basePrice,
      gst: pricing.gst,
      paid: false,
      status: "awaiting_payment",
      createdAt: new Date().toISOString(),
      draft: data.draft && typeof data.draft === "object" ? data.draft : null
    };
    store.orders[txnid] = order;
    saveStore();

    if (IS_FREE) {
      unlockInvite(order, "FREE-" + txnid);
      json(res, 200, {
        ok: true,
        free: true,
        txnid,
        amount: 0,
        basePrice: 0,
        gst: 0,
        kind,
        theme: order.theme,
        lang: order.lang,
        editUrl: editUrlFor(txnid, order.theme)
      });
      return;
    }

    const upi = await buildUpiPayload(txnid, pricing.amount);
    json(res, 200, {
      ok: true,
      free: false,
      txnid,
      amount: pricing.amount,
      basePrice: pricing.basePrice,
      gst: pricing.gst,
      kind,
      theme: order.theme,
      lang: order.lang,
      ...upi
    });
  } catch (e) {
    json(res, 400, { ok: false, error: e.message === "Payload too large" ? e.message : "Invalid order request" });
  }
}

async function handleVerify(req, res) {
  try {
    const data = JSON.parse((await readBody(req)) || "{}");
    const txnid = String(data.txnid || "").trim();
    const utr = String(data.utr || "").trim();

    if (!txnid) {
      json(res, 400, { ok: false, error: "Transaction ID missing. Start checkout again." });
      return;
    }

    const order = store.orders[txnid];
    if (!order) {
      json(res, 404, {
        ok: false,
        error: "We could not find this order. Payment was not verified — please try checkout again."
      });
      return;
    }

    if (order.paid && store.invites[txnid]?.paid) {
      json(res, 200, {
        ok: true,
        txnid,
        theme: order.theme,
        editUrl: editUrlFor(txnid, order.theme)
      });
      return;
    }

    if (!validUtr(utr)) {
      json(res, 400, {
        ok: false,
        error: "Enter the exact 12-character UPI Ref / UTR from your payment app (letters/numbers only)."
      });
      return;
    }

    const usedBy = store.usedUtrs[utr.toUpperCase()];
    if (usedBy && usedBy !== txnid) {
      json(res, 409, {
        ok: false,
        error: "This UTR is already used for another order. If money was deducted, contact us with your order ref."
      });
      return;
    }

    if (PAYMENT_MODE === "manual") {
      order.status = "pending_review";
      order.utr = utr;
      order.submittedAt = new Date().toISOString();
      store.orders[txnid] = order;
      saveStore();
      notifyOwnerPending(order).catch(() => {});
      json(res, 200, {
        ok: false,
        pending: true,
        txnid,
        theme: order.theme,
        message: "Payment submitted. We will unlock your invite after confirming the UTR. Keep this page open — it will open the editor automatically once approved.",
        error: "Payment submitted for confirmation. Keep this page open — your editor opens automatically after we approve."
      });
      return;
    }

    unlockInvite(order, utr);
    json(res, 200, {
      ok: true,
      txnid,
      theme: order.theme,
      editUrl: editUrlFor(txnid, order.theme)
    });
  } catch (e) {
    json(res, 400, { ok: false, error: "Payment verification failed. Please try again." });
  }
}

function editUrlFor(txnid, theme) {
  if (isVideoTheme(theme)) {
    return `/video-edit?token=${encodeURIComponent(txnid)}&theme=${encodeURIComponent(theme)}&paid=1`;
  }
  return `/edit?token=${encodeURIComponent(txnid)}&theme=${encodeURIComponent(theme)}&paid=1`;
}

function customerWhatsAppUrl(order, editPath) {
  const phone = String(order.phone || "").replace(/\D/g, "");
  if (phone.length < 10) return null;
  const waPhone = phone.length === 10 ? "91" + phone : phone;
  const full = PUBLIC_BASE + editPath;
  const label = isVideoTheme(order.theme) ? "video invite" : "Ganpati invite";
  const text = `Hi ${order.name || "there"}, your UtsavLink ${label} is unlocked.\n\nOpen your private editor:\n${full}\n\nOrder: ${order.txnid}`;
  return `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`;
}

function ownerAlertText(order) {
  return [
    "UtsavLink — payment to confirm",
    `Name: ${order.name}`,
    `Phone: ${order.phone}`,
    `Email: ${order.email || "-"}`,
    `Amount: ₹${order.amount || TOTAL_AMOUNT}`,
    `UTR: ${order.utr}`,
    `Order: ${order.txnid}`,
    `Theme: ${order.theme}`,
    "",
    `Approve here: ${PUBLIC_BASE}/admin.html?key=${ADMIN_KEY}`
  ].join("\n");
}

async function notifyOwnerPending(order) {
  const text = ownerAlertText(order);
  console.log("\n========== PAYMENT PENDING ==========\n" + text + "\n=====================================\n");

  if (OWNER_EMAIL) {
    try {
      await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(OWNER_EMAIL), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          _subject: `UtsavLink payment pending — ${order.name} — UTR ${order.utr}`,
          message: text,
          name: order.name,
          phone: order.phone,
          email: order.email,
          utr: order.utr,
          txnid: order.txnid,
          amount: order.amount || TOTAL_AMOUNT
        })
      });
    } catch (e) {
      console.warn("Owner email notify failed:", e.message);
    }
  }
}

function handleOrderStatus(req, res, parsedUrl) {
  const txnid = String(parsedUrl.query.txnid || "").trim();
  if (!txnid) {
    json(res, 400, { ok: false, error: "Missing txnid" });
    return;
  }
  const order = store.orders[txnid];
  if (!order) {
    json(res, 404, { ok: false, error: "Order not found" });
    return;
  }
  if (order.paid && store.invites[txnid]?.paid) {
    json(res, 200, {
      ok: true,
      status: "paid",
      editUrl: editUrlFor(txnid, order.theme)
    });
    return;
  }
  json(res, 200, {
    ok: true,
    status: order.status || "awaiting_payment",
    pending: order.status === "pending_review"
  });
}

function unlockInvite(order, utr) {
  const txnid = order.txnid;
  order.paid = true;
  order.status = "paid";
  order.utr = utr;
  order.paidAt = new Date().toISOString();
  if (IS_FREE || String(utr).startsWith("FREE-")) order.free = true;
  store.orders[txnid] = order;

  const utrKey = String(utr || "").toUpperCase();
  if (utrKey && !utrKey.startsWith("FREE-")) {
    store.usedUtrs[utrKey] = txnid;
  }

  const existing = store.invites[txnid];
  const kind = order.kind || (isVideoTheme(order.theme) ? "video" : "site");
  store.invites[txnid] = {
    txnid,
    paid: true,
    free: !!order.free,
    kind,
    theme: order.theme,
    lang: order.lang,
    slug: existing?.slug || "",
    published: !!existing?.published,
    paidAt: order.paidAt,
    data: existing?.data || order.draft || { lang: order.lang },
    name: order.name,
    phone: order.phone,
    email: order.email
  };
  saveStore();
}

async function handleEdit(req, res, parsedUrl) {
  const token = String(parsedUrl.query.token || "").trim();
  if (!token) {
    json(res, 400, { ok: false, error: "Missing edit token." });
    return;
  }

  const gate = requirePaidInvite(token);
  if (gate.error) {
    json(res, gate.status || 403, { ok: false, error: gate.error });
    return;
  }
  const invite = gate.invite;

  if (req.method === "GET") {
    json(res, 200, { ok: true, invite: publicInvite(invite) });
    return;
  }

  if (req.method !== "PUT" && req.method !== "POST") {
    json(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const data = JSON.parse((await readBody(req)) || "{}");

    if (data.data && typeof data.data === "object") {
      invite.data = Object.assign({}, invite.data || {}, data.data);
    }

    if (typeof data.slug === "string") {
      const slug = slugify(data.slug);
      if (slug.length < 3) {
        json(res, 200, {
          ok: false,
          field: "slug",
          error: "Use at least 3 letters or numbers.",
          invite: publicInvite(invite)
        });
        return;
      }
      const owner = store.slugs[slug];
      if (owner && owner !== token) {
        const suggestion = slug + "-" + Math.floor(10 + Math.random() * 89);
        json(res, 200, {
          ok: false,
          field: "slug",
          error: "That link is already taken.",
          suggestion,
          invite: publicInvite(invite)
        });
        return;
      }
      if (invite.slug && store.slugs[invite.slug] === token) delete store.slugs[invite.slug];
      invite.slug = slug;
      store.slugs[slug] = token;
    }

    if (data.publish) {
      if (!invite.slug || invite.slug.length < 3) {
        json(res, 200, {
          ok: false,
          field: "slug",
          error: "Choose your web address before publishing.",
          invite: publicInvite(invite)
        });
        return;
      }
      invite.published = true;
      store.slugs[invite.slug] = token;
    }

    store.invites[token] = invite;
    saveStore();
    json(res, 200, { ok: true, invite: publicInvite(invite) });
  } catch (e) {
    json(res, 400, { ok: false, error: "Invalid payload" });
  }
}

async function handleUpload(req, res, parsedUrl) {
  const token = String(parsedUrl.query.token || "").trim();
  const gate = requirePaidInvite(token);
  if (gate.error) {
    json(res, gate.status || 403, { ok: false, error: gate.error });
    return;
  }

  try {
    const data = JSON.parse((await readBody(req)) || "{}");
    const contentType = String(data.contentType || "image/jpeg");
    let raw = String(data.dataBase64 || "");
    const comma = raw.indexOf(",");
    if (raw.startsWith("data:") && comma !== -1) raw = raw.slice(comma + 1);
    const buf = Buffer.from(raw, "base64");
    if (!buf.length) {
      json(res, 400, { ok: false, error: "Empty upload" });
      return;
    }
    const isAudio = /mpeg|mp3|wav|m4a|mp4/.test(contentType);
    if (buf.length > (isAudio ? 10_500_000 : 5_500_000)) {
      json(res, 413, { ok: false, error: "File too large" });
      return;
    }

    let ext = ".jpg";
    if (contentType.includes("png")) ext = ".png";
    else if (contentType.includes("webp")) ext = ".webp";
    else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = ".mp3";
    else if (contentType.includes("wav")) ext = ".wav";
    else if (contentType.includes("m4a") || contentType.includes("mp4")) ext = ".m4a";

    const dir = path.join(UPLOAD_DIR, token.replace(/[^A-Za-z0-9_-]/g, ""));
    fs.mkdirSync(dir, { recursive: true });
    const filename = Date.now() + "-" + crypto.randomBytes(4).toString("hex") + ext;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buf);
    const publicUrl = "/media/uploads/" + path.basename(dir) + "/" + filename;
    json(res, 200, { ok: true, url: publicUrl });
  } catch (e) {
    json(res, e.message === "Payload too large" ? 413 : 400, {
      ok: false,
      error: e.message === "Payload too large" ? "File too large" : "Upload failed"
    });
  }
}

async function handleAdminApprove(req, res, parsedUrl) {
  const key = String(parsedUrl.query.key || "");
  if (key !== ADMIN_KEY) {
    json(res, 401, { ok: false, error: "Unauthorized" });
    return;
  }
  try {
    const data = JSON.parse((await readBody(req)) || "{}");
    const txnid = String(data.txnid || "").trim();
    const order = store.orders[txnid];
    if (!order) {
      json(res, 404, { ok: false, error: "Order not found" });
      return;
    }
    unlockInvite(order, order.utr || ("ADMIN" + Date.now().toString().slice(-8)));
    const editUrl = editUrlFor(txnid, order.theme);
    json(res, 200, {
      ok: true,
      editUrl,
      customerWhatsApp: customerWhatsAppUrl(order, editUrl),
      name: order.name,
      phone: order.phone
    });
  } catch (e) {
    json(res, 400, { ok: false, error: "Approve failed" });
  }
}

function handleAdminPending(req, res, parsedUrl) {
  const key = String(parsedUrl.query.key || "");
  if (key !== ADMIN_KEY) {
    json(res, 401, { ok: false, error: "Unauthorized" });
    return;
  }
  const pending = Object.values(store.orders)
    .filter((o) => o.status === "pending_review")
    .sort((a, b) => String(b.submittedAt || "").localeCompare(String(a.submittedAt || "")));
  json(res, 200, {
    ok: true,
    pending,
    ownerWhatsApp: OWNER_WHATSAPP
      ? `https://wa.me/${OWNER_WHATSAPP}?text=${encodeURIComponent("Open admin: " + PUBLIC_BASE + "/admin.html?key=" + ADMIN_KEY)}`
      : null
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname || "/";

  try {
    if (pathname === "/api/order" && req.method === "POST") return handleOrder(req, res);
    if (pathname === "/api/verify" && req.method === "POST") return handleVerify(req, res);
    if (pathname === "/api/order-status" && req.method === "GET") return handleOrderStatus(req, res, parsedUrl);
    if (pathname === "/api/edit") return handleEdit(req, res, parsedUrl);
    if (pathname === "/api/upload" && req.method === "POST") return handleUpload(req, res, parsedUrl);
    if (pathname === "/api/admin/approve" && req.method === "POST") return handleAdminApprove(req, res, parsedUrl);
    if (pathname === "/api/admin/pending" && req.method === "GET") return handleAdminPending(req, res, parsedUrl);

    if (pathname === "/api/stats" && req.method === "GET") {
      const published = Object.values(store.invites).filter((i) => i.published).length;
      json(res, 200, { ok: true, total: Math.max(published, 0), week: published });
      return;
    }

    if (pathname === "/api/video-templates" && req.method === "GET") {
      const cat = loadVideoCatalog();
      json(res, 200, {
        ok: true,
        price: VIDEO_TOTAL,
        gstIncluded: true,
        templates: (cat.templates || []).filter((t) => VIDEO_THEMES.includes(t.id))
      });
      return;
    }

    if (pathname === "/api/payment-config" && req.method === "GET") {
      json(res, 200, {
        ok: true,
        free: IS_FREE,
        upiId: UPI_ID,
        upiName: UPI_NAME,
        amount: IS_FREE ? 0 : TOTAL_AMOUNT,
        basePrice: IS_FREE ? 0 : BASE_PRICE,
        gst: IS_FREE ? 0 : GST_AMOUNT,
        videoAmount: IS_FREE ? 0 : VIDEO_TOTAL,
        videoBasePrice: IS_FREE ? 0 : VIDEO_BASE,
        videoGst: IS_FREE ? 0 : VIDEO_GST,
        mode: PAYMENT_MODE,
        hasStaticQr: !!findStaticUpiQr(),
        ownerEmailConfigured: !!OWNER_EMAIL
      });
      return;
    }

    if (pathname === "/admin" || pathname === "/admin/") {
      pathname = "/admin.html";
    }
    if (pathname === "/") pathname = "/index.html";

    if (pathname.startsWith("/i/")) {
      const slug = decodeURIComponent(pathname.slice(3).split("/")[0] || "");
      return servePublishedInvite(req, res, slug);
    }

    const cleanUrlMap = {
      "/terms": "/terms.html",
      "/privacy": "/privacy.html",
      "/refund": "/refund.html",
      "/shipping": "/shipping.html",
      "/contact": "/contact.html",
      "/edit": "/edit.html",
      "/video-invite": "/video-invite.html",
      "/video-edit": "/video-edit.html"
    };

    if (pathname.startsWith("/v/")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length === 2 && VIDEO_THEMES.includes(parts[1])) {
        return serveVideoPlayer(req, res, parts[1], {
          preview: parsedUrl.query.preview === "1" || parsedUrl.query.edit === "1",
          paid: parsedUrl.query.paid === "1"
        });
      }
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>Not found</h1>");
      return;
    }

    let filePath = path.join(ROOT_DIR, pathname);
    if (cleanUrlMap[pathname] || pathname.startsWith("/edit/")) {
      filePath = path.join(ROOT_DIR, pathname.startsWith("/edit/") ? "edit.html" : cleanUrlMap[pathname]);
    } else if (pathname.startsWith("/t/")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length === 2) filePath = path.join(ROOT_DIR, "t", parts[1], "index.html");
    }

    if (!path.extname(filePath) && fs.existsSync(filePath + ".html")) {
      filePath = filePath + ".html";
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        sendFile(req, res, filePath, contentType);
        return;
      }

      if (pathname.startsWith("/assets/")) {
        const altFile = path.join(ROOT_DIR, pathname);
        if (fs.existsSync(altFile)) {
          return sendFile(req, res, altFile, MIME_TYPES[path.extname(altFile).toLowerCase()] || contentType);
        }
        const filename = path.basename(pathname);
        for (const t of THEMES) {
          const themeAsset = path.join(ROOT_DIR, "t", t, "assets", filename);
          if (fs.existsSync(themeAsset)) {
            return sendFile(req, res, themeAsset, MIME_TYPES[path.extname(themeAsset).toLowerCase()] || contentType);
          }
        }
      }

      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<h1>404 Not Found</h1><p>The requested URL was not found on UtsavLink server.</p>");
    });
  } catch (err) {
    console.error(err);
    json(res, 500, { ok: false, error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`UtsavLink server running at http://localhost:${PORT}`);
  console.log(`UtsavLink | mode: ${PAYMENT_MODE}${IS_FREE ? " (no payment)" : ` | UPI: ${UPI_ID} | ₹${TOTAL_AMOUNT}`}`);
  if (PAYMENT_MODE === "manual") {
    console.log(`Admin panel: ${PUBLIC_BASE}/admin.html?key=${ADMIN_KEY}`);
    if (OWNER_EMAIL) console.log(`Owner email alerts: ${OWNER_EMAIL}`);
    else console.log("Tip: set OWNER_EMAIL=you@email.com for payment-pending emails");
  }
  const staticQr = findStaticUpiQr();
  if (staticQr) console.log("Using static UPI QR:", path.relative(ROOT_DIR, staticQr));
});
