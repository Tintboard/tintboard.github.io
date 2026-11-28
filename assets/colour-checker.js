// Jira colour checker (tintboard.com/tools/jira-colour-checker/): shows label colours as Jira chips,
// as people with each common type of colour blindness see them, and flags pairs that look alike
// and text that fails WCAG AA. Runs entirely in the page; nothing is sent anywhere.
(function () {
  'use strict';
  var TEXT_DARK = '#172b4d';
  var TEXT_LIGHT = '#ffffff';
  var AA = 4.5;
  // Pairs closer than this (CIE76 delta E in Lab) are hard to tell apart at a glance.
  var ALIKE = 15;
  var START = [
    { name: 'blocked', hex: '#de350b' },
    { name: 'done', hex: '#36b37e' },
    { name: 'in review', hex: '#ffab00' },
    { name: 'customer', hex: '#6554c0' },
    { name: 'bug', hex: '#ff5630' },
  ];
  // Okabe-Ito, shaded so the automatic text colour meets AA (same set as Tintboard's palette).
  var SAFE = ['#e69f00', '#56b4e9', '#007a5a', '#f0e442', '#0072b2', '#b84a00', '#cc79a7', '#1d2125'];
  // Machado, Oliveira and Fernandes (2009), severity 1, applied to linear RGB.
  var VIEWS = [
    { key: 'normal', label: 'Normal colour vision' },
    { key: 'deutan', label: 'Deuteranopia (green-blind, the most common)', m: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881] },
    { key: 'protan', label: 'Protanopia (red-blind)', m: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998] },
    { key: 'tritan', label: 'Tritanopia (blue-blind, rare)', m: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, -0.691367, 1.68784] },
    { key: 'grey', label: 'Greyscale (printouts, some screens)' },
  ];

  function norm(v) {
    v = String(v || '').trim().toLowerCase();
    if (v.charAt(0) !== '#') v = '#' + v;
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2) + v.charAt(3) + v.charAt(3);
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }
  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function toHex(c) {
    return '#' + c.map(function (x) { x = Math.max(0, Math.min(255, Math.round(x))); return (x < 16 ? '0' : '') + x.toString(16); }).join('');
  }
  function lin(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function unlin(c) { c = Math.max(0, Math.min(1, c)); return 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055); }
  function luminance(hex) { var c = rgb(hex).map(lin); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function contrast(a, b) { var x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function textFor(bg) { return contrast(bg, TEXT_DARK) >= contrast(bg, TEXT_LIGHT) ? TEXT_DARK : TEXT_LIGHT; }

  function view(hex, v) {
    if (!v.m) {
      if (v.key !== 'grey') return hex;
      var y = unlin(luminance(hex));
      return toHex([y, y, y]);
    }
    var c = rgb(hex).map(lin), m = v.m;
    return toHex([
      unlin(m[0] * c[0] + m[1] * c[1] + m[2] * c[2]),
      unlin(m[3] * c[0] + m[4] * c[1] + m[5] * c[2]),
      unlin(m[6] * c[0] + m[7] * c[1] + m[8] * c[2]),
    ]);
  }
  function lab(hex) {
    var c = rgb(hex).map(lin);
    var x = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047;
    var y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    var z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
    function f(t) { return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116; }
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  }
  function deltaE(a, b) { var p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }

  var root = document.getElementById('cc');
  if (!root) return;
  var rowsBox = root.querySelector('.cc-rows');
  var out = root.querySelector('.cc-out');
  var rows = START.slice();

  function chip(name, bg) {
    var s = el('span', { class: 'cc-chip' }, name || ' ');
    s.style.background = bg;
    s.style.color = textFor(bg);
    return s;
  }

  function renderInputs() {
    rowsBox.textContent = '';
    rows.forEach(function (r, i) {
      var line = el('div', { class: 'cc-row' });
      var name = el('input', { type: 'text', class: 'cc-name', value: r.name, 'aria-label': 'Label ' + (i + 1) + ' name', maxlength: '24' });
      var pick = el('input', { type: 'color', class: 'cc-pick', value: norm(r.hex) || '#000000', 'aria-label': 'Label ' + (i + 1) + ' colour' });
      var hex = el('input', { type: 'text', value: r.hex, 'aria-label': 'Label ' + (i + 1) + ' hex code', maxlength: '7', class: 'cc-hex', spellcheck: 'false' });
      var del = el('button', { type: 'button', class: 'cc-del', 'aria-label': 'Remove label ' + (i + 1) }, '×');
      name.addEventListener('input', function () { r.name = name.value; renderOut(); });
      pick.addEventListener('input', function () { r.hex = pick.value; hex.value = pick.value; renderOut(); });
      hex.addEventListener('input', function () { var v = norm(hex.value); if (v) { r.hex = v; pick.value = v; renderOut(); } });
      del.addEventListener('click', function () { rows.splice(i, 1); renderInputs(); renderOut(); });
      line.append(pick, hex, name, del);
      rowsBox.append(line);
    });
    root.querySelector('.cc-add').disabled = rows.length >= 8;
  }

  function renderOut() {
    out.textContent = '';
    var valid = rows.filter(function (r) { return norm(r.hex); });
    var problems = [];
    var alike = {}; // "i,j" -> names of the colour visions where the pair looks alike
    VIEWS.forEach(function (v) {
      var block = el('div', { class: 'cc-view' });
      block.append(el('div', { class: 'cc-vlabel' }, v.label));
      var line = el('div', { class: 'cc-chips' });
      var seen = valid.map(function (r) { return view(norm(r.hex), v); });
      valid.forEach(function (r, i) { line.append(chip(r.name, seen[i])); });
      block.append(line);
      out.append(block);
      if (v.key === 'grey') return;
      for (var i = 0; i < seen.length; i++) for (var j = i + 1; j < seen.length; j++) {
        if (deltaE(seen[i], seen[j]) < ALIKE) (alike[i + ',' + j] = alike[i + ',' + j] || []).push(v.key === 'normal' ? 'normal' : v.label.split(' (')[0].toLowerCase());
      }
    });
    Object.keys(alike).forEach(function (pair) {
      var ij = pair.split(','), a = valid[+ij[0]], b = valid[+ij[1]], who = alike[pair];
      var names = '“' + (a.name || a.hex) + '” and “' + (b.name || b.hex) + '”';
      if (who[0] === 'normal') problems.push(names + ' look alike for everyone.');
      else problems.push(names + ' look alike with ' + (who.length > 1 ? who.slice(0, -1).join(', ') + ' and ' + who[who.length - 1] : who[0]) + '.');
    });
    valid.forEach(function (r) {
      var bg = norm(r.hex), ratio = contrast(bg, textFor(bg));
      if (ratio < AA) problems.push('Text on “' + (r.name || bg) + '” has a contrast of ' + ratio.toFixed(1) + ':1, below the 4.5:1 that WCAG AA asks for.');
    });
    var verdict = el('div', { class: 'cc-verdict ' + (problems.length ? 'bad' : 'good') });
    if (problems.length) {
      verdict.append(el('strong', {}, problems.length === 1 ? '1 problem' : problems.length + ' problems'));
      var ul = el('ul');
      problems.forEach(function (p) { ul.append(el('li', {}, p)); });
      verdict.append(ul);
    } else {
      verdict.append(el('strong', {}, 'Readable for everyone.'));
      verdict.append(el('p', {}, 'Every pair stays distinct with each type of colour blindness, and every label passes WCAG AA.'));
    }
    out.prepend(verdict);
  }

  root.querySelector('.cc-add').addEventListener('click', function () {
    if (rows.length >= 8) return;
    rows.push({ name: 'label ' + (rows.length + 1), hex: SAFE[rows.length % SAFE.length] });
    renderInputs();
    renderOut();
  });
  root.querySelector('.cc-safe').addEventListener('click', function () {
    rows.forEach(function (r, i) { r.hex = SAFE[i % SAFE.length]; });
    renderInputs();
    renderOut();
  });
  root.hidden = false;
  var off = document.getElementById('cc-nojs');
  if (off) off.hidden = true;
  renderInputs();
  renderOut();
})();
