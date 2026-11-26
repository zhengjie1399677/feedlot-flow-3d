import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FL } from './fl.js';

/* ============================================================
 *  buildings.js — Blender 精模 GLB 建筑装配 + 配套设施
 *  核心单体已重构为 Blender PBR 精模（public/models/*.glb）：
 *    - barn.glb            现代化半开放钢构育肥牛舍 ×6（支持 R 键屋顶半透明剖视）
 *    - trading_shed.glb    低矮通透大跨度活牛交易棚（替换原 15.5m 古典柱廊）
 *    - office.glb          现代两层生态农牧办公楼（8.4m，替换原 23.2m 五层塔楼并去重）
 *    - tmr_complex.glb     TMR 配料车间 + 三座哑光镀锌加强筋筒仓 + 提升塔与斜管
 *    - disinfect_gate.glb  西大门门头 + 车辆雾化消毒通道与轮胎消毒池
 * ============================================================ */
  const U = FL.U;
  const L = FL.LAYOUT;

  /* ---------------- 通用 Blender GLB 加载器 ---------------- */
  const glbLoader = new GLTFLoader();

  function tuneGlbRoot(root, world, opts) {
    opts = opts || {};
    const isBarn = !!opts.isBarn;
    const roofMatSet = new Map();

    root.traverse(function (o) {
      if (!o.isMesh) return;
      const nm = o.name || '';
      const isRoof = isBarn && /^Roof_/i.test(nm);
      const isGlass = /Glass|Curtain|Poly|Water|Disinfect/i.test(nm + (o.material ? o.material.name : ''));

      o.castShadow = !isGlass;
      o.receiveShadow = true;

      if (o.material) {
        let m = o.material;
        if (isRoof) {
          let cl = roofMatSet.get(m);
          if (!cl) {
            cl = m.clone();
            cl.transparent = true;
            cl.opacity = 1.0;
            cl.depthWrite = true;
            cl.envMapIntensity = 0.85;
            roofMatSet.set(m, cl);
            world.glbRoofMats.push(cl);
          }
          o.material = cl;
          m = cl;
        } else {
          m = m.clone();
          m.envMapIntensity = isGlass ? 1.35 : 0.85;
          if (/SprayPoly/i.test(nm + (m.name || ''))) {
            m.transparent = true;
            m.opacity = 0.34;
            m.depthWrite = false;
          }
          o.material = m;
        }

        // 自发光材质接入昼夜循环（白天几乎关闭，黄昏/夜间柔和亮起）
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) {
          const baseI = m.emissiveIntensity != null ? m.emissiveIntensity : 1.5;
          world.glbGlowMats.push({ mat: m, base: baseI });
          o.castShadow = false;
        }
      }
    });
  }

  function loadBuildingGLB(url, world, onReady) {
    glbLoader.load(url, function (gltf) {
      onReady(gltf.scene);
    }, undefined, function (err) {
      console.warn('建筑 GLB 加载失败:', url, err);
    });
  }

  /* ---------------- 克制的建筑标识牌 ---------------- */
  function sign(world, text, sub, w, h, x, y, z, rotY, opts) {
    opts = opts || {};
    const tex = U.textTexture({
      w: 1024,
      h: Math.round((1024 * h) / w),
      text: text,
      sub: sub,
      size: opts.size || 86,
      subSize: opts.subSize || 34,
      color: opts.color || '#eef4f7',
      subColor: opts.subColor || 'rgba(210,224,232,0.68)',
      bg: opts.bg || 'rgba(12,17,22,0.88)',
      border: opts.border || null,
      borderWidth: 3,
      shadow: opts.glow || null,
      shadowBlur: 20,
      font: '"Microsoft YaHei","Bahnschrift",sans-serif',
    });
    const mat = U.signMaterial(tex, 1, false);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.renderOrder = 4;
    world.group.add(mesh);
    return mesh;
  }

  function glowSprite(world, color, size, x, y, z, opacity) {
    const s = U.sprite(color, size, opacity == null ? 0.5 : opacity);
    s.position.set(x, y, z);
    world.group.add(s);
    world.lampSprites.push(s);
    return s;
  }

  /* ---------------- 接触阴影 ---------------- */
  function ao(world, w, d, x, z, opacity, rotY) {
    const m = U.aoPatch(w, d, opacity == null ? 0.30 : opacity);
    m.position.set(x, 0.207, z);
    if (rotY) m.rotation.z = rotY;
    world.group.add(m);
    return m;
  }

  function buildAO(world) {
    for (const b of L.barns) ao(world, b.len + 3.0, b.dep + 3.2, b.cx, b.cz, 0.32);
    ao(world, 27.0, 21.0, -102, -10, 0.34);            // TMR 配料车间
    ao(world, 10.5, 10.5, -108, -32, 0.28);            // 3 座筒仓
    ao(world, 10.5, 10.5, -94, -32, 0.28);
    ao(world, 10.5, 10.5, -80, -32, 0.28);
    ao(world, 28.0, 11.0, -95, 26, 0.28);              // 青贮窖
    ao(world, 25.0, 13.0, -84, 56, 0.28);              // 地磅棚
    ao(world, 15.0, 15.0, -46, -64, 0.26);             // 卸牛台
    ao(world, 12.0, 17.0, 103.5, -69, 0.28);           // 装车台
    const mk = L.market;
    ao(world, mk.hall.w + 4.0, mk.hall.d + 4.0, mk.hall.cx, mk.hall.cz, 0.30);
    ao(world, mk.office.w + 4.0, mk.office.d + 4.0, mk.office.cx, mk.office.cz, 0.28);
  }

  /* ---------------- 6 栋育肥牛舍（Blender barn.glb 实例化 + 动态料堆） ---------------- */
  function buildBarns(M, world) {
    // 动态料槽日粮堆（与 TMR 投料进度实时联动）
    for (const b of L.barns) {
      const tz = b.mirror ? b.cz - b.dep / 2 - 1.2 : b.cz + b.dep / 2 + 1.2;
      const tlen = b.len - 6.0;
      const pileGeo = new THREE.BoxGeometry(tlen - 0.6, 1, 1.40);
      pileGeo.translate(0, 0.5, 0);
      const pile = new THREE.Mesh(pileGeo, M.feedPile || M.feed);
      pile.position.set(b.cx, 0.50, tz);
      pile.scale.y = 0.14;
      pile.castShadow = true;
      pile.receiveShadow = true;
      world.group.add(pile);
      world.feedPiles.push({ mesh: pile, x: b.cx, z: tz, idx: b.idx, show: -1 });
      world.pools.push({ x: b.cx, z: b.cz, size: 34, warm: 1 });
      world.pools.push({ x: b.cx, z: tz, size: 14, warm: 0.35 });
    }

    loadBuildingGLB('models/barn.glb', world, function (proto) {
      const barnsGroup = new THREE.Group();
      barnsGroup.name = 'barnsGLB';
      for (const b of L.barns) {
        const inst = proto.clone(true);
        inst.position.set(b.cx, 0, b.cz);
        inst.rotation.y = b.mirror ? Math.PI : 0;
        tuneGlbRoot(inst, world, { isBarn: true });
        barnsGroup.add(inst);
      }
      world.group.add(barnsGroup);
    });
  }

  /* ---------------- 卸牛台 ---------------- */
  function buildRamp(kit, M, world) {
    const x0 = -52, x1 = -40, z0 = -70, z1 = -58, h = 0.95;
    U.box(kit, M.concreteTrough, x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2 + 0.15, (z0 + z1) / 2);
    const ang = Math.atan2(h + 0.15, 3.4);
    U.box(kit, M.concreteTrough, 3.6, 0.28, z1 - z0, x0 - 1.6, 0.5, (z0 + z1) / 2, 0, 0, ang);
    U.box(kit, M.steel, x1 - x0 + 0.4, 0.1, 0.1, (x0 + x1) / 2, 2.0, z0 + 0.1);
    U.box(kit, M.steel, x1 - x0 + 0.4, 0.1, 0.1, (x0 + x1) / 2, 2.0, z1 - 0.1);
    for (let i = 0; i <= 5; i++) {
      const x = x0 + (i * (x1 - x0)) / 5;
      U.box(kit, M.steel, 0.09, 1.15, 0.09, x, 1.45, z0 + 0.1);
      U.box(kit, M.steel, 0.09, 1.15, 0.09, x, 1.45, z1 - 0.1);
    }
    U.box(kit, M.steelLight, 1.6, 0.12, 6.2, -52.6, 1.28, -64);
    U.box(kit, M.yellow, 1.6, 0.05, 0.18, -52.6, 1.36, -66.9);
    U.box(kit, M.yellow, 1.6, 0.05, 0.18, -52.6, 1.36, -61.1);
    world.pools.push({ x: -46, z: -64, size: 16, warm: 0.8 });
  }

  /* ---------------- 地磅 ---------------- */
  function buildWeigh(kit, M, world) {
    const x = L.slots.weighbridge.x, z = L.slots.weighbridge.z;
    U.box(kit, M.yard, 20, 0.35, 8, x, 0.42, z, 0, 0, 0, 0.06);
    U.box(kit, M.steel, 20.4, 0.22, 8.4, x, 0.22, z, 0, 0, 0, 0.04);
    U.box(kit, M.yellow, 20, 0.06, 0.26, x, 0.62, z - 3.7);
    U.box(kit, M.yellow, 20, 0.06, 0.26, x, 0.62, z + 3.7);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        U.box(kit, M.steel, 0.28, 6.8, 0.28, x + sx * 9.2, 3.45, z + sz * 4.3);
      }
    }
    U.box(kit, M.steel, 22, 0.34, 10.4, x, 7.0, z, 0.045, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 22.6, 0.18, 10.9, x, 7.2, z, 0.045, 0, 0);
    U.box(kit, M.steel, 22.2, 0.68, 0.18, x, 6.72, z + 5.3);
    U.box(kit, M.warmGlow, 19, 0.08, 0.12, x, 6.62, z - 2.4);
    U.box(kit, M.warmGlow, 19, 0.08, 0.12, x, 6.62, z + 2.4);
    sign(world, '38.62 t · 24 头  已放行', 'WEIGHBRIDGE · 100t', 7.2, 1.55, x, 5.75, z + 5.42, 0,
      { size: 70, subSize: 30, color: '#ffcf8f', bg: 'rgba(10,12,15,0.92)', border: 'rgba(255,170,80,0.38)' });
    // 磅房
    const bx = -94.0, bz = 65.8;
    U.box(kit, M.wallCool, 6.0, 3.3, 4.2, bx, 1.65, bz, 0, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 6.5, 0.24, 4.7, bx, 3.4, bz);
    U.box(kit, M.glass, 3.0, 1.3, 0.08, bx, 2.1, bz + 2.12);
    U.box(kit, M.warmGlow, 2.7, 1.05, 0.06, bx, 2.1, bz + 2.17);
    world.pools.push({ x: x, z: z, size: 34, warm: 1 });
  }

  /* ---------------- 西大门 + 车辆雾化消毒通道（Blender disinfect_gate.glb + 动态道闸） ---------------- */
  function buildGate(kit, M, world) {
    const g = L.slots.gate;

    loadBuildingGLB('models/disinfect_gate.glb', world, function (root) {
      root.position.set(g.x, 0, g.z);
      tuneGlbRoot(root, world);
      world.group.add(root);
    });

    // 门头主标牌（内外双面嵌入门头横梁，进场和场内都清晰可见）
    sign(world, '草都草牧业 · 育肥一场', 'CAODU GRASS & LIVESTOCK · FEEDLOT 01', 14.2, 1.65, g.x - 2.46, 7.65, g.z, -Math.PI / 2,
      { size: 76, subSize: 28, bg: 'rgba(14,19,24,0.92)', border: 'rgba(255,196,120,0.38)', color: '#f4e4cb' });
    sign(world, '草都草牧业 · 育肥一场', 'CAODU GRASS & LIVESTOCK · FEEDLOT 01', 14.2, 1.65, g.x + 0.86, 7.65, g.z, Math.PI / 2,
      { size: 76, subSize: 28, bg: 'rgba(14,19,24,0.92)', border: 'rgba(255,196,120,0.38)', color: '#f4e4cb' });

    // 动态道闸（有车接近自动抬杆，见 main.js）
    const bx = -105.5, bz = g.z + 7.2;
    U.box(kit, M.steel, 0.5, 1.3, 0.5, bx, 0.85, bz);
    U.box(kit, M.yellow, 0.6, 0.2, 0.6, bx, 1.55, bz);
    const arm = new THREE.Group();
    arm.position.set(bx, 1.55, bz);
    const armKit = new U.Kit();
    const armLen = 7.2, seg = armLen / 7;
    for (let i = 0; i < 7; i++) {
      U.box(armKit, i % 2 ? M.red : M.line, 0.12, 0.12, seg * 0.96, 0, 0, -(i + 0.5) * seg);
    }
    armKit.add(new THREE.BoxGeometry(0.16, 0.16, 0.5), M.steel, U.mat4(0, 0, -0.2));
    armKit.build(arm);
    arm.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    world.group.add(arm);
    world.gateArm = arm;
    world.gatePoint = { x: bx, z: bz };

    // 精简门卫值班房（原西南角重复的 8.4m 综合楼已移除，改留通透绿地）
    const hx = -114.2, hz = 69.2;
    U.box(kit, M.wallCool, 5.6, 3.2, 4.4, hx, 1.6, hz, 0, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 6.2, 0.24, 5.0, hx, 3.32, hz);
    U.box(kit, M.glass, 2.8, 1.25, 0.08, hx, 2.0, hz + 2.22);
    U.box(kit, M.warmGlow, 2.5, 1.0, 0.06, hx, 2.0, hz + 2.26);
    world.pools.push({ x: g.x + 2, z: g.z, size: 22, warm: 0.75 });

    // 西南角原综合楼地块改为景观草坪岛与灌木带，视觉更通透
    U.box(kit, M.concreteTrough, 24, 0.26, 12, -108, 0.28, 79, 0, 0, 0, 0.8);
    U.box(kit, M.grass, 23, 0.16, 11, -108, 0.42, 79, 0, 0, 0, 0.6);
    for (let i = 0; i < 4; i++) {
      U.box(kit, i % 2 ? M.leafA : M.leafB, 2.4, 0.9, 1.8, -116 + i * 5.2, 0.85, 79, 0, i * 0.4, 0, 0.35);
    }
  }

  /* ---------------- TMR 配料中心 + 三筒仓（Blender tmr_complex.glb） + 青贮窖 ---------------- */
  function buildPlantAndSilage(kit, M, world) {
    loadBuildingGLB('models/tmr_complex.glb', world, function (root) {
      root.position.set(-102, 0, -10);
      tuneGlbRoot(root, world);
      world.group.add(root);
    });
    world.pools.push({ x: -88, z: -6, size: 22, warm: 1 });

    // 青贮窖（加厚混凝土挡墙、青贮膜压胎、东端斜坡取料断面）
    const bx = -95, bz = 26, bw = 26, bd = 8;
    U.box(kit, M.yard, bw + 2, 0.3, bd + 4, bx, 0.25, bz + 1, 0, 0, 0, 0.06);
    U.box(kit, M.concreteTrough, bw, 2.7, 0.55, bx, 1.35, bz + bd / 2);
    U.box(kit, M.concreteTrough, 0.55, 2.7, bd, bx - bw / 2, 1.35, bz);
    U.box(kit, M.concreteTrough, 0.55, 2.7, bd, bx + bw / 2, 1.35, bz);
    U.box(kit, M.silage, bw - 1.4, 3.3, bd - 1.2, bx - 0.8, 1.85, bz - 0.6, 0, 0, 0, 1.4);
    U.box(kit, M.silage, 0.9, 2.5, bd - 2.0, bx + bw / 2 - 1.5, 1.35, bz - 0.6, 0, 0, -0.35, 0.14);
    U.box(kit, M.film, bw - 1.0, 0.14, bd - 0.8, bx - 0.8, 3.58, bz - 0.6, 0.01, 0, 0, 1.5);
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.TorusGeometry(0.48, 0.17, 6, 10);
        kit.add(g, M.soil, U.mat4(bx - 9.8 + i * 3.1, 3.72, bz - 2.1 + r * 2.8, Math.PI / 2, 0, 0));
      }
    }
    world.pools.push({ x: bx, z: bz + 2, size: 22, warm: 0.45 });
  }

  /* ---------------- 装载机 ---------------- */
  function buildLoader(kit, M, world, x, z, ry) {
    const m = U.mat4(x, 0, z, 0, ry, 0);
    const part = (geo, mat, lx, ly, lz) => {
      geo.applyMatrix4(U.mat4(lx, ly, lz));
      geo.applyMatrix4(m);
      kit.add(geo, mat);
    };
    part(U.roundedBox(2.0, 1.1, 3.4, 0.2), M.yellow, 0, 1.25, -0.4);
    part(U.roundedBox(1.7, 1.0, 1.5, 0.18), M.steel, 0, 1.25, 1.55);
    part(U.roundedBox(1.2, 1.1, 1.0, 0.14), M.glass, 0, 2.3, 0.9);
    part(U.roundedBox(0.24, 0.9, 2.4, 0.06), M.steel, -0.9, 1.9, 1.6);
    part(U.roundedBox(0.24, 0.9, 2.4, 0.06), M.steel, 0.9, 1.9, 1.6);
    part(U.roundedBox(2.3, 0.9, 1.0, 0.08), M.steel, 0, 1.1, 2.9);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 12);
        g.rotateZ(Math.PI / 2);
        part(g, M.soil, sx * 0.95, 0.62, sz * 1.15);
      }
    }
  }

  /* ---------------- 装车区 ---------------- */
  function buildDock(kit, M, world) {
    U.box(kit, M.concreteTrough, 9, 1.3, 14, 102.5, 0.65, -69, 0, 0, 0, 0.06);
    U.box(kit, M.yard, 8.6, 0.06, 13.6, 102.5, 1.33, -69);
    U.box(kit, M.concreteTrough, 5.2, 0.3, 5.2, 95.4, 0.7, -69, 0, 0, 0.24);
    for (const zz of [-76, -62]) {
      for (let i = 0; i < 5; i++) {
        U.box(kit, M.steel, 0.1, 1.2, 0.1, 98.4 + i * 2.1, 1.95, zz);
      }
      U.box(kit, M.steel, 8.6, 0.1, 0.1, 102.5, 2.5, zz);
      U.box(kit, M.steel, 8.6, 0.1, 0.1, 102.5, 1.65, zz);
    }
    U.box(kit, M.steelLight, 3.4, 0.16, 6.2, 106.4, 1.45, -69);
    for (const zz of [-72, -66]) {
      U.box(kit, M.steel, 0.1, 1.15, 0.1, 108.0, 2.0, zz);
      U.box(kit, M.steel, 0.1, 1.15, 0.1, 104.9, 2.0, zz);
      U.box(kit, M.steel, 3.2, 0.08, 0.08, 106.45, 2.55, zz);
      U.box(kit, M.steel, 3.2, 0.08, 0.08, 106.45, 1.85, zz);
    }
    U.box(kit, M.roofPlant, 4.6, 0.16, 7.4, 106.4, 3.65, -69, 0, 0, -0.08);
    for (const zz of [-72.3, -65.7]) {
      U.box(kit, M.steel, 0.16, 3.2, 0.16, 108.3, 2.05, zz);
    }
    U.box(kit, M.steel, 0.16, 3.2, 0.16, 104.6, 2.05, -72.3);
    U.box(kit, M.steel, 0.16, 3.2, 0.16, 104.6, 2.05, -65.7);
    U.box(kit, M.warmGlow, 4.0, 0.07, 0.09, 106.4, 3.5, -69);
    U.box(kit, M.steel, 0.12, 1.7, 6.2, 101.2, 2.2, -69);
    U.box(kit, M.steel, 6.0, 0.12, 0.12, 101.2, 3.1, -69);
    world.pools.push({ x: 102.5, z: -69, size: 22, warm: 1 });
  }

  /* ---------------- 生产区 / 交易区隔离围墙 ---------------- */
  function buildCompoundWall(kit, M, world) {
    const W = L.market.wall;
    const H = 2.2;
    const gates = (W.gates || []).slice();
    const segs = [];
    let cur = W.x0;
    for (const g of gates) {
      if (g[0] > cur) segs.push([cur, g[0]]);
      cur = Math.max(cur, g[1]);
    }
    if (cur < W.x1) segs.push([cur, W.x1]);

    for (const seg of segs) {
      const x0 = seg[0], x1 = seg[1];
      const len = x1 - x0;
      const n = Math.max(1, Math.round(len / 4.5));
      const step = len / n;
      U.box(kit, M.concreteTrough, len, 0.24, 0.70, (x0 + x1) / 2, 0.32, W.z);
      U.box(kit, M.steel, len, 0.14, 0.34, (x0 + x1) / 2, 0.44 + H + 0.07, W.z);
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * step;
        U.box(kit, M.wallCool, step - 0.14, H, 0.24, x, 0.44 + H / 2, W.z);
      }
      for (let i = 0; i <= n; i++) {
        const x = x0 + i * step;
        U.box(kit, M.wallDark, 0.28, H + 0.28, 0.32, x, 0.44 + (H + 0.28) / 2, W.z);
      }
      // 围墙南侧绿化隔离带
      U.box(kit, M.grass, len, 0.14, 1.2, (x0 + x1) / 2, 0.31, W.z + 1.0);
      for (let i = 0; i * 7.0 + 3 < len; i++) {
        const x = x0 + 3 + i * 7.0;
        U.box(kit, i % 2 ? M.leafA : M.leafB, 1.4, 0.8, 1.1, x, 0.78, W.z + 1.0, 0, i * 0.7, 0, 0.3);
      }
    }

    for (const g of gates) {
      const gx0 = g[0], gx1 = g[1], mid = (gx0 + gx1) / 2, gw = gx1 - gx0;
      for (const x of [gx0, gx1]) {
        U.box(kit, M.wallDark, 0.55, H + 0.9, 0.55, x, 0.44 + (H + 0.9) / 2, W.z);
      }
      U.box(kit, M.steel, gw + 0.4, 0.18, 0.30, mid, 0.44 + H + 0.65, W.z);
      const leaf = gw * 0.50;
      for (let r = 0; r < 4; r++) {
        U.box(kit, M.steel, leaf, 0.08, 0.09, gx0 + leaf / 2 + 0.3, 0.9 + r * 0.42, W.z + 0.24);
      }
      world.pools.push({ x: mid, z: W.z + 2.4, size: 12, warm: 0.65 });
    }
  }

  /* ---------------- 活牛交易中心（Blender trading_shed.glb + 6 格待售栏 + 装牛台） ---------------- */
  function buildTradingCenter(kit, M, world) {
    const Hh = L.market.hall;
    const P = L.market.pens;
    const cx = Hh.cx, cz = Hh.cz;

    // 交易广场浅灰铺装
    U.box(kit, M.apron, 86, 0.08, 44, 0, 0.256, 12, 0, 0, 0, 1.6);

    // 加载 Blender 低矮大跨钢构交易棚（彻底替换原古典六柱门楼）
    loadBuildingGLB('models/trading_shed.glb', world, function (root) {
      root.position.set(cx, 0, cz);
      tuneGlbRoot(root, world);
      world.group.add(root);
    });

    // 克制嵌入挑檐横梁正面的标识牌
    sign(world, '活牛交易中心', 'LIVE CATTLE TRADING PAVILION', 12.6, 1.35, cx, 5.50, cz + Hh.d / 2 + 2.82, 0, {
      size: 86, subSize: 30, bg: 'rgba(14,19,24,0.92)', border: 'rgba(255,188,120,0.42)',
      color: '#f8e6cb', subColor: 'rgba(225,205,180,0.78)',
    });
    world.pools.push({ x: cx, z: cz + Hh.d / 2 + 4.0, size: 28, warm: 0.9 });

    // 6 格待售活牛栏（突出活畜交易主体特征）
    const penX = P.x0, penZ = P.z0;
    const penW = P.w, penD = P.d, gx = P.gx, gz = P.gz;
    const totalW = P.cols * penW + (P.cols - 1) * gx;
    const totalD = P.rows * penD + (P.rows - 1) * gz;
    U.box(kit, M.penPad, totalW + 6, 0.1, totalD + 6, penX + totalW / 2, 0.27, penZ + totalD / 2, 0, 0, 0, 1.2);
    for (let r = 0; r < P.rows; r++) {
      for (let c = 0; c < P.cols; c++) {
        const x0 = penX + c * (penW + gx), z0 = penZ + r * (penD + gz);
        const mx = x0 + penW / 2, mz = z0 + penD / 2;
        for (let i = 0; i <= 4; i++) {
          const t = i / 4;
          const pts = [
            [x0 + penW * t, z0], [x0 + penW * t, z0 + penD],
            [x0, z0 + penD * t], [x0 + penW, z0 + penD * t],
          ];
          for (const p of pts) U.box(kit, M.steel, 0.12, 1.5, 0.12, p[0], 1.02, p[1]);
        }
        for (const y of [0.72, 1.28]) {
          U.box(kit, M.steel, penW, 0.08, 0.08, mx, y, z0);
          U.box(kit, M.steel, penW, 0.08, 0.08, mx, y, z0 + penD);
          U.box(kit, M.steel, 0.08, 0.08, penD, x0, y, mz);
          U.box(kit, M.steel, 0.08, 0.08, penD, x0 + penW, y, mz);
        }
        U.box(kit, M.concreteTrough, penW - 0.6, 0.62, 0.95, mx, 0.72, z0 + 0.62, 0, 0, 0, 0.22);
        U.box(kit, M.feed, penW - 1.0, 0.18, 0.72, mx, 1.06, z0 + 0.62);
        U.box(kit, M.steel, 1.7, 0.62, 0.7, x0 + penW - 1.4, 0.72, z0 + penD - 1.1, 0, 0, 0, 0.16);
        U.box(kit, M.water, 1.5, 0.06, 0.52, x0 + penW - 1.4, 1.0, z0 + penD - 1.1);
      }
    }
    for (let c = 0; c < P.cols - 1; c++) {
      const x = penX + c * (penW + gx) + penW + gx / 2;
      U.cyl(kit, M.steel, 0.09, 0.11, 4.4, 8, x, 2.4, penZ + totalD / 2);
      glowSprite(world, 0xffd7a0, 2.0, x, 4.7, penZ + totalD / 2, 0.65);
    }

    // 交易装牛坡道 + 停靠的活牛车
    const R = L.market.ramp;
    U.box(kit, M.concreteTrough, 4.4, 1.1, 7.6, R.x, 0.86, R.z, 0, 0, 0, 0.3);
    U.box(kit, M.concreteTrough, 3.2, 0.4, 7.6, R.x - 3.6, 0.5, R.z, 0, 0, -0.16, 0.2);
    for (const pz of [R.z - 3.6, R.z + 3.6]) {
      U.box(kit, M.steel, 4.4, 0.08, 0.08, R.x, 2.1, pz);
      U.box(kit, M.steel, 0.08, 1.0, 0.08, R.x - 2.1, 1.9, pz);
      U.box(kit, M.steel, 0.08, 1.0, 0.08, R.x + 2.1, 1.9, pz);
    }
    parkedStockTruck(kit, M, R.x + 10.5, R.z - 0.4, 0);

    // 交易小地磅
    const SC = L.market.scale;
    U.box(kit, M.concreteTrough, 10, 0.34, 4.4, SC.x, 0.4, SC.z, 0, 0, 0, 0.2);
    U.box(kit, M.steel, 9.2, 0.06, 3.6, SC.x, 0.6, SC.z);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        U.box(kit, M.steel, 0.16, 1.2, 0.16, SC.x + sx * 4.2, 0.98, SC.z + sz * 1.7);
      }
    }
    U.box(kit, M.wallCool, 2.6, 2.6, 2.4, SC.x + 6.4, 1.6, SC.z + 2.6);
    U.box(kit, M.glass, 2.0, 0.9, 0.1, SC.x + 6.4, 2.2, SC.z + 1.38);

    // 中央绿化花坛 + 路灯（给前场留出舒缓绿意，去掉杂乱彩旗）
    U.box(kit, M.concreteTrough, 18, 0.48, 4.4, -4, 0.46, 26, 0, 0, 0, 1.4);
    U.box(kit, M.grass, 17, 0.16, 3.6, -4, 0.72, 26, 0, 0, 0, 1.1);
    for (let i = 0; i < 5; i++) {
      U.box(kit, i % 2 ? M.leafA : M.leafB, 2.0, 0.9, 1.8, -11 + i * 3.5, 1.15, 26, 0, i * 0.5, 0, 0.4);
    }
    for (const lp of [[-18, 30], [16, 30], [32, 16]]) {
      U.cyl(kit, M.steel, 0.09, 0.12, 5.0, 8, lp[0], 2.7, lp[1]);
      U.box(kit, M.lamp, 0.85, 0.16, 0.55, lp[0], 5.2, lp[1]);
      glowSprite(world, 0xffd7a0, 2.4, lp[0], 5.2, lp[1], 0.8);
      world.pools.push({ x: lp[0], z: lp[1], size: 13, warm: 0.75 });
    }
  }

  /* ---------------- 现代两层生态农牧办公楼（Blender office.glb，8.4m 高不遮挡园区） ---------------- */
  function buildStaffOffice(kit, M, world) {
    const O = L.market.office;
    const cx = O.cx, cz = O.cz, d = O.d;

    loadBuildingGLB('models/office.glb', world, function (root) {
      root.position.set(cx, 0, cz);
      root.rotation.y = O.rot || 0;
      tuneGlbRoot(root, world);
      world.group.add(root);
    });

    // 楼顶精致低矮标牌（与 8.4m 建筑高度协调）
    sign(world, '草都草牧业股份有限公司', 'CAODU GRASS ANIMAL HUSBANDRY CO., LTD.', 13.5, 1.5, cx, 8.95, cz + d / 2 + 0.88, 0, {
      size: 68, subSize: 24, bg: 'rgba(14,19,24,0.92)', border: 'rgba(160,210,240,0.38)',
      color: '#eaf3fa', subColor: 'rgba(190,215,232,0.78)',
    });

    // 楼前简洁生态绿篱与三根旗杆
    const zf = cz + d / 2;
    U.box(kit, M.apron, 44, 0.18, 16, cx, 0.22, zf + 8.0, 0, 0, 0, 0.8);
    for (const sx of [-1, 1]) {
      U.box(kit, M.concreteTrough, 10.5, 0.45, 2.2, cx + sx * 13.5, 0.45, zf + 3.4, 0, 0, 0, 0.4);
      U.box(kit, M.leafA, 9.8, 0.75, 1.6, cx + sx * 13.5, 0.95, zf + 3.4, 0, 0, 0, 0.35);
    }
    for (const fx of [cx - 5.5, cx, cx + 5.5]) {
      U.cyl(kit, M.steelLight, 0.06, 0.08, 8.8, 8, fx, 4.6, zf + 10.5);
      U.box(kit, fx === cx ? M.red : M.blue, 1.4, 0.85, 0.05, fx + 0.72, 8.2, zf + 10.5, 0, 0.2, 0);
    }
    world.pools.push({ x: cx, z: zf + 4.2, size: 22, warm: 0.9 });
  }

  /* 静态停放的一台活牛车（交易区用） */
  function parkedStockTruck(kit, M, x, z, rot) {
    const base = U.mat4(x, 0.24, z, 0, rot, 0);
    const put = function (mat, w, h, d, px, py, pz, r) {
      const g = U.roundedBox(w, h, d, r === undefined ? 0.06 : r);
      g.applyMatrix4(U.mat4(px, py, pz));
      g.applyMatrix4(base);
      kit.add(g, mat);
    };
    put(M.plinth, 13.2, 0.34, 2.3, 0, 0.62, 0, 0.08);
    put(M.blue, 2.6, 2.5, 2.35, 5.6, 1.6, 0, 0.16);
    put(M.plinth, 1.2, 0.6, 2.2, 4.2, 1.0, 0, 0.1);
    put(M.glass, 2.2, 0.9, 2.28, 5.9, 2.35, 0, 0.12);
    put(M.timber, 8.2, 0.22, 2.3, -1.2, 1.16, 0, 0.06);
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        put(M.steel, 0.12, 1.9, 0.12, -5.1 + i * 1.0, 2.2, sz * 1.1, 0.03);
      }
      for (const y of [1.6, 2.4, 3.1]) put(M.steel, 8.2, 0.1, 0.1, -1.2, y, sz * 1.1, 0.04);
    }
    put(M.steel, 0.12, 1.9, 2.3, -5.2, 2.2, 0, 0.03);
    for (const wx of [5.6, -4.4, -3.0]) {
      for (const wz of [-1.16, 1.16]) {
        const g = new THREE.CylinderGeometry(0.66, 0.66, 0.42, 16);
        g.applyMatrix4(U.mat4(0, 0, 0, Math.PI / 2, 0, 0));
        g.applyMatrix4(U.mat4(wx, 0.9, wz));
        g.applyMatrix4(base);
        kit.add(g, M.plinth);
      }
    }
  }

  /* ---------------- 精简生态停车场（缩小面积 + 留出 45% 空位与绿化岛） ---------------- */
  function buildParking(kit, M, world) {
    const P = L.market.parking;
    const st = P.stall || 3.0;
    const midZ = (P.z0 + P.z1) / 2;
    const aisle = P.aisle || 5.0;
    const rowD = Math.min(4.8, (P.z1 - P.z0 - aisle) / 2);
    const n = Math.floor((P.x1 - P.x0) / st);

    // 铺装与绿化镶边
    U.box(kit, M.asphalt, P.x1 - P.x0, 0.1, P.z1 - P.z0, (P.x0 + P.x1) / 2, 0.29, midZ, 0, 0, 0, 1.5);
    for (let i = 0; i <= n; i++) {
      const x = P.x0 + i * st;
      U.box(kit, M.line, 0.12, 0.03, rowD - 0.5, x, 0.36, P.z0 + rowD / 2, 0, 0, 0, 0.02);
      U.box(kit, M.line, 0.12, 0.03, rowD - 0.5, x, 0.36, P.z1 - rowD / 2, 0, 0, 0, 0.02);
    }

    // 留足空位（约 45% 空置），不再密密麻麻抢主景
    const order = [0, 1, 2, 4, 3, 1, 0, 5, 2, 0, 1, 4, 3, 2];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = P.x0 + st * (i + 0.5);
      for (const half of [0, 1]) {
        if ((i * 5 + half * 3) % 5 === 0 || (i * 2 + half * 7) % 4 === 1) { k++; continue; }
        const z = half === 0 ? P.z0 + rowD / 2 - 0.15 : P.z1 - rowD / 2 + 0.15;
        const rot = half === 0 ? 0 : Math.PI;
        if (!world.parkingSlots) world.parkingSlots = [];
        world.parkingSlots.push({
          x: x,
          y: 0.35,
          z: z,
          rot: rot,
          kind: FL.CAR_MODELS[order[k % order.length] % FL.CAR_MODELS.length],
        });
        k++;
      }
    }

    // 停车场东西两侧绿化隔离带
    for (const gx of [P.x0 - 2.6, P.x1 + 2.6]) {
      U.box(kit, M.concreteTrough, 2.2, 0.42, P.z1 - P.z0, gx, 0.42, midZ, 0, 0, 0, 0.4);
      U.box(kit, M.leafA, 1.6, 0.72, P.z1 - P.z0 - 1.2, gx, 0.88, midZ, 0, 0, 0, 0.3);
    }
    for (const lx of [P.x0 + 10, P.x1 - 10]) {
      U.cyl(kit, M.steel, 0.08, 0.1, 4.8, 8, lx, 2.6, P.z1 - 0.8);
      U.box(kit, M.lamp, 0.7, 0.15, 0.48, lx, 4.95, P.z1 - 0.8);
      glowSprite(world, 0xffd7a0, 2.0, lx, 4.95, P.z1 - 0.8, 0.75);
      world.pools.push({ x: lx, z: midZ, size: 12, warm: 0.7 });
    }
  }

  /* ---------------- 入口 ---------------- */
  FL.buildBuildings = function (kit, M, world) {
    M.warmGlow.userData.noShadow = true;
    M.lamp.userData.noShadow = true;
    M.redBeam.userData.noShadow = true;

    buildBarns(M, world);
    buildRamp(kit, M, world);
    buildWeigh(kit, M, world);
    buildGate(kit, M, world);
    buildPlantAndSilage(kit, M, world);
    buildDock(kit, M, world);
    buildLoader(kit, M, world, -114, 12, -Math.PI / 2);

    buildCompoundWall(kit, M, world);
    buildTradingCenter(kit, M, world);
    buildStaffOffice(kit, M, world);
    buildParking(kit, M, world);

    buildAO(world);
  };
