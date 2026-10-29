/* 牛群：把预处理的低模牛（CC0，Quaternius Cow）以 InstancedMesh 撒进栏圈。
   模型由 js/cow-asset.js 提供；按材质分 7 个 InstancedMesh，整群牛只占 7 个 draw call。 */
(function (root) {
  const FL = root.FL = root.FL || {};

  function f32(buf, off, bytes) {
    return new Float32Array(buf.slice(off, off + bytes));
  }

  FL.buildHerd = function (scene, spots) {
    const A = root.FL_COW;
    if (!A || !spots || !spots.length) return null;
    const bin = atob(A.bin);
    const buf = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

    const group = new THREE.Group();
    group.name = 'herd';
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    A.parts.forEach(function (p) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(f32(buf, p.po, p.v * 12), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(f32(buf, p.no, p.v * 12), 3));
      g.setIndex(new THREE.BufferAttribute(new Uint16Array(buf.slice(p.io, p.io + p.ic * 2)), 1));
      g.computeBoundingSphere();

      const col = new THREE.Color();
      if (THREE.LinearSRGBColorSpace) col.setRGB(p.c[0], p.c[1], p.c[2], THREE.LinearSRGBColorSpace);
      else col.setRGB(p.c[0], p.c[1], p.c[2]);

      const mat = new THREE.MeshStandardMaterial({
        color: col, roughness: 0.86, metalness: 0.02, side: THREE.DoubleSide,
      });
      const inst = new THREE.InstancedMesh(g, mat, spots.length);
      inst.castShadow = true;
      inst.receiveShadow = true;

      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        pos.set(s.x + (s.dx || 0), 0.22, s.z + (s.dz || 0));
        q.setFromAxisAngle(up, s.rot || 0);
        const k = s.scale || 1;
        scl.set(k, k, k);
        m4.compose(pos, q, scl);
        inst.setMatrixAt(i, m4);
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    });

    scene.add(group);
    return group;
  };

  /* 在交易中心栏圈里撒牛：每栏 3 头 */
  FL.herdSpots = function (L) {
    const P = L.market && L.market.pens;
    if (!P) return [];
    const out = [];
    let seed = 7;
    const rnd = function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
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
    return out;
  };
})(window);
