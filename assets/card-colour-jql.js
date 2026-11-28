// Jira card colour JQL builder (tintboard.com/tools/jira-card-colour-jql/): builds the JQL queries that
// Jira's own "Board settings > Card colours > Queries" needs, in the right order, with a stripe preview.
// Runs entirely in the page; nothing is sent anywhere.
(function () {
  'use strict';
  // Okabe-Ito, shaded for contrast (Tintboard's colour-blind-safe palette), then Jira-like extras.
  var SWATCHES = ['#b84a00', '#e69f00', '#0072b2', '#56b4e9', '#007a5a', '#cc79a7', '#f0e442', '#1d2125'];
  function q(v) { return /^[A-Za-z0-9_.-]+$/.test(v) ? v : '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'; }
  var CONDITIONS = [
    { id: 'overdue', label: 'Overdue', jql: function () { return 'duedate < now() AND statusCategory != Done'; } },
    { id: 'soon', label: 'Due in the next N days', input: 'number', value: '7', jql: function (v) { return 'duedate >= now() AND duedate <= ' + (parseInt(v, 10) || 7) + 'd AND statusCategory != Done'; } },
    { id: 'flagged', label: 'Flagged', jql: function () { return 'Flagged is not EMPTY'; } },
    { id: 'label', label: 'Has the label', input: 'text', value: 'blocked', jql: function (v) { return 'labels = ' + q(v || 'blocked'); } },
    { id: 'priority', label: 'Priority Highest or High', jql: function () { return 'priority in (Highest, High)'; } },
    { id: 'type', label: 'Work type', input: 'text', value: 'Bug', jql: function (v) { return 'issuetype = ' + q(v || 'Bug'); } },
    { id: 'mine', label: 'Assigned to the person looking', jql: function () { return 'assignee = currentUser()'; } },
    { id: 'unassigned', label: 'Unassigned', jql: function () { return 'assignee is EMPTY'; } },
    { id: 'stale', label: 'In progress, untouched for N days', input: 'number', value: '7', jql: function (v) { return 'statusCategory = "In Progress" AND updated <= -' + (parseInt(v, 10) || 7) + 'd'; } },
    { id: 'component', label: 'Component', input: 'text', value: 'Backend', jql: function (v) { return 'component = ' + q(v || 'Backend'); } },
    { id: 'parent', label: 'Parent (epic) key', input: 'text', value: 'ABC-123', jql: function (v) { return 'parent = ' + q((v || 'ABC-123').toUpperCase()); } },
  ];
  var START = [
    { name: 'Blocked', on: { label: 'blocked' }, mode: 'AND', colour: '#b84a00' },
    { name: 'Overdue', on: { overdue: '' }, mode: 'AND', colour: '#e69f00' },
    { name: 'Untouched for a week', on: { stale: '7' }, mode: 'AND', colour: '#cc79a7' },
    { name: 'Bugs', on: { type: 'Bug' }, mode: 'AND', colour: '#0072b2' },
  ];

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function jqlFor(rule) {
    var parts = CONDITIONS.filter(function (c) { return Object.prototype.hasOwnProperty.call(rule.on, c.id); })
      .map(function (c) { return c.jql(rule.on[c.id]); });
    if (!parts.length) return '';
    if (parts.length === 1) return parts[0];
    return parts.map(function (p) { return / AND | OR /.test(p) ? '(' + p + ')' : p; }).join(rule.mode === 'OR' ? ' OR ' : ' AND ');
  }

  var root = document.getElementById('jb');
  if (!root) return;
  var list = root.querySelector('.jb-rules');
  var rules = START.map(function (r) { return { name: r.name, on: Object.assign({}, r.on), mode: r.mode, colour: r.colour }; });

  function copy(text, btn) {
    function done() { var t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1200); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() {
      var ta = el('textarea'); ta.value = text; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* the text stays selectable */ }
      ta.remove();
    }
  }

  function render() {
    list.textContent = '';
    rules.forEach(function (rule, i) {
      var box = el('div', { class: 'jb-rule' });
      var head = el('div', { class: 'jb-head' });
      head.append(el('span', { class: 'jb-order', title: 'Jira checks queries from the top; the first match colours the card' }, String(i + 1)));
      var name = el('input', { type: 'text', class: 'jb-name', value: rule.name, 'aria-label': 'Rule ' + (i + 1) + ' name', maxlength: '40' });
      name.addEventListener('input', function () { rule.name = name.value; renderPreview(); });
      head.append(name);
      var up = el('button', { type: 'button', class: 'jb-icon', 'aria-label': 'Move rule ' + (i + 1) + ' up' }, '↑');
      var down = el('button', { type: 'button', class: 'jb-icon', 'aria-label': 'Move rule ' + (i + 1) + ' down' }, '↓');
      var del = el('button', { type: 'button', class: 'jb-icon', 'aria-label': 'Remove rule ' + (i + 1) }, '×');
      up.disabled = i === 0; down.disabled = i === rules.length - 1;
      up.addEventListener('click', function () { rules.splice(i - 1, 0, rules.splice(i, 1)[0]); render(); });
      down.addEventListener('click', function () { rules.splice(i + 1, 0, rules.splice(i, 1)[0]); render(); });
      del.addEventListener('click', function () { rules.splice(i, 1); render(); });
      head.append(up, down, del);
      box.append(head);

      var conds = el('div', { class: 'jb-conds' });
      CONDITIONS.forEach(function (c) {
        var on = Object.prototype.hasOwnProperty.call(rule.on, c.id);
        var lab = el('label', { class: 'jb-cond' + (on ? ' on' : '') });
        var cb = el('input', { type: 'checkbox' });
        cb.checked = on;
        lab.append(cb, document.createTextNode(' ' + c.label));
        var val = null;
        if (c.input) {
          val = el('input', { type: c.input === 'number' ? 'number' : 'text', class: 'jb-val', value: on ? rule.on[c.id] : c.value, 'aria-label': c.label, min: '1', max: '365' });
          val.disabled = !on;
          val.addEventListener('input', function () { rule.on[c.id] = val.value; update(); });
          lab.append(val);
        }
        cb.addEventListener('change', function () {
          if (cb.checked) rule.on[c.id] = val ? val.value : '';
          else delete rule.on[c.id];
          lab.classList.toggle('on', cb.checked);
          if (val) val.disabled = !cb.checked;
          update();
        });
        conds.append(lab);
      });
      box.append(conds);

      var row = el('div', { class: 'jb-row' });
      var mode = el('select', { 'aria-label': 'How rule ' + (i + 1) + ' combines its conditions' });
      [['AND', 'All conditions match'], ['OR', 'Any condition matches']].forEach(function (o) { var op = el('option', { value: o[0] }, o[1]); if (rule.mode === o[0]) op.selected = true; mode.append(op); });
      mode.addEventListener('change', function () { rule.mode = mode.value; update(); });
      var sw = el('div', { class: 'jb-swatches', role: 'radiogroup', 'aria-label': 'Rule ' + (i + 1) + ' colour' });
      SWATCHES.forEach(function (hex) {
        var b = el('button', { type: 'button', class: 'jb-sw' + (hex === rule.colour ? ' on' : ''), role: 'radio', 'aria-checked': String(hex === rule.colour), 'aria-label': hex, title: hex });
        b.style.background = hex;
        b.addEventListener('click', function () { rule.colour = hex; render(); });
        sw.append(b);
      });
      row.append(mode, sw);
      box.append(row);

      var out = el('div', { class: 'jb-out' });
      var code = el('code', {});
      var btn = el('button', { type: 'button', class: 'jb-copy' }, 'Copy JQL');
      btn.addEventListener('click', function () { copy(jqlFor(rule), btn); });
      out.append(code, btn);
      box.append(out);
      list.append(box);

      function update() {
        var j = jqlFor(rule);
        code.textContent = j || 'Tick at least one condition.';
        btn.disabled = !j;
        renderPreview();
      }
      update();
    });
    root.querySelector('.jb-add').disabled = rules.length >= 8;
    renderPreview();
  }

  var CARDS = [
    { title: 'Checkout fails when the card needs 3-D Secure', key: 'MOB-1', type: 'Bug', labels: ['blocked'], due: -3, prio: 'Highest', status: 'In Progress', updated: 2 },
    { title: 'Rotate the payment provider API keys', key: 'MOB-4', type: 'Task', labels: ['security'], due: -1, prio: 'High', status: 'To Do', updated: 1 },
    { title: 'Offline mode for saved trips', key: 'MOB-7', type: 'Story', labels: ['customer'], due: 12, prio: 'Medium', status: 'In Progress', updated: 9 },
    { title: 'Login screen ignores the system font size', key: 'MOB-11', type: 'Bug', labels: ['design'], due: 20, prio: 'Low', status: 'In Progress', updated: 1 },
    { title: 'Redesign the onboarding screens', key: 'MOB-3', type: 'Story', labels: ['design'], due: 4, prio: 'Medium', status: 'To Do', updated: 3 },
  ];
  function matches(card, rule) {
    var ids = CONDITIONS.filter(function (c) { return Object.prototype.hasOwnProperty.call(rule.on, c.id); });
    if (!ids.length) return false;
    var tests = ids.map(function (c) {
      var v = String(rule.on[c.id] || '').toLowerCase();
      switch (c.id) {
        case 'overdue': return card.due < 0;
        case 'soon': return card.due >= 0 && card.due <= (parseInt(v, 10) || 7);
        case 'label': return card.labels.indexOf(v || 'blocked') >= 0;
        case 'priority': return card.prio === 'Highest' || card.prio === 'High';
        case 'type': return card.type.toLowerCase() === (v || 'bug');
        case 'stale': return card.status === 'In Progress' && card.updated >= (parseInt(v, 10) || 7);
        default: return false;
      }
    });
    return rule.mode === 'OR' ? tests.some(Boolean) : tests.every(Boolean);
  }
  function renderPreview() {
    var box = root.querySelector('.jb-preview');
    box.textContent = '';
    CARDS.forEach(function (card) {
      var hit = null;
      for (var i = 0; i < rules.length; i++) if (matches(card, rules[i])) { hit = rules[i]; break; }
      var c = el('div', { class: 'jb-card' });
      c.style.borderLeftColor = hit ? hit.colour : 'transparent';
      c.append(el('div', { class: 'jb-ctitle' }, card.title));
      var meta = el('div', { class: 'jb-cmeta' });
      card.labels.forEach(function (l) { meta.append(el('span', { class: 'jb-lab' }, l)); });
      meta.append(el('span', { class: 'jb-key' }, card.key + ' · ' + card.type));
      c.append(meta);
      c.append(el('div', { class: 'jb-why' }, hit ? 'Matched: ' + (hit.name || 'a rule') : 'No rule matched'));
      box.append(c);
    });
  }

  root.querySelector('.jb-add').addEventListener('click', function () {
    if (rules.length >= 8) return;
    rules.push({ name: 'New rule', on: { label: 'urgent' }, mode: 'AND', colour: SWATCHES[rules.length % SWATCHES.length] });
    render();
  });
  root.hidden = false;
  var off = document.getElementById('jb-nojs');
  if (off) off.hidden = true;
  render();
})();
