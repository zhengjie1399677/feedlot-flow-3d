import * as THREE from 'three';
import { FL } from './fl.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

/* ============================================================
 *  cows.js — 开源写实多姿态肉牛群（BlenderKit Royalty-Free 源模 + 自绑四足骨骼）
 *  - models/cow_realistic.glb : 绑定四足骨骼与 Idle / Walk 动画（用于走动与活跃牛）
 *  - models/cow_poses.glb     : 4 种真实静态姿态（Cow_Stand / Cow_Graze / Cow_Lie / Cow_Look）
 *  - 双毛色真皮毛贴图（西门塔尔黄褐白花 + 自然深褐白花），避免牛群千篇一律
 * ============================================================ */
  const MODEL_RIG   = 'models/cow_realistic.glb';
  const MODEL_POSES = 'models/cow_poses.glb';
  const YAW_FIX = 0;

  function makeCoatMaterials() {
    const texLoader = new THREE.TextureLoader();
    const mk = (url) => {
      const tex = texLoader.load(url);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.anisotropy = 8;
      return new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.88,
        metalness: 0.0,
        envMapIntensity: 0.55,
      });
    };
    return [
      mk('textures/cow_hide_simmental.jpg'), // 西门塔尔黄褐花（主力肉牛）
      mk('textures/cow_hide_brown.jpg'),     // 自然深褐花（混群层次）
    ];
  }

  function applyCoat(rootObj, mat) {
    rootObj.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      o.material = mat;
    });
  }

  FL.buildHerd = function (scene, spots) {
    const group = new THREE.Group();
    group.name = 'herd';
    scene.add(group);
    if (!spots || !spots.length) return group;

    const coats = makeCoatMaterials();
    const mixers = [];
    const walkers = [];
    const breathers = [];
    let lastT = 0;

    const loader = new GLTFLoader();
    let rigGltf = null;
    let posesGltf = null;
    let built = false;

    function tryAssemble() {
      if (built || !rigGltf || !posesGltf) return;
      built = true;

      const rigSrc = rigGltf.scene;
      const anims = rigGltf.animations || [];
      const clipOf = function (re, fallback) {
        const c = anims.find(function (a) { return re.test(a.name); });
        return c || fallback || anims[0];
      };
      const cIdle = clipOf(/idle/i, anims[0]);
      const cWalk = clipOf(/walk/i, cIdle);

      const poseMap = {};
      posesGltf.scene.traverse(function (o) {
        if (o.isMesh && /^Cow_/i.test(o.name)) {
          poseMap[o.name] = o;
        }
      });

      const holder = new THREE.Group();
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const coatMat = coats[(i * 7 + 2) % 3 === 0 ? 1 : 0]; // 约 2/3 西门塔尔黄褐花，1/3 深褐花
        const sc = (s.scale || 1.0) * 1.05;

        if (s.walk || s.pose === 'rig') {
          const inst = cloneSkinned(rigSrc);
          applyCoat(inst, coatMat);
          inst.position.set(s.x, s.y || 0.22, s.z);
          inst.rotation.y = s.rot || 0;
          inst.scale.setScalar(sc);

          if (cIdle) {
            const mx = new THREE.AnimationMixer(inst);
            const idle = mx.clipAction(cIdle);
            idle.play();
            idle.time = ((i * 0.37) % 1) * cIdle.duration;
            mx.timeScale = 0.85 + ((i * 29) % 100) / 300;
            mixers.push(mx);
            if (s.walk) {
              const walk = mx.clipAction(cWalk);
              walk.play();
              walk.setEffectiveWeight(0);
              walk.time = ((i * 0.61) % 1) * cWalk.duration;
              walk.timeScale = 0.88 + ((i * 17) % 100) / 360;
              walkers.push({
                inst: inst, idle: idle, walk: walk, cfg: s.walk,
                t: (i * 0.137) % 1, dir: (i % 2) ? 1 : -1, pause: 0, moving: false,
              });
            }
          }
          holder.add(inst);
        } else {
          // 真实静态多姿态：趴卧休憩(Cow_Lie)、低头采食(Cow_Graze)、侧望站立(Cow_Look)、警觉站立(Cow_Stand)
          const srcMesh = poseMap[s.pose] || poseMap.Cow_Stand || poseMap.Cow_Look;
          if (!srcMesh) continue;
          const m = new THREE.Mesh(srcMesh.geometry, coatMat);
          m.castShadow = true;
          m.receiveShadow = true;
          m.position.set(s.x, s.y || 0.22, s.z);
          m.rotation.y = s.rot || 0;
          m.scale.setScalar(sc);
          holder.add(m);
          breathers.push({ mesh: m, baseY: sc, phase: i * 1.13 });
        }
      }
      group.add(holder);
      group.userData.mode = 'realistic-multipose';
      document.body.dataset.herd = 'realistic';
    }

    loader.load(MODEL_RIG, function (g) { rigGltf = g; tryAssemble(); }, undefined, function (e) { console.warn('写实动画牛加载失败', e); });
    loader.load(MODEL_POSES, function (g) { posesGltf = g; tryAssemble(); }, undefined, function (e) { console.warn('写实多姿态牛加载失败', e); });

    function setMoving(w, moving) {
      if (w.moving === moving) return;
      w.moving = moving;
      const to = moving ? w.walk : w.idle;
      const from = moving ? w.idle : w.walk;
      to.enabled = true;
      to.setEffectiveWeight(1);
      from.crossFadeTo(to, 0.35, false);
      if (!moving) w.pause = 0.9 + Math.random() * 1.8;
    }

    function stepWalkers(dt) {
      for (let i = 0; i < walkers.length; i++) {
        const w = walkers[i];
        const c = w.cfg;
        const o = w.inst;
        if (c.mode === 'circle') {
          if (!w.moving) setMoving(w, true);
          w.t = (w.t + dt * c.speed / (2 * Math.PI * c.r)) % 1;
          const a = w.t * Math.PI * 2;
          o.position.x = c.cx + Math.cos(a) * c.r;
          o.position.z = c.cz + Math.sin(a) * c.r;
          o.rotation.y = -a + YAW_FIX;
          continue;
        }
        // 直线往返（牛舍内侧采食通道）
        if (w.pause > 0) {
          w.pause -= dt;
          if (w.moving) setMoving(w, false);
          if (w.pause <= 0) setMoving(w, true);
          continue;
        }
        if (!w.moving) setMoving(w, true);
        const span = c.x1 - c.x0;
        w.t += (dt * c.speed / span) * w.dir;
        if (w.t > 1) { w.t = 1; w.dir = -1; w.pause = 0.9 + Math.random(); }
        if (w.t < 0) { w.t = 0; w.dir = 1; w.pause = 0.9 + Math.random(); }
        o.position.x = c.x0 + span * w.t;
        o.position.z = c.z;
        o.rotation.y = (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + YAW_FIX;
      }
    }

    group.userData.update = function (time) {
      const dt = lastT ? Math.min(0.06, Math.max(0, time - lastT)) : 0.016;
      lastT = time;
      if (mixers.length) {
        if (walkers.length) stepWalkers(dt);
        for (let i = 0; i < mixers.length; i++) mixers[i].update(dt);
      }
      // 静态趴卧/采食牛极其柔和的呼吸起伏，避免完全僵硬
      for (let i = 0; i < breathers.length; i++) {
        const b = breathers[i];
        b.mesh.scale.y = b.baseY * (1.0 + Math.sin(time * 1.45 + b.phase) * 0.014);
      }
    };

    return group;
  };

  /* 交易栏每栏 3 头（站立/侧望/绕圈走）；每栋牛舍 14 头：
     - 4 头在内侧露天阳光运动场（2 头慢步绕圈、1 头侧望、1 头待机）
     - 3 头紧贴内侧颈枷低头采食（Cow_Graze 朝向饲槽！）
     - 5 头在外侧钢构顶棚深垫料区惬意趴卧休憩（Cow_Lie / Cow_Look）
     - 2 头沿内侧采食通道来回踱步 */
  FL.herdSpots = function (L) {
    const P = L.market && L.market.pens;
    const out = [];
    let seed = 7;
    const rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    if (P) {
      for (let c = 0; c < P.cols; c++) {
        for (let r = 0; r < P.rows; r++) {
          const x0 = P.x0 + c * (P.w + P.gx), z0 = P.z0 + r * (P.d + P.gz);
          const pcx = x0 + P.w / 2, pcz = z0 + P.d / 2;
          for (let k = 0; k < 3; k++) {
            const spot = {
              x: x0 + P.w * (0.28 + 0.22 * k) + (rnd() - 0.5) * 0.6,
              z: z0 + P.d * (0.35 + 0.18 * k) + (rnd() - 0.5) * 0.6,
              y: 0.32,
              rot: rnd() * Math.PI * 2,
              scale: 0.92 + rnd() * 0.14,
              pose: k === 0 ? 'Cow_Look' : (k === 1 ? 'Cow_Graze' : 'rig'),
            };
            if (k === 2) {
              spot.walk = { mode: 'circle', cx: pcx, cz: pcz, r: 2.0, speed: 0.42 + rnd() * 0.14 };
            }
            out.push(spot);
          }
        }
      }
    }
    if (L.barns) {
      for (const b2 of L.barns) {
        const zf2 = b2.mirror ? b2.cz - b2.dep / 2 : b2.cz + b2.dep / 2;
        const sgn = b2.mirror ? 1 : -1;      // 由内侧颈枷往外侧顶棚方向
        const faceBunk = b2.mirror ? Math.PI : 0; // 面向中央日粮道饲槽（Three.js +Z 为北排前脸，-Z 为南排前脸）

        // 1) 4 头在内侧露天阳光运动场活动/晒太阳
        for (let k = 0; k < 4; k++) {
          const px = b2.cx - 15.0 + k * 10.0 + (rnd() - 0.5) * 1.2;
          const pz = zf2 + sgn * (4.9 + (rnd() - 0.5) * 1.1);
          const spot = {
            x: px, z: pz, y: 0.56,
            rot: rnd() * Math.PI * 2,
            scale: 0.94 + rnd() * 0.12,
            pose: k === 0 ? 'Cow_Look' : (k === 3 ? 'rig' : 'rig'),
          };
          if (k === 1 || k === 2) {
            spot.walk = { mode: 'circle', cx: b2.cx - 15.0 + k * 10.0, cz: zf2 + sgn * 5.0, r: 1.4, speed: 0.36 + rnd() * 0.12 };
          }
          out.push(spot);
        }

        // 2) 3 头紧贴颈枷低头采食日粮（Cow_Graze，头朝饲槽！）
        for (let g = 0; g < 3; g++) {
          out.push({
            x: b2.cx - 12.5 + g * 12.5 + (rnd() - 0.5) * 1.8,
            z: zf2 + sgn * 1.28,
            y: 0.58,
            rot: faceBunk + (rnd() - 0.5) * 0.18,
            scale: 0.95 + rnd() * 0.10,
            pose: 'Cow_Graze',
          });
        }

        // 3) 5 头在外侧钢构顶棚深垫料区惬意趴卧休憩（4 头真实趴卧 Cow_Lie + 1 头侧望站立）
        for (let idx = 0; idx < 5; idx++) {
          out.push({
            x: b2.cx - 15.6 + idx * 7.8 + (rnd() - 0.5) * 1.6,
            z: zf2 + sgn * (12.2 + (idx % 2) * 3.4 + (rnd() - 0.5) * 0.9),
            y: 0.62,
            rot: (b2.mirror ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 1.8,
            scale: 0.94 + rnd() * 0.12,
            pose: idx === 2 ? 'Cow_Look' : 'Cow_Lie',
          });
        }

        // 4) 2 头沿内侧采食通道来回踱步
        for (let wIdx = 0; wIdx < 2; wIdx++) {
          out.push({
            x: b2.cx - 11.0 + wIdx * 22.0,
            z: zf2 + sgn * 2.55,
            y: 0.58,
            rot: Math.PI / 2,
            scale: 0.96 + rnd() * 0.08,
            pose: 'rig',
            walk: {
              mode: 'line',
              x0: b2.cx - 17.0,
              x1: b2.cx + 17.0,
              z: zf2 + sgn * 2.55,
              speed: 0.42 + rnd() * 0.20,
            },
          });
        }
      }
    }
    return out;
  };
