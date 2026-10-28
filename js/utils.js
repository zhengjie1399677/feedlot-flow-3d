/* ============================================================
 *  utils.js — 程序化材质 / 圆角几何 / 合并 / 路径 / 小工具
 *  依赖全局 THREE（r159 UMD）
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = (root.FL = root.FL || {});
  const U = (FL.U = {});

  /* ---------------- 数学 ---------------- */
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.smooth = (t) => t * t * (3 - 2 * t);
  U.smoothstep = (a, b, x) => {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.damp = (cur, target, lambda, dt) => U.lerp(cur, target, 1 - Math.exp(-lambda * dt));
  U.easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  U.wrap01 = (v) => v - Math.floor(v);

  /* 确定性随机 */
  U.rng = function (seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };

  /* ---------------- 画布 / 贴图 ---------------- */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }
  U.makeCanvas = makeCanvas;

  function speckle(ctx, w, h, n, colors, alpha, rand) {
    for (let i = 0; i < n; i++) {
      const c = colors[(rand() * colors.length) | 0];
      ctx.fillStyle = c;
      ctx.globalAlpha = alpha * (0.35 + rand() * 0.65);
      const s = 0.6 + rand() * 1.8;
      ctx.fillRect(rand() * w, rand() * h, s, s);
    }
    ctx.globalAlpha = 1;
  }

  function makeTexture(canvas, opts) {
    opts = opts || {};
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (opts.repeat) t.repeat.set(opts.repeat[0], opts.repeat[1]);
    t.colorSpace = opts.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = opts.aniso || 8;
    t.needsUpdate = true;
    return t;
  }
  U.makeTexture = makeTexture;

  function asphalt() {
    const S = 512;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(7717);
    ctx.fillStyle = '#3a3e44';
    ctx.fillRect(0, 0, S, S);
    // 大块斑驳
    for (let i = 0; i < 46; i++) {
      const x = rand() * S, y = rand() * S, r = 30 + rand() * 150;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = rand() > 0.5;
      g.addColorStop(0, dark ? 'rgba(24,27,31,0.30)' : 'rgba(110,116,124,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 骨料
    speckle(ctx, S, S, 12000, ['#575c63', '#2d3136', '#6b7079', '#212428'], 0.55, rand);
    // 裂缝
    ctx.strokeStyle = 'rgba(22,24,27,0.55)';
    for (let i = 0; i < 9; i++) {
      ctx.lineWidth = 0.7 + rand() * 1.1;
      ctx.beginPath();
      let x = rand() * S, y = rand() * S;
      ctx.moveTo(x, y);
      for (let k = 0; k < 8; k++) {
        x += (rand() - 0.5) * 70;
        y += (rand() - 0.5) * 70;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // 被磨亮的车辙
    for (let i = 0; i < 3; i++) {
      const y = 70 + rand() * 380;
      const g = ctx.createLinearGradient(0, y - 26, 0, y + 26);
      g.addColorStop(0, 'rgba(120,126,134,0)');
      g.addColorStop(0.5, 'rgba(120,126,134,0.06)');
      g.addColorStop(1, 'rgba(120,126,134,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, y - 26, S, 52);
    }
    return c;
  }

  function concrete() {
    const S = 512;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(913);
    ctx.fillStyle = '#8a8983';
    ctx.fillRect(0, 0, S, S);
    // 大尺度色差：四个板块各自微偏
    for (let py = 0; py < 2; py++) {
      for (let px = 0; px < 2; px++) {
        ctx.fillStyle = rand() > 0.5 ? 'rgba(196,193,182,0.035)' : 'rgba(38,38,36,0.035)';
        ctx.fillRect(px * S / 2, py * S / 2, S / 2, S / 2);
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = rand() * S, y = rand() * S, r = 18 + rand() * 120;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() > 0.5 ? 'rgba(58,58,55,0.09)' : 'rgba(198,195,185,0.09)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    speckle(ctx, S, S, 9000, ['#a2a098', '#76756e', '#6a6962', '#b0aea4'], 0.22, rand);
    // 分格缝（只做一半位置，重复后是规整的方格，但对比很轻）
    ctx.strokeStyle = 'rgba(52,52,50,0.20)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, 1); ctx.lineTo(S, 1);
    ctx.moveTo(1, 0); ctx.lineTo(1, S);
    ctx.moveTo(0, S / 2); ctx.lineTo(S, S / 2);
    ctx.moveTo(S / 2, 0); ctx.lineTo(S / 2, S);
    ctx.stroke();
    // 油渍 / 水渍
    for (let i = 0; i < 12; i++) {
      const x = rand() * S, y = rand() * S, r = 6 + rand() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rand() > 0.7 ? 'rgba(120,120,110,0.18)' : 'rgba(26,26,25,0.16)');
      g.addColorStop(1, 'rgba(26,26,25,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    }
    return c;
  }

  function grass() {
    const S = 512;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(3312);
    ctx.fillStyle = '#28351f';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 9000; i++) {
      const x = rand() * S, y = rand() * S;
      ctx.fillStyle = ['#33442a', '#213018', '#3d4d2c', '#1b2614', '#49562f'][(rand() * 5) | 0];
      ctx.globalAlpha = 0.25 + rand() * 0.5;
      const h = 1 + rand() * 3;
      ctx.fillRect(x, y, 1, h);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(20,28,14,0.25)' : 'rgba(76,88,48,0.12)';
      ctx.beginPath();
      ctx.ellipse(rand() * S, rand() * S, 20 + rand() * 70, 14 + rand() * 50, rand() * 3, 0, 6.3);
      ctx.fill();
    }
    return c;
  }

  function corrugated() {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(551);
    ctx.fillStyle = '#5c6063';
    ctx.fillRect(0, 0, S, S);
    const period = 16;
    for (let x = 0; x < S; x += period) {
      const g = ctx.createLinearGradient(x, 0, x + period, 0);
      g.addColorStop(0, 'rgba(20,22,24,0.55)');
      g.addColorStop(0.28, 'rgba(150,156,160,0.30)');
      g.addColorStop(0.5, 'rgba(210,215,218,0.16)');
      g.addColorStop(0.72, 'rgba(90,96,100,0.05)');
      g.addColorStop(1, 'rgba(16,18,20,0.55)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, period, S);
    }
    speckle(ctx, S, S, 2600, ['#3b3e40', '#77797b', '#2a2c2d'], 0.3, rand);
    // 锈迹
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = 'rgba(92,60,36,0.10)';
      ctx.fillRect(rand() * S, rand() * S, 2 + rand() * 24, 8 + rand() * 60);
    }
    return c;
  }

  function roofMetal() {
    const S = 512;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(8821);
    ctx.fillStyle = '#3a464c';
    ctx.fillRect(0, 0, S, S);
    // 竖向锁边
    for (let x = 0; x < S; x += 64) {
      const g = ctx.createLinearGradient(x - 4, 0, x + 6, 0);
      g.addColorStop(0, 'rgba(12,16,18,0.55)');
      g.addColorStop(0.4, 'rgba(140,156,160,0.28)');
      g.addColorStop(0.55, 'rgba(190,200,202,0.16)');
      g.addColorStop(1, 'rgba(12,16,18,0.5)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 4, 0, 10, S);
      ctx.fillStyle = 'rgba(26,32,35,0.35)';
      ctx.fillRect(x + 14, 0, 1.5, S);
    }
    speckle(ctx, S, S, 3600, ['#2c3438', '#596669', '#222a2d'], 0.25, rand);
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = 'rgba(16,20,22,0.07)';
      ctx.fillRect(rand() * S, 0, 4 + rand() * 22, S);
    }
    return c;
  }

  function tarp() {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(661);
    ctx.fillStyle = '#c8c2ac';
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 30; i++) {
      const x = 30 + rand() * (S - 60);
      const g = ctx.createLinearGradient(x - 18, 0, x + 18, 0);
      g.addColorStop(0, 'rgba(120,112,92,0)');
      g.addColorStop(0.5, 'rgba(120,112,92,0.16)');
      g.addColorStop(1, 'rgba(120,112,92,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 18, 0, 36, S);
    }
    speckle(ctx, S, S, 1800, ['#a9a28c', '#ded8c4', '#918a76'], 0.3, rand);
    return c;
  }

  function concreteDark() {
    const S = 256;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(3341);
    ctx.fillStyle = '#5f615e';
    ctx.fillRect(0, 0, S, S);
    speckle(ctx, S, S, 5000, ['#6f716d', '#4f514e', '#7c7d78', '#434542'], 0.4, rand);
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(30,30,28,0.12)';
      ctx.fillRect(rand() * S, rand() * S, 6 + rand() * 40, 4 + rand() * 22);
    }
    return c;
  }

  U.textures = {};
  U.initTextures = function () {
    const T = U.textures;
    if (T.ready) return T;
    T.asphalt = makeTexture(asphalt(), { repeat: [1, 1] });
    T.concrete = makeTexture(concrete(), { repeat: [1, 1] });
    T.concreteDark = makeTexture(concreteDark(), { repeat: [1, 1] });
    T.grass = makeTexture(grass(), { repeat: [8, 8] });
    T.corrugated = makeTexture(corrugated(), { repeat: [1, 1] });
    T.roof = makeTexture(roofMetal(), { repeat: [1, 1] });
    T.tarp = makeTexture(tarp(), { repeat: [1, 1] });
    T.ready = true;
    return T;
  };

  /* 发光贴图（灯头 / 地面光斑 / 粒子共用） */
  U.radialTexture = function (inner, mid) {
    const S = 128;
    const c = makeCanvas(S);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, inner || 'rgba(255,255,255,1)');
    g.addColorStop(0.25, mid || 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  /* ---------------- 圆角盒 ---------------- */
  const rbCache = new Map();
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  U.roundedBox = function (w, h, d, r) {
    r = Math.min(r || 0.08, w / 2 - 0.015, h / 2 - 0.015, d / 2 - 0.015);
    if (r < 0.012) return new THREE.BoxGeometry(w, h, d).toNonIndexed();
    const key = [w.toFixed(3), h.toFixed(3), d.toFixed(3), r.toFixed(3)].join('|');
    let base = rbCache.get(key);
    if (!base) {
      const b = Math.min(r * 0.55, 0.16, d * 0.3, w * 0.12, h * 0.12);
      const shape = roundedRectShape(w - 2 * b, h - 2 * b, Math.max(0.001, r - b));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.01, d - 2 * b),
        bevelEnabled: true,
        bevelThickness: b,
        bevelSize: b,
        bevelSegments: 2,
        curveSegments: 4,
        steps: 1,
      });
      geo.computeBoundingBox();
      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      geo.scale(w / size.x, h / size.y, d / size.z);
      geo.center();
      geo.computeVertexNormals();
      base = geo;
      rbCache.set(key, base);
    }
    return base.clone();
  };

  /* ---------------- 几何合并 ---------------- */
  U.merge = function (list) {
    let count = 0;
    const prepared = [];
    for (let i = 0; i < list.length; i++) {
      let g = list[i];
      if (g.index) g = g.toNonIndexed();
      const pos = g.getAttribute('position');
      if (!pos) continue;
      const uv = g.getAttribute('uv');
      const nor = g.getAttribute('normal');
      if (!uv) {
        const arr = new Float32Array(pos.count * 2);
        g.setAttribute('uv', new THREE.BufferAttribute(arr, 2));
      }
      if (!nor) g.computeVertexNormals();
      prepared.push(g);
      count += pos.count;
    }
    const posArr = new Float32Array(count * 3);
    const norArr = new Float32Array(count * 3);
    const uvArr = new Float32Array(count * 2);
    let o3 = 0, o2 = 0;
    for (let i = 0; i < prepared.length; i++) {
      const g = prepared[i];
      const p = g.getAttribute('position').array;
      const n = g.getAttribute('normal').array;
      const u = g.getAttribute('uv').array;
      posArr.set(p, o3);
      norArr.set(n, o3);
      uvArr.set(u, o2);
      o3 += p.length;
      o2 += u.length;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(norArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
    geo.computeBoundingSphere();
    return geo;
  };

  /* 按材质收集几何，最后每种材质合成一个 mesh */
  U.Kit = class Kit {
    constructor() {
      this.map = new Map();
    }
    add(geo, mat, matrix) {
      if (matrix) geo.applyMatrix4(matrix);
      if (geo.index) geo = geo.toNonIndexed();
      let arr = this.map.get(mat);
      if (!arr) {
        arr = [];
        this.map.set(mat, arr);
      }
      arr.push(geo);
      return this;
    }
    build(target, opts) {
      opts = opts || {};
      for (const [mat, list] of this.map) {
        if (!list.length) continue;
        const mesh = new THREE.Mesh(U.merge(list), mat);
        mesh.castShadow = opts.castShadow !== false && !mat.userData.noShadow;
        mesh.receiveShadow = opts.receiveShadow !== false;
        target.add(mesh);
      }
      this.map.clear();
      return target;
    }
  };

  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  U.mat4 = function (x, y, z, rx, ry, rz, sx, sy, sz) {
    _e.set(rx || 0, ry || 0, rz || 0);
    _q.setFromEuler(_e);
    _p.set(x || 0, y || 0, z || 0);
    _s.set(sx == null ? 1 : sx, sy == null ? 1 : sy, sz == null ? 1 : sz);
    return new THREE.Matrix4().compose(_p, _q, _s);
  };

  U.box = function (kit, mat, w, h, d, x, y, z, rx, ry, rz, r) {
    const g = r ? U.roundedBox(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
    kit.add(g, mat, U.mat4(x, y, z, rx, ry, rz));
  };

  U.cyl = function (kit, mat, rt, rb, h, seg, x, y, z, rx, ry, rz) {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg || 18, 1, false);
    kit.add(g, mat, U.mat4(x, y, z, rx, ry, rz));
  };

  /* ---------------- 材质快捷 ---------------- */
  U.std = function (opts) {
    const m = new THREE.MeshStandardMaterial(opts);
    return m;
  };

  /* ---------------- 文字贴图 / 标志牌 ---------------- */
  U.textTexture = function (opts) {
    const W = opts.w || 1024, H = opts.h || 256;
    const c = makeCanvas(W, H);
    const ctx = c.getContext('2d');
    if (opts.bg) {
      ctx.fillStyle = opts.bg;
      ctx.fillRect(0, 0, W, H);
    }
    if (opts.border) {
      ctx.strokeStyle = opts.border;
      ctx.lineWidth = opts.borderWidth || 4;
      ctx.strokeRect(6, 6, W - 12, H - 12);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const font = opts.font || '"Bahnschrift","Microsoft YaHei",sans-serif';
    if (opts.text) {
      ctx.fillStyle = opts.color || '#e8eef2';
      ctx.font = (opts.weight || 600) + ' ' + (opts.size || 92) + 'px ' + font;
      if (opts.shadow) {
        ctx.shadowColor = opts.shadow;
        ctx.shadowBlur = opts.shadowBlur || 22;
      }
      ctx.fillText(opts.text, W / 2, opts.sub ? H * 0.4 : H * 0.5);
      ctx.shadowBlur = 0;
    }
    if (opts.sub) {
      ctx.fillStyle = opts.subColor || 'rgba(220,230,236,0.62)';
      ctx.font = '400 ' + (opts.subSize || 36) + 'px ' + font;
      ctx.fillText(opts.sub, W / 2, H * 0.72);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };

  U.signMaterial = function (tex, opacity, additive) {
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: opacity == null ? 1 : opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  };

  U.glowMaterial = function (color, opacity) {
    return new THREE.SpriteMaterial({
      map: U.glowTex || (U.glowTex = U.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.4)')),
      color: color,
      transparent: true,
      opacity: opacity == null ? 1 : opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
  };

  U.sprite = function (color, size, opacity) {
    const s = new THREE.Sprite(U.glowMaterial(color, opacity));
    s.scale.set(size, size, 1);
    return s;
  };

  U.groundGlow = function (color, size, opacity) {
    const geo = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshBasicMaterial({
      map: U.glowTex || (U.glowTex = U.radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0.4)')),
      color: color,
      transparent: true,
      opacity: opacity == null ? 0.5 : opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      fog: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    return m;
  };

  /* ---------------- 路径 ---------------- */
  U.Path = class Path {
    constructor(ways, opts) {
      opts = opts || {};
      this.ways = ways;
      const pts = ways.map((p) => new THREE.Vector3(p.x, p.y || 0.72, p.z));
      this.curve = new THREE.CatmullRomCurve3(pts, !!opts.closed, 'catmullrom', opts.tension == null ? 0.35 : opts.tension);
      this.curve.arcLengthDivisions = 2000;
      this.length = this.curve.getLength();
      this._p = new THREE.Vector3();
      this._t = new THREE.Vector3();
    }
    pointAt(s, out) {
      const u = U.clamp(s / this.length, 0, 1);
      this.curve.getPointAt(u, out || this._p);
      return out || this._p;
    }
    tangentAt(s, out) {
      const u = U.clamp(s / this.length, 0, 1);
      this.curve.getTangentAt(u, out || this._t);
      return out || this._t;
    }
    distOf(wayIndex) {
      const p = new THREE.Vector3(this.ways[wayIndex].x, this.ways[wayIndex].y || 0.72, this.ways[wayIndex].z);
      let best = Infinity, bestU = 0;
      const N = 1600;
      const v = new THREE.Vector3();
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        this.curve.getPointAt(u, v);
        const d = v.distanceToSquared(p);
        if (d < best) {
          best = d;
          bestU = u;
        }
      }
      return bestU * this.length;
    }
  };

  /* 固定步长模拟（截图/首屏快进） */
  U.simulate = function (seconds, step, fn) {
    let t = 0;
    const s = step || 1 / 30;
    while (t < seconds) {
      fn(Math.min(s, seconds - t));
      t += s;
    }
  };

})(window);
