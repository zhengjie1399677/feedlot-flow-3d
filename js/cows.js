/* 牛群：polyfork.dev "Cow base"（CC0）。
   - 走 http 时：GLTFLoader 载入 vendor/models/cow_polyfork.glb，SkeletonUtils 克隆，
     每头一个 AnimationMixer 播 Idle —— 真正的骨骼动画。
   - file:// 打开或加载失败时：退回 js/cow-asset.js 里预烘的 6 帧顶点（同样会动）。
   两条路都不需要构建工具。 */
(function (root) {
  const FL = root.FL = root.FL || {};
  const MODEL = 'vendor/models/cow_polyfork.glb';

  function bytes(buf, off, n) { return buf.slice(off, off + n); }

  /* 把黑白花改成西门塔尔的黄白花：暗部压成红棕、亮部提成奶油色 */
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
        const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
        c.lerp(lum < 0.30 ? brown : cream, 0.92);
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
    let lastT = 0;

    /* ---------- 方案 A：运行时 GLTF + 蒙皮 ---------- */
    function buildRuntime(loader, cloneSkinned) {
      loader.load(MODEL, function (gltf) {
        const src = gltf.scene;
        recolor(src);
        const clip = (gltf.animations || []).find(function (c) { return /Idle/i.test(c.name); }) || gltf.animations[0];
        const holder = new THREE.Group();
        for (let i = 0; i < spots.length; i++) {
          const s = spots[i];
          const inst = cloneSkinned(src);
          inst.position.set(s.x, s.y || 0.22, s.z);
          inst.rotation.y = s.rot || 0;
          inst.scale.setScalar((s.scale || 1) * 0.92);
          if (clip) {
            const mx = new THREE.AnimationMixer(inst);
            const act = mx.clipAction(clip);
            act.play();
            act.time = ((i * 0.37) % 1) * clip.duration;
            mx.timeScale = 0.75 + ((i * 29) % 100) / 260;
            mixers.push(mx);
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
          const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
          c.lerp(lum < 0.30 ? brown : cream, 0.92);
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
      if (baked && baked.group.visible) baked.update(time);
      if (mixers.length) {
        const dt = lastT ? Math.min(0.05, Math.max(0, time - lastT)) : 0.016;
        for (let i = 0; i < mixers.length; i++) mixers[i].update(dt);
      }
      lastT = time;
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

  /* 栏圈里每栏 3 头牛 + 每栋牛舍舍内 8 头 */
  FL.herdSpots = function (L) {
    const P = L.market && L.market.pens;
    const out = [];
    let seed = 7;
    const rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    if (P) {
      for (let c = 0; c < P.cols; c++) {
        for (let r = 0; r < P.rows; r++) {
          const x0 = P.x0 + c * (P.w + P.gx), z0 = P.z0 + r * (P.d + P.gz);
          for (let k = 0; k < 3; k++) {
            out.push({
              x: x0 + P.w * (0.28 + 0.22 * k) + (rnd() - 0.5) * 0.6,
              z: z0 + P.d * (0.35 + 0.18 * k) + (rnd() - 0.5) * 0.6,
              rot: rnd() * Math.PI * 2,
              scale: 0.92 + rnd() * 0.16,
            });
          }
        }
      }
    }
    if (L.barns) {
      for (const b2 of L.barns) {
        const zf2 = b2.mirror ? b2.cz - b2.dep / 2 : b2.cz + b2.dep / 2;
        for (let k = 0; k < 8; k++) {
          out.push({
            x: b2.cx - 15 + (k % 4) * 10 + (rnd() - 0.5) * 1.8,
            z: zf2 + (b2.mirror ? 2.8 : -2.8) - Math.floor(k / 4) * 2.6 + (rnd() - 0.5) * 0.5,
            rot: (b2.mirror ? 1 : -1) * Math.PI / 2 + (rnd() - 0.5) * 0.7,
            scale: 0.92 + rnd() * 0.12,
            y: 0.84,
          });
        }
      }
    }
    return out;
  };
})(window);
