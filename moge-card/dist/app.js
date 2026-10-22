(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var canvas = $('#pet');
  var ctx = canvas.getContext('2d');
  var scene = $('#scene');
  var W = 452, H = 424, TAU = Math.PI * 2;
  var layout = window.ORB_LAYOUT;
  var themes = {
    dusk: { page: '#d5dce6', ink: '#2c333c', accent: '#d4654e', soft: '#f6e6df', tint: null },
    lamp: { page: '#ead9b8', ink: '#3e3428', accent: '#c4883a', soft: '#f8efd8', tint: '#f0c27a' },
    moss: { page: '#c9ddd2', ink: '#24362e', accent: '#3f8f72', soft: '#e5f3ec', tint: '#b7d8c8' },
    rose: { page: '#f0d5de', ink: '#4a3038', accent: '#c46b86', soft: '#fbeaf0', tint: '#f0c2d0' }
  };
  var storeKey = 'moge-card-v1';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(storeKey) || '{}') || {}; } catch (err) { saved = {}; }
  var theme = themes[saved.theme] ? saved.theme : 'dusk';
  var sound = saved.sound === true;
  var signature = $('#signature');
  var note = $('#note');
  signature.textContent = typeof saved.signature === 'string' ? Array.from(saved.signature).slice(0, 24).join('') : '和墨格';
  note.textContent = typeof saved.note === 'string' ? Array.from(saved.note).slice(0, 240).join('') : '';
  var storageWarned = false;

  function toast(message) {
    var el = $('#toast');
    el.textContent = message;
    el.classList.add('visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { el.classList.remove('visible'); }, 2800);
  }
  function persist() {
    try {
      localStorage.setItem(storeKey, JSON.stringify({
        theme: theme,
        sound: sound,
        signature: signature.textContent,
        note: note.textContent
      }));
    } catch (err) {
      if (!storageWarned) {
        toast('浏览器未允许保存，关闭页面前请先保存图片');
        storageWarned = true;
      }
    }
  }
  function drawAvatar() {
    var c = $('#avatar').getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, 192, 192);
    c.fillStyle = themes[theme].soft;
    c.fillRect(0, 0, 192, 192);
    c.save();
    c.translate(96, 108);
    c.scale(0.9, 0.9);
    window.paintOrb(c, { mood: 'idle', p: 0, e: 0, t: 0.4 }, env, { avatar: true });
    c.restore();
  }
  function setTheme(name) {
    theme = name;
    var p = themes[name];
    var root = document.documentElement.style;
    root.setProperty('--page', p.page);
    root.setProperty('--ink', p.ink);
    root.setProperty('--accent', p.accent);
    root.setProperty('--soft', p.soft);
    var meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.content = p.page;
    var swatches = document.querySelectorAll('[data-theme]');
    for (var i = 0; i < swatches.length; i++) swatches[i].setAttribute('aria-pressed', swatches[i].dataset.theme === name ? 'true' : 'false');
    drawAvatar();
  }

  var audio;
  function chime(mood) {
    if (!sound) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audio) audio = new Ctx();
      audio.resume();
      var notes = mood === 'celebrate' ? [523.25, 659.25, 783.99] : mood === 'angry' ? [196, 164.81] : mood === 'sad' ? [349.23, 293.66] : [494, 587.33];
      for (var i = 0; i < notes.length; i++) {
        var o = audio.createOscillator();
        var g = audio.createGain();
        var when = audio.currentTime + i * 0.09;
        o.type = 'sine';
        o.frequency.setValueAtTime(notes[i], when);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.exponentialRampToValueAtTime(0.04, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + 0.28);
        o.connect(g);
        g.connect(audio.destination);
        o.start(when);
        o.stop(when + 0.3);
      }
    } catch (err) {}
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }
  function ease(x) { return smooth(clamp(x, 0, 1)); }

  var durations = { happy: 2900, celebrate: 3600, sad: 3400, angry: 2800, sleep: 8500, pet: 2600, look: 1900, typing: 2200, land: 900 };
  var action = null;
  var lastActivity = performance.now();
  var lastTime = 0;
  var pendingAction = null;
  var pendingTimer = 0;
  var pointer = { x: 0, y: 0, near: false };
  var drag = null;
  var dragX = 0, dragY = 0, aimX = 0, aimY = 0, offsetX = 0;
  var lookCooldown = 0, typingCooldown = 0, autoSleep = false, watchUntil = 0, watchKind = 'look';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var frames = 0;
  var frozen = null;
  var env = { offsetX: 0, offsetY: 0, dragX: 0, dragY: 0, reduced: reduced, pointer: pointer, clamp: clamp };

  function highlight(mood) {
    var buttons = document.querySelectorAll('[data-action]');
    for (var i = 0; i < buttons.length; i++) buttons[i].setAttribute('aria-pressed', buttons[i].dataset.action === mood ? 'true' : 'false');
  }
  function activity() { lastActivity = performance.now(); }
  function start(mood, opts) {
    opts = opts || {};
    if (action || drag) return false;
    frozen = null;
    clearTimeout(pendingTimer);
    pendingAction = null;
    watchUntil = 0;
    action = { mood: mood, start: performance.now(), duration: durations[mood] || 2500, automatic: !!opts.automatic, fromGrab: opts.fromGrab || 0 };
    autoSleep = !!opts.automatic;
    highlight(mood);
    if (!opts.silent && mood !== 'sleep' && mood !== 'typing' && mood !== 'look' && mood !== 'land') chime(mood);
    return true;
  }
  function wake() {
    if (action && action.mood === 'sleep' && !action.wake) {
      var now = performance.now();
      var raw = clamp((now - action.start) / action.duration, 0, 1);
      var phase = action.automatic && raw >= 1 ? 0.5 : raw;
      action.wake = { time: now, phase: phase, amplitude: ease(phase / 0.2) * (1 - ease((phase - 0.78) / 0.22)) };
      action.automatic = false;
      autoSleep = false;
    }
  }
  function stateAt(now) {
    var mood = 'idle', p = 0, e = 0, fromGrab = 0;
    if (drag && drag.held) {
      return { mood: 'grab', p: (now - drag.grabAt) / 1000, e: ease((now - drag.grabAt) / 220), t: now / 1000, fromGrab: 0 };
    }
    if (frozen) return { mood: frozen.mood, p: frozen.p, e: frozen.e, t: now / 1000, fromGrab: frozen.fromGrab || 0 };
    if (action) {
      var waking = action.wake;
      p = waking ? (now - waking.time >= 550 ? 1 : waking.phase) : clamp((now - action.start) / action.duration, 0, 1);
      mood = action.mood;
      fromGrab = action.fromGrab || 0;
      if (p >= 1) {
        if (action.automatic && mood === 'sleep') p = 0.5;
        else {
          action = null;
          autoSleep = false;
          highlight(null);
          activity();
          mood = 'idle';
          p = 0;
          var next = pendingAction;
          pendingAction = null;
          if (next) pendingTimer = setTimeout(function () { start(next); }, 180);
        }
      }
      e = waking && action ? waking.amplitude * (1 - ease((now - waking.time) / 550)) : ease(p / 0.2) * (1 - ease((p - 0.78) / 0.22));
      if (mood === 'sleep' && !(waking && action)) {
        var shut = ease(clamp(p / 0.07, 0, 1)) * (1 - ease(clamp((p - 0.78) / 0.22, 0, 1)));
        if (shut > e) e = shut;
      }
    }
    if (!action && !drag && now < watchUntil) {
      mood = watchKind;
      p = 1 - (watchUntil - now) / 2200;
      e = ease((2200 - (watchUntil - now)) / 250) * ease((watchUntil - now) / 450);
    }
    return { mood: mood, p: p, e: e, t: now / 1000, fromGrab: fromGrab };
  }

  function syncEnv() {
    env.offsetX = offsetX;
    env.dragX = dragX;
    env.dragY = dragY;
    env.pointer = pointer;
    env.reduced = reduced;
  }
  function drawPet(c, state, opts) {
    syncEnv();
    if (!opts || !opts.avatar) window.paintRoom(c, themes[theme].tint);
    window.paintOrb(c, state, env, opts || {});
  }
  function fit() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var rect = canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(rect.width * dpr));
    var h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(scene);
  else window.addEventListener('resize', fit);

  function tick(now) {
    var dt = Math.min(40, now - (lastTime || now));
    lastTime = now;
    frames += 1;
    if (!action && !drag && !frozen && now - lastActivity > 23000 && !(document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true')) {
      start('sleep', { automatic: true, silent: true });
    }
    var f = 1 - Math.exp(-dt / 90);
    dragX = lerp(dragX, aimX, f);
    dragY = lerp(dragY, aimY, f);
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    drawPet(ctx, stateAt(now));
    requestAnimationFrame(tick);
  }

  function point(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * W / r.width, y: (ev.clientY - r.top) * H / r.height };
  }
  function hit(pt) {
    var x = pt.x - offsetX - dragX;
    var y = pt.y - dragY;
    return Math.pow((x - layout.x) / layout.rx, 2) + Math.pow((y - layout.y) / layout.ry, 2) < 1;
  }
  function showLook(kind) {
    if (performance.now() - (kind === 'typing' ? typingCooldown : lookCooldown) < (kind === 'typing' ? 2500 : 3500)) return;
    if (kind === 'typing') typingCooldown = performance.now();
    else lookCooldown = performance.now();
    watchUntil = performance.now() + 2200;
    watchKind = kind;
  }

  canvas.addEventListener('pointermove', function (ev) {
    var pt = point(ev);
    pointer.x = (pt.x - (layout.x + offsetX + dragX)) / 160;
    pointer.y = (pt.y - (layout.y + dragY)) / 160;
    if (drag && drag.id === ev.pointerId) {
      var dx = pt.x - drag.x;
      var dy = pt.y - drag.y;
      if (Math.hypot(dx, dy) > 8) drag.moved = true;
      if (drag.moved || drag.held) {
        if (!drag.held) {
          drag.held = true;
          drag.grabAt = performance.now();
          frozen = null;
        }
        aimX = clamp(dx, -70 - offsetX, 62 - offsetX);
        aimY = clamp(dy, -78, 12);
        wake();
        highlight(null);
      }
      activity();
      return;
    }
    if (ev.pointerType === 'mouse' && !drag) {
      var near = hit(pt) || Math.pow((pt.x - layout.x - offsetX) / 150, 2) + Math.pow((pt.y - layout.y) / 140, 2) < 1;
      if (near && !pointer.near) {
        pointer.near = true;
        activity();
        wake();
        if (!action) showLook('look');
      }
      if (!near) pointer.near = false;
    }
  });
  canvas.addEventListener('pointerleave', function () { pointer.near = false; });
  canvas.addEventListener('pointerdown', function (ev) {
    if (ev.button !== 0) return;
    var pt = point(ev);
    activity();
    wake();
    if (!hit(pt) || action) {
      if (!action && !hit(pt) && ev.pointerType !== 'mouse') showLook('look');
      return;
    }
    frozen = null;
    watchUntil = 0;
    drag = { id: ev.pointerId, x: pt.x, y: pt.y, time: performance.now(), moved: false, held: false };
    try { canvas.setPointerCapture(ev.pointerId); } catch (err) {}
    drag.timer = setTimeout(function () {
      if (drag && !drag.held) {
        drag.held = true;
        drag.grabAt = performance.now();
        chime('sad');
      }
    }, 280);
    if (ev.cancelable) ev.preventDefault();
  });
  function release(ev, cancelled) {
    if (!drag || drag.id !== ev.pointerId) return;
    var held = drag.held;
    var moved = drag.moved;
    var fromGrab = held ? ease((performance.now() - drag.grabAt) / 220) : 0;
    clearTimeout(drag.timer);
    drag = null;
    if (canvas.releasePointerCapture && canvas.hasPointerCapture && canvas.hasPointerCapture(ev.pointerId)) {
      try { canvas.releasePointerCapture(ev.pointerId); } catch (err) {}
    }
    if (held || moved) {
      offsetX = clamp(offsetX + dragX, -70, 62);
      dragX = 0;
      aimX = 0;
      aimY = 0;
      start('land', { silent: true, fromGrab: fromGrab });
    } else {
      aimX = 0;
      aimY = 0;
      if (!cancelled) start('pet');
    }
    activity();
  }
  canvas.addEventListener('pointerup', function (ev) { release(ev, false); });
  canvas.addEventListener('pointercancel', function (ev) { release(ev, true); });
  canvas.addEventListener('lostpointercapture', function (ev) { release(ev, true); });
  canvas.addEventListener('contextmenu', function (ev) { ev.preventDefault(); });
  canvas.addEventListener('keydown', function (ev) {
    if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      activity();
      wake();
      start('pet');
    } else if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight' || ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      activity();
      if (!action && !drag) {
        offsetX = clamp(offsetX + (ev.key === 'ArrowRight' ? 14 : ev.key === 'ArrowLeft' ? -14 : 0), -70, 62);
        start('look', { silent: true });
      }
    }
  });

  var actionButtons = document.querySelectorAll('[data-action]');
  for (var a = 0; a < actionButtons.length; a++) {
    actionButtons[a].addEventListener('click', function (ev) {
      activity();
      var mood = ev.currentTarget.dataset.action;
      if (action && action.mood === 'sleep') {
        pendingAction = mood === 'sleep' ? null : mood;
        wake();
      } else if (action) {
        if (action.mood !== mood) pendingAction = mood;
      } else start(mood);
    });
  }

  var editors = document.querySelectorAll('[data-edit]');
  for (var e = 0; e < editors.length; e++) {
    editors[e].addEventListener('click', function (ev) {
      var el = document.getElementById(ev.currentTarget.dataset.edit);
      if (el.contentEditable === 'true') { el.blur(); return; }
      el.contentEditable = 'true';
      ev.currentTarget.setAttribute('aria-pressed', 'true');
      el.focus();
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      activity();
      wake();
    });
  }
  var composing = false;
  function limitText(el) {
    var max = Number(el.dataset.limit);
    var text = (el.innerText || el.textContent || '').replace(/\r/g, '');
    if (el === signature) text = text.replace(/\n/g, ' ');
    var chars = Array.from(text);
    if (chars.length > max || el.children.length || el.textContent !== text) {
      el.textContent = chars.slice(0, max).join('');
      if (document.activeElement === el) {
        var range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }
  function bindText(el) {
    el.addEventListener('compositionstart', function () { composing = true; });
    el.addEventListener('compositionend', function () { composing = false; limitText(el); persist(); });
    el.addEventListener('input', function () {
      if (!composing) limitText(el);
      persist();
      activity();
      wake();
      if (!action && !drag) {
        pointer.x = 0.45;
        pointer.y = 0.65;
        showLook('typing');
      }
    });
    el.addEventListener('paste', function (ev) {
      ev.preventDefault();
      var raw = ev.clipboardData ? ev.clipboardData.getData('text/plain') : '';
      if (el === signature) raw = raw.replace(/[\r\n]+/g, ' ');
      if (document.execCommand) document.execCommand('insertText', false, raw);
      else el.textContent = (el.textContent || '') + raw;
      limitText(el);
      persist();
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.isComposing) return;
      if (ev.key === 'Escape' || (ev.key === 'Enter' && (el === signature || ev.ctrlKey || ev.metaKey))) {
        ev.preventDefault();
        el.blur();
      }
    });
    el.addEventListener('blur', function () {
      limitText(el);
      el.contentEditable = 'false';
      var button = document.querySelector('[data-edit="' + el.id + '"]');
      if (button) button.setAttribute('aria-pressed', 'false');
      persist();
    });
  }
  bindText(signature);
  bindText(note);

  function toggleMenu(open) {
    $('#settings').hidden = !open;
    $('#menu-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  $('#menu-toggle').addEventListener('click', function () { activity(); toggleMenu($('#settings').hidden); });
  document.addEventListener('click', function (ev) { if (!ev.target.closest('.card-head')) toggleMenu(false); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') toggleMenu(false); });
  var themeButtons = document.querySelectorAll('[data-theme]');
  for (var t = 0; t < themeButtons.length; t++) {
    themeButtons[t].addEventListener('click', function (ev) {
      setTheme(ev.currentTarget.dataset.theme);
      persist();
      activity();
    });
  }
  $('#sound').setAttribute('aria-checked', sound ? 'true' : 'false');
  $('#sound').addEventListener('click', function () {
    sound = !sound;
    $('#sound').setAttribute('aria-checked', sound ? 'true' : 'false');
    persist();
    chime('happy');
    activity();
  });

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function updateDate() {
    var d = new Date();
    var y = d.getFullYear();
    var m = pad(d.getMonth() + 1);
    var day = pad(d.getDate());
    var el = $('#date');
    el.dateTime = y + '-' + m + '-' + day;
    el.textContent = y + '年' + m + '月' + day + '日';
  }
  updateDate();
  setInterval(updateDate, 30000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { lastTime = 0; activity(); updateDate(); }
  });

  function exportCard() {
    var card = $('.pet-card');
    var r = card.getBoundingClientRect();
    var scale = 3;
    var out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(r.width * scale));
    out.height = Math.max(1, Math.round(r.height * scale));
    var c = out.getContext('2d');
    c.scale(scale, scale);
    var paper = getComputedStyle(card).backgroundColor || '#f6f1e7';
    c.fillStyle = paper;
    c.fillRect(0, 0, r.width, r.height);
    function rect(el) {
      var b = el.getBoundingClientRect();
      return { x: b.x - r.x, y: b.y - r.y, w: b.width, h: b.height };
    }
    var sc = rect(canvas);
    c.drawImage(canvas, sc.x, sc.y, sc.w, sc.h);
    var av = rect($('#avatar'));
    c.save();
    c.beginPath();
    c.arc(av.x + av.w / 2, av.y + av.h / 2, av.w / 2, 0, TAU);
    c.clip();
    c.drawImage($('#avatar'), av.x, av.y, av.w, av.h);
    c.restore();
    function round(x, y, w, h, rad, fill) {
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(x + rad, y);
      c.arcTo(x + w, y, x + w, y + h, rad);
      c.arcTo(x + w, y + h, x, y + h, rad);
      c.arcTo(x, y + h, x, y, rad);
      c.arcTo(x, y, x + w, y, rad);
      c.closePath();
      c.fill();
    }
    var pressed = document.querySelectorAll('[data-action]');
    for (var i = 0; i < pressed.length; i++) {
      if (pressed[i].getAttribute('aria-pressed') === 'true') {
        var q = rect(pressed[i]);
        round(q.x, q.y, q.w, q.h, 13, themes[theme].soft);
      }
    }
    var svgs = document.querySelectorAll('.pet-card svg');
    for (var s = 0; s < svgs.length; s++) {
      var svg = svgs[s];
      if (svg.closest('.settings') || !svg.getBoundingClientRect().width) continue;
      var b = rect(svg);
      var v = svg.viewBox.baseVal;
      c.save();
      c.translate(b.x, b.y);
      c.scale(b.w / v.width, b.h / v.height);
      for (var n = 0; n < svg.children.length; n++) {
        var shape = svg.children[n];
        var st = getComputedStyle(shape);
        c.fillStyle = st.fill;
        c.strokeStyle = st.stroke;
        c.lineWidth = parseFloat(st.strokeWidth) || 1;
        c.lineCap = st.strokeLinecap;
        c.lineJoin = st.strokeLinejoin;
        var path = null;
        var tag = shape.tagName.toLowerCase();
        if (tag === 'circle') {
          path = new Path2D();
          path.arc(+shape.getAttribute('cx'), +shape.getAttribute('cy'), +shape.getAttribute('r'), 0, TAU);
        } else if (tag === 'rect') {
          path = new Path2D();
          path.rect(+shape.getAttribute('x'), +shape.getAttribute('y'), +shape.getAttribute('width'), +shape.getAttribute('height'));
        } else if (shape.hasAttribute('d')) path = new Path2D(shape.getAttribute('d'));
        if (path) {
          if (st.fill && st.fill !== 'none') c.fill(path);
          if (st.stroke && st.stroke !== 'none') c.stroke(path);
        }
      }
      c.restore();
    }
    function text(el) {
      var style = getComputedStyle(el);
      var fs = parseFloat(style.fontSize);
      c.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
      c.fillStyle = style.color;
      c.textBaseline = 'alphabetic';
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      var node;
      while ((node = walker.nextNode())) {
        var buffer = '';
        var last = null;
        var flush = function () {
          if (last && buffer) c.fillText(buffer, last.x - r.x, last.y - r.y + fs * 0.82);
          buffer = '';
        };
        var content = node.textContent;
        for (var i = 0; i < content.length;) {
          var code = content.codePointAt(i);
          var len = code > 65535 ? 2 : 1;
          var ch = content.slice(i, i + len);
          var range = document.createRange();
          range.setStart(node, i);
          range.setEnd(node, i + len);
          var box = range.getBoundingClientRect();
          if (ch === '\n' || !box.width) { flush(); last = null; }
          else if (last && Math.abs(last.y - box.y) < 1) buffer += ch;
          else { flush(); last = box; buffer = ch; }
          i += len;
        }
        flush();
      }
    }
    var texts = document.querySelectorAll('h1, .actions span, .share-button span, #signature, #note, #date');
    for (var u = 0; u < texts.length; u++) text(texts[u]);
    var sr = rect($('.share-row'));
    c.fillStyle = getComputedStyle(card).getPropertyValue('--line').trim() || '#eadfce';
    c.fillRect(sr.x, sr.y, sr.w, 1);
    return out;
  }

  var imageURL = '';
  var shareFile = null;
  var sharing = false;
  $('#share').addEventListener('click', function () {
    if (sharing) return;
    sharing = true;
    toggleMenu(false);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    updateDate();
    try {
      var out = exportCard();
      out.toBlob(function (blob) {
        sharing = false;
        if (!blob) { toast('图片暂时未能生成，请再试一次'); return; }
        if (imageURL) URL.revokeObjectURL(imageURL);
        imageURL = URL.createObjectURL(blob);
        $('#share-image').src = imageURL;
        $('#download').href = imageURL;
        var filename = '墨格-' + $('#date').dateTime + '.png';
        $('#download').download = filename;
        try { shareFile = new File([blob], filename, { type: 'image/png' }); } catch (err) { shareFile = null; }
        var dialog = $('#share-dialog');
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else {
          dialog.classList.add('dialog-fallback');
          dialog.setAttribute('open', '');
          dialog.setAttribute('aria-modal', 'true');
          $('#close-share').focus();
        }
      }, 'image/png');
    } catch (err) {
      sharing = false;
      toast('图片暂时未能生成，请再试一次');
    }
  });
  function closeShare() {
    var dialog = $('#share-dialog');
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      dialog.classList.remove('dialog-fallback');
    }
    $('#share').focus();
  }
  $('#close-share').addEventListener('click', closeShare);
  $('#share-dialog').addEventListener('click', function (ev) {
    if (ev.target === $('#share-dialog')) {
      var box = ev.target.getBoundingClientRect();
      if (ev.clientX < box.left || ev.clientX > box.right || ev.clientY < box.top || ev.clientY > box.bottom) closeShare();
    }
  });
  $('#share-dialog').addEventListener('cancel', function (ev) { ev.preventDefault(); closeShare(); });
  $('#system-share').addEventListener('click', function () {
    if (!shareFile) { toast('请长按图片保存，或点击保存图片'); return; }
    try {
      if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
        navigator.share({ files: [shareFile], title: '墨格' }).catch(function (err) {
          if (!err || err.name !== 'AbortError') toast('请长按图片保存，或点击保存图片');
        });
      } else toast('这个浏览器请长按图片保存，再分享给朋友');
    } catch (err) {
      toast('请长按图片保存，或点击保存图片');
    }
  });

  window.petFreeze = function (mood, p, amount, pos) {
    if (!mood) {
      frozen = null;
      highlight(null);
      aimX = 0;
      aimY = 0;
      dragX = 0;
      dragY = 0;
      return;
    }
    frozen = { mood: mood, p: p || 0, e: amount == null ? 1 : amount, fromGrab: mood === 'land' ? 1 : 0 };
    highlight(mood);
    if (pos) {
      aimX = pos.x || 0;
      aimY = pos.y || 0;
      dragX = pos.x || 0;
      dragY = pos.y || 0;
    }
  };

  setTheme(theme);
  fit();
  requestAnimationFrame(tick);
  Object.defineProperty(window, 'petStatus', {
    get: function () {
      var now = performance.now();
      var s = stateAt(now);
      return {
        mood: drag && drag.held ? 'grab' : (action ? action.mood : s.mood),
        progress: action ? clamp((now - action.start) / action.duration, 0, 1) : s.p,
        automaticSleep: autoSleep,
        dragging: !!(drag && drag.held),
        position: { x: offsetX + dragX, y: dragY },
        frames: frames,
        theme: theme,
        sound: sound,
        artReady: frames > 0
      };
    }
  });
})();
