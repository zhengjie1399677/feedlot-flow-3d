import * as THREE from 'three';
import { FL } from './fl.js';

/* ============================================================
 *  walk.js — 第一人称步行漫游 / 3D 体积碰撞 / 多层楼梯 / 可交互开关门
 *  - 支持走进「草牧交易大厅」（含自动感应玻璃大门 + 上二层观景连廊）
 *  - 支持按 F 打开「综合办公楼」正门/北门、宿舍门禁门及 101-103 / 201-203 宿舍房门，
 *    并沿中庭楼梯走上二楼参观智慧中控室与二层宿舍
 * ============================================================ */

const U = FL.U;
const L = FL.LAYOUT;

FL.createWalkSystem = function (scene, world) {
  const colliders = []; // { x0, x1, z0, z1, y0, y1, doorId? }
  const ramps = [];     // { x0, x1, z0, z1, axis:'x'|'z', v0, v1, y0, y1, minY, maxY }
  const floors = [];    // { x0, x1, z0, z1, y, minY, maxY }
  const doors = [];     // interactive doors

  const doorGroup = new THREE.Group();
  doorGroup.name = 'interactiveDoors';
  world.group.add(doorGroup);

  function addBox(x0, x1, z0, z1, y0, y1, doorId) {
    colliders.push({
      x0: Math.min(x0, x1),
      x1: Math.max(x0, x1),
      z0: Math.min(z0, z1),
      z1: Math.max(z0, z1),
      y0: y0 == null ? 0 : y0,
      y1: y1 == null ? 10 : y1,
      doorId: doorId || null,
    });
  }

  function addWallX(x0, x1, z, thick, y0, y1, gaps) {
    const ht = thick * 0.5;
    if (!gaps || !gaps.length) {
      addBox(x0, x1, z - ht, z + ht, y0, y1);
      return;
    }
    const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cur = x0;
    for (const [g0, g1] of gs) {
      if (g0 > cur + 0.02) addBox(cur, g0, z - ht, z + ht, y0, y1);
      cur = Math.max(cur, g1);
    }
    if (x1 > cur + 0.02) addBox(cur, x1, z - ht, z + ht, y0, y1);
  }

  function addWallZ(x, z0, z1, thick, y0, y1, gaps) {
    const ht = thick * 0.5;
    if (!gaps || !gaps.length) {
      addBox(x - ht, x + ht, z0, z1, y0, y1);
      return;
    }
    const gs = gaps.slice().sort((a, b) => a[0] - b[0]);
    let cur = z0;
    for (const [g0, g1] of gs) {
      if (g0 > cur + 0.02) addBox(x - ht, x + ht, cur, g0, y0, y1);
      cur = Math.max(cur, g1);
    }
    if (z1 > cur + 0.02) addBox(x - ht, x + ht, cur, z1, y0, y1);
  }

  /* ---------------- 门体材质 ---------------- */
  const matGlassDoor = new THREE.MeshStandardMaterial({
    color: 0x7398ad, roughness: 0.12, metalness: 0.25, transparent: true, opacity: 0.42,
    depthWrite: false, side: THREE.DoubleSide,
  });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x2a333c, roughness: 0.38, metalness: 0.68 });
  const matHandle = new THREE.MeshStandardMaterial({ color: 0xc8d2da, roughness: 0.24, metalness: 0.85 });
  const matOakDoor = new THREE.MeshStandardMaterial({ color: 0xab8256, roughness: 0.55, metalness: 0.04 });
  const matWoodTrim = new THREE.MeshStandardMaterial({ color: 0x7e5a38, roughness: 0.62 });

  /* ---------------- 创建滑动双开玻璃门 ---------------- */
  function createSlidingGlassDoor(cfg) {
    // cfg: { id, label, x, y, z, width, height, axis:'x'|'z', autoOpen }
    const g = new THREE.Group();
    g.position.set(cfg.x, cfg.y, cfg.z);
    if (cfg.axis === 'z') g.rotation.y = Math.PI / 2;
    doorGroup.add(g);

    const leafW = cfg.width * 0.5;
    const h = cfg.height;
    const leaves = [];

    for (const side of [-1, 1]) {
      const leaf = new THREE.Group();
      const baseX = side * leafW * 0.5;
      leaf.position.x = baseX;
      // Glass pane
      const pane = new THREE.Mesh(new THREE.BoxGeometry(leafW - 0.10, h - 0.12, 0.05), matGlassDoor);
      pane.position.y = h * 0.5;
      leaf.add(pane);
      // Slim perimeter frame
      const topBar = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.08, 0.075), matFrame);
      topBar.position.y = h - 0.04;
      const botBar = new THREE.Mesh(new THREE.BoxGeometry(leafW, 0.12, 0.075), matFrame);
      botBar.position.y = 0.06;
      const sideOuter = new THREE.Mesh(new THREE.BoxGeometry(0.07, h, 0.075), matFrame);
      sideOuter.position.set(side * (leafW * 0.5 - 0.035), h * 0.5, 0);
      const sideInner = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, 0.075), matFrame);
      sideInner.position.set(-side * (leafW * 0.5 - 0.03), h * 0.5, 0);
      // Silver push handle
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.14), matHandle);
      handle.position.set(-side * (leafW * 0.5 - 0.16), 1.15, 0);
      leaf.add(topBar, botBar, sideOuter, sideInner, handle);
      g.add(leaf);
      leaves.push({ node: leaf, baseX: baseX, dir: side });
    }

    // Dynamic collider while door is closed
    const halfW = cfg.width * 0.5;
    if (cfg.axis === 'z') {
      addBox(cfg.x - 0.16, cfg.x + 0.16, cfg.z - halfW, cfg.z + halfW, cfg.y, cfg.y + h, cfg.id);
    } else {
      addBox(cfg.x - halfW, cfg.x + halfW, cfg.z - 0.16, cfg.z + 0.16, cfg.y, cfg.y + h, cfg.id);
    }

    const slideDist = leafW * 0.88;
    const door = {
      id: cfg.id,
      label: cfg.label,
      x: cfg.x,
      y: cfg.y,
      z: cfg.z,
      isOpen: false,
      openFrac: 0,
      autoOpen: !!cfg.autoOpen,
      toggle: function () { this.isOpen = !this.isOpen; },
      update: function (dt) {
        const target = this.isOpen ? 1 : 0;
        this.openFrac += (target - this.openFrac) * Math.min(1, dt * 6.5);
        for (const lf of leaves) {
          lf.node.position.x = lf.baseX + lf.dir * slideDist * this.openFrac;
        }
      },
    };
    doors.push(door);
    return door;
  }

  /* ---------------- 创建合页平开木门（宿舍房门） ---------------- */
  function createHingedWoodDoor(cfg) {
    // cfg: { id, label, x, y, z, width, height, swingDir: 1|-1, roomNo }
    const pivot = new THREE.Group();
    // Hinge on the West (-X) jamb so door swings smoothly inward (+Z into bedroom!)
    pivot.position.set(cfg.x - cfg.width * 0.5, cfg.y, cfg.z);
    doorGroup.add(pivot);

    const w = cfg.width - 0.06;
    const h = cfg.height;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), matOakDoor);
    panel.position.set(w * 0.5 + 0.03, h * 0.5, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    pivot.add(panel);

    // Subtle decorative wood panel molding
    const inset = new THREE.Mesh(new THREE.BoxGeometry(w - 0.24, h - 0.36, 0.075), matWoodTrim);
    inset.position.set(w * 0.5 + 0.03, h * 0.5, 0);
    pivot.add(inset);

    // Door lever handle (both sides)
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.16), matHandle);
    knob.position.set(w - 0.10, 1.02, 0);
    pivot.add(knob);

    // Door number plaque facing corridor (-Z side)
    if (cfg.roomNo) {
      const tex = U.textTexture({
        w: 256, h: 128, text: cfg.roomNo, sub: '员工宿舍',
        size: 62, subSize: 22, color: '#eef4f8', subColor: 'rgba(180,215,225,0.85)',
        bg: 'rgba(24,32,40,0.94)', border: 'rgba(110,195,180,0.55)', borderWidth: 4,
      });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), U.signMaterial(tex, 1, false, false));
      pl.position.set(w * 0.5 + 0.03, 1.72, -0.045);
      pl.rotation.y = Math.PI;
      pivot.add(pl);
    }

    const halfW = cfg.width * 0.5;
    addBox(cfg.x - halfW, cfg.x + halfW, cfg.z - 0.16, cfg.z + 0.16, cfg.y, cfg.y + h, cfg.id);

    const maxAng = (cfg.swingDir || 1) * (Math.PI * 0.54);
    const door = {
      id: cfg.id,
      label: cfg.label,
      x: cfg.x,
      y: cfg.y,
      z: cfg.z,
      isOpen: false,
      openFrac: 0,
      autoOpen: false,
      toggle: function () { this.isOpen = !this.isOpen; },
      update: function (dt) {
        const target = this.isOpen ? 1 : 0;
        this.openFrac += (target - this.openFrac) * Math.min(1, dt * 6.5);
        pivot.rotation.y = maxAng * this.openFrac;
      },
    };
    doors.push(door);
    return door;
  }

  /* ============================================================
   *  1. 草牧交易大厅（cx=-25, cz=6, W=44, D=26）— 门体、楼层、楼梯与碰撞
   *     World X = -25 + bx, World Z = 6 - by
   * ============================================================ */
  const H = L.market.hall;
  const hx = H.cx, hz = H.cz; // -25, 6

  // 自动+手动双控入口玻璃大门（南侧门斗入口 wz = 6 + 16.08 = 22.08）
  createSlidingGlassDoor({
    id: 'hall_main',
    label: '草牧交易大厅大门',
    x: hx,
    y: 0.84,
    z: hz + 16.08,
    width: 5.5,
    height: 3.45,
    axis: 'x',
    autoOpen: true,
  });

  // 交易大厅可行走楼层与台阶坡道
  ramps.push({ x0: hx - 9.8, x1: hx + 9.8, z0: hz + 17.4, z1: hz + 20.0, axis: 'z', v0: hz + 20.0, v1: hz + 17.4, y0: 0.26, y1: 0.84, minY: 0, maxY: 2.2 });
  floors.push({ x0: hx - 23.2, x1: hx + 23.2, z0: hz + 12.8, z1: hz + 17.5, y: 0.84, minY: 0, maxY: 2.2 });
  floors.push({ x0: hx - 22.0, x1: hx + 22.0, z0: hz - 13.0, z1: hz + 13.0, y: 0.94, minY: 0, maxY: 3.5 });
  // 室内东西双侧悬浮楼梯（直通二层观景连廊 y = 5.58）
  ramps.push({ x0: hx - 20.8, x1: hx - 18.4, z0: hz + 4.2, z1: hz + 11.8, axis: 'z', v0: hz + 11.8, v1: hz + 4.2, y0: 0.94, y1: 5.58, minY: 0.4, maxY: 6.4 });
  ramps.push({ x0: hx + 18.4, x1: hx + 20.8, z0: hz + 4.2, z1: hz + 11.8, axis: 'z', v0: hz + 11.8, v1: hz + 4.2, y0: 0.94, y1: 5.58, minY: 0.4, maxY: 6.4 });
  // 二层东西夹层与南侧玻璃天桥
  floors.push({ x0: hx - 21.8, x1: hx - 13.5, z0: hz - 12.0, z1: hz + 11.4, y: 5.58, minY: 3.8, maxY: 8.5 });
  floors.push({ x0: hx + 13.5, x1: hx + 21.8, z0: hz - 12.0, z1: hz + 11.4, y: 5.58, minY: 3.8, maxY: 8.5 });
  floors.push({ x0: hx - 13.6, x1: hx + 13.6, z0: hz + 9.4, z1: hz + 12.2, y: 5.58, minY: 3.8, maxY: 8.5 });

  // 交易大厅外墙 + 门斗 + 内部实体家具/二层护栏碰撞
  addWallX(hx - 22.2, hx + 22.2, hz - 12.75, 0.7, 0.5, 10.2); // North back wall
  addWallZ(hx - 21.85, hz - 13.0, hz + 13.0, 0.5, 0.5, 10.2); // West wall
  addWallZ(hx + 21.85, hz - 13.0, hz + 13.0, 0.5, 0.5, 10.2); // East wall
  addWallX(hx - 22.0, hx + 22.0, hz + 12.88, 0.45, 0.5, 10.2, [[hx - 5.0, hx + 5.0]]); // South glass wall (10m vestibule opening)
  addWallZ(hx - 5.0, hz + 13.0, hz + 16.2, 0.46, 0.5, 4.6); // Vestibule West pier
  addWallZ(hx + 5.0, hz + 13.0, hz + 16.2, 0.46, 0.5, 4.6); // Vestibule East pier
  addWallX(hx - 5.0, hx + 5.0, hz + 16.08, 0.28, 0.5, 4.6, [[hx - 2.75, hx + 2.75]]); // Vestibule front sidelights
  // 1F major interior furniture colliders
  addBox(hx - 3.3, hx + 3.3, hz + 7.9, hz + 9.3, 0.9, 2.2);   // Reception desk
  addBox(hx - 13.0, hx + 13.0, hz - 8.2, hz - 6.6, 0.9, 2.4); // 8-window settlement counter
  addBox(hx - 4.3, hx + 4.3, hz - 4.6, hz - 1.8, 0.9, 2.2);   // Auctioneer stage
  addBox(hx - 15.5, hx - 13.7, hz - 6.8, hz + 6.2, 0.9, 2.8); // West forage vitrines row
  addBox(hx - 20.2, hx - 18.6, hz - 6.2, hz + 4.2, 0.9, 2.4); // West lab bench
  // 2F glass balustrades so player cannot fall off mezzanine
  addWallZ(hx - 13.5, hz - 11.4, hz + 9.4, 0.25, 5.4, 7.2);
  addWallZ(hx + 13.5, hz - 11.4, hz + 9.4, 0.25, 5.4, 7.2);
  addWallX(hx - 13.5, hx + 13.5, hz + 9.4, 0.25, 5.4, 7.2);

  /* ============================================================
   *  2. 综合办公楼 + 员工宿舍（cx=12, cz=72, rot=Math.PI）
   *     World X = 12 - bx, World Z = 72 + by
   * ============================================================ */
  const O = L.market.office;
  const ox = O.cx, oz = O.cz; // 12, 72
  const owx = (bx) => ox - bx;
  const owz = (by) => oz + by;

  // 10 扇可交互门（正门/北门 + 1F/2F 宿舍走廊门禁 + 101-103 / 201-203 宿舍木门）
  createSlidingGlassDoor({
    id: 'office_south',
    label: '综合办公楼正门',
    x: owx(0), y: 0.62, z: owz(7.36), width: 3.16, height: 2.78, axis: 'x', autoOpen: false,
  });
  createSlidingGlassDoor({
    id: 'office_north',
    label: '综合办公楼北门',
    x: owx(0), y: 0.62, z: owz(-7.36), width: 2.76, height: 2.78, axis: 'x', autoOpen: false,
  });
  createSlidingGlassDoor({
    id: 'dorm_hall_1f',
    label: '一楼员工宿舍区门',
    x: owx(-3.6), y: 0.62, z: owz(-1.5), width: 1.96, height: 2.52, axis: 'z', autoOpen: false,
  });
  createSlidingGlassDoor({
    id: 'dorm_hall_2f',
    label: '二楼员工宿舍区门',
    x: owx(-3.6), y: 4.62, z: owz(-1.5), width: 1.96, height: 2.52, axis: 'z', autoOpen: false,
  });

  // 1F & 2F 6 间员工宿舍房门（木门向南内开进房间）
  for (const [flrIdx, fy, prefix] of [[1, 0.62, '1'], [2, 4.62, '2']]) {
    for (const [roomIdx, bxMid] of [[1, -6.8], [2, -12.8], [3, -18.8]]) {
      const no = prefix + '0' + roomIdx;
      createHingedWoodDoor({
        id: 'dorm_' + no,
        label: no + ' 员工宿舍门',
        roomNo: no,
        x: owx(bxMid),
        y: fy,
        z: owz(-0.40),
        width: 1.16,
        height: 2.30,
        swingDir: 1,
      });
    }
  }

  // 办公楼外部台阶坡道 + 1F/2F 楼面 + 中庭直跑楼梯
  ramps.push({ x0: owx(4.4), x1: owx(-4.4), z0: owz(7.4), z1: owz(9.6), axis: 'z', v0: owz(9.6), v1: owz(7.4), y0: 0.26, y1: 0.62, minY: 0, maxY: 2.0 });
  ramps.push({ x0: owx(4.4), x1: owx(-4.4), z0: owz(-9.6), z1: owz(-7.4), axis: 'z', v0: owz(-9.6), v1: owz(-7.4), y0: 0.26, y1: 0.62, minY: 0, maxY: 2.0 });
  floors.push({ x0: owx(22.0), x1: owx(-22.0), z0: owz(-7.5), z1: owz(7.5), y: 0.62, minY: 0, maxY: 3.0 });
  // 中庭直跑楼梯（bx ∈ [1.2, 2.8] -> wx ∈ [9.2, 10.8], by: +2.8 -> -5.0 => wz: 74.8 -> 67.0）
  ramps.push({ x0: owx(2.85), x1: owx(1.15), z0: owz(-5.1), z1: owz(2.9), axis: 'z', v0: owz(2.9), v1: owz(-5.1), y0: 0.62, y1: 4.62, minY: 0.2, maxY: 5.8 });
  // 2F 办公区、2F 宿舍区、2F 中庭北连廊与东走廊桥
  floors.push({ x0: owx(22.0), x1: owx(3.5), z0: owz(-7.4), z1: owz(7.4), y: 4.62, minY: 3.2, maxY: 7.5 });
  floors.push({ x0: owx(-3.5), x1: owx(-22.0), z0: owz(-7.4), z1: owz(7.4), y: 4.62, minY: 3.2, maxY: 7.5 });
  floors.push({ x0: owx(3.6), x1: owx(-3.6), z0: owz(-7.4), z1: owz(-4.95), y: 4.62, minY: 3.2, maxY: 7.5 });
  floors.push({ x0: owx(-1.6), x1: owx(-3.6), z0: owz(-5.1), z1: owz(-0.2), y: 4.62, minY: 3.2, maxY: 7.5 });

  // 办公楼外墙碰撞（严格预留南大门与北大门门洞）
  addWallX(owx(22.0), owx(-22.0), owz(7.36), 0.36, 0.5, 8.6, [[owx(1.6), owx(-1.6)]]);   // South facade (door gap wx ∈ [10.4, 13.6])
  addWallX(owx(22.0), owx(-22.0), owz(-7.36), 0.36, 0.5, 8.6, [[owx(1.4), owx(-1.4)]]);  // North facade (door gap wx ∈ [10.6, 13.4])
  addWallZ(owx(21.86), owz(-7.5), owz(7.5), 0.36, 0.5, 8.6);                              // West end wall
  addWallZ(owx(-21.86), owz(-7.5), owz(7.5), 0.36, 0.5, 8.6);                             // East end wall
  // 宿舍南侧落地窗/阳台墙（by = +5.25 -> wz = 77.25，防止穿出阳台外）
  addWallX(owx(-3.6), owx(-22.0), owz(5.25), 0.28, 0.5, 8.6);

  // 办公楼内墙碰撞（1F & 2F，严格与真实门洞一一对应）
  // 中庭 <-> 西侧办公区隔墙 (bx = +3.6 -> wx = 8.4)
  addWallZ(owx(3.6), owz(-7.3), owz(7.3), 0.26, 0.5, 4.3, [[owz(-1.2), owz(1.2)]]);
  addWallZ(owx(3.6), owz(-7.3), owz(7.3), 0.26, 4.5, 8.5, [[owz(-7.0), owz(-5.2)]]);
  // 中庭 <-> 东侧宿舍区隔墙 (bx = -3.6 -> wx = 15.6)
  addWallZ(owx(-3.6), owz(-7.3), owz(5.3), 0.26, 0.5, 4.3, [[owz(-2.5), owz(-0.5)]]);
  addWallZ(owx(-3.6), owz(-7.3), owz(5.3), 0.26, 4.5, 8.5, [[owz(-2.5), owz(-0.5)]]);
  // 西侧办公区内部会议室/总经理室隔墙 (bx = +14.4 -> wx = -2.4)
  addWallZ(owx(14.4), owz(-7.3), owz(7.3), 0.22, 0.5, 8.5, [[owz(-1.1), owz(1.1)]]);
  // 宿舍走廊南墙（含 101-103 / 201-203 真实房门缺口）与北墙 + 宿舍间分户墙
  for (const [y0, y1] of [[0.5, 4.3], [4.5, 8.5]]) {
    addWallX(owx(-3.6), owx(-21.8), owz(-0.40), 0.24, y0, y1, [
      [owx(-6.2), owx(-7.4)],
      [owx(-12.2), owx(-13.4)],
      [owx(-18.2), owx(-19.4)],
    ]);
    addWallX(owx(-3.6), owx(-21.8), owz(-2.60), 0.24, y0, y1, [
      [owx(-6.5), owx(-10.5)],
      [owx(-14.5), owx(-17.5)],
    ]);
    addWallZ(owx(-9.7), owz(-0.40), owz(5.25), 0.24, y0, y1);
    addWallZ(owx(-15.7), owz(-0.40), owz(5.25), 0.24, y0, y1);
  }
  // 二层中庭玻璃护栏（防止从二楼掉进一楼大厅）
  addWallX(owx(1.2), owx(-1.6), owz(-5.05), 0.22, 4.5, 6.2);
  addWallZ(owx(-1.65), owz(-5.05), owz(-0.2), 0.22, 4.5, 6.2);
  addWallX(owx(-1.6), owx(-3.6), owz(-0.25), 0.22, 4.5, 6.2);
  // 办公楼室内主要家具碰撞（床铺、会议桌、办公桌岛）
  for (const [y0, y1] of [[0.5, 2.2], [4.5, 6.2]]) {
    for (const rbx of [-6.7, -12.7, -18.7]) {
      addBox(owx(rbx - 0.55), owx(rbx - 2.15), owz(1.45), owz(3.65), y0, y1); // Bed
      addBox(owx(rbx + 2.35), owx(rbx + 1.55), owz(0.0), owz(3.75), y0, y1);  // Wardrobe + desk
    }
  }
  addBox(owx(12.6), owx(5.8), owz(-5.3), owz(-3.5), 0.5, 2.0); // 1F North desk cluster
  addBox(owx(12.6), owx(5.8), owz(3.5), owz(5.3), 0.5, 2.0);   // 1F South desk cluster
  addBox(owx(19.2), owx(16.8), owz(-3.2), owz(3.2), 0.5, 2.0); // 1F Conference table

  /* ============================================================
   *  3. 园区其他建筑与围墙外部体积碰撞（防止穿模）
   * ============================================================ */
  // 6 栋育肥牛舍
  for (const b of L.barns) {
    addBox(b.cx - b.len * 0.5, b.cx + b.len * 0.5, b.cz - b.dep * 0.5, b.cz + b.dep * 0.5, 0, 9.5);
  }
  // 草料交易库（北、东、西三面围护墙实体碰撞，南侧开放可走入棚内查看草捆与叉车！）
  const F = L.market.forageYard;
  if (F) {
    const fhw = F.shedW * 0.5, fhd = F.shedD * 0.5;
    addWallX(F.shedCx - fhw, F.shedCx + fhw, F.shedCz - fhd, 0.6, 0, 8.5);
    addWallZ(F.shedCx - fhw, F.shedCz - fhd, F.shedCz + fhd, 0.6, 0, 8.5);
    addWallZ(F.shedCx + fhw, F.shedCz - fhd, F.shedCz + fhd, 0.6, 0, 8.5);
    // 棚内主要草垛区碰撞（留出南侧与中央过道供走进参观）
    addBox(F.shedCx - 20.4, F.shedCx - 2.6, F.shedCz - 10.2, F.shedCz + 4.4, 0, 5.2);
    addBox(F.shedCx + 2.0, F.shedCx + 20.0, F.shedCz - 10.2, F.shedCz + 4.6, 0, 5.2);
  }
  // TMR 车间与青贮窖
  addBox(-110, -84, -50, -30, 0, 14);
  addBox(-114, -82, -13, 5, 0, 6);
  // 生产区/交易区隔离围墙（留出通道大门 x ∈ [-48, -38]）
  const Wl = L.market.wall;
  addWallX(Wl.x0, Wl.x1, Wl.z, 0.7, 0, 3.2, Wl.gates || []);
  // 交易区待售活牛栏外围
  const P = L.market.pens;
  addBox(P.x0 - 0.3, P.x0 + P.cols * P.w + (P.cols - 1) * P.gx + 0.3, P.z0 - 0.3, P.z0 + P.rows * P.d + (P.rows - 1) * P.gz + 0.3, 0, 2.2);

  /* ============================================================
   *  碰撞解析与可行走高度查询
   * ============================================================ */
  const doorById = new Map();
  for (const d of doors) doorById.set(d.id, d);

  const PLAYER_R = 0.34;
  const PLAYER_H = 1.72;
  const EYE_H = 1.60;

  function groundHeightAt(x, z, curY) {
    let best = 0.26;
    let bestDiff = Math.abs(best - curY);

    for (const f of floors) {
      if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) {
        if (curY >= f.minY && curY <= f.maxY) {
          const diff = Math.abs(f.y - curY);
          if (diff < bestDiff + 0.35 && f.y <= curY + 0.65) {
            if (f.y > best || diff < bestDiff) {
              best = f.y;
              bestDiff = diff;
            }
          }
        }
      }
    }
    for (const r of ramps) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
        if (curY >= r.minY && curY <= r.maxY) {
          const coord = r.axis === 'z' ? z : x;
          const t = U.clamp((coord - r.v0) / (r.v1 - r.v0), 0, 1);
          const ry = r.y0 + (r.y1 - r.y0) * t;
          if (Math.abs(ry - curY) < 1.05) {
            best = ry;
            bestDiff = Math.abs(ry - curY);
          }
        }
      }
    }
    return best;
  }

  function hitsAny(nx, nz, feetY) {
    // 园区最外圈围墙范围约束
    if (nx < -132.5 || nx > 132.5 || nz < -96.5 || nz > 102.5) return true;
    const py0 = feetY + 0.38;
    const py1 = feetY + PLAYER_H;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (py1 <= c.y0 || py0 >= c.y1) continue;
      if (c.doorId) {
        const d = doorById.get(c.doorId);
        if (d && d.openFrac > 0.62) continue;
      }
      if (nx + PLAYER_R > c.x0 && nx - PLAYER_R < c.x1 && nz + PLAYER_R > c.z0 && nz - PLAYER_R < c.z1) {
        return true;
      }
    }
    return false;
  }

  function movePlayer(pos, dx, dz) {
    let x = pos.x, y = pos.y, z = pos.z;
    // 分轴滑动解析，贴墙移动顺滑不卡顿
    if (dx !== 0) {
      const nx = x + dx;
      const ny = groundHeightAt(nx, z, y);
      if (Math.abs(ny - y) <= 0.72 && !hitsAny(nx, z, ny)) {
        x = nx;
        y = ny;
      }
    }
    if (dz !== 0) {
      const nz = z + dz;
      const ny = groundHeightAt(x, nz, y);
      if (Math.abs(ny - y) <= 0.72 && !hitsAny(x, nz, ny)) {
        z = nz;
        y = ny;
      }
    }
    pos.set(x, y, z);
    return pos;
  }

  function nearestDoor(pos, maxDist) {
    let best = null, bestD = maxDist == null ? 3.2 : maxDist;
    for (const d of doors) {
      if (Math.abs(d.y - pos.y) > 1.8) continue;
      const dist = Math.hypot(d.x - pos.x, d.z - pos.z);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
  }

  function updateDoors(dt, playerPos, walkActive) {
    for (const d of doors) {
      if (d.autoOpen && walkActive && playerPos) {
        const dist = Math.hypot(d.x - playerPos.x, d.z - playerPos.z);
        const sameFloor = Math.abs(d.y - playerPos.y) < 1.8;
        if (sameFloor && dist < 3.4) d.isOpen = true;
        else if (dist > 5.5) d.isOpen = false;
      }
      d.update(dt);
    }
  }

  /* 预设第一人称出生/传送点 */
  const spots = [
    { id: 'plaza',  label: '迎宾广场', x: -6.0,  y: 0.26, z: 42.0,  yaw: 2.75,  pitch: 0.02 },
    { id: 'hall',   label: '交易大厅', x: -25.0, y: 0.84, z: 24.4,  yaw: Math.PI, pitch: 0.04 },
    { id: 'office', label: '办公楼门', x: 12.0,  y: 0.26, z: 83.2,  yaw: Math.PI, pitch: 0.04 },
    { id: 'dorm',   label: '员工宿舍', x: 17.2,  y: 0.62, z: 70.5,  yaw: 1.57,  pitch: 0.0 },
    { id: 'forage', label: '草料库',   x: 77.0,  y: 0.28, z: 33.0,  yaw: Math.PI, pitch: 0.04 },
  ];

  const api = {
    EYE_H: EYE_H,
    spots: spots,
    doors: doors,
    groundHeightAt: groundHeightAt,
    movePlayer: movePlayer,
    nearestDoor: nearestDoor,
    updateDoors: updateDoors,
  };
  world.walk = api;
  return api;
};
