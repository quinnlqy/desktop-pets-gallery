/* ==========================================================================
   app.js — 卡片界面 / 互动 / 编辑 / 截图导出
   ========================================================================== */
(function () {
  'use strict';

  const $ = sel => document.querySelector(sel);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  const card = $('#card');
  const stageEl = $('#stage');
  const actionsEl = $('#actions');
  const signEl = $('#sign');
  const talkEl = $('#talk');
  const dateEl = $('#date');
  const menu = $('#menu');
  const menuBtn = $('#menuBtn');

  const PAGE_BG = { mint: '#F2E9DB', sky: '#E8EFF7', night: '#1B1F24' };
  const STORE_KEY = 'miao.card.v1';

  /* ------------------------------------------------------------------ *
   * 声音（WebAudio 合成，无外部资源）
   * ------------------------------------------------------------------ */
  const Sound = {
    ctx: null,
    on: true,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    },
    play(notes) {
      if (!this.on) return;
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const t0 = this.ctx.currentTime;
      notes.forEach((nt, i) => {
        const [freq, dur, gain, type] = nt;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t0 + i * 0.055);
        o.frequency.exponentialRampToValueAtTime(freq * 0.98, t0 + i * 0.055 + dur);
        g.gain.setValueAtTime(0, t0 + i * 0.055);
        g.gain.linearRampToValueAtTime(gain, t0 + i * 0.055 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.055 + dur);
        o.connect(g).connect(this.ctx.destination);
        o.start(t0 + i * 0.055);
        o.stop(t0 + i * 0.055 + dur + 0.02);
      });
    },
    tap() { this.play([[520, 0.07, 0.05, 'triangle']]); },
    pet() { this.play([[523, 0.16, 0.05], [784, 0.24, 0.045]]); },
    cheer() { this.play([[523, 0.1, 0.05], [659, 0.1, 0.05], [784, 0.1, 0.05], [1046, 0.28, 0.05]]); },
    down() { this.play([[392, 0.18, 0.045, 'sine'], [311, 0.3, 0.04, 'sine']]); },
    puff() { this.play([[262, 0.22, 0.05, 'triangle']]); },
    yawn() { this.play([[330, 0.3, 0.04], [247, 0.42, 0.035]]); }
  };

  /* ------------------------------------------------------------------ *
   * 主题
   * ------------------------------------------------------------------ */
  const VAR_MAP = {
    card: '--card', cardEdge: '--card-edge', ink: '--ink', inkSoft: '--ink-soft',
    accent: '--accent', accentSoft: '--accent-soft', accentInk: '--accent-ink',
    chip: '--chip', chipLine: '--chip-line', shadow: '--shadow'
  };

  function applyTheme(key) {
    const t = PET.THEMES[key] || PET.THEMES.mint;
    const root = document.documentElement;
    Object.keys(VAR_MAP).forEach(k => {
      if (t[k]) root.style.setProperty(VAR_MAP[k], t[k]);
    });
    root.style.setProperty('--page', PAGE_BG[key] || PAGE_BG.mint);
    root.setAttribute('data-theme', key);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', t.card);
    document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.theme === key));
  }

  /* ------------------------------------------------------------------ *
   * 初始化舞台
   * ------------------------------------------------------------------ */
  let theme = 'mint';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { saved = {}; }
  theme = saved.theme && PET.THEMES[saved.theme] ? saved.theme : 'mint';
  if (saved.sound === false) Sound.on = false;

  applyTheme(theme);
  const stage = new PET.Stage(stageEl, theme);
  $('#avatar').innerHTML = PET.avatarMarkup(PET.THEMES[theme]);

  /* 卡片配色色板 */
  const swatches = $('#swatches');
  Object.keys(PET.THEMES).forEach(k => {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.dataset.theme = k;
    b.title = PET.THEMES[k].label;
    b.setAttribute('aria-label', PET.THEMES[k].label);
    b.style.background = `radial-gradient(circle at 50% 50%, ${PET.THEMES[k].accent} 0 30%, ${PET.THEMES[k].card} 32% 100%)`;
    b.addEventListener('click', () => {
      theme = k;
      applyTheme(k);
      stage.setTheme(k);
      stage.poke();
      save();
      Sound.tap();
    });
    swatches.appendChild(b);
  });
  document.querySelectorAll('.swatch').forEach(s => s.classList.toggle('on', s.dataset.theme === theme));

  /* ------------------------------------------------------------------ *
   * 主循环
   * ------------------------------------------------------------------ */
  let last = performance.now();
  function loop(now) {
    const dt = (now - last) / 1000;
    last = now;
    stage.tick(dt);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /* ------------------------------------------------------------------ *
   * 互动
   * ------------------------------------------------------------------ */
  let down = false, dragging = false, startX = 0, startY = 0, pid = null;
  let wokeOnDown = false;
  let lastActivity = Date.now();
  let lastEnter = 0;

  function noteActivity() {
    lastActivity = Date.now();
  }

  function toSvgScale() {
    const r = stageEl.getBoundingClientRect();
    return 400 / Math.max(1, r.width);
  }

  stageEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    Sound.init();
    down = true; dragging = false; pid = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    wokeOnDown = stage.wake();
    noteActivity();
    if (!wokeOnDown) Sound.tap();
    try { stageEl.setPointerCapture(pid); } catch (err) { /* noop */ }
  });

  stageEl.addEventListener('pointermove', e => {
    const r = stageEl.getBoundingClientRect();
    if (e.pointerType === 'mouse' || !down) {
      stage.gazeTX = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.1, -1, 1);
      stage.gazeTY = clamp(((e.clientY - r.top) / r.height - 0.5) * 2.2, -1, 1);
      if (e.pointerType === 'mouse') noteActivity();
    }
    if (!down) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) > 7) {
      dragging = true;
      stage.grabStart();
      Sound.play([[440, 0.12, 0.04, 'triangle']]);
    }
    if (dragging) {
      const s = toSvgScale();
      stage.grabMove(dx * s, dy * s);
    }
  });

  function endPointer(e, cancelled) {
    if (!down) return;
    down = false;
    if (dragging) {
      stage.grabEnd();
      Sound.play([[300, 0.1, 0.05], [220, 0.16, 0.04]]);
    } else if (!cancelled && !wokeOnDown) {
      stage.poke();
      Sound.pet();
    }
    dragging = false;
    wokeOnDown = false;
    noteActivity();
  }

  stageEl.addEventListener('pointerup', e => endPointer(e, false));
  stageEl.addEventListener('pointercancel', e => endPointer(e, true));
  stageEl.addEventListener('pointerleave', e => {
    if (!down) { stage.gazeTX = 0; stage.gazeTY = 0; }
  });

  stageEl.addEventListener('pointerenter', e => {
    if (e.pointerType !== 'mouse') return;
    const now = Date.now();
    if (stage.state === 'idle' && now - lastEnter > 5000) {
      lastEnter = now;
      stage.setState('attention');
      Sound.play([[660, 0.08, 0.03, 'sine']]);
    }
    noteActivity();
  });

  /* 点击别处 -> 宠物转头看 */
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const r = stageEl.getBoundingClientRect();
    if (e.clientY > r.bottom + 30) { stage.gazeTX = 0; stage.gazeTY = 2; }
  }, { passive: true });

  /* 打字时关注 */
  document.addEventListener('keydown', () => {
    if (stage.state === 'sleep' || stage.state === 'wake') stage.wake();
    else if (stage.state === 'idle') stage.setState('attention');
    noteActivity();
  });

  /* 闲置打瞌睡 */
  setInterval(() => {
    const idleFor = (Date.now() - lastActivity) / 1000;
    if (idleFor > 22 && stage.state === 'idle' && !document.hidden) {
      stage.setState('sleep');
      Sound.yawn();
    }
  }, 1000);

  /* ------------------------------------------------------------------ *
   * 动作按钮
   * ------------------------------------------------------------------ */
  const ACT_SOUND = { happy: 'cheer', celebrate: 'cheer', sad: 'down', angry: 'puff', sleep: 'yawn' };

  actionsEl.addEventListener('click', e => {
    const btn = e.target.closest('.act');
    if (!btn) return;
    const act = btn.dataset.act;
    Sound.init();
    stage.setState(act);
    noteActivity();
    const s = ACT_SOUND[act];
    if (s) Sound[s]();
  });

  stage.onStateChange = name => {
    document.querySelectorAll('.act').forEach(b => {
      b.classList.toggle('on', b.dataset.act === name);
      b.setAttribute('aria-pressed', b.dataset.act === name ? 'true' : 'false');
    });
  };

  /* ------------------------------------------------------------------ *
   * 文字编辑 + 自动保存
   * ------------------------------------------------------------------ */
  const DEFAULTS = {
    sign: '喵仔的邻居',
    talk: '窗外的光刚好落在键盘上。'
  };

  function setText(el, val) {
    el.textContent = val || '';
  }

  setText(signEl, saved.sign !== undefined ? saved.sign : DEFAULTS.sign);
  setText(talkEl, saved.talk !== undefined ? saved.talk : DEFAULTS.talk);

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        sign: signEl.textContent,
        talk: talkEl.textContent,
        theme,
        sound: Sound.on
      }));
    } catch (e) { /* 隐私模式下忽略 */ }
  }

  let saveTimer = 0;
  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 320);
  }

  [signEl, talkEl].forEach(el => {
    el.addEventListener('input', () => { queueSave(); noteActivity(); });
    el.addEventListener('focus', () => { noteActivity(); });
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.execCommand('insertText', false, '\n');
        queueSave();
      }
    });
    el.addEventListener('paste', e => {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, txt.replace(/\r/g, ''));
      queueSave();
    });
  });

  document.querySelectorAll('.pencil').forEach(btn => {
    btn.addEventListener('click', () => {
      const el = document.getElementById(btn.dataset.edit);
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      noteActivity();
      Sound.tap();
    });
  });

  /* ------------------------------------------------------------------ *
   * 日期
   * ------------------------------------------------------------------ */
  function renderDate() {
    const d = new Date();
    const week = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()];
    dateEl.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${week}`;
  }
  renderDate();
  setInterval(renderDate, 60000);

  /* ------------------------------------------------------------------ *
   * 菜单
   * ------------------------------------------------------------------ */
  function closeMenu() {
    menu.hidden = true;
    menuBtn.setAttribute('aria-expanded', 'false');
  }
  menuBtn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    menuBtn.setAttribute('aria-expanded', menu.hidden ? 'false' : 'true');
  });
  document.addEventListener('click', e => {
    if (!menu.hidden && !menu.contains(e.target) && e.target !== menuBtn) closeMenu();
  });

  const soundToggle = $('#soundToggle');
  soundToggle.setAttribute('aria-checked', Sound.on ? 'true' : 'false');
  soundToggle.addEventListener('click', () => {
    Sound.on = !Sound.on;
    soundToggle.setAttribute('aria-checked', Sound.on ? 'true' : 'false');
    if (Sound.on) Sound.tap();
    save();
  });

  $('#resetText').addEventListener('click', () => {
    setText(signEl, DEFAULTS.sign);
    setText(talkEl, DEFAULTS.talk);
    save();
    closeMenu();
    Sound.tap();
  });

  /* ------------------------------------------------------------------ *
   * 导出：把整张卡片画成图片
   * ------------------------------------------------------------------ */
  const S = 2; // 2x 输出

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
  }

  function rel(el, cardRect) {
    const r = el.getBoundingClientRect();
    return { x: r.left - cardRect.left, y: r.top - cardRect.top, w: r.width, h: r.height };
  }

  function iconToImage(svgEl, color, px, strokeW) {
    return new Promise(resolve => {
      const clone = svgEl.cloneNode(true);
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      clone.setAttribute('width', px);
      clone.setAttribute('height', px);
      clone.setAttribute('viewBox', svgEl.getAttribute('viewBox') || '0 0 24 24');
      clone.querySelectorAll('*').forEach(n => {
        if (n.getAttribute('fill') === 'currentColor') n.setAttribute('fill', color);
        if (n.getAttribute('stroke') === 'currentColor') n.setAttribute('stroke', color);
      });
      clone.setAttribute('style',
        `fill:none;stroke:${color};stroke-width:${strokeW};stroke-linecap:round;stroke-linejoin:round`);
      const str = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
    });
  }

  /* 逐字测量，得到 DOM 里真实的换行位置 */
  function measureLines(el) {
    const text = el.textContent;
    if (!text) return [];
    const base = el.getBoundingClientRect();
    const lines = [];
    let cur = null;
    let pendingBreak = false;
    const range = document.createRange();

    const push = (top, left) => {
      cur = { text: '', x: left - base.left, top: top - base.top, h: 0 };
      lines.push(cur);
    };

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let tn;
    while ((tn = walker.nextNode())) {
      const s = tn.nodeValue || '';
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '\n') { pendingBreak = true; continue; }
        range.setStart(tn, i);
        range.setEnd(tn, i + 1);
        const r = range.getBoundingClientRect();
        if (!cur || pendingBreak || (cur.h && Math.abs(r.top - (base.top + cur.top)) > 1.5)) {
          push(r.top, r.left);
          pendingBreak = false;
        }
        cur.text += ch;
        cur.h = Math.max(cur.h, r.height);
      }
    }
    return lines.filter(l => l.text.length);
  }

  function fontOf(el) {
    const cs = getComputedStyle(el);
    const w = Math.round(parseInt(cs.fontWeight, 10) / 100) * 100;
    return `${w} ${cs.fontSize} ${cs.fontFamily}`;
  }

  function drawRichText(ctx, el, cardRect, color) {
    const lines = measureLines(el);
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    const r = rel(el, cardRect);
    if (!lines.length) {
      const ph = el.dataset.placeholder || '';
      if (!ph) return;
      ctx.font = fontOf(el);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.textAlign = 'left';
      ctx.fillText(ph, r.x + 2, r.y + fs * 1.1);
      ctx.globalAlpha = 1;
      return;
    }
    ctx.font = fontOf(el);
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    lines.forEach(l => {
      const baseline = r.y + l.top + l.h * 0.82;
      ctx.fillText(l.text, r.x + l.x, baseline);
    });
  }

  async function captureCard() {
    const cardRect = card.getBoundingClientRect();
    const W = Math.round(cardRect.width);
    const H = Math.round(cardRect.height);
    const cv = document.createElement('canvas');
    cv.width = W * S;
    cv.height = H * S;
    const ctx = cv.getContext('2d');
    ctx.scale(S, S);
    ctx.textBaseline = 'alphabetic';

    const cs = getComputedStyle(document.documentElement);
    const v = n => cs.getPropertyValue(n).trim();
    const cCard = v('--card'), cEdge = v('--card-edge'), cInk = v('--ink');
    const cSoft = v('--ink-soft'), cAccent = v('--accent');
    const radius = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 22;

    // 卡片底
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, radius);
    ctx.fillStyle = cCard;
    ctx.fill();
    ctx.save();
    ctx.clip();

    // —— 场景图 ——
    const stR = rel(stageEl, cardRect);
    try {
      const img = await stage.getStageImage(Math.round(stR.w * S));
      ctx.drawImage(img, stR.x, stR.y, stR.w, stR.h);
    } catch (err) {
      ctx.fillStyle = v('--accent-soft');
      ctx.fillRect(stR.x, stR.y, stR.w, stR.h);
    }

    // —— 顶部 ——
    const avR = rel($('#avatar'), cardRect);
    try {
      const av = await stage.getAvatarImage(Math.round(avR.w * S));
      ctx.save();
      ctx.beginPath();
      ctx.arc(avR.x + avR.w / 2, avR.y + avR.h / 2, avR.w / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(av, avR.x, avR.y, avR.w, avR.h);
      ctx.restore();
    } catch (err) { /* 头像失败不影响主体 */ }

    const nameEl = $('.name'), subEl = $('.sub');
    ctx.textAlign = 'left';
    ctx.fillStyle = cInk;
    ctx.font = fontOf(nameEl);
    let nr = rel(nameEl, cardRect);
    ctx.fillText(nameEl.textContent, nr.x, nr.y + nr.h * 0.78);

    ctx.fillStyle = cSoft;
    ctx.font = fontOf(subEl);
    let sr = rel(subEl, cardRect);
    ctx.fillText(subEl.textContent, sr.x, sr.y + sr.h * 0.8);

    // 三点
    const mb = rel(menuBtn, cardRect);
    ctx.fillStyle = cInk;
    [0, 7, 14].forEach(dx => {
      ctx.beginPath();
      ctx.arc(mb.x + mb.w / 2 - 7 + dx, mb.y + mb.h / 2, 1.9, 0, Math.PI * 2);
      ctx.fill();
    });

    // —— 动作按钮 ——
    const btnEls = Array.from(document.querySelectorAll('.act'));
    const glyphs = await Promise.all(btnEls.map(b => {
      const on = b.classList.contains('on');
      return iconToImage(b.querySelector('svg'), on ? '#ffffff' : cSoft, 50, on ? 2.3 : 1.7);
    }));

    btnEls.forEach((b, i) => {
      const on = b.classList.contains('on');
      const br = rel(b, cardRect);
      ctx.save();
      if (on) {
        roundRect(ctx, br.x, br.y, br.w, br.h, 13);
        ctx.fillStyle = cAccent;
        ctx.fill();
      }
      const img = glyphs[i];
      if (img) {
        const gs = 25, gy = br.y + 7, gx = br.x + (br.w - gs) / 2;
        ctx.drawImage(img, gx, gy, gs, gs);
      }
      const lb = b.querySelector('span');
      const lr = rel(lb, cardRect);
      const lcs = getComputedStyle(lb);
      ctx.fillStyle = on ? '#ffffff' : cSoft;
      ctx.font = fontOf(lb);
      ctx.textAlign = 'center';
      ctx.fillText(lb.textContent, lr.x + lr.w / 2, lr.y + lr.h * 0.8);
      ctx.restore();
    });

    // —— 文字块 ——
    const pencilImgs = await Promise.all(Array.from(document.querySelectorAll('.pencil')).map(p =>
      iconToImage(p.querySelector('svg'), cSoft, 40, 1.7)));

    document.querySelectorAll('.pencil').forEach((p, i) => {
      const pr = rel(p, cardRect);
      if (pencilImgs[i]) {
        const ps = 15;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(pencilImgs[i], pr.x + (pr.w - ps) / 2, pr.y + (pr.h - ps) / 2, ps, ps);
        ctx.globalAlpha = 1;
      }
    });

    drawRichText(ctx, signEl, cardRect, cInk);
    drawRichText(ctx, talkEl, cardRect, cInk);

    const dr = rel(dateEl, cardRect);
    ctx.font = fontOf(dateEl);
    ctx.fillStyle = cSoft;
    ctx.textAlign = 'left';
    ctx.fillText(dateEl.textContent, dr.x, dr.y + dr.h * 0.78);

    // —— 分享按钮 ——
    const shR = rel($('#shareBtn'), cardRect);
    ctx.fillStyle = cAccent;
    ctx.fillRect(shR.x, shR.y - 1, shR.w + 1, shR.h + 2);

    const shIcon = await iconToImage($('#shareBtn svg'), '#ffffff', 40, 1.9);
    const shLabel = $('#shareBtn');
    ctx.font = fontOf(shLabel);
    ctx.textAlign = 'center';
    const labelText = shLabel.textContent.trim();
    const tw = ctx.measureText(labelText).width;
    const gap = 7, iw = 17;
    const totalW = tw + gap + iw;
    const cx = shR.x + shR.w / 2;
    const cy = shR.y + shR.h / 2 - (parseFloat(getComputedStyle(shLabel).paddingBottom) > 16 ? 8 : 0);
    if (shIcon) ctx.drawImage(shIcon, cx - totalW / 2, cy - iw / 2, iw, iw);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(labelText, cx - totalW / 2 + iw + gap, cy + 5);

    ctx.restore();

    // 卡片描边
    roundRect(ctx, 0.5, 0.5, W - 1, H - 1, radius);
    ctx.strokeStyle = cEdge;
    ctx.lineWidth = 1;
    ctx.stroke();

    return cv;
  }

  /* ------------------------------------------------------------------ *
   * 分享面板
   * ------------------------------------------------------------------ */
  const sheet = $('#sheet');
  const shotImg = $('#shotImg');
  const downloadBtn = $('#downloadBtn');
  const systemShare = $('#systemShare');
  let lastFile = null;

  function openSheet(url) {
    shotImg.src = url;
    sheet.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeSheet() {
    sheet.hidden = true;
    document.body.style.overflow = '';
  }

  $('#shareBtn').addEventListener('click', async () => {
    const btn = $('#shareBtn');
    if (btn.dataset.busy) return;
    btn.dataset.busy = '1';
    Sound.tap();
    try {
      const cv = await captureCard();
      const url = cv.toDataURL('image/png');
      openSheet(url);
      downloadBtn.href = url;
      cv.toBlob(blob => {
        if (!blob) return;
        lastFile = new File([blob], 'miao-moment.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [lastFile] })) {
          systemShare.hidden = false;
        }
      }, 'image/png');
    } catch (err) {
      alert('这张图没画出来，请再试一次。');
    } finally {
      delete btn.dataset.busy;
    }
  });

  $('#sheetClose').addEventListener('click', closeSheet);
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });
  $('#sheetTip').textContent = ('ontouchstart' in window) ? '长按图片可以保存到相册' : '右键图片或点“保存图片”';

  systemShare.addEventListener('click', async () => {
    if (!lastFile || !navigator.share) return;
    try {
      await navigator.share({ files: [lastFile], title: '喵仔的这一刻' });
    } catch (e) { /* 用户取消 */ }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !sheet.hidden) closeSheet();
  });

  /* 暴露给外部调试 / 自动化测试 */
  window.__miao = {
    stage, captureCard, setText, save, theme: () => theme,
    captureStage: async (w) => {
      const img = await stage.getStageImage(w || 360);
      const c = document.createElement('canvas');
      c.width = w || 360;
      c.height = Math.round((w || 360) * 330 / 400);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/png');
    }
  };
})();
