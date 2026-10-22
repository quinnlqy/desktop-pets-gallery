/* 墨格用栅格笔刷画，不用矢量描边。身体、房间、碟沿各缓存成一张位图，表情只在脸上加笔触。 */
(function () {
  var TAU = Math.PI * 2;
  var HOME_X = 268;
  var HOME_Y = 250;
  var BODY_RX = 86;
  var BODY_RY = 78;
  var PAINT = 3;

  function smooth(x) {
    x = x < 0 ? 0 : x > 1 ? 1 : x;
    return x * x * (3 - 2 * x);
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function dab(ctx, x, y, r, color, alpha) {
    if (r <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    var g = ctx.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.08, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.58, color);
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function stroke(ctx, x0, y0, x1, y1, width, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.restore();
  }
  function grain(canvas, amount) {
    var c = canvas.getContext('2d');
    var img = c.getImageData(0, 0, canvas.width, canvas.height);
    var d = img.data;
    var s = 11;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 12) continue;
      s = (s * 16807) % 2147483647;
      var n = ((s % 1000) / 1000 - 0.5) * amount;
      d[i] = clamp(d[i] + n * 1.05, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n * 0.92, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n * 0.72, 0, 255);
    }
    c.putImageData(img, 0, 0);
  }
  function traceBody(ctx) {
    ctx.beginPath();
    var steps = 56;
    for (var i = 0; i <= steps; i++) {
      var a = -Math.PI / 2 + (i / steps) * TAU;
      var wob = 1 + 0.028 * Math.sin(a * 3 + 0.5) + 0.016 * Math.cos(a * 5);
      var x = Math.cos(a) * BODY_RX * wob;
      var y = Math.sin(a) * BODY_RY * wob + 1;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
  function roundCup(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function quad(ax, ay, bx, by, cx, cy, t) {
    var u = 1 - t;
    return [u * u * ax + 2 * u * t * bx + t * t * cx, u * u * ay + 2 * u * t * by + t * t * cy];
  }

  var room, rim, body;
  function ensureArt() {
    if (room) return;
    buildRoom();
    buildRim();
    buildBody();
  }

  function buildRoom() {
    room = document.createElement('canvas');
    room.width = 904;
    room.height = 848;
    var c = room.getContext('2d');
    c.scale(2, 2);
    var wall = c.createLinearGradient(0, 0, 30, 300);
    wall.addColorStop(0, '#a9bfd2');
    wall.addColorStop(1, '#6d88a3');
    c.fillStyle = wall;
    c.fillRect(0, 0, 452, 300);
    dab(c, 36, 16, 180, '#d7e6f2', 0.26);
    dab(c, 390, 70, 210, '#547594', 0.2);

    var wx = 118, wy = 132;
    c.fillStyle = '#f4e6cf';
    c.beginPath();
    c.arc(wx, wy, 108, 0, TAU);
    c.fill();
    var sky = c.createRadialGradient(96, 108, 8, wx, wy, 96);
    sky.addColorStop(0, '#4e6e8e');
    sky.addColorStop(1, '#2c445e');
    c.fillStyle = sky;
    c.beginPath();
    c.arc(wx, wy, 90, 0, TAU);
    c.fill();
    var moon = c.createRadialGradient(78, 96, 2, 86, 106, 32);
    moon.addColorStop(0, '#fff9ec');
    moon.addColorStop(0.7, '#f3e1b4');
    moon.addColorStop(1, rgba('#f3e1b4', 0));
    c.fillStyle = moon;
    c.beginPath();
    c.arc(86, 104, 31, 0, TAU);
    c.fill();
    dab(c, 76, 98, 5, '#e4d0a2', 0.4);
    var stars = [[134, 76, '#f7f3ea'], [158, 114, '#f2d48a'], [68, 148, '#f7f3ea'], [150, 158, '#d5e6f4'], [104, 170, '#f2d48a'], [52, 88, '#f7f3ea']];
    for (var i = 0; i < stars.length; i++) dab(c, stars[i][0], stars[i][1], 1.8, stars[i][2], 0.95);
    c.save();
    c.strokeStyle = '#fbf6ec';
    c.lineWidth = 5;
    c.filter = 'blur(0.8px)';
    c.beginPath();
    c.arc(wx, wy, 93, 0, TAU);
    c.stroke();
    c.restore();

    stroke(c, 390, 0, 366, 70, 1.3, '#e6d3ae', 0.8);
    c.save();
    c.translate(366, 78);
    c.filter = 'blur(0.35px)';
    c.fillStyle = '#f7ecc8';
    c.beginPath();
    for (i = 0; i < 8; i++) {
      var rad = i % 2 ? 4 : 9;
      var a = -Math.PI / 2 + i * Math.PI / 4;
      var px = Math.cos(a) * rad;
      var py = Math.sin(a) * rad;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
    c.restore();

    var sill = c.createLinearGradient(0, 292, 0, 424);
    sill.addColorStop(0, '#f7e6cb');
    sill.addColorStop(0.16, '#efd5b0');
    sill.addColorStop(1, '#d2ae7c');
    c.fillStyle = sill;
    c.fillRect(0, 292, 452, 132);
    c.fillStyle = 'rgba(150, 108, 62, 0.12)';
    c.fillRect(0, 334, 452, 12);
    c.fillStyle = '#f8f2e8';
    c.strokeStyle = '#c9a67a';
    c.lineWidth = 1.5;
    roundCup(c, 396, 268, 24, 20, 4);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(422, 278, 5.5, -1.1, 1.2);
    c.stroke();
    c.fillStyle = '#ead7b4';
    c.fillRect(401, 272, 14, 3.5);

    c.fillStyle = '#f0d8b0';
    c.beginPath();
    c.ellipse(HOME_X, 314, 102, 22, 0, 0, TAU);
    c.fill();
    c.fillStyle = '#e0be88';
    c.beginPath();
    c.ellipse(HOME_X, 316, 74, 12, 0, 0, TAU);
    c.fill();
    dab(c, HOME_X - 26, 308, 16, '#fff4e2', 0.35);
    grain(room, 11);
  }

  function buildRim() {
    rim = document.createElement('canvas');
    rim.width = 904;
    rim.height = 848;
    var c = rim.getContext('2d');
    c.scale(2, 2);
    c.save();
    c.lineCap = 'round';
    c.filter = 'blur(0.5px)';
    c.strokeStyle = '#c4a06c';
    c.lineWidth = 8;
    c.beginPath();
    c.ellipse(HOME_X, 316, 104, 23, 0, 0.1 * Math.PI, 0.9 * Math.PI);
    c.stroke();
    c.strokeStyle = '#f6e7cc';
    c.lineWidth = 2.5;
    c.beginPath();
    c.ellipse(HOME_X, 313, 88, 13, 0, 0.16 * Math.PI, 0.84 * Math.PI);
    c.stroke();
    c.restore();
  }

  function buildBody() {
    body = document.createElement('canvas');
    body.width = 640;
    body.height = 600;
    var c = body.getContext('2d');
    c.setTransform(PAINT, 0, 0, PAINT, body.width / 2, body.height / 2);
    c.save();
    c.lineJoin = 'round';
    c.lineWidth = 9;
    c.strokeStyle = '#4a382e';
    c.filter = 'blur(0.9px)';
    traceBody(c);
    c.stroke();
    c.filter = 'none';
    c.restore();
    c.save();
    traceBody(c);
    c.clip();
    var ink = c.createRadialGradient(-24, -34, 8, 6, 10, 100);
    ink.addColorStop(0, '#5c554c');
    ink.addColorStop(0.42, '#322e2a');
    ink.addColorStop(1, '#1c1917');
    c.fillStyle = ink;
    c.fillRect(-140, -140, 280, 280);
    dab(c, -30, -40, 28, '#7b6f62', 0.28);
    dab(c, 10, 36, 40, '#120f0d', 0.28);
    c.strokeStyle = 'rgba(244, 231, 203, 0.55)';
    c.lineWidth = 12;
    c.lineCap = 'round';
    c.filter = 'blur(2px)';
    c.beginPath();
    c.arc(-28, -36, 34, Math.PI * 1.08, Math.PI * 1.58);
    c.stroke();
    c.filter = 'none';
    dab(c, -54, 34, 14, '#e08b84', 0.55);
    dab(c, 54, 34, 14, '#e08b84', 0.55);
    c.restore();
    grain(body, 14);
  }

  function paintRoom(ctx, tint) {
    ensureArt();
    ctx.drawImage(room, 0, 0, 452, 424);
    if (tint) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, 452, 424);
      ctx.globalAlpha = 1;
    }
  }
  function saucerFront(ctx) {
    ensureArt();
    ctx.drawImage(rim, 0, 0, 452, 424);
  }

  function brushCurve(ctx, ax, ay, bx, by, cx, cy, color, alpha, thick) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = thick * 1.65;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.filter = 'blur(0.35px)';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo(bx, by, cx, cy);
    ctx.stroke();
    ctx.restore();
  }

  function drawEye(ctx, x, side, face, k, gazeX, gazeY, blink) {
    ctx.save();
    ctx.translate(x, 8);
    var wink = face === 'celebrate' && side > 0;
    var crescent = (face === 'happy' || face === 'pet' || wink) ? k : 0;
    var sleepArc = face === 'sleep' ? k : 0;
    var shut = Math.max(crescent, sleepArc);
    var openA = shut > 0.82 ? 0 : 1 - shut * 0.92;

    if (openA > 0.05) {
      var rot = 0, sx = 1, sy = 1, pup = 0.56, gx = gazeX, gy = gazeY;
      if (face === 'angry') {
        rot = -side * 0.78 * k;
        sy = 1 - 0.74 * k;
        pup = 0.42;
      } else if (face === 'sad') {
        sy = 1 - 0.34 * k;
        gy += 8 * k;
        pup = 0.66;
      } else if (face === 'celebrate') {
        sx = 1 + 0.18 * k;
        sy = 1 + 0.24 * k;
        pup = 0.56 - 0.2 * k;
      } else if (face === 'grab' || face === 'notice') {
        var amp = face === 'notice' ? 0.55 : 1;
        sx = 1 + 0.16 * k * amp;
        sy = 1 + 0.28 * k * amp;
        pup = 0.56 - 0.24 * k * amp;
      } else if (face === 'sleep') {
        sy = 1 - 0.88 * k;
      }
      sy *= 1 - blink;
      if (sy < 0.08) sy = 0.08;
      ctx.globalAlpha *= openA;
      ctx.rotate(rot);
      ctx.save();
      ctx.scale(21 * sx, 25 * sy);
      var white = ctx.createRadialGradient(-0.12, -0.18, 0.15, 0.05, 0.08, 1);
      white.addColorStop(0, '#fffaf2');
      white.addColorStop(0.62, '#f3e6d4');
      white.addColorStop(0.84, '#e7d7c4');
      white.addColorStop(1, rgba('#f3e6d4', 0));
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
      var px = clamp(gx, -6, 6);
      var py = clamp(gy, -7, 8);
      ctx.save();
      ctx.translate(px, py + 1);
      ctx.scale(8.4 * pup * sx, 10.6 * pup * sy);
      var ink = ctx.createRadialGradient(-0.2, -0.25, 0.1, 0, 0, 1);
      ink.addColorStop(0, '#2a241f');
      ink.addColorStop(0.7, '#1a1614');
      ink.addColorStop(1, rgba('#1a1614', 0));
      ctx.fillStyle = ink;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, TAU);
      ctx.fill();
      ctx.restore();
      if (face === 'sad' && k > 0.25) {
        dab(ctx, -4, -7 * sy, 10 * sx, '#2c2825', 0.92);
        dab(ctx, 6, -6 * sy, 9 * sx, '#2c2825', 0.9);
        dab(ctx, 0, -2 * sy, 8 * sx, '#2c2825', 0.55);
      } else if (sy > 0.55) {
        dab(ctx, px - 4.2, py - 5.2, 3.3, '#fffaf3', 0.95);
      }
      ctx.globalAlpha = 1;
    }
    if (crescent > 0.04) {
      var lift = face === 'happy' ? 26 : face === 'celebrate' ? 22 : 14;
      var width = face === 'happy' ? 18 : 15;
      var thick = face === 'happy' ? 4.4 : 3.5;
      ctx.globalAlpha = crescent;
      brushCurve(ctx, -width, 6, 0, 6 - lift, width, 6, '#f6efe4', 1, thick);
      ctx.globalAlpha = 1;
    }
    if (sleepArc > 0.04) {
      ctx.globalAlpha = sleepArc;
      brushCurve(ctx, -16, -1, 0, 15, 16, -1, '#f6efe4', 1, 3.3);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawMouth(ctx, face, k) {
    var smile = 4;
    var target = 4;
    if (face === 'sad') target = -7;
    else if (face === 'angry') target = 0;
    else if (face === 'happy') target = 8;
    else if (face === 'celebrate' || face === 'pet') target = 6;
    else if (face === 'sleep') target = 2;
    else if (face === 'grab' || face === 'notice') target = 1;
    smile = 4 + (target - 4) * k;
    var mouthW = face === 'angry' ? 7 : 11;
    var thick = face === 'angry' ? 1.7 : 2.15;
    brushCurve(ctx, -mouthW, 0, 0, smile, mouthW, 0, '#f4ece1', 0.95, thick);
  }

  function heart(ctx, s, color) {
    ctx.save();
    ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 2.6);
    ctx.bezierCurveTo(-6.2, -1, -3.2, -6.2, 0, -3.2);
    ctx.bezierCurveTo(3.2, -6.2, 6.2, -1, 0, 2.6);
    ctx.fillStyle = color;
    ctx.fill();
    dab(ctx, -1.2, -1.4, 1.5, '#fff6ea', 0.45);
    ctx.restore();
  }

  function scrap(ctx, w, h, color) {
    ctx.beginPath();
    ctx.moveTo(-w, -h * 0.72);
    ctx.quadraticCurveTo(-w * 0.1, -h * 1.05, w * 0.86, -h * 0.62);
    ctx.quadraticCurveTo(w * 1.05, 0.1, w * 0.62, h * 0.9);
    ctx.quadraticCurveTo(-0.1, h * 0.7, -w * 0.78, h * 0.42);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    dab(ctx, -w * 0.15, -h * 0.15, Math.max(w, h) * 0.45, '#fff8ee', 0.28);
  }

  function confetti(ctx, cx, topY, p, motion) {
    var colors = ['#ef5d5d', '#f0b429', '#22b07a', '#3d8fe0', '#a56bde', '#ff8a3d'];
    var bursts = [0.08, 0.34];
    for (var b = 0; b < bursts.length; b++) {
      for (var n = 0; n < 14; n++) {
        var life = (p - bursts[b]) / 0.32;
        if (life < 0 || life > 2.25) continue;
        var side = n % 2 ? 1 : -1;
        var along = 0.35 + (n % 7) / 7;
        var jitter = ((n * 17 + b * 13) % 10) / 10;
        var vx = side * (46 + along * 78 + jitter * 24) * motion;
        var vy = (-190 - jitter * 70) * motion;
        var x = cx + vx * life + Math.sin(life * 3 + n) * 10 * life;
        var y = topY + vy * life + 165 * life * life * motion;
        var fade = smooth(clamp(life / 0.08, 0, 1)) * (1 - smooth(clamp((life - 1.65) / 0.5, 0, 1)));
        if (fade <= 0) continue;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(n * 0.8 + life * side * 5);
        ctx.scale(0.42 + 0.58 * Math.abs(Math.cos(life * 6.2 + n * 1.3)), 1);
        ctx.globalAlpha = fade;
        if (n % 3 === 0) scrap(ctx, 12, 4.2, colors[(n + b * 2) % colors.length]);
        else scrap(ctx, 6, 9, colors[(n + b * 2) % colors.length]);
        ctx.restore();
      }
    }
  }

  window.paintOrb = function (ctx, state, env, opts) {
    opts = opts || {};
    ensureArt();
    var mood = state.mood || 'idle';
    var p = state.p || 0;
    var e = state.e || 0;
    var t = state.t || 0;
    var reduced = env.reduced ? 0.28 : 1;
    var avatar = !!opts.avatar;
    if (avatar) {
      mood = 'idle';
      p = 0;
      e = 0;
    }

    var face = mood;
    var k = e;
    var prep = 0;
    var main = 0;
    if (mood === 'pet') {
      prep = smooth(clamp(p / 0.08, 0, 1)) * (1 - smooth(clamp((p - 0.08) / 0.08, 0, 1)));
      main = smooth(clamp((p - 0.08) / 0.1, 0, 1)) * (1 - smooth(clamp((p - 0.72) / 0.24, 0, 1)));
      if (prep >= main) {
        face = 'notice';
        k = prep;
      } else {
        face = 'pet';
        k = main;
      }
    }

    var blink = 0;
    if (face === 'idle' || face === 'look' || face === 'typing' || face === 'land') {
      var cycle = t % 4.8;
      if (cycle > 4.46) blink = clamp(1 - Math.abs(cycle - 4.63) / 0.16, 0, 1);
    }

    var hop = 0;
    if (mood === 'happy') {
      var hopU = clamp((p - 0.08) / 0.72, 0, 1);
      hop = Math.max(0, Math.sin(hopU * TAU)) * 36 * e * reduced;
    } else if (mood === 'celebrate') {
      var celeU = clamp((p - 0.05) / 0.78, 0, 1);
      hop = Math.max(0, Math.sin(celeU * TAU)) * 52 * e * reduced;
    }

    var sx = 1, sy = 1, tilt = 0, shake = 0;
    var breath = Math.sin(t * 1.8) * 0.012 * (avatar ? 0 : 1);
    sx += breath * -0.7;
    sy += breath;
    if (mood === 'happy') {
      var crouch = smooth(clamp(p / 0.1, 0, 1)) * (1 - smooth(clamp((p - 0.1) / 0.1, 0, 1)));
      sy += (-0.08 * crouch + hop / 520) * reduced;
      sx += 0.06 * crouch * reduced;
      tilt += Math.sin(p * Math.PI * 4) * 0.05 * e * reduced;
    } else if (mood === 'celebrate') {
      var recoil = 0;
      if (Math.abs(p - 0.1) < 0.06) recoil += Math.cos(Math.abs(p - 0.1) / 0.06 * Math.PI);
      if (Math.abs(p - 0.36) < 0.06) recoil += Math.cos(Math.abs(p - 0.36) / 0.06 * Math.PI);
      sy += (hop / 640 - recoil * 0.035) * reduced;
      tilt += Math.sin(p * Math.PI * 3) * 0.14 * e * reduced;
    } else if (mood === 'sad') {
      sy += -0.16 * e;
      sx += 0.12 * e;
      tilt += 0.1 * e;
    } else if (mood === 'angry') {
      sy += 0.14 * e;
      sx += -0.1 * e;
      shake = Math.sin(p * Math.PI * 10) * 7 * e * reduced;
      tilt += Math.sin(p * Math.PI * 10) * 0.04 * e;
    } else if (mood === 'sleep') {
      sy += -0.08 * e;
      sx += 0.06 * e;
      tilt += -0.05 * e;
    } else if (mood === 'pet') {
      if (face === 'notice') {
        sy += -0.04 * k;
        tilt += 0.05 * k;
      } else {
        sy += -0.05 * k;
        sx += 0.04 * k;
        var lean = env.pointer && env.pointer.x > 0.15 ? 1 : -1;
        tilt += -0.2 * lean * k * reduced;
        shake += -14 * lean * k * reduced;
      }
    } else if (mood === 'grab') {
      sy += 0.2 * e;
      sx += -0.14 * e;
      tilt += clamp(env.pointer ? env.pointer.x : 0, -1, 1) * 0.08 * e;
    } else if (mood === 'land') {
      var bounce = Math.sin(clamp(p, 0, 1) * Math.PI);
      sy += -0.1 * bounce * (0.45 + (state.fromGrab || 0) * 0.55) * reduced;
      sx += 0.1 * bounce * reduced;
    } else if (mood === 'look' || mood === 'typing') {
      var dir = mood === 'typing' ? 0.55 : clamp(env.pointer ? env.pointer.x : 0, -1, 1);
      tilt += dir * 0.08 * e;
      shake += dir * 6 * e;
    }

    var bob = mood === 'idle' || mood === 'look' || mood === 'typing' ? Math.sin(t * 1.7) * 3.2 * reduced : 0;
    var cx = avatar ? 0 : HOME_X + (env.offsetX || 0) + (env.dragX || 0) + shake;
    var cy = avatar ? 0 : HOME_Y + (env.dragY || 0) - hop - bob;
    var lift = hop + bob + (avatar ? 0 : Math.max(0, -(env.dragY || 0)));

    if (!avatar) {
      var shadowScale = clamp(1 - lift / 150, 0.4, 1);
      dab(ctx, cx, 324, 62 * shadowScale, '#5c4a38', 0.22 * shadowScale);
    }

    var gazeX = Math.sin(t * 0.55) * 2.4;
    var gazeY = Math.cos(t * 0.4) * 1.4;
    if (mood === 'look') {
      gazeX = clamp(env.pointer ? env.pointer.x : 0, -1, 1) * 6;
      gazeY = clamp(env.pointer ? env.pointer.y : 0, -1, 1) * 4;
    } else if (mood === 'typing') {
      gazeX = 5;
      gazeY = 6;
    } else if (mood === 'sad') {
      gazeY = 6;
    } else if (face === 'notice') {
      gazeY = -4;
    } else if (mood === 'grab') {
      gazeX = clamp(env.pointer ? env.pointer.x : 0, -1, 1) * 5;
      gazeY = -2;
    }

    var nestle = !avatar && Math.abs(cx - HOME_X) < 78 && lift < 14 && Math.abs(env.dragY || 0) < 10;
    if (!avatar && !nestle) saucerFront(ctx);

    ctx.save();
    ctx.translate(cx, cy + BODY_RY);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);
    ctx.translate(0, -BODY_RY);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(body, -body.width / (2 * PAINT), -body.height / (2 * PAINT), body.width / PAINT, body.height / PAINT);
    var blush = face === 'pet' ? 0.45 : face === 'happy' || face === 'celebrate' ? 0.28 : 0;
    if (blush) {
      dab(ctx, -54, 34, 12, '#e08b84', blush);
      dab(ctx, 54, 34, 12, '#e08b84', blush);
    }
    var eyeK = mood === 'pet' ? k : e;
    drawEye(ctx, -32, -1, face, eyeK, gazeX, gazeY, blink);
    drawEye(ctx, 32, 1, face, eyeK, gazeX, gazeY, blink);
    ctx.save();
    ctx.translate(0, 50);
    drawMouth(ctx, face, mood === 'pet' ? k : Math.max(e, face === 'idle' ? 1 : e));
    ctx.restore();
    ctx.restore();

    if (!avatar && !opts.noEffects) {
      if (mood === 'celebrate' && e > 0.05) confetti(ctx, cx, cy - BODY_RY * sy + 6, p, reduced);
      if (mood === 'pet' && main > 0.2) {
        var hearts = [[-28, -96, '#ef5d5d'], [34, -108, '#f0b429'], [0, -124, '#ff8a3d']];
        for (var h = 0; h < hearts.length; h++) {
          ctx.save();
          ctx.globalAlpha = main * (h === 2 ? 0.8 : 1);
          ctx.translate(cx + hearts[h][0], cy + hearts[h][1] - main * (18 + h * 10));
          heart(ctx, 1.15, hearts[h][2]);
          ctx.restore();
        }
      }
      if (mood === 'sleep' && e > 0.35) {
        var za = Math.min(1, (e - 0.35) / 0.4) * 0.85;
        var zy = cy - 80 - Math.sin(t * 2) * 3;
        stroke(ctx, cx + 76, zy, cx + 90, zy, 1.4, '#f7f1e6', za);
        stroke(ctx, cx + 90, zy, cx + 76, zy + 9, 1.3, '#f7f1e6', za);
        stroke(ctx, cx + 76, zy + 9, cx + 90, zy + 9, 1.4, '#f7f1e6', za);
      }
      if (nestle) saucerFront(ctx);
    }
  };

  window.ORB_LAYOUT = { x: HOME_X, y: HOME_Y, rx: 100, ry: 92, w: 452, h: 424 };
  window.paintRoom = paintRoom;
})();
