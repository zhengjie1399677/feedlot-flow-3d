/* ============================================================
 *  vehicles.js — 车辆造型 / 路线运行 / 作业停顿
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = root.FL;
  const U = FL.U;
  const L = FL.LAYOUT;

  const ROAD_Y = 0.24;

  const labelCache = new Map();
  function labelSprite(text) {
    if (!text) return null;
    if (!labelCache.has(text)) {
      const tex = U.textTexture({
        w: 640, h: 136, text: text,
        size: 62, color: '#ffd9a4', bg: 'rgba(8,10,12,0.74)',
        border: 'rgba(255,176,96,0.5)', font: '"Microsoft YaHei","Bahnschrift",sans-serif',
      });
      labelCache.set(text, U.signMaterial(tex, 0.95, false));
    }
    return labelCache.get(text);
  }

  /* ============================================================
   *  造型
   * ============================================================ */
  function materials(P) {
    return {
      paint: U.std({ color: P.paint, roughness: 0.4, metalness: 0.45 }),
      accent: U.std({ color: P.accent, roughness: 0.5, metalness: 0.25, emissive: P.accent, emissiveIntensity: 0.18 }),
      dark: U.std({ color: 0x191d20, roughness: 0.74, metalness: 0.32 }),
      glass: U.std({ color: 0x0a1216, roughness: 0.12, metalness: 0.6 }),
      steel: U.std({ color: 0x99a3a8, roughness: 0.32, metalness: 0.88 }),
      tire: U.std({ color: 0x0d0f10, roughness: 0.96, metalness: 0.0 }),
      light: new THREE.MeshBasicMaterial({ color: 0xfff1cf, toneMapped: false }),
      red: new THREE.MeshBasicMaterial({ color: 0xff3a1e, toneMapped: false }),
    };
  }

  function part(kit, mat, geo, x, y, z, rx, ry, rz) {
    geo.applyMatrix4(U.mat4(x || 0, y || 0, z || 0, rx || 0, ry || 0, rz || 0));
    kit.add(geo, mat);
    return geo;
  }
  function rbox(kit, mat, w, h, d, r, x, y, z, rx, ry, rz) {
    return part(kit, mat, U.roundedBox(w, h, d, r), x, y, z, rx, ry, rz);
  }
  function box(kit, mat, w, h, d, x, y, z, rx, ry, rz) {
    return part(kit, mat, new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  }
  function tube(kit, mat, r1, r2, h, seg, x, y, z, rx, ry, rz) {
    return part(kit, mat, new THREE.CylinderGeometry(r1, r2, h, seg || 14), x, y, z, rx, ry, rz);
  }
  function wheel(kit, m, x, z, r, w) {
    const g = new THREE.CylinderGeometry(r, r, w, 16, 1);
    g.rotateZ(Math.PI / 2);
    g.applyMatrix4(U.mat4(x, r, z));
    kit.add(g, m.tire);
    const h = new THREE.CylinderGeometry(r * 0.44, r * 0.44, w + 0.03, 12, 1);
    h.rotateZ(Math.PI / 2);
    h.applyMatrix4(U.mat4(x, r, z));
    kit.add(h, m.steel);
  }

  function cab(kit, m, opts) {
    const c = Object.assign({ l: 2.6, z: 4.9, h: 1.85, y: 2.0, w: 2.46, paint: 'paint' }, opts || {});
    rbox(kit, m[c.paint], c.w, c.h, c.l, 0.16, 0, c.y, c.z);
    // 挡风玻璃
    box(kit, m.glass, c.w - 0.22, c.h * 0.52, 0.07, 0, c.y + 0.3, c.z + c.l / 2 + 0.01, -0.12, 0, 0);
    // 侧窗
    box(kit, m.glass, 0.05, c.h * 0.46, c.l * 0.46, c.w / 2 - 0.02, c.y + 0.28, c.z - 0.05);
    box(kit, m.glass, 0.05, c.h * 0.46, c.l * 0.46, -c.w / 2 + 0.02, c.y + 0.28, c.z - 0.05);
    // 前脸
    box(kit, m.dark, c.w - 0.16, c.h * 0.3, 0.1, 0, c.y - 0.42, c.z + c.l / 2 + 0.02);
    box(kit, m.dark, c.w + 0.06, 0.26, 0.26, 0, 1.02, c.z + c.l / 2 + 0.14);
    // 灯具
    box(kit, m.light, 0.46, 0.2, 0.1, 0.82, c.y - 0.3, c.z + c.l / 2 + 0.06);
    box(kit, m.light, 0.46, 0.2, 0.1, -0.82, c.y - 0.3, c.z + c.l / 2 + 0.06);
    box(kit, m.red, 0.28, 0.14, 0.08, 0.86, c.y - 0.05, c.z + c.l / 2 + 0.06);
    box(kit, m.red, 0.28, 0.14, 0.08, -0.86, c.y - 0.05, c.z + c.l / 2 + 0.06);
    // 后视镜
    for (const sx of [-1, 1]) {
      box(kit, m.dark, 0.05, 0.05, 0.34, sx * (c.w / 2 + 0.2), c.y + 0.42, c.z + c.l / 2 - 0.3);
      box(kit, m.dark, 0.1, 0.42, 0.2, sx * (c.w / 2 + 0.34), c.y + 0.28, c.z + c.l / 2 - 0.14);
    }
    // 顶导流罩
    rbox(kit, m[c.paint], c.w - 0.24, 0.5, 1.5, 0.12, 0, c.y + c.h / 2 + 0.2, c.z - 0.35, -0.06, 0, 0);
    // 排气管
    tube(kit, m.steel, 0.1, 0.1, 2.6, 8, c.w / 2 - 0.18, c.y + 1.1, c.z - c.l / 2 + 0.35);
    // 踏板
    box(kit, m.dark, 1.0, 0.1, 0.34, c.w / 2 - 0.1, 1.1, c.z);
  }

  function chassis(kit, m, len, cz) {
    box(kit, m.dark, 2.3, 0.3, len, 0, 0.98, cz || 0);
    // 油箱
    const t = new THREE.CylinderGeometry(0.34, 0.34, 1.5, 12);
    t.rotateZ(Math.PI / 2);
    t.applyMatrix4(U.mat4(0, 0.86, 1.7));
    kit.add(t, m.steel);
    // 尾部保险杠
    box(kit, m.dark, 2.5, 0.16, 0.18, 0, 0.72, -6.55);
  }

  /* 活牛运输车 */
  function buildStockTruck(P) {
    const kit = new U.Kit();
    const m = materials(P);
    const LEN = 10.0, TZ = -1.55;
    chassis(kit, m, 12.4, 0);
    cab(kit, m, { z: 4.85, l: 2.6 });
    // 车厢底板与下半墙
    box(kit, m.dark, 2.5, 0.16, LEN, 0, 1.16, TZ);
    box(kit, m.paint, 2.46, 1.15, LEN, 0, 1.82, TZ);
    box(kit, m.accent, 2.5, 0.12, LEN + 0.02, 0, 1.32, TZ);
    // 上半部栅栏
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        box(kit, m.steel, 0.09, 0.1, LEN - 0.2, sx * 1.235, 2.55 + i * 0.42, TZ);
      }
      for (let i = 0; i < 9; i++) {
        const z = TZ - LEN / 2 + 0.5 + i * ((LEN - 1.0) / 8);
        box(kit, m.steel, 0.07, 1.7, 0.1, sx * 1.235, 3.0, z);
      }
    }
    box(kit, m.paint, 2.52, 0.14, LEN, 0, 3.94, TZ);
    // 车顶通风口
    for (let i = 0; i < 3; i++) {
      box(kit, m.dark, 0.55, 0.12, 0.55, 0, 4.04, TZ - 3 + i * 3);
    }
    // 后门 + 尾灯
    box(kit, m.dark, 2.3, 1.8, 0.12, 0, 2.85, TZ - LEN / 2 - 0.04);
    box(kit, m.red, 0.22, 0.1, 0.08, 0.9, 1.42, TZ - LEN / 2 - 0.1);
    box(kit, m.red, 0.22, 0.1, 0.08, -0.9, 1.42, TZ - LEN / 2 - 0.1);
    // 轮
    wheel(kit, m, 1.18, 5.3, 0.56, 0.44);
    wheel(kit, m, -1.18, 5.3, 0.56, 0.44);
    wheel(kit, m, 1.18, -3.6, 0.56, 0.5);
    wheel(kit, m, -1.18, -3.6, 0.56, 0.5);
    wheel(kit, m, 1.18, -5.2, 0.56, 0.5);
    wheel(kit, m, -1.18, -5.2, 0.56, 0.5);
    return { kit: kit, m: m, len: 14.2, lightZ: 6.2, tailZ: -6.6, labelY: 6.0 };
  }

  /* 草料自卸车 */
  function buildForageTruck(P) {
    const kit = new U.Kit();
    const m = materials(P);
    const LEN = 9.2, TZ = -1.7;
    chassis(kit, m, 12.0, 0);
    cab(kit, m, { z: 4.9, l: 2.45, h: 1.8 });
    // 自卸斗
    box(kit, m.paint, 2.5, 0.28, LEN, 0, 1.3, TZ);
    for (const sx of [-1, 1]) box(kit, m.paint, 0.13, 1.35, LEN, sx * 1.19, 2.0, TZ);
    box(kit, m.paint, 2.4, 1.35, 0.13, 0, 2.0, TZ + LEN / 2 - 0.06);
    box(kit, m.dark, 2.4, 1.35, 0.13, 0, 2.0, TZ - LEN / 2 + 0.06);
    box(kit, m.accent, 2.52, 0.12, LEN + 0.02, 0, 1.28, TZ);
    // 草捆
    const hay = U.std({ color: 0xb89a55, roughness: 0.95, metalness: 0 });
    for (let i = 0; i < 5; i++) {
      rbox(kit, hay, 2.02, 0.62, 1.5, 0.2, 0, 2.28, TZ - 3.2 + i * 1.6);
    }
    for (let i = 0; i < 4; i++) {
      rbox(kit, hay, 2.0, 0.58, 1.45, 0.2, 0.05, 2.9, TZ - 2.4 + i * 1.6);
    }
    // 篷布卷
    tube(kit, m.tarp || U.std({ color: 0x2c3a33, roughness: 0.9 }), 0.26, 0.26, 2.2, 10, 0, 3.35, TZ + 3.9, 0, 0, Math.PI / 2);
    // 轮
    wheel(kit, m, 1.18, 5.25, 0.56, 0.44);
    wheel(kit, m, -1.18, 5.25, 0.56, 0.44);
    wheel(kit, m, 1.18, -3.4, 0.56, 0.5);
    wheel(kit, m, -1.18, -3.4, 0.56, 0.5);
    wheel(kit, m, 1.18, -4.9, 0.56, 0.5);
    wheel(kit, m, -1.18, -4.9, 0.56, 0.5);
    return { kit: kit, m: m, len: 13.8, lightZ: 6.2, tailZ: -6.3, labelY: 5.8 };
  }

  /* TMR 日粮车（拖拉机 + 卧式搅拌罐） */
  function buildTmrTruck(P) {
    const kit = new U.Kit();
    const m = materials(P);
    const mix = U.std({ color: 0xd9dcd4, roughness: 0.35, metalness: 0.55 });
    // 拖拉机底盘
    box(kit, m.dark, 1.5, 0.34, 8.6, 0, 1.0, 0);
    // 后车架（罐体支撑）
    box(kit, m.dark, 1.9, 0.3, 5.0, 0, 1.15, -2.4);
    // 拖拉机机体
    rbox(kit, m.paint, 2.05, 1.4, 1.9, 0.14, 0, 1.85, 4.95);
    box(kit, m.paint, 1.55, 0.9, 1.7, 0, 1.75, 6.55);
    rbox(kit, m.dark, 1.9, 0.46, 1.5, 0.1, 0, 3.05, 5.0);
    box(kit, m.glass, 1.75, 0.66, 0.07, 0, 2.42, 6.42, -0.1, 0, 0);
    box(kit, m.glass, 0.06, 0.62, 1.0, 1.03, 2.38, 5.05);
    box(kit, m.glass, 0.06, 0.62, 1.0, -1.03, 2.38, 5.05);
    box(kit, m.light, 0.4, 0.18, 0.1, 0.6, 1.6, 7.42);
    box(kit, m.light, 0.4, 0.18, 0.1, -0.6, 1.6, 7.42);
    box(kit, m.dark, 1.5, 0.3, 0.2, 0, 1.1, 7.42);
    // 排气管
    tube(kit, m.steel, 0.09, 0.09, 1.9, 8, 0.86, 3.0, 6.2);
    // 搅拌罐
    const drum = new THREE.CylinderGeometry(1.42, 1.42, 4.6, 22, 1);
    drum.rotateX(Math.PI / 2);
    drum.applyMatrix4(U.mat4(0, 2.95, -2.4));
    kit.add(drum, mix);
    const cone = new THREE.CylinderGeometry(0.9, 1.42, 1.3, 22, 1, true);
    cone.rotateX(Math.PI / 2);
    cone.applyMatrix4(U.mat4(0, 2.95, 0.6));
    kit.add(cone, mix);
    // 罐体加强箍
    for (let i = 0; i < 4; i++) {
      const ring = new THREE.CylinderGeometry(1.47, 1.47, 0.1, 22, 1, true);
      ring.rotateX(Math.PI / 2);
      ring.applyMatrix4(U.mat4(0, 2.95, -4.3 + i * 1.25));
      kit.add(ring, m.steel);
    }
    // 尾部出料口
    const rear = new THREE.CylinderGeometry(1.5, 1.5, 0.18, 22);
    rear.rotateX(Math.PI / 2);
    rear.applyMatrix4(U.mat4(0, 2.95, -4.75));
    kit.add(rear, m.steel);
    // 顶部螺旋轴管
    tube(kit, m.accent, 0.34, 0.34, 5.4, 12, 0, 4.5, -2.6, Math.PI / 2, 0, 0);
    tube(kit, m.steel, 0.4, 0.4, 0.5, 12, 0, 4.5, -5.2, Math.PI / 2, 0, 0);
    // 侧面投料输送带
    box(kit, m.accent, 3.1, 0.26, 0.5, 2.1, 2.55, -1.4, 0, 0, 0.16);
    box(kit, m.dark, 2.6, 0.1, 0.42, 2.1, 2.72, -1.4, 0, 0, 0.16);
    box(kit, m.dark, 0.5, 1.5, 0.3, 3.4, 1.55, -1.35);
    // 罐体标识
    box(kit, m.accent, 0.02, 0.35, 3.4, 1.43, 2.95, -2.4);
    // 梯子
    for (let i = 0; i < 4; i++) {
      box(kit, m.steel, 0.42, 0.05, 0.05, 0.1, 1.9 + i * 0.62, -5.15);
    }
    // 轮
    wheel(kit, m, 1.28, 6.1, 0.66, 0.5);
    wheel(kit, m, -1.28, 6.1, 0.66, 0.5);
    wheel(kit, m, 1.28, 3.1, 0.92, 0.62);
    wheel(kit, m, -1.28, 3.1, 0.92, 0.62);
    return { kit: kit, m: m, len: 13.0, lightZ: 7.5, tailZ: -5.0, labelY: 5.9 };
  }

  /* ============================================================
   *  路线站表
   *  —— 不再预生成"时间→位置"的表，而是按距离实时积分：
   *     进站前按 v²=2as 减速、出站后加速、前车占路则跟车等待。
   * ============================================================ */
  function buildTimeline(ways, path) {
    const marks = [];
    for (let i = 0; i < ways.length; i++) {
      const w = ways[i];
      marks.push({ i: i, s: path.distOf(i), stage: w.stage || null, stop: w.stop || 0, label: w.label || null });
    }
    marks.sort(function (a, b) { return a.s - b.s; });
    const stops = marks.filter(function (m) { return m.stop > 0; })
      .map(function (m) { return { s: m.s, stop: m.stop, label: m.label }; });
    return { marks: marks, stops: stops, length: path.length };
  }

  function stageAt(tl, s) {
    let stage = null;
    for (let i = 0; i < tl.marks.length; i++) {
      if (tl.marks[i].s <= s + 0.6) stage = tl.marks[i].stage;
      else break;
    }
    return stage;
  }

  /* ---------------- 车辆运动参数 ---------------- */
  const ACC = 2.3;      // 起步加速度 m/s²
  const DEC = 3.3;      // 制动减速度 m/s²
  const SCAN = 34;      // 前车探测距离
  const LANE = 3.3;     // 侧向容差：同向车道内才算"前车"
  const FOLLOW = 4.5;   // 跟车时留出的净空
  const TURN_LOOK = 8;  // 转向预判距离 m

  /* ============================================================
   *  Fleet
   * ============================================================ */
  FL.buildFleet = function (scene) {
    const specs = [
      { id: 'cattle', route: 'cattleTruck', build: buildStockTruck, speed: 10.4, phase: 26, color: 0xffc46b,
        P: { paint: 0xcdd6d6, accent: 0x2f7f8a } },
      { id: 'forage', route: 'forageTruck', build: buildForageTruck, speed: 9.6, phase: 9, color: 0x9de07a,
        P: { paint: 0xa8493a, accent: 0xd9b25e } },
      { id: 'tmr', route: 'tmrTruck', build: buildTmrTruck, speed: 7.8, phase: 46, color: 0xff9a52,
        P: { paint: 0x4a6b52, accent: 0xd4762d } },
      { id: 'out', route: 'outboundTruck', build: buildStockTruck, speed: 11.2, phase: 6, color: 0xff7f9e,
        P: { paint: 0xe4e1d7, accent: 0xa63c32 } },
    ];

    const fleet = { list: [], now: 0, update: null, seek: null, stageSet: function () { return new Set(); } };
    const tmpPos = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();
    const tmpTan2 = new THREE.Vector3();

    for (const spec of specs) {
      const ways = L.routes[spec.route];
      const path = new U.Path(ways, { tension: 0.3 });
      const tl = buildTimeline(ways, path);
      const built = spec.build(spec.P);
      const group = new THREE.Group();
      built.kit.build(group);
      group.traverse(function (o) {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });

      // 头灯 / 尾灯 / 作业光 / 标签
      const headGlow = U.sprite(0xffd9a8, 5.4, 0.5);
      headGlow.position.set(0.78, 1.55, built.lightZ + 0.15);
      group.add(headGlow);
      const headGlow2 = U.sprite(0xffd9a8, 5.4, 0.5);
      headGlow2.position.set(-0.78, 1.55, built.lightZ + 0.15);
      group.add(headGlow2);
      const tailGlow = U.sprite(0xff3a1e, 2.6, 0.5);
      tailGlow.position.set(0, 1.4, built.tailZ - 0.1);
      group.add(tailGlow);
      // 转向灯（左 +x 侧 / 右 -x 侧）
      const blinkerL = U.sprite(0xffb347, 3.4, 0.0);
      blinkerL.position.set(1.34, 1.5, built.lightZ - 0.5);
      group.add(blinkerL);
      const blinkerR = U.sprite(0xffb347, 3.4, 0.0);
      blinkerR.position.set(-1.34, 1.5, built.lightZ - 0.5);
      group.add(blinkerR);
      // 地面光斑（前照灯）
      const beamPool = U.groundGlow(0xffc98a, 26, 0.2);
      beamPool.position.set(0, 0.05, 9.5);
      group.add(beamPool);
      // 作业光斑
      const workGlow = U.groundGlow(spec.color, 15, 0.0);
      workGlow.position.set(0, 0.06, 0);
      group.add(workGlow);
      // 标签
      const label = new THREE.Sprite(U.signMaterial(null, 0, false));
      label.visible = false;
      label.position.set(0, built.labelY, 0);
      label.scale.set(7.6, 1.6, 1);
      group.add(label);

      group.position.set(0, ROAD_Y, 0);
      scene.add(group);

      const mats = [];
      group.traverse(function (o) {
        if (o.material && o.material.isMeshStandardMaterial) mats.push(o.material);
      });

      // 初始位置与朝向（后续由 stepSim 维护 x/z 与单位朝向 hx/hz）
      path.pointAt(0, tmpPos);
      path.tangentAt(0, tmpTan);
      const tl0 = Math.hypot(tmpTan.x, tmpTan.z) || 1;

      const veh = {
        id: spec.id,
        group: group,
        path: path,
        tl: tl,
        stops: tl.stops,
        phase: spec.phase,
        len: built.len,
        vmax: spec.speed,
        s: 0, v: 0, si: 0, dwellLeft: 0,
        x: tmpPos.x, z: tmpPos.z,
        hx: tmpTan.x / tl0, hz: tmpTan.z / tl0,
        vPrev: 0,
        mats: mats,
        headGlow: headGlow,
        headGlow2: headGlow2,
        tailGlow: tailGlow,
        blinkerL: blinkerL,
        blinkerR: blinkerR,
        beamPool: beamPool,
        workGlow: workGlow,
        label: label,
        labelText: null,
        stage: null,
        dwell: false,
        fade: 1,
        color: spec.color,
      };
      fleet.list.push(veh);
    }

    /* ---------------- 运动核心 ---------------- */
    function followSpeed(v) {
      if (v.solo) return v.vmax;
      let best = v.vmax;
      for (let i = 0; i < fleet.list.length; i++) {
        const o = fleet.list[i];
        if (o === v) continue;
        const dx = o.x - v.x, dz = o.z - v.z;
        const ahead = dx * v.hx + dz * v.hz;
        if (ahead <= 0 || ahead > SCAN) continue;
        const lat = Math.abs(dz * v.hx - dx * v.hz);
        if (lat > LANE) continue;
        const clear = ahead - (v.len + o.len) * 0.5 - FOLLOW;
        const allow = clear <= 0 ? 0 : Math.min(1, clear / 13) * v.vmax;
        if (allow < best) best = allow;
      }
      return best;
    }

    function advance(v, dt) {
      const len = v.path.length;
      if (!v.stops.length) {        // 兜底：没有停靠点的路线匀速绕行
        v.v = Math.min(v.vmax, v.v + ACC * dt);
        v.s = (v.s + v.v * dt) % len;
        return;
      }
      if (v.dwellLeft > 0) {
        v.dwellLeft -= dt;
        v.v = 0;
        if (v.dwellLeft <= 1e-6) {
          v.dwellLeft = 0;
          v.si = (v.si + 1) % v.stops.length;
        }
        return;
      }
      const st = v.stops[v.si];
      let dn = st.s - v.s;
      if (dn < 0.001) dn += len;
      const limit = followSpeed(v);
      if (dn <= 0.4 && limit > 0.4 && v.v < 1.4) {   // 到站：前方没车挡着才入位
        v.s = st.s;
        v.v = 0;
        v.dwellLeft = st.stop;
        return;
      }
      const vArr = Math.sqrt(2 * DEC * Math.max(0, dn - 0.4));
      const vd = Math.min(v.vmax, limit, vArr);
      const a = vd > v.v ? ACC : DEC;
      v.v += Math.max(-a * dt, Math.min(a * dt, vd - v.v));
      if (v.v < 0.02) v.v = 0;
      v.s += v.v * dt;
      if (v.s >= len) v.s -= len;
    }

    function stepSim(dt) {
      for (let i = 0; i < fleet.list.length; i++) advance(fleet.list[i], dt);
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        const px = v.x, pz = v.z;
        v.path.pointAt(v.s, tmpPos);
        v.x = tmpPos.x;
        v.z = tmpPos.z;
        const dx = v.x - px, dz = v.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) { v.hx = dx / d; v.hz = dz / d; }
      }
    }

    function resetVehicle(v) {
      v.s = 0; v.v = 0; v.si = 0; v.dwellLeft = 0; v.vPrev = 0;
      v.path.pointAt(0, tmpPos);
      v.path.tangentAt(0, tmpTan);
      const d = Math.hypot(tmpTan.x, tmpTan.z) || 1;
      v.x = tmpPos.x; v.z = tmpPos.z;
      v.hx = tmpTan.x / d; v.hz = tmpTan.z / d;
    }

    /* 快进到某一时刻（截图 / 首帧对齐用）
     * 1) 各车先单独预热 phase 秒，错开出场节奏（此阶段互不干扰）
     * 2) 之后全局同步推进，跟车/让行在这段里才生效 */
    fleet.seek = function (seconds) {
      const dt = 1 / 60;
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        resetVehicle(v);
        const warm = Math.max(0, v.phase);
        v.solo = true;
        for (let t = 0; t < warm; t += dt) advance(v, dt);
        v.solo = false;
        v.path.pointAt(v.s, tmpPos);
        v.x = tmpPos.x; v.z = tmpPos.z;
      }
      const run = Math.max(0, seconds);
      for (let t = 0; t < run; t += dt) stepSim(dt);
      fleet.now = seconds;
    };

    const X0 = -126, X1 = 126, Z0 = -98, Z1 = 94;
    function fadeAt(x, z) {
      const f = Math.min((x - X0) / 9, (X1 - x) / 9, (z - Z0) / 9, (Z1 - z) / 9, 1);
      return Math.max(0, Math.min(1, f));
    }

    fleet.update = function (dt) {
      if (dt > 0) {
        stepSim(Math.min(dt, 0.05));
        fleet.now += dt;
      }
      const time = fleet.now;
      const stages = new Set();
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        v.path.pointAt(v.s, tmpPos);
        v.path.tangentAt(v.s, tmpTan);
        v.group.position.set(tmpPos.x, ROAD_Y, tmpPos.z);
        v.group.rotation.y = Math.atan2(tmpTan.x, tmpTan.z);
        v.stage = stageAt(v.tl, v.s);
        v.dwell = v.dwellLeft > 0;
        if (v.stage) stages.add(v.stage);

        // 淡出（驶出地块边缘）
        const f = fadeAt(tmpPos.x, tmpPos.z);
        if (Math.abs(f - v.fade) > 0.001) {
          v.fade = f;
          const transparent = f < 0.999;
          for (let k = 0; k < v.mats.length; k++) {
            const m = v.mats[k];
            m.transparent = transparent;
            m.opacity = f;
            m.depthWrite = !transparent;
          }
          v.group.visible = f > 0.02;
        }

        // 作业光斑随停留脉动
        const pulse = 0.5 + 0.5 * Math.sin(time * 4.1 + v.phase);
        v.workGlow.material.opacity = v.dwell ? 0.22 + pulse * 0.2 : 0.0;

        // 标签
        if (v.dwell) {
          const st = v.stops[v.si];
          const txt = st ? st.label : null;
          if (txt && v.labelText !== txt) {
            v.labelText = txt;
            const sm = labelSprite(txt);
            if (sm) {
              sm.depthWrite = false;
              v.label.material = sm;
            }
            v.label.visible = true;
          }
          if (txt) {
            const sc = 0.95 + pulse * 0.05;
            v.label.scale.set(7.6 * sc, 1.6 * sc, 1);
          }
        } else if (v.label.visible) {
          v.label.visible = false;
          v.labelText = null;
        }

        // 前照灯
        const hf = 0.42 + 0.08 * Math.sin(time * 3.0 + v.phase);
        v.headGlow.material.opacity = hf * f;
        v.headGlow2.material.opacity = hf * f;
        v.beamPool.material.opacity = 0.18 * f;

        // 刹车灯：减速或停住时变亮
        const braking = v.v < v.vmax * 0.55;
        const tailBase = braking ? 1.5 : 0.4;
        v.tailGlow.material.opacity = tailBase * f;

        // 转向灯：看前方 8m 的航向变化
        let turn = 0;
        if (!v.dwell && v.v > 0.6) {
          const aheadS = (v.s + TURN_LOOK) % v.path.length;
          v.path.tangentAt(aheadS, tmpTan2);
          const cross = tmpTan.z * tmpTan2.x - tmpTan.x * tmpTan2.z;
          const dot = tmpTan.x * tmpTan2.x + tmpTan.z * tmpTan2.z;
          const ang = Math.atan2(cross, dot);
          if (Math.abs(ang) > 0.16) turn = ang > 0 ? 1 : -1;
        }
        const blink = (Math.sin(time * 11.5) > 0.15) ? 1 : 0;
        v.blinkerL.material.opacity = (turn === 1 ? 0.95 : 0) * blink * f;
        v.blinkerR.material.opacity = (turn === -1 ? 0.95 : 0) * blink * f;
      }
      fleet._stages = stages;
      return stages;
    };

    fleet.stageSet = function () { return fleet._stages || new Set(); };
    fleet.vehicles = fleet.list;
    return fleet;
  };

})(window);
