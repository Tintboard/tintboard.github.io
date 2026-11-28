// Confluence reading comfort preview (tintboard.com/tools/confluence-reading-preview/): try text size,
// line spacing and reading width on a sample page and see how many characters fit on a line.
// Runs entirely in the page; nothing is sent anywhere.
(function () {
  'use strict';
  var root = document.getElementById('rp');
  if (!root) return;
  var page = root.querySelector('.rp-page');
  var body = root.querySelector('.rp-body');
  var out = root.querySelector('.rp-verdict');
  var controls = {
    size: root.querySelector('#rp-size'),
    lh: root.querySelector('#rp-lh'),
    width: root.querySelector('#rp-width'),
  };
  var labels = {
    size: root.querySelector('#rp-size-v'),
    lh: root.querySelector('#rp-lh-v'),
    width: root.querySelector('#rp-width-v'),
  };

  // Characters per line as the sample actually wraps: the paragraphs' characters over their lines.
  // On a screen narrower than the chosen width the page shrinks, so scale to the chosen width.
  function measure(width) {
    var chars = 0, lines = 0;
    body.querySelectorAll('p').forEach(function (p) {
      var range = document.createRange();
      range.selectNodeContents(p);
      var tops = {};
      Array.prototype.forEach.call(range.getClientRects(), function (r) { if (r.width > 1) tops[Math.round(r.top)] = true; });
      var n = Object.keys(tops).length;
      // The last line of a paragraph is usually short: count full lines only, when there are some.
      var text = p.textContent.replace(/\s+/g, ' ').trim();
      if (n > 1) { chars += text.length * (n - 1) / n; lines += n - 1; }
    });
    if (!lines) return 0;
    var pad = parseFloat(getComputedStyle(page).paddingLeft) + parseFloat(getComputedStyle(page).paddingRight);
    var shown = page.clientWidth - pad, wanted = width - pad;
    return (chars / lines) * (shown < wanted ? wanted / shown : 1);
  }

  function render() {
    var size = +controls.size.value, lh = +controls.lh.value, width = +controls.width.value;
    labels.size.textContent = size + ' px';
    labels.lh.textContent = lh.toFixed(1);
    labels.width.textContent = width + ' px';
    page.style.setProperty('--rp-size', size + 'px');
    page.style.setProperty('--rp-lh', String(lh));
    page.style.setProperty('--rp-width', width + 'px');
    var cpl = Math.round(measure(width));
    var words = Math.round(cpl / 6);
    var kind, advice;
    if (cpl < 45) {
      kind = 'short';
      advice = 'Short lines: the eye jumps back too often. A wider page or smaller text reads more smoothly.';
    } else if (cpl <= 80) {
      kind = 'good';
      advice = 'Comfortable: 45 to 80 characters per line is the range typography and WCAG guidance recommend for body text.';
    } else {
      kind = 'long';
      advice = 'Long lines: readers lose their place going back to the next line. Narrow the page or raise the text size.';
    }
    if (lh < 1.5 && kind !== 'long') advice += ' Line spacing under 1.5 feels cramped on long pages (WCAG 1.4.12 tests text at 1.5).';
    out.className = 'rp-verdict ' + kind;
    out.textContent = '';
    var strong = document.createElement('strong');
    strong.textContent = 'About ' + cpl + ' characters (' + words + ' words) per line.';
    var p = document.createElement('span');
    p.textContent = ' ' + advice;
    out.append(strong, p);
  }

  Object.keys(controls).forEach(function (k) { controls[k].addEventListener('input', render); });
  root.querySelectorAll('.rp-preset').forEach(function (b) {
    b.addEventListener('click', function () {
      controls.size.value = b.dataset.size;
      controls.lh.value = b.dataset.lh;
      controls.width.value = b.dataset.width;
      render();
    });
  });
  root.hidden = false;
  var off = document.getElementById('rp-nojs');
  if (off) off.hidden = true;
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  render();
})();
