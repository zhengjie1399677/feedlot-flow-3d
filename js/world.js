/* ============================================================
 *  world.js — 场地、路网、围栏、灯杆、树木、标签、灯光
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = root.FL;
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
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / uvTile, uv.getY(i) / uvTile);
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

  /* 沿曲线撒短划线 */
  function dashLine(kit, mat, pts, w, dash, gap, y) {
    const curve = curveOf(pts);
    const len = curve.getLength();
    const p = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (let d = 3; d < len - 3; d += dash + gap) {
      curve.getPointAt(d / len, p);
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
    const M = {};
    M.soil = S({ color: 0x1b1d18, roughness: 1 });
    M.plinth = S({ color: 0x0d100e, roughness: 1 });
    M.grass = S({ map: T.grass, color: 0xb4c296, roughness: 1 });
    M.apron = S({ map: T.concrete, color: 0xa3a8aa, roughness: 0.92, metalness: 0.02 });
    M.apronEdge = S({ map: T.concreteDark, color: 0x6d7376, roughness: 0.95 });
    M.asphalt = S({ map: T.asphalt, color: 0x9fa8ad, roughness: 0.95, metalness: 0.02 });
    M.curb = S({ map: T.concreteDark, color: 0x8b9194, roughness: 0.95 });
    M.line = S({ color: 0xb8c2c4, roughness: 0.7 });
    M.yellow = S({ color: 0xc79b3f, roughness: 0.65, metalness: 0.15 });
    M.yard = S({ map: T.concreteDark, color: 0x7f8588, roughness: 0.95 });
    M.floor = S({ map: T.concrete, color: 0xa8a79e, roughness: 0.9 });
    M.wall = S({ map: T.concrete, color: 0xc2bcaa, roughness: 0.9 });
    M.wallCool = S({ map: T.concrete, color: 0x9aa4a6, roughness: 0.9 });
    M.wallDark = S({ map: T.corrugated, color: 0x899da4, roughness: 0.6, metalness: 0.3 });
    M.roof = S({ map: T.roof, color: 0x96604a, roughness: 0.6, metalness: 0.22 });
    M.roofSouth = S({ map: T.roof, color: 0x7f4f45, roughness: 0.62, metalness: 0.2 });
    M.skylight = S({ map: T.roof, color: 0xd3e2ea, roughness: 0.28, metalness: 0.18 });
    M.roofPlant = S({ map: T.roof, color: 0x9fb3bb, roughness: 0.5, metalness: 0.35 });
    M.timber = S({ color: 0x54402f, roughness: 0.85 });
    M.timberLight = S({ color: 0x8a6a4a, roughness: 0.85 });
    M.steel = S({ color: 0x38424a, roughness: 0.42, metalness: 0.75 });
    M.steelLight = S({ color: 0xa7b5bd, roughness: 0.3, metalness: 0.85 });
    M.galv = S({ map: T.corrugated, color: 0xc4ced2, roughness: 0.4, metalness: 0.6 });
    M.glass = S({ color: 0x0c161d, roughness: 0.07, metalness: 0.9 });
    M.concreteTrough = S({ color: 0x8f918a, roughness: 0.95 });
    M.feed = S({ color: 0x6c5029, roughness: 1 });
    M.feedPile = S({ map: T.grass, color: 0xb7a463, roughness: 1 });
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
    flatRound(kit, M.grass, 252, 192, 0, cz, 0.04, 6, 10);
    // 场地
    flatRound(kit, M.apronEdge, 232, 168, 0, -4, 0.16, 13, 12);
    flatRound(kit, M.apron, 228, 164, 0, -4, 0.2, 12, 12);
    // 场内水泥分区（配料场院）
    flatRound(kit, M.yard, 56, 74, -92, -4, 0.215, 5, 9);
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
      kit.add(ribbonGeo(r.pts, r.width + 1.7, 0.135, { uv: 10 }), M.curb);
      kit.add(ribbonGeo(r.pts, r.width, 0.225, { uv: 12 }), M.asphalt);
      // 边线
      const eo = r.width / 2 - 0.55;
      kit.add(ribbonGeo(r.pts, 0.16, 0.238, { offset: eo, uv: 6 }), M.line);
      kit.add(ribbonGeo(r.pts, 0.16, 0.238, { offset: -eo, uv: 6 }), M.line);
    }
    for (const j of L.junctions) {
      flatRound(kit, M.asphalt, j.w, j.d, j.x, j.z, 0.222, Math.min(j.w, j.d) * 0.3, 12);
    }
    // 中线虚线
    dashLine(kit, M.yellow, L.roads[0].pts, 0.18, 2.4, 5.5, 0.24);
    dashLine(kit, M.yellow, L.roads[2].pts, 0.18, 2.4, 5.5, 0.24);
    dashLine(kit, M.yellow, L.roads[3].pts, 0.18, 2.4, 5.5, 0.24);

    // 地磅前导向
    const wb = L.slots.weighbridge;
    for (let i = 0; i < 7; i++) {
      U.box(kit, M.yellow, 3.4, 0.02, 0.34, wb.x - 15, 0.242, wb.z - 6 + i * 2, 0, 0, 0);
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

  function buildFences(kit, M) {
    const h = 1.9;
    // 园区周界（留出入口与出场通道）
    fenceLine(kit, M.steel, [[-124, -92], [-124, 46]], h, 2);
    fenceLine(kit, M.steel, [[-124, 66], [-124, 90]], h, 2);
    fenceLine(kit, M.steel, [[-124, 90], [104, 90]], h, 2);
    fenceLine(kit, M.steel, [[124, 90], [124, -92]], h, 2);
    fenceLine(kit, M.steel, [[-124, -92], [104, -92]], h, 2);
    fenceLine(kit, M.steel, [[124, -92], [124, -92.001]], h, 2);
    // 大门段围栏（从门柱向两侧）
    fenceLine(kit, M.steel, [[-124, 46], [-109, 46]], h, 2);
    fenceLine(kit, M.steel, [[-109, 66], [-124, 66]], h, 2);
    // 装车围栏
    fenceLine(kit, M.steel, [[97, -62], [97, -76]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[108, -76], [108, -62]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[97, -62], [104, -62]], 1.65, 3, 2.0);
    fenceLine(kit, M.steel, [[97, -76], [104, -76]], 1.65, 3, 2.0);
    // 赶牛通道
    fenceLine(kit, M.steel, [[96, -65], [101, -65]], 1.6, 3, 2.0);
    fenceLine(kit, M.steel, [[96, -68], [101, -68]], 1.6, 3, 2.0);
    // 青贮窖围栏
    fenceLine(kit, M.steel, [[-110, 30.6], [-84, 30.6]], 1.2, 2, 3.2);
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

    // 灯杆
    const poles = [
      [-30, -34, 9.6, Math.PI / 2, true],
      [30, -34, 9.6, Math.PI / 2, true],
      [86, -34, 9.6, Math.PI / 2, true],
      [-100, 44, 9.2, -Math.PI / 2, true],
      [-66, 58, 8.8, Math.PI, false],
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

    // 树
    const trees = [
      [-118, -86, 1.35, 'broad'], [-120, -62, 1.1, 'conifer'], [-121, -18, 1.2, 'broad'],
      [-120, 82, 1.25, 'broad'], [-104, 88, 1.0, 'conifer'], [-58, 91, 1.15, 'broad'],
      [2, 92, 1.05, 'conifer'], [40, 90, 1.2, 'broad'], [96, 90, 1.1, 'conifer'],
      [121, 60, 1.15, 'broad'], [122, 12, 1.1, 'conifer'], [121, -34, 1.2, 'broad'],
      [119, -88, 1.2, 'conifer'], [84, -96, 1.1, 'broad'], [30, -96, 1.0, 'conifer'],
      [-40, -96, 1.15, 'broad'], [-96, -96, 1.1, 'conifer'], [116, -96, 0.9, 'broad'],
      [116, 78, 1.0, 'broad'], [-114, 74, 0.95, 'broad'],
    ];
    for (const t of trees) tree(kit, M, t[0], t[1], t[2], t[3] === 'conifer' ? 'conifer' : 'broad', rand);

    // 料场杂物：油桶 / 托盘
    for (let i = 0; i < 6; i++) {
      U.cyl(kit, i % 2 ? M.red : M.blue, 0.42, 0.42, 1.1, 12, -110 + (i % 3) * 1.1, 0.72, 5 + Math.floor(i / 3) * 1.1);
    }
    U.box(kit, M.timberLight, 2.4, 0.35, 2.0, -114, 0.4, 16, 0, 0.2, 0);
    U.box(kit, M.timberLight, 2.4, 0.35, 2.0, -114, 0.75, 16.2, 0, -0.12, 0);

    // 青贮窖西侧草捆
    for (let i = 0; i < 4; i++) {
      const r = 0.9;
      const g = new THREE.CylinderGeometry(r, r, 1.5, 12);
      kit.add(g, M.tarp, U.mat4(-116, 0.98, 10 + i * 2.1, 0, 0, Math.PI / 2));
    }

    // 综合楼前旗杆
    U.cyl(kit, M.steelLight, 0.06, 0.08, 11, 6, -96, 5.6, 82);
    U.box(kit, M.red, 2.2, 1.4, 0.04, -97.2, 9.6, 82, 0, 0, 0);

    // 地磅两侧防撞柱
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        U.cyl(kit, M.yellow, 0.16, 0.16, 1.0, 8, -84 + sx * 11, 0.6, 56 + sz * 5.2);
      }
    }

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
    gate: [-108, 16.2, 61],
    weigh: [-78, 12.4, 63],
    sort: [-49, 15.6, -60],
    tmr: [-98, 21.5, -16],
    feed: [12, 16.4, -48],
    load: [107, 13.4, -62],
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
      sp.scale.set(15.5, 4.6, 1);
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
    const s = 235;
    moon.shadow.camera.left = -s;
    moon.shadow.camera.right = s;
    moon.shadow.camera.top = s;
    moon.shadow.camera.bottom = -s;
    moon.shadow.camera.near = 80;
    moon.shadow.camera.far = 900;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.bias = -0.0007;
    moon.shadow.normalBias = 0.75;
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
      [-84, 8.0, 56, 0xffb878, 420, 62],
      [-88, 5.6, -6, 0xffa25e, 200, 42],
      [-20, 5.2, -58, 0xffb066, 95, 34],
      [28, 5.2, -58, 0xffb066, 95, 34],
      [76, 5.2, -58, 0xffb066, 95, 34],
      [-20, 5.2, -32, 0xffb066, 95, 34],
      [28, 5.2, -32, 0xffb066, 95, 34],
      [76, 5.2, -32, 0xffb066, 95, 34],
      [106, 5.0, -69, 0xffb878, 150, 36],
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
})(window);
