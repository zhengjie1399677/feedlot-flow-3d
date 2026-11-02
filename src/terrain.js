import * as THREE from 'three';
import { FL } from './fl.js';

/* ============================================================
 *  terrain.js — 场地之外的地形
 *  园区外 620m 草甸 + 土默川秋收农田远景：草甸 / 条田 + 农田防护林 +
 *  村庄 + 进场道路延伸。全部程序化，无外部素材。
 *  坐标：-z 为北，+x 为东（与 layout.js 一致）。
 * ============================================================ */
  const U = FL.U;

  const NEAR = 2600;        // 近场地形边长（米）：贴图 1.27 m/px
  const FAR = 7000;         // 远场兜底盘：靠雾吃成全雾色，接住地平线
  const Y_NEAR = -0.45;
  const Y_FAR = -0.85;

  // 秋收后的土默川：玉米茬的黄褐、翻耕的深褐、苜蓿的绿、盐碱的灰白
  const CROP = [
    '#79755a', '#84805f', '#6b6a52', '#8a866a', '#948f74',
    '#4b4738', '#413d30', '#575244',
    '#5c6647', '#525d3f', '#65704e', '#6e6f55',
    '#8d8a72',
  ];
  const TRACK = '#928c76';
  const TREELINE = ['#333d24', '#3b462a', '#2c351f'];

  // 园区外围的草甸：先铺一层低对比的草绿，再叠割草带和自然斑块。
  // 半径 620m，400m 内是实的，往外软过渡到原来的农田，避免整片地面变成
  // 一张纯绿色桌面，也让远处还保留土默川的田块和林带层次。
  const MEADOW = {
    base: '#73875a',
    shades: ['#667a4f', '#7d9064', '#5c7047', '#85976d', '#6b8054', '#70855d'],
    dry: '#8b8764',
    radius: 620,
    fade: 400,
  };

  /* ---------------- 贴图 ---------------- */
  function paintFields(S, span, seed) {
    const c = U.makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(seed);
    const m2px = S / span;
    const W = (m) => m * m2px;

    // 底色（干土）
    ctx.fillStyle = '#6e6a56';
    ctx.fillRect(0, 0, S, S);

    // 大块：农田基本建设留下的方田，每 400–600 米一条防护林
    const blocksX = [];
    for (let x = 0; x < S;) { blocksX.push(x); x += W(380 + rand() * 260); }
    blocksX.push(S);
    const blocksY = [];
    for (let y = 0; y < S;) { blocksY.push(y); y += W(380 + rand() * 260); }
    blocksY.push(S);

    // 条田：每块方田里再切成 40–80 米宽的窄条，方向随机横竖
    for (let bi = 0; bi < blocksX.length - 1; bi++) {
      for (let bj = 0; bj < blocksY.length - 1; bj++) {
        const x0 = blocksX[bi], x1 = blocksX[bi + 1];
        const y0 = blocksY[bj], y1 = blocksY[bj + 1];
        const horiz = rand() > 0.5;
        const base = CROP[(rand() * CROP.length) | 0];
        if (horiz) {
          for (let y = y0; y < y1;) {
            const h = Math.min(W(28 + rand() * 55), y1 - y);
            ctx.fillStyle = rand() > 0.42 ? base : CROP[(rand() * CROP.length) | 0];
            ctx.globalAlpha = 0.82 + rand() * 0.18;
            ctx.fillRect(x0, y, x1 - x0, h);
            y += h;
          }
        } else {
          for (let x = x0; x < x1;) {
            const w = Math.min(W(28 + rand() * 55), x1 - x);
            ctx.fillStyle = rand() > 0.42 ? base : CROP[(rand() * CROP.length) | 0];
            ctx.globalAlpha = 0.82 + rand() * 0.18;
            ctx.fillRect(x, y0, w, y1 - y0);
            x += w;
          }
        }
        ctx.globalAlpha = 1;
        // 田埂
        ctx.strokeStyle = 'rgba(120,104,74,0.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      }
    }

    // 田间的机耕路：先铺土色，再压一道车辙
    for (let i = 0; i < blocksX.length; i++) {
      const x = blocksX[i];
      ctx.strokeStyle = TRACK;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1.5, W(4));
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    }
    for (let i = 0; i < blocksY.length; i++) {
      const y = blocksY[i];
      ctx.strokeStyle = TRACK;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = Math.max(1.5, W(4));
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 农田防护林：沿方田界线成排的杨树，画成一串暗点
    function treeRow(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const step = Math.max(1.6, W(7));
      const n = Math.max(2, Math.round(len / step));
      const col = TREELINE[(rand() * TREELINE.length) | 0];
      ctx.fillStyle = col;
      for (let i = 0; i < n; i++) {
        if (rand() > 0.93) continue;          // 缺苗
        const t = i / n;
        const r = W(1.6 + rand() * 1.4);
        ctx.globalAlpha = 0.55 + rand() * 0.4;
        ctx.beginPath();
        ctx.arc(x0 + dx * t, y0 + dy * t, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < blocksX.length; i++) treeRow(blocksX[i], 0, blocksX[i], S);
    for (let i = 0; i < blocksY.length; i++) treeRow(0, blocksY[i], S, blocksY[i]);

    // 场区外围的草甸：盖住近处的条田，只留远处的农田
    paintMeadow(ctx, S, span, 5150);

    // 地面噪点
    for (let i = 0; i < 26000; i++) {
      const a = 0.05 + rand() * 0.14;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(30,24,12,' + a + ')' : 'rgba(226,214,180,' + a + ')';
      const s = 1 + rand() * 2.2;
      ctx.fillRect(rand() * S, rand() * S, s, s);
    }

    // 远处的村落（贴图里的小色块，近处的村庄另有几何体）
    for (let i = 0; i < 14; i++) {
      const cx = rand() * S, cy = rand() * S;
      const n = 5 + (rand() * 12) | 0;
      for (let k = 0; k < n; k++) {
        ctx.fillStyle = rand() > 0.5 ? '#4a3c36' : '#454440';
        const w = W(9 + rand() * 14), h = W(7 + rand() * 10);
        ctx.fillRect(cx + W((rand() - 0.5) * 150), cy + W((rand() - 0.5) * 110), w, h);
      }
      ctx.fillStyle = 'rgba(48,58,34,0.8)';
      for (let k = 0; k < 14; k++) {
        ctx.beginPath();
        ctx.arc(cx + W((rand() - 0.5) * 190), cy + W((rand() - 0.5) * 150), W(2 + rand() * 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 场地四周的接触阴影：把 254×194 的地台压进地里，别像块浮着的板
    (function () {
      const S2 = S;
      const sx = ((127 * 2) / NEAR) * S2;
      const sz = ((97 * 2) / NEAR) * S2;
      const cx = S2 / 2, cy = S2 / 2 + ((2) / NEAR) * S2;
      const pad = (18 / NEAR) * S2;
      const g2 = ctx.createRadialGradient(cx, cy, Math.min(sx, sz) * 0.42, cx, cy, Math.max(sx, sz) * 0.62 + pad * 2);
      g2.addColorStop(0, 'rgba(0,0,0,0.22)');
      g2.addColorStop(0.62, 'rgba(0,0,0,0.10)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - sx / 2 - pad * 2, cy - sz / 2 - pad * 2, sx + pad * 4, sz + pad * 4);
      ctx.clip();
      ctx.fillStyle = g2;
      ctx.fillRect(cx - sx / 2 - pad * 2, cy - sz / 2 - pad * 2, sx + pad * 4, sz + pad * 4);
      ctx.restore();
    })();

    // 边缘径向淡出：让近场贴图在 780m 外逐渐透明，交给远场底盘接住
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.30, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';

    return { canvas: c, m2px: m2px };
  }

  /* ---------------- 场区外围的草甸 ---------------- */
  function paintMeadow(ctx, S, span, seed) {
    const c = U.makeCanvas(S);
    const g = c.getContext('2d');
    const rand = U.rng(seed);
    const W = (m) => (m * S) / span;

    // 草地底色 + 大块深浅斑，避免均匀的“绿桌面”
    g.fillStyle = MEADOW.base;
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 110; i++) {
      const x = S * (0.5 + (rand() - 0.5) * 0.98);
      const y = S * (0.5 + (rand() - 0.5) * 0.98);
      g.globalAlpha = 0.08 + rand() * 0.16;
      g.fillStyle = MEADOW.shades[(rand() * MEADOW.shades.length) | 0];
      g.beginPath();
      g.ellipse(x, y, W(70 + rand() * 240), W(50 + rand() * 180), rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }

    // 小片干草，给绿色里留一点土默川的暖调
    for (let i = 0; i < 34; i++) {
      const x = S * (0.5 + (rand() - 0.5) * 0.92);
      const y = S * (0.5 + (rand() - 0.5) * 0.92);
      g.globalAlpha = 0.05 + rand() * 0.08;
      g.fillStyle = MEADOW.dry;
      g.beginPath();
      g.ellipse(x, y, W(35 + rand() * 150), W(25 + rand() * 100), rand() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }

    // 割草带：大尺度、低对比的斜向条纹，只在近处能读出来
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-0.18);
    for (let x = -S; x < S;) {
      const w = W(38 + rand() * 52);
      g.globalAlpha = 1;
      g.fillStyle = rand() > 0.5 ? 'rgba(240,246,224,0.035)' : 'rgba(18,32,20,0.045)';
      g.fillRect(x, -S, w, S * 2);
      x += w;
    }
    g.restore();

    // 细碎草屑
    for (let i = 0; i < 12000; i++) {
      const a = 0.04 + rand() * 0.1;
      g.globalAlpha = 1;
      g.fillStyle = rand() > 0.48 ? 'rgba(25,38,18,' + a + ')' : 'rgba(222,230,196,' + a + ')';
      const s = 1 + rand() * 2;
      g.fillRect(rand() * S, rand() * S, s, s);
    }

    // 软边遮罩：中心实、620m 外渐隐，交给原来的农田
    const cx = S / 2, cy = S / 2;
    const mask = g.createRadialGradient(cx, cy, W(MEADOW.fade), cx, cy, W(MEADOW.radius));
    mask.addColorStop(0, 'rgba(0,0,0,1)');
    mask.addColorStop(0.55, 'rgba(0,0,0,1)');
    mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in';
    g.fillStyle = mask;
    g.fillRect(0, 0, S, S);
    g.globalCompositeOperation = 'source-over';

    ctx.drawImage(c, 0, 0);
  }

  // 把世界坐标画到贴图上
  function worldToPx(px, span, S) {
    return function (wx, wz) {
      return [((wx + span / 2) / span) * S, ((wz + span / 2) / span) * S];
    };
  }

  /* ---------------- 场地自身的道路往外延伸 ---------------- */
  function paintRoads(ctx, S, span) {
    const P = worldToPx(0, span, S);
    // 进场道路：从西门往西接到县道，再折向西南
    const a = P(-127, 56), b = P(-420, 62), c = P(-760, 120), d = P(-1300, 210);
    ctx.strokeStyle = '#4a4640';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.4, (S / span) * 12);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]);
    ctx.quadraticCurveTo(P(-1000, 150)[0], P(-1000, 150)[1], d[0], d[1]);
    ctx.stroke();
    // 路面中线
    ctx.strokeStyle = 'rgba(190,178,140,0.30)';
    ctx.lineWidth = Math.max(0.8, (S / span) * 0.9);
    ctx.stroke();

    // 东北角出场道路：场内东侧道路在 (112, 96) 出北栅栏，场外这一段必须接上，
    // 否则空车从大门出去就是悬在田里（原来就是这里断的）
    const n0 = P(112, 96), n1 = P(116, 200), n2 = P(128, 420), n3 = P(168, 760);
    ctx.strokeStyle = '#4a4640';
    ctx.lineWidth = Math.max(2.4, (S / span) * 11);
    ctx.beginPath();
    ctx.moveTo(n0[0], n0[1]);
    ctx.bezierCurveTo(n1[0], n1[1], n2[0], n2[1], n3[0], n3[1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(190,178,140,0.28)';
    ctx.lineWidth = Math.max(0.8, (S / span) * 0.9);
    ctx.stroke();

    // 南边的县道：东西向穿过平原
    const S1 = P(-1400, 620), S2 = P(1400, 560);
    ctx.strokeStyle = '#48443e';
    ctx.lineWidth = Math.max(2.4, (S / span) * 10);
    ctx.beginPath(); ctx.moveTo(S1[0], S1[1]); ctx.lineTo(S2[0], S2[1]); ctx.stroke();

    // 北边一条便道
    const N1 = P(-1200, -700), N2 = P(1000, -820);
    ctx.strokeStyle = 'rgba(150,138,108,0.55)';
    ctx.lineWidth = Math.max(1.2, (S / span) * 5);
    ctx.beginPath(); ctx.moveTo(N1[0], N1[1]); ctx.lineTo(N2[0], N2[1]); ctx.stroke();
  }

  /* ---------------- 几何：杨树 / 村庄 ---------------- */
  function poplar(kit, mats, x, z, h, rand) {
    const y = Y_NEAR;
    // 毛白杨：干直、冠窄高，一层层往上收
    U.cyl(kit, mats.bark, 0.13, 0.24, h * 0.5, 5, x, y + h * 0.25, z);
    // 毛白杨的冠是又窄又高的一支，不是一团
    const layers = 3;
    for (let i = 0; i < layers; i++) {
      const t = i / layers;
      const r = (1.05 - t * 0.55) * (0.8 + rand() * 0.3);
      const hh = h * (0.32 + t * 0.12);
      const geo = new THREE.ConeGeometry(r, hh, 6);
      kit.add(geo, mats.leaf, U.mat4(x, y + h * (0.40 + t * 0.20), z, 0, rand() * 0.5, 0));
    }
  }

  function village(kit, mats, cx, cz, n, rand) {
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 120;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const w = 8 + rand() * 9;
      const d = 6 + rand() * 7;
      const h = 3.2 + rand() * 1.8;
      const yaw = (rand() > 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.16;
      // 院墙
      U.box(kit, mats.wallYard, w + 3.4, 1.9, d + 3.2, x, Y_NEAR + 0.95, z, 0, yaw, 0);
      // 正房（红砖灰顶）
      U.box(kit, mats.brick, w, h, d, x, Y_NEAR + h / 2, z, 0, yaw, 0);
      U.box(kit, mats.tile, w + 1.1, 0.55, d + 1.1, x, Y_NEAR + h + 0.28, z, 0, yaw, 0);
      // 院内杨树 / 柴垛
      if (rand() > 0.45) poplar(kit, mats, x + (rand() - 0.5) * 16, z + (rand() - 0.5) * 14, 7 + rand() * 5, rand);
    }
  }

  /* ---------------- 主入口 ---------------- */
  FL.createTerrain = function (scene, world) {
    const group = new THREE.Group();
    group.name = 'terrain';
    scene.add(group);

    const rand = U.rng(77123);

    const mats = {
      ground: new THREE.MeshStandardMaterial({ color: 0xbfc0a8, roughness: 1, metalness: 0, transparent: true, depthWrite: true }),
      far: new THREE.MeshStandardMaterial({ color: 0x7b8168, roughness: 1, metalness: 0 }),
      bark: new THREE.MeshStandardMaterial({ color: 0x5a5142, roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: 0x4b5734, roughness: 1 }),
      brick: new THREE.MeshStandardMaterial({ color: 0x70503f, roughness: 0.95 }),
      tile: new THREE.MeshStandardMaterial({ color: 0x4a4b48, roughness: 0.9 }),
      wallYard: new THREE.MeshStandardMaterial({ color: 0x746a56, roughness: 1 }),
    };

    // ---- 条田贴图 ----
    const S = 2048;
    const painted = paintFields(S, NEAR, 2601);
    paintRoads(painted.canvas.getContext('2d'), S, NEAR);
    const tex = U.makeTexture(painted.canvas, { aniso: 16 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    mats.ground.map = tex;

    // ---- 远场兜底：同一张田块图平铺 + 雾，负责在地平线附近吃成全雾色 ----
    const farGeo = new THREE.PlaneGeometry(FAR, FAR, 1, 1);
    mats.far.color.setHex(0x7b8168);
    const farMesh = new THREE.Mesh(farGeo, mats.far);
    farMesh.rotation.x = -Math.PI / 2;
    farMesh.position.y = Y_FAR;
    farMesh.receiveShadow = false;
    farMesh.castShadow = false;
    group.add(farMesh);

    // ---- 近场 ----
    const nearMesh = new THREE.Mesh(new THREE.PlaneGeometry(NEAR, NEAR, 1, 1), mats.ground);
    nearMesh.rotation.x = -Math.PI / 2;
    nearMesh.position.y = Y_NEAR;
    nearMesh.receiveShadow = true;
    nearMesh.castShadow = false;
    group.add(nearMesh);

    // ---- 近处几何：防护林 + 村庄 ----
    const kit = new U.Kit();
    // 场界外围的一圈杨树防护林（跟着围栏走，留出路口）
    const belt = [
      [-132, -104, -132, 92],      // 西
      [132, -104, 132, 92],        // 东
      [-132, -104, 128, -104],     // 北
      [-132, 100, 128, 100],       // 南
    ];
    for (const b of belt) {
      const [x0, z0, x1, z1] = b;
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 9);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        // 路口留空
        if (x < -120 && z > 40) continue;
        if (x > 105 && z > 70) continue;
        poplar(kit, mats, x + (rand() - 0.5) * 2.4, z + (rand() - 0.5) * 2.4, 10 + rand() * 6, rand);
      }
    }
    // 田间的成排杨树：几条平行林带，走向西北
    const lines = [
      { x: -300, z: -240, dx: 1, dz: 0.15, n: 26 },
      { x: -300, z: 300, dx: 1, dz: 0.1, n: 26 },
      { x: -360, z: -120, dx: 0.12, dz: 1, n: 20 },
      { x: 300, z: -260, dx: 1, dz: 0.12, n: 24 },
      { x: 320, z: 180, dx: 0.1, dz: 1, n: 18 },
    ];
    for (const ln of lines) {
      for (let i = 0; i < ln.n; i++) {
        const x = ln.x + ln.dx * i * 22;
        const z = ln.z + ln.dz * i * 22;
        if (Math.abs(x) < 145 && Math.abs(z) < 115) continue;
        poplar(kit, mats, x + (rand() - 0.5) * 2, z + (rand() - 0.5) * 2, 10 + rand() * 7, rand);
      }
    }
    // 村庄：西北方向一座，东边一座
    village(kit, mats, -430, -330, 22, rand);
    village(kit, mats, 460, 250, 14, rand);
    kit.build(group, { castShadow: false, receiveShadow: false });

    return {
      group: group,
      mats: mats,
      update: function () {},
    };
  };
