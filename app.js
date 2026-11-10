(function () {
  "use strict";

  // ---------- Config ----------
  var CFG = window.ESTANTE_CONFIG || {};
  var BUCKET = CFG.coversBucket || "covers";
  var configured = /^https:\/\/.+/.test(CFG.supabaseUrl || "") && !!CFG.supabaseKey && CFG.supabaseKey.indexOf("PEGA_") !== 0;
  var sb = configured && window.supabase ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey) : null;

  var STATUS = { "por-leer": "Por leer", "leyendo": "Leyendo", "leido": "Leído" };
  var THEMES = [
    { bg: "linear-gradient(165deg,#1E5568,#0A1B26)", ink: "#F4F1E8", hi: "#5CC8F0", motif: "sun" },
    { bg: "linear-gradient(165deg,#7A2229,#2A0A0E)", ink: "#F7EDE3", hi: "#F2B544", motif: "arch" },
    { bg: "linear-gradient(170deg,#EFE6D2,#C8B896)", ink: "#2B2118", hi: "#C23B2E", motif: "band" },
    { bg: "linear-gradient(165deg,#2D3152,#0E0F21)", ink: "#ECEBF5", hi: "#E8615A", motif: "moon" },
    { bg: "linear-gradient(165deg,#3E4C2B,#141A0D)", ink: "#F1F0E2", hi: "#E9C46A", motif: "hills" },
    { bg: "linear-gradient(170deg,#DCE6EA,#A9BEC7)", ink: "#132530", hi: "#1C6E90", motif: "diamond" },
    { bg: "linear-gradient(165deg,#4C2A55,#160A1A)", ink: "#F3E9F5", hi: "#5CC8F0", motif: "frame" },
    { bg: "linear-gradient(165deg,#1A1A1A,#2E2E2E)", ink: "#FFFFFF", hi: "#F2B544", motif: "moon" },
    { bg: "linear-gradient(165deg,#8A4B1E,#2B1406)", ink: "#FBEFD9", hi: "#FFD27A", motif: "sun" },
    { bg: "linear-gradient(170deg,#E8D9D4,#C39E94)", ink: "#2A1714", hi: "#7A2229", motif: "arch" }
  ];
  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  // Iconos dibujados (un solo trazo de 1.8–2px) en lugar de emojis o símbolos de texto.
  var ICON_PATHS = {
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.6Z" fill="currentColor"/>',
    play: '<path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/>',
    pencil: '<path d="M4.5 19.5l1-4.2L15.8 5a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.7 18.5l-4.2 1Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" fill="none"/><path d="M13.8 7l3.2 3.2" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" stroke-width="1.8" fill="none"/>',
    chevronDown: '<path d="M6.5 9.5L12 15l5.5-5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    chevronUp: '<path d="M6.5 14.5L12 9l5.5 5.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>',
    plus: '<path d="M12 5.5v13M5.5 12h13" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>',
    quill: '<path d="M19.5 4.5c-6.2.4-10.6 4.6-11.9 11.3L6 19.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M19.5 4.5c.2 5.2-3 9.6-9.4 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M19.5 4.5L10 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON_PATHS[name] + "</svg>";
  }
  function plural(n, one, many) { return n === 1 ? one : many; }

  var S = {
    books: [], reviews: [], profiles: {},
    uid: null, loaded: false, loadError: false,
    q: "", expanded: {},
    openId: null, confirmDelete: false, audioEditing: false,
    draft: { rating: 0, text: "" },
    form: { editingId: null, file: null, previewUrl: null, removeCover: false },
    nameAsked: false,
    authReady: false,
    activity: {}, streakMissing: false,
    myBooks: [], myBooksLoaded: false, myBooksMissing: false,
    notes: {}, notesMissing: false, notesBookId: null,
    busy: false
  };

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function nowIso() { return new Date().toISOString(); }
  function fmtDate(ms) {
    if (!ms) return "";
    try { return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; }
  }
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3400);
  }
  function must(res) { if (res.error) throw res.error; return res.data; }
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
  }

  // ---------- Rows from the database ----------
  function mapBook(r) {
    return {
      id: r.id,
      title: r.title || "",
      author: r.author || "",
      genre: r.genre || "",
      year: r.year || "",
      pages: r.pages || null,
      status: r.status,
      currentPage: r.current_page || 0,
      unit: r.progress_unit === "capitulos" ? "capitulos" : "paginas",
      chapters: r.chapters || null,
      currentChapter: r.current_chapter || 0,
      startedAt: r.started_at ? Date.parse(r.started_at) : 0,
      finishedAt: r.finished_at ? Date.parse(r.finished_at) : 0,
      audioUrl: r.audio_url || "",
      coverPath: r.cover_path || "",
      addedBy: r.added_by || null,
      createdAt: r.created_at ? Date.parse(r.created_at) : 0
    };
  }
  function mapReview(r) {
    return { bookId: r.book_id, uid: r.user_id, rating: r.rating || 0, text: r.body || "", updatedAt: r.updated_at ? Date.parse(r.updated_at) : 0 };
  }
  function coverUrl(path) { return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl; }

  // ---------- People ----------
  function nameOf(uid) {
    if (uid && uid === S.uid) return "Tú";
    return (uid && S.profiles[uid]) || "Alguien";
  }
  function avatarHtml(uid) {
    var name = (uid && S.profiles[uid]) || "?";
    var initials = name.trim().split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join("") || "?";
    var hue = hash(uid || "x") % 360;
    return '<span class="avatar" aria-hidden="true" style="background:hsl(' + hue + ' 65% 68%)">' + esc(initials) + "</span>";
  }

  // ---------- Audio links ----------
  function normalizeUrl(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    try {
      var u = new URL(s);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      if (u.hostname.indexOf(".") === -1) return null;
      return u.href;
    } catch (e) { return null; }
  }
  function audioHost(url) {
    try {
      var h = new URL(url).hostname.replace(/^www\./, "");
      if (/(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(h)) return h.indexOf("music.") === 0 ? "YouTube Music" : "YouTube";
      if (/spotify\.com$/.test(h)) return "Spotify";
      if (/ivoox\.com$/.test(h)) return "iVoox";
      if (/soundcloud\.com$/.test(h)) return "SoundCloud";
      if (/audible\./.test(h)) return "Audible";
      if (/storytel\./.test(h)) return "Storytel";
      if (/archive\.org$/.test(h)) return "Internet Archive";
      return h;
    } catch (e) { return "enlace"; }
  }
  function audioLink(b, cls, inner) {
    return '<a class="' + cls + '" href="' + esc(b.audioUrl) + '" target="_blank" rel="noopener noreferrer" aria-label="Escuchar audiolibro de ' + esc(b.title) + " en " + esc(audioHost(b.audioUrl)) + '">' + inner + "</a>";
  }

  // ---------- Derived ----------
  function findBook(id) { for (var i = 0; i < S.books.length; i++) if (S.books[i].id === id) return S.books[i]; return null; }
  function callNumber(id) {
    var list = S.books.slice().sort(function (a, b) { return a.createdAt - b.createdAt; });
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return "Nº " + String(i + 1).padStart(3, "0");
    return "";
  }
  function reviewsFor(bookId) {
    return S.reviews.filter(function (r) { return r.bookId === bookId && (r.rating || r.text); })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }
  function myReview(bookId) {
    for (var i = 0; i < S.reviews.length; i++) if (S.reviews[i].bookId === bookId && S.reviews[i].uid === S.uid) return S.reviews[i];
    return null;
  }
  function avgRating(bookId) {
    var rs = reviewsFor(bookId).filter(function (r) { return r.rating > 0; });
    return rs.length ? rs.reduce(function (s, r) { return s + r.rating; }, 0) / rs.length : 0;
  }
  // El avance se mide en páginas o en capítulos, según el libro.
  function byChapters(b) { return b.unit === "capitulos"; }
  function progTotal(b) { return (byChapters(b) ? b.chapters : b.pages) || 0; }
  function progCurrent(b) { return byChapters(b) ? b.currentChapter : b.currentPage; }
  function pct(b) {
    var t = progTotal(b);
    return t ? Math.max(0, Math.min(100, Math.round((progCurrent(b) / t) * 100))) : 0;
  }
  function progLabel(b) {
    var t = progTotal(b), c = progCurrent(b);
    var head = byChapters(b) ? "Capítulo " + c : "Página " + c;
    return t ? head + " de " + t + " · " + pct(b) + "%" : head;
  }

  // ---------- Pieces ----------
  function starsHtml(v, num) {
    var full = Math.round(v), s = '<span class="stars" role="img" aria-label="' + (v ? v.toFixed(1) + " de 5 estrellas" : "Sin calificar") + '">';
    for (var i = 1; i <= 5; i++) s += icon("star", i <= full ? "" : "off");
    if (num && v) s += '<span class="num">' + v.toFixed(1) + "</span>";
    return s + "</span>";
  }
  function themeOf(b) { return THEMES[hash((b.title || "") + "|" + (b.author || "")) % THEMES.length]; }
  function titleHtml(title) {
    var words = String(title || "Sin título").trim().split(/\s+/);
    if (words.length < 2) return esc(words[0]);
    var last = words.pop();
    return esc(words.join(" ")) + ' <span class="hi">' + esc(last) + "</span>";
  }
  function coverHtml(b, opts) {
    opts = opts || {};
    var th = themeOf(b);
    var style = "--th-bg:" + th.bg + ";--th-ink:" + th.ink + ";--th-hi:" + th.hi;
    var imgSrc = opts.previewUrl || (b.coverPath ? coverUrl(b.coverPath) : "");
    var long = String(b.title || "").length > 34 ? " long" : "";
    var h = '<div class="cover" style="' + style + '">' +
      '<div class="motif m-' + th.motif + '"></div>' +
      '<div class="ctitle' + long + '">' + titleHtml(b.title) + "</div>" +
      (b.author ? '<div class="cauthor">' + esc(b.author) + "</div>" : "");
    if (imgSrc) h += '<img class="cover-img" alt="" loading="lazy" src="' + esc(imgSrc) + '">';
    if (opts.progress && b.status === "leyendo" && progTotal(b)) h += '<div class="cprog"><span style="width:' + pct(b) + '%"></span></div>';
    return h + "</div>";
  }
  function cardHtml(b) {
    var avg = avgRating(b.id), line3 = [];
    if (b.year) line3.push(esc(b.year));
    if (b.status === "leyendo" && progTotal(b)) line3.push(byChapters(b) ? "Cap. " + b.currentChapter + "/" + b.chapters : pct(b) + "% leído");
    return '<article class="card">' +
      '<div class="cover-wrap"><button class="cover-btn" type="button" data-open="' + esc(b.id) + '" aria-label="Abrir ' + esc(b.title) + '">' + coverHtml(b, { progress: true }) + "</button>" +
      (b.audioUrl ? audioLink(b, "audio-badge", SPEAKER) : "") + "</div>" +
      '<div class="cmeta">' +
      '<span class="au" title="' + esc(b.author || b.title) + '">' + esc(b.author || b.title) + "</span>" +
      '<span class="ge">' + esc(b.genre || STATUS[b.status] || "") + "</span>" +
      '<span class="yr">' + (line3.length ? "<span>" + line3.join(" · ") + "</span>" : "") + (avg ? starsHtml(avg, false) : "") + "</span>" +
      "</div></article>";
  }

  // ---------- Render ----------
  function renderAuth() {
    var el = $("authArea");
    if (!sb) { el.innerHTML = ""; return; }
    if (S.uid) {
      el.innerHTML = '<button class="btn" type="button" data-action="profile" aria-label="Tu perfil">' + avatarHtml(S.uid) +
        "<span>" + esc(S.profiles[S.uid] || "Tu perfil") + "</span></button>";
      el.firstChild.style.padding = "4px 14px 4px 4px";
    } else {
      el.innerHTML = S.authReady ? '<button class="btn" type="button" data-action="login">Entrar</button>' : "";
    }
    $("addBtn").hidden = !S.uid;
    $("q").hidden = !S.uid;
  }

  function renderStats() {
    var c = { "por-leer": 0, "leyendo": 0, "leido": 0 }, pages = 0, audio = 0, ratings = [];
    S.books.forEach(function (b) {
      if (c[b.status] != null) c[b.status]++;
      if (b.status === "leido") pages += Number(b.pages) || 0;
      if (b.status === "leyendo") {
        pages += byChapters(b) ? Math.round((Number(b.pages) || 0) * pct(b) / 100) : Number(b.currentPage) || 0;
      }
      if (b.audioUrl) audio++;
      var a = avgRating(b.id); if (a) ratings.push(a);
    });
    if (!S.books.length) { $("stats").innerHTML = ""; return; }
    var avg = ratings.length ? ratings.reduce(function (s, x) { return s + x; }, 0) / ratings.length : 0;
    $("stats").innerHTML =
      '<span class="pill"><b>' + c["leido"] + "</b> " + plural(c["leido"], "leído", "leídos") + "</span>" +
      '<span class="pill"><b>' + c["leyendo"] + "</b> leyendo</span>" +
      '<span class="pill"><b>' + c["por-leer"] + "</b> por leer</span>" +
      '<span class="pill"><b>' + pages.toLocaleString("es") + "</b> " + plural(pages, "página leída", "páginas leídas") + "</span>" +
      '<span class="pill"><b>' + audio + "</b> " + plural(audio, "audiolibro", "audiolibros") + "</span>" +
      '<span class="pill"><b class="g">' + icon("star") + (avg ? avg.toFixed(1) : "—") + "</b> nota media</span>";
  }

  // El libro en curso más reciente se destaca arriba; las filas no lo repiten.
  function spotBook() {
    if (S.q.trim()) return null;
    var reading = S.books.filter(function (b) { return b.status === "leyendo"; })
      .sort(function (a, b) { return b.startedAt - a.startedAt; });
    return reading[0] || null;
  }
  function renderSpot() {
    var el = $("spot");
    var b = spotBook();
    if (!b) { el.hidden = true; el.innerHTML = ""; return; }
    var th = themeOf(b);
    var bg = b.coverPath ? "background-image:url('" + esc(coverUrl(b.coverPath)) + "')" : "background:" + th.bg;
    el.hidden = false;
    el.innerHTML = '<div class="row-head"><h2>Continuar leyendo</h2></div>' +
      '<div class="spot"><div class="spot-bg" style="' + bg + '"></div><div class="spot-in">' +
      '<button class="cover-btn" type="button" data-open="' + esc(b.id) + '" aria-label="Abrir ' + esc(b.title) + '">' + coverHtml(b) + "</button>" +
      "<div>" +
      "<h3>" + esc(b.title) + "</h3>" +
      '<p class="by">' + esc(b.author || "Autor desconocido") + (b.genre ? ' · <span style="color:var(--cyan)">' + esc(b.genre) + "</span>" : "") + "</p>" +
      (progTotal(b) ? '<div class="bar"><span style="width:' + pct(b) + '%"></span></div><p class="pg">' + progLabel(b) + "</p>"
        : '<p class="pg">' + (progCurrent(b) ? progLabel(b) : "Marca tu avance desde la ficha del libro.") + "</p>") +
      '<div class="actions">' +
      (b.audioUrl ? audioLink(b, "btn gold", '<span style="width:18px;height:18px;display:inline-grid">' + SPEAKER + "</span>" +
        '<span class="lbl-long">Escuchar en ' + esc(audioHost(b.audioUrl)) + '</span><span class="lbl-short">Escuchar</span>') : "") +
      '<button class="btn" type="button" data-open="' + esc(b.id) + '">Abrir ficha</button>' +
      "</div></div></div></div>";
  }

  function rowHtml(key, title, list) {
    if (!list.length) return "";
    var open = !!S.expanded[key];
    var more = list.length > 6
      ? '<button class="more" type="button" data-expand="' + key + '" aria-expanded="' + open + '">' + (open ? "Ver menos" : "Ver " + (list.length - 6) + " más") + icon(open ? "chevronUp" : "chevronDown") + "</button>"
      : "";
    return '<section><div class="row-head"><h2>' + title + '<span class="c">' + list.length + "</span></h2>" + more + "</div>" +
      '<div class="' + (open ? "grid" : "scroller") + '">' + list.map(cardHtml).join("") + "</div></section>";
  }

  function renderRows() {
    var el = $("rows");
    if (!sb) {
      el.innerHTML = '<div class="empty"><h2>Falta conectar la base de datos</h2><p>Escribe la Project URL y la clave publishable de Supabase en <b>config.js</b> y vuelve a cargar la página.</p></div>';
      return;
    }
    if (!S.authReady) { el.innerHTML = '<p class="notice">Cargando…</p>'; return; }
    if (!S.uid) {
      el.innerHTML = '<div class="empty welcome"><div class="ghosts" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        "<h2>Tu estante personal de lecturas</h2>" +
        "<p>Registra los libros que lees, tu avance por páginas o capítulos, tus audiolibros, notas y reseñas. Cada cuenta tiene su propio estante y nadie más lo ve.</p>" +
        '<div class="actions" style="justify-content:center">' +
        '<button class="btn primary" type="button" data-action="signup">Crear cuenta gratis</button>' +
        '<button class="btn" type="button" data-action="login">Ya tengo cuenta</button></div></div>';
      return;
    }
    if (S.loadError && !S.books.length) {
      el.innerHTML = '<div class="empty"><h2>No se pudo abrir tu estante</h2><p>Revisa tu conexión y vuelve a cargar la página. Tus libros guardados siguen ahí.</p></div>';
      return;
    }
    if (!S.loaded) { el.innerHTML = '<p class="notice">Cargando tu estante…</p>'; return; }
    if (!S.books.length) {
      el.innerHTML = '<div class="empty"><div class="ghosts" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        "<h2>Tu estante está vacío</h2>" +
        "<p>Agrega el primer libro: puedes subir su portada, pegar la playlist del audiolibro y, cuando lo termines, dejar tu reseña.</p>" +
        '<button class="btn primary" type="button" data-action="add">' + icon("plus") + "Agregar el primer libro</button></div>";
      return;
    }
    var q = S.q.trim().toLowerCase();
    if (q) {
      var found = S.books.filter(function (b) {
        return (b.title + " " + b.author + " " + b.genre).toLowerCase().indexOf(q) !== -1;
      });
      el.innerHTML = found.length
        ? '<section><div class="row-head"><h2>Resultados<span class="c">' + found.length + '</span></h2></div><div class="grid">' + found.map(cardHtml).join("") + "</div></section>"
        : '<p class="notice">Ningún libro coincide con «' + esc(S.q.trim()) + "».</p>";
      return;
    }
    var by = function (st) { return S.books.filter(function (b) { return b.status === st; }); };
    var recent = function (a, b) { return b.createdAt - a.createdAt; };
    var spot = spotBook();
    var alsoReading = by("leyendo").filter(function (b) { return !spot || b.id !== spot.id; })
      .sort(function (a, b) { return b.startedAt - a.startedAt; });
    el.innerHTML =
      rowHtml("leyendo", "También leyendo", alsoReading) +
      rowHtml("audio", "Audiolibros", S.books.filter(function (b) { return b.audioUrl; }).sort(recent)) +
      rowHtml("por-leer", "Por leer", by("por-leer").sort(recent)) +
      rowHtml("leido", "Leídos", by("leido").sort(function (a, b) { return b.finishedAt - a.finishedAt; }));
  }

  function renderAll() {
    renderAuth();
    renderStats();
    renderSpot();
    renderRows();
    renderStreak();
    renderMyBookCard();
    if (S.openId) renderDetail();
  }

  // ---------- Detail ----------
  function renderDetail() {
    var b = findBook(S.openId);
    if (!b) { closeDetail(); return; }
    var facts = [["Catálogo", callNumber(b.id)]];
    if (b.year) facts.push(["Año", esc(b.year)]);
    if (b.pages) facts.push(["Páginas", esc(b.pages)]);
    if (b.chapters) facts.push(["Capítulos", esc(b.chapters)]);
    if (b.startedAt) facts.push(["Empezado", fmtDate(b.startedAt)]);
    if (b.finishedAt && b.status === "leido") facts.push(["Terminado", fmtDate(b.finishedAt)]);
    var avg = avgRating(b.id);
    $("dHead").innerHTML = '<div class="d-head">' + coverHtml(b) + "<div>" +
      '<h2 id="dTitle">' + esc(b.title) + "</h2>" +
      '<p class="by">' + esc(b.author || "Autor desconocido") + "</p>" +
      (b.genre ? '<p class="ge">' + esc(b.genre) + "</p>" : '<div style="height:10px"></div>') +
      (avg ? '<div style="margin-bottom:12px">' + starsHtml(avg, true) + "</div>" : "") +
      '<dl class="facts">' + facts.map(function (f) { return "<dt>" + f[0] + "</dt><dd>" + f[1] + "</dd>"; }).join("") + "</dl>" +
      "</div></div>";

    var dis = S.uid && !S.busy ? "" : " disabled";
    var st = '<h3>Estado</h3><div class="seg" role="group" aria-label="Estado de lectura">' +
      ["por-leer", "leyendo", "leido"].map(function (k) {
        return '<button type="button" data-status="' + k + '" aria-pressed="' + (b.status === k) + '"' + dis + ">" + STATUS[k] + "</button>";
      }).join("") + "</div>";
    if (b.status === "leyendo") {
      var total = progTotal(b), ch = byChapters(b);
      st += '<div class="page-row"><label for="dUnit">Avance por</label>' +
        '<select id="dUnit"' + dis + '><option value="paginas"' + (ch ? "" : " selected") + '>páginas</option><option value="capitulos"' + (ch ? " selected" : "") + ">capítulos</option></select></div>" +
        '<div class="page-row"><label for="dPage">' + (ch ? "Voy en el capítulo" : "Voy en la página") + "</label>" +
        '<input id="dPage" type="number" min="0" max="' + (total || (ch ? 2000 : 20000)) + '" value="' + progCurrent(b) + '"' + dis + ">" +
        (total ? "<span>de " + total + " · " + pct(b) + "%</span>" : "") + "</div>" +
        (total ? '<div class="pbar"><span style="width:' + pct(b) + '%"></span></div>'
          : '<div class="page-row"><label for="dTotal">' + (ch ? "¿Cuántos capítulos tiene el libro?" : "¿Cuántas páginas tiene el libro?") + "</label>" +
            '<input id="dTotal" type="number" min="1" max="' + (ch ? 2000 : 20000) + '" placeholder="' + (ch ? "Ej. 24" : "Ej. 320") + '"' + dis + "></div>" +
            '<p class="small">Con el total se calcula el porcentaje y la barra de avance.</p>');
    }
    $("dStatus").innerHTML = st;

    var m = "";
    if (S.uid) {
      m = S.confirmDelete
        ? '<div class="confirm"><span>¿Eliminar «' + esc(b.title) + '» del estante? Esto no se puede deshacer.</span>' +
          '<button class="btn danger solid" type="button" data-action="delete-yes"' + dis + ">Sí, eliminar</button>" +
          '<button class="btn" type="button" data-action="delete-no">Cancelar</button></div>'
        : '<div class="actions"><button class="btn" type="button" data-action="edit">Editar libro y portada</button>' +
          '<button class="btn danger" type="button" data-action="delete-ask">Eliminar del estante</button></div>';
    }
    $("dManage").innerHTML = m;
    renderNotesSection();
  }

  // ---------- Notas privadas (cuaderno por libro) ----------
  function notesTableMissing(e) {
    var code = e && e.code, msg = String((e && e.message) || "");
    return code === "42P01" || code === "PGRST205" || /book_notes.*(does not exist|not find)|Could not find the table/i.test(msg);
  }
  function loadNotes() {
    if (!sb || !S.uid) return;
    var uid = S.uid;
    sb.from("book_notes").select("book_id,body,updated_at").then(function (res) {
      if (uid !== S.uid) return;
      if (res.error) { S.notesMissing = notesTableMissing(res.error); if (S.openId) renderNotesSection(); return; }
      S.notesMissing = false;
      var map = {};
      res.data.forEach(function (n) { map[n.book_id] = { body: n.body || "", updatedAt: Date.parse(n.updated_at) || 0 }; });
      // No pisar lo que se está escribiendo en este momento.
      if (notesDirty && S.notesBookId && S.notes[S.notesBookId]) map[S.notesBookId] = S.notes[S.notesBookId];
      S.notes = map;
      if (S.openId) renderNotesSection();
    });
  }
  function renderNotesSection() {
    var el = $("dNotes");
    if (!el || !S.openId) return;
    var h = '<h3>Mis notas<span class="lock">' + icon("lock") + "solo tú las ves</span></h3>";
    if (!S.uid) {
      el.innerHTML = h + '<div class="actions"><button class="btn" type="button" data-action="login">Inicia sesión para escribir tus notas</button></div>';
      return;
    }
    if (S.notesMissing) {
      el.innerHTML = h + '<p class="notice">Las notas están casi listas: falta ejecutar la migración 004 en Supabase.</p>';
      return;
    }
    var n = S.notes[S.openId], body = n && n.body.trim();
    el.innerHTML = h + (body
      ? '<div class="note-card">' + esc(body.slice(0, 600)) + "</div>" +
        '<div class="actions"><button class="btn primary" type="button" data-action="notes-open">' + icon("pencil") + "Abrir mis notas</button>" +
        '<span class="small">Editadas el ' + fmtDate(n.updatedAt) + "</span></div>"
      : '<p class="notice">Un cuaderno para este libro: ideas, frases que te marcaron, preguntas o reflexiones mientras lees.</p>' +
        '<div class="actions"><button class="btn primary" type="button" data-action="notes-open">' + icon("pencil") + "Empezar a escribir</button></div>");
  }

  var notesTimer = null, notesDirty = false, notesSaving = false;
  function nbStatus(text, kind) {
    var s = $("nbStatus");
    s.textContent = text;
    s.className = "nb-status" + (kind ? " " + kind : "");
  }
  function openNotes(bookId) {
    if (!S.uid) { openLogin("login"); return; }
    var b = findBook(bookId);
    if (!b) return;
    S.notesBookId = bookId;
    notesDirty = false;
    $("nbBook").textContent = b.title + (b.author ? " · " + b.author : "");
    var n = S.notes[bookId];
    $("nbText").value = n ? n.body : "";
    nbStatus(n && n.updatedAt ? "Guardado el " + fmtDate(n.updatedAt) : "", null);
    $("notesLayer").hidden = false;
    updateNbStreak();
    var ta = $("nbText");
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
    // Traer la versión más reciente por si se editó en otro dispositivo.
    sb.from("book_notes").select("body,updated_at").eq("book_id", bookId).eq("user_id", S.uid).maybeSingle().then(function (res) {
      if (res.error) { if (notesTableMissing(res.error)) { S.notesMissing = true; nbStatus("Falta activar las notas en la base de datos (migración 004).", "error"); } return; }
      if (!res.data || notesDirty || S.notesBookId !== bookId) return;
      S.notes[bookId] = { body: res.data.body || "", updatedAt: Date.parse(res.data.updated_at) || 0 };
      if ($("nbText").value !== S.notes[bookId].body) $("nbText").value = S.notes[bookId].body;
    });
  }
  function saveNotes() {
    clearTimeout(notesTimer);
    if (!notesDirty || notesSaving || !S.notesBookId || !S.uid) return Promise.resolve();
    var bookId = S.notesBookId, body = $("nbText").value;
    notesSaving = true;
    notesDirty = false;
    nbStatus("Guardando…", null);
    return sb.from("book_notes")
      .upsert({ book_id: bookId, user_id: S.uid, body: body, updated_at: nowIso() }, { onConflict: "book_id,user_id" })
      .then(function (res) {
        notesSaving = false;
        if (res.error) throw res.error;
        S.notesMissing = false;
        var prevLen = noteLen((S.notes[bookId] && S.notes[bookId].body) || "");
        S.notes[bookId] = { body: body, updatedAt: Date.now() };
        recordActivity(bookId, prevLen, noteLen(body));
        if (notesDirty) { notesTimer = setTimeout(saveNotes, 900); nbStatus("Escribiendo…", null); }
        else nbStatus("Guardado ✓", "saved");
        updateNbStreak();
        if (S.openId === bookId) renderNotesSection();
      })
      .catch(function (e) {
        notesSaving = false;
        notesDirty = true;
        console.error("Error al guardar notas:", e);
        if (notesTableMissing(e)) { S.notesMissing = true; nbStatus("Falta activar las notas en la base de datos (migración 004).", "error"); return; }
        nbStatus("Sin conexión: se reintentará en unos segundos.", "error");
        notesTimer = setTimeout(saveNotes, 5000);
      });
  }
  function closeNotes() {
    saveNotes();
    $("notesLayer").hidden = true;
    if (notesDirty) toast("Tus últimas notas aún no se guardaron. Se reintentará al volver a abrirlas.");
  }
  function insertAtCursor(text, cursorOffset) {
    var ta = $("nbText"), start = ta.selectionStart, end = ta.selectionEnd, v = ta.value;
    var before = v.slice(0, start), after = v.slice(end);
    var pre = before && !/\n$/.test(before) ? "\n" : "";
    ta.value = before + pre + text + after;
    var pos = (before + pre).length + (cursorOffset == null ? text.length : cursorOffset);
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  $("nbText").addEventListener("input", function () {
    notesDirty = true;
    nbStatus("Escribiendo…", null);
    updateNbStreak();
    clearTimeout(notesTimer);
    notesTimer = setTimeout(saveNotes, 900);
  });
  $("nbSave").addEventListener("click", function () {
    if (!notesDirty && !notesSaving) { nbStatus("Guardado ✓", "saved"); updateNbStreak(); return; }
    saveNotes();
  });

  // ---------- Racha de escritura ----------
  // Un día cuenta cuando, sumando todos los libros, se escribieron y guardaron
  // al menos STREAK_GOAL caracteres nuevos en las notas (sin espacios ni marcas de avance).
  var STREAK_GOAL = 100;
  var FLAME = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.3 2.6c.5 3.1-1.4 4.8-2.9 6.5C8 10.7 7 12.3 7 14.6a5 5 0 0 0 10 0c0-2.2-.9-3.7-2.1-4.9.2 1.6-.5 2.7-1.4 3.2.4-3.6-1-7.6-1.2-10.3Z" fill="currentColor"/></svg>';
  var CHECK = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.5l4 4 9-9.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

  function noteLen(text) { return String(text || "").replace(/^— .* —$/gm, "").replace(/\s/g, "").length; }
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function todayKey() { return ymd(new Date()); }
  function dayShift(key, n) {
    var p = key.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]);
    d.setDate(d.getDate() + n);
    return ymd(d);
  }
  function dayTotal(key, exceptBook) {
    var day = S.activity[key], t = 0;
    if (!day) return 0;
    Object.keys(day).forEach(function (b) { if (b !== exceptBook) t += Math.max(0, day[b].best - day[b].baseline); });
    return t;
  }
  function streakInfo() {
    var today = todayKey(), doneToday = dayTotal(today) >= STREAK_GOAL;
    // Si hoy todavía no se escribió, la racha sigue viva hasta medianoche contando desde ayer.
    var current = 0, k = doneToday ? today : dayShift(today, -1);
    while (dayTotal(k) >= STREAK_GOAL) { current++; k = dayShift(k, -1); }
    var best = 0, run = 0, last = null;
    Object.keys(S.activity).sort().forEach(function (key) {
      if (dayTotal(key) < STREAK_GOAL) return;
      run = last && dayShift(last, 1) === key ? run + 1 : 1;
      last = key;
      if (run > best) best = run;
    });
    return { current: current, best: Math.max(best, current), doneToday: doneToday, todayChars: dayTotal(today) };
  }
  function tableMissing(e, table) {
    var code = e && e.code, msg = String((e && e.message) || "");
    return code === "42P01" || code === "PGRST205" || msg.indexOf(table) !== -1 && /does not exist|not find/i.test(msg);
  }

  function loadActivity() {
    if (!sb || !S.uid) return;
    var uid = S.uid;
    sb.from("note_activity").select("day,book_id,baseline_len,best_len").order("day", { ascending: false }).limit(3000).then(function (res) {
      if (uid !== S.uid) return;
      if (res.error) { S.streakMissing = tableMissing(res.error, "note_activity"); renderStreak(); return; }
      var a = {};
      res.data.forEach(function (r) { (a[r.day] = a[r.day] || {})[r.book_id] = { baseline: r.baseline_len, best: r.best_len }; });
      S.activity = a;
      S.streakMissing = false;
      renderStreak();
    });
  }

  var activityChain = Promise.resolve();
  function recordActivity(bookId, prevLen, newLen) {
    if (S.streakMissing || !S.uid) return;
    var day = todayKey(), before = streakInfo();
    var dayMap = S.activity[day] = S.activity[day] || {};
    var row = dayMap[bookId] || (dayMap[bookId] = { baseline: prevLen, best: prevLen });
    if (newLen <= row.best) return;
    row.best = newLen;
    var after = streakInfo();
    renderStreak();
    if (!before.doneToday && after.doneToday) {
      toast(after.current === 1 ? "¡Racha encendida! Mañana escribe otros 100 caracteres para seguir."
        : "¡Racha de " + after.current + " días! Sigue así.");
    }
    var payload = { user_id: S.uid, day: day, book_id: bookId, baseline_len: row.baseline, best_len: row.best, updated_at: nowIso() };
    activityChain = activityChain.then(function () {
      return sb.from("note_activity").upsert(payload, { onConflict: "user_id,day,book_id" }).then(function (res) {
        if (!res.error) return;
        console.error("Error al guardar la racha:", res.error);
        if (tableMissing(res.error, "note_activity")) { S.streakMissing = true; renderStreak(); }
      });
    });
  }

  function renderStreak() {
    var chip = $("streakChip"), nudge = $("streakNudge");
    if (!S.uid || !S.loaded || S.streakMissing) { chip.hidden = true; nudge.hidden = true; return; }
    var s = streakInfo();
    chip.hidden = false;
    chip.className = "streak-chip" + (s.doneToday ? " done" : s.current ? " pending" : "");
    chip.innerHTML = FLAME + "<b>" + s.current + "</b>" + plural(s.current, "día", "días");
    chip.setAttribute("aria-label", "Tu racha: " + s.current + " " + plural(s.current, "día", "días") +
      (s.doneToday ? ". Hoy ya cuenta." : ". Falta escribir hoy."));

    if (s.doneToday || !S.books.length) {
      nudge.hidden = true;
    } else {
      var left = STREAK_GOAL - s.todayChars;
      nudge.hidden = false;
      nudge.innerHTML = '<div class="nudge-text">' + FLAME + "<p>" +
        (s.current
          ? "<b>Tu racha de " + s.current + " " + plural(s.current, "día", "días") + " sigue viva.</b> Escribe hoy " + left + " caracteres más en tus notas sobre lo que leíste y guarda para no perderla."
          : "<b>¿Quieres una racha?</b> Escribe al menos " + STREAK_GOAL + " caracteres en las notas de un libro sobre lo que leíste y guarda. Mañana, otros " + STREAK_GOAL + ".") +
        "</p></div>" +
        '<div class="nudge-progress"><span>Hoy: ' + s.todayChars + "/" + STREAK_GOAL + " caracteres</span>" +
        '<div class="pbar flame"><span style="width:' + Math.min(100, Math.round(s.todayChars / STREAK_GOAL * 100)) + '%"></span></div></div>' +
        '<button class="btn primary" type="button" data-action="nudge-notes">' + icon("pencil") + "Escribir en mis notas</button>";
    }
    if (!$("streakLayer").hidden) renderStreakPanel();
  }

  function renderStreakPanel() {
    var s = streakInfo(), today = todayKey(), days = "";
    for (var i = 6; i >= 0; i--) {
      var key = dayShift(today, -i), on = dayTotal(key) >= STREAK_GOAL;
      var p = key.split("-"), name = new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("es", { weekday: "short" }).replace(".", "");
      days += '<div class="d' + (i === 0 ? " today" : "") + '"><span class="dot' + (on ? " on" : "") + '">' + (on ? CHECK : "") + "</span>" + esc(i === 0 ? "hoy" : name) + "</div>";
    }
    $("streakBody").innerHTML =
      '<div class="streak-hero' + (s.doneToday || s.current ? " on" : "") + '">' + FLAME +
      '<div><div class="big">' + s.current + '</div><div class="lbl">' + plural(s.current, "día seguido", "días seguidos") + "</div></div></div>" +
      '<p class="lede">' + (s.doneToday ? "Hoy ya cuenta para tu racha. Vuelve mañana y escribe otros " + STREAK_GOAL + " caracteres."
        : s.current ? "Hoy llevas " + s.todayChars + "/" + STREAK_GOAL + " caracteres. Escribe y guarda antes de medianoche para no perder tu racha."
        : "Hoy llevas " + s.todayChars + "/" + STREAK_GOAL + " caracteres. Llega a " + STREAK_GOAL + " y guarda para encender tu racha.") + "</p>" +
      '<div class="pbar flame"><span style="width:' + Math.min(100, Math.round(s.todayChars / STREAK_GOAL * 100)) + '%"></span></div>' +
      "<h3>Últimos 7 días</h3>" + '<div class="week">' + days + "</div>" +
      '<p class="small">Mejor racha: <b>' + s.best + " " + plural(s.best, "día", "días") + "</b></p>" +
      "<h3>Cómo funciona</h3>" +
      '<ol class="rules"><li>Abre las notas de cualquier libro y escribe lo que leíste, lo que pensaste o lo que quieres recordar.</li>' +
      "<li>Cada día necesitas <b>" + STREAK_GOAL + " caracteres nuevos</b> guardados. Puede ser en el mismo cuaderno o repartido entre varios libros.</li>" +
      "<li>Los espacios y las marcas de avance no cuentan, y borrar y volver a escribir lo mismo no suma dos veces.</li>" +
      "<li>Si un día no escribes, la racha vuelve a cero.</li></ol>" +
      (S.books.length ? '<div class="actions"><button class="btn primary" type="button" data-action="nudge-notes">' + icon("pencil") + "Escribir en mis notas</button></div>" : "");
  }
  function openStreak() { $("streakLayer").hidden = false; renderStreakPanel(); }
  function closeStreak() { $("streakLayer").hidden = true; }

  // El libro más a mano para escribir: el que se está leyendo, o el último agregado.
  function bookForNotes() {
    var b = spotBook();
    if (b) return b.id;
    var list = S.books.slice().sort(function (a, c) { return c.createdAt - a.createdAt; });
    return list.length ? list[0].id : null;
  }

  // ---------- Mi libro: escritura propia (independiente de la racha) ----------
  var W = { id: null, dirty: false, saving: false, timer: null, confirmDelete: false };

  function wordCount(t) { t = String(t || "").trim(); return t ? t.split(/\s+/).length : 0; }
  function myBookTitle(m) { return (m && m.title) || "Sin título"; }

  function loadMyBooks() {
    if (!sb || !S.uid) return;
    var uid = S.uid;
    sb.from("my_books").select("id,title,word_count,updated_at").order("updated_at", { ascending: false }).then(function (res) {
      if (uid !== S.uid) return;
      S.myBooksLoaded = true;
      if (res.error) { S.myBooksMissing = tableMissing(res.error, "my_books"); S.myBooks = []; renderMyBookCard(); return; }
      S.myBooksMissing = false;
      S.myBooks = res.data.map(function (r) { return { id: r.id, title: r.title || "", words: r.word_count || 0, updatedAt: Date.parse(r.updated_at) || 0 }; });
      renderMyBookCard();
    });
  }

  function renderMyBookCard() {
    var el = $("myBookCard");
    if (!S.uid || !S.loaded || !S.myBooksLoaded || S.q.trim()) { el.hidden = true; return; }
    el.hidden = false;
    var h = '<div class="row-head"><h2>Mi libro</h2></div>';
    if (S.myBooksMissing) {
      el.innerHTML = h + '<div class="mybook"><p class="notice">Para empezar a escribir tu libro falta activar esta función en la base de datos (migración 007).</p></div>';
      return;
    }
    if (!S.myBooks.length) {
      el.innerHTML = h + '<div class="mybook">' + icon("quill") +
        '<div class="mybook-text"><h3>¿Tienes una historia en mente?</h3>' +
        "<p>Escribe tu propio libro a tu ritmo, en tus ratos libres. Es tu espacio privado y se guarda solo mientras escribes.</p></div>" +
        '<button class="btn primary" type="button" data-action="write-new">' + icon("pencil") + "Empezar a escribir</button></div>";
      return;
    }
    var latest = S.myBooks[0];
    el.innerHTML = h + '<div class="mybook">' + icon("quill") +
      '<div class="mybook-text"><h3>' + esc(myBookTitle(latest)) + "</h3>" +
      "<p>" + latest.words.toLocaleString("es") + " " + plural(latest.words, "palabra", "palabras") + " · editado el " + fmtDate(latest.updatedAt) + "</p>" +
      (S.myBooks.length > 1 ? '<div class="mybook-others">' + S.myBooks.slice(1).map(function (m) {
        return '<button class="link" type="button" data-write="' + esc(m.id) + '">' + esc(myBookTitle(m)) + "</button>";
      }).join("") + "</div>" : "") +
      "</div>" +
      '<div class="actions"><button class="btn primary" type="button" data-write="' + esc(latest.id) + '">' + icon("pencil") + "Seguir escribiendo</button>" +
      '<button class="btn" type="button" data-action="write-new">' + icon("plus") + "Nuevo libro</button></div></div>";
  }

  function wStatus(text, kind) { var s = $("wStatus"); s.textContent = text; s.className = "nb-status" + (kind ? " " + kind : ""); }
  function autoGrow() { var ta = $("wBody"); ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px"; }
  function renderWriteMeta() {
    var body = $("wBody").value, words = wordCount(body);
    $("wCount").textContent = words.toLocaleString("es") + " " + plural(words, "palabra", "palabras") + " · " +
      body.length.toLocaleString("es") + " " + plural(body.length, "carácter", "caracteres");
  }
  function renderWritePick() {
    var pick = $("wPick");
    var list = S.myBooks.slice();
    if (!W.id) list.unshift({ id: "", title: "Nuevo libro (sin guardar)" });
    pick.hidden = list.length < 2;
    pick.innerHTML = list.map(function (m) {
      return '<option value="' + esc(m.id) + '"' + (m.id === (W.id || "") ? " selected" : "") + ">" + esc(m.id ? myBookTitle(m) : m.title) + "</option>";
    }).join("");
  }
  function renderWriteDanger() {
    var el = $("wDanger");
    if (!W.id) { el.innerHTML = ""; return; }
    el.innerHTML = W.confirmDelete
      ? '<div class="confirm"><span>¿Eliminar «' + esc($("wTitle").value.trim() || "Sin título") + '» y todo su texto? No se puede deshacer.</span>' +
        '<button class="btn danger solid" type="button" data-action="write-delete-yes">Sí, eliminar</button>' +
        '<button class="btn" type="button" data-action="write-delete-no">Cancelar</button></div>'
      : '<button class="link" type="button" data-action="write-delete-ask">Eliminar este libro</button>';
  }

  function openWrite(id) {
    if (!S.uid) { openLogin("login"); return; }
    W.id = id || null; W.dirty = false; W.confirmDelete = false;
    clearTimeout(W.timer);
    $("wTitle").value = "";
    $("wBody").value = "";
    $("writeLayer").hidden = false;
    $("writeLayer").scrollTop = 0;
    document.body.style.overflow = "hidden";
    renderWritePick(); renderWriteMeta(); renderWriteDanger(); autoGrow();
    if (!id) { wStatus("Libro nuevo: empieza por el título o directamente por el texto.", null); $("wTitle").focus(); return; }
    wStatus("Abriendo…", null);
    sb.from("my_books").select("title,body,updated_at").eq("id", id).maybeSingle().then(function (res) {
      if (W.id !== id || W.dirty) return;
      if (res.error || !res.data) { wStatus("No se pudo abrir este libro. Revisa tu conexión y vuelve a intentarlo.", "error"); return; }
      $("wTitle").value = res.data.title || "";
      $("wBody").value = res.data.body || "";
      wStatus("Guardado el " + fmtDate(Date.parse(res.data.updated_at)), null);
      renderWriteMeta(); renderWriteDanger(); autoGrow();
      var ta = $("wBody");
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }

  function saveWrite() {
    clearTimeout(W.timer);
    if (!W.dirty || W.saving || !S.uid) return Promise.resolve();
    var title = $("wTitle").value.trim().slice(0, 200), body = $("wBody").value;
    if (!W.id && !title && !body.trim()) { W.dirty = false; wStatus("", null); return Promise.resolve(); }
    var row = { title: title, body: body, word_count: wordCount(body), updated_at: nowIso() };
    var wasNew = !W.id;
    W.saving = true;
    W.dirty = false;
    wStatus("Guardando…", null);
    var q = W.id
      ? sb.from("my_books").update(row).eq("id", W.id).select("id").single()
      : sb.from("my_books").insert(Object.assign({ user_id: S.uid }, row)).select("id").single();
    return q.then(function (res) {
      W.saving = false;
      if (res.error) throw res.error;
      W.id = res.data.id;
      S.myBooksMissing = false;
      S.myBooks = S.myBooks.filter(function (m) { return m.id !== W.id; });
      S.myBooks.unshift({ id: W.id, title: title, words: row.word_count, updatedAt: Date.now() });
      if (W.dirty) { W.timer = setTimeout(saveWrite, 1200); wStatus("Escribiendo…", null); }
      else wStatus("Guardado ✓", "saved");
      if (wasNew) { renderWritePick(); renderWriteDanger(); }
      renderMyBookCard();
    }).catch(function (e) {
      W.saving = false;
      W.dirty = true;
      console.error("Error al guardar Mi libro:", e);
      if (tableMissing(e, "my_books")) { S.myBooksMissing = true; wStatus("Falta activar «Mi libro» en la base de datos (migración 007).", "error"); return; }
      wStatus("Sin conexión: se reintentará en unos segundos.", "error");
      W.timer = setTimeout(saveWrite, 5000);
    });
  }

  function closeWrite() {
    saveWrite();
    $("writeLayer").hidden = true;
    document.body.style.overflow = "";
    if (W.dirty) toast("Lo último que escribiste aún no se guardó. Se reintentará al volver a abrir tu libro.");
  }

  function deleteWrite() {
    var id = W.id;
    if (!id) return;
    clearTimeout(W.timer);
    W.dirty = false;
    sb.from("my_books").delete().eq("id", id).then(function (res) {
      if (res.error) { console.error(res.error); toast("No se pudo eliminar. Revisa tu conexión e inténtalo otra vez."); return; }
      S.myBooks = S.myBooks.filter(function (m) { return m.id !== id; });
      W.id = null;
      $("writeLayer").hidden = true;
      document.body.style.overflow = "";
      renderMyBookCard();
      toast("Libro eliminado.");
    });
  }

  function onWriteInput() {
    W.dirty = true;
    W.confirmDelete = false;
    wStatus("Escribiendo…", null);
    renderWriteMeta();
    clearTimeout(W.timer);
    W.timer = setTimeout(saveWrite, 1200);
  }
  $("wTitle").addEventListener("input", onWriteInput);
  $("wBody").addEventListener("input", function () { autoGrow(); onWriteInput(); });
  $("wSave").addEventListener("click", function () {
    if (!W.dirty && !W.saving) { wStatus(W.id ? "Guardado ✓" : "Escribe algo para guardar.", W.id ? "saved" : null); return; }
    saveWrite();
  });
  $("wNew").addEventListener("click", function () { saveWrite().then(function () { openWrite(null); }); });
  $("wPick").addEventListener("change", function (e) {
    var id = e.target.value;
    saveWrite().then(function () { openWrite(id || null); });
  });
  window.addEventListener("resize", function () { if (!$("writeLayer").hidden) autoGrow(); });

  function updateNbStreak() {
    var el = $("nbStreak");
    if (!el) return;
    if (S.streakMissing || !S.notesBookId) { el.innerHTML = ""; return; }
    var day = todayKey(), bookId = S.notesBookId;
    var row = S.activity[day] && S.activity[day][bookId];
    var baseline = row ? row.baseline : noteLen((S.notes[bookId] && S.notes[bookId].body) || "");
    var best = row ? row.best : baseline;
    var live = Math.max(0, Math.max(best, noteLen($("nbText").value)) - baseline);
    var total = dayTotal(day, bookId) + live;
    if (dayTotal(day) >= STREAK_GOAL) { el.className = "nb-streak done"; el.innerHTML = FLAME + "Racha de hoy encendida. ¡Bien hecho!"; }
    else if (total >= STREAK_GOAL) { el.className = "nb-streak ready"; el.innerHTML = FLAME + "¡Llegaste a " + STREAK_GOAL + "! Pulsa Guardar para encender tu racha."; }
    else { el.className = "nb-streak"; el.innerHTML = FLAME + "Hoy: " + total + "/" + STREAK_GOAL + " caracteres para tu racha"; }
  }
  $("nbMark").addEventListener("click", function () {
    var b = findBook(S.notesBookId);
    var parts = [];
    if (b && b.status === "leyendo" && progCurrent(b)) parts.push(byChapters(b) ? "Capítulo " + b.currentChapter : "Página " + b.currentPage);
    parts.push(fmtDate(Date.now()));
    insertAtCursor("— " + parts.join(" · ") + " —\n");
  });
  $("nbQuote").addEventListener("click", function () { insertAtCursor("❝ \n", 2); });
  window.addEventListener("beforeunload", function (e) {
    if (notesDirty || notesSaving) { saveNotes(); e.preventDefault(); e.returnValue = ""; }
    if (W.dirty || W.saving) { saveWrite(); e.preventDefault(); e.returnValue = ""; }
  });

  function renderAudio() {
    var b = findBook(S.openId);
    if (!b) return;
    var h = "<h3>Audiolibro</h3>";
    if (b.audioUrl && !S.audioEditing) {
      h += '<div class="audio-box"><div class="ic">' + SPEAKER + "</div><div>" +
        '<div class="t">Playlist en ' + esc(audioHost(b.audioUrl)) + "</div>" +
        '<div class="host" title="' + esc(b.audioUrl) + '">' + esc(b.audioUrl.replace(/^https?:\/\/(www\.)?/, "")) + "</div></div></div>" +
        '<div class="actions">' + audioLink(b, "btn gold", icon("play") + "Escuchar ahora") +
        (S.uid ? '<button class="btn" type="button" data-action="audio-edit">Cambiar enlace</button>' : "") + "</div>";
    } else if (S.uid) {
      h += '<div class="field"><label for="dAudioUrl">Pega aquí el enlace de la playlist</label>' +
        '<input id="dAudioUrl" type="url" maxlength="600" placeholder="https://www.youtube.com/playlist?list=…" value="' + esc(b.audioUrl) + '" autocomplete="off">' +
        '<span class="hint">Se abrirá en una pestaña nueva al tocar el parlante del libro.</span></div>' +
        '<div class="actions"><button class="btn primary" type="button" data-action="audio-save"' + (S.busy ? " disabled" : "") + ">Guardar enlace</button>" +
        (b.audioUrl ? '<button class="btn danger" type="button" data-action="audio-remove"' + (S.busy ? " disabled" : "") + ">Quitar audiolibro</button>" : "") +
        (S.audioEditing ? '<button class="btn" type="button" data-action="audio-cancel">Cancelar</button>' : "") + "</div>";
    } else {
      h += '<p class="notice">Este libro todavía no tiene audiolibro.</p>';
    }
    $("dAudio").innerHTML = h;
  }

  function renderMine() {
    var el = $("dMine");
    if (!S.uid) {
      el.innerHTML = '<div class="actions"><button class="btn" type="button" data-action="login">Inicia sesión para dejar tu reseña</button></div>';
      return;
    }
    var d = S.draft, mine = myReview(S.openId), picker = "";
    for (var i = 1; i <= 5; i++) {
      picker += '<button type="button" data-rate="' + i + '" class="' + (i <= d.rating ? "" : "off") + '" aria-label="' + i + (i === 1 ? " estrella" : " estrellas") + '" aria-pressed="' + (i === d.rating) + '">' + icon("star") + "</button>";
    }
    el.innerHTML = '<div class="mine">' +
      (mine && mine.updatedAt ? '<span class="small">Guardada el ' + fmtDate(mine.updatedAt) + "</span>" : "") +
      '<div class="picker" role="group" aria-label="Tu calificación">' + picker + "</div>" +
      '<div class="field"><label for="dReview">Qué te pareció</label>' +
      '<textarea id="dReview" maxlength="4000" placeholder="Lo que más te gustó, lo que no, a quién se lo recomendarías…">' + esc(d.text) + "</textarea></div>" +
      '<div class="actions"><button class="btn primary" type="button" data-action="save-review"' + (S.busy ? " disabled" : "") + ">Guardar reseña</button>" +
      (mine ? '<button class="btn danger" type="button" data-action="remove-review"' + (S.busy ? " disabled" : "") + ">Borrar mi reseña</button>" : "") +
      "</div></div>";
  }

  function openDetail(id) {
    S.openId = id; S.confirmDelete = false; S.audioEditing = false;
    var mine = myReview(id);
    S.draft = { rating: (mine && mine.rating) || 0, text: (mine && mine.text) || "" };
    $("detailLayer").hidden = false;
    renderDetail(); renderAudio(); renderMine();
    var x = document.querySelector("#detailLayer .x"); if (x) x.focus();
  }
  function closeDetail() { S.openId = null; S.confirmDelete = false; S.audioEditing = false; $("detailLayer").hidden = true; }

  // ---------- Loading + realtime ----------
  // Cada cuenta carga solo su propio estante; sin sesión no se pide nada.
  function clearShelf() {
    S.books = []; S.reviews = []; S.profiles = {}; S.notes = {}; S.activity = {};
    S.myBooks = []; S.myBooksLoaded = false;
    S.loaded = false; S.loadError = false;
  }
  function loadAll() {
    if (!sb || !S.uid) { clearShelf(); renderAll(); return Promise.resolve(); }
    var uid = S.uid;
    return Promise.all([
      sb.from("books").select("*").eq("added_by", uid),
      sb.from("reviews").select("*").eq("user_id", uid),
      sb.from("profiles").select("id,name").eq("id", uid)
    ]).then(function (r) {
      if (uid !== S.uid) return;
      S.books = must(r[0]).map(mapBook);
      S.reviews = must(r[1]).map(mapReview);
      var p = {}; must(r[2]).forEach(function (x) { p[x.id] = x.name; });
      S.profiles = p;
      S.loaded = true; S.loadError = false;
      renderAll();
      maybeAskName();
      loadNotes();
      loadActivity();
      loadMyBooks();
    }).catch(function (e) {
      if (uid !== S.uid) return;
      console.error("Error al cargar el estante:", e);
      S.loaded = true; S.loadError = true;
      renderAll();
    });
  }
  var reloadTimer = null;
  function scheduleReload() { if (!S.uid) return; clearTimeout(reloadTimer); reloadTimer = setTimeout(loadAll, 250); }

  // ---------- Writes ----------
  function writeFailed(e) {
    console.error("Error al guardar:", e);
    var code = e && (e.code || e.statusCode || e.status);
    var msg = String((e && e.message) || "");
    if (code === "42703" || code === "PGRST204" || /column .* does not exist|Could not find the .* column/i.test(msg)) {
      toast("Falta actualizar la base de datos para usar capítulos (migración 003 en Supabase).");
    } else if (code === "42501" || code === 401 || code === 403 || code === "401" || code === "403" || /row-level security|JWT/i.test(msg)) {
      toast("Tu sesión no tiene permiso para este cambio. Vuelve a iniciar sesión.");
    } else if (code === 413 || code === "413" || /too large|exceeded the maximum/i.test(msg)) {
      toast("La imagen es demasiado grande. Prueba con otra más liviana.");
    } else if (e && e.unsupported) {
      toast("Ese archivo no es una imagen compatible. Usa JPG, PNG o WebP.");
    } else {
      toast("No se pudo guardar. Revisa tu conexión e inténtalo otra vez.");
    }
  }
  function run(fn) {
    if (S.busy || !sb) return Promise.resolve();
    if (!S.uid) { openLogin(); return Promise.resolve(); }
    S.busy = true;
    if (S.openId) { renderDetail(); renderAudio(); renderMine(); }
    return Promise.resolve().then(fn).then(loadAll).catch(writeFailed).then(function () {
      S.busy = false;
      if (S.openId) { renderDetail(); renderAudio(); renderMine(); }
    });
  }
  function updateBook(id, patch) { return sb.from("books").update(patch).eq("id", id).then(must); }

  function setStatus(id, status) {
    var b = findBook(id);
    if (!b || b.status === status) return;
    var now = nowIso(), patch = { status: status };
    if (status === "leyendo" && !b.startedAt) patch.started_at = now;
    if (status === "leido") {
      if (!b.startedAt) patch.started_at = now;
      patch.finished_at = now;
      if (b.pages) patch.current_page = Number(b.pages);
      if (b.chapters) patch.current_chapter = Number(b.chapters);
    } else patch.finished_at = null;
    if (status === "por-leer") {
      patch.started_at = null; patch.current_page = 0;
      if (b.currentChapter) patch.current_chapter = 0;
    }
    run(function () { return updateBook(id, patch); });
  }
  function setProgress(id, value) {
    var b = findBook(id);
    if (!b) return;
    var total = progTotal(b);
    var n = Math.max(0, Math.floor(Number(value) || 0));
    if (total) n = Math.min(n, total);
    if (n === progCurrent(b)) return;
    run(function () {
      var patch = {};
      patch[byChapters(b) ? "current_chapter" : "current_page"] = n;
      if (total && n >= total) { patch.status = "leido"; patch.finished_at = nowIso(); }
      return updateBook(id, patch).then(function () { if (patch.status) toast("¡Terminado! Lo moví a Leídos."); });
    });
  }
  function setTotal(id, value) {
    var b = findBook(id);
    var n = Math.floor(Number(value) || 0);
    if (!b || n < 1) return;
    var ch = byChapters(b);
    n = Math.min(n, ch ? 2000 : 20000);
    var patch = {};
    patch[ch ? "chapters" : "pages"] = n;
    if (progCurrent(b) > n) patch[ch ? "current_chapter" : "current_page"] = n;
    run(function () {
      return updateBook(id, patch).then(function () { toast(ch ? "Total de capítulos guardado." : "Total de páginas guardado."); });
    });
  }
  function setUnit(id, unit) {
    var b = findBook(id);
    if (!b || b.unit === unit) return;
    run(function () { return updateBook(id, { progress_unit: unit }); });
  }
  function saveAudio(remove) {
    var id = S.openId, url = "";
    if (!remove) {
      var inp = $("dAudioUrl");
      url = normalizeUrl(inp ? inp.value : "");
      if (url === null) { toast("Ese enlace no parece válido. Cópialo completo desde la barra del navegador."); return; }
      if (!url) { toast("Pega el enlace de la playlist primero."); return; }
    }
    run(function () {
      return updateBook(id, { audio_url: remove ? null : url }).then(function () {
        S.audioEditing = false;
        toast(remove ? "Audiolibro quitado." : "Audiolibro guardado. Toca el parlante para escucharlo.");
      });
    });
  }
  function saveReview() {
    var ta = $("dReview"); if (ta) S.draft.text = ta.value;
    var text = S.draft.text.trim();
    if (!S.draft.rating && !text) { toast("Elige estrellas o escribe algo antes de guardar."); return; }
    var row = { book_id: S.openId, user_id: S.uid, rating: S.draft.rating, body: text, updated_at: nowIso() };
    run(function () {
      return sb.from("reviews").upsert(row, { onConflict: "book_id,user_id" }).then(must).then(function () { toast("Reseña guardada."); });
    });
  }
  function removeReview() {
    var bookId = S.openId;
    run(function () {
      return sb.from("reviews").delete().eq("book_id", bookId).eq("user_id", S.uid).then(must).then(function () {
        S.draft = { rating: 0, text: "" };
        toast("Reseña borrada.");
      });
    });
  }
  function removeCoverFile(path) {
    if (path) sb.storage.from(BUCKET).remove([path]).then(function () {}, function () {});
  }
  function deleteBook() {
    var id = S.openId, b = findBook(id), cover = b && b.coverPath;
    run(function () {
      return sb.from("books").delete().eq("id", id).then(must).then(function () {
        closeDetail();
        removeCoverFile(cover);
        toast("Libro eliminado del estante.");
      });
    });
  }

  // ---------- Images ----------
  function resizeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 640, s = Math.min(1, max / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * s));
        c.height = Math.max(1, Math.round(img.naturalHeight * s));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (blob) { blob ? resolve(blob) : reject({ unsupported: true }); }, "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject({ unsupported: true }); };
      img.src = url;
    });
  }
  function uploadCover(file) {
    return resizeImage(file).then(function (blob) {
      var path = newId() + ".jpg";
      return sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false })
        .then(must).then(function () { return path; });
    });
  }
  document.addEventListener("error", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("cover-img")) t.classList.add("broken");
  }, true);

  // ---------- Book form ----------
  function formBook() {
    var f = S.form, b = f.editingId ? findBook(f.editingId) : null;
    return {
      id: f.editingId || "preview",
      title: $("fBookTitle").value.trim() || (b ? b.title : "Tu libro"),
      author: $("fAuthor").value.trim(),
      coverPath: f.removeCover ? "" : (b ? b.coverPath : "")
    };
  }
  function renderCoverPreview() {
    var f = S.form, pb = formBook();
    $("fCoverPreview").innerHTML = coverHtml(pb, { previewUrl: f.file ? f.previewUrl : null });
    $("fCoverRemove").hidden = !(f.file || pb.coverPath);
  }
  function resetForm() {
    if (S.form.previewUrl) URL.revokeObjectURL(S.form.previewUrl);
    S.form = { editingId: null, file: null, previewUrl: null, removeCover: false };
  }
  function openForm(editId) {
    if (!S.uid) { openLogin(); return; }
    var b = editId ? findBook(editId) : null;
    resetForm();
    S.form.editingId = editId || null;
    $("fTitle").textContent = b ? "Editar libro" : "Agregar libro";
    $("fSubmit").textContent = b ? "Guardar cambios" : "Guardar en el estante";
    $("fBookTitle").value = b ? b.title : "";
    $("fAuthor").value = b ? b.author : "";
    $("fGenre").value = b ? b.genre : "";
    $("fYear").value = b ? b.year : "";
    $("fPages").value = b && b.pages ? b.pages : "";
    $("fChapters").value = b && b.chapters ? b.chapters : "";
    $("fUnit").value = b ? b.unit : "paginas";
    $("fAudio").value = b ? b.audioUrl : "";
    $("fStatus").value = b ? b.status : "por-leer";
    $("fStatusField").hidden = !!b;
    $("fCover").value = "";
    $("fError").hidden = true;
    $("formLayer").hidden = false;
    renderCoverPreview();
    $("fBookTitle").focus();
  }
  function closeForm() { resetForm(); $("formLayer").hidden = true; }

  $("fCover").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast("Elige una imagen (JPG, PNG o WebP)."); return; }
    if (S.form.previewUrl) URL.revokeObjectURL(S.form.previewUrl);
    S.form.file = file; S.form.previewUrl = URL.createObjectURL(file); S.form.removeCover = false;
    renderCoverPreview();
  });
  $("fCoverRemove").addEventListener("click", function () {
    if (S.form.previewUrl) URL.revokeObjectURL(S.form.previewUrl);
    S.form.file = null; S.form.previewUrl = null; S.form.removeCover = true;
    $("fCover").value = "";
    renderCoverPreview();
  });
  ["fBookTitle", "fAuthor"].forEach(function (id) { $(id).addEventListener("input", renderCoverPreview); });

  function formError(msg, focusId) { $("fError").textContent = msg; $("fError").hidden = false; if (focusId) $(focusId).focus(); }

  $("bookForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var title = $("fBookTitle").value.trim();
    if (!title) { formError("Escribe el título del libro.", "fBookTitle"); return; }
    var audio = normalizeUrl($("fAudio").value);
    if (audio === null) { formError("El enlace del audiolibro no parece válido. Cópialo completo desde el navegador.", "fAudio"); return; }
    var pages = Math.floor(Number($("fPages").value)) || null;
    var row = {
      title: title,
      author: $("fAuthor").value.trim() || null,
      genre: $("fGenre").value.trim() || null,
      year: $("fYear").value.trim() || null,
      pages: pages,
      audio_url: audio || null
    };
    var chapters = Math.floor(Number($("fChapters").value)) || null;
    var unit = $("fUnit").value === "capitulos" ? "capitulos" : "paginas";
    var f = S.form, editId = f.editingId, old = editId ? findBook(editId) : null;
    var oldCover = old && old.coverPath;
    // Las columnas de capítulos solo se envían cuando se usan, así el formulario
    // sigue funcionando en una base de datos sin la migración 003.
    if (chapters || unit === "capitulos" || (old && (old.chapters || old.unit === "capitulos"))) {
      row.chapters = chapters;
      row.progress_unit = unit;
    }
    var file = f.file, removeCover = f.removeCover;
    run(function () {
      return (file ? uploadCover(file) : Promise.resolve(null)).then(function (newPath) {
        if (newPath) row.cover_path = newPath;
        else if (removeCover) row.cover_path = null;
        if (editId) {
          return updateBook(editId, row).then(function () {
            if (oldCover && (newPath || removeCover)) removeCoverFile(oldCover);
            closeForm(); toast("Cambios guardados.");
          });
        }
        var status = $("fStatus").value, now = nowIso();
        row.status = status;
        row.added_by = S.uid;
        row.current_page = status === "leido" && pages ? pages : 0;
        if (status === "leido" && chapters) row.current_chapter = chapters;
        row.started_at = status === "por-leer" ? null : now;
        row.finished_at = status === "leido" ? now : null;
        return sb.from("books").insert(row).then(must).then(function () {
          closeForm(); toast("«" + title + "» está en el estante.");
        });
      });
    });
  });

  // ---------- Entrar / crear cuenta / recuperar contraseña ----------
  var AUTH_MODES = {
    login: { title: "Iniciar sesión", lede: "Entra para ver tu estante: tus libros, tu avance, tus notas y tus reseñas.", submit: "Entrar", name: false, email: true, pass: true, tabs: true },
    signup: { title: "Crear cuenta", lede: "Crea tu cuenta gratis y arma tu propio estante. Solo tú ves tus libros, tu avance y tus notas.", submit: "Crear cuenta", name: true, email: true, pass: true, tabs: true },
    reset: { title: "Recuperar contraseña", lede: "Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.", submit: "Enviar enlace", name: false, email: true, pass: false, tabs: false },
    newpass: { title: "Nueva contraseña", lede: "Escribe la contraseña nueva para tu cuenta.", submit: "Guardar contraseña", name: false, email: false, pass: true, tabs: false }
  };
  var authMode = "login";

  function authMsg(kind, text) {
    $("lError").hidden = kind !== "err";
    $("lOk").hidden = kind !== "ok";
    if (kind === "err") $("lError").textContent = text;
    if (kind === "ok") $("lOk").textContent = text;
  }
  function setAuthMode(mode) {
    var m = AUTH_MODES[mode];
    authMode = mode;
    $("lTitle").textContent = m.title;
    $("lLede").textContent = m.lede;
    $("lSubmit").textContent = m.submit;
    $("lNameField").hidden = !m.name;
    $("lEmailField").hidden = !m.email;
    $("lPassField").hidden = !m.pass;
    $("authTabs").hidden = !m.tabs;
    var isNew = mode === "signup" || mode === "newpass";
    $("lPass").setAttribute("autocomplete", isNew ? "new-password" : "current-password");
    $("lPassLabel").textContent = mode === "newpass" ? "Contraseña nueva" : "Contraseña";
    $("lPassHint").hidden = !isNew;
    $("lForgot").hidden = mode !== "login";
    $("lBack").hidden = mode !== "reset";
    document.querySelectorAll("#authTabs [data-auth-mode]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-auth-mode") === mode));
    });
    authMsg(null);
    var first = m.name ? "lName" : (m.email ? "lEmail" : "lPass");
    if (!$("loginLayer").hidden) $(first).focus();
  }
  function openLogin(mode) {
    if (!sb) return;
    $("loginLayer").hidden = false;
    setAuthMode(mode || "login");
  }
  function closeLogin() { $("loginLayer").hidden = true; $("lPass").value = ""; }

  function authError(err) {
    var msg = String((err && err.message) || "");
    if (/already registered|already exists/i.test(msg)) return "Ese correo ya tiene una cuenta. Usa la pestaña Entrar.";
    if (/signups? not allowed|signup.*disabled/i.test(msg)) return "Los registros nuevos están cerrados por ahora.";
    if (/password.*(6|short|least)/i.test(msg)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/rate limit|too many/i.test(msg)) return "Se enviaron demasiados correos. Espera unos minutos e inténtalo otra vez.";
    if (/invalid.*email|email.*invalid/i.test(msg)) return "Ese correo no parece válido.";
    if (/not confirmed/i.test(msg)) return "Tu correo todavía no está confirmado. Abre el enlace que te enviamos.";
    if (/invalid login credentials/i.test(msg)) return "Correo o contraseña incorrectos.";
    return "No se pudo completar. Revisa tu conexión e inténtalo otra vez.";
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("lName").value.trim(), email = $("lEmail").value.trim(), pass = $("lPass").value;
    var m = AUTH_MODES[authMode];
    if (m.name && !name) { authMsg("err", "Escribe tu nombre."); $("lName").focus(); return; }
    if (m.email && !email) { authMsg("err", "Escribe tu correo."); $("lEmail").focus(); return; }
    if (m.pass && pass.length < 6) { authMsg("err", "La contraseña debe tener al menos 6 caracteres."); $("lPass").focus(); return; }

    var here = location.origin + location.pathname;
    var call;
    if (authMode === "login") call = sb.auth.signInWithPassword({ email: email, password: pass });
    else if (authMode === "signup") call = sb.auth.signUp({ email: email, password: pass, options: { data: { name: name }, emailRedirectTo: here } });
    else if (authMode === "reset") call = sb.auth.resetPasswordForEmail(email, { redirectTo: here });
    else call = sb.auth.updateUser({ password: pass });

    $("lSubmit").disabled = true;
    call.then(function (res) {
      $("lSubmit").disabled = false;
      if (res.error) { authMsg("err", authError(res.error)); return; }
      if (authMode === "login") { closeLogin(); toast("Sesión iniciada."); return; }
      if (authMode === "signup") {
        if (res.data && res.data.session) { closeLogin(); toast("¡Bienvenido, " + name + "! Ya puedes agregar libros."); return; }
        authMsg("ok", "Te enviamos un correo a " + email + ". Abre el enlace para activar tu cuenta y vuelve aquí.");
        $("lPass").value = "";
        return;
      }
      if (authMode === "reset") { authMsg("ok", "Si " + email + " tiene una cuenta, te llegará un correo con el enlace en unos minutos."); return; }
      closeLogin(); toast("Contraseña actualizada.");
    }, function () {
      $("lSubmit").disabled = false;
      authMsg("err", "No se pudo completar. Revisa tu conexión e inténtalo otra vez.");
    });
  });

  // Al crear la cuenta el nombre viaja con el registro: se guarda solo en el perfil.
  function maybeAskName() {
    if (!S.uid || !S.loaded || S.profiles[S.uid] || S.nameAsked) return;
    S.nameAsked = true;
    var metaName = String((S.userMeta && S.userMeta.name) || "").trim().slice(0, 60);
    if (!metaName) { openName(); return; }
    sb.from("profiles").upsert({ id: S.uid, name: metaName, updated_at: nowIso() })
      .then(must).then(loadAll).catch(function () { openName(); });
  }
  function openName() {
    $("nName").value = S.profiles[S.uid] || "";
    $("nError").hidden = true;
    $("nameLayer").hidden = false;
    $("nName").focus();
  }
  function closeName() { $("nameLayer").hidden = true; }
  $("nameForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var name = $("nName").value.trim();
    if (!name) { $("nError").textContent = "Escribe un nombre."; $("nError").hidden = false; return; }
    run(function () {
      return sb.from("profiles").upsert({ id: S.uid, name: name, updated_at: nowIso() }).then(must).then(function () {
        closeName(); toast("Listo, " + name + ".");
      });
    });
  });
  $("logoutBtn").addEventListener("click", function () {
    sb.auth.signOut().then(function () { closeName(); closeDetail(); toast("Sesión cerrada."); });
  });

  // ---------- Events ----------
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, [data-close]");
    if (!t) return;
    var close = t.getAttribute("data-close");
    if (close === "detail") { closeDetail(); return; }
    if (close === "form") { closeForm(); return; }
    if (close === "login") { closeLogin(); return; }
    if (close === "notes") { closeNotes(); return; }
    if (close === "streak") { closeStreak(); return; }
    if (close === "write") { closeWrite(); return; }
    if (t.hasAttribute("data-write")) { openWrite(t.getAttribute("data-write")); return; }
    if (close === "name") { closeName(); return; }
    if (t.id === "addBtn") { openForm(null); return; }
    if (t.hasAttribute("data-auth-mode")) { setAuthMode(t.getAttribute("data-auth-mode")); return; }
    if (t.hasAttribute("data-expand")) { var k = t.getAttribute("data-expand"); S.expanded[k] = !S.expanded[k]; renderRows(); return; }
    if (t.hasAttribute("data-open")) { openDetail(t.getAttribute("data-open")); return; }
    if (t.hasAttribute("data-status")) { setStatus(S.openId, t.getAttribute("data-status")); return; }
    if (t.hasAttribute("data-rate")) {
      var ta = $("dReview"); if (ta) S.draft.text = ta.value;
      var r = Number(t.getAttribute("data-rate"));
      S.draft.rating = S.draft.rating === r ? 0 : r;
      renderMine(); return;
    }
    switch (t.getAttribute("data-action")) {
      case "add": openForm(null); break;
      case "login": openLogin("login"); break;
      case "signup": openLogin("signup"); break;
      case "profile": openName(); break;
      case "edit": openForm(S.openId); break;
      case "notes-open": openNotes(S.openId); break;
      case "streak": openStreak(); break;
      case "write-new": openWrite(null); break;
      case "write-delete-ask": W.confirmDelete = true; renderWriteDanger(); break;
      case "write-delete-no": W.confirmDelete = false; renderWriteDanger(); break;
      case "write-delete-yes": deleteWrite(); break;
      case "nudge-notes": var nb = bookForNotes(); if (nb) { closeStreak(); openNotes(nb); } break;
      case "delete-ask": S.confirmDelete = true; renderDetail(); break;
      case "delete-no": S.confirmDelete = false; renderDetail(); break;
      case "delete-yes": deleteBook(); break;
      case "save-review": saveReview(); break;
      case "remove-review": removeReview(); break;
      case "audio-edit": S.audioEditing = true; renderAudio(); var a = $("dAudioUrl"); if (a) a.focus(); break;
      case "audio-cancel": S.audioEditing = false; renderAudio(); break;
      case "audio-save": saveAudio(false); break;
      case "audio-remove": saveAudio(true); break;
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "dPage") setProgress(S.openId, e.target.value);
    if (e.target.id === "dUnit") setUnit(S.openId, e.target.value);
    if (e.target.id === "dTotal") setTotal(S.openId, e.target.value);
  });
  document.addEventListener("input", function (e) { if (e.target.id === "dReview") S.draft.text = e.target.value; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "dAudioUrl") { e.preventDefault(); saveAudio(false); }
    if (e.key !== "Escape") return;
    if (!$("nameLayer").hidden) closeName();
    else if (!$("loginLayer").hidden) closeLogin();
    else if (!$("writeLayer").hidden) closeWrite();
    else if (!$("notesLayer").hidden) closeNotes();
    else if (!$("streakLayer").hidden) closeStreak();
    else if (!$("formLayer").hidden) closeForm();
    else if (!$("detailLayer").hidden) closeDetail();
  });
  $("q").addEventListener("input", function (e) { S.q = e.target.value; renderSpot(); renderMyBookCard(); renderRows(); });

  // ---------- Boot ----------
  function setSession(session) {
    var uid = session && session.user ? session.user.id : null;
    S.userMeta = session && session.user ? session.user.user_metadata || {} : {};
    var firstAnswer = !S.authReady;
    S.authReady = true;
    if (uid === S.uid && !firstAnswer) return;
    var changed = uid !== S.uid;
    S.uid = uid;
    if (changed || firstAnswer) {
      // Al cambiar de cuenta (o salir) no queda nada del estante anterior en pantalla.
      if (changed) { closeDetail(); $("formLayer").hidden = true; }
      $("notesLayer").hidden = true; notesDirty = false; clearTimeout(notesTimer);
      $("writeLayer").hidden = true; document.body.style.overflow = ""; W.dirty = false; W.id = null; clearTimeout(W.timer);
      if (!uid) S.nameAsked = false;
      clearShelf();
      renderAll();
      loadAll();
    }
  }

  renderAll();
  if (!sb) S.authReady = true;
  if (sb) {
    sb.auth.getSession().then(function (res) { setSession(res.data && res.data.session); });
    sb.auth.onAuthStateChange(function (event, session) {
      setSession(session);
      if (event === "PASSWORD_RECOVERY") openLogin("newpass");
    });
    sb.channel("estante")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .subscribe();
  }
})();
