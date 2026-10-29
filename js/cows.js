/* 牛群：把预处理好的牛模型（单网格 + 顶点色，polyfork.dev "Cow base"，CC0）
   以 InstancedMesh 撒进栏圈与牛舍。整群只占 1 个 draw call。 */
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

    // 布局：position | normal | color | index
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bytes(buf, 0, A.v * 12)), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bytes(buf, A.oN, A.v * 12)), 3));
    if (A.oC != null) {
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(bytes(buf, A.oC, A.v * 12)), 3));
    }
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(bytes(buf, A.oI, A.ic * 4)), 1));
    g.computeBoundingSphere();

    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.9, metalness: 0.02, side: THREE.DoubleSide,
      vertexColors: A.oC != null,
      color: A.oC != null ? 0xffffff : 0xd8c8a8,
    });

    const group = new THREE.Group();
    group.name = 'herd';
    const inst = new THREE.InstancedMesh(g, mat, spots.length);
    inst.castShadow = true;
    inst.receiveShadow = true;

    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const tmpCol = new THREE.Color();
    for (let i = 0; i < spots.length; i++) {
      const s = spots[i];
      pos.set(s.x + (s.dx || 0), s.y || 0.22, s.z + (s.dz || 0));
      q.setFromAxisAngle(up, s.rot || 0);
      const k = s.scale || 1;
      scl.set(k, k, k);
      m4.compose(pos, q, scl);
      inst.setMatrixAt(i, m4);
      // 每头深浅略有差别，整群不至于像复制粘贴
      const t = 0.78 + ((i * 37) % 100) / 100 * 0.34;
      tmpCol.setRGB(t, t * (0.96 + ((i * 13) % 10) / 120), t * 0.94);
      inst.setColorAt(i, tmpCol);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
    scene.add(group);
    return group;
  };

  /* 栏圈里每栏 3 头牛 + 每栋牛舍舍内 4 头 */
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
