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
    { bg: "linear-gradient(170deg,#EFE6D2,#C8B896)", ink: "#2B2118", hi: "#C23B2E", motif: "lines" },
    { bg: "linear-gradient(165deg,#2D3152,#0E0F21)", ink: "#ECEBF5", hi: "#E8615A", motif: "moon" },
    { bg: "linear-gradient(165deg,#3E4C2B,#141A0D)", ink: "#F1F0E2", hi: "#E9C46A", motif: "waves" },
    { bg: "linear-gradient(170deg,#DCE6EA,#A9BEC7)", ink: "#132530", hi: "#1C6E90", motif: "grid" },
    { bg: "linear-gradient(165deg,#4C2A55,#160A1A)", ink: "#F3E9F5", hi: "#5CC8F0", motif: "stripes" },
    { bg: "linear-gradient(165deg,#1A1A1A,#2E2E2E)", ink: "#FFFFFF", hi: "#F2B544", motif: "moon" },
    { bg: "linear-gradient(165deg,#8A4B1E,#2B1406)", ink: "#FBEFD9", hi: "#FFD27A", motif: "sun" },
    { bg: "linear-gradient(170deg,#E8D9D4,#C39E94)", ink: "#2A1714", hi: "#7A2229", motif: "arch" }
  ];
  var SPEAKER = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4v-5Z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  var S = {
    books: [], reviews: [], profiles: {},
    uid: null, loaded: false, loadError: false,
    q: "", expanded: {},
    openId: null, confirmDelete: false, audioEditing: false,
    draft: { rating: 0, text: "" },
    form: { editingId: null, file: null, previewUrl: null, removeCover: false },
    nameAsked: false,
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
  function pct(b) { return b.pages ? Math.max(0, Math.min(100, Math.round((b.currentPage / b.pages) * 100))) : 0; }

  // ---------- Pieces ----------
  function starsHtml(v, num) {
    var full = Math.round(v), s = '<span class="stars" aria-label="' + (v ? v.toFixed(1) + " de 5" : "Sin calificar") + '">';
    for (var i = 1; i <= 5; i++) s += i <= full ? "★" : '<span class="off">★</span>';
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
    if (opts.progress && b.status === "leyendo" && b.pages) h += '<div class="cprog"><span style="width:' + pct(b) + '%"></span></div>';
    return h + "</div>";
  }
  function cardHtml(b) {
    var avg = avgRating(b.id), line3 = [];
    if (b.year) line3.push(esc(b.year));
    if (b.status === "leyendo" && b.pages) line3.push(pct(b) + "% leído");
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
      el.innerHTML = '<button class="btn" type="button" data-action="login">Iniciar sesión</button>';
    }
    $("addBtn").hidden = !S.uid;
  }

  function renderStats() {
    var c = { "por-leer": 0, "leyendo": 0, "leido": 0 }, pages = 0, audio = 0, ratings = [];
    S.books.forEach(function (b) {
      if (c[b.status] != null) c[b.status]++;
      if (b.status === "leido") pages += Number(b.pages) || 0;
      if (b.status === "leyendo") pages += Number(b.currentPage) || 0;
      if (b.audioUrl) audio++;
      var a = avgRating(b.id); if (a) ratings.push(a);
    });
    if (!S.books.length) { $("stats").innerHTML = ""; return; }
    var avg = ratings.length ? ratings.reduce(function (s, x) { return s + x; }, 0) / ratings.length : 0;
    $("stats").innerHTML =
      '<span class="pill"><b>' + c["leido"] + "</b> leídos</span>" +
      '<span class="pill"><b>' + c["leyendo"] + "</b> leyendo</span>" +
      '<span class="pill"><b>' + c["por-leer"] + "</b> por leer</span>" +
      '<span class="pill"><b>' + pages.toLocaleString("es") + "</b> páginas leídas</span>" +
      '<span class="pill"><b>' + audio + "</b> audiolibros</span>" +
      '<span class="pill"><b class="g">★ ' + (avg ? avg.toFixed(1) : "—") + "</b> nota media</span>";
  }

  function renderSpot() {
    var el = $("spot");
    var reading = S.books.filter(function (b) { return b.status === "leyendo"; })
      .sort(function (a, b) { return b.startedAt - a.startedAt; });
    if (!reading.length || S.q.trim()) { el.hidden = true; el.innerHTML = ""; return; }
    var b = reading[0], th = themeOf(b);
    var bg = b.coverPath ? "background-image:url('" + esc(coverUrl(b.coverPath)) + "')" : "background:" + th.bg;
    el.className = "spot";
    el.hidden = false;
    el.innerHTML = '<div class="spot-bg" style="' + bg + '"></div><div class="spot-in">' +
      '<button class="cover-btn" type="button" data-open="' + esc(b.id) + '" aria-label="Abrir ' + esc(b.title) + '">' + coverHtml(b) + "</button>" +
      "<div>" +
      '<p class="kicker">Continuar leyendo</p>' +
      "<h2>" + esc(b.title) + "</h2>" +
      '<p class="by">' + esc(b.author || "Autor desconocido") + (b.genre ? ' · <span style="color:var(--cyan)">' + esc(b.genre) + "</span>" : "") + "</p>" +
      (b.pages ? '<div class="bar"><span style="width:' + pct(b) + '%"></span></div><p class="pg">Página ' + b.currentPage + " de " + b.pages + " · " + pct(b) + "%</p>" : '<p class="pg">Marca en qué página vas desde la ficha del libro.</p>') +
      '<div class="actions">' +
      (b.audioUrl ? audioLink(b, "btn gold", '<span style="width:18px;height:18px;display:inline-grid">' + SPEAKER + "</span> Escuchar en " + esc(audioHost(b.audioUrl))) : "") +
      '<button class="btn" type="button" data-open="' + esc(b.id) + '">Abrir ficha</button>' +
      "</div></div></div>";
  }

  function rowHtml(key, title, list) {
    if (!list.length) return "";
    var open = !!S.expanded[key];
    var more = list.length > 6
      ? '<button class="more" type="button" data-expand="' + key + '" aria-expanded="' + open + '">' + (open ? "Ver menos" : "Ver " + (list.length - 6) + " más") + ' <span class="tri">' + (open ? "▲" : "▼") + "</span></button>"
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
    if (S.loadError && !S.books.length) {
      el.innerHTML = '<div class="empty"><h2>No se pudo abrir el estante</h2><p>Revisa tu conexión y vuelve a cargar la página. Los libros guardados siguen ahí.</p></div>';
      return;
    }
    if (!S.loaded) { el.innerHTML = '<p class="notice">Cargando el estante…</p>'; return; }
    if (!S.books.length) {
      el.innerHTML = '<div class="empty"><div class="ghosts" aria-hidden="true"><span></span><span></span><span></span><span></span></div>' +
        "<h2>El estante está vacío</h2>" +
        "<p>Agrega el primer libro: puedes subir su portada, pegar la playlist del audiolibro y, cuando lo termines, dejar tu reseña.</p>" +
        (S.uid ? '<button class="btn primary" type="button" data-action="add">+ Agregar el primer libro</button>'
               : '<button class="btn primary" type="button" data-action="login">Iniciar sesión para agregar libros</button>') + "</div>";
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
    el.innerHTML =
      rowHtml("leyendo", "Leyendo ahora", by("leyendo").sort(function (a, b) { return b.startedAt - a.startedAt; })) +
      rowHtml("audio", "Audiolibros", S.books.filter(function (b) { return b.audioUrl; }).sort(recent)) +
      rowHtml("por-leer", "Por leer", by("por-leer").sort(recent)) +
      rowHtml("leido", "Leídos", by("leido").sort(function (a, b) { return b.finishedAt - a.finishedAt; }));
  }

  function renderAll() {
    renderAuth();
    renderStats();
    renderSpot();
    renderRows();
    if (S.openId) renderDetail();
  }

  // ---------- Detail ----------
  function renderDetail() {
    var b = findBook(S.openId);
    if (!b) { closeDetail(); return; }
    $("dCall").textContent = callNumber(b.id) + " · " + (STATUS[b.status] || "");
    var facts = [];
    if (b.year) facts.push(["Año", esc(b.year)]);
    if (b.pages) facts.push(["Páginas", esc(b.pages)]);
    if (b.startedAt) facts.push(["Empezado", fmtDate(b.startedAt)]);
    if (b.finishedAt && b.status === "leido") facts.push(["Terminado", fmtDate(b.finishedAt)]);
    if (b.addedBy) facts.push(["Agregado por", esc(nameOf(b.addedBy))]);
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
      st += '<div class="page-row"><label for="dPage">Voy en la página</label>' +
        '<input id="dPage" type="number" min="0" max="' + (b.pages || 20000) + '" value="' + b.currentPage + '"' + dis + ">" +
        (b.pages ? "<span>de " + b.pages + " · " + pct(b) + "%</span>" : "") + "</div>" +
        (b.pages ? '<div class="pbar"><span style="width:' + pct(b) + '%"></span></div>' : "");
    }
    $("dStatus").innerHTML = st;

    var rs = reviewsFor(b.id).filter(function (r) { return r.uid !== S.uid; });
    $("dReviews").innerHTML = rs.length ? rs.map(function (r) {
      return '<div class="review">' + avatarHtml(r.uid) +
        '<div><div class="who"><b>' + esc(nameOf(r.uid)) + "</b>" + (r.rating ? starsHtml(r.rating, false) : "") +
        '<span class="small">' + fmtDate(r.updatedAt) + "</span></div>" + (r.text ? "<p>" + esc(r.text) + "</p>" : "") + "</div></div>";
    }).join("") : (S.uid ? "" : '<p class="notice">Todavía nadie ha dejado una reseña.</p>');

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
  }

  function renderAudio() {
    var b = findBook(S.openId);
    if (!b) return;
    var h = "<h3>Audiolibro</h3>";
    if (b.audioUrl && !S.audioEditing) {
      h += '<div class="audio-box"><div class="ic">' + SPEAKER + "</div><div>" +
        '<div class="t">Playlist en ' + esc(audioHost(b.audioUrl)) + "</div>" +
        '<div class="host">' + esc(b.audioUrl) + "</div></div></div>" +
        '<div class="actions">' + audioLink(b, "btn gold", "▶ Escuchar ahora") +
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
      picker += '<button type="button" data-rate="' + i + '" class="' + (i <= d.rating ? "" : "off") + '" aria-label="' + i + (i === 1 ? " estrella" : " estrellas") + '" aria-pressed="' + (i === d.rating) + '">★</button>';
    }
    el.innerHTML = '<div class="mine">' +
      '<div class="actions" style="justify-content:space-between"><b>Tu reseña</b>' + (mine && mine.updatedAt ? '<span class="small">Guardada el ' + fmtDate(mine.updatedAt) + "</span>" : "") + "</div>" +
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
  function loadAll() {
    return Promise.all([
      sb.from("books").select("*"),
      sb.from("reviews").select("*"),
      sb.from("profiles").select("id,name")
    ]).then(function (r) {
      S.books = must(r[0]).map(mapBook);
      S.reviews = must(r[1]).map(mapReview);
      var p = {}; must(r[2]).forEach(function (x) { p[x.id] = x.name; });
      S.profiles = p;
      S.loaded = true; S.loadError = false;
      renderAll();
      maybeAskName();
    }).catch(function (e) {
      console.error("Error al cargar el estante:", e);
      S.loaded = true; S.loadError = true;
      renderAll();
    });
  }
  var reloadTimer = null;
  function scheduleReload() { clearTimeout(reloadTimer); reloadTimer = setTimeout(loadAll, 250); }

  // ---------- Writes ----------
  function writeFailed(e) {
    console.error("Error al guardar:", e);
    var code = e && (e.code || e.statusCode || e.status);
    var msg = String((e && e.message) || "");
    if (code === "42501" || code === 401 || code === 403 || code === "401" || code === "403" || /row-level security|JWT/i.test(msg)) {
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
    if (status === "leido") { if (!b.startedAt) patch.started_at = now; patch.finished_at = now; if (b.pages) patch.current_page = Number(b.pages); }
    else patch.finished_at = null;
    if (status === "por-leer") { patch.started_at = null; patch.current_page = 0; }
    run(function () { return updateBook(id, patch); });
  }
  function setPage(id, value) {
    var b = findBook(id);
    var n = Math.max(0, Math.floor(Number(value) || 0));
    if (b && b.pages) n = Math.min(n, Number(b.pages));
    if (!b || n === b.currentPage) return;
    run(function () {
      var patch = { current_page: n };
      if (b.pages && n >= Number(b.pages)) { patch.status = "leido"; patch.finished_at = nowIso(); }
      return updateBook(id, patch).then(function () { if (patch.status) toast("¡Terminado! Lo moví a Leídos."); });
    });
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
    var f = S.form, editId = f.editingId, old = editId ? findBook(editId) : null;
    var oldCover = old && old.coverPath;
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
        row.started_at = status === "por-leer" ? null : now;
        row.finished_at = status === "leido" ? now : null;
        return sb.from("books").insert(row).then(must).then(function () {
          closeForm(); toast("«" + title + "» está en el estante.");
        });
      });
    });
  });

  // ---------- Login + profile ----------
  function openLogin() {
    if (!sb) return;
    $("lError").hidden = true;
    $("loginLayer").hidden = false;
    $("lEmail").focus();
  }
  function closeLogin() { $("loginLayer").hidden = true; $("lPass").value = ""; }
  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("lEmail").value.trim(), pass = $("lPass").value;
    if (!email || !pass) { $("lError").textContent = "Escribe tu correo y tu contraseña."; $("lError").hidden = false; return; }
    $("lSubmit").disabled = true;
    sb.auth.signInWithPassword({ email: email, password: pass }).then(function (res) {
      $("lSubmit").disabled = false;
      if (res.error) {
        $("lError").textContent = /confirm/i.test(res.error.message)
          ? "Tu correo todavía no está confirmado. Revisa tu bandeja de entrada."
          : "Correo o contraseña incorrectos.";
        $("lError").hidden = false;
        return;
      }
      closeLogin();
      toast("Sesión iniciada.");
    });
  });

  function maybeAskName() {
    if (S.uid && S.loaded && !S.profiles[S.uid] && !S.nameAsked) { S.nameAsked = true; openName(); }
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
    if (close === "name") { closeName(); return; }
    if (t.id === "addBtn") { openForm(null); return; }
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
      case "login": openLogin(); break;
      case "profile": openName(); break;
      case "edit": openForm(S.openId); break;
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
  document.addEventListener("change", function (e) { if (e.target.id === "dPage") setPage(S.openId, e.target.value); });
  document.addEventListener("input", function (e) { if (e.target.id === "dReview") S.draft.text = e.target.value; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.id === "dAudioUrl") { e.preventDefault(); saveAudio(false); }
    if (e.key !== "Escape") return;
    if (!$("nameLayer").hidden) closeName();
    else if (!$("loginLayer").hidden) closeLogin();
    else if (!$("formLayer").hidden) closeForm();
    else if (!$("detailLayer").hidden) closeDetail();
  });
  $("q").addEventListener("input", function (e) { S.q = e.target.value; renderSpot(); renderRows(); });

  // ---------- Boot ----------
  function setSession(session) {
    var uid = session && session.user ? session.user.id : null;
    if (uid === S.uid) return;
    S.uid = uid;
    if (!uid) S.nameAsked = false;
    renderAll();
    if (S.openId) { renderAudio(); renderMine(); }
    maybeAskName();
  }

  renderAll();
  if (sb) {
    sb.auth.getSession().then(function (res) { setSession(res.data && res.data.session); });
    sb.auth.onAuthStateChange(function (_event, session) { setSession(session); });
    loadAll();
    sb.channel("estante")
      .on("postgres_changes", { event: "*", schema: "public", table: "books" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews" }, scheduleReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, scheduleReload)
      .subscribe();
  }
})();
