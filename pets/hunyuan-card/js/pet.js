/* ==========================================================================
   pet.js — 喵仔 · 角色装配 / 场景 / 动画引擎
   角色设定：WorkBuddy 的机器人小猫
     · 白色大头 + 圆角猫耳（内耳深灰）
     · 黑色屏幕脸，表情全部由屏幕上的薄荷绿光眼完成（无嘴、无眉）
     · 两侧圆盘耳罩 + 一支细麦克风
     · 银灰胶囊身体、球形关节、圆盘手掌，短腿短手，无尾巴

   画风：AI 手绘（水粉/蜡笔）的六块位图部件 + 矢量屏幕眼。
     · 部件由 tests/rig-build.js 从一张"四肢分离"的角色图切出来，
       四肢是完整胶囊，绕关节旋转不会露断面；
     · 关节位置 / 基础角 / 装配位移全部是 script 实测写进 art-parts.js 的；
     · 眼睛必须留矢量：九个表情要精确控制开合弧度与视线，位图做不到一致。
   ========================================================================== */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 0. 主题色板（页面 CSS 变量与导出画布共用这一份）
   * ------------------------------------------------------------------ */
  const THEMES = {
    mint: {
      label: '薄荷木桌',
      card: '#FCF6ED', cardEdge: '#F0E2CE', ink: '#2C3037', inkSoft: '#8E8271',
      accent: '#27C09A', accentSoft: '#DCF4EA', accentInk: '#0A7757',
      chip: '#F4EADB', chipLine: '#E9D9C0',
      wall: '#F6EAD7', wallDot: '#E6D2B6', winSky: '#D9EEF7', winDeep: '#B7DCEB',
      winFrame: '#FCF7EF', wood: '#E4C098', woodTop: '#F1D9B9', woodEdge: '#C79B6F',
      cushion: '#F8D9CE', cushionLine: '#BF8A7A',
      mug: '#FCF7EF', steam: 'rgba(120,96,72,.35)',
      leaf: '#8CBE9C', leafDark: '#6EA37E',
      book1: '#8FB8C9', book2: '#E8A69B', book3: '#E9C97F',
      shadow: 'rgba(124,86,48,.22)', grain: 0.8,
      confetti: ['#27C09A', '#F2907F', '#F6CB63', '#79C3E8', '#B79BEA']
    },
    sky: {
      label: '云端午后',
      card: '#F7FAFE', cardEdge: '#E2EAF4', ink: '#28313D', inkSoft: '#7E8B9C',
      accent: '#3E9BE0', accentSoft: '#DEEDFA', accentInk: '#12588F',
      chip: '#ECF2FA', chipLine: '#DCE6F2',
      wall: '#E6F0F9', wallDot: '#CFDFEE', winSky: '#F0F8FC', winDeep: '#CBE6F3',
      winFrame: '#FFFFFF', wood: '#C9D8E6', woodTop: '#E0EBF5', woodEdge: '#9DB3C6',
      cushion: '#F3DDE4', cushionLine: '#C09AA6',
      mug: '#FFFFFF', steam: 'rgba(90,120,150,.32)',
      leaf: '#8FC7B0', leafDark: '#6BA893',
      book1: '#9FB6E0', book2: '#EFA9A0', book3: '#EFD08C',
      shadow: 'rgba(70,100,140,.20)', grain: 0.42,
      confetti: ['#3E9BE0', '#F2907F', '#F6CB63', '#4FC9A8', '#B79BEA']
    },
    night: {
      label: '夜色工位',
      card: '#272C33', cardEdge: '#343A43', ink: '#F3F5F7', inkSoft: '#9AA4B0',
      accent: '#37D3A4', accentSoft: '#2C4A44', accentInk: '#8FF0D0',
      chip: '#323942', chipLine: '#414A55',
      wall: '#333C48', wallDot: '#3D4753', winSky: '#17222F', winDeep: '#26384C',
      winFrame: '#4A5665', wood: '#6A5341', woodTop: '#836650', woodEdge: '#402F22',
      cushion: '#7A5A57', cushionLine: '#4C3835',
      mug: '#5D6B7A', steam: 'rgba(200,220,240,.28)',
      leaf: '#4F8A72', leafDark: '#3C6E5A',
      book1: '#4E6E86', book2: '#8A5B57', book3: '#8A7647',
      shadow: 'rgba(0,0,0,.38)', grain: 0.22,
      confetti: ['#37D3A4', '#F2907F', '#F6CB63', '#79C3E8', '#B79BEA']
    }
  };

  /* ------------------------------------------------------------------ *
   * 1. 小工具
   * ------------------------------------------------------------------ */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeIn = t => t * t * t;
  const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const n = v => (Math.round(v * 100) / 100).toString();
  const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);

  /* 眼睛：一根带圆头的粗描边曲线，天然是胶囊形。
     w = 笔画粗细（眼睛的"粗细"），span = 横向跨度，h = 竖向高度
     bend > 0 → 上拱（笑眼 ∩）；bend < 0 → 下凹（难受 ∪）；0 → 竖条 */
  function eyePath(cx, cy, w, h, bend, span) {
    const hh = Math.max(h / 2, 0.3);
    if (Math.abs(bend) < 0.06) {
      return `M ${n(cx)} ${n(cy - hh)} L ${n(cx)} ${n(cy + hh)}`;
    }
    const half = Math.max((span || w) / 2, 3);
    const k = Math.min(Math.abs(bend), 1);
    const arch = (hh * 0.7 + 3.2) * k;
    if (bend > 0) {
      const y0 = cy + Math.min(hh * 0.45, 2.6);
      return `M ${n(cx - half)} ${n(y0)} Q ${n(cx)} ${n(y0 - arch * 1.5)} ${n(cx + half)} ${n(y0)}`;
    }
    const y0 = cy - Math.min(hh * 0.45, 2.6);
    return `M ${n(cx - half)} ${n(y0)} Q ${n(cx)} ${n(y0 + arch * 1.5)} ${n(cx + half)} ${n(y0)}`;
  }

  /* 圆润四角星 —— WorkBuddy 标志里的那颗星 */
  function starPath(cx, cy, r) {
    const k = r, i = r * 0.26;
    return [
      `M ${n(cx)} ${n(cy - k)}`,
      `Q ${n(cx + i)} ${n(cy - i)} ${n(cx + k)} ${n(cy)}`,
      `Q ${n(cx + i)} ${n(cy + i)} ${n(cx)} ${n(cy + k)}`,
      `Q ${n(cx - i)} ${n(cy + i)} ${n(cx - k)} ${n(cy)}`,
      `Q ${n(cx - i)} ${n(cy - i)} ${n(cx)} ${n(cy - k)}`, 'Z'
    ].join(' ');
  }

  /* 眼睛坐标跟着 AI 手绘的屏幕走：PET_SCREEN = [cx, cy, rx, ry]。
     换素材只要重新生成 art-parts.js，这里不用改。 */
  const SCR = global.PET_SCREEN || [200, 126, 55, 43];
  const EYE_GAP = Math.max(10, SCR[2] * 0.315);
  const EYE_L = { x: SCR[0] - EYE_GAP, y: SCR[1] };
  const EYE_R = { x: SCR[0] + EYE_GAP, y: SCR[1] };
  /* 表情参数是按旧矢量屏幕(110x86)定的，手绘屏幕小一圈，整体缩一下保持比例 */
  const EYE_S = global.PET_SCREEN ? clamp(SCR[2] / 55, 0.62, 1) : 1;
  /* 手绘角色比原矢量角色高，整体缩一点，给"被拎起来"的拉伸留出头顶余量 */
  const PET_SCALE = global.PET_PARTS ? 0.92 : 1;

  /* ------------------------------------------------------------------ *
   * 2. 角色绘制
   * ------------------------------------------------------------------ */
  const INK = '#2C3037';

  function defsMarkup(t) {
    return `
  <defs>
    <linearGradient id="gHead" x1="0.25" y1="0.05" x2="0.75" y2="1">
      <stop offset="0" stop-color="#FFFFFF"/><stop offset="0.62" stop-color="#F1F4F6"/><stop offset="1" stop-color="#DDE3E8"/>
    </linearGradient>
    <linearGradient id="gBody" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#FAFBFC"/><stop offset="0.55" stop-color="#DFE5EA"/><stop offset="1" stop-color="#BFC8D0"/>
    </linearGradient>
    <linearGradient id="gLimb" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#E8EDF1"/><stop offset="1" stop-color="#C2CBD3"/>
    </linearGradient>
    <linearGradient id="gMetal" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#6B747F"/><stop offset="0.5" stop-color="#3B424B"/><stop offset="1" stop-color="#252A31"/>
    </linearGradient>
    <linearGradient id="gJoint" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#525A65"/><stop offset="1" stop-color="#2A2F36"/>
    </linearGradient>
    <radialGradient id="gScreen" cx="0.5" cy="0.32" r="0.86">
      <stop offset="0" stop-color="#2A3038"/><stop offset="0.55" stop-color="#191D23"/><stop offset="1" stop-color="#0D1014"/>
    </radialGradient>
    <filter id="eyeGlow" filterUnits="userSpaceOnUse" x="118" y="58" width="164" height="146">
      <feGaussianBlur stdDeviation="2.8" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3"/>
    </filter>
  </defs>`;
  }

  /* 头部（主角和头像共用一套画法，p 为 id 前缀，null 表示不输出 id） */
  function headMarkup(p) {
    const id = s => (p === null ? '' : ` id="${p}${s}"`);
    return `
    <g${id('head')}>
      <!-- 耳（在头后） -->
      <g${id('earL')}>
        <path d="M 129 102 Q 118 48 145 30 Q 168 18 189 86 Z" fill="url(#gHead)" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M 141 94 Q 134 57 149 43 Q 161 34 174 84 Z" fill="#3B424B"/>
      </g>
      <g${id('earR')}>
        <path d="M 271 102 Q 282 48 255 30 Q 232 18 211 86 Z" fill="url(#gHead)" stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"/>
        <path d="M 259 94 Q 266 57 251 43 Q 239 34 226 84 Z" fill="#3B424B"/>
      </g>

      <!-- 耳机罩 -->
      <g>
        <circle cx="126" cy="142" r="21" fill="url(#gMetal)" stroke="${INK}" stroke-width="3"/>
        <circle cx="126" cy="142" r="12" fill="#20252B"/>
        <circle cx="126" cy="142" r="4.6" fill="#7A8592"/>
        <circle cx="274" cy="142" r="21" fill="url(#gMetal)" stroke="${INK}" stroke-width="3"/>
        <circle cx="274" cy="142" r="12" fill="#20252B"/>
        <circle cx="274" cy="142" r="4.6" fill="#7A8592"/>
      </g>

      <!-- 头 -->
      <ellipse cx="200" cy="120" rx="76" ry="62" fill="url(#gHead)" stroke="${INK}" stroke-width="3.4"/>
      <path d="M 142 96 Q 158 76 190 72" fill="none" stroke="#FFFFFF" stroke-width="4.4" stroke-linecap="round" opacity="0.9"/>

      <!-- 屏幕脸 -->
      <ellipse cx="200" cy="126" rx="55" ry="43" fill="url(#gScreen)" stroke="#4A515A" stroke-width="2.2"/>
      <path d="M 158 110 Q 174 96 202 94" fill="none" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round" opacity="0.14"/>

      <!-- 眼睛 -->
      <g${id('gaze')}>
        <g${id('eyeL')}>
          <path${id('eyeLp')} d="${eyePath(EYE_L.x, EYE_L.y, 10, 26, 0)}" fill="none"
                stroke="#3EE3A8" stroke-width="10" stroke-linecap="round" filter="url(#eyeGlow)"/>
          <path${id('eyeLs')} d="${starPath(EYE_L.x, EYE_L.y, 13)}" fill="#3EE3A8" opacity="0" filter="url(#eyeGlow)"/>
        </g>
        <g${id('eyeR')}>
          <path${id('eyeRp')} d="${eyePath(EYE_R.x, EYE_R.y, 10, 26, 0)}" fill="none"
                stroke="#3EE3A8" stroke-width="10" stroke-linecap="round" filter="url(#eyeGlow)"/>
          <path${id('eyeRs')} d="${starPath(EYE_R.x, EYE_R.y, 13)}" fill="#3EE3A8" opacity="0" filter="url(#eyeGlow)"/>
        </g>
      </g>

      <!-- 麦克风 -->
      <path d="M 267 160 Q 264 182 246 187" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>
      <circle cx="242" cy="188" r="5.6" fill="#3B424B" stroke="${INK}" stroke-width="2.4"/>
    </g>`;
  }

  /* 角色装配：AI 手绘的六块部件（头/身/四肢）+ 矢量屏幕眼
     四肢在原图里就是独立胶囊，绕关节旋转不会露出断面；
     屏幕里的眼睛保留矢量，九个表情才能精确控制开合、弧度与视线。 */
  function petMarkup() {
    const P = global.PET_PARTS;
    if (!P) {
      // 兜底：没有位图素材时退回纯矢量角色，保证页面不白屏
      return `<g id="petRoot"><g id="petSquash">${headMarkup('')}</g></g>`;
    }

    const img = k => {
      const q = P[k];
      return `<image href="${q.src}" x="${n(q.place[0] + q.offset[0])}" y="${n(q.place[1] + q.offset[1])}"
        width="${n(q.place[2])}" height="${n(q.place[3])}"/>`;
    };
    const part = (k, inner) =>
      `<g id="${k}" data-base="${P[k].base || 0}" data-pivot="${P[k].pivot.join(' ')}">${img(k)}${inner || ''}</g>`;

    const eyes = `
        <g id="gaze">
          <g id="eyeL">
            <path id="eyeLp" d="${eyePath(EYE_L.x, EYE_L.y, 10 * EYE_S, 26 * EYE_S, 0)}" fill="none"
                  stroke="#3EE3A8" stroke-width="${n(10 * EYE_S)}" stroke-linecap="round" filter="url(#eyeGlow)"/>
            <path id="eyeLs" d="${starPath(EYE_L.x, EYE_L.y, 13 * EYE_S)}" fill="#3EE3A8" opacity="0" filter="url(#eyeGlow)"/>
          </g>
          <g id="eyeR">
            <path id="eyeRp" d="${eyePath(EYE_R.x, EYE_R.y, 10 * EYE_S, 26 * EYE_S, 0)}" fill="none"
                  stroke="#3EE3A8" stroke-width="${n(10 * EYE_S)}" stroke-linecap="round" filter="url(#eyeGlow)"/>
            <path id="eyeRs" d="${starPath(EYE_R.x, EYE_R.y, 13 * EYE_S)}" fill="#3EE3A8" opacity="0" filter="url(#eyeGlow)"/>
          </g>
        </g>`;

    return `
  <g id="petRoot">
    <g id="petScale" transform="translate(200 272) scale(${PET_SCALE}) translate(-200 -272)">
      <g id="petSquash">
        ${part('legL')}
        ${part('legR')}
        ${part('armL')}
        ${part('armR')}
        ${part('torso')}
        ${part('head', eyes)}
      </g>
    </g>
  </g>`;
  }

  /* 头像：直接裁手绘的头部，保证头像和舞台上是同一张脸 */
  function avatarMarkup(t) {
    const P = global.PET_PARTS;
    let inner;
    if (P && P.head) {
      const q = P.head;
      const hx = q.place[0] + q.offset[0], hy = q.place[1] + q.offset[1];
      const cx = hx + q.place[2] / 2, cy = hy + q.place[3] / 2;
      const k = 176 / q.place[2];
      inner = `<g transform="translate(100 106) scale(${n(k)}) translate(${n(-cx)} ${n(-cy)})">
      <image href="${q.src}" x="${n(hx)}" y="${n(hy)}" width="${n(q.place[2])}" height="${n(q.place[3])}"/>
    </g>`;
    } else {
      inner = `<g transform="translate(100 106) scale(0.78) translate(-200 -106)">${headMarkup('av')}</g>`;
    }
    return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${defsMarkup(t)}
    <rect x="0" y="0" width="200" height="200" fill="${t.accentSoft}"/>
    <circle cx="46" cy="40" r="28" fill="${t.accent}" opacity="0.16"/>
    <circle cx="166" cy="162" r="34" fill="${t.accent}" opacity="0.13"/>
    ${inner}
  </svg>`;
  }

  /* 纸张颗粒层：纹理以 base64 内嵌，导出 SVG 时才能一起带走 */
  function grainMarkup(t) {
    if (!global.PAPER_GRAIN) return '';
    return `<defs>
      <pattern id="grainPat" width="168" height="139" patternUnits="userSpaceOnUse">
        <image href="${global.PAPER_GRAIN}" x="0" y="0" width="168" height="139" preserveAspectRatio="none"/>
      </pattern>
    </defs>
    <rect x="0" y="0" width="400" height="330" fill="url(#grainPat)"
          opacity="${t.grain || 0.7}" style="mix-blend-mode:multiply"/>`;
  }

  /* ------------------------------------------------------------------ *
   * 3. 场景
   * ------------------------------------------------------------------ */
  function sceneMarkup(t) {
    const dots = [];
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 26; i++) {
      dots.push(`<circle cx="${n(rnd() * 400)}" cy="${n(rnd() * 248)}" r="${n(0.8 + rnd() * 1.5)}" fill="${t.wallDot}" opacity="${n(0.35 + rnd() * 0.4)}"/>`);
    }
    return `
  <svg id="stageSvg" viewBox="0 0 400 330" xmlns="http://www.w3.org/2000/svg">
    ${defsMarkup(t)}
    <defs>
      <linearGradient id="gWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${t.wall}"/><stop offset="1" stop-color="${t.wallDot}" stop-opacity="0.55"/>
      </linearGradient>
      <linearGradient id="gWin" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${t.winSky}"/><stop offset="1" stop-color="${t.winDeep}"/>
      </linearGradient>
      <linearGradient id="gDesk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${t.woodTop}"/><stop offset="1" stop-color="${t.wood}"/>
      </linearGradient>
    </defs>

    <!-- 墙面 -->
    <rect x="0" y="0" width="400" height="330" fill="url(#gWall)"/>
    <g>${dots.join('')}</g>

    <!-- 窗 -->
    <g>
      <rect x="16" y="26" width="108" height="92" rx="11" fill="url(#gWin)" stroke="${INK}" stroke-width="3.4"/>
      <g opacity="0.85">
        <ellipse cx="46" cy="58" rx="17" ry="9" fill="#FFFFFF" opacity="0.85"/>
        <ellipse cx="60" cy="54" rx="12" ry="8" fill="#FFFFFF" opacity="0.85"/>
        <ellipse cx="106" cy="94" rx="15" ry="8" fill="#FFFFFF" opacity="0.5"/>
        <path d="M 16 104 Q 46 92 76 104 T 124 102 L 124 118 L 16 118 Z" fill="${t.winDeep}" opacity="0.55"/>
      </g>
      <path d="M 70 26 L 70 118 M 16 72 L 124 72" stroke="${INK}" stroke-width="3"/>
      <rect x="10" y="116" width="120" height="9" rx="4.5" fill="${t.woodTop}" stroke="${INK}" stroke-width="2.8"/>
    </g>

    <!-- 墙上的便签 -->
    <g transform="rotate(-4 356 72)">
      <rect x="330" y="38" width="54" height="66" rx="5" fill="${t.winFrame}" stroke="${INK}" stroke-width="2.8"/>
      <rect x="330" y="38" width="54" height="10" rx="5" fill="${t.leaf}" opacity="0.55"/>
      <path d="M 339 60 H 375 M 339 70 H 370 M 339 80 H 373 M 339 90 H 362"
            stroke="${t.inkSoft}" stroke-width="2.4" stroke-linecap="round" opacity="0.7"/>
    </g>

    <!-- 桌面 -->
    <rect x="0" y="244" width="400" height="86" fill="url(#gDesk)"/>
    <g stroke="${t.woodEdge}" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round">
      <path d="M 10 256 Q 90 250 180 258 T 390 254"/>
      <path d="M 40 274 Q 130 268 220 276 T 396 272"/>
    </g>
    <rect x="0" y="242" width="400" height="5" fill="${t.woodTop}"/>
    <rect x="0" y="290" width="400" height="40" fill="${t.wood}"/>
    <path d="M 0 292 H 400" stroke="${INK}" stroke-width="3"/>
    <path d="M 0 298 H 400" stroke="${t.woodEdge}" stroke-width="2" opacity="0.5"/>

    <!-- 马克杯 -->
    <g>
      <path d="M 92 216 Q 106 216 106 230 Q 106 242 94 242" fill="none" stroke="${INK}" stroke-width="3"/>
      <rect x="56" y="206" width="38" height="36" rx="7" fill="${t.mug}" stroke="${INK}" stroke-width="3"/>
      <ellipse cx="75" cy="206" rx="19" ry="6" fill="${t.woodEdge}" stroke="${INK}" stroke-width="2.6"/>
      <ellipse cx="75" cy="206" rx="13" ry="3.4" fill="${t.woodTop}"/>
      <path d="M 66 226 H 84" stroke="${t.inkSoft}" stroke-width="2.4" stroke-linecap="round" opacity="0.45"/>
      <g id="steam" fill="none" stroke="${t.steam}" stroke-width="2.6" stroke-linecap="round">
        <path d="M 68 196 Q 62 188 68 180 Q 74 172 68 164"/>
        <path d="M 82 194 Q 76 186 82 178 Q 88 170 82 162"/>
      </g>
    </g>

    <!-- 书堆 -->
    <g>
      <rect x="312" y="230" width="66" height="12" rx="4" fill="${t.book1}" stroke="${INK}" stroke-width="2.8"/>
      <rect x="318" y="218" width="58" height="12" rx="4" fill="${t.book2}" stroke="${INK}" stroke-width="2.8"/>
      <rect x="308" y="206" width="62" height="12" rx="4" fill="${t.book3}" stroke="${INK}" stroke-width="2.8"/>
      <path d="M 322 212 H 352" stroke="${INK}" stroke-width="2" opacity="0.35"/>
    </g>

    <!-- 便签纸 + 铅笔 -->
    <g transform="rotate(-8 44 266)">
      <rect x="24" y="250" width="42" height="34" rx="3" fill="${t.winFrame}" stroke="${INK}" stroke-width="2.4"/>
      <path d="M 31 262 H 58 M 31 270 H 51" stroke="${t.inkSoft}" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
    </g>
    <g transform="rotate(18 296 272)">
      <rect x="276" y="268" width="46" height="9" rx="4.5" fill="${t.book3}" stroke="${INK}" stroke-width="2.4"/>
      <path d="M 322 268 L 334 272.5 L 322 277 Z" fill="${t.mug}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
    </g>

    <!-- 坐垫 -->
    <ellipse cx="200" cy="272" rx="84" ry="16" fill="${t.cushion}" stroke="${t.cushionLine}" stroke-width="2.6"/>

    <!-- 纸张颗粒：铺在背景上，角色像贴纸一样盖在纸面上 -->
    ${grainMarkup(t)}

    <!-- 影子（独立于角色，跳跃时留在地上） -->
    <ellipse id="petShadow" cx="200" cy="274" rx="66" ry="10" fill="${t.shadow}"/>

    <!-- 角色 -->
    ${petMarkup()}

    <!-- 彩纸 / 特效 -->
    <g id="confettiLayer"></g>
    <g id="fxLayer"></g>
  </svg>`;
  }

  /* ------------------------------------------------------------------ *
   * 4. 动作参数
   * ------------------------------------------------------------------ */
  const BASE = {
    rootX: 0, rootY: 0, rootRot: 0,
    sqX: 1, sqY: 1,
    headX: 0, headY: 0, headRot: 0,
    earL: 0, earR: 0,
    armL: 0, armR: 0,
    legL: 0, legR: 0, legSq: 1,
    eyeH: 26, eyeW: 10, eyeSpan: 10, eyeBend: 0, eyeTilt: 0,
    eyeX: 0, eyeY: 0, eyeStar: 0,
    breath: 1
  };

  const DURATION = {
    idle: Infinity, sleep: Infinity, grabbed: Infinity, drop: 620,
    happy: 2500, celebrate: 3400, sad: 2600, angry: 2600,
    pet: 1650, wake: 900, attention: 2200
  };

  /* ------------------------------------------------------------------ *
   * 5. 舞台控制器
   * ------------------------------------------------------------------ */
  class Stage {
    constructor(el, themeKey) {
      this.el = el;
      this.theme = themeKey || 'mint';
      this.state = 'idle';
      this.stateStart = 0;
      this.clock = 0;
      this.blinkAt = -10;
      this.blinkNext = 2.2;
      this.gazeX = 0; this.gazeY = 0;
      this.gazeTX = 0; this.gazeTY = 0;
      this.grabX = 0; this.grabY = 0;
      this.particles = [];
      this.fx = [];
      this.cur = Object.assign({}, BASE);
      this.onStateChange = null;
      this._build();
    }

    /* ---- 构建 / 重建（换主题时） ---- */
    _build() {
      const t = THEMES[this.theme];
      this.el.innerHTML = sceneMarkup(t);
      const $ = id => this.el.querySelector('#' + id);
      this.svg = $('stageSvg');
      this.root = $('petRoot');
      this.squash = $('petSquash');
      this.shadow = $('petShadow');
      this.head = $('head');
      this.earL = $('earL'); this.earR = $('earR');
      this.eyeLg = $('eyeL'); this.eyeRg = $('eyeR');
      this.eyeLp = $('eyeLp'); this.eyeRp = $('eyeRp');
      this.eyeLs = $('eyeLs'); this.eyeRs = $('eyeRs');
      this.gaze = $('gaze');
      this.armL = $('armL'); this.armR = $('armR');
      this.legL = $('legL'); this.legR = $('legR');
      // 每个部件的关节位置与静止基础角（由切图脚本实测写入 data-* ）
      this.pivots = {}; this.baseAng = {};
      ['head', 'armL', 'armR', 'legL', 'legR'].forEach(k => {
        const node = $(k);
        if (!node) return;
        const pv = (node.dataset.pivot || '').split(' ').map(Number);
        if (pv.length === 2 && pv.every(v => !isNaN(v))) this.pivots[k] = pv;
        this.baseAng[k] = Number(node.dataset.base || 0) || 0;
      });
      this.confettiLayer = $('confettiLayer');
      this.fxLayer = $('fxLayer');
      this.steam = $('steam');
      this.particles.forEach(p => p.el && p.el.remove());
      this.particles = [];
      this.fx.forEach(f => f.el && f.el.remove());
      this.fx = [];
      this._render();
    }

    setTheme(key) {
      if (!THEMES[key] || key === this.theme) return;
      this.theme = key;
      this._build();
    }

    /* ---- 状态 ---- */
    setState(name) {
      if (name === this.state && name !== 'pet' && name !== 'celebrate') {
        this.stateStart = this.clock;
        return;
      }
      this.state = name;
      this.stateStart = this.clock;
      if (name !== 'sleep' && this.fx.length) {
        this.fx = this.fx.filter(f => {
          if (f.kind === 'z') { f.el.remove(); return false; }
          return true;
        });
      }
      if (name === 'pet') this._emitHearts();
      if (name === 'celebrate') this._emitConfetti();
      if (this.onStateChange) this.onStateChange(name);
    }

    wake() {
      if (this.state === 'sleep') {
        this.setState('wake');
        return true;
      }
      return false;
    }

    grabStart() {
      this.setState('grabbed');
    }

    grabMove(dx, dy) {
      this.grabX = clamp(dx, -62, 62);
      this.grabY = -6 + clamp(dy, -13, 10);
    }

    grabEnd() {
      if (this.state !== 'grabbed') return;
      this.setState('drop');
      this.dropFromX = this.cur.rootX;
      this.dropFromY = this.cur.rootY;
    }

    poke() {
      if (this.state === 'sleep' || this.state === 'wake') {
        this.setState('wake');
        return;
      }
      if (this.state === 'grabbed' || this.state === 'drop') return;
      // 一次抚摸只触发一个完整动作：动作没播完就不再叠加
      if (this.state === 'pet' && (this.clock - this.stateStart) < 1.6) return;
      this.setState('pet');
    }

    /* ---- 每帧 ---- */
    tick(dt) {
      dt = Math.min(dt, 0.05);
      this.clock += dt;
      const ck = this.clock;

      // 视线惯性
      this.gazeX = lerp(this.gazeX, this.gazeTX, 1 - Math.exp(-6 * dt));
      this.gazeY = lerp(this.gazeY, this.gazeTY, 1 - Math.exp(-6 * dt));

      // 自动回到待机
      const dur = DURATION[this.state];
      if (dur !== Infinity && (ck - this.stateStart) * 1000 > dur) this.setState('idle');

      // 眨眼调度
      if (ck > this.blinkNext) {
        this.blinkAt = ck;
        this.blinkNext = ck + 2.4 + Math.random() * 3.2;
      }

      const tgt = Object.assign({}, BASE, this._target(ck));
      const kEye = 16, kBody = this.state === 'grabbed' ? 26 : 11;
      for (const key in tgt) {
        const k = key.indexOf('eye') === 0 ? kEye
          : (key === 'rootX' || key === 'rootY') ? kBody + 12 : kBody;
        this.cur[key] = lerp(this.cur[key], tgt[key], 1 - Math.exp(-k * dt));
      }

      // 睡觉的 Z：每 0.8 秒冒一个
      this.zTimer = (this.zTimer || 0) + dt;
      if (this.state === 'sleep' && this.zTimer > 0.8) {
        this.zTimer = 0;
        this._emitZ(1);
      }

      this._particles(dt);
      this._fxTick(dt);
      this._render();
    }

    /* ---- 各状态目标值 ---- */
    _target(ck) {
      const st = this.state;
      const e = ck - this.stateStart;
      const w = this.gazeX, v = this.gazeY;

      if (st === 'idle') {
        const bt = ck - this.blinkAt;
        const blink = bt >= 0 && bt < 0.2 ? Math.sin((bt / 0.2) * Math.PI) : 0;
        const sway = Math.sin(ck * 1.55);
        return {
          sqY: 1 + sway * 0.016, sqX: 1 - sway * 0.012,
          headY: sway * 1.3, headRot: w * 3.2,
          eyeH: lerp(26, 3, blink), eyeW: 10, eyeSpan: 10, eyeBend: blink * 0.5,
          eyeX: w * 5, eyeY: v * 3.2,
          earL: Math.sin(ck * 0.9) * 2.2, earR: Math.sin(ck * 0.9 + 1.1) * 2.2,
          armL: 4 + Math.sin(ck * 1.25) * 2.2, armR: -4 - Math.sin(ck * 1.25 + 0.5) * 2.2,
          breath: 1
        };
      }

      if (st === 'happy') {
        const b = Math.sin(ck * 6.2);
        return {
          sqY: 1.05 + b * 0.02, sqX: 0.975 - b * 0.01,
          rootY: -Math.max(0, Math.sin(ck * 3.1)) * 2.5,
          headY: -5 + b * 1.6, headRot: -3.5 + b * 1.5,
          eyeH: 7.5, eyeW: 9.5, eyeSpan: 20, eyeBend: 0.9,
          eyeX: w * 3, eyeY: -1.5,
          earL: 10 + b * 2, earR: -10 - b * 2,
          armL: 68 + b * 6, armR: -68 - b * 6,
          breath: 1.7
        };
      }

      if (st === 'celebrate') {
        const hop = Math.abs(Math.sin(ck * 3.2));
        const land = 1 - hop;
        return {
          rootY: -hop * 17,
          sqY: 1 + land * 0.075 - hop * 0.015, sqX: 1 - land * 0.055 + hop * 0.01,
          headY: -7 - hop * 2, headRot: Math.sin(ck * 1.7) * 6,
          eyeStar: 1, eyeH: 6, eyeW: 11, eyeSpan: 10, eyeBend: 0.8, eyeTilt: 0,
          eyeX: 0, eyeY: -2,
          earL: 12 + hop * 3, earR: -12 - hop * 3,
          armL: 96 + Math.sin(ck * 6.4) * 8, armR: -96 - Math.sin(ck * 6.4) * 8,
          breath: 1.8
        };
      }

      if (st === 'sad') {
        const b = Math.sin(ck * 1.5);
        return {
          sqY: 0.905 + b * 0.008, sqX: 1.04 - b * 0.006,
          headY: 14 + b * 1.2, headRot: 4,
          eyeH: 19, eyeW: 9.5, eyeSpan: 10, eyeBend: 0.02, eyeTilt: -21,
          eyeX: 0, eyeY: 4.5,
          earL: -26, earR: 26,
          armL: -15 + b, armR: 15 - b,
          breath: 0.55
        };
      }

      if (st === 'angry') {
        const b = Math.sin(ck * 7.5);
        return {
          sqY: 1.02 + b * 0.008, sqX: 1.045,
          headY: -1, headRot: 0,
          eyeH: 11, eyeW: 13, eyeSpan: 10, eyeBend: 0.05, eyeTilt: 21,
          eyeX: 0, eyeY: -1.5,
          earL: -28, earR: 28,
          armL: 42 + b * 2, armR: -42 - b * 2,
          breath: 1.5
        };
      }

      if (st === 'sleep') {
        /* 坐下来睡（照坐姿参考图）：腿向两侧摊开并沿自轴压短，
           身体下沉+略微压扁，屁股落到坐垫上，手往身前搭，头再歪一点。 */
        const b = Math.sin(ck * 0.95);
        return {
          rootY: 26 + b * 1.1,
          sqY: 0.92 + b * 0.028, sqX: 1.08 - b * 0.018,
          legSq: 0.74,
          legL: 60, legR: -60,
          headY: 11 + b * 1.4, headRot: 13,
          eyeH: 2, eyeW: 7.5, eyeSpan: 19, eyeBend: 0.5, eyeTilt: 0,
          eyeX: 0, eyeY: 2,
          earL: 6, earR: -3,
          armL: -10, armR: 10,
          breath: 2.4
        };
      }

      if (st === 'pet') {
        const close = easeInOut(seg(e, 0.14, 0.34));
        const rubP = seg(e, 0.34, 1.08);
        const rubAmp = Math.sin(rubP * Math.PI);
        const osc = Math.sin((e - 0.34) * 2.9 * Math.PI * 2) * rubAmp;
        const out = easeInOut(seg(e, 1.14, 1.62));
        const spike = Math.sin(seg(e, 0, 0.34) * Math.PI);
        return {
          sqY: (1 - close * 0.05) * (1 - out) + out,
          sqX: (1 + close * 0.035) * (1 - out) + out,
          headY: (lerp(0, 7, close) + Math.sin(ck * 2) * 0.8) * (1 - out),
          headRot: (lerp(0, -4, close) + osc * 8) * (1 - out),
          headX: osc * 6 * (1 - out),
          eyeH: lerp(26 + spike * 9, 7.5, close) * (1 - out) + 26 * out,
          eyeW: 9.5, eyeSpan: lerp(11, 20, close), eyeBend: lerp(close * 0.95, 0, out),
          eyeX: osc * 2.4, eyeY: lerp(0, 2, close),
          earL: lerp(-9, 7, close) * (1 - out) + osc * 1.2,
          earR: lerp(9, -7, close) * (1 - out) - osc * 1.2,
          armL: lerp(0, -16, close) * (1 - out) + 4,
          armR: lerp(0, 16, close) * (1 - out) - 4,
          breath: lerp(1, 2.1, close) * (1 - out) + out
        };
      }

      if (st === 'grabbed') {
        const s = Math.sin(ck * 8);
        const s2 = Math.sin(ck * 8 + 1.2);
        return {
          rootX: this.grabX, rootY: this.grabY - Math.sin(ck * 6) * 1.5,
          rootRot: clamp(this.grabX * 0.09, -6, 6),
          sqY: 1.12 + s * 0.012, sqX: 0.9,
          headY: -3, headRot: clamp(this.grabX * 0.06, -5, 5) + s * 2,
          eyeH: 38, eyeW: 10.5, eyeSpan: 10, eyeBend: 0.04, eyeTilt: 0,
          eyeX: 0, eyeY: -2,
          earL: -27, earR: 27,
          armL: 12 + s * 20, armR: -12 - s2 * 20,
          legL: s2 * 14, legR: -s * 14,
          breath: 1.2
        };
      }

      if (st === 'drop') {
        const f = seg(e, 0, 0.34);
        const fall = easeIn(f);
        const land = seg(e, 0.3, 0.6);
        const sq = Math.sin(land * Math.PI);
        return {
          rootX: (this.dropFromX || 0) * (1 - fall),
          rootY: (this.dropFromY || 0) * (1 - fall),
          rootRot: (this.cur.rootRot || 0) * (1 - fall),
          sqY: 1 - sq * 0.13, sqX: 1 + sq * 0.09,
          headY: 3 * (1 - fall) + sq * 3,
          eyeH: lerp(38, 26, fall), eyeW: 10, eyeSpan: 10, eyeBend: 0.05,
          earL: -22 * (1 - fall), earR: 22 * (1 - fall),
          armL: 12 * (1 - fall), armR: -12 * (1 - fall),
          breath: 1 + sq * 0.6
        };
      }

      if (st === 'wake') {
        const k = easeOut(seg(e, 0, 0.42));
        const shake = e < 0.32 ? Math.sin(e * 62) * Math.exp(-e * 7) : 0;
        return {
          sqY: 1 - (1 - k) * 0.02, sqX: 1 + (1 - k) * 0.02,
          headY: lerp(16, -2, k) + Math.sin(e * 9) * (1 - k) * 2,
          headRot: lerp(12, 0, k) + shake * 5,
          eyeH: lerp(2, 26, k), eyeW: lerp(7.5, 10, k), eyeSpan: lerp(19, 10, k), eyeBend: lerp(0.5, 0, k),
          eyeX: shake * 3, eyeY: lerp(2, 0, k),
          earL: lerp(6, -4, k), earR: lerp(-3, 4, k),
          armL: lerp(-7, 3, k), armR: lerp(7, -3, k),
          breath: 1
        };
      }

      if (st === 'attention') {
        const b = Math.sin(ck * 2.6);
        return {
          sqY: 1.02 + b * 0.012, sqX: 0.99,
          headY: -3 + b, headRot: -6,
          eyeH: 26, eyeW: 10.5, eyeSpan: 10, eyeBend: 0.04,
          eyeX: 6, eyeY: -1.5,
          earL: -9, earR: 9,
          armL: 38 + b * 3, armR: -5,
          breath: 1.35
        };
      }
      return {};
    }

    /* ---- 把参数写进 DOM ---- */
    _render() {
      const c = this.cur;
      const set = (el, s) => el && el.setAttribute('transform', s);

      set(this.root, `translate(${n(c.rootX)} ${n(c.rootY)}) rotate(${n(c.rootRot)} 200 272)`);
      set(this.squash, `translate(200 270) scale(${n(c.sqX)} ${n(c.sqY)}) translate(-200 -270)`);

      // 关节位置与基础角都来自切图实测，避免换素材后要手调一堆坐标
      const pv = k => (this.pivots && this.pivots[k] ? ` ${this.pivots[k][0]} ${this.pivots[k][1]}` : ' 200 184');
      const ba = k => (this.baseAng[k] || 0);

      // 腿：绕髋旋转 + 沿自身轴压短（坐着时用来收腿，正面看像折在身前）
      const legT = (k, ang) => {
        const p = this.pivots[k] || [200, 236];
        if (Math.abs(c.legSq - 1) < 0.002) return `rotate(${n(ang)} ${p[0]} ${p[1]})`;
        return `translate(${p[0]} ${p[1]}) rotate(${n(ang)}) scale(1 ${n(c.legSq)}) translate(${-p[0]} ${-p[1]})`;
      };

      set(this.head, `translate(${n(c.headX)} ${n(c.headY)}) rotate(${n(c.headRot)}${pv('head')})`);
      set(this.armL, `rotate(${n(ba('armL') + c.armL)}${pv('armL')})`);
      set(this.armR, `rotate(${n(ba('armR') + c.armR)}${pv('armR')})`);
      set(this.legL, legT('legL', ba('legL') + c.legL));
      set(this.legR, legT('legR', ba('legR') + c.legR));
      set(this.gaze, `translate(${n(c.eyeX)} ${n(c.eyeY)})`);

      if (this.shadow) {
        const shrink = 1 + c.rootY * 0.006;
        this.shadow.setAttribute('transform', `translate(${n(c.rootX * 0.85)} 0) translate(200 274) scale(${n(clamp(shrink, 0.7, 1.1))} 1) translate(-200 -274)`);
        this.shadow.setAttribute('opacity', n(clamp(1 + c.rootY * 0.02, 0.45, 1)));
      }

      // 眼睛（handled 屏 = 位图，尺寸按 EYE_S 折算到屏幕大小）
      const ew = c.eyeW * EYE_S, eh = c.eyeH * EYE_S;
      const dl = eyePath(EYE_L.x, EYE_L.y, ew, eh, c.eyeBend, c.eyeSpan * EYE_S);
      const dr = eyePath(EYE_R.x, EYE_R.y, ew, eh, c.eyeBend, c.eyeSpan * EYE_S);
      if (this.eyeLp) {
        this.eyeLp.setAttribute('d', dl);
        this.eyeLp.setAttribute('stroke-width', n(ew));
        this.eyeLp.setAttribute('opacity', n(1 - c.eyeStar));
        this.eyeRp.setAttribute('d', dr);
        this.eyeRp.setAttribute('stroke-width', n(c.eyeW));
        this.eyeRp.setAttribute('opacity', n(1 - c.eyeStar));
        const tilt = c.eyeTilt;
        set(this.eyeLg, `rotate(${n(tilt)} ${EYE_L.x} ${EYE_L.y})`);
        set(this.eyeRg, `rotate(${n(-tilt)} ${EYE_R.x} ${EYE_R.y})`);
        const ss = 0.5 + c.eyeStar * 0.55;
        set(this.eyeLs, `translate(${EYE_L.x} ${EYE_L.y}) scale(${n(ss)}) translate(${-EYE_L.x} ${-EYE_L.y})`);
        set(this.eyeRs, `translate(${EYE_R.x} ${EYE_R.y}) scale(${n(ss)}) translate(${-EYE_R.x} ${-EYE_R.y})`);
        this.eyeLs.setAttribute('opacity', n(c.eyeStar));
        this.eyeRs.setAttribute('opacity', n(c.eyeStar));
      }
    }

    /* ---- 彩纸 ---- */
    _emitConfetti() {
      const t = THEMES[this.theme];
      const colors = t.confetti;
      const sources = [
        { x: 130, y: 196 }, { x: 270, y: 196 }
      ];
      const shapes = ['rect', 'circle', 'strip', 'tri'];
      const N = 54;
      for (let i = 0; i < N; i++) {
        const src = sources[i % sources.length];
        const dir = i % 2 === 0 ? -1 : 1;
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const shape = shapes[i % shapes.length];
        const color = colors[i % colors.length];
        const size = 5 + Math.random() * 6;
        let inner = '';
        if (shape === 'rect') inner = `<rect x="${-size / 2}" y="${-size * 0.35}" width="${size}" height="${size * 0.7}" rx="1.2" fill="${color}"/>`;
        else if (shape === 'circle') inner = `<circle cx="0" cy="0" r="${size * 0.38}" fill="${color}"/>`;
        else if (shape === 'strip') inner = `<rect x="${-size * 0.2}" y="${-size}" width="${size * 0.4}" height="${size * 2}" rx="1" fill="${color}"/>`;
        else inner = `<path d="M 0 ${-size * 0.6} L ${size * 0.6} ${size * 0.5} L ${-size * 0.6} ${size * 0.5} Z" fill="${color}"/>`;
        el.innerHTML = inner;
        el.setAttribute('opacity', '1');
        this.confettiLayer.appendChild(el);
        this.particles.push({
          el,
          x: src.x + (Math.random() - 0.5) * 16,
          y: src.y + (Math.random() - 0.5) * 12,
          vx: dir * (30 + Math.random() * 120),
          vy: -(250 + Math.random() * 210),
          rot: Math.random() * 360,
          vrot: (Math.random() - 0.5) * 420,
          flip: Math.random() * 6.28,
          vflip: 3 + Math.random() * 7,
          sway: Math.random() * 6.28,
          age: 0,
          life: 3.2 + Math.random() * 1.2
        });
      }
    }

    _particles(dt) {
      if (!this.particles.length) return;
      const keep = [];
      for (const p of this.particles) {
        p.age += dt;
        p.vy += 300 * dt;
        p.vx *= 0.992;
        p.vy *= 0.991;
        p.x += (p.vx + Math.sin(this.clock * 3 + p.sway) * 26) * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.flip += p.vflip * dt;
        const dead = p.age > p.life || p.y > 340;
        if (dead) { p.el.remove(); continue; }
        const fade = clamp((p.life - p.age) / 0.7, 0, 1);
        p.el.setAttribute('opacity', n(fade));
        p.el.setAttribute('transform',
          `translate(${n(p.x)} ${n(p.y)}) rotate(${n(p.rot)}) scale(${n(Math.cos(p.flip))} 1)`);
        keep.push(p);
      }
      this.particles = keep;
    }

    /* ---- 爱心 / Zzz ---- */
    _emitHearts() {
      const t = THEMES[this.theme];
      const cols = ['#F2907F', '#F7B3A6', '#E97F6C'];
      for (let i = 0; i < 3; i++) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        el.innerHTML = `<path d="M 0 4 C -6.5 -1.6 -6.5 -7.4 -3.1 -7.4 C -1.1 -7.4 0 -5.9 0 -4.2 C 0 -5.9 1.1 -7.4 3.1 -7.4 C 6.5 -7.4 6.5 -1.6 0 4 Z" fill="${cols[i % cols.length]}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`;
        this.fxLayer.appendChild(el);
        this.fx.push({
          el, kind: 'heart',
          x: 246 + (i - 1) * 16, y: 78, vy: -22 - i * 4, vx: 8 + i * 3,
          age: -i * 0.16, life: 1.5, scale: 1.05 + i * 0.2
        });
      }
    }

    _emitZ() {
      if (this.fx.filter(f => f.kind === 'z').length >= 3) return;
      {
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const t = THEMES[this.theme];
        el.innerHTML = `<path d="M -4 -5 L 4 -5 L -4 5 L 4 5" fill="none" stroke="${t.inkSoft}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
        this.fxLayer.appendChild(el);
        this.fx.push({
          el, kind: 'z', x: 266, y: 66, vy: -17, vx: 7,
          age: 0, life: 2.4, scale: 1
        });
      }
    }

    _fxTick(dt) {
      if (!this.fx.length) return;
      const keep = [];
      for (const f of this.fx) {
        f.age += dt;
        if (f.age < 0) { f.el.setAttribute('opacity', '0'); keep.push(f); continue; }
        if (f.age > f.life) { f.el.remove(); continue; }
        const k = f.age / f.life;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vy *= 0.995;
        const op = k < 0.18 ? k / 0.18 : 1 - Math.max(0, (k - 0.55) / 0.45);
        const sc = f.kind === 'z' ? f.scale + k * 0.5 : f.scale + k * 0.15;
        f.el.setAttribute('opacity', n(clamp(op, 0, 1)));
        f.el.setAttribute('transform', `translate(${n(f.x)} ${n(f.y)}) scale(${n(sc)}) rotate(${f.kind === 'z' ? -6 : 0})`);
        keep.push(f);
      }
      this.fx = keep;
    }

    /* ---- 导出用：把当前场景（含角色姿态、彩纸、爱心）变成图片 ---- */
    getStageImage(widthPx) {
      return new Promise((resolve, reject) => {
        const clone = this.svg.cloneNode(true);
        const ratio = 330 / 400;
        clone.setAttribute('width', widthPx);
        clone.setAttribute('height', Math.round(widthPx * ratio));
        clone.removeAttribute('preserveAspectRatio');
        const str = new XMLSerializer().serializeToString(clone);
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }

    getAvatarImage(widthPx, themeKey) {
      return new Promise((resolve, reject) => {
        const t = THEMES[themeKey || this.theme];
        const str = avatarMarkup(t);
        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str);
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });
    }
  }

  global.PET = { Stage, THEMES, avatarMarkup, BASE };
})(window);
