/* 牛群：polyfork.dev "Cow base"（CC0）。模型已把 Idle 动画烘成 6 帧顶点，
   运行时用 6 个 InstancedMesh 轮换帧号——不需要蒙皮、不解析 GLTF、纯静态文件。 */
(function (root) {
  const FL = root.FL = root.FL || {};

  function bytes(buf, off, n) {
    return buf.slice(off, off + n);
  }

  FL.buildHerd = function (scene, spots) {
    const A = root.FL_COW;
    if (!A || !spots || !spots.length) return null;
    const bin = atob(A.bin);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    const buf = raw.buffer;

    // 共享属性：顶点色 / 索引（法线每帧由顶点位置重算）
    const colorAttr = new THREE.BufferAttribute(new Float32Array(bytes(buf, A.oC, A.v * 12)), 3);
    const indexAttr = new THREE.BufferAttribute(new Uint32Array(bytes(buf, A.oI, A.ic * 4)), 1);

    // 西门塔尔是黄白花：把底色往暖黄压，白斑变奶油黄、深斑变棕
    const mat = new THREE.MeshStandardMaterial({
      color: 0xd2ab7e, roughness: 0.92, metalness: 0.02, side: THREE.DoubleSide, vertexColors: true,
    });

    const group = new THREE.Group();
    group.name = 'herd';

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
      group.add(inst);
      frames.push(inst);
    }

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const tmpCol = new THREE.Color();

    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      const k = (s.scale || 1) * 0.92;
      scl.set(k, k, k);
      q.setFromAxisAngle(up, s.rot || 0);
      pos.set(s.x + (s.dx || 0), s.y || 0.22, s.z + (s.dz || 0));
      m4.compose(pos, q, scl);
      s.mat = m4.clone();
      s.phase = (i * 0.37) % 1;
      s.speed = 0.9 + ((i * 29) % 100) / 260;
      const t = 0.78 + ((i * 37) % 100) / 100 * 0.34;
      tmpCol.setRGB(t, t * (0.96 + ((i * 13) % 10) / 120), t * 0.94);
      s.col = tmpCol.clone();
    }

    const cursor = new Int32Array(A.nf);
    function update(time) {
      cursor.fill(0);
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        const ph = ((time * s.speed * 0.16) + s.phase) % 1;
        const f = Math.min(A.nf - 1, Math.floor(ph * A.nf));
        const inst = frames[f];
        const n = cursor[f];
        inst.setMatrixAt(n, s.mat);
        inst.setColorAt(n, s.col);
        cursor[f] = n + 1;
      }
      for (let f = 0; f < A.nf; f++) {
        frames[f].count = cursor[f];
        frames[f].instanceMatrix.needsUpdate = true;
        if (frames[f].instanceColor) frames[f].instanceColor.needsUpdate = true;
      }
    }

    update(0);
    scene.add(group);
    group.userData.update = update;
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
