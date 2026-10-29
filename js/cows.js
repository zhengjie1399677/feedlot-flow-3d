/* 牛群：polyfork.dev "Cow base"（CC0）。
   - 走 http 时：GLTFLoader 载入 vendor/models/cow_polyfork.glb，SkeletonUtils 克隆，
     每头一个 AnimationMixer —— 站着的播 Idle，走动的播 Walk 并在舍内/栏圈里移动。
   - file:// 打开或加载失败时：退回 js/cow-asset.js 里预烘的 6 帧顶点（会呼吸，但不走动）。 */
(function (root) {
  const FL = root.FL = root.FL || {};
  const MODEL = 'vendor/models/cow_polyfork.glb';
  const YAW_FIX = 0;          // 若发现牛倒着走，这里补 Math.PI

  function bytes(buf, off, n) { return buf.slice(off, off + n); }

  /* 黑白花 → 西门塔尔的黄褐白花：按顶点亮度重映射 */
  function remapColor(c, brown, cream) {
    const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.lerp(lum < 0.30 ? brown : cream, 0.92);
  }

  function recolor(rootObj) {
    const brown = new THREE.Color(0.050, 0.020, 0.009);
    const cream = new THREE.Color(0.320, 0.140, 0.050);
    const c = new THREE.Color();
    rootObj.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const col = o.geometry.getAttribute('color');
      if (!col) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mm of mats) {
        if (mm && !mm.vertexColors) { mm.vertexColors = true; mm.needsUpdate = true; }
      }
      for (let i = 0; i < col.count; i++) {
        c.fromBufferAttribute(col, i);
        remapColor(c, brown, cream);
        col.setXYZ(i, c.r, c.g, c.b);
      }
      col.needsUpdate = true;
    });
  }

  FL.buildHerd = function (scene, spots) {
    const group = new THREE.Group();
    group.name = 'herd';
    scene.add(group);
    if (!spots || !spots.length) return group;

    let baked = null;
    const mixers = [];
    const walkers = [];
    let lastT = 0;

    /* ---------- 方案 A：运行时 GLTF + 骨骼 ---------- */
    function buildRuntime(loader, cloneSkinned) {
      loader.load(MODEL, function (gltf) {
        const src = gltf.scene;
        recolor(src);
        const anims = gltf.animations || [];
        const clipOf = function (re, fallback) {
          const c = anims.find(function (a) { return re.test(a.name); });
          return c || fallback || anims[0];
        };
        const cIdle = clipOf(/idle/i, anims[0]);
        const cWalk = clipOf(/walk/i, cIdle);

        const holder = new THREE.Group();
        for (let i = 0; i < spots.length; i++) {
          const s = spots[i];
          const inst = cloneSkinned(src);
          inst.position.set(s.x, s.y || 0.22, s.z);
          inst.rotation.y = s.rot || 0;
          inst.scale.setScalar((s.scale || 1) * 0.92);
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
              walk.timeScale = 0.9 + ((i * 17) % 100) / 400;
              walkers.push({
                inst: inst, idle: idle, walk: walk, cfg: s.walk,
                t: (i * 0.137) % 1, dir: (i % 2) ? 1 : -1, pause: 0, moving: false,
              });
            }
          }
          holder.add(inst);
        }
        group.add(holder);
        if (baked) baked.group.visible = false;
        group.userData.mode = 'skinned';
        document.body.dataset.herd = 'skinned';
      }, undefined, function (e) {
        console.warn('牛模型加载失败，退回烘焙版本', e);
      });
    }

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
          o.rotation.y = -a + Math.PI / 2 + YAW_FIX;
          continue;
        }
        // 直线往返（牛舍采食通道）
        if (w.pause > 0) {
          w.pause -= dt;
          if (w.moving) setMoving(w, false);
          if (w.pause <= 0) setMoving(w, true);
          continue;
        }
        if (!w.moving) setMoving(w, true);
        const span = c.x1 - c.x0;
        w.t += (dt * c.speed / span) * w.dir;
        if (w.t > 1) { w.t = 1; w.dir = -1; w.pause = 0.8 + Math.random(); }
        if (w.t < 0) { w.t = 0; w.dir = 1; w.pause = 0.8 + Math.random(); }
        o.position.x = c.x0 + span * w.t;
        o.position.z = c.z;
        o.rotation.y = (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + YAW_FIX;
      }
    }

    /* ---------- 方案 B：预烘 6 帧 ---------- */
    function buildBaked() {
      const A = root.FL_COW;
      if (!A) return null;
      const bin = atob(A.bin);
      const raw = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
      const buf = raw.buffer;

      const colorAttr = new THREE.BufferAttribute(new Float32Array(bytes(buf, A.oC, A.v * 12)), 3);
      {
        const c = new THREE.Color();
        const brown = new THREE.Color(0.050, 0.020, 0.009);
        const cream = new THREE.Color(0.320, 0.140, 0.050);
        for (let i = 0; i < A.v; i++) {
          c.fromBufferAttribute(colorAttr, i);
          remapColor(c, brown, cream);
          colorAttr.setXYZ(i, c.r, c.g, c.b);
        }
      }
      const indexAttr = new THREE.BufferAttribute(new Uint32Array(bytes(buf, A.oI, A.ic * 4)), 1);
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide, vertexColors: true,
      });

      const g0 = new THREE.Group();
      const frames = [];
      for (let f = 0; f < A.nf; f++) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(buf, A.oF[f], A.v * 12)), 3));
        g.setAttribute('color', colorAttr);
        g.setIndex(indexAttr);
        g.computeVertexNormals();
        g.computeBoundingSphere();
        const inst = new THREE.InstancedMesh(g, mat, spots.length);
        inst.castShadow = true;
        inst.receiveShadow = true;
        inst.count = 0;
        inst.frustumCulled = false;
        g0.add(inst);
        frames.push(inst);
      }

      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const k = (s.scale || 1) * 0.92;
        scl.set(k, k, k);
        q.setFromAxisAngle(up, s.rot || 0);
        pos.set(s.x, s.y || 0.22, s.z);
        m4.compose(pos, q, scl);
        s.mat = m4.clone();
        s.phase = (i * 0.37) % 1;
        s.speed = 0.9 + ((i * 29) % 100) / 260;
      }
      const cursor = new Int32Array(A.nf);
      return {
        group: g0,
        update: function (time) {
          cursor.fill(0);
          for (let i = 0; i < spots.length; i++) {
            const s = spots[i];
            const ph = ((time * s.speed * 0.16) + s.phase) % 1;
            const f = Math.min(A.nf - 1, Math.floor(ph * A.nf));
            const inst = frames[f];
            const n = cursor[f];
            inst.setMatrixAt(n, s.mat);
            cursor[f] = n + 1;
          }
          for (let f = 0; f < A.nf; f++) {
            frames[f].count = cursor[f];
            frames[f].instanceMatrix.needsUpdate = true;
          }
        },
      };
    }

    baked = buildBaked();
    if (baked) group.add(baked.group);
    group.userData.mode = baked ? 'baked' : 'none';

    group.userData.update = function (time) {
      const dt = lastT ? Math.min(0.06, Math.max(0, time - lastT)) : 0.016;
      lastT = time;
      if (baked && baked.group.visible) baked.update(time);
      if (mixers.length) {
        if (walkers.length) stepWalkers(dt);
        for (let i = 0; i < mixers.length; i++) mixers[i].update(dt);
      }
    };

    // 等 GLTFLoader 就绪（module 脚本延迟执行），再走真·蒙皮那条路
    if (location.protocol !== 'file:') {
      let waited = 0;
      (function poll() {
        if (root.FL_GLTF) {
          buildRuntime(new root.FL_GLTF.GLTFLoader(), root.FL_GLTF.cloneSkinned);
          return;
        }
        waited += 120;
        if (waited < 6000) setTimeout(poll, 120);
      })();
    }

    return group;
  };

  /* 栏圈每栏 3 头（1 头绕圈走），牛舍舍内每栋 8 头（3 头沿栏前走道来回走） */
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
              rot: rnd() * Math.PI * 2,
              scale: 0.92 + rnd() * 0.16,
            };
            if (k === 2) {
              spot.walk = { mode: 'circle', cx: pcx, cz: pcz, r: 2.1, speed: 0.40 + rnd() * 0.16 };
            }
            out.push(spot);
          }
        }
      }
    }
    if (L.barns) {
      for (const b2 of L.barns) {
        const zf2 = b2.mirror ? b2.cz - b2.dep / 2 : b2.cz + b2.dep / 2;
        const sgn = b2.mirror ? 1 : -1;      // 由前脸往里走的方向
        for (let k = 0; k < 12; k++) {
          const row = Math.floor(k / 4);      // 休息区里三排
          const spot = {
            x: b2.cx - 15.5 + (k % 4) * 10.4 + (rnd() - 0.5) * 2.0,
            z: zf2 + sgn * (4.6 + row * 3.7) + (rnd() - 0.5) * 0.9,
            rot: (b2.mirror ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 1.5,
            scale: 0.92 + rnd() * 0.12,
            y: 0.84,
          };
          if (k >= 9) {
            spot.walk = {
              mode: 'line',
              x0: b2.cx - 17.5,
              x1: b2.cx + 17.5,
              z: zf2 + sgn * 1.9,
              speed: 0.42 + rnd() * 0.26,
            };
            spot.x = spot.walk.x0 + 2 + (k - 9) * 11;
            spot.z = spot.walk.z;
            spot.y = 0.84;
          }
          out.push(spot);
        }
      }
    }
    return out;
  };
})(window);
