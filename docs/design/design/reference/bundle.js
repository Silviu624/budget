/* Buget — window.Buget: example data, Romanian money formatting, icons and the screen renderers used by every artboard. Classic script, no imports, no network. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- data */
  var D = {
    couple: 'Silviu & Baby',
    email: 'silviu@exemplu.ro',
    month: 'Octombrie 2026',
    prevMonth: 'Septembrie 2026',
    income: 10000,
    defaultIncome: 10000,
    appliedOn: '02.10.2026',
    appliedAt: '09:14',
    fixed: [
      ['Chirie', 950], ['Curent', 100], ['Gaz', 80], ['Apă', 45], ['Internet', 40],
      ['Telefon', 55], ['Mâncare', 1200], ['Combustibil', 350], ['Abonamente', 180]
    ],
    cats: [
      { id: 'siguranta', name: 'Fond de siguranță', kind: 'save', pct: 20, target: 18000, overflow: 'investitii', initial: 10800, balance: 17200 },
      { id: 'investitii', name: 'Investiții', kind: 'save', pct: 40, initial: 25000, balance: 39000 },
      { id: 'vacante', name: 'Vacanțe', kind: 'save', pct: 10, initial: 1500, balance: 2200 },
      { id: 'masina', name: 'Mașină', kind: 'save', pct: 3, initial: 2000, balance: 2630 },
      { id: 'casa', name: 'Casă', kind: 'save', pct: 2, initial: 800, balance: 1240 },
      { id: 'cadouri', name: 'Cadouri și sărbători', kind: 'save', pct: 2, initial: 300, balance: 750 },
      { id: 'sanatate', name: 'Sănătate', kind: 'save', pct: 2, initial: 500, balance: 1050 },
      { id: 'obiectiv', name: 'Obiectiv mare', kind: 'save', pct: 1, target: 50000, initial: 4000, balance: 4350 },
      { id: 'extra', name: 'Cheltuieli extra', kind: 'spend', pct: 10 },
      { id: 'silviu', name: 'Bani personali – Silviu', kind: 'spend', pct: 5 },
      { id: 'baby', name: 'Bani personali – Baby', kind: 'spend', pct: 5 }
    ],
    history: [
      { m: 'Octombrie 2026', inc: 10000, exp: 3000, st: 'planned', current: true },
      { m: 'Septembrie 2026', inc: 10000, exp: 3000, st: 'applied' },
      { m: 'August 2026', inc: 10200, exp: 3100, st: 'applied' },
      { m: 'Iulie 2026', inc: 10000, exp: 2950, st: 'applied' },
      { m: 'Iunie 2026', inc: 9800, exp: 2850, st: 'applied' },
      { m: 'Mai 2026', inc: 9800, exp: 2900, st: 'applied' }
    ],
    /* Fond de siguranță: 10.800 + (1.380 + 1.390 + 1.410 + 1.420 + 1.400) − 600 = 17.200 */
    moves: [
      { d: '02.09.2026', t: 'in', a: 1400, n: 'Septembrie 2026' },
      { d: '04.08.2026', t: 'in', a: 1420, n: 'August 2026' },
      { d: '02.07.2026', t: 'in', a: 1410, n: 'Iulie 2026' },
      { d: '17.06.2026', t: 'out', a: -600, n: 'Reparație centrală termică' },
      { d: '03.06.2026', t: 'in', a: 1390, n: 'Iunie 2026' },
      { d: '04.05.2026', t: 'in', a: 1380, n: 'Mai 2026' },
      { d: '01.05.2026', t: 'init', a: 10800, n: 'Sold la pornirea aplicației' }
    ],
    withdrawals2026: -4480
  };

  /* ------------------------------------------------------------- format */
  function r2(n) { return Math.round(n * 100) / 100; }
  function group(i) { return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  /* 1.400,00 — Romanian grouping is applied from 1.000 up (Intl ro-RO would print 1400,00) */
  function num(n) { var p = Math.abs(n).toFixed(2).split('.'); return group(p[0]) + ',' + p[1]; }
  /* 1.400,00 € · −600,00 € (U+2212) · +800,00 € with {sign:true}; NBSP before € */
  function eur(n, o) {
    var s = n < 0 ? '−' : (o && o.sign && n > 0 ? '+' : '');
    return s + num(n) + ' €';
  }
  function pct(n) { var v = Math.round(n * 10) / 10; return String(v).replace('.', ',') + '%'; }
  function sum(a) { return a.reduce(function (s, x) { return s + x[1]; }, 0); }
  function cat(id) { for (var i = 0; i < D.cats.length; i++) if (D.cats[i].id === id) return D.cats[i]; return null; }

  /* ---------------------------------------------------------- allocation */
  function calc() {
    var fixedTotal = sum(D.fixed);
    var rem = D.income - fixedTotal;
    var rows = D.cats.map(function (c) { return { c: c, share: r2(rem * c.pct / 100), contrib: 0, surplusOut: 0, surplusIn: 0, after: null }; });
    rows.forEach(function (r) {
      if (r.c.kind !== 'save') return;
      if (r.c.target) {
        var room = Math.max(0, r.c.target - r.c.balance);
        r.contrib = Math.min(r.share, room);
        r.surplusOut = r2(r.share - r.contrib);
      } else r.contrib = r.share;
    });
    rows.forEach(function (r) {
      if (r.surplusOut > 0 && r.c.overflow) {
        rows.forEach(function (t) { if (t.c.id === r.c.overflow) { t.surplusIn += r.surplusOut; t.from = r.c.name; } });
      }
    });
    rows.forEach(function (r) { if (r.c.kind === 'save') r.after = r2(r.c.balance + r.contrib + r.surplusIn); });
    var save = rows.filter(function (r) { return r.c.kind === 'save'; });
    var spend = rows.filter(function (r) { return r.c.kind === 'spend'; });
    var pctOf = function (a) { return a.reduce(function (s, r) { return s + r.c.pct; }, 0); };
    var shareOf = function (a) { return a.reduce(function (s, r) { return s + r.share; }, 0); };
    return {
      fixedTotal: fixedTotal, rem: rem, rows: rows, save: save, spend: spend,
      savePct: pctOf(save), spendPct: pctOf(spend), totalPct: pctOf(rows),
      saveShare: shareOf(save), spendShare: shareOf(spend),
      contribTotal: save.reduce(function (s, r) { return s + r.contrib + r.surplusIn; }, 0),
      fundsTotal: save.reduce(function (s, r) { return s + r.c.balance; }, 0)
    };
  }

  /* --------------------------------------------------------------- icons */
  var I = {
    chevL: '<path d="M15 18l-6-6 6-6"/>',
    chevR: '<path d="M9 6l6 6-6 6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    pencil: '<path d="M4 20l1-4L16 5a2.1 2.1 0 0 1 3 3L8 19l-4 1z"/><path d="M14 7l3 3"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4.5h6V7"/><path d="M6.5 7l.9 12.1A2 2 0 0 0 9.4 21h5.2a2 2 0 0 0 2-1.9L17.5 7"/><path d="M10 11v6M14 11v6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    logout: '<path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3"/><path d="M15 16l4-4-4-4"/><path d="M19 12H9"/>',
    sumar: '<rect x="3.5" y="3.5" width="7" height="9" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="15.5" width="7" height="5" rx="1.5"/>',
    vault: '<rect x="3.5" y="4" width="17" height="15" rx="3"/><circle cx="12" cy="11.5" r="3.5"/><path d="M12 11.5l2-2"/><path d="M7.5 19v1.5M16.5 19v1.5"/>',
    wallet: '<path d="M4 8.5V7.5A2.5 2.5 0 0 1 6.5 5H17v3.5"/><rect x="4" y="8.5" width="16.5" height="11" rx="2.5"/><path d="M15.5 14h2"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 4.5v4h4"/><path d="M12 8v4.5l3 2"/>',
    settings: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
    grip: '<g fill="currentColor" stroke="none"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></g>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    corner: '<path d="M6 4v7a3 3 0 0 0 3 3h10"/><path d="M15 10l4 4-4 4"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'in': '<path d="M17 7L7 17"/><path d="M7 9v8h8"/>',
    out: '<path d="M7 17L17 7"/><path d="M9 7h8v8"/>',
    init: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 7.75v.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    auto: '<rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/>'
  };
  function icon(n, s) {
    s = s || 20;
    return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + I[n] + '</svg>';
  }

  /* --------------------------------------------------------------- atoms */
  function btn(label, o) {
    o = o || {};
    var cls = 'bu-btn ' + (o.v || 'primary') + (o.sm ? ' sm' : '') + (o.block ? ' block' : '') + (o.cls ? ' ' + o.cls : '');
    return '<button class="' + cls + '"' + (o.aria ? ' aria-label="' + o.aria + '"' : '') + '>' + (o.icon ? icon(o.icon, o.sm ? 16 : 18) : '') + (label ? '<span>' + label + '</span>' : '') + '</button>';
  }
  function iconBtn(n, aria, o) {
    o = o || {};
    return '<button class="bu-iconbtn' + (o.cls ? ' ' + o.cls : '') + '" aria-label="' + aria + '">' + icon(n, o.s || 18) + '</button>';
  }
  function chip(st) {
    return st === 'applied'
      ? '<span class="bu-chip applied">' + icon('check', 14) + 'Aplicată</span>'
      : '<span class="bu-chip planned">Planificată</span>';
  }
  function kind(k, sm) {
    return '<span class="bu-kind ' + k + (sm ? ' sm' : '') + '" title="' + (k === 'save' ? 'Fond de economii' : 'Buget de cheltuieli') + '">' + icon(k === 'save' ? 'vault' : 'wallet', sm ? 16 : 18) + '</span>';
  }
  function money(n, o) {
    o = o || {};
    var tone = o.tone === 'auto' ? (n < 0 ? ' bu-neg' : n > 0 ? ' bu-pos' : '') : (o.tone ? ' bu-' + o.tone : '');
    return '<span class="bu-num' + tone + (o.cls ? ' ' + o.cls : '') + '">' + eur(n, o) + '</span>';
  }
  function input(o) {
    var cls = 'bu-input' + (o.size ? ' ' + o.size : '') + (o.focus ? ' focus' : '') + (o.right ? ' right' : '') + (o.select ? ' select' : '') + (o.readonly ? ' readonly' : '') + (o.num ? ' bu-num' : '');
    return '<div class="' + cls + '"' + (o.w ? ' style="width:' + o.w + 'px;flex:none"' : '') + '>' +
      '<span class="val' + (o.ph ? ' ph' : '') + '">' + (o.ph || o.value) + '</span>' +
      (o.suffix ? '<span class="sfx">' + o.suffix + '</span>' : '') +
      (o.select ? '<span class="sfx">' + icon('chevD', 18) + '</span>' : '') + '</div>';
  }
  function field(label, inp, o) {
    o = o || {};
    return '<label class="bu-field"' + (o.style ? ' style="' + o.style + '"' : '') + '><span class="lbl"><span>' + label + '</span>' + (o.aside ? '<span>' + o.aside + '</span>' : '') + '</span>' + inp + (o.hint ? '<span class="hint">' + o.hint + '</span>' : '') + '</label>';
  }
  function progress(p, lg) {
    return '<div class="bu-prog' + (lg ? ' lg' : '') + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(p) + '"><i style="width:' + Math.min(100, p) + '%"></i></div>';
  }
  function seg(items, on, block) {
    return '<div class="bu-seg' + (block ? ' block' : '') + '" role="radiogroup">' + items.map(function (it, i) {
      var label = typeof it === 'string' ? it : it[1];
      var ic = typeof it === 'string' ? '' : icon(it[0], 16);
      return '<span role="radio" aria-checked="' + (i === on) + '"' + (i === on ? ' class="on"' : '') + '>' + ic + label + '</span>';
    }).join('') + '</div>';
  }
  /* Allocation meter: p = sum of percentages, rem = Rămas de împărțit */
  function meter(p, rem) {
    var bar, status;
    if (p < 100) {
      bar = '<i style="width:' + p + '%"></i>';
      status = '<span class="bu-muted">' + icon('info', 16) + '</span><span>Nealocat: <b class="bu-num">' + pct(100 - p) + ' · ' + eur(rem * (100 - p) / 100) + '</b> — „Aplică luna” devine activ la 100%.</span>';
    } else if (p === 100) {
      bar = '<i style="width:100%"></i>';
      status = '<span class="bu-accent">' + icon('check', 16) + '</span><span>Totul este alocat · nealocat <span class="bu-num">0,00 €</span></span>';
    } else {
      var w = 100 / p * 100;
      bar = '<i style="width:' + w + '%"></i><i class="over" style="width:' + (100 - w) + '%"></i><span class="tick" style="left:calc(' + w + '% - 1px)"></span>';
      status = '<span class="bu-neg">' + icon('info', 16) + '</span><span>Peste 100% cu <b class="bu-num">' + pct(p - 100) + '</b> · ' + money(-rem * (p - 100) / 100, { tone: 'neg', cls: 'body-strong' }) + '</span>';
    }
    return '<div class="bu-meter"><div class="bu-between"><span class="label bu-muted">Alocat din ' + eur(rem) + '</span><span class="title-3 bu-num' + (p > 100 ? ' bu-neg' : '') + '">' + pct(p) + '</span></div><div class="bar">' + bar + '</div><div class="status">' + status + '</div></div>';
  }

  /* -------------------------------------------------------------- chrome */
  function statusBar() {
    return '<div class="bu-status"><span class="bu-num">9:41</span><svg width="68" height="12" viewBox="0 0 68 12" fill="currentColor" aria-hidden="true">' +
      '<rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0.5" width="3" height="11.5" rx="1"/>' +
      '<path d="M30 3.4a9 9 0 0 1 12 0l-1.4 1.5a7 7 0 0 0-9.2 0z"/><path d="M32.3 5.9a5.6 5.6 0 0 1 7.4 0l-1.4 1.5a3.6 3.6 0 0 0-4.6 0z"/><path d="M36 11.6l-1.9-2a2.6 2.6 0 0 1 3.8 0z"/>' +
      '<rect x="45" y="0.5" width="20" height="11" rx="3" fill="none" stroke="currentColor" opacity=".4"/><rect x="47" y="2.5" width="16" height="7" rx="1.5"/><rect x="66" y="4" width="1.5" height="4" rx=".75" opacity=".4"/></svg></div>';
  }
  function mHeader(last) {
    return '<header class="bu-mhead' + (last ? ' is-last' : '') + '"><span class="bu-wordmark">Buget</span>' + btn('Deconectare', { v: 'ghost neutral', sm: true, icon: 'logout' }) + '</header>';
  }
  var TABS = [['sumar', 'Sumar', 'sumar'], ['fonduri', 'Fonduri', 'vault'], ['istoric', 'Istoric', 'history'], ['setari', 'Setări', 'settings']];
  function tabbar(active) {
    return '<nav class="bu-tabbar" aria-label="Navigare">' + TABS.map(function (t) {
      return '<a class="bu-tab' + (t[0] === active ? ' on' : '') + '"' + (t[0] === active ? ' aria-current="page"' : '') + '><span class="pill">' + icon(t[2], 22) + '</span>' + t[1] + '</a>';
    }).join('') + '</nav>';
  }
  function mFoot(active, extra) { return '<div class="bu-mfoot">' + (extra || '') + (active ? tabbar(active) : '') + '<div class="bu-home"><i></i></div></div>'; }
  function mobile(theme, inner) { return '<div class="bu-app is-mobile" data-theme="' + theme + '">' + statusBar() + inner + '</div>'; }

  function sidebar(active) {
    return '<aside class="bu-side"><span class="bu-wordmark">Buget</span><nav class="bu-nav" aria-label="Navigare">' + TABS.map(function (t) {
      return '<a class="' + (t[0] === active ? 'on' : '') + '"' + (t[0] === active ? ' aria-current="page"' : '') + '>' + icon(t[2], 20) + t[1] + '</a>';
    }).join('') + '</nav><div class="bu-side-foot"><span class="bu-avatars"><span class="bu-avatar">S</span><span class="bu-avatar">B</span></span><span class="bu-grow"><span class="label" style="display:block">' + D.couple + '</span><span class="caption bu-muted">' + D.email + '</span></span></div></aside>';
  }
  function topbar(left) {
    return '<header class="bu-topbar">' + left + '<span class="bu-grow"></span>' + btn('Deconectare', { v: 'ghost neutral', sm: true, icon: 'logout' }) + '</header>';
  }
  function desktop(theme, active, top, content) {
    return '<div class="bu-app is-desktop" data-theme="' + theme + '">' + sidebar(active) + '<div class="bu-dmain">' + topbar(top) + '<main class="bu-dcontent">' + content + '</main></div></div>';
  }
  function monthSel(st, dev) {
    var d = dev === 'desktop';
    return '<div class="bu-monthbar' + (d ? ' is-desktop' : '') + '">' +
      iconBtn('chevL', 'Luna anterioară', { cls: d ? 'bordered' : '' }) +
      '<h1 class="' + (d ? 'title-1' : 'title-2') + ' bu-month">' + D.month + '</h1>' +
      iconBtn('chevR', 'Luna următoare', { cls: d ? 'bordered' : '' }) +
      (d ? '<span style="width:8px"></span>' : '<span class="bu-grow"></span>') + chip(st) + '</div>';
  }

  /* ======================================================== SCREEN: Sumar */
  function appliedBanner(dev) {
    var txt = '<span class="body-strong">Luna a fost aplicată</span><span class="caption">Pe ' + D.appliedOn + ' la ' + D.appliedAt + '. Contribuțiile au fost adăugate în fonduri, iar luna este acum doar pentru citire.</span>';
    if (dev === 'mobile') return '<div class="bu-banner"><span class="ic">' + icon('lock', 20) + '</span><div class="txt">' + txt + '<div style="margin-top:10px">' + btn('Editează', { v: 'outline', sm: true, icon: 'pencil' }) + '</div></div></div>';
    return '<div class="bu-banner" style="align-items:center"><span class="ic">' + icon('lock', 20) + '</span><div class="txt">' + txt + '</div>' + btn('Editează', { v: 'outline', sm: true, icon: 'pencil' }) + '</div>';
  }
  function venitCard(ro, dev) {
    var body = ro
      ? '<div class="amount-lg bu-num">' + eur(D.income) + '</div>'
      : input({ value: num(D.income), suffix: '€', size: 'lg', num: true });
    return '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Venit lunar</h2><span class="caption bu-muted">' + (ro ? 'Total încasat' : 'Implicit: <span class="bu-num">' + eur(D.defaultIncome) + '</span>') + '</span></div><div class="bu-card-b">' + body + '</div></section>';
  }
  function fixedCard(ro, dev) {
    var d = dev === 'desktop';
    var C = calc();
    var rows = D.fixed.map(function (f, i) {
      if (ro) return '<li class="bu-row"><span class="bu-grow">' + f[0] + '</span>' + money(f[1]) + '</li>';
      if (!d && f[0] === 'Curent') {
        return '<li class="bu-row editing"><span class="label">Editează cheltuiala</span>' +
          '<div style="display:grid;grid-template-columns:1fr 128px;gap:12px">' + field('Nume', input({ value: 'Curent' })) + field('Sumă', input({ value: '100,00', suffix: '€', focus: true, right: true, num: true })) + '</div>' +
          '<div class="bu-hstack">' + btn('Șterge', { v: 'ghost neutral', sm: true, icon: 'trash' }) + '<span class="bu-grow"></span>' + btn('Anulează', { v: 'secondary', sm: true }) + btn('Salvează', { sm: true }) + '</div></li>';
      }
      if (d) {
        var hover = f[0] === 'Mâncare';
        return '<li class="bu-row' + (hover ? ' hover' : '') + '"><span class="bu-grow">' + f[0] + '</span>' +
          input({ value: num(f[1]), suffix: '€', size: 'sm', right: true, num: true, w: 124, focus: hover }) +
          '<span class="acts">' + iconBtn('pencil', 'Editează ' + f[0], { s: 16 }) + iconBtn('trash', 'Șterge ' + f[0], { s: 16 }) + '</span></li>';
      }
      return '<li class="bu-row"><span class="bu-grow">' + f[0] + '</span>' + money(f[1]) + '<span class="bu-muted">' + icon('chevR', 16) + '</span></li>';
    }).join('');
    var sub = ro ? 'Fixate pentru ' + D.month : 'Preluate din ' + D.prevMonth;
    return '<section class="bu-card"><div class="bu-card-h"><div><h2 class="title-3">Cheltuieli fixe</h2><p class="caption bu-muted">' + sub + '</p></div>' +
      (ro ? '' : btn('Adaugă', { v: 'ghost', sm: true, icon: 'plus' })) + '</div><ul>' + rows + '</ul>' +
      '<div class="bu-card-f"><span class="label">Total</span>' + money(C.fixedTotal, { cls: 'body-strong' }) + '</div></section>';
  }
  function remBlock(C) {
    return '<div><span class="label bu-muted">Rămas de împărțit</span><div class="amount-xl bu-num bu-pos" style="margin-top:2px">' + eur(C.rem) + '</div><div class="caption bu-muted bu-num" style="margin-top:2px">' + eur(D.income) + ' venit − ' + eur(C.fixedTotal) + ' cheltuieli fixe</div></div>';
  }
  function surplusNotes(r, ro, short) {
    var n = '';
    if (short) {
      if (r.surplusOut > 0) n += '<div class="bu-note">' + icon('target', 14) + '<span>Țintă atinsă: <b class="bu-num">' + eur(r.contrib) + '</b> în fond, <b class="bu-num">' + eur(r.surplusOut) + '</b> → ' + cat(r.c.overflow).name + '</span></div>';
      if (r.surplusIn > 0) n += '<div class="bu-note">' + icon('corner', 14) + '<span>' + money(r.surplusIn, { sign: true, tone: 'pos', cls: 'label' }) + ' surplus din ' + r.from + '</span></div>';
      return n;
    }
    if (r.surplusOut > 0) n += '<div class="bu-note">' + icon('target', 14) + '<span>Țintă atinsă: <b class="bu-num">' + eur(r.contrib) + '</b> ' + (ro ? 'au intrat' : 'intră') + ' în fond, <b class="bu-num">' + eur(r.surplusOut) + '</b> ' + (ro ? 'au mers' : 'merg') + ' către ' + cat(r.c.overflow).name + '</span></div>';
    if (r.surplusIn > 0) n += '<div class="bu-note">' + icon('corner', 14) + '<span>Primește ' + money(r.surplusIn, { sign: true, tone: 'pos', cls: 'label' }) + ' surplus din ' + r.from + '</span></div>';
    return n;
  }
  function arowM(r, ro) {
    var c = r.c, save = c.kind === 'save';
    var meta = save ? (ro ? 'Sold: ' : 'Sold după lună: ') + '<span class="bu-num">' + eur(r.after) + '</span>' : 'Buget lunar, fără sold';
    var p = ro ? '<span class="label bu-num bu-muted">' + pct(c.pct) + '</span>' : input({ value: String(c.pct), suffix: '%', size: 'xs', right: true, w: 72, num: true });
    return '<div class="bu-arow">' + kind(c.kind) + '<div class="main"><div class="top"><span class="name">' + c.name + '</span>' + money(r.share, { cls: 'body-strong' }) + '</div><div class="bot"><span class="caption bu-muted">' + meta + '</span>' + p + '</div>' + surplusNotes(r, ro) + '</div></div>';
  }
  function grpHead(label, p, amount) {
    return '<div class="bu-grp-h"><span>' + label + '</span><span class="bu-num bu-muted">' + pct(p) + ' · ' + eur(amount) + '</span></div>';
  }
  function alocMobile(C, ro) {
    return '<div class="bu-sec-h"><h2 class="title-2">Alocări</h2><span class="label bu-muted">Procent din rămas</span></div>' +
      (ro ? '' : '<section class="bu-card bu-card-b" style="padding-top:16px">' + meter(C.totalPct, C.rem) + '</section>') +
      '<section class="bu-card">' + grpHead('Fonduri de economii', C.savePct, C.saveShare) + C.save.map(function (r) { return arowM(r, ro); }).join('') +
      grpHead('Bugete de cheltuieli', C.spendPct, C.spendShare) + C.spend.map(function (r) { return arowM(r, ro); }).join('') +
      '<div class="bu-card-f"><span class="body-strong">Total</span><span class="body-strong bu-num">' + pct(C.totalPct) + ' · ' + eur(C.rem) + '</span></div></section>';
  }
  function applyBar(C) {
    return '<div class="bu-applybar"><div class="info"><span class="caption bu-muted">Alocat</span><span class="body-strong bu-num">' + pct(C.totalPct) + ' · ' + eur(C.rem) + '</span></div>' + btn('Aplică luna', { icon: 'check' }) + '</div>';
  }
  function alocTable(C, ro) {
    function row(r) {
      var c = r.c, save = c.kind === 'save';
      var p = ro ? '<span class="bu-num">' + pct(c.pct) + '</span>' : '<div style="display:flex;justify-content:flex-end">' + input({ value: String(c.pct), suffix: '%', size: 'xs', right: true, w: 76, num: true }) + '</div>';
      var after = save ? '<span class="bu-num">' + eur(r.after) + '</span>' + (c.target ? '<div class="caption bu-muted">' + (r.after >= c.target ? 'țintă atinsă' : pct(r.after / c.target * 100) + ' din țintă') + '</div>' : '') : '<span class="bu-muted">—</span>';
      return '<tr><td><div class="bu-cat">' + kind(c.kind) + '<div style="display:flex;flex-direction:column;gap:4px"><span style="font-weight:500">' + c.name + '</span>' + surplusNotes(r, ro, true) + '</div></div></td><td class="r">' + p + '</td><td class="r">' + money(r.share, { cls: 'body-strong' }) + '</td><td class="r">' + after + '</td></tr>';
    }
    function grp(label, p, a) { return '<tr class="grp"><td>' + label + '</td><td class="r bu-num">' + pct(p) + '</td><td class="r bu-num">' + eur(a) + '</td><td></td></tr>'; }
    return '<section class="bu-card"><div class="bu-card-h"><h2 class="title-2">Alocări</h2><span class="label bu-muted">Procent din rămasul de ' + eur(C.rem) + '</span></div>' +
      '<table class="bu-table"><thead><tr><th>Categorie</th><th class="r">Procent</th><th class="r">Sumă</th><th class="r">' + (ro ? 'Sold' : 'Sold după lună') + '</th></tr></thead><tbody>' +
      grp('Fonduri de economii', C.savePct, C.saveShare) + C.save.map(row).join('') +
      grp('Bugete de cheltuieli', C.spendPct, C.spendShare) + C.spend.map(row).join('') +
      '<tr class="total"><td>Total</td><td class="r bu-num">' + pct(C.totalPct) + '</td><td class="r bu-num">' + eur(C.rem) + '</td><td></td></tr></tbody></table>' +
      (ro ? '<div class="bu-card-f"><span class="caption bu-muted">Pe ' + D.appliedOn + ' au intrat ' + money(C.contribTotal, { sign: true, tone: 'pos', cls: 'label' }) + ' în 8 fonduri.</span></div>'
        : '<div class="bu-card-f"><span class="caption bu-muted">La aplicare, ' + money(C.contribTotal, { sign: true, tone: 'pos', cls: 'label' }) + ' intră în 8 fonduri. Poți edita luna și după.</span>' + btn('Aplică luna', { icon: 'check' }) + '</div>') +
      '</section>';
  }
  function sumar(dev, theme, st) {
    var C = calc(), ro = st === 'applied';
    if (dev === 'mobile') {
      return mobile(theme, mHeader() + monthSel(st, 'mobile') + '<main class="bu-mmain">' + (ro ? appliedBanner('mobile') : '') +
        venitCard(ro, dev) + fixedCard(ro, dev) + '<section class="bu-card bu-card-b" style="padding-top:16px">' + remBlock(C) + '</section>' + alocMobile(C, ro) +
        '</main>' + mFoot('sumar', ro ? '' : applyBar(C)));
    }
    var right = '<section class="bu-card"><div class="bu-card-b" style="padding-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:center">' + remBlock(C) + (ro ? '<div class="bu-meter"><div class="bu-between"><span class="label bu-muted">Alocat</span><span class="title-3 bu-num">100%</span></div><div class="bar"><i style="width:100%"></i></div><div class="status"><span class="bu-accent">' + icon('lock', 16) + '</span><span>Aplicată pe ' + D.appliedOn + '</span></div></div>' : meter(C.totalPct, C.rem)) + '</div></section>' + alocTable(C, ro);
    return desktop(theme, 'sumar', monthSel(st, 'desktop'), (ro ? appliedBanner('desktop') : '') +
      '<div class="bu-cols"><div class="bu-vstack">' + venitCard(ro, dev) + fixedCard(ro, dev) + '</div><div class="bu-vstack">' + right + '</div></div>');
  }

  /* ====================================================== SCREEN: Fonduri */
  function fundCard(r, dev) {
    var c = r.c;
    var t = c.target ? progress(c.balance / c.target * 100) + '<div class="bu-between caption"><span class="bu-muted bu-num">' + pct(c.balance / c.target * 100) + ' din ' + eur(c.target) + '</span><span class="bu-num">mai sunt ' + eur(c.target - c.balance) + '</span></div>'
      : '<div class="caption bu-muted">' + icon('target', 14).replace('<svg', '<svg style="display:inline-block;vertical-align:-2px;margin-right:4px"') + 'Fără țintă</div>';
    var notes = '';
    if (r.surplusOut > 0) notes += '<div class="bu-note">' + icon('target', 14) + '<span>Atinge ținta în Octombrie</span></div>';
    if (c.overflow) notes += '<div class="bu-note">' + icon('corner', 14) + '<span>Surplusul merge către <b>' + cat(c.overflow).name + '</b>' + (r.surplusOut > 0 ? ': ' + money(r.surplusOut, { cls: 'label' }) : '') + '</span></div>';
    if (r.surplusIn > 0) notes += '<div class="bu-note">' + icon('corner', 14) + '<span>Include ' + money(r.surplusIn, { cls: 'label' }) + ' surplus din ' + r.from + '</span></div>';
    return '<article class="bu-card bu-fcard"><div class="head">' + kind('save') + '<h3 class="title-3 bu-grow">' + c.name + '</h3><span class="bu-muted">' + icon('chevR', 18) + '</span></div>' +
      '<div class="bu-between" style="align-items:baseline"><span class="label bu-muted">Sold</span><span class="amount-lg bu-num">' + eur(c.balance) + '</span></div>' + t +
      '<div class="foot"><div class="bu-between"><span class="caption bu-muted">Contribuție planificată</span>' + money(r.contrib + r.surplusIn, { sign: true, tone: 'pos', cls: 'label' }) + '</div>' + notes + '</div></article>';
  }
  function spendRow(r) {
    return '<div class="bu-row">' + kind('spend') + '<div class="bu-grow"><div style="font-weight:500">' + r.c.name + '</div><div class="caption bu-muted">' + pct(r.c.pct) + ' din rămas · fără sold</div></div>' + money(r.share, { cls: 'body-strong' }) + '</div>';
  }
  function fonduri(dev, theme) {
    var C = calc();
    if (dev === 'mobile') {
      return mobile(theme, mHeader(true) + '<main class="bu-mmain"><div class="bu-sec-h" style="padding-top:4px"><h1 class="title-1">Fonduri</h1></div>' +
        '<section class="bu-card bu-kpi"><span class="label bu-muted">Total în fonduri</span><span class="amount-xl bu-num">' + eur(C.fundsTotal) + '</span><div class="bu-between" style="margin-top:6px"><span class="caption bu-muted">Contribuții planificate în Octombrie</span>' + money(C.contribTotal, { sign: true, tone: 'pos', cls: 'label' }) + '</div></section>' +
        '<div class="bu-sec-h"><h2 class="title-2">Fonduri de economii</h2><span class="label bu-muted">' + C.save.length + ' fonduri</span></div>' +
        C.save.map(function (r) { return fundCard(r, dev); }).join('') +
        '<div class="bu-sec-h"><h2 class="title-2">Bugete de cheltuieli</h2><span class="label bu-muted">Octombrie 2026</span></div>' +
        '<section class="bu-card">' + C.spend.map(spendRow).join('') + '<div class="bu-card-f"><span class="label">Total</span>' + money(C.spendShare, { cls: 'body-strong' }) + '</div></section>' +
        '</main>' + mFoot('fonduri'));
    }
    var kpi = function (l, v, cap) { return '<section class="bu-card bu-kpi"><span class="label bu-muted">' + l + '</span>' + v + '<span class="caption bu-muted">' + cap + '</span></section>'; };
    return desktop(theme, 'fonduri', '<h1 class="title-1">Fonduri</h1>',
      '<div class="bu-grid3">' + kpi('Total în fonduri', '<span class="amount-lg bu-num">' + eur(C.fundsTotal) + '</span>', 'Sold actual în 8 fonduri de economii') +
      kpi('Contribuții planificate · Octombrie', money(C.contribTotal, { sign: true, tone: 'pos', cls: 'amount-lg' }), 'Se adaugă la „Aplică luna”') +
      kpi('Retrageri în 2026', money(D.withdrawals2026, { tone: 'neg', cls: 'amount-lg' }), '6 retrageri · ultima pe 19.09.2026') + '</div>' +
      '<div class="bu-sec-h"><h2 class="title-2">Fonduri de economii</h2><span class="label bu-muted">Sold actual · contribuțiile din Octombrie sunt planificate</span></div>' +
      '<div class="bu-grid3">' + C.save.map(function (r) { return fundCard(r, dev); }).join('') + '</div>' +
      '<div class="bu-sec-h"><h2 class="title-2">Bugete de cheltuieli</h2><span class="label bu-muted">Alocări pentru Octombrie 2026 · fără sold</span></div>' +
      '<div class="bu-grid3">' + C.spend.map(function (r) {
        return '<section class="bu-card bu-fcard"><div class="head">' + kind('spend') + '<h3 class="title-3 bu-grow">' + r.c.name + '</h3></div><div class="bu-between" style="align-items:baseline"><span class="label bu-muted">Alocare</span>' + money(r.share, { cls: 'amount-lg' }) + '</div><div class="caption bu-muted">' + pct(r.c.pct) + ' din rămas · fără sold</div></section>';
      }).join('') + '</div>');
  }

  /* ================================================= SCREEN: Detaliu fond */
  var MT = { 'in': ['in', 'Contribuție'], out: ['out', 'Retragere'], init: ['init', 'Sold inițial'] };
  function moveChip(t) { return '<span class="bu-chip neutral">' + icon(MT[t][0], 14) + MT[t][1] + '</span>'; }
  function moveAmount(m) { return m.t === 'init' ? money(m.a, { cls: 'body-strong' }) : money(m.a, { sign: true, tone: 'auto', cls: 'body-strong' }); }
  function detaliu(dev, theme) {
    var C = calc(), r = C.rows[0], c = r.c;
    var p = c.balance / c.target * 100;
    var hero = '<section class="bu-card bu-fcard"><div class="head">' + kind('save') + '<div class="bu-grow"><h1 class="' + (dev === 'mobile' ? 'title-2' : 'title-1') + '">' + c.name + '</h1><p class="caption bu-muted">Fond de economii · ' + pct(c.pct) + ' din rămas</p></div></div>' +
      '<div><span class="label bu-muted">Sold</span><div class="' + (dev === 'mobile' ? 'amount-xl' : 'display') + ' bu-num">' + eur(c.balance) + '</div></div>' +
      progress(p, true) + '<div class="bu-between label"><span class="bu-muted bu-num">' + pct(p) + ' din țintă</span><span class="bu-num"><span class="bu-muted">Țintă </span>' + eur(c.target) + '</span></div>' +
      '<div class="bu-note" style="font-size:13px;line-height:18px">' + icon('info', 16) + '<span>Mai sunt <b class="bu-num">' + eur(c.target - c.balance) + '</b> până la țintă. Contribuția planificată din Octombrie o atinge, iar restul de <b class="bu-num">' + eur(r.surplusOut) + '</b> merge către ' + cat(c.overflow).name + '.</span></div></section>';
    var settings = '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Setări fond</h2>' + btn('Editează', { v: 'ghost', sm: true, icon: 'pencil' }) + '</div><div class="bu-card-b"><dl class="bu-dl">' +
      [['Tip', 'Fond de economii'], ['Procent', pct(c.pct) + ' din rămas'], ['Țintă', eur(c.target)], ['Surplusul merge către', cat(c.overflow).name], ['Sold inițial', eur(c.initial)]].map(function (x) { return '<div><dt>' + x[0] + '</dt><dd class="bu-num">' + x[1] + '</dd></div>'; }).join('') + '</dl></div></section>';
    var form = '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Adaugă retragere</h2></div><div class="bu-card-b bu-vstack" style="gap:12px">' +
      field('Sumă', input({ value: '350,00', suffix: '€', focus: true, num: true })) +
      field('Notă', input({ value: 'Revizie anuală centrală' }), { aside: 'Opțional' }) +
      '<div class="bu-dl" style="background:var(--surface-sunken);border-radius:var(--radius-md);padding:10px 12px"><div><dt>Retragere</dt><dd>' + money(-350, { tone: 'neg' }) + '</dd></div><div><dt>Sold după retragere</dt><dd class="bu-num">' + eur(c.balance - 350) + '</dd></div></div>' +
      '<div class="bu-hstack" style="justify-content:flex-end">' + btn('Anulează', { v: 'secondary', sm: true }) + btn('Adaugă', { sm: true, icon: 'check' }) + '</div></div></section>';
    var planned = { d: 'Octombrie 2026', t: 'in', a: r.contrib, n: 'Planificată · intră la „Aplică luna”', planned: true };
    if (dev === 'mobile') {
      var moves = '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Istoric mișcări</h2><span class="caption bu-muted">' + D.moves.length + ' mișcări</span></div>' +
        [planned].concat(D.moves).map(function (m) {
          return '<div class="bu-mrow' + (m.planned ? ' planned' : '') + '"><span class="bu-hstack">' + moveChip(m.t) + '<span class="caption bu-muted bu-num">' + m.d + '</span></span>' + (m.planned ? money(m.a, { sign: true, cls: 'body-strong bu-muted' }) : moveAmount(m)) + '<span class="caption ' + (m.planned ? 'bu-muted' : 'note') + '" style="grid-column:1/-1">' + m.n + '</span></div>';
        }).join('') + '</section>';
      return mobile(theme, mHeader() + '<div class="bu-backbar">' + iconBtn('chevL', 'Înapoi la Fonduri', { cls: 'bu-accent' }) + '<span>Fonduri</span></div><main class="bu-mmain">' + hero + form + settings + moves + '</main>' + mFoot('fonduri'));
    }
    var table = '<section class="bu-card"><div class="bu-card-h"><h2 class="title-2">Istoric mișcări</h2><span class="label bu-muted">' + D.moves.length + ' mișcări · cele mai noi primele</span></div><table class="bu-table"><colgroup><col style="width:150px"><col style="width:150px"><col style="width:140px"><col></colgroup><thead><tr><th>Dată</th><th>Tip</th><th class="r">Sumă</th><th>Notă</th></tr></thead><tbody>' +
      [planned].concat(D.moves).map(function (m) {
        return '<tr' + (m.planned ? ' class="hover"' : '') + '><td class="bu-num' + (m.planned ? ' bu-muted' : '') + '">' + m.d + '</td><td>' + moveChip(m.t) + '</td><td class="r">' + (m.planned ? money(m.a, { sign: true, cls: 'body-strong bu-muted' }) : moveAmount(m)) + '</td><td' + (m.planned ? ' class="bu-muted"' : '') + '>' + m.n + '</td></tr>';
      }).join('') + '</tbody></table></section>';
    return desktop(theme, 'fonduri', '<nav class="bu-crumbs" aria-label="Cale"><a>Fonduri</a>' + icon('chevR', 16) + '<span class="title-3" style="color:var(--ink)">' + c.name + '</span></nav>',
      '<div class="bu-cols wide-right"><div class="bu-vstack">' + hero + table + '</div><div class="bu-vstack">' + form + settings + '</div></div>');
  }

  /* ======================================================== SCREEN: Setări */
  function incomeSettings() {
    return '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Venit implicit</h2></div><div class="bu-card-b bu-vstack" style="gap:12px">' +
      field('Venit lunar', input({ value: num(D.defaultIncome), suffix: '€', num: true }), { hint: 'Se folosește la fiecare lună nouă; îl poți schimba lunar în Sumar.' }) +
      '<div class="bu-hstack" style="justify-content:flex-end">' + btn('Salvează', { sm: true }) + '</div></div></section>';
  }
  function themeSettings() {
    return '<section class="bu-card"><div class="bu-card-h tight"><h2 class="title-3">Temă</h2></div><div class="bu-card-b">' + seg(['Automată', 'Luminoasă', 'Întunecată'], 0, true) + '<p class="caption bu-muted" style="margin-top:8px">„Automată” urmează setarea dispozitivului.</p></div></section>';
  }
  function fixedTemplate(dev) {
    var C = calc();
    return '<section class="bu-card"><div class="bu-card-h"><div><h2 class="title-3">Șablon cheltuieli fixe</h2><p class="caption bu-muted">Precompletează fiecare lună nouă</p></div>' + btn('Adaugă', { v: 'ghost', sm: true, icon: 'plus' }) + '</div><ul>' +
      D.fixed.map(function (f) {
        return '<li class="bu-row" style="padding-left:8px;gap:8px"><span class="grip">' + icon('grip', 18) + '</span><span class="bu-grow">' + f[0] + '</span>' + money(f[1]) + '<span class="acts">' + iconBtn('pencil', 'Editează ' + f[0], { s: 16 }) + (dev === 'desktop' ? iconBtn('trash', 'Șterge ' + f[0], { s: 16 }) : '') + '</span></li>';
      }).join('') + '</ul><div class="bu-card-f"><span class="label">Total</span>' + money(C.fixedTotal, { cls: 'body-strong' }) + '</div></section>';
  }
  function catMeta(c, short) {
    if (c.kind === 'spend') return 'Buget de cheltuieli';
    var m = short ? [] : ['Fond de economii'];
    if (c.target) m.push('țintă ' + eur(c.target));
    if (c.overflow) m.push('surplus → ' + cat(c.overflow).name);
    m.push('sold inițial ' + eur(c.initial));
    m = m.join(' · ');
    return m.charAt(0).toUpperCase() + m.slice(1);
  }
  function catEditor(c, dev) {
    var d = dev === 'desktop';
    return '<li class="bu-row editing" style="' + (d ? 'padding:16px 20px 20px' : '') + '">' +
      '<div class="bu-between"><span class="bu-hstack"><span class="grip">' + icon('grip', 18) + '</span>' + kind('save', true) + '<span class="title-3">Editează categoria</span></span><span class="bu-hstack" style="gap:2px">' + iconBtn('up', 'Mută sus', { cls: 'bordered', s: 16 }) + iconBtn('down', 'Mută jos', { cls: 'bordered', s: 16 }) + '</span></div>' +
      '<div style="display:grid;grid-template-columns:' + (d ? 'minmax(0,1fr) auto' : '1fr') + ';gap:12px">' +
      field('Nume', input({ value: c.name, focus: true })) +
      field('Tip', seg([['vault', 'Fond de economii'], ['wallet', 'Buget de cheltuieli']], 0, true)) +
      '</div><div style="display:grid;grid-template-columns:' + (d ? '104px 1fr 1fr 1fr' : '96px 1fr') + ';gap:12px">' +
      field('Procent', input({ value: String(c.pct), suffix: '%', right: true, num: true })) +
      field('Țintă', input({ value: num(c.target), suffix: '€', num: true }), { aside: 'Opțional' }) +
      field('Surplusul merge către', input({ value: cat(c.overflow).name, select: true }), { style: d ? '' : 'grid-column:1/-1', hint: d ? '' : 'Când soldul atinge ținta, partea fondului merge aici.' }) +
      field('Sold inițial', input({ value: num(c.initial), suffix: '€', num: true }), { style: d ? '' : 'grid-column:1/-1' }) +
      '</div>' + (d ? '<span class="caption bu-muted">Când soldul atinge ținta, partea acestui fond merge în categoria aleasă la „Surplusul merge către”.</span>' : '') +
      '<div class="bu-hstack">' + btn('Șterge', { v: 'ghost neutral', sm: true, icon: 'trash' }) + '<span class="bu-grow"></span>' + btn('Anulează', { v: 'secondary', sm: true }) + btn('Salvează', { sm: true }) + '</div></li>';
  }
  function catsSettings(dev) {
    var d = dev === 'desktop';
    var C = calc();
    var rows = D.cats.map(function (c, i) {
      if (i === 0) return catEditor(c, dev);
      return '<li class="bu-row' + (d && c.id === 'casa' ? ' hover' : '') + '" style="padding-left:8px;gap:' + (d ? 12 : 8) + 'px"><span class="grip">' + icon('grip', 18) + '</span>' + kind(c.kind, true) +
        '<span class="bu-grow"><span style="display:block;font-weight:500">' + c.name + '</span><span class="caption bu-muted">' + catMeta(c, !d) + '</span></span>' +
        '<span class="label bu-num" style="min-width:40px;text-align:right">' + pct(c.pct) + '</span><span class="acts">' + iconBtn('pencil', 'Editează ' + c.name, { s: 16 }) + (d ? iconBtn('trash', 'Șterge ' + c.name, { s: 16 }) : '') + '</span></li>';
    }).join('');
    return '<section class="bu-card"><div class="bu-card-h"><div><h2 class="' + (d ? 'title-2' : 'title-3') + '">Categorii</h2><p class="caption bu-muted">Procente din rămas · trag de mâner pentru a reordona</p></div>' + btn('Adaugă', { v: 'ghost', sm: true, icon: 'plus' }) + '</div><ul>' + rows + '</ul>' +
      '<div class="bu-card-f"><span class="label">Total procente</span><span class="bu-hstack"><span class="bu-accent">' + icon('check', 16) + '</span><span class="body-strong bu-num">' + pct(C.totalPct) + '</span></span></div></section>';
  }
  function setari(dev, theme) {
    if (dev === 'mobile') {
      return mobile(theme, mHeader(true) + '<main class="bu-mmain"><div class="bu-sec-h" style="padding-top:4px"><h1 class="title-1">Setări</h1></div>' + incomeSettings() + fixedTemplate(dev) + catsSettings(dev) + themeSettings() + '</main>' + mFoot('setari'));
    }
    return desktop(theme, 'setari', '<h1 class="title-1">Setări</h1>', '<div class="bu-cols"><div class="bu-vstack">' + incomeSettings() + themeSettings() + fixedTemplate(dev) + '</div><div class="bu-vstack">' + catsSettings(dev) + '</div></div>');
  }

  /* ======================================================= SCREEN: Istoric */
  function istoric(dev, theme) {
    var applied = D.history.filter(function (h) { return h.st === 'applied'; });
    var tot = applied.reduce(function (s, h) { return { inc: s.inc + h.inc, exp: s.exp + h.exp }; }, { inc: 0, exp: 0 });
    if (dev === 'mobile') {
      var list = D.history.map(function (h) {
        return '<li class="bu-row" style="flex-direction:column;align-items:stretch;gap:10px;padding-top:14px;padding-bottom:14px"><div class="bu-between"><span><span class="title-3">' + h.m + '</span>' + (h.current ? '<span class="caption bu-muted" style="display:block">Luna curentă</span>' : '') + '</span><span class="bu-hstack">' + chip(h.st) + '<span class="bu-muted">' + icon('chevR', 18) + '</span></span></div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">' +
          [['Venit', money(h.inc, { cls: 'label' })], ['Cheltuieli', money(h.exp, { cls: 'label' })], ['Rămas', money(h.inc - h.exp, { tone: 'pos', cls: 'label' })]].map(function (x) { return '<span style="display:flex;flex-direction:column"><span class="caption bu-muted">' + x[0] + '</span>' + x[1] + '</span>'; }).join('') + '</div></li>';
      }).join('');
      return mobile(theme, mHeader(true) + '<main class="bu-mmain"><div class="bu-sec-h" style="padding-top:4px;flex-direction:column;align-items:flex-start;gap:2px"><h1 class="title-1">Istoric</h1><span class="caption bu-muted">Atinge o lună pentru a o deschide în Sumar.</span></div>' +
        '<section class="bu-card bu-kpi"><span class="label bu-muted">Rămas de împărțit în 2026</span><span class="amount-xl bu-num bu-pos">' + eur(tot.inc - tot.exp) + '</span><span class="caption bu-muted">' + applied.length + ' luni aplicate · venit ' + eur(tot.inc) + ' · cheltuieli ' + eur(tot.exp) + '</span></section>' +
        '<section class="bu-card"><ul>' + list + '</ul></section></main>' + mFoot('istoric'));
    }
    var kpi = function (l, v) { return '<section class="bu-card bu-kpi"><span class="label bu-muted">' + l + '</span>' + v + '<span class="caption bu-muted">' + applied.length + ' luni aplicate · Mai – Septembrie</span></section>'; };
    return desktop(theme, 'istoric', '<h1 class="title-1">Istoric</h1>',
      '<div class="bu-grid3">' + kpi('Venit în 2026', money(tot.inc, { cls: 'amount-lg' })) + kpi('Cheltuieli fixe în 2026', money(tot.exp, { cls: 'amount-lg' })) + kpi('Rămas de împărțit în 2026', money(tot.inc - tot.exp, { tone: 'pos', cls: 'amount-lg' })) + '</div>' +
      '<section class="bu-card"><div class="bu-card-h"><h2 class="title-2">Luni</h2><span class="label bu-muted">Apasă pe o lună pentru a o deschide în Sumar</span></div><table class="bu-table"><thead><tr><th>Lună</th><th class="r">Venit</th><th class="r">Cheltuieli</th><th class="r">Rămas</th><th>Stare</th><th></th></tr></thead><tbody>' +
      D.history.map(function (h) {
        var hover = h.m === 'Septembrie 2026';
        return '<tr' + (hover ? ' class="hover"' : '') + '><td><span style="font-weight:500">' + h.m + '</span>' + (h.current ? '<span class="caption bu-muted"> · luna curentă</span>' : '') + '</td><td class="r">' + money(h.inc) + '</td><td class="r">' + money(h.exp) + '</td><td class="r">' + money(h.inc - h.exp, { tone: 'pos', cls: 'body-strong' }) + '</td><td>' + chip(h.st) + '</td><td class="r" style="width:180px">' + (hover ? '<span class="label bu-accent bu-hstack" style="justify-content:flex-end;gap:4px;white-space:nowrap">Deschide în Sumar' + icon('chevR', 16) + '</span>' : '<span class="bu-muted" style="display:inline-flex;vertical-align:middle">' + icon('chevR', 16) + '</span>') + '</td></tr>';
      }).join('') +
      '<tr class="total"><td>Total · ' + applied.length + ' luni aplicate</td><td class="r">' + money(tot.inc) + '</td><td class="r">' + money(tot.exp) + '</td><td class="r">' + money(tot.inc - tot.exp, { tone: 'pos' }) + '</td><td></td><td></td></tr></tbody></table></section>');
  }

  /* ================================================= SCREEN: Autentificare */
  function loginCard() {
    return '<div class="bu-login-card"><div><div class="bu-wordmark" style="font-size:30px;line-height:36px">Buget</div><p class="bu-muted" style="margin-top:6px">Bugetul vostru lunar, împreună.</p></div>' +
      '<div class="bu-vstack" style="gap:14px">' + field('Email', input({ value: D.email })) + field('Parolă', input({ value: '••••••••••', suffix: icon('eye', 18) })) + '</div>' +
      btn('Autentificare', { block: true }) + '<p class="caption bu-muted" style="text-align:center">Un singur cont pentru amândoi.</p></div>';
  }
  function login(dev, theme) {
    if (dev === 'mobile') return '<div class="bu-app is-mobile is-bare" data-theme="' + theme + '" style="min-height:844px">' + statusBar() + '<main class="bu-login">' + loginCard() + '</main>' + mFoot(null) + '</div>';
    return '<div class="bu-app is-desktop is-bare" data-theme="' + theme + '"><main class="bu-login">' + loginCard() + '</main></div>';
  }

  var SCREENS = { login: login, sumar: sumar, fonduri: fonduri, detaliu: detaliu, setari: setari, istoric: istoric };
  var THEME_LABEL = { light: 'Temă luminoasă', dark: 'Temă întunecată' };

  /* Renders one screen as artboards, one per theme: mobile side by side, desktop stacked. */
  function board(el, o) {
    var themes = o.themes || ['light', 'dark'];
    var dev = o.device || 'mobile';
    el.innerHTML = '<div class="bu-canvas' + (dev === 'desktop' ? ' stack' : '') + '">' + themes.map(function (t) {
      return '<div class="bu-board"><div class="bu-board-label"><span class="sw" data-theme="' + t + '" style="background:var(--bg)"></span><b>' + THEME_LABEL[t] + '</b><span>' + (dev === 'mobile' ? 'Mobil · 390 px' : 'Desktop · 1280 px') + (o.caption ? ' · ' + o.caption : '') + '</span></div>' + SCREENS[o.screen](dev, t, o.state) + '</div>';
    }).join('') + '</div>';
  }

  /* ============================================================ Tokens board */
  var RO = {
    'bg': 'Fundalul aplicației', 'surface': 'Carduri, antet, bară laterală, bară de file, câmpuri', 'surface-sunken': 'Câmpuri doar-citire, antet de tabel, fundal progres, chip neutru',
    'surface-hover': 'Rând la hover sau apăsat', 'line': 'Linii despărțitoare, contur card', 'border': 'Contur câmpuri și controale (min. 3:1)',
    'ink': 'Text principal, sume neutre', 'ink-muted': 'Etichete, text ajutător, file inactive', 'ink-disabled': 'Doar text dezactivat',
    'accent': 'Accentul (cobalt): buton principal, navigare activă, focus, progres', 'accent-hover': 'Buton principal la hover/apăsat', 'accent-soft': 'Selecție, navigare activă, chip „Aplicată”',
    'on-accent': 'Text și iconițe pe accent', 'positive': 'Doar sume pozitive (+)', 'positive-soft': 'Fundal pentru o sumă pozitivă',
    'negative': 'Doar sume negative (−)', 'negative-soft': 'Fundal pentru o sumă negativă', 'scrim': 'Fundal sub dialoguri',
    'display': 'Sold mare, detaliu fond (desktop)', 'amount-xl': 'Sumă principală pe mobil', 'amount-lg': 'Totaluri pe carduri', 'title-1': 'Titlu de pagină', 'title-2': 'Titlu de card / secțiune, luna', 'title-3': 'Titlu de grup', 'body': 'Text implicit', 'body-strong': 'Sume în rânduri, butoane', 'label': 'Etichete, antet tabel, chip', 'caption': 'Text ajutător, date', 'micro': 'Etichete bară de file',
    'space-1': 'Iconiță–text', 'space-2': 'În controale', 'space-3': 'Padding vertical rând', 'space-4': 'Margine mobil, padding card mobil', 'space-5': 'Padding card desktop', 'space-6': 'Între carduri', 'space-8': 'Padding pagină desktop', 'space-10': 'Padding card autentificare', 'space-12': 'Separări mari',
    'radius-xs': 'Etichete mici', 'radius-sm': 'Butoane mici, navigare', 'radius-md': 'Butoane, câmpuri', 'radius-lg': 'Carduri, tabele', 'radius-xl': 'Autentificare, dialoguri', 'radius-full': 'Chip-uri, bare de progres',
    'shadow-sm': 'Carduri', 'shadow-lg': 'Dialoguri, meniuri', 'focus-ring': 'Focus de la tastatură',
    'size-control': 'Înălțime buton / câmp', 'size-control-sm': 'Buton compact, buton-iconiță', 'size-header': 'Antet mobil', 'size-tabbar': 'Bară de file', 'size-sidebar': 'Bară laterală', 'size-content': 'Lățime maximă conținut', 'breakpoint-desktop': 'De aici: bară laterală în loc de file'
  };
  function val(t, th) { return typeof t.value === 'string' ? t.value : (t.value[th] || t.value.light); }
  function cssBlocks(tk) {
    var L = [], Dk = [], R = [];
    var push = function (t) { L.push('  --' + t.name + ': ' + val(t, 'light') + ';'); if (typeof t.value !== 'string' && t.value.dark) Dk.push('  --' + t.name + ': ' + t.value.dark + ';'); };
    tk.color.tokens.forEach(push);
    (tk.shadow ? tk.shadow.tokens : []).forEach(push);
    ['spacing', 'radius', 'size'].forEach(function (f) { if (tk[f]) tk[f].tokens.forEach(function (t) { R.push('  --' + t.name + ': ' + t.value + ';'); }); });
    Object.keys(tk.type.families).forEach(function (k) { R.push('  --font-' + k + ': ' + tk.type.families[k] + ';'); });
    return [
      '/* Temă luminoasă (implicită) */\n:root, [data-theme="light"] {\n' + L.join('\n') + '\n}',
      '/* Temă întunecată, forțată din Setări */\n[data-theme="dark"] {\n' + Dk.join('\n') + '\n}',
      '/* Dimensiuni, comune ambelor teme */\n:root {\n' + R.join('\n') + '\n}',
      '/* Temă „Automată”: urmează dispozitivul */\n@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n' + Dk.map(function (x) { return '  ' + x; }).join('\n') + '\n  }\n}'
    ];
  }
  function cssVars(tk) {
    var out = [], L = [], Dk = [];
    tk.color.tokens.forEach(function (t) { L.push('  --' + t.name + ': ' + val(t, 'light') + ';'); if (typeof t.value !== 'string' && t.value.dark) Dk.push('  --' + t.name + ': ' + t.value.dark + ';'); });
    (tk.shadow ? tk.shadow.tokens : []).forEach(function (t) { L.push('  --' + t.name + ': ' + val(t, 'light') + ';'); if (typeof t.value !== 'string' && t.value.dark) Dk.push('  --' + t.name + ': ' + t.value.dark + ';'); });
    var R = [];
    ['spacing', 'radius', 'size'].forEach(function (f) { if (tk[f]) tk[f].tokens.forEach(function (t) { R.push('  --' + t.name + ': ' + t.value + ';'); }); });
    Object.keys(tk.type.families).forEach(function (k) { R.push('  --font-' + k + ': ' + tk.type.families[k] + ';'); });
    out.push(':root, [data-theme="light"] {\n' + L.join('\n') + '\n}');
    out.push('[data-theme="dark"] {\n' + Dk.join('\n') + '\n}');
    out.push('@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n' + Dk.map(function (x) { return '  ' + x; }).join('\n') + '\n  }\n}');
    out.push(':root {\n' + R.join('\n') + '\n}');
    return out.join('\n\n');
  }
  function tokensHtml(tk) {
    var sec = function (title, sub, body) { return '<section class="bu-card" style="overflow:hidden"><div class="bu-card-h"><div><h2 class="title-2">' + title + '</h2>' + (sub ? '<p class="caption bu-muted">' + sub + '</p>' : '') + '</div></div>' + body + '</section>'; };
    var sw = function (t, th) { return '<td><span class="bu-hstack" style="gap:10px"><span data-theme="' + th + '" style="width:44px;height:28px;border-radius:8px;background:var(--' + t.name + ');box-shadow:inset 0 0 0 1px #7f88993d;flex:none"></span><code class="bu-num" style="font-size:13px">' + val(t, th) + '</code></span></td>'; };
    var colors = '<table class="bu-table"><thead><tr><th>Token · variabilă CSS</th><th>Temă luminoasă</th><th>Temă întunecată</th><th>Rol</th></tr></thead><tbody>' +
      tk.color.tokens.map(function (t) { return '<tr><td><code style="font-size:13px;font-weight:600">--' + t.name + '</code></td>' + sw(t, 'light') + sw(t, 'dark') + '<td class="caption bu-muted" style="max-width:300px">' + (RO[t.name] || t.usage || '') + '</td></tr>'; }).join('') + '</tbody></table>';
    var styles = [];
    tk.type.groups.forEach(function (g) { g.styles.forEach(function (s) { styles.push(s); }); });
    var type = '<table class="bu-table"><thead><tr><th>Stil · clasă</th><th>Exemplu</th><th>Mărime / linie</th><th>Grosime</th><th>Spațiere</th><th>Rol</th></tr></thead><tbody>' +
      styles.map(function (s) { return '<tr><td><code style="font-size:13px;font-weight:600">.' + s.name + '</code></td><td><span class="' + s.name + ' bu-num" style="white-space:nowrap">' + (s.sample || 'Buget') + '</span></td><td class="bu-num">' + s.fontSize + ' / ' + s.lineHeight + '</td><td class="bu-num">' + s.fontWeight + '</td><td class="bu-num">' + (s.letterSpacing || '0') + '</td><td class="caption bu-muted">' + (RO[s.name] || '') + '</td></tr>'; }).join('') +
      '</tbody></table><div class="bu-card-f"><span class="caption bu-muted">Familie: <code>--font-sans</code> = ' + tk.type.families.sans + ' · Sumele folosesc <code>font-variant-numeric: tabular-nums</code></span></div>';
    var spacing = '<div class="bu-card-b" style="display:flex;flex-direction:column;gap:10px">' + tk.spacing.tokens.map(function (t) { return '<div class="bu-hstack" style="gap:16px"><code style="width:96px;font-size:13px;font-weight:600">--' + t.name + '</code><span class="bu-num label" style="width:44px">' + t.value + '</span><span style="height:16px;width:' + t.value + ';background:var(--accent);border-radius:3px"></span><span class="caption bu-muted">' + (RO[t.name] || '') + '</span></div>'; }).join('') + '</div>';
    var radius = '<div class="bu-card-b" style="display:flex;gap:20px;flex-wrap:wrap">' + tk.radius.tokens.map(function (t) { return '<div style="display:flex;flex-direction:column;gap:8px;width:112px"><span style="width:72px;height:56px;border:2px solid var(--accent);background:var(--accent-soft);border-radius:' + t.value + '"></span><code style="font-size:13px;font-weight:600">--' + t.name + '</code><span class="bu-num label">' + t.value + '</span><span class="caption bu-muted">' + (RO[t.name] || '') + '</span></div>'; }).join('') + '</div>';
    var shadows = '<div class="bu-card-b" style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">' + tk.shadow.tokens.map(function (t) { return '<div style="display:flex;flex-direction:column;gap:10px"><span style="padding:16px;border-radius:var(--radius-md);background:var(--bg)"><span style="display:block;height:48px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--' + t.name + ')' + (t.name === 'shadow-sm' ? ', 0 0 0 1px var(--line)' : '') + '"></span></span><code style="font-size:13px;font-weight:600">--' + t.name + '</code><span class="caption bu-muted">' + (RO[t.name] || '') + '</span><code class="caption bu-muted" style="word-break:break-word">' + val(t, 'light') + '</code></div>'; }).join('') + '</div>';
    var sizes = '<table class="bu-table"><thead><tr><th>Token</th><th>Valoare</th><th>Rol</th></tr></thead><tbody>' + tk.size.tokens.map(function (t) { return '<tr><td><code style="font-size:13px;font-weight:600">--' + t.name + '</code></td><td class="bu-num">' + t.value + '</td><td class="caption bu-muted">' + (RO[t.name] || '') + '</td></tr>'; }).join('') + '</tbody></table>';
    var code = '<div class="bu-card-b" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start">' + cssBlocks(tk).map(function (b) { return '<pre style="margin:0;padding:16px;border-radius:var(--radius-md);background:var(--surface-sunken);font:12px/18px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--ink);white-space:pre-wrap;word-break:break-word">' + b.replace(/</g, '&lt;') + '</pre>'; }).join('') + '</div>';
    return '<div class="bu-app" style="width:1280px;padding:40px;display:flex;flex-direction:column;gap:24px">' +
      '<div><div class="bu-wordmark" style="font-size:28px;line-height:36px">Buget · Tokens</div><p class="bu-muted" style="margin-top:4px">Culori (luminoasă și întunecată), tipografie, spațiere, colțuri, umbre și dimensiuni, gata de transformat în variabile CSS.</p></div>' +
      sec('Culori', 'Neutre reci și un singur accent (cobalt). Verde și roșu apar doar pe sume cu semn.', colors) +
      '<div style="display:grid;grid-template-columns:1fr;gap:24px">' + sec('Tipografie', 'O singură familie: Inter, cu fontul sistemului ca rezervă.', type) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">' + sec('Spațiere', 'Bază de 4 px.', spacing) + sec('Colțuri', 'Colțuri moi; pastile doar pentru chip-uri și progres.', radius) + '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">' + sec('Umbre', 'Cardurile se bazează pe contur; umbrele rămân discrete.', shadows) + sec('Dimensiuni', 'Înălțimi și lățimi fixe ale componentelor.', sizes) + '</div>' +
      sec('Variabile CSS', 'Generate din tokens.json — copiază-le direct în foaia de stil.', code) + '</div>';
  }
  function tokensBoard(el, fallback) {
    function draw(tk) { el.innerHTML = '<div class="bu-canvas">' + tokensHtml(tk) + '</div>'; }
    if (fallback) draw(fallback);
    try {
      fetch('../../tokens.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(draw).catch(function () { });
    } catch (e) { }
  }

  /* ======================================================= Component demos */
  function wrap(inner, col) { return '<div class="bu-app"><div class="bu-demo' + (col ? ' col' : '') + '">' + inner + '</div></div>'; }
  function lab(t, inner) { return '<div><div class="bu-demo-label">' + t + '</div>' + inner + '</div>'; }
  var DEMOS = {
    button: function () {
      return wrap(lab('Principal', btn('Aplică luna', { icon: 'check' })) + lab('Principal · focus', btn('Salvează', { cls: 'focus' })) + lab('Secundar', btn('Anulează', { v: 'secondary' })) + lab('Contur', btn('Editează', { v: 'outline', icon: 'pencil' })) + lab('Text', btn('Adaugă', { v: 'ghost', icon: 'plus' })) + lab('Text neutru', btn('Șterge', { v: 'ghost neutral', icon: 'trash' })) + lab('Dezactivat', btn('Aplică luna', { v: 'disabled', icon: 'check' })) + lab('Compact', btn('Confirmă', { sm: true })) + lab('Iconiță', iconBtn('chevR', 'Luna următoare', { cls: 'bordered' })));
    },
    amount: function () {
      var r = function (l, v) { return '<div class="bu-between" style="padding:8px 0;border-top:1px solid var(--line)"><span class="bu-muted">' + l + '</span>' + v + '</div>'; };
      return wrap('<div style="width:420px">' + r('Neutru (alocare, sold)', money(1400, { cls: 'body-strong' })) + r('Contribuție', money(800, { sign: true, tone: 'pos', cls: 'body-strong' })) + r('Retragere', money(-600, { tone: 'neg', cls: 'body-strong' })) + r('Rămas pozitiv', money(7000, { tone: 'pos', cls: 'amount-lg' })) + r('Rămas negativ', money(-250, { tone: 'neg', cls: 'amount-lg' })) + r('Sold mare', money(68420, { cls: 'amount-lg' })) + '</div>', true);
    },
    chip: function () { return wrap(chip('planned') + chip('applied') + moveChip('in') + moveChip('out') + moveChip('init')); },
    month: function () { return wrap(lab('Mobil', '<div style="width:358px;border:1px solid var(--line);border-radius:12px;overflow:hidden">' + monthSel('planned', 'mobile').replace('bu-monthbar"', 'bu-monthbar" style="padding-top:8px;border:0"') + '</div>') + lab('Desktop', monthSel('applied', 'desktop')), true); },
    meter: function () { return wrap('<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%">' + [95, 100, 104].map(function (p) { return '<section class="bu-card bu-card-b" style="padding-top:16px">' + meter(p, 7000) + '</section>'; }).join('') + '</div>', true); },
    progress: function () {
      var one = function (name, bal, tgt) { var p = bal / tgt * 100; return '<section class="bu-card bu-card-b" style="padding-top:16px;display:flex;flex-direction:column;gap:8px"><div class="bu-between"><span style="font-weight:500">' + name + '</span><span class="label bu-num">' + eur(bal) + '</span></div>' + progress(p) + '<div class="bu-between caption"><span class="bu-muted bu-num">' + (p >= 100 ? 'Țintă atinsă' : pct(p) + ' din ' + eur(tgt)) + '</span><span class="bu-num">' + (p >= 100 ? '<span class="bu-accent bu-hstack" style="gap:4px">' + icon('check', 14) + eur(tgt) + '</span>' : 'mai sunt ' + eur(tgt - bal)) + '</span></div></section>'; };
      return wrap('<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;width:100%">' + one('Obiectiv mare', 4350, 50000) + one('Fond de siguranță', 17200, 18000) + one('Fond de siguranță', 18000, 18000) + '</div>', true);
    },
    field: function () {
      return wrap('<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%">' + field('Venit lunar', input({ value: '10.000,00', suffix: '€', size: 'lg', num: true })) + field('Sumă', input({ value: '350,00', suffix: '€', focus: true, num: true })) + field('Notă', input({ ph: 'De exemplu: reparație mașină' }), { aside: 'Opțional' }) + field('Surplusul merge către', input({ value: 'Investiții', select: true })) + field('Procent', input({ value: '20', suffix: '%', size: 'xs', right: true, w: 72, num: true })) + field('Tip', seg([['vault', 'Fond de economii'], ['wallet', 'Buget de cheltuieli']], 0)) + '</div>', true);
    },
    fundcard: function () { var C = calc(); return wrap('<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;width:100%">' + fundCard(C.rows[0], 'mobile') + fundCard(C.rows[1], 'mobile') + '</div><section class="bu-card">' + spendRow(C.spend[0]) + '</section>', true); },
    allocrow: function () { var C = calc(); return wrap('<section class="bu-card" style="width:390px">' + grpHead('Fonduri de economii', C.savePct, C.saveShare) + arowM(C.rows[0], false) + arowM(C.rows[1], false) + grpHead('Bugete de cheltuieli', C.spendPct, C.spendShare) + arowM(C.spend[1], false) + '</section>', true); },
    movement: function () { return wrap('<section class="bu-card" style="width:390px">' + D.moves.slice(2, 5).map(function (m) { return '<div class="bu-mrow"><span class="bu-hstack">' + moveChip(m.t) + '<span class="caption bu-muted bu-num">' + m.d + '</span></span>' + moveAmount(m) + '<span class="caption note" style="grid-column:1/-1">' + m.n + '</span></div>'; }).join('') + '</section>', true); },
    nav: function () { return '<div class="bu-app" style="display:flex;gap:24px;padding:24px;align-items:flex-start"><div style="width:240px;height:420px;display:flex;border:1px solid var(--line);border-radius:12px;overflow:hidden">' + sidebar('fonduri').replace('class="bu-side"', 'class="bu-side" style="width:100%;border:0"') + '</div><div style="width:390px;border:1px solid var(--line);border-radius:12px;overflow:hidden">' + mHeader(true) + '<div style="height:120px;background:var(--bg)"></div>' + tabbar('sumar') + '</div></div>'; },
    dialog: function () { return '<div class="bu-app"><div class="bu-scrim"><div class="bu-dialog" role="dialog" aria-modal="true"><h2 class="title-2">Aplici luna Octombrie 2026?</h2><p class="bu-muted">Se adaugă ' + money(5600, { sign: true, tone: 'pos', cls: 'body-strong' }) + ' în 8 fonduri, iar luna devine doar pentru citire. O poți edita oricând.</p><div class="bu-hstack" style="justify-content:flex-end">' + btn('Anulează', { v: 'secondary' }) + btn('Confirmă', { icon: 'check' }) + '</div></div></div></div>'; },
    icons: function () { return wrap(Object.keys(I).filter(function (k) { return k !== 'init'; }).map(function (k) { return '<div style="width:84px;display:flex;flex-direction:column;align-items:center;gap:8px;padding:12px 0;border-radius:10px;background:var(--surface);border:1px solid var(--line)">' + icon(k, 24) + '<code class="caption bu-muted">' + k + '</code></div>'; }).join('')); }
  };
  function demo(name, el) { el.innerHTML = DEMOS[name](); }

  window.Buget = {
    data: D, calc: calc, eur: eur, num: num, pct: pct, icon: icon, icons: Object.keys(I),
    ui: { btn: btn, iconBtn: iconBtn, chip: chip, kind: kind, money: money, input: input, field: field, progress: progress, seg: seg, meter: meter, tabbar: tabbar, sidebar: sidebar, monthSel: monthSel },
    screens: SCREENS, board: board, tokensBoard: tokensBoard, tokensHtml: tokensHtml, cssVars: cssVars, demo: demo
  };
})();
