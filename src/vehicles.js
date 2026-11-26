import * as THREE from 'three';
import { FL } from './fl.js';

/* ============================================================
 *  vehicles.js — 车辆造型 / 路线运行 / 作业停顿
 * ============================================================ */
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
      paint: U.std({ color: P.paint, roughness: 0.55, metalness: 0.22 }),
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
  // 斜撑：从 A 点拉到 B 点的方钢（牵引架 / 支撑杆 / 液压缸都用它）
  function strut(kit, mat, ax, ay, az, bx, by, bz, t) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz) || 0.001;
    const g = new THREE.BoxGeometry(t, len, t);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(dx / len, dy / len, dz / len)
    );
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2),
      q, new THREE.Vector3(1, 1, 1)
    ));
    kit.add(g, mat);
  }

  // 车轮：独立成组（轮轴沿 X），这样每帧能绕轴自转
  // 胎体 + 胎肩 + 花纹块 + 轮辋 + 轮毂螺栓（合并后每轮 2~3 个 draw call）
  function wheel(m, x, z, r, w) {
    const g = new THREE.Group();
    g.position.set(x, r, z);
    const k = new U.Kit();

    const tire = new THREE.CylinderGeometry(r, r, w, 22);
    tire.rotateZ(Math.PI / 2);
    k.add(tire, m.tire);
    // 胎肩（两侧收进去一点，避免圆柱两端的硬边）
    for (const sx of [-1, 1]) {
      const sh = new THREE.CylinderGeometry(r * 0.9, r * 0.78, w * 0.2, 22);
      sh.rotateZ(Math.PI / 2);
      sh.translate(sx * (w * 0.4), 0, 0);
      k.add(sh, m.tire);
    }
    // 花纹块（跟着轮子一起转）
    const n = r > 0.72 ? 16 : 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const lug = new THREE.BoxGeometry(w * 0.8, r * 0.1, r * 0.28);
      lug.translate(0, r * 0.96, 0);
      lug.rotateX(a);
      k.add(lug, m.tire);
    }
    // 轮辋
    const ring = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 0.88, 18);
    ring.rotateZ(Math.PI / 2);
    k.add(ring, m.steel);
    for (const sx of [-1, 1]) {
      const disc = new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.06, 18);
      disc.rotateZ(Math.PI / 2);
      disc.translate(sx * (w * 0.42), 0, 0);
      k.add(disc, m.dark);
      const hubc = new THREE.CylinderGeometry(r * 0.19, r * 0.19, 0.1, 12);
      hubc.rotateZ(Math.PI / 2);
      hubc.translate(sx * (w * 0.46), 0, 0);
      k.add(hubc, m.steel);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const b = new THREE.CylinderGeometry(r * 0.05, r * 0.05, 0.12, 6);
        b.rotateZ(Math.PI / 2);
        b.translate(0, r * 0.34, 0);
        b.rotateX(a);
        b.translate(sx * (w * 0.47), 0, 0);
        k.add(b, m.steel);
      }
    }
    k.build(g);
    return g;
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
    const wheels = [];
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
    wheels.push(wheel(m, 1.18, 5.3, 0.56, 0.44), wheel(m, -1.18, 5.3, 0.56, 0.44));
    wheels.push(wheel(m, 1.18, -3.6, 0.56, 0.5), wheel(m, -1.18, -3.6, 0.56, 0.5));
    wheels.push(wheel(m, 1.18, -5.2, 0.56, 0.5), wheel(m, -1.18, -5.2, 0.56, 0.5));
    return { kit: kit, m: m, len: 14.2, lightZ: 6.2, tailZ: -6.6, labelY: 6.0, wheels: wheels };
  }

  /* 草料自卸车 */
  function buildForageTruck(P) {
    const kit = new U.Kit();
    const m = materials(P);
    const wheels = [];
    const LEN = 9.2, TZ = -1.7;
    const PY = 1.3, PZ = TZ - LEN / 2;      // 尾部铰点：卸料时斗体绕这里抬起
    const by = (y) => y - PY, bz = (z) => z - PZ;
    chassis(kit, m, 12.0, 0);
    cab(kit, m, { z: 4.9, l: 2.45, h: 1.8 });

    // ---- 自卸斗（独立组，可抬起）----
    const bedKit = new U.Kit();
    box(bedKit, m.paint, 2.5, 0.28, LEN, 0, by(1.3), bz(TZ));
    for (const sx of [-1, 1]) box(bedKit, m.paint, 0.13, 1.35, LEN, sx * 1.19, by(2.0), bz(TZ));
    box(bedKit, m.paint, 2.4, 1.35, 0.13, 0, by(2.0), bz(TZ + LEN / 2 - 0.06));
    box(bedKit, m.dark, 2.4, 1.35, 0.13, 0, by(2.0), bz(TZ - LEN / 2 + 0.06));
    box(bedKit, m.accent, 2.52, 0.12, LEN + 0.02, 0, by(1.28), bz(TZ));
    // 草捆（独立组：卸完货直接隐藏 = 空车）
    const hay = U.std({ color: 0xb89a55, roughness: 0.95, metalness: 0 });
    const cargoKit = new U.Kit();
    for (let i = 0; i < 5; i++) {
      rbox(cargoKit, hay, 2.02, 0.62, 1.5, 0.2, 0, by(2.28), bz(TZ - 3.2 + i * 1.6));
    }
    for (let i = 0; i < 4; i++) {
      rbox(cargoKit, hay, 2.0, 0.58, 1.45, 0.2, 0.05, by(2.9), bz(TZ - 2.4 + i * 1.6));
    }
    const cargo = new THREE.Group();
    cargoKit.build(cargo);
    cargo.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const bed = new THREE.Group();
    bed.add(cargo);
    bed.position.set(0, PY, PZ);
    bedKit.build(bed);
    bed.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    // 篷布卷（不随斗升）
    tube(kit, m.tarp || U.std({ color: 0x2c3a33, roughness: 0.9 }), 0.26, 0.26, 2.2, 10, 0, 3.35, TZ + 3.9, 0, 0, Math.PI / 2);
    // 液压顶（升斗时会被斗体挡住，保留静态柱体）
    tube(kit, m.steel, 0.12, 0.12, 1.5, 8, 0, 1.05, TZ + 1.2, 0, 0, 0);
    // 轮
    wheels.push(wheel(m, 1.18, 5.25, 0.56, 0.44), wheel(m, -1.18, 5.25, 0.56, 0.44));
    wheels.push(wheel(m, 1.18, -3.4, 0.56, 0.5), wheel(m, -1.18, -3.4, 0.56, 0.5));
    wheels.push(wheel(m, 1.18, -4.9, 0.56, 0.5), wheel(m, -1.18, -4.9, 0.56, 0.5));
    return { kit: kit, m: m, len: 13.8, lightZ: 6.2, tailZ: -6.3, labelY: 5.8, wheels: wheels, bed: bed, cargo: cargo };
  }

  /* TMR 日粮车（自走式卧式饲料搅拌车）
   *   三个识别点：
   *   ① 敞口搅拌仓 —— 俯视能看见仓里的饲料和旋转的螺旋绞龙
   *   ② 右侧前置出料输送带 —— 顺着料槽边走边投料，最像饲料车的地方
   *   ③ 尾部出料门（投料/卸料时向外翻开）+ 后置发动机舱
   */
  function buildTmrTruck(P) {
    const kit = new U.Kit();
    const m = materials(P);
    const wheels = [];

    // —— 专用材质 ——
    const mixDS = U.std({ color: 0xeff0e8, roughness: 0.44, metalness: 0.24, side: THREE.DoubleSide });
    const feed = U.std({ color: 0x7b6440, roughness: 0.96, metalness: 0.0, side: THREE.DoubleSide });
    const rub = U.std({ color: 0x14161a, roughness: 0.9, metalness: 0.05 });
    const chro = U.std({ color: 0xc2cbd1, roughness: 0.18, metalness: 0.92 });
    const grille = U.std({ color: 0x24292c, roughness: 0.7, metalness: 0.35 });
    const glass = U.std({ color: 0x33454f, roughness: 0.14, metalness: 0.72 });

    /* ================= 底盘 ================= */
    box(kit, m.dark, 0.24, 0.36, 8.8, 0.9, 1.1, 0.5);
    box(kit, m.dark, 0.24, 0.36, 8.8, -0.9, 1.1, 0.5);
    for (let i = 0; i < 5; i++) box(kit, m.dark, 2.0, 0.2, 0.22, 0, 1.1, 4.4 - i * 2.1);
    box(kit, m.dark, 2.0, 0.22, 0.36, 0, 0.72, 4.55);       // 前桥
    box(kit, m.dark, 2.1, 0.34, 2.1, 0, 0.86, -2.1);        // 后桥
    box(kit, m.dark, 1.1, 0.34, 0.4, 0, 1.0, -4.45);        // 尾配重
    box(kit, m.accent, 0.3, 0.32, 0.16, 0, 1.0, -4.62);

    /* ================= 驾驶室（偏左：右边让给出料输送带）================= */
    const CB = -0.30;
    rbox(kit, m.paint, 1.88, 0.72, 2.36, 0.12, CB, 1.86, 4.42);      // 腰部裙板
    box(kit, glass, 1.7, 1.28, 2.16, CB, 2.86, 4.42);                // 玻璃体
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(kit, m.paint, 0.1, 1.32, 0.1, CB + sx * 0.87, 2.86, 4.42 + sz * 1.04);
    }
    for (const sx of [-1, 1]) box(kit, m.paint, 0.12, 1.28, 0.13, CB + sx * 0.86, 2.86, 4.42);   // B 柱
    box(kit, m.paint, 1.96, 0.07, 2.44, CB, 3.5, 4.42);               // 车顶绿色檐边
    rbox(kit, mixDS, 1.92, 0.15, 2.4, 0.07, CB, 3.6, 4.42);          // 白色顶板
    box(kit, glass, 1.66, 1.24, 0.07, CB, 2.86, 5.5, -0.14, 0, 0);   // 前挡风
    box(kit, m.paint, 1.72, 0.09, 0.12, CB, 2.23, 5.48);            // 前挡风下框
    box(kit, m.paint, 0.055, 1.26, 0.1, CB, 2.86, 5.5, -0.14, 0, 0);// 前挡风中分隔
    for (const sx of [-1, 1]) box(kit, m.dark, 0.78, 0.03, 0.03, CB + sx * 0.4, 2.3, 5.44, -0.14, 0, 0);
    box(kit, m.paint, 1.72, 0.06, 0.3, CB, 3.5, 5.44, -0.2, 0, 0);   // 遮阳板
    rbox(kit, m.paint, 1.9, 0.38, 0.42, 0.1, CB, 1.4, 5.44);         // 前保险杠
    box(kit, grille, 1.3, 0.42, 0.1, CB, 1.84, 5.63);                // 格栅（贴在裙板前脸外）
    for (let i = 0; i < 4; i++) box(kit, m.steel, 1.22, 0.03, 0.05, CB, 1.7 + i * 0.09, 5.69);
    for (const sx of [-1, 1]) {
      box(kit, m.dark, 0.34, 0.26, 0.08, CB + sx * 0.74, 1.86, 5.62); // 大灯座
      box(kit, m.light, 0.26, 0.17, 0.06, CB + sx * 0.74, 1.9, 5.67);
      box(kit, m.accent, 0.16, 0.1, 0.06, CB + sx * 0.74, 1.64, 5.66);
      // 后视镜
      box(kit, m.dark, 0.05, 0.05, 0.44, CB + sx * 1.06, 3.16, 5.16);
      box(kit, m.dark, 0.09, 0.5, 0.22, CB + sx * 1.24, 2.96, 5.3);
    }
    // 车门缝 + 门把手
    box(kit, m.dark, 0.02, 1.2, 0.03, CB + 0.94, 2.86, 4.02);
    box(kit, m.steel, 0.06, 0.06, 0.2, CB + 0.96, 2.5, 3.86);
    // 车顶警示灯 + 作业灯
    tube(kit, m.accent, 0.1, 0.1, 0.2, 10, CB + 0.5, 3.76, 4.72);
    for (const sx of [-1, 1]) box(kit, m.light, 0.24, 0.09, 0.06, CB + sx * 0.6, 3.66, 5.42);
    // 上车踏板（左侧）
    for (let i = 0; i < 2; i++) box(kit, m.dark, 0.46, 0.07, 0.7, CB - 1.02, 1.5 - i * 0.46, 3.66);
    box(kit, m.dark, 0.05, 1.0, 0.05, CB - 1.22, 2.3, 3.86);

    /* ================= 搅拌仓 ================= */
    const R = 1.25, CY = 2.55, TOP = 3.8;
    const Z0 = 3.0, Z1 = -3.3, TL = Z0 - Z1, ZC = (Z0 + Z1) / 2;

    const SB = 3.02;                       // 涂装分界线：以下车头色、以上白钢
    const shell = new THREE.CylinderGeometry(R, R, TL, 26, 1, true, -Math.PI / 2, Math.PI);
    shell.rotateX(Math.PI / 2);
    part(kit, m.paint, shell, 0, CY, ZC);
    for (const sx of [-1, 1]) {
      box(kit, m.paint, 0.12, SB - CY + 0.02, TL, sx * R, (CY + SB) / 2, ZC);   // 下半：车头同色
      box(kit, mixDS, 0.12, TOP - SB, TL, sx * R, (SB + TOP) / 2, ZC);          // 上半：白钢
      box(kit, m.steel, 0.26, 0.12, TL + 0.06, sx * (R + 0.03), TOP, ZC);       // 上沿走货台
      box(kit, m.accent, 0.04, 0.17, TL + 0.02, sx * (R + 0.075), SB, ZC);      // 品牌色带压分界线
      for (let i = 0; i < 3; i++) {                                             // 竖向加强筋
        box(kit, m.steel, 0.05, TOP - CY - 0.12, 0.1, sx * (R + 0.08), (CY + TOP) / 2, ZC - TL / 2 + 1.0 + i * 1.9);
      }
    }
    for (let i = 0; i < 5; i++) {                                               // 环形加强箍
      const ring = new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.12, 26, 1, true, -Math.PI / 2, Math.PI);
      ring.rotateX(Math.PI / 2);
      part(kit, m.steel, ring, 0, CY, ZC - TL / 2 + 0.5 + i * 1.32);
    }
    // 前后端墙
    box(kit, m.paint, 2.6, SB - (CY - R), 0.14, 0, (SB + CY - R) / 2, Z0);
    box(kit, mixDS, 2.6, TOP - SB, 0.14, 0, (SB + TOP) / 2, Z0);
    box(kit, mixDS, 2.6, TOP - 2.72, 0.12, 0, (TOP + 2.72) / 2, Z1);
    // 仓内饲料：装到六成，绞龙从料面里露出来
    box(kit, feed, 2.32, 0.92, TL - 0.3, 0, 2.9, ZC);

    /* ---- 螺旋绞龙：绕仓轴转，投料时更快 ---- */
    const drumGrp = new THREE.Group();
    drumGrp.position.set(0, CY, ZC);
    const dk = new U.Kit();
    const shaft = new THREE.CylinderGeometry(0.15, 0.15, TL - 0.3, 12);
    shaft.rotateX(Math.PI / 2);
    dk.add(shaft, m.steel);
    for (let f = 0; f < 2; f++) {
      for (let i = 0; i < 34; i++) {
        const z = -TL / 2 + 0.4 + i * ((TL - 0.8) / 33);
        const a = f * Math.PI + i * 0.36;
        const plate = new THREE.BoxGeometry(0.05, 0.36, 0.44);
        plate.applyMatrix4(U.mat4(Math.cos(a) * 0.96, Math.sin(a) * 0.96, z, 0, 0, a - Math.PI / 2));
        dk.add(plate, m.steel);
        if (i % 4 === 0) {   // 连着轴的支撑臂
          const arm = new THREE.BoxGeometry(0.07, 0.95, 0.09);
          arm.applyMatrix4(U.mat4(Math.cos(a) * 0.5, Math.sin(a) * 0.5, z, 0, 0, a - Math.PI / 2));
          dk.add(arm, m.steel);
        }
      }
    }
    dk.build(drumGrp);
    drumGrp.traverse(function (o) { if (o.isMesh) { o.castShadow = false; o.receiveShadow = true; } });

    /* ---- 尾部出料门（绕底边向外翻）---- */
    const gate = new THREE.Group();
    gate.position.set(0, CY - R, Z1 - 0.03);
    const gk = new U.Kit();
    U.box(gk, m.steel, 2.5, 1.46, 0.1, 0, 0.75, 0);
    U.box(gk, m.accent, 2.52, 0.16, 0.13, 0, 1.36, -0.04);
    U.box(gk, m.dark, 0.1, 1.42, 0.13, 0.9, 0.75, -0.04);
    U.box(gk, m.dark, 0.1, 1.42, 0.13, -0.9, 0.75, -0.04);
    gk.build(gate);
    for (const sx of [-1, 1]) strut(kit, chro, sx * 1.1, TOP - 0.08, Z1 + 0.14, sx * 1.1, 2.3, Z1 - 0.1, 0.1);

    /* ---- 右侧前置出料输送带：从仓底前部斜向前上方伸出 ---- */
    const CX = 1.62, CYB = 1.55, CZ = 3.85, CL = 3.5, CT = -0.24;
    const lift = Math.sin(-CT);
    box(kit, m.dark, 0.9, 0.16, CL, CX, CYB, CZ, CT, 0, 0);                            // 机架
    box(kit, rub, 0.7, 0.05, CL - 0.1, CX, CYB + 0.12, CZ, CT, 0, 0);                  // 皮带
    for (const sx of [-1, 1]) box(kit, m.accent, 0.06, 0.18, CL - 0.1, CX + sx * 0.45, CYB + 0.1, CZ, CT, 0, 0);
    for (let i = 0; i < 10; i++) {                                                     // 皮带横筋
      box(kit, m.steel, 0.72, 0.04, 0.08, CX, CYB + 0.16, CZ - CL / 2 + 0.35 + i * (CL - 0.7) / 9, CT, 0, 0);
    }
    // 出料头（前端）：头部滚筒 + 下料斗
    const hz = CZ + CL / 2 - 0.1, hy = CYB + (CL / 2 - 0.1) * lift;
    const roller = new THREE.CylinderGeometry(0.16, 0.16, 0.78, 12);
    roller.rotateZ(Math.PI / 2);
    part(kit, chro, roller, CX, hy + 0.03, hz);
    box(kit, m.dark, 0.8, 0.16, 0.28, CX, hy - 0.1, hz + 0.14);
    box(kit, m.accent, 0.86, 0.07, 0.38, CX, hy + 0.17, hz + 0.1);
    // 尾部接料斗 + 折叠铰点 + 液压缸 + 支撑
    const pz = CZ - CL / 2 + 0.12, py = CYB - (CL / 2 - 0.12) * lift;
    box(kit, m.steel, 0.94, 0.46, 0.8, CX - 0.02, py + 0.2, pz - 0.16);
    box(kit, m.dark, 0.88, 0.2, 0.72, CX - 0.02, py + 0.44, pz - 0.16);
    box(kit, m.dark, 0.5, 0.32, 0.34, CX - 0.34, CYB - 0.1, pz + 0.06);
    strut(kit, chro, CX - 0.18, CYB - 0.24, pz + 0.34, CX - 0.1, CYB - 0.85, pz + 1.15, 0.09);
    strut(kit, m.dark, 0.8, 1.2, 4.95, CX - 0.42, CYB - 0.05, 4.7, 0.11);
    strut(kit, m.dark, 0.8, 1.2, 3.15, CX - 0.42, CYB - 0.05, 3.0, 0.11);
    strut(kit, m.dark, R + 0.02, 1.85, 2.75, CX - 0.44, CYB - 0.02, 2.75, 0.1);
    // 右侧前轮护罩
    rbox(kit, m.paint, 0.72, 0.1, 1.7, 0.04, 0.72, 1.44, 4.55);
    box(kit, m.accent, 0.74, 0.06, 0.06, 0.72, 1.36, 5.38);

    /* ---- 尾部发动机舱 ---- */
    rbox(kit, m.paint, 2.34, 1.06, 1.26, 0.1, 0, 1.62, -3.92);
    box(kit, grille, 1.9, 0.78, 0.07, 0, 1.86, -4.52);
    for (let i = 0; i < 5; i++) box(kit, m.steel, 1.8, 0.03, 0.04, 0, 1.56 + i * 0.16, -4.56);
    tube(kit, m.dark, 0.1, 0.1, 1.6, 8, 0.82, 3.1, -3.7);
    tube(kit, chro, 0.12, 0.12, 0.18, 8, 0.82, 3.96, -3.7);
    for (const sx of [-1, 1]) {
      box(kit, m.dark, 0.24, 0.24, 0.08, sx * 0.88, 1.28, -4.55);
      box(kit, m.red, 0.18, 0.14, 0.06, sx * 0.88, 1.28, -4.6);
    }
    for (let i = 0; i < 3; i++) box(kit, m.accent, 2.3, 0.05, 0.04, 0, 1.16 + i * 0.1, -4.54);
    // 尾部爬梯
    for (const sx of [-1, 1]) box(kit, m.dark, 0.05, 2.3, 0.05, -0.62 + sx * 0.2, 2.4, -4.6);
    for (let i = 0; i < 6; i++) box(kit, m.steel, 0.4, 0.04, 0.05, -0.62, 1.45 + i * 0.4, -4.6);

    /* ---- 仓顶栏杆（左侧走货台，右侧留给出料输送带）---- */
    for (const z of [2.2, 0.6, -1.0, -2.6]) {
      box(kit, m.steel, 0.05, 0.72, 0.05, -(R + 0.1), TOP + 0.4, z);
    }
    box(kit, m.steel, 0.06, 0.05, TL - 0.6, -(R + 0.1), TOP + 0.72, ZC);
    box(kit, m.steel, 0.05, 0.05, TL - 0.6, -(R + 0.1), TOP + 0.36, ZC);

    /* ================= 车轮 ================= */
    wheels.push(wheel(m, 1.12, 4.55, 0.66, 0.5), wheel(m, -1.12, 4.55, 0.66, 0.5));
    for (const z of [-1.35, -2.85]) {
      wheels.push(wheel(m, 1.24, z, 0.72, 0.56), wheel(m, -1.24, z, 0.72, 0.56));
    }
    // 后轮挡泥板
    for (const sx of [-1, 1]) rbox(kit, m.paint, 0.66, 0.1, 2.2, 0.05, sx * 1.24, 1.52, -2.1);

    return {
      kit: kit, m: m, len: 10.6, lightZ: 5.6, tailZ: -4.6, labelY: 4.7,
      wheels: wheels, drum: drumGrp, gate: gate,
    };
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
      group.rotation.order = 'YXZ';
      built.kit.build(group);
      group.traverse(function (o) {
        if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
      });
      // 可动的部件单独挂（车轮 / 自卸斗 / 搅拌叶片 / 出料门）
      const spin = [];
      for (let wi = 0; wi < (built.wheels || []).length; wi++) {
        group.add(built.wheels[wi]);
        spin.push(built.wheels[wi]);
      }
      if (built.bed) group.add(built.bed);
      if (built.drum) group.add(built.drum);
      if (built.gate) group.add(built.gate);
      // 接触阴影（跟着车走，让车"压"在地上）
      const aoQuad = U.aoPatch(3.7, built.len + 2.6, 0.42);
      aoQuad.position.set(0, 0.014, 0);
      group.add(aoQuad);

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
        wheels: spin,
        bed: built.bed || null,
        drum: built.drum || null,
        gate: built.gate || null,
        roll: 0,
        pitch: 0,
        cargo: built.cargo || null,
        loaded: true,
        drumSpin: 0,
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
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-3) continue;
        const ahead = dx * v.hx + dz * v.hz;
        if (ahead <= 0) continue;
        // 1) 同车道跟车：留净空（侧向容差内才算是"前车"）
        if (ahead <= SCAN) {
          const lat = Math.abs(dz * v.hx - dx * v.hz);
          if (lat <= LANE) {
            const clear = ahead - (v.len + o.len) * 0.5 - FOLLOW;
            const allow = clear <= 0 ? 0 : Math.min(1, clear / 13) * v.vmax;
            if (allow < best) best = allow;
          }
        }
        // 2) 斜切与路口：两条路线在这里交汇时，横向距离会被角度放大，
        //    只靠车道容差看不见对方，于是两车会直接插到一起。这条按距离兜底。
        // 留出制动距离：10 m/s + DEC 3.3 需要约 16 m，再加车身长度
        const reach = Math.max(SCAN, (v.len + o.len) * 0.5 + FOLLOW + 20);
        if (dist < reach && ahead > 0.55 * dist && best > 0) best = 0;
      }
      return best;
    }

    function advance(v, dt) {
      const len = v.path.length;
      if (!v.stops.length) {        // 兜底：没有停靠点的路线匀速绕行
        v.v = Math.min(v.vmax, v.v + ACC * dt);
        v.s = (v.s + v.v * dt) % len;
        if (v.s < v.v * dt * 0.5) v.sWrap = true;
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
      if (v.s >= len) { v.s -= len; v.sWrap = true; }
    }

    function stepSim(dt) {
      for (let i = 0; i < fleet.list.length; i++) advance(fleet.list[i], dt);
      // 载货状态：在青贮窖卸完就空车，跑完一圈回到起点再装满
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        if (!v.cargo) continue;
        if (v.sWrap) { v.loaded = true; v.sWrap = false; }
        const st = v.dwellLeft > 0 ? v.stops[v.si] : null;
        if (st && /青贮/.test(String(st.label || '')) && (st.stop - v.dwellLeft) > st.stop * 0.35) {
          v.loaded = false;
        }
      }
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

        /* ---- 机械动作 ---- */
        const sdt = dt > 0 ? Math.min(dt, 0.05) : 0;
        // 车轮滚动
        if (sdt > 0) {
          const spin = (v.v * sdt) / 0.56;
          for (let k = 0; k < v.wheels.length; k++) v.wheels[k].rotation.x += spin;
        }
        // 车身姿态：转弯侧倾 + 制动点头
        const accel = sdt > 0 ? (v.v - v.vPrev) / sdt : 0;
        if (sdt > 0) v.vPrev = v.v;
        const wantRoll = turn ? -turn * Math.min(0.045, v.v * 0.004) : 0;
        const wantPitch = Math.max(-0.045, Math.min(0.045, -accel * 0.010));
        const kk = 1 - Math.exp(-sdt * 6);
        v.roll += (wantRoll - v.roll) * kk;
        v.pitch += (wantPitch - v.pitch) * kk;
        v.group.rotation.z = v.roll;
        v.group.rotation.x = v.pitch;
        // TMR 搅拌筒：一直转，投料时更快
        if (v.drum && sdt > 0) {
          v.drumSpin += sdt * (v.dwell ? 2.1 : 1.15);
          v.drum.rotation.z = v.drumSpin;
        }
        // 自卸斗：在青贮窖卸料时抬起
        if (v.bed) {
          const lbl = v.dwell && v.stops[v.si] ? String(v.stops[v.si].label || '') : '';
          const want = /青贮/.test(lbl) ? -0.40 : 0;
          v.bed.rotation.x += (want - v.bed.rotation.x) * (1 - Math.exp(-sdt * 1.8));
        }
        // 草料：卸到一半就没货了（空车）
        if (v.cargo) v.cargo.visible = v.loaded;
        // TMR 尾部出料门：投料时抬起
        if (v.gate) {
          const lbl = v.dwell && v.stops[v.si] ? String(v.stops[v.si].label || '') : '';
          const want = /投料|饲喂/.test(lbl) ? -0.95 : 0;
          v.gate.rotation.x += (want - v.gate.rotation.x) * (1 - Math.exp(-sdt * 3));
        }
      }
      fleet._stages = stages;
      return stages;
    };

    fleet.stageSet = function () { return fleet._stages || new Set(); };
    fleet.vehicles = fleet.list;
    return fleet;
  };
