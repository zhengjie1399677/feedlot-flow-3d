import * as THREE from 'three';
import { FL } from './fl.js';

/* ============================================================
 *  world.js — 场地、路网、围栏、灯杆、树木、标签、灯光
 * ============================================================ */
  const U = FL.U;
  const L = FL.LAYOUT;

  const css = (hex) => '#' + ('000000' + hex.toString(16)).slice(-6);

  function roundedRectShape(w, d, r) {
    r = Math.min(r, w / 2 - 0.01, d / 2 - 0.01);
    const s = new THREE.Shape();
    const x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + d - r);
    s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + d);
    s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }

  function flatRound(kit, mat, w, d, x, z, y, r, uvTile) {
    const g = new THREE.ShapeGeometry(roundedRectShape(w, d, r), 10);
    const uv = g.getAttribute('uv');
    if (!uvTile) {
      // uvTile 省略 = 整张图只铺一次（大块地面用，避免看出平铺接缝）
      g.computeBoundingBox();
      const bb = g.boundingBox;
      const sx = Math.max(1e-6, bb.max.x - bb.min.x), sy = Math.max(1e-6, bb.max.y - bb.min.y);
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (uv.getX(i) - bb.min.x) / sx, (uv.getY(i) - bb.min.y) / sy);
      }
    } else {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / uvTile, uv.getY(i) / uvTile);
    }
    g.rotateX(-Math.PI / 2);
    g.translate(x, y, z);
    kit.add(g, mat);
  }

  function ribbonGeo(pts, width, y, opts) {
    opts = opts || {};
    const uvTile = opts.uv || 12;
    const offset = opts.offset || 0;
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], 0, p[1])),
      false,
      'catmullrom',
      opts.tension == null ? 0.35 : opts.tension
    );
    curve.arcLengthDivisions = 900;
    const len = curve.getLength();
    const n = Math.max(10, Math.ceil(len / 2.2));
    const pos = [], uv = [], idx = [];
    let dist = 0;
    const prev = new THREE.Vector3();
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      t.y = 0;
      t.normalize();
      const nx = t.z, nz = -t.x;
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev.copy(p);
      const a = offset - width / 2;
      const b = offset + width / 2;
      pos.push(p.x + nx * a, y, p.z + nz * a);
      pos.push(p.x + nx * b, y, p.z + nz * b);
      uv.push(dist / uvTile, 0, dist / uvTile, width / uvTile);
      if (i < n) {
        const k = i * 2;
        idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function curveOf(pts) {
    const c = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(p[0], 0, p[1])),
      false,
      'catmullrom',
      0.35
    );
    c.arcLengthDivisions = 900;
    return c;
  }

  /* 沿曲线撒短划线（自动避让交叉路口内部与内凹倒角区域） */
  function inJunction(x, z, pad) {
    pad = pad || 0;
    for (const j of L.junctions) {
      const rx = j.w * 0.5 + (j.r || 0) * 0.82 + pad;
      const rz = j.d * 0.5 + (j.r || 0) * 0.82 + pad;
      if (Math.abs(x - j.x) < rx && Math.abs(z - j.z) < rz) return true;
    }
    return false;
  }

  /* 真实工程内凹圆角倒角（Concave Corner Fillet）+ 配套内凹路缘与弧形白边线 */
  function concaveFillet(kit, M, cx, cz, hwX, hwZ, sx, sz, R) {
    const seg = 10;
    const x0 = cx + sx * hwX;
    const z0 = cz + sz * hwZ;

    // 1) 沥青内凹倒角三角弧片
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(sx * R, 0);
    for (let i = 1; i <= seg; i++) {
      const a = (i / seg) * (Math.PI / 2);
      const px = sx * R * (1 - Math.sin(a));
      const pz = sz * R * (1 - Math.cos(a));
      shape.lineTo(px, -pz);
    }
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape, 1);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 12, uv.getY(i) / 12);
    g.rotateX(-Math.PI / 2);
    g.translate(x0, 0.226, z0);
    kit.add(g, M.asphalt);

    // 2) 底层内凹混凝土路缘倒角（比沥青宽 0.75m）
    const Rc = R + 0.75;
    const cShape = new THREE.Shape();
    cShape.moveTo(-sx * 0.75, -sz * 0.75);
    cShape.lineTo(sx * R, -sz * 0.75);
    cShape.lineTo(sx * R, 0);
    for (let i = 1; i <= seg; i++) {
      const a = (i / seg) * (Math.PI / 2);
      const px = sx * (R - (Rc - R) * Math.sin(a) + (Rc - R) * 0) + sx * R * (1 - Math.sin(a)) - sx * R;
      // 直接围绕圆心 (sx*(R+0.75), sz*(R+0.75)) 以半径 R 做平滑路缘外弧
      const cpx = sx * (R + 0.75 - R * Math.sin(a));
      const cpz = sz * (R + 0.75 - R * Math.cos(a));
      cShape.lineTo(cpx, -cpz);
    }
    cShape.lineTo(-sx * 0.75, -sz * R);
    cShape.closePath();
    const gc = new THREE.ShapeGeometry(cShape, 1);
    gc.rotateX(-Math.PI / 2);
    gc.translate(x0, 0.134, z0);
    kit.add(gc, M.curb);

    // 3) 紧贴内凹弧线的白边线（距沥青边缘内缩 0.50m）
    const Rl = Math.max(0.6, R + 0.50);
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * (Math.PI / 2);
      const lx = x0 + sx * (R - Rl * Math.sin(a));
      const lz = z0 + sz * (R - Rl * Math.cos(a));
      pts.push([lx, lz]);
    }
    kit.add(ribbonGeo(pts, 0.16, 0.240, { uv: 6, tension: 0.2 }), M.line);
  }

  function clippedLineRibbon(kit, mat, pts, width, y, offset, clipPad) {
    const curve = curveOf(pts);
    const len = curve.getLength();
    const step = 1.4;
    const n = Math.max(12, Math.ceil(len / step));
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    const pos = [], uv = [], idx = [];
    let dist = 0;
    const prev = new THREE.Vector3();
    let segOpen = false;
    let baseVert = 0;

    for (let i = 0; i <= n; i++) {
      const u = i / n;
      curve.getPointAt(u, p);
      curve.getTangentAt(u, t);
      t.y = 0;
      t.normalize();
      const nx = t.z, nz = -t.x;
      const lx = p.x + nx * offset;
      const lz = p.z + nz * offset;
      if (i > 0) dist += Math.hypot(p.x - prev.x, p.z - prev.z);
      prev.copy(p);

      if (inJunction(lx, lz, clipPad)) {
        segOpen = false;
        continue;
      }
      const a = offset - width / 2;
      const b = offset + width / 2;
      const vIdx = pos.length / 3;
      pos.push(p.x + nx * a, y, p.z + nz * a);
      pos.push(p.x + nx * b, y, p.z + nz * b);
      uv.push(dist / 6, 0, dist / 6, width / 6);
      if (segOpen) {
        idx.push(baseVert, vIdx, baseVert + 1, baseVert + 1, vIdx, vIdx + 1);
      }
      baseVert = vIdx;
      segOpen = true;
    }
    if (!idx.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    kit.add(g, mat);
  }

  function dashLine(kit, mat, pts, w, dash, gap, y) {
    const curve = curveOf(pts);
    const len = curve.getLength();
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (let d = 3; d < len - 3; d += dash + gap) {
      curve.getPointAt(d / len, p);
      if (inJunction(p.x, p.z, 0.4)) continue;
      curve.getTangentAt(d / len, t);
      U.box(kit, mat, w, 0.02, dash, p.x, y, p.z, 0, Math.atan2(t.x, t.z), 0);
    }
  }

  function bar(kit, mat, x1, z1, x2, z2, y, h, w) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    U.box(kit, mat, w, h, len, (x1 + x2) / 2, y, (z1 + z2) / 2, 0, Math.atan2(dx, dz), 0);
  }

  /* ---------------- 材质 ---------------- */
  function makeMaterials() {
    const T = U.initTextures();
    T.grass.repeat.set(1, 1);
    T.asphalt.repeat.set(1, 1);
    T.concrete.repeat.set(1, 1);
    T.concreteDark.repeat.set(1, 1);
    T.corrugated.repeat.set(3, 1);
    T.roof.repeat.set(4, 1);
    T.tarp.repeat.set(2, 1);

    const S = (o) => {
      const m = new THREE.MeshStandardMaterial(o);
      m.envMapIntensity = 0.82;
      return m;
    };
    // 开源 PBR 材质（ambientCG CC0）：albedo + normal + roughness + ao，
    // 贴图按 U.box 的世界尺度 uv 铺开，normalMap 让彩钢板的肋和混凝土的气孔
    // 真的凸出来——几何没变，读起来的"表面"已经不是那块色板了。
    const PBR = (surfName, color, rough, metal, tile, opts) => {
      opts = opts || {};
      const t = U.surface(surfName, { tile: tile });
      const cfg = {
        color: color,
        roughness: rough,
        metalness: metal,
        normalScale: new THREE.Vector2(opts.normalScale || 0.85, opts.normalScale || 0.85),
      };
      if (t.map) cfg.map = t.map;
      if (t.normalMap) cfg.normalMap = t.normalMap;
      if (t.roughnessMap && !opts.noRoughMap) cfg.roughnessMap = t.roughnessMap;
      if (t.aoMap) { cfg.aoMap = t.aoMap; cfg.aoMapIntensity = 0.7; }
      if (t.metalnessMap) cfg.metalnessMap = t.metalnessMap;
      const m = S(cfg);
      if (opts.env != null) m.envMapIntensity = opts.env;
      m.userData.tile = tile;
      return m;
    };
    const M = {};
    M.soil = S({ color: 0x1b1d18, roughness: 1 });
    M.plinth = S({ color: 0x0d100e, roughness: 1 });
    M.grass = S({ map: T.grass, color: 0xb4c296, roughness: 1, envMapIntensity: 0.25 });
    M.lawn = S({ map: T.lawn, color: 0xa8b184, roughness: 1, envMapIntensity: 0.25 });
    const matteConc = { noRoughMap: true, normalScale: 0.22, env: 0.22 };
    M.apron = PBR('Concrete034', 0x7b858c, 0.98, 0.0, 7, matteConc);
    M.apronEdge = PBR('Concrete034', 0x707b82, 0.98, 0.0, 5, matteConc);
    M.asphalt = PBR('Asphalt033', 0x5c6064, 0.96, 0.0, 9, { noRoughMap: true, normalScale: 0.30, env: 0.25 });
    M.curb = PBR('Concrete034', 0x859096, 0.98, 0.0, 2.2, matteConc);
    M.line = S({ color: 0xb8c2c4, roughness: 0.82, envMapIntensity: 0.3 });
    M.yellow = S({ color: 0xc79b3f, roughness: 0.72, metalness: 0.08, envMapIntensity: 0.35 });
    M.yard = PBR('Concrete034', 0x778289, 0.98, 0.0, 6, matteConc);
    M.floor = PBR('Concrete034', 0x8e969a, 0.96, 0.0, 5, matteConc);
    M.wall = PBR('PaintedPlaster017', 0xa9a496, 0.9, 0.02, 4);
    M.wallCool = PBR('PaintedPlaster017', 0x8a9193, 0.9, 0.02, 4);
    M.wallDark = PBR('CorrugatedSteel009', 0x748388, 0.62, 0.35, 2.4);
    M.wallPlant = S({ color: 0x93a1a5, roughness: 0.8, metalness: 0.05 });
    M.roofDeck = S({ color: 0x848e92, roughness: 0.86, metalness: 0.04 });
    M.curtainOffice = S({ color: 0x7d94a3, roughness: 0.42, metalness: 0.1 });
    M.roof = PBR('CorrugatedSteel009', 0x7a5447, 0.62, 0.3, 2.4);
    M.roofSouth = PBR('CorrugatedSteel009', 0x6c4740, 0.64, 0.28, 2.4);
    // 牛舍专用蓝：墙 / 北排屋面 / 南排屋面（与其它建筑共用材质分开，避免整场变蓝）
    M.barnWall = PBR('PaintedPlaster017', 0x7ba0bc, 0.86, 0.03, 4);
    M.barnRoof = PBR('CorrugatedSteel009', 0x3f6f9e, 0.6, 0.34, 2.4);
    M.barnRoofSouth = PBR('CorrugatedSteel009', 0x35608b, 0.62, 0.32, 2.4);
    M.skylight = S({ map: T.roof, color: 0xd3e2ea, roughness: 0.28, metalness: 0.18 });
    M.roofPlant = PBR('CorrugatedSteel009', 0x8a979c, 0.52, 0.38, 2.4);
    M.timber = S({ color: 0x54402f, roughness: 0.85 });
    M.timberLight = S({ color: 0x8a6a4a, roughness: 0.85 });
    M.steel = S({ color: 0x38424a, roughness: 0.42, metalness: 0.75 });
    M.steelLight = S({ color: 0xa7b5bd, roughness: 0.3, metalness: 0.85 });
    M.galv = PBR('CorrugatedSteel009', 0xa8b2b6, 0.42, 0.62, 1.8);
    // TMR 的罐子：哑光浅灰白烤漆钢板（避免强光下过曝死白）
    M.tmrWhite = S({ color: 0xd9dfe3, roughness: 0.46, metalness: 0.30 });
    M.tmrWhite.envMapIntensity = 1.0;
    M.glass = S({ color: 0x0c161d, roughness: 0.07, metalness: 0.9 });
    // 大面积玻璃幕墙：纯镜面在没有强环境光时整片发黑，单独给一个带底色的版本
    M.curtain = S({ color: 0x5a6b78, roughness: 0.34, metalness: 0.06, envMapIntensity: 2.0 });
    M.concreteTrough = S({ color: 0x8f918a, roughness: 0.95 });
    M.feed = S({ color: 0x8b6f3c, roughness: 0.98 });
    // 写实切碎全混合日粮（TMR）材质：金黄玉米青贮+干草碎丝+碎玉米粒+微凹凸，告别绿色海绵块
    const tmrLoader = new THREE.TextureLoader();
    const tmrMap = tmrLoader.load('textures/tmr_forage_albedo.jpg');
    tmrMap.colorSpace = THREE.SRGBColorSpace;
    tmrMap.wrapS = tmrMap.wrapT = THREE.RepeatWrapping;
    tmrMap.anisotropy = 8;
    const tmrBump = tmrLoader.load('textures/tmr_forage_bump.jpg');
    tmrBump.wrapS = tmrBump.wrapT = THREE.RepeatWrapping;
    M.feedPile = new THREE.MeshStandardMaterial({
      map: tmrMap,
      bumpMap: tmrBump,
      bumpScale: 0.14,
      color: 0xd6c79c,
      vertexColors: true,
      roughness: 0.99,
      metalness: 0.0,
      envMapIntensity: 0.22,
    });
    M.silage = S({ color: 0x59612c, roughness: 1 });
    M.tarp = S({ map: T.tarp, color: 0xb2ad9a, roughness: 0.85 });
    M.film = S({ map: T.tarp, color: 0xd9d7cd, roughness: 0.55 });
    M.dirt = S({ color: 0x2b251a, roughness: 1 });
    M.compact = S({ map: T.concrete, color: 0x8b8270, roughness: 1 });
    M.water = S({ color: 0x18343c, roughness: 0.05, metalness: 0.9 });
    M.red = S({ color: 0x8d3a30, roughness: 0.55 });
    M.blue = S({ color: 0x2e4d63, roughness: 0.55 });
    M.hay = S({ color: 0x9b8d6a, roughness: 1 });
    // 交易栏圈地面：浅灰垫层，跟黄褐色的牛拉开（原来是黄的，牛也黄，糊成一片）
    M.penPad = S({ map: T.concrete, color: 0xb3b3ad, roughness: 0.95 });
    M.grunge = new THREE.MeshStandardMaterial({
      map: T.grunge, transparent: true, opacity: 0.9, roughness: 1, metalness: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    M.track = new THREE.MeshStandardMaterial({
      color: 0x2a251f, transparent: true, opacity: 0.20, roughness: 1, metalness: 0,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    M.barnPad = S({ map: T.concrete, color: 0xb0aea6, roughness: 0.96 });
    M.barnStraw = S({ color: 0x8d8574, roughness: 1 });
    M.bark = S({ color: 0x3a2c21, roughness: 0.95 });
    M.leafA = S({ color: 0x243a20, roughness: 0.95 });
    M.leafB = S({ color: 0x2f4a26, roughness: 0.95 });
    // 自发光件：用 StandardMaterial 的 emissive，才能被昼夜循环按 nightF 调亮度
    // （BasicMaterial 没有 emissiveIntensity，白天会和夜里一样亮，非常假）
    const emis = function (r, g, bl, i) {
      return new THREE.MeshStandardMaterial({
        color: 0x0b0906, emissive: new THREE.Color(r, g, bl),
        emissiveIntensity: i, roughness: 1, metalness: 0,
      });
    };
    M.lamp = emis(2.4, 1.55, 0.86, 1.0);
    M.warmGlow = emis(1.6, 0.9, 0.42, 1.0);
    M.redBeam = emis(2.4, 0.3, 0.22, 1.0);
    M.waterGlow = emis(0.4, 0.8, 1.2, 1.0);
    return M;
  }

  /* ---------------- 地面与路网 ---------------- */
  function buildGround(kit, M) {
    const cz = L.slab.cz;
    // 底座
    U.box(kit, M.soil, L.slab.w, 9, L.slab.d, 0, -4.6, cz, 0, 0, 0, 5);
    U.box(kit, M.plinth, L.slab.w + 5, 1.6, L.slab.d + 5, 0, -9.6, cz, 0, 0, 0, 6);
    // 草皮
    flatRound(kit, M.lawn, 252, 192, 0, cz, 0.04, 6, 0);
    // 场地
    flatRound(kit, M.apronEdge, 232, 168, 0, -4, 0.16, 13, 12);
    flatRound(kit, M.apron, 228, 164, 0, -4, 0.2, 12, 12);
    // 场内水泥分区（配料场院：覆盖北移后的三座筒仓、TMR 车间与双联青贮窖）
    flatRound(kit, M.yard, 60, 96, -93, -30, 0.215, 5, 9);
    // 生产区：六栋牛舍下面铺压实土
    flatRound(kit, M.compact, 156, 76, 24, -46, 0.206, 8, 9);
    // 日粮道（两排牛舍之间）压回混凝土
    flatRound(kit, M.apron, 152, 9.0, 24, -44, 0.209, 3.6, 8);
    // 装车区前场土带
    flatRound(kit, M.compact, 34, 22, 100, -52, 0.207, 6, 8);
    // 出场装车区硬化
    flatRound(kit, M.yard, 26, 26, 104, -69, 0.215, 4, 9);
  }

  function buildRoads(kit, M, world) {
    for (const r of L.roads) {
      kit.add(ribbonGeo(r.pts, r.width + 1.5, 0.135, { uv: 10 }), M.curb);
      kit.add(ribbonGeo(r.pts, r.width, 0.225, { uv: 12 }), M.asphalt);
      // 道路边缘白线（在路口及倒角范围自动断开，绝不穿插！）
      const eo = r.width / 2 - 0.50;
      clippedLineRibbon(kit, M.line, r.pts, 0.16, 0.240, eo, -0.15);
      clippedLineRibbon(kit, M.line, r.pts, 0.16, 0.240, -eo, -0.15);
      // 道路中线：主干道双黄实线 / 支路黄虚线
      if (r.centerStyle === 'double') {
        clippedLineRibbon(kit, M.yellow, r.pts, 0.13, 0.241, 0.14, 0.2);
        clippedLineRibbon(kit, M.yellow, r.pts, 0.13, 0.241, -0.14, 0.2);
      } else if (r.centerStyle === 'dash') {
        dashLine(kit, M.yellow, r.pts, 0.16, 2.4, 4.8, 0.241);
      }
    }
    // 标准正交路口核心方片（与两路宽度完全一致，零外凸）+ 真实内凹圆角倒角（Concave Fillets）
    for (const j of L.junctions) {
      flatRound(kit, M.curb, j.w + 1.5, j.d + 1.5, j.x, j.z, 0.134, 0.6, 10);
      flatRound(kit, M.asphalt, j.w, j.d, j.x, j.z, 0.226, 0.2, 12);
      const R = j.r || 2.8;
      for (const f of (j.fillets || [])) {
        concaveFillet(kit, M, j.x, j.z, j.w * 0.5, j.d * 0.5, f[0], f[1], R);
      }
    }

    // 路口停止线（Stop Bars）
    const stopBars = [
      // 西大门前 & 地磅前
      [-122.6, 56, 0.36, 10.2],
      [-92.2, 56, 0.36, 10.2],
      // 西干道 × 南干道
      [-49.5, 48, 0.36, 8.8],
      [-58, 39.8, 9.6, 0.36],
      // 青贮支路 & TMR 南支路汇入西干道
      [-66.5, -4, 0.34, 7.4],
      [-66.2, -26, 0.34, 7.0],
      // 西干道 × 中央日粮道十字路口
      [-49.5, -44, 0.36, 9.4],
      [-66.5, -44, 0.34, 7.2],
      [-58, -35.8, 9.6, 0.36],
      [-58, -52.2, 9.6, 0.36],
      // 中央日粮道汇入东干道
      [103.5, -44, 0.36, 9.4],
      // 东干道 × 南干道 & 东南出园大门前停止线
      [103.5, 48, 0.36, 8.8],
      [112, 39.8, 9.6, 0.36],
      [112, 56.2, 9.6, 0.36],
      [112, 83.2, 10.0, 0.36],
    ];
    for (const s of stopBars) {
      U.box(kit, M.line, s[2], 0.022, s[3], s[0], 0.242, s[1]);
    }
    // 东北封闭拐角 (112, -84) 外侧白边收口线（北缘与东缘直角闭合）
    U.box(kit, M.line, 10.2, 0.020, 0.16, 112.0, 0.240, -89.0);
    U.box(kit, M.line, 0.16, 0.020, 10.2, 117.0, 0.240, -84.0);

    // 人行横道斑马线（办公楼前、交易大厅接驳口、交易区-配料区通道）
    function crosswalk(cx, cz, len, w, alongZ) {
      const n = Math.max(4, Math.round(w / 1.15));
      for (let i = 0; i < n; i++) {
        const off = -w / 2 + (i + 0.5) * (w / n);
        if (alongZ) {
          U.box(kit, M.line, len, 0.022, 0.48, cx, 0.242, cz + off);
        } else {
          U.box(kit, M.line, 0.48, 0.022, len, cx + off, 0.242, cz);
        }
      }
    }
    crosswalk(12, 48, 2.8, 8.6, true);      // 办公楼北广场过街斑马线
    crosswalk(-20, 40.0, 6.8, 2.8, false);  // 交易大厅接驳口横向斑马线
    crosswalk(-58, 12, 8.8, 2.8, false);    // 交易区-配料区横道线

    // 地面导向箭头
    function laneArrow(x, z, rotY) {
      const m = U.mat4(x, 0.243, z, 0, rotY, 0);
      const shaft = new THREE.BoxGeometry(0.32, 0.018, 2.2);
      shaft.applyMatrix4(U.mat4(0, 0, -0.4));
      shaft.applyMatrix4(m);
      kit.add(shaft, M.line);
      const head = new THREE.ConeGeometry(0.68, 1.35, 3);
      head.rotateX(Math.PI / 2);
      head.rotateY(Math.PI / 6);
      head.scale(1, 0.02, 1);
      head.applyMatrix4(U.mat4(0, 0, 1.15));
      head.applyMatrix4(m);
      kit.add(head, M.line);
    }
    laneArrow(-100, 58.6, Math.PI / 2);     // 进场东行
    laneArrow(-55.4, 24, Math.PI);          // 西干道北行
    laneArrow(-55.4, -15, Math.PI);         // 西干道北行
    laneArrow(20, -84, Math.PI / 2);        // 北环道东行
    laneArrow(114.6, 12, 0);                // 东干道南行出场
    laneArrow(114.6, 72, 0);                // 东干道南行出场
    laneArrow(35, 50.4, Math.PI / 2);       // 南干道东行
    laneArrow(-4, -46.8, Math.PI / 2);      // 日粮道北侧东行
    laneArrow(54, -41.2, -Math.PI / 2);     // 日粮道南侧西返
    laneArrow(-72, -4, -Math.PI / 2);       // 青贮支路西进

    // 地磅前导向标线
    const wb = L.slots.weighbridge;
    for (let i = 0; i < 6; i++) {
      U.box(kit, M.yellow, 2.4, 0.022, 0.28, wb.x - 13.8, 0.242, wb.z - 4.5 + i * 1.8, 0, 0, 0);
    }
  }

  // 场院的"使用痕迹"：脏迹斑块 + 轮胎印
  function buildWear(kit, M, world) {
    const rand = U.rng(8823);
    const quad = function (w, d, x, z, rot, mat, y) {
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      kit.add(g, mat, U.mat4(x, y, z, 0, rot, 0));
    };

    // 脏迹：散在牛舍条带与场院里的大块暗斑
    const spots = [
      [-60, 8, 44, 30], [10, -6, 52, 34], [70, 10, 46, 32], [96, -30, 40, 30],
      [-20, 34, 50, 36], [40, 30, 44, 28], [-96, 20, 34, 26], [110, 34, 38, 26],
      [24, -50, 40, 26], [-44, -52, 36, 24], [86, -52, 38, 24], [52, 58, 46, 30],
    ];
    for (let i = 0; i < spots.length; i++) {
      const sp = spots[i];
      quad(sp[2], sp[3], sp[0], sp[1], rand() * Math.PI * 2, M.grunge, 0.2125);
    }

    // 轮胎印：沿每条车辆路线铺两条细带（只铺场地内的段）
    const R = L.routes;
    const names = Object.keys(R);
    for (const nm of names) {
      const pts = R[nm];
      for (let k = 0; k < pts.length - 1; k++) {
        const a = pts[k], b = pts[k + 1];
        if (a.x < -124 || a.x > 122 || a.z < -92 || a.z > 88) continue;
        if (b.x < -124 || b.x > 122 || b.z < -92 || b.z > 88) continue;
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1.2 || len > 40) continue;
        const ang = Math.atan2(dx, dz);
        const nx = (dz / len), nz = (-dx / len);
        for (const sgn of [-0.86, 0.86]) {
          const cx = (a.x + b.x) / 2 + nx * sgn;
          const cz = (a.z + b.z) / 2 + nz * sgn;
          quad(0.46, len, cx, cz, ang, M.track, 0.2135);
        }
      }
    }
  }

  function buildFlows(kit, M, world) {
    // 流向光带
    for (const f of L.flow) {
      const geo = ribbonGeo(f.pts, f.width, 0.262, { uv: 8 });
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(f.color).convertSRGBToLinear() },
          uLen: { value: 120 },
          uOpacity: { value: 1 },
        },
        vertexShader: `
          varying vec2 vUv;
          void main(){
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
          }`,
        fragmentShader: `
          uniform float uTime; uniform float uLen; uniform vec3 uColor; uniform float uOpacity;
          varying vec2 vUv;
          void main(){
            float x = vUv.x * uLen;
            float s = fract((x - uTime * 9.0) / 13.0);
            float pulse = smoothstep(0.0, 0.30, s) * (1.0 - smoothstep(0.34, 0.92, s));
            float edge = smoothstep(0.0, 0.26, vUv.y) * (1.0 - smoothstep(0.74, 1.0, vUv.y));
            float a = (0.09 + pulse * 0.40) * edge * uOpacity;
            vec3 c = uColor * (0.40 + pulse * 1.05);
            gl_FragColor = vec4(c, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      // uLen 用曲线总长
      const c = curveOf(f.pts);
      mat.uniforms.uLen.value = c.getLength();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 3;
      world.group.add(mesh);
      world.flows.push({ mesh, mat, color: f.color });
    }
  }

  /* ---------------- 围栏 ---------------- */
  function fenceLine(kit, mat, pts, h, rails, gap) {
    gap = gap || 2.6;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.max(1, Math.round(len / gap));
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        U.box(kit, mat, 0.12, h, 0.12, x, h / 2 + 0.05, z, 0, 0, 0);
      }
      for (let r = 0; r < rails; r++) {
        const yy = 0.22 + (h - 0.2) * ((r + 1) / rails);
        bar(kit, mat, x1, z1, x2, z2, yy, 0.075, 0.075);
      }
    }
  }

  /* ---------------- 园区外周界高辨识度实体围墙（底座 + 浅石材墙身 + 深灰壁柱压顶 + 顶部防攀栏杆） ---------------- */
  function perimeterWallSeg(kit, M, x1, z1, x2, z2) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 0.2) return;
    const ang = Math.atan2(dx, dz);
    const mx = (x1 + x2) * 0.5, mz = (z1 + z2) * 0.5;

    // 1. 混凝土加厚基座 + 浅灰白实体预制墙身 + 顶部深灰压顶梁（总实墙高 2.52m，俯瞰清晰醒目）
    U.box(kit, M.concreteTrough, 0.78, 0.44, len + 0.2, mx, 0.22, mz, 0, ang, 0);
    U.box(kit, M.wall,           0.40, 1.92, len,       mx, 1.40, mz, 0, ang, 0);
    U.box(kit, M.steel,          0.56, 0.18, len + 0.1, mx, 2.45, mz, 0, ang, 0);
    // 2. 顶部双道深钢防护横栏（总高 3.16m，既有通透层次又明确界定园区边界）
    U.box(kit, M.steel, 0.09, 0.08, len, mx, 2.82, mz, 0, ang, 0);
    U.box(kit, M.steel, 0.10, 0.09, len, mx, 3.12, mz, 0, ang, 0);

    // 3. 每隔 ~6.5m 设一根粗壮深灰壁柱 + 浅色柱帽，中间穿插细立杆增强立体韵律
    const bays = Math.max(1, Math.round(len / 6.5));
    for (let k = 0; k <= bays; k++) {
      const t = k / bays;
      const px = x1 + dx * t, pz = z1 + dz * t;
      U.box(kit, M.wallDark,       0.60, 3.18, 0.60, px, 1.62, pz, 0, ang, 0);
      U.box(kit, M.concreteTrough, 0.76, 0.18, 0.76, px, 3.26, pz, 0, ang, 0);
      if (k < bays) {
        for (let m = 1; m <= 2; m++) {
          const tt = (k + m / 3) / bays;
          U.box(kit, M.steel, 0.08, 0.68, 0.08, x1 + dx * tt, 2.82, z1 + dz * tt, 0, ang, 0);
        }
      }
    }
  }

  function buildFences(kit, M) {
    // 园区最外圈全封闭现代实体围墙（仅保留西进场大门与东南出园大门两个出入口，东北原路口完全封闭！）
    // 西墙（分北段与南段，并向内折接西大门门柱 x = -117）
    perimeterWallSeg(kit, M, -124, -92, -124, 48.5);
    perimeterWallSeg(kit, M, -124, 48.5, -117, 48.5);
    perimeterWallSeg(kit, M, -117, 63.5, -124, 63.5);
    perimeterWallSeg(kit, M, -124, 63.5, -124, 90);
    // 北墙（从西北角直通东北角全程封严，彻底封死原东北敞口！）
    perimeterWallSeg(kit, M, -124, -92, 124, -92);
    // 东墙（从东北角直通东南角，无缝接东南出园大门东翼墙）
    perimeterWallSeg(kit, M, 124, -92, 124, 90);
    // 南墙（从西南角直达东南出园大门西翼墙 x = 102.0）
    perimeterWallSeg(kit, M, -124, 90, 102.0, 90);

    // 四角标志性加重角柱（强化园区轮廓边界感）
    for (const [cx, cz] of [[-124, -92], [124, -92], [124, 90], [-124, 90]]) {
      U.box(kit, M.wallDark,       1.05, 3.55, 1.05, cx, 1.80, cz);
      U.box(kit, M.concreteTrough, 1.24, 0.22, 1.24, cx, 3.64, cz);
      U.box(kit, M.warmGlow,       0.42, 0.24, 0.42, cx, 3.86, cz);
    }

    // 装车围栏
    fenceLine(kit, M.steel, [[97, -62], [97, -76]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[108, -76], [108, -62]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[97, -62], [104, -62]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[97, -76], [104, -76]], 1.65, 3, 2.0);
    // 赶牛通道
    fenceLine(kit, M.steel, [[96, -65], [101, -65]], 1.6, 3, 2.0);
    fenceLine(kit, M.steel, [[96, -68], [101, -68]], 1.6, 3, 2.0);
  }

  /* ---------------- 树木 ---------------- */
  function tree(kit, M, x, z, s, kind, rand) {
    const y = 0.05;
    if (kind === 'conifer') {
      U.cyl(kit, M.bark, 0.14 * s, 0.2 * s, 2.4 * s, 6, x, y + 1.2 * s, z);
      for (let i = 0; i < 3; i++) {
        const r = (1.7 - i * 0.42) * s;
        const hh = (2.4 - i * 0.35) * s;
        const geo = new THREE.ConeGeometry(r, hh, 7);
        kit.add(geo, i % 2 ? M.leafB : M.leafA, U.mat4(x, y + (2.4 + i * 1.35) * s, z, 0, rand() * 0.6, 0));
      }
    } else {
      U.cyl(kit, M.bark, 0.16 * s, 0.24 * s, 3.0 * s, 6, x, y + 1.5 * s, z);
      for (let i = 0; i < 3; i++) {
        const r = (1.55 - i * 0.22) * s;
        const geo = new THREE.IcosahedronGeometry(r, 0);
        kit.add(geo, i % 2 ? M.leafA : M.leafB, U.mat4(
          x + (rand() - 0.5) * 1.6 * s,
          y + (3.2 + i * 0.9) * s,
          z + (rand() - 0.5) * 1.6 * s,
          rand(), rand(), rand()
        ));
      }
    }
  }

  /* ---------------- 灯杆 ---------------- */
  function lampPole(kit, M, world, x, z, h, dir, warm) {
    U.cyl(kit, M.steel, 0.11, 0.18, h, 8, x, h / 2, z);
    U.box(kit, M.steel, 2.6, 0.13, 0.13, x + Math.cos(dir) * 1.1, h - 0.1, z + Math.sin(dir) * 1.1, 0, -dir, 0);
    const hx = x + Math.cos(dir) * 2.3, hz = z + Math.sin(dir) * 2.3;
    U.box(kit, M.steel, 0.95, 0.18, 0.5, hx, h - 0.2, hz, 0, -dir, 0);
    U.box(kit, M.lamp, 0.72, 0.05, 0.34, hx, h - 0.31, hz, 0, -dir, 0);
    world.pools.push({ x: hx, z: hz, size: 22, warm: warm ? 1 : 0.35 });
    const sp = U.sprite(0xffc98a, 4.2, 0.55);
    sp.position.set(hx, h - 0.28, hz);
    world.group.add(sp);
    world.lampSprites.push(sp);
    if (warm) world.lampHeads.push({ x: hx, z: hz });
  }

  /* ---------------- 道具 ---------------- */
  function buildProps(kit, M, world) {
    const rand = U.rng(20240);

    // 灯杆（避开西大门消毒通道、地磅棚与路口边界）
    const poles = [
      [-104, 42, 9.2, -Math.PI / 2, true],
      [-64, 63, 8.8, Math.PI, false],
      [108, 18, 9.2, -Math.PI / 2, true],
      [56, 62, 8.8, Math.PI, false],
      [4, -88, 9.0, 0, false],
      [-116, 20, 8.8, 0, false],
      [-4, 30, 8.8, Math.PI / 2, false],
      [78, 30, 8.8, Math.PI, false],
      [-40, 22, 8.4, Math.PI / 2, false],
      [99, 16, 8.4, -Math.PI / 2, false],
    ];
    for (const p of poles) lampPole(kit, M, world, p[0], p[1], p[2], p[3], p[4]);

    // 料场杂物：油桶 / 托盘（靠西侧料棚边摆放整齐）
    for (let i = 0; i < 6; i++) {
      U.cyl(kit, i % 2 ? M.red : M.blue, 0.42, 0.42, 1.1, 12, -112 + (i % 3) * 1.1, 0.72, -29 + Math.floor(i / 3) * 1.1);
    }
    U.box(kit, M.timberLight, 2.4, 0.35, 2.0, -116, 0.4, -27, 0, 0.15, 0);
    U.box(kit, M.timberLight, 2.4, 0.35, 2.0, -116, 0.75, -26.8, 0, -0.08, 0);

    // 装车区坡道护栏
    U.box(kit, M.yellow, 12, 0.08, 0.12, 103, 1.4, -76.3, 0, 0, 0);
    U.box(kit, M.yellow, 12, 0.08, 0.12, 103, 1.4, -61.7, 0, 0, 0);
  }

  /* ---------------- 标签 ---------------- */
  function labelTexture(no, text, en, color) {
    const W = 512, H = 152;
    const c = U.makeCanvas(W, H);
    const ctx = c.getContext('2d');
    const rr = (x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
    ctx.fillStyle = 'rgba(6,10,15,0.82)';
    rr(4, 4, W - 8, H - 8, 16);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 2.4;
    rr(4, 4, W - 8, H - 8, 16);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // 编号块
    ctx.fillStyle = color;
    rr(22, 30, 70, 92, 10);
    ctx.fill();
    ctx.fillStyle = '#061019';
    ctx.font = '700 42px "Bahnschrift","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(no, 57, 77);
    // 文字
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e9f1f5';
    ctx.font = '600 46px "Microsoft YaHei","Bahnschrift",sans-serif';
    ctx.fillText(text, 110, 62);
    ctx.fillStyle = 'rgba(196,214,224,0.52)';
    ctx.font = '500 21px "Bahnschrift",sans-serif';
    if (ctx.letterSpacing !== undefined) ctx.letterSpacing = '3px';
    ctx.fillText(en, 112, 108);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  const LABEL_POS = {
    gate: [-112, 13.5, 56],
    weigh: [-80, 12.6, 56],
    sort: [-48, 13.2, -62],
    tmr: [-96, 19.2, -26],
    feed: [26, 14.5, -45],
    load: [106, 12.6, -66],
  };

  function buildLabels(world) {
    for (const st of L.stages) {
      const pos = LABEL_POS[st.id];
      const color = css(st.color);
      const mat = new THREE.SpriteMaterial({
        map: labelTexture(st.no, st.label, st.en, color),
        transparent: true,
        depthWrite: false,
        depthTest: true,
        toneMapped: false,
      });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(13.6, 4.0, 1);
      sp.position.set(pos[0], pos[1], pos[2]);
      sp.renderOrder = 5;
      world.group.add(sp);
      world.labels.push({ sprite: sp, id: st.id, base: pos[1] });
    }
  }

  /* ---------------- 灯光 ---------------- */
  function buildLights(scene, world) {
    const hemi = new THREE.HemisphereLight(0x5b7fa6, 0x1a231d, 2.5);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(0xc9dbff, 6.4);
    moon.position.set(-200, 285, 220);
    moon.target.position.set(0, 0, -10);
    moon.castShadow = true;
    const s = 265;
    moon.shadow.camera.left = -s;
    moon.shadow.camera.right = s;
    moon.shadow.camera.top = s;
    moon.shadow.camera.bottom = -s;
    moon.shadow.camera.near = 40;
    moon.shadow.camera.far = 960;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.42;
    scene.add(moon);
    scene.add(moon.target);

    const warm = new THREE.DirectionalLight(0xffa06a, 1.5);
    warm.position.set(170, 120, 300);
    scene.add(warm);

    // 相机侧补光：让朝向观众的面不至于全黑
    const fill = new THREE.DirectionalLight(0xa8bdd2, 1.3);
    fill.position.set(180, 130, 260);
    scene.add(fill);
    scene.add(fill.target);

    const pts = [
      [-80, 5.4, 56, 0xffbe7e, 260, 48],
      [-104.5, 5.1, 56, 0x9ce2ff, 150, 34],
      [-81, 6.2, -38, 0xffa862, 240, 46],
      [-84, 7.2, -4, 0xffc078, 150, 38],
      [-20, 5.2, -58, 0xffb066, 95, 34],
      [28, 5.2, -58, 0xffb066, 95, 34],
      [76, 5.2, -58, 0xffb066, 95, 34],
      [-20, 5.2, -32, 0xffb066, 95, 34],
      [28, 5.2, -32, 0xffb066, 95, 34],
      [76, 5.2, -32, 0xffb066, 95, 34],
      [106, 5.0, -69, 0xffb878, 150, 36],
      [-26, 6.2, 1, 0xffe2be, 260, 36],
      [-14, 6.2, 1, 0xffe2be, 260, 36],
    ];
    world.pointLights = [];
    for (const p of pts) {
      const pl = new THREE.PointLight(p[3], p[4], p[5], 2);
      pl.position.set(p[0], p[1], p[2]);
      scene.add(pl);
      world.pointLights.push(pl);
    }
    world.lights = { hemi, moon, warm, fill };
  }

  /* ---------------- 地面光斑合并 ---------------- */
  function buildPools(world) {
    const glowTex = U.radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0.32)');
    const groups = { warm: [], cool: [] };
    const q = new THREE.PlaneGeometry(1, 1);
    for (const p of world.pools) {
      const g = q.clone();
      g.scale(p.size, p.size, 1);
      g.applyMatrix4(U.mat4(p.x, 0.272, p.z, -Math.PI / 2, 0, 0));
      (p.warm > 0.5 ? groups.warm : groups.cool).push(g);
    }
    for (const key of ['warm', 'cool']) {
      if (!groups[key].length) continue;
      const mat = new THREE.MeshBasicMaterial({
        map: glowTex,
        color: key === 'warm' ? new THREE.Color(1.7, 0.86, 0.4) : new THREE.Color(0.55, 0.7, 0.9),
        transparent: true,
        opacity: key === 'warm' ? 0.34 : 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(U.merge(groups[key]), mat);
      mesh.renderOrder = 2;
      world.group.add(mesh);
      world.poolMats.push(mat);
    }
  }

  /* ---------------- 底座光晕 ---------------- */
  function buildBaseGlow(world) {
    const cz = L.slab.cz;
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: U.radialTexture('rgba(255,255,255,0.45)', 'rgba(255,255,255,0)'),
        color: new THREE.Color(0.2, 0.42, 0.6),
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      })
    );
    g.rotation.x = -Math.PI / 2;
    g.scale.set(620, 470, 1);
    g.position.set(0, -13.6, cz);
    g.renderOrder = 1;
    world.group.add(g);
    world.baseGlowMat = g.material;

  }

  /* ---------------- 入口 ---------------- */
  FL.buildWorld = function (scene) {
    const world = {
      feedPiles: [],
      barnShades: [],
      glbRoofMats: [],
      glbGlowMats: [],
      group: new THREE.Group(),
      flows: [],
      labels: [],
      pools: [],
      lampHeads: [],
      lampSprites: [],
      poolMats: [],
      baseGlowMat: null,
      pointLights: [],
    };
    scene.add(world.group);
    const M = makeMaterials();
    world.mats = M;
    const kit = new U.Kit();
    buildGround(kit, M);
    buildRoads(kit, M, world);
    buildFlows(kit, M, world);
    buildWear(kit, M, world);
    buildFences(kit, M);
    FL.buildBuildings(kit, M, world);
    buildProps(kit, M, world);
    kit.build(world.group);
    buildPools(world);
    buildLabels(world);
    buildBaseGlow(world);
    buildLights(scene, world);
    return world;
  };

  FL.spinWheel = null;
