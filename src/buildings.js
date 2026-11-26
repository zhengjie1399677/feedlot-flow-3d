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
          if (/SprayPoly|WindMesh|ClerestoryPoly/i.test(nm + (m.name || ''))) {
            m.transparent = true;
            m.opacity = /WindMesh/i.test(nm + (m.name || '')) ? 0.28 : (/Clerestory/i.test(nm + (m.name || '')) ? 0.48 : 0.34);
            m.depthWrite = false;
            o.castShadow = false;
          }
          o.material = m;
        }

        // 自发光材质接入昼夜循环（但室内电脑屏幕与行情大屏白天营业也保持常亮！）
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0.01) {
          const alwaysOn = /Board|PC|Screen/i.test(nm + (m.name || ''));
          if (!alwaysOn) {
            const baseI = m.emissiveIntensity != null ? m.emissiveIntensity : 1.5;
            world.glbGlowMats.push({ mat: m, base: baseI });
          } else {
            m.emissiveIntensity = 1.35;
          }
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
    const mat = U.signMaterial(tex, 1, false, !!opts.doubleSide);
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
    ao(world, 28.0, 22.0, -97, -40, 0.34);             // TMR 配料车间（后移北侧）
    ao(world, 11.0, 11.0, -104, -65, 0.28);            // 3 座筒仓
    ao(world, 11.0, 11.0, -91, -65, 0.28);
    ao(world, 11.0, 11.0, -78, -65, 0.28);
    ao(world, 32.0, 18.0, -98, -4, 0.30);              // 双联扶壁式青贮窖（后移北侧）
    ao(world, 25.0, 15.0, -80, 56, 0.28);              // 100t 地磅棚
    ao(world, 15.0, 11.0, -104.5, 56, 0.24);           // 全尺寸雾化消毒通道
    ao(world, 20.0, 10.0, 112, 89.5, 0.28);            // 东南出园大门 + 检疫岗亭
    ao(world, 15.0, 15.0, -46, -64, 0.26);             // 卸牛台
    ao(world, 12.0, 17.0, 103.5, -69, 0.28);           // 装车台
    const mk = L.market;
    ao(world, mk.hall.w + 4.0, mk.hall.d + 4.0, mk.hall.cx, mk.hall.cz, 0.30);
    ao(world, mk.office.w + 4.5, mk.office.d + 4.5, mk.office.cx, mk.office.cz, 0.28);
  }

  /* ---------------- 自然散堆起伏 TMR 日粮垄几何（彻底替代直角绿方块） ---------------- */
  function buildTmrWindrowGeo(len, maxW, maxH, seed) {
    const nx = 78, nz = 10;
    const pos = [];
    const uvs = [];
    const cols = [];
    const idx = [];
    const s1 = seed * 1.73 + 0.5;
    const s2 = seed * 3.17 + 2.1;

    for (let ix = 0; ix <= nx; ix++) {
      const u = ix / nx;
      const x = (u - 0.5) * len;
      // 两端自然斜坡收尾（约 1.3m），彻底消除生硬直角端面
      const edgeDist = Math.min(u, 1 - u) * len;
      const endFade = Math.min(1, edgeDist / 1.35);
      const endSmooth = endFade * endFade * (3 - 2 * endFade);

      // 沿长度方向的自然堆高波浪起伏 + 轻微采食凹坑
      const ridgeWave =
        0.78 +
        0.15 * Math.sin(u * 19.0 + s1) +
        0.10 * Math.cos(u * 41.0 + s2) +
        0.05 * Math.sin(u * 88.0 + s1 * 2.1);

      // 宽度边界自然不规则抖动，不再笔直成一条尺子线
      const halfW = maxW * 0.5 * (0.86 + 0.10 * Math.sin(u * 27.0 + s2) + 0.05 * Math.cos(u * 61.0 + s1)) * (0.35 + 0.65 * endSmooth);

      for (let iz = 0; iz <= nz; iz++) {
        const v = (iz / nz) * 2 - 1; // -1 .. +1
        const av = Math.abs(v);
        const z = v * halfW;

        // 柔和尖顶散料垄断面（自然安息角，边缘贴地为 0）
        let profile = Math.pow(Math.max(0, 1 - Math.pow(av, 1.55)), 1.12);
        // 表面鲜明的草料团块起伏，拒绝平滑枕头感
        const clump =
          0.075 * Math.sin(x * 3.8 + v * 3.4 + s1) * Math.cos(x * 2.5 - v * 4.2 + s2) +
          0.045 * Math.sin(x * 10.7 + v * 6.5 + s2) +
          0.025 * Math.cos(x * 19.3 - v * 8.1 + s1);
        const y = Math.max(0, (profile * ridgeWave * maxH + clump * Math.pow(profile, 0.75)) * endSmooth);

        pos.push(x, y, z);
        uvs.push(x / 1.25, z / 1.25);

        // 顶点色层次：垄顶温暖金褐、沟谷与底边深暗湿料，立体阴影对比更真实
        const hNorm = Math.min(1, y / (maxH * 0.85));
        const mottling = 0.90 + 0.10 * Math.sin(x * 6.2 + v * 5.3 + s2);
        const bright = (0.52 + 0.48 * hNorm) * mottling;
        cols.push(
          Math.min(1.0, bright * 1.04),
          Math.min(0.96, bright * 0.96),
          Math.min(0.84, bright * 0.80)
        );
      }
    }

    const row = nz + 1;
    for (let ix = 0; ix < nx; ix++) {
      for (let iz = 0; iz < nz; iz++) {
        const a = ix * row + iz;
        const b = (ix + 1) * row + iz;
        const c = (ix + 1) * row + (iz + 1);
        const d = ix * row + (iz + 1);
        idx.push(a, d, b, b, d, c);
      }
    }

    // 额外在垄脊与边坡撒布 56 处不规则散落草团碎块（彻底打破几何规整感）
    let rSeed = Math.floor(seed * 997) + 13;
    const rnd = () => { rSeed = (rSeed * 1103515245 + 12345) % 2147483648; return rSeed / 2147483648; };
    for (let t = 0; t < 56; t++) {
      const tx = (rnd() - 0.5) * (len - 2.4);
      const tz = (rnd() - 0.5) * (maxW * 0.72);
      const radX = 0.14 + rnd() * 0.20;
      const radZ = 0.10 + rnd() * 0.15;
      const radY = 0.08 + rnd() * 0.11;
      const u = tx / len + 0.5;
      const av = Math.min(1, Math.abs(tz) / (maxW * 0.5));
      const baseY = Math.pow(Math.max(0, 1 - Math.pow(av, 1.55)), 1.12) * maxH * 0.72;
      const v0 = pos.length / 3;
      const br = 0.68 + rnd() * 0.30;
      const pts = [
        [tx, baseY + radY, tz],
        [tx + radX, baseY - 0.03, tz + radZ * 0.2],
        [tx - radX * 0.2, baseY - 0.03, tz + radZ],
        [tx - radX, baseY - 0.03, tz - radZ * 0.3],
        [tx + radX * 0.3, baseY - 0.03, tz - radZ],
      ];
      for (const p of pts) {
        pos.push(p[0], Math.max(0.01, p[1]), p[2]);
        uvs.push(p[0] / 1.25, p[2] / 1.25);
        cols.push(br * 1.02, br * 0.94, br * 0.78);
      }
      idx.push(v0, v0 + 2, v0 + 1, v0, v0 + 3, v0 + 2, v0, v0 + 4, v0 + 3, v0, v0 + 1, v0 + 4);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /* ---------------- 6 栋育肥牛舍（Blender barn.glb 实例化 + 动态自然散堆 TMR 料垄） ---------------- */
  function buildBarns(M, world) {
    // 动态料槽日粮散料垄（与 TMR 投料进度实时联动）
    for (const b of L.barns) {
      const tz = b.mirror ? b.cz - b.dep / 2 - 1.28 : b.cz + b.dep / 2 + 1.28;
      const tlen = b.len - 6.0;
      const pileGeo = buildTmrWindrowGeo(tlen, 1.44, 0.56, b.idx * 2.3 + 1.1);
      const pile = new THREE.Mesh(pileGeo, M.feedPile || M.feed);
      pile.position.set(b.cx, 0.55, tz);
      pile.scale.y = 0.85;
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

  /* ---------------- 100t 电子地磅棚 + 玻璃磅房（Blender weighbridge.glb） ---------------- */
  function buildWeigh(kit, M, world) {
    const x = L.slots.weighbridge.x, z = L.slots.weighbridge.z;
    loadBuildingGLB('models/weighbridge.glb', world, function (root) {
      root.position.set(x, 0, z);
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/ClearGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.34;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.45;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });
    // 紧贴南侧深色挑檐额板的电子称重显示屏（单面 FrontSide，绝不反字）
    sign(world, '38.62 t · 24 头  已放行', 'WEIGHBRIDGE · 100t', 7.8, 1.42, x, 6.92, z + 6.36, 0,
      { size: 68, subSize: 28, color: '#ffcf8f', bg: 'rgba(10,13,17,0.94)', border: 'rgba(255,176,88,0.42)', doubleSide: false });
    world.pools.push({ x: x, z: z, size: 30, warm: 0.95 });
  }

  /* ---------------- 西大门 + 现代门卫房 + 全尺寸车辆雾化消毒通道（Blender disinfect_gate.glb + 动态道闸） ---------------- */
  function buildGate(kit, M, world) {
    const g = L.slots.gate;

    loadBuildingGLB('models/disinfect_gate.glb', world, function (root) {
      root.position.set(g.x, 0, g.z);
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/ClearGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.34;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.45;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });

    // 门头主标牌（内外双面正向嵌于门头横梁 x = g.x ± 1.92，进场和场内都清晰可见）
    sign(world, '草都草牧业 · 育肥一场', 'CAODU GRASS & LIVESTOCK · FEEDLOT 01', 14.2, 1.65, g.x - 1.92, 7.65, g.z, -Math.PI / 2,
      { size: 76, subSize: 28, bg: 'rgba(14,19,24,0.94)', border: 'rgba(255,196,120,0.40)', color: '#f4e4cb', doubleSide: false });
    sign(world, '草都草牧业 · 育肥一场', 'CAODU GRASS & LIVESTOCK · FEEDLOT 01', 14.2, 1.65, g.x + 1.92, 7.65, g.z, Math.PI / 2,
      { size: 76, subSize: 28, bg: 'rgba(14,19,24,0.94)', border: 'rgba(255,196,120,0.40)', color: '#f4e4cb', doubleSide: false });

    // 动态道闸（位于大门内侧与 12m 消毒通道入口之间，有车接近自动抬杆）
    const bx = g.x + 3.8, bz = g.z + 5.5;
    U.box(kit, M.steel, 0.5, 1.35, 0.5, bx, 0.85, bz);
    U.box(kit, M.yellow, 0.58, 0.22, 0.58, bx, 1.56, bz);
    const arm = new THREE.Group();
    arm.position.set(bx, 1.56, bz);
    const armKit = new U.Kit();
    const armLen = 7.4, seg = armLen / 7;
    for (let i = 0; i < 7; i++) {
      U.box(armKit, i % 2 ? M.red : M.line, 0.12, 0.12, seg * 0.96, 0, 0, -(i + 0.5) * seg);
    }
    armKit.add(new THREE.BoxGeometry(0.16, 0.16, 0.5), M.steel, U.mat4(0, 0, -0.2));
    armKit.build(arm);
    arm.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    world.group.add(arm);
    world.gateArm = arm;
    world.gatePoint = { x: bx, z: bz };

    world.pools.push({ x: g.x, z: g.z, size: 22, warm: 0.75 });
    world.pools.push({ x: g.x + 12.5, z: g.z, size: 20, warm: 0.35 });
  }

  /* ---------------- 东南出园大门 + 检疫放行岗亭（Blender exit_gate.glb + 动态出园道闸） ---------------- */
  function buildExitGate(kit, M, world) {
    const eg = L.slots.exitGate;
    loadBuildingGLB('models/exit_gate.glb', world, function (root) {
      root.position.set(eg.x, 0, eg.z);
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/ClearGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.34;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.45;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });

    // 出园大门内外双面单向标牌（FrontSide，绝不镜像反字！）
    // 北面（面向园内 -z，出场车辆迎面可见）
    sign(world, '出场通道 · 检疫放行', 'EXIT GATE · QUARANTINE CHECKPOINT', 12.2, 1.38, eg.x, 7.52, eg.z - 2.24, Math.PI, {
      size: 52, subSize: 20, bg: 'rgba(14,19,24,0.94)', border: 'rgba(110,235,160,0.45)',
      color: '#eef8f2', subColor: 'rgba(165,232,195,0.82)', doubleSide: false,
    });
    // 南面（面向场外 +z，全景镜头清晰可见）
    sign(world, '草都草牧业 · 出栏专口', 'CAODU FEEDLOT · OUTBOUND EXIT', 12.2, 1.38, eg.x, 7.52, eg.z + 2.24, 0, {
      size: 52, subSize: 20, bg: 'rgba(14,19,24,0.94)', border: 'rgba(255,196,120,0.42)',
      color: '#f4e4cb', subColor: 'rgba(220,210,190,0.80)', doubleSide: false,
    });

    // 动态出园道闸（位于西侧岗亭前 x = eg.x - 5.6, z = eg.z - 3.3，有出场车接近自动抬杆）
    const bx = eg.x - 5.6, bz = eg.z - 3.3;
    U.box(kit, M.steel, 0.5, 1.35, 0.5, bx, 0.85, bz);
    U.box(kit, M.yellow, 0.58, 0.22, 0.58, bx, 1.56, bz);
    const arm = new THREE.Group();
    arm.position.set(bx, 1.56, bz);
    const armKit = new U.Kit();
    const armLen = 7.6, seg = armLen / 7;
    for (let i = 0; i < 7; i++) {
      U.box(armKit, i % 2 ? M.red : M.line, seg * 0.96, 0.12, 0.12, (i + 0.5) * seg, 0, 0);
    }
    armKit.add(new THREE.BoxGeometry(0.5, 0.16, 0.16), M.steel, U.mat4(0.2, 0, 0));
    armKit.build(arm);
    arm.traverse(function (o) { if (o.isMesh) o.castShadow = true; });
    world.group.add(arm);
    world.exitGateArm = arm;
    world.exitGatePoint = { x: eg.x, z: bz };

    world.pools.push({ x: eg.x, z: eg.z, size: 22, warm: 0.85 });
  }

  /* ---------------- TMR 配料中心 + 三筒仓（Blender tmr_complex.glb） + 双联青贮窖（silage_bunker.glb） ---------------- */
  function buildPlantAndSilage(kit, M, world) {
    loadBuildingGLB('models/tmr_complex.glb', world, function (root) {
      root.position.set(-97, 0, -40);
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/ControlGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.38;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.45;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });
    // 东侧装料雨棚挑檐正立面单面标牌（FrontSide，绝不反字）
    sign(world, 'TMR 智能配料中心', 'TOTAL MIXED RATION PLANT', 9.8, 1.05, -76.22, 6.72, -38.0, Math.PI / 2, {
      size: 74, subSize: 28, bg: 'rgba(14,19,24,0.94)', border: 'rgba(165,220,140,0.42)',
      color: '#eef6fa', subColor: 'rgba(180,218,175,0.82)', doubleSide: false,
    });
    world.pools.push({ x: -80.8, z: -38, size: 24, warm: 1 });
    world.pools.push({ x: -91, z: -54, size: 18, warm: 0.45 });

    // 双联扶壁式混凝土青贮窖（Blender 精模 silage_bunker.glb，整体向北后移至 z = -4）
    loadBuildingGLB('models/silage_bunker.glb', world, function (root) {
      root.position.set(-98, 0, -4);
      tuneGlbRoot(root, world);
      world.group.add(root);
    });
    world.pools.push({ x: -84.5, z: -7.5, size: 22, warm: 0.65 });
  }

  /* ---------------- 装载机（开源高精度 CAT 982M 轮式装载机 GLB） ---------------- */
  function buildLoader(kit, M, world, x, z, ry) {
    loadBuildingGLB('models/wheel_loader.glb', world, function (root) {
      root.position.set(x, 0.22, z);
      root.rotation.y = ry;
      root.scale.setScalar(0.84);
      tuneGlbRoot(root, world);
      world.group.add(root);
    });
    ao(world, 7.2, 3.4, x, z, 0.30, ry);
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

    // 加载 Blender 现代化落地玻璃交易结算大厅（内含 6 窗口电脑工位、签约洽谈区与电子行情大屏）
    loadBuildingGLB('models/trading_hall.glb', world, function (root) {
      root.position.set(cx, 0, cz);
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/ClearGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.24;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.5;
          o.castShadow = false;
        } else if (/FrostedGlass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = 0.52;
          o.material.depthWrite = false;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });

    // 单面正向嵌入南侧挑檐实体灯箱上的大厅标牌（FrontSide，绝不反字）
    sign(world, '活牛交易结算大厅', 'LIVE CATTLE TRADING & SETTLEMENT HALL', 14.2, 1.45, cx, 8.52, cz + Hh.d / 2 + 4.10, 0, {
      size: 82, subSize: 28, bg: 'rgba(14,19,24,0.94)', border: 'rgba(130,210,235,0.45)',
      color: '#eef6fa', subColor: 'rgba(175,216,232,0.82)', doubleSide: false,
    });
    world.pools.push({ x: cx, z: cz + Hh.d / 2 + 4.5, size: 30, warm: 0.95 });
    world.pools.push({ x: cx, z: cz, size: 28, warm: 0.85 });

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
    parkedStockTruck(world, R.x + 8.6, R.z - 0.4, 0);

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

    // 广场照明路灯（去掉原广场中央突兀的方块花坛，保持交易大厅前场开阔整洁）
    for (const lp of [[-32, 26], [16, 28], [32, 16]]) {
      U.cyl(kit, M.steel, 0.09, 0.12, 5.0, 8, lp[0], 2.7, lp[1]);
      U.box(kit, M.lamp, 0.85, 0.16, 0.55, lp[0], 5.2, lp[1]);
      glowSprite(world, 0xffd7a0, 2.4, lp[0], 5.2, lp[1], 0.8);
      world.pools.push({ x: lp[0], z: lp[1], size: 13, warm: 0.75 });
    }
  }

  /* ---------------- 办公宿舍综合楼（Blender 精模 office.glb，两层 44×13.6m）
   *  朝向：北立面（-z）为主入口，直面园区主干道（z=48）；南立面（+z）为员工宿舍向阳阳台与庭院绿地
   * ------------------------------------------------------------------------ */
  function buildStaffOffice(kit, M, world) {
    const O = L.market.office;
    const cx = O.cx, cz = O.cz;

    loadBuildingGLB('models/office.glb', world, function (root) {
      root.position.set(cx, 0, cz);
      root.rotation.y = O.rot || 0;
      tuneGlbRoot(root, world);
      // 保留玻璃/阳台护栏的柔和通透感，同时增强反射
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/Glass/i.test(mn)) {
          o.material.transparent = true;
          o.material.opacity = /Balcony/i.test(mn) ? 0.36 : 0.62;
          o.material.depthWrite = false;
          o.material.envMapIntensity = 1.45;
          o.castShadow = false;
        }
      });
      world.group.add(root);
    });

    // 楼顶实体灯箱正反双面单向标牌（FrontSide，绝不出现背面镜像反字！）
    // Blender 灯箱位于 local x = -11.5, y = 0, z = 10.03（厚 0.46m），对应 Three.js (cx - 11.5, 10.03, cz ± 0.25)
    const signX = cx - 11.5;
    const signY = 10.03;
    const signCfg = {
      size: 74, subSize: 26, bg: 'rgba(18,23,28,0.94)', border: 'rgba(180,215,235,0.34)',
      color: '#f0f6fa', subColor: 'rgba(195,216,230,0.80)', doubleSide: false,
    };
    // 北面（面向主干道 -z）
    sign(world, '草都草牧业股份有限公司', 'CAODU GRASS ANIMAL HUSBANDRY CO., LTD.', 14.8, 1.72, signX, signY, cz - 0.25, Math.PI, signCfg);
    // 南面（面向南侧全景机位 +z）
    sign(world, '草都草牧业股份有限公司', 'CAODU GRASS ANIMAL HUSBANDRY CO., LTD.', 14.8, 1.72, signX, signY, cz + 0.25, 0, signCfg);

    // 北侧主入口广场（衔接 z=48 主干道南缘 z=53.5 到楼前主入口 z=65.2，平整落客区 + 旗阵）
    U.box(kit, M.apron, 54, 0.14, 13.5, cx, 0.21, cz - 12.6, 0, 0, 0, 0.6);
    // 入口落客步道引导线
    U.box(kit, M.apronEdge, 14, 0.04, 11.5, cx - 11.5, 0.285, cz - 12.6, 0, 0, 0, 0.2);
    // 北广场东侧三根旗杆（立在办公区主入口东侧广场，不遮挡大门、面向主干道）
    for (const fx of [cx - 3.2, cx - 0.8, cx + 1.6]) {
      const fz = cz - 15.2;
      U.cyl(kit, M.concreteTrough, 0.42, 0.50, 0.36, 12, fx, 0.38, fz);
      U.cyl(kit, M.steelLight, 0.06, 0.085, 9.2, 8, fx, 4.9, fz);
      U.box(kit, fx === cx - 0.8 ? M.red : M.blue, 1.45, 0.88, 0.05, fx + 0.74, 8.85, fz, 0, 0.18, 0);
    }
    // 入口与楼梯间夜间暖光池
    world.pools.push({ x: cx - 11.5, z: cz - 9.8, size: 22, warm: 0.95 });
    world.pools.push({ x: cx + 10.5, z: cz - 8.4, size: 14, warm: 0.75 });
  }

  /* 静态停放的一台高栏活牛运输车（交易区装车坡道旁 · Blender Freightliner FL70 精模） */
  function parkedStockTruck(world, x, z, rot) {
    loadBuildingGLB('models/stock_truck.glb', world, function (root) {
      root.position.set(x, 0.24, z);
      root.rotation.y = rot + Math.PI / 2;
      tuneGlbRoot(root, world);
      root.traverse(function (o) {
        if (!o.isMesh || !o.material) return;
        const mn = o.material.name || '';
        if (/^TruckPaint/i.test(mn)) o.material.color.setHex(0x4e7394);
        else if (/^TruckAccent/i.test(mn)) o.material.color.setHex(0xdcb86a);
      });
      world.group.add(root);
    });
    ao(world, 13.4, 3.6, x, z, 0.32, rot);
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
    buildExitGate(kit, M, world);
    buildPlantAndSilage(kit, M, world);
    buildDock(kit, M, world);
    buildLoader(kit, M, world, -86.8, -8.2, -Math.PI / 2);

    buildCompoundWall(kit, M, world);
    buildTradingCenter(kit, M, world);
    buildStaffOffice(kit, M, world);
    buildParking(kit, M, world);

    buildAO(world);
  };
