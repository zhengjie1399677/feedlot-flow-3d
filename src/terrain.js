import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FL } from './fl.js';

/* ============================================================
 *  terrain.js — 场地之外的地形（土默川草原牧场与远山缓坡）
 *  特点：
 *  - 园区周边 165×135m 保持绝对平整，向外平滑过渡到微起伏草甸与北侧远山轮廓
 *  - 去除机械硬边割草带、像素块村落与等距牙签杨树
 *  - 采用集群式多层次防护林与景观树丛，近场开启投射阴影
 * ============================================================ */
  const U = FL.U;

  const NEAR = 2600;
  const FAR = 7200;
  const Y_NEAR = -0.45;
  const Y_FAR = -1.2;

  const CROP = [
    '#7c7c5e', '#868464', '#6f7256', '#8d8b6f', '#929075',
    '#5e644a', '#555d43', '#666e50', '#73785a', '#7c8162',
  ];
  const TRACK = '#8e8975';
  const TREELINE = ['#3b4a2b', '#435231', '#334025'];

  const MEADOW = {
    base: '#6f8156',
    shades: ['#62744b', '#798b60', '#5b6d46', '#819168', '#687a51', '#738258'],
    dry: '#8b8864',
    radius: 760,
    fade: 440,
  };

  /* ---------------- 地形高度场（园区平整，外围缓坡 + 远山） ---------------- */
  function terrainHeight(wx, wz) {
    // 园区及外圈缓冲带保持完全平整，避免地面穿帮
    const dx = Math.max(0, Math.abs(wx) - 168);
    const dz = Math.max(0, Math.abs(wz) - 138);
    const dPad = Math.hypot(dx, dz);
    if (dPad <= 0) return Y_NEAR;

    // 进场/出场道路走廊压平（东北原开口已封闭）
    const nearWestRoad = wx < -120 && Math.abs(wz - (56 + (-wx - 127) * 0.13)) < 38;
    const nearEastRoad = wz > 90 && Math.abs(wx - (112 + (wz - 96) * 0.08)) < 34;
    let mask = U.smoothstep(0, 180, dPad);
    if (nearWestRoad || nearEastRoad) mask *= 0.15;

    // 柔和低频起伏（草原缓丘）
    const h1 = Math.sin(wx * 0.0042 + 0.7) * Math.cos(wz * 0.0038 - 0.4) * 5.8;
    const h2 = Math.sin(wx * 0.0085 - wz * 0.0065 + 1.2) * 2.6;
    const h3 = Math.cos((wx + wz) * 0.0024) * 4.2;

    // 北侧远景低山丘陵（呼和浩特/土默川北倚大青山意象），距园区 580m 外渐起
    const northDist = Math.max(0, -wz - 520);
    const northFactor = U.smoothstep(0, 680, northDist);
    const ridge = (
      Math.sin(wx * 0.0031 + 0.5) * 0.45 +
      Math.sin(wx * 0.0067 - 1.1) * 0.30 +
      Math.cos(wx * 0.0019 + wz * 0.002) * 0.25 + 1.0
    ) * 42 * northFactor;

    const undulate = (h1 + h2 + h3 + 4.5) * mask;
    return Y_NEAR + Math.max(0, undulate) + ridge;
  }

  /* ---------------- 贴图 ---------------- */
  function paintFields(S, span, seed) {
    const c = U.makeCanvas(S);
    const ctx = c.getContext('2d');
    const rand = U.rng(seed);
    const m2px = S / span;
    const W = (m) => m * m2px;

    ctx.fillStyle = '#6f7858';
    ctx.fillRect(0, 0, S, S);

    // 远处低对比条田（被草甸柔和遮罩在外围 440m 以外）
    const blocksX = [];
    for (let x = 0; x < S;) { blocksX.push(x); x += W(420 + rand() * 260); }
    blocksX.push(S);
    const blocksY = [];
    for (let y = 0; y < S;) { blocksY.push(y); y += W(420 + rand() * 260); }
    blocksY.push(S);

    for (let bi = 0; bi < blocksX.length - 1; bi++) {
      for (let bj = 0; bj < blocksY.length - 1; bj++) {
        const x0 = blocksX[bi], x1 = blocksX[bi + 1];
        const y0 = blocksY[bj], y1 = blocksY[bj + 1];
        const horiz = rand() > 0.5;
        const base = CROP[(rand() * CROP.length) | 0];
        if (horiz) {
          for (let y = y0; y < y1;) {
            const h = Math.min(W(45 + rand() * 75), y1 - y);
            ctx.fillStyle = rand() > 0.45 ? base : CROP[(rand() * CROP.length) | 0];
            ctx.globalAlpha = 0.72 + rand() * 0.2;
            ctx.fillRect(x0, y, x1 - x0, h);
            y += h;
          }
        } else {
          for (let x = x0; x < x1;) {
            const w = Math.min(W(45 + rand() * 75), x1 - x);
            ctx.fillStyle = rand() > 0.45 ? base : CROP[(rand() * CROP.length) | 0];
            ctx.globalAlpha = 0.72 + rand() * 0.2;
            ctx.fillRect(x, y0, w, y1 - y0);
            x += w;
          }
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(115,112,86,0.28)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x0 + 0.5, y0 + 0.5, x1 - x0 - 1, y1 - y0 - 1);
      }
    }

    // 淡机耕路与远景防护林点带
    ctx.strokeStyle = TRACK;
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < blocksX.length; i++) {
      ctx.lineWidth = Math.max(1.2, W(3.5));
      ctx.beginPath(); ctx.moveTo(blocksX[i], 0); ctx.lineTo(blocksX[i], S); ctx.stroke();
    }
    for (let i = 0; i < blocksY.length; i++) {
      ctx.lineWidth = Math.max(1.2, W(3.5));
      ctx.beginPath(); ctx.moveTo(0, blocksY[i]); ctx.lineTo(S, blocksY[i]); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    function treeRow(x0, y0, x1, y1) {
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      const step = Math.max(2.2, W(10));
      const n = Math.max(2, Math.round(len / step));
      ctx.fillStyle = TREELINE[(rand() * TREELINE.length) | 0];
      for (let i = 0; i < n; i++) {
        if (rand() > 0.85) continue;
        const t = i / n;
        const r = W(1.8 + rand() * 1.8);
        ctx.globalAlpha = 0.35 + rand() * 0.25;
        ctx.beginPath();
        ctx.arc(x0 + dx * t, y0 + dy * t, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    for (let i = 0; i < blocksX.length; i++) treeRow(blocksX[i], 0, blocksX[i], S);
    for (let i = 0; i < blocksY.length; i++) treeRow(0, blocksY[i], S, blocksY[i]);

    // 场区外围的有机草甸（无硬边割草条、无像素方块村庄）
    paintMeadow(ctx, S, span, 5150);

    // 细颗粒草地与泥土肌理
    for (let i = 0; i < 36000; i++) {
      const a = 0.04 + rand() * 0.11;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(28,34,18,' + a + ')' : 'rgba(220,216,184,' + a + ')';
      const s = 1 + rand() * 2.0;
      ctx.fillRect(rand() * S, rand() * S, s, s);
    }

    // 场地四周柔和接触暗影，让地台自然嵌进大地
    (function () {
      const sx = ((127 * 2) / NEAR) * S;
      const sz = ((97 * 2) / NEAR) * S;
      const cx = S / 2, cy = S / 2 + (2 / NEAR) * S;
      const pad = (22 / NEAR) * S;
      const g2 = ctx.createRadialGradient(cx, cy, Math.min(sx, sz) * 0.42, cx, cy, Math.max(sx, sz) * 0.65 + pad * 2);
      g2.addColorStop(0, 'rgba(0,0,0,0.20)');
      g2.addColorStop(0.65, 'rgba(0,0,0,0.08)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save();
      ctx.beginPath();
      ctx.rect(cx - sx / 2 - pad * 2, cy - sz / 2 - pad * 2, sx + pad * 4, sz + pad * 4);
      ctx.clip();
      ctx.fillStyle = g2;
      ctx.fillRect(cx - sx / 2 - pad * 2, cy - sz / 2 - pad * 2, sx + pad * 4, sz + pad * 4);
      ctx.restore();
    })();

    // 外缘平滑淡出到远景盘
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.30, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.58, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';

    return { canvas: c, m2px: m2px };
  }

  /* ---------------- 有机牧场草甸 ---------------- */
  function paintMeadow(ctx, S, span, seed) {
    const c = U.makeCanvas(S);
    const g = c.getContext('2d');
    const rand = U.rng(seed);
    const W = (m) => (m * S) / span;

    g.fillStyle = MEADOW.base;
    g.fillRect(0, 0, S, S);

    // 多尺度柔边自然草斑（使用径向渐变消除任何生硬色块边界）
    for (let i = 0; i < 160; i++) {
      const x = S * (0.5 + (rand() - 0.5) * 0.96);
      const y = S * (0.5 + (rand() - 0.5) * 0.96);
      const rad = W(60 + rand() * 210);
      const col = MEADOW.shades[(rand() * MEADOW.shades.length) | 0];
      const grad = g.createRadialGradient(x, y, rad * 0.1, x, y, rad);
      grad.addColorStop(0, col);
      grad.addColorStop(1, 'rgba(111,129,86,0)');
      g.globalAlpha = 0.14 + rand() * 0.22;
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }

    // 暖调干草/沙土柔斑
    for (let i = 0; i < 60; i++) {
      const x = S * (0.5 + (rand() - 0.5) * 0.92);
      const y = S * (0.5 + (rand() - 0.5) * 0.92);
      const rad = W(40 + rand() * 140);
      const grad = g.createRadialGradient(x, y, 0, x, y, rad);
      grad.addColorStop(0, MEADOW.dry);
      grad.addColorStop(1, 'rgba(139,136,100,0)');
      g.globalAlpha = 0.08 + rand() * 0.14;
      g.fillStyle = grad;
      g.beginPath();
      g.arc(x, y, rad, 0, Math.PI * 2);
      g.fill();
    }

    // 细碎草簇噪点
    g.globalAlpha = 1;
    for (let i = 0; i < 18000; i++) {
      const a = 0.04 + rand() * 0.09;
      g.fillStyle = rand() > 0.48 ? 'rgba(28,42,20,' + a + ')' : 'rgba(218,224,188,' + a + ')';
      const s = 1 + rand() * 2;
      g.fillRect(rand() * S, rand() * S, s, s);
    }

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

  function worldToPx(span, S) {
    return function (wx, wz) {
      return [((wx + span / 2) / span) * S, ((wz + span / 2) / span) * S];
    };
  }

  /* ---------------- 场外延伸道路 ---------------- */
  function paintRoads(ctx, S, span) {
    const P = worldToPx(span, S);
    const a = P(-127, 56), b = P(-420, 62), c = P(-760, 120), d = P(-1300, 210);
    ctx.strokeStyle = '#4e4b45';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2.4, (S / span) * 12);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.quadraticCurveTo(b[0], b[1], c[0], c[1]);
    ctx.quadraticCurveTo(P(-1000, 150)[0], P(-1000, 150)[1], d[0], d[1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(198,186,148,0.28)';
    ctx.lineWidth = Math.max(0.8, (S / span) * 0.9);
    ctx.stroke();

    const n0 = P(112, 95), n1 = P(115, 200), n2 = P(128, 420), n3 = P(168, 760);
    ctx.strokeStyle = '#4e4b45';
    ctx.lineWidth = Math.max(2.4, (S / span) * 11);
    ctx.beginPath();
    ctx.moveTo(n0[0], n0[1]);
    ctx.bezierCurveTo(n1[0], n1[1], n2[0], n2[1], n3[0], n3[1]);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(198,186,148,0.26)';
    ctx.lineWidth = Math.max(0.8, (S / span) * 0.9);
    ctx.stroke();

    const S1 = P(-1400, 620), S2 = P(1400, 560);
    ctx.strokeStyle = '#4a4741';
    ctx.lineWidth = Math.max(2.4, (S / span) * 10);
    ctx.beginPath(); ctx.moveTo(S1[0], S1[1]); ctx.lineTo(S2[0], S2[1]); ctx.stroke();
  }

  /* ---------------- 集群式自然林带点位 ---------------- */
  function buildTreeSpots(rand) {
    const spots = [];
    // 1) 园区外围四角与北侧防风林组团（错落有致，绝不等距插牙签）
    const groves = [
      // 北侧防护林带（错落三组，给牛舍与 TMR 当自然背景）
      { cx: -92, cz: -122, rx: 36, rz: 14, count: 14, kind: 'mix' },
      { cx: 18, cz: -126, rx: 48, rz: 16, count: 16, kind: 'mix' },
      { cx: 112, cz: -120, rx: 30, rz: 16, count: 12, kind: 'mix' },
      // 西北角与西南入口外侧绿带
      { cx: -152, cz: -66, rx: 16, rz: 36, count: 11, kind: 'poplar' },
      { cx: -150, cz: 10, rx: 14, rz: 24, count: 8, kind: 'broad' },
      { cx: -148, cz: 94, rx: 18, rz: 16, count: 7, kind: 'broad' },
      // 东侧防风林（避开出场口）
      { cx: 148, cz: -46, rx: 16, rz: 42, count: 13, kind: 'mix' },
      { cx: 150, cz: 38, rx: 16, rz: 28, count: 9, kind: 'broad' },
      // 南侧入口大道两侧稀疏景观树丛（留开正中视野）
      { cx: -74, cz: 118, rx: 28, rz: 12, count: 8, kind: 'broad' },
      { cx: 64, cz: 116, rx: 24, rz: 12, count: 7, kind: 'broad' },
      // 远景牧场散落树林（中远景增加层次）
      { cx: -260, cz: -210, rx: 55, rz: 26, count: 14, kind: 'poplar' },
      { cx: 280, cz: -230, rx: 60, rz: 28, count: 15, kind: 'mix' },
      { cx: 340, cz: 90, rx: 48, rz: 34, count: 12, kind: 'broad' },
      { cx: -280, cz: 210, rx: 50, rz: 30, count: 10, kind: 'broad' },
      { cx: 40, cz: -290, rx: 85, rz: 25, count: 16, kind: 'poplar' },
    ];

    for (const g of groves) {
      for (let i = 0; i < g.count; i++) {
        // 高斯近似聚集分布
        const a = rand() * Math.PI * 2;
        const r = Math.pow(rand(), 0.65);
        const x = g.cx + Math.cos(a) * g.rx * r;
        const z = g.cz + Math.sin(a) * g.rz * r;
        // 确保不侵占园区本体与道路
        if (Math.abs(x) < 131 && Math.abs(z) < 103) continue;
        if (x < -124 && Math.abs(z - 56) < 16) continue;
        if (z > 88 && Math.abs(x - 112) < 16) continue;

        const kind = g.kind === 'mix' ? (rand() > 0.45 ? 'broad' : 'poplar') : g.kind;
        const near = Math.hypot(x, z) < 235;
        spots.push({
          x: x,
          y: terrainHeight(x, z),
          z: z,
          rot: rand() * Math.PI * 2,
          scale: (kind === 'poplar' ? 0.85 : 0.78) + rand() * 0.58,
          kind: kind,
          near: near,
          tint: 0.88 + rand() * 0.24,
        });
      }
    }
    return spots;
  }

  /* 用 Blender 导出的自然树木 GLB 批量实例化铺设（加载失败时优雅兜底） */
  function populateTrees(group, spots) {
    const loader = new GLTFLoader();
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    function spawnKind(kind, url) {
      const list = spots.filter((s) => s.kind === kind);
      if (!list.length) return;

      loader.load(url, function (gltf) {
        const meshes = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse(function (o) {
          if (!o.isMesh) return;
          const geo = o.geometry.clone();
          geo.applyMatrix4(o.matrixWorld);
          const mat = o.material.clone();
          mat.roughness = Math.max(0.75, mat.roughness || 0.85);
          mat.metalness = 0.0;
          mat.envMapIntensity = 0.65;
          meshes.push({ geo, mat, isLeaf: !/bark|trunk/i.test((o.name || '') + (mat.name || '')) });
        });

        const nearList = list.filter((s) => s.near);
        const farList = list.filter((s) => !s.near);

        function addBatch(batch, castShadow) {
          if (!batch.length) return;
          for (const part of meshes) {
            const inst = new THREE.InstancedMesh(part.geo, part.mat, batch.length);
            inst.castShadow = castShadow;
            inst.receiveShadow = true;
            for (let i = 0; i < batch.length; i++) {
              const s = batch[i];
              dummy.position.set(s.x, s.y - 0.15, s.z);
              dummy.rotation.set(0, s.rot, 0);
              dummy.scale.set(s.scale, s.scale * (0.9 + (i % 5) * 0.05), s.scale);
              dummy.updateMatrix();
              inst.setMatrixAt(i, dummy.matrix);
              if (part.isLeaf) {
                color.setRGB(s.tint, s.tint * (0.96 + (i % 3) * 0.04), s.tint * 0.94);
                inst.setColorAt(i, color);
              }
            }
            inst.instanceMatrix.needsUpdate = true;
            if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
            group.add(inst);
          }
        }
        addBatch(nearList, true);
        addBatch(farList, false);
      }, undefined, function () {
        // 若 GLB 尚未导出，用多球冠低模优雅兜底
        const kit = new U.Kit();
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x4d3f32, roughness: 0.96 });
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x435732, roughness: 0.92 });
        const rand = U.rng(909);
        for (const s of list) {
          const h = (kind === 'poplar' ? 11 : 7.5) * s.scale;
          U.cyl(kit, barkMat, 0.18 * s.scale, 0.28 * s.scale, h * 0.45, 6, s.x, s.y + h * 0.22, s.z);
          for (let k = 0; k < 4; k++) {
            const r = (kind === 'poplar' ? 1.45 - k * 0.22 : 2.1 - k * 0.25) * s.scale;
            const g = new THREE.IcosahedronGeometry(r, 1);
            kit.add(g, leafMat, U.mat4(
              s.x + (rand() - 0.5) * r * 0.9,
              s.y + h * (0.48 + k * 0.14),
              s.z + (rand() - 0.5) * r * 0.9,
              rand(), rand(), rand()
            ));
          }
        }
        kit.build(group, { castShadow: true, receiveShadow: true });
      });
    }

    spawnKind('broad', 'models/tree_broad.glb');
    spawnKind('poplar', 'models/tree_poplar.glb');
  }

  /* ---------------- 主入口 ---------------- */
  FL.createTerrain = function (scene, world) {
    const group = new THREE.Group();
    group.name = 'terrain';
    scene.add(group);

    const rand = U.rng(77123);

    const mats = {
      ground: new THREE.MeshStandardMaterial({
        color: 0xc2c5ae, roughness: 0.98, metalness: 0,
        transparent: true, depthWrite: true, envMapIntensity: 0.45,
      }),
      far: new THREE.MeshStandardMaterial({
        color: 0x7b8368, roughness: 1, metalness: 0, envMapIntensity: 0.35,
      }),
    };

    const S = 2048;
    const painted = paintFields(S, NEAR, 2601);
    paintRoads(painted.canvas.getContext('2d'), S, NEAR);
    const tex = U.makeTexture(painted.canvas, { aniso: 16 });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    mats.ground.map = tex;

    // 远场兜底盘
    const farMesh = new THREE.Mesh(new THREE.PlaneGeometry(FAR, FAR, 1, 1), mats.far);
    farMesh.rotation.x = -Math.PI / 2;
    farMesh.position.y = Y_FAR;
    farMesh.receiveShadow = false;
    farMesh.castShadow = false;
    group.add(farMesh);

    // 近场微起伏地形（84×84 细分）
    const nearGeo = new THREE.PlaneGeometry(NEAR, NEAR, 84, 84);
    nearGeo.rotateX(-Math.PI / 2);
    const pos = nearGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i), wz = pos.getZ(i);
      pos.setY(i, terrainHeight(wx, wz));
    }
    nearGeo.computeVertexNormals();

    const nearMesh = new THREE.Mesh(nearGeo, mats.ground);
    nearMesh.receiveShadow = true;
    nearMesh.castShadow = false;
    group.add(nearMesh);

    // 集群式自然树木
    const spots = buildTreeSpots(rand);
    populateTrees(group, spots);

    return {
      group: group,
      mats: mats,
      heightAt: terrainHeight,
      update: function () {},
    };
  };
