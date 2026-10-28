/* ============================================================
 *  buildings.js — 牛舍 / 地磅 / 大门 / 综合楼 / TMR 配料 / 装车区
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = root.FL;
  const U = FL.U;
  const L = FL.LAYOUT;

  const css = (hex) => '#' + ('000000' + hex.toString(16)).slice(-6);

  function sign(world, text, sub, w, h, x, y, z, rotY, opts) {
    opts = opts || {};
    const tex = U.textTexture({
      w: 1024,
      h: Math.round((1024 * h) / w),
      text: text,
      sub: sub,
      size: opts.size || 92,
      subSize: opts.subSize || 40,
      color: opts.color || '#eef4f7',
      subColor: opts.subColor || 'rgba(210,224,232,0.6)',
      bg: opts.bg || 'rgba(8,12,16,0.9)',
      border: opts.border || null,
      borderWidth: 3,
      shadow: opts.glow || null,
      shadowBlur: 26,
      font: '"Microsoft YaHei","Bahnschrift",sans-serif',
    });
    const mat = U.signMaterial(tex, 1, false);
    if (opts.glow) mat.color.setRGB(1.5, 1.42, 1.3);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.renderOrder = 4;
    world.group.add(mesh);
    return mesh;
  }

  function glowPlane(world, w, h, x, y, z, rotY, color, opacity) {
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
      fog: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.renderOrder = 3;
    world.group.add(m);
    return m;
  }

  function billboard(world, text, sub, x, y, z, width, color) {
    const tex = U.textTexture({
      w: 512, h: 150, text: text, sub: sub, size: 96, subSize: 42,
      color: color || '#e9f1f5', subColor: 'rgba(206,224,210,0.72)',
      bg: 'rgba(9,12,10,0.88)', border: 'rgba(180,214,150,0.4)',
    });
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, toneMapped: false,
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(width, width * (150 / 512), 1);
    sp.position.set(x, y, z);
    sp.renderOrder = 5;
    world.group.add(sp);
    world.labels.push({ sprite: sp, id: 'silage', base: y });
    return sp;
  }

  function glowSprite(world, color, size, x, y, z, opacity) {
    const s = U.sprite(color, size, opacity == null ? 0.5 : opacity);
    s.position.set(x, y, z);
    world.group.add(s);
    return s;
  }

  /* ---------------- 牛舍 ---------------- */
  function gableWall(kit, M, x, cz, halfD, eave, ridge, y0, door) {
    const t = 0.3;
    const z0 = cz - halfD, z1 = cz + halfD;
    if (door) {
      const dz0 = door.z0, dz1 = door.z1;
      U.box(kit, M.wall, t, eave - y0, dz0 - z0, x, (eave + y0) / 2, (z0 + dz0) / 2);
      U.box(kit, M.wall, t, eave - y0, z1 - dz1, x, (eave + y0) / 2, (dz1 + z1) / 2);
      U.box(kit, M.wall, t, eave - (y0 + door.h), dz1 - dz0, x, (eave + y0 + door.h) / 2, (dz0 + dz1) / 2);
      // 门框
      U.box(kit, M.timber, t + 0.16, 0.34, dz1 - dz0 + 0.5, x, y0 + door.h + 0.1, cz);
      U.box(kit, M.timber, t + 0.16, door.h, 0.28, x, y0 + door.h / 2, dz0 - 0.12);
      U.box(kit, M.timber, t + 0.16, door.h, 0.28, x, y0 + door.h / 2, dz1 + 0.12);
    } else {
      U.box(kit, M.wall, t, eave - y0, 2 * halfD, x, (eave + y0) / 2, cz);
    }
    // 山墙三角
    const rise = ridge - eave;
    const shape = new THREE.Shape();
    shape.moveTo(-halfD, 0);
    shape.lineTo(halfD, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -t / 2);
    g.applyMatrix4(U.mat4(x, eave, cz, 0, Math.PI / 2, 0));
    kit.add(g, M.wall);
    // 山墙木饰条
    U.box(kit, M.timber, t + 0.1, 0.22, 2 * halfD, x, eave - 0.08, cz);
  }

  function buildBarn(kit, M, world, b) {
    const cx = b.cx, cz = b.cz, len = b.len, dep = b.dep;
    const halfL = len / 2, halfD = dep / 2;
    const zf = cz + halfD, zb = cz - halfD;
    const eave = 6.5, ridge = 10.1;
    const y0 = 0.42;
    const doorW = 6.2, doorH = 4.9;
    const doorZ = cz - 3.2;

    U.box(kit, M.apronEdge, len + 2.6, 0.5, dep + 2.6, cx, 0.25, cz, 0, 0, 0, 0.12);
    U.box(kit, M.floor, len - 0.7, 0.5, dep - 0.7, cx, 0.55, cz, 0, 0, 0, 0.04);

    // 背墙
    U.box(kit, M.wall, len, eave - y0, 0.3, cx, (eave + y0) / 2, zb + 0.15);
    // 端墙
    const d1 = b.idx === 1 ? { z0: doorZ - doorW / 2, z1: doorZ + doorW / 2, h: doorH } : null;
    const d3 = b.idx === 3 ? { z0: doorZ - doorW / 2, z1: doorZ + doorW / 2, h: doorH } : null;
    gableWall(kit, M, cx - halfL + 0.15, cz, halfD, eave, ridge, y0, d1);
    gableWall(kit, M, cx + halfL - 0.15, cz, halfD, eave, ridge, y0, d3);

    // 前檐柱
    for (let i = 0; i <= 8; i++) {
      const x = cx - halfL + 0.5 + (i * (len - 1)) / 8;
      U.box(kit, M.steel, 0.24, eave - y0, 0.24, x, (eave + y0) / 2, zf - 0.12);
      U.box(kit, M.steel, 0.24, 0.24, 0.5, x, eave - 0.24, zf - 0.12);
    }
    // 前檐梁
    U.box(kit, M.timber, len + 1.6, 0.42, 0.34, cx, eave - 0.1, zf + 0.05);
    U.box(kit, M.timber, len + 1.6, 0.3, 0.28, cx, eave - 0.62, zf + 0.05);

    // 屋顶
    const o = 0.9;
    const slopeH = halfD + o;
    const rise = ridge - eave;
    const slopeLen = Math.hypot(slopeH, rise) + 0.25;
    const ang = Math.atan2(rise, slopeH);
    U.box(kit, M.roof, len + 1.8, 0.22, slopeLen, cx, (eave + ridge) / 2, cz + slopeH / 2, ang, 0, 0);
    U.box(kit, M.roof, len + 1.8, 0.22, slopeLen, cx, (eave + ridge) / 2, cz - slopeH / 2, -ang, 0, 0);
    U.box(kit, M.roof, len + 2.0, 0.3, 0.62, cx, ridge + 0.12, cz, 0, 0, 0);
    // 檐口
    U.box(kit, M.timber, len + 2.0, 0.4, 0.22, cx, eave + 0.04, zf + o + 0.02);
    U.box(kit, M.timber, len + 2.0, 0.4, 0.22, cx, eave + 0.04, zb - o - 0.02);
    // 檐下暖光槽
    U.box(kit, M.warmGlow, len - 2, 0.06, 0.1, cx, eave - 0.35, zf + 0.18, 0, 0, 0);

    // 前墙踢脚 + 颈夹
    U.box(kit, M.wall, len - 1.4, 1.0, 0.32, cx, y0 + 0.5, zf + 0.02);
    U.box(kit, M.timber, len - 1.0, 0.12, 0.4, cx, y0 + 1.02, zf + 0.02);
    for (let i = 0; i <= 22; i++) {
      const x = cx - halfL + 1.0 + (i * (len - 2)) / 22;
      U.box(kit, M.steel, 0.07, 1.25, 0.07, x, y0 + 1.68, zf - 0.06);
    }
    U.box(kit, M.steel, len - 1.2, 0.1, 0.1, cx, y0 + 2.32, zf - 0.06);
    U.box(kit, M.steel, len - 1.2, 0.1, 0.1, cx, y0 + 1.05, zf - 0.06);
    // 卷起的遮阳帘
    const roll = new THREE.CylinderGeometry(0.26, 0.26, len - 1.6, 10);
    kit.add(roll, M.tarp, U.mat4(cx, eave - 1.05, zf + 0.15, 0, 0, Math.PI / 2));

    // 料槽
    const tz = zf + 1.2;
    const tlen = len - 6;
    U.box(kit, M.concreteTrough, tlen, 0.3, 1.9, cx, 0.28, tz);
    U.box(kit, M.concreteTrough, tlen, 0.55, 0.18, cx, 0.54, tz - 0.9);
    U.box(kit, M.concreteTrough, tlen, 0.55, 0.18, cx, 0.54, tz + 0.9);
    U.box(kit, M.feed, tlen - 0.3, 0.1, 1.5, cx, 0.5, tz);
    U.box(kit, M.feed, tlen - 0.25, 0.16, 1.55, cx, 0.58, tz);

    // 内部：饮水槽 / 栏杆 / 吊灯
    U.box(kit, M.concreteTrough, 4.6, 0.72, 1.2, cx + 11, 0.95, cz + 5.6);
    U.box(kit, M.water, 4.3, 0.06, 0.95, cx + 11, 1.3, cz + 5.6);
    U.box(kit, M.steel, len - 2, 0.07, 0.07, cx, 1.25, cz - 6.2);
    U.box(kit, M.steel, len - 2, 0.07, 0.07, cx, 1.75, cz - 6.2);
    for (let i = 0; i <= 6; i++) {
      const x = cx - halfL + 1 + (i * (len - 2)) / 6;
      U.box(kit, M.steel, 0.08, 0.75, 0.08, x, 1.5, cz - 6.2);
    }
    for (const off of [-13, 0, 13]) {
      const lx = cx + off;
      const shade = new THREE.ConeGeometry(0.62, 0.34, 12, 1, true);
      kit.add(shade, M.steel, U.mat4(lx, 5.55, cz, 0, 0, 0));
      const bulb = new THREE.SphereGeometry(0.16, 8, 6);
      kit.add(bulb, M.lamp, U.mat4(lx, 5.42, cz, 0, 0, 0));
      glowSprite(world, 0xffc180, 3.4, lx, 5.35, cz, 0.4);
    }
    // 室内地面光斑
    world.pools.push({ x: cx, z: cz, size: 34, warm: 1 });

    // 门洞暖光
    if (b.idx === 1) {
      glowPlane(world, 5.6, 4.4, cx - halfL + 0.02, y0 + 2.2, doorZ, Math.PI / 2, new THREE.Color(1.5, 0.85, 0.4), 0.16);
      glowSprite(world, 0xffb070, 13, cx - halfL - 1, 2.4, doorZ, 0.32);
    }
    if (b.idx === 3) {
      glowPlane(world, 5.6, 4.4, cx + halfL - 0.02, y0 + 2.2, doorZ, -Math.PI / 2, new THREE.Color(1.5, 0.85, 0.4), 0.16);
      glowSprite(world, 0xffb070, 13, cx + halfL + 1, 2.4, doorZ, 0.32);
    }

    // 牛舍标识
    sign(world, '0' + b.idx + ' 育肥牛舍', 'FATTENING BARN 0' + b.idx, 9, 1.5,
      cx, eave + 1.4, zf + 0.35, 0, { size: 92, subSize: 36, bg: 'rgba(14,12,9,0.86)', border: 'rgba(220,180,120,0.35)' });
  }

  /* ---------------- 卸牛台 ---------------- */
  function buildRamp(kit, M, world) {
    const x0 = -52, x1 = -40, z0 = -70, z1 = -58, h = 0.95;
    // 平台
    U.box(kit, M.concreteTrough, x1 - x0, h, z1 - z0, (x0 + x1) / 2, h / 2 + 0.15, (z0 + z1) / 2);
    // 斜坡
    const ang = Math.atan2(h + 0.15, 3.4);
    U.box(kit, M.concreteTrough, 3.6, 0.28, z1 - z0, x0 - 1.6, 0.5, (z0 + z1) / 2, 0, 0, ang);
    // 侧栏
    U.box(kit, M.steel, x1 - x0 + 0.4, 0.1, 0.1, (x0 + x1) / 2, 2.0, z0 + 0.1);
    U.box(kit, M.steel, x1 - x0 + 0.4, 0.1, 0.1, (x0 + x1) / 2, 2.0, z1 - 0.1);
    for (let i = 0; i <= 5; i++) {
      const x = x0 + (i * (x1 - x0)) / 5;
      U.box(kit, M.steel, 0.09, 1.15, 0.09, x, 1.45, z0 + 0.1);
      U.box(kit, M.steel, 0.09, 1.15, 0.09, x, 1.45, z1 - 0.1);
    }
    // 搭板
    U.box(kit, M.steelLight, 1.6, 0.12, 6.2, -52.6, 1.28, -64);
    U.box(kit, M.yellow, 1.6, 0.05, 0.18, -52.6, 1.36, -66.9);
    U.box(kit, M.yellow, 1.6, 0.05, 0.18, -52.6, 1.36, -61.1);
    // 标识
    sign(world, '卸牛台', 'UNLOADING RAMP', 6.4, 1.2, -51.6, 3.2, -57.6, Math.PI / 2,
      { size: 96, subSize: 40, bg: 'rgba(20,14,8,0.9)', border: 'rgba(240,190,120,0.4)', glow: 'rgba(255,170,80,0.5)', color: '#ffd9a8' });
    world.pools.push({ x: -46, z: -64, size: 16, warm: 0.8 });
  }

  /* ---------------- 地磅 ---------------- */
  function buildWeigh(kit, M, world) {
    const x = L.slots.weighbridge.x, z = L.slots.weighbridge.z;
    // 磅台
    U.box(kit, M.yard, 20, 0.35, 8, x, 0.42, z, 0, 0, 0, 0.06);
    U.box(kit, M.steel, 20.4, 0.22, 8.4, x, 0.22, z, 0, 0, 0, 0.04);
    U.box(kit, M.yellow, 20, 0.06, 0.26, x, 0.62, z - 3.7);
    U.box(kit, M.yellow, 20, 0.06, 0.26, x, 0.62, z + 3.7);
    // 棚子
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        U.box(kit, M.steel, 0.28, 7.1, 0.28, x + sx * 9.2, 3.6, z + sz * 4.3);
      }
    }
    U.box(kit, M.steel, 22, 0.34, 10.4, x, 7.3, z, 0.045, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 22.6, 0.18, 10.9, x, 7.5, z, 0.045, 0, 0);
    U.box(kit, M.steel, 22.2, 0.75, 0.18, x, 7.0, z + 5.3);
    U.box(kit, M.warmGlow, 19, 0.08, 0.12, x, 6.9, z - 2.4);
    U.box(kit, M.warmGlow, 19, 0.08, 0.12, x, 6.9, z + 2.4);
    // LED 屏
    sign(world, '38.62 t   ·   24 头   已放行', 'WEIGHBRIDGE · 100t', 7.4, 1.8, x, 5.85, z + 5.42, 0,
      { size: 74, subSize: 34, color: '#ffcf8f', bg: 'rgba(10,8,6,0.94)', border: 'rgba(255,170,80,0.4)', glow: 'rgba(255,150,60,0.55)' });
    // 磅房
    const bx = -96.4, bz = 65.2;
    U.box(kit, M.wallCool, 6.2, 3.4, 4.4, bx, 1.7, bz, 0, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 6.7, 0.25, 4.9, bx, 3.5, bz);
    U.box(kit, M.glass, 3.2, 1.35, 0.08, bx, 2.15, bz + 2.22);
    U.box(kit, M.warmGlow, 2.9, 1.1, 0.06, bx, 2.15, bz + 2.27);
    U.box(kit, M.steel, 2.2, 0.5, 0.5, bx + 3.0, 3.8, bz);
    U.box(kit, M.steel, 0.7, 0.9, 0.35, bx + 1.8, 4.1, bz);
    // 地磅标识
    sign(world, '地磅 · 9', 'WEIGHING', 4.6, 1.0, bx, 4.3, bz + 2.3, 0, { size: 84, subSize: 32, glow: 'rgba(255,180,90,0.4)', color: '#ffe0b0' });
    world.pools.push({ x: x, z: z, size: 36, warm: 1 });
  }

  /* ---------------- 大门 ---------------- */
  function buildGate(kit, M, world) {
    const g = L.slots.gate;
    // 门柱
    for (const zz of [g.z - 9.5, g.z + 9.5]) {
      U.box(kit, M.wallCool, 1.7, 6.4, 1.7, g.x - 0.5, 3.2, zz, 0, 0, 0, 0.08);
      U.box(kit, M.apronEdge, 2.0, 0.3, 2.0, g.x - 0.5, 6.5, zz);
      U.box(kit, M.warmGlow, 2.1, 0.12, 2.1, g.x - 0.5, 6.68, zz);
    }
    // 门头梁
    U.box(kit, M.steel, 0.5, 0.55, 21.4, g.x - 0.5, 7.0, g.z);
    U.box(kit, M.steel, 0.35, 2.6, 0.35, g.x - 0.5, 8.2, g.z - 9.5);
    U.box(kit, M.steel, 0.35, 2.6, 0.35, g.x - 0.5, 8.2, g.z + 9.5);
    sign(world, '牧野牧业 · 育肥一场', 'MUYE FEEDLOT · UNIT 01', 13.5, 2.3, g.x + 0.35, 9.0, g.z, Math.PI / 2,
      { size: 86, subSize: 36, bg: 'rgba(10,13,16,0.94)', border: 'rgba(255,196,120,0.4)', glow: 'rgba(255,180,90,0.5)', color: '#ffe4bd' });
    glowPlane(world, 13.5, 2.6, g.x + 0.5, 9.0, g.z, Math.PI / 2, new THREE.Color(1.4, 0.8, 0.35), 0.12);

    // 道闸
    const bx = -104.5, bz = g.z + 7.4;
    U.box(kit, M.steel, 0.5, 1.3, 0.5, bx, 0.85, bz);
    U.box(kit, M.yellow, 0.6, 0.2, 0.6, bx, 1.55, bz);
    const armLen = 7.4;
    const armAng = -1.15;
    const y1 = 1.45;
    for (let i = 0; i < 7; i++) {
      const seg = armLen / 7;
      const zc = bz - Math.cos(armAng) * (i + 0.5) * seg;
      const yc = y1 + Math.sin(-armAng) * (i + 0.5) * seg;
      U.box(kit, i % 2 ? M.red : M.line, 0.13, 0.13, seg * 0.98, bx, yc, zc, armAng, 0, 0);
    }
    // 门卫房
    const hx = -113.6, hz = 70.0;
    U.box(kit, M.wallCool, 5.4, 3.2, 4.2, hx, 1.6, hz, 0, 0, 0, 0.06);
    U.box(kit, M.roofPlant, 5.9, 0.24, 4.7, hx, 3.32, hz, 0, 0, 0);
    U.box(kit, M.glass, 2.6, 1.2, 0.08, hx, 2.0, hz + 2.12);
    U.box(kit, M.warmGlow, 2.3, 0.95, 0.06, hx, 2.0, hz + 2.17);
    U.box(kit, M.steel, 1.6, 0.45, 0.5, hx + 2.1, 3.6, hz);
    // 入口地面导向
    world.pools.push({ x: g.x + 1, z: g.z, size: 20, warm: 0.7 });

    // 厂外隔离墩
    for (let i = 0; i < 5; i++) {
      U.box(kit, M.apronEdge, 1.1, 0.9, 1.1, -118, 0.55, g.z - 9 + i * 4.4, 0, 0, 0, 0.05);
    }
  }

  /* ---------------- 综合楼 ---------------- */
  function buildOffice(kit, M, world) {
    const cx = -110, cz = 77.5, w = 18, d = 9.4, h = 8.4;
    U.box(kit, M.wallCool, w, h, d, cx, h / 2 + 0.2, cz, 0, 0, 0, 0.1);
    // 层间腰线
    for (const y of [3.4, 6.4]) {
      U.box(kit, M.apronEdge, w + 0.3, 0.22, d + 0.3, cx, y, cz);
    }
    // 顶部女儿墙
    U.box(kit, M.apronEdge, w + 0.6, 0.5, d + 0.6, cx, h + 0.4, cz);
    U.box(kit, M.roofPlant, w, 0.2, d, cx, h + 0.16, cz);
    // 屋顶设备
    U.box(kit, M.steel, 3.2, 0.8, 1.6, cx + 3, h + 0.9, cz - 1);
    U.box(kit, M.steel, 1.3, 1.4, 1.3, cx - 5, h + 1.1, cz + 1.5);
    U.cyl(kit, M.steelLight, 0.05, 0.05, 4.4, 5, cx - 7.2, h + 2.4, cz - 1);
    // 南立面窗
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 5; i++) {
        const x = cx - 6.6 + i * 3.3;
        const y = r === 0 ? 2.0 : 5.0;
        U.box(kit, M.steel, 2.6, 1.7, 0.12, x, y, cz + d / 2 + 0.04);
        U.box(kit, M.glass, 2.35, 1.45, 0.1, x, y, cz + d / 2 + 0.09);
        U.box(kit, M.warmGlow, 2.2, 1.3, 0.06, x, y, cz + d / 2 + 0.14);
      }
    }
    // 东立面窗
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 2; i++) {
        const z = cz - 2.2 + i * 4.4;
        const y = r === 0 ? 2.0 : 5.0;
        U.box(kit, M.steel, 0.12, 1.7, 2.4, cx + w / 2 + 0.04, y, z);
        U.box(kit, M.warmGlow, 0.06, 1.3, 2.15, cx + w / 2 + 0.1, y, z);
      }
    }
    // 入口雨棚
    U.box(kit, M.roofPlant, 6.6, 0.22, 2.6, cx, 3.55, cz + d / 2 + 1.2);
    U.box(kit, M.steel, 0.16, 3.2, 0.16, cx - 2.6, 1.9, cz + d / 2 + 2.2);
    U.box(kit, M.steel, 0.16, 3.2, 0.16, cx + 2.6, 1.9, cz + d / 2 + 2.2);
    U.box(kit, M.warmGlow, 6.0, 0.08, 0.1, cx, 3.4, cz + d / 2 + 2.4);
    // 门
    U.box(kit, M.glass, 2.2, 2.6, 0.1, cx, 1.5, cz + d / 2 + 0.08);
    sign(world, '综合管理楼', 'SITE OFFICE', 6.4, 1.05, cx, 4.6, cz + d / 2 + 0.2, 0,
      { size: 82, subSize: 32, bg: 'rgba(10,13,15,0.9)', border: 'rgba(190,210,220,0.3)' });
    world.pools.push({ x: cx, z: cz + 5.5, size: 18, warm: 0.8 });
  }

  /* ---------------- 筒仓 ---------------- */
  function buildSilo(kit, M, world, x, z, r, h) {
    // 支腿
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        U.box(kit, M.steel, 0.3, 5.2, 0.3, x + sx * r * 0.6, 2.6, z + sz * r * 0.6);
        U.box(kit, M.steel, 2.4, 0.22, 0.22, x + sx * r * 0.3, 2.2, z + sz * r * 0.6, 0, 0, 0);
      }
    }
    // 锥斗
    const cone = new THREE.CylinderGeometry(r - 0.12, 1.05, 3.4, 20, 1, true);
    kit.add(cone, M.galv, U.mat4(x, 6.9, z));
    // 筒身
    U.cyl(kit, M.galv, r, r, h - 8.6, 24, x, 8.6 + (h - 8.6) / 2, z);
    // 加强环
    for (let i = 1; i < 7; i++) {
      const y = 8.6 + (i * (h - 8.6)) / 7;
      const ring = new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.16, 24, 1, true);
      kit.add(ring, M.steelLight, U.mat4(x, y, z));
    }
    // 顶
    const top = new THREE.ConeGeometry(r, 2.4, 24);
    kit.add(top, M.galv, U.mat4(x, h + 1.2, z));
    U.cyl(kit, M.steel, 0.5, 0.5, 0.8, 10, x, h + 2.5, z);
    // 爬梯
    U.box(kit, M.steel, 0.12, h - 4, 0.5, x + r + 0.08, 4 + (h - 4) / 2, z);
    for (let i = 0; i < 14; i++) {
      U.box(kit, M.steel, 0.38, 0.05, 0.05, x + r + 0.08, 5 + i * 1.35, z);
    }
    // 顶部红色航空灯
    const beacon = new THREE.SphereGeometry(0.16, 8, 6);
    kit.add(beacon, M.redBeam, U.mat4(x, h + 3.0, z));
    glowSprite(world, 0xff5a3c, 2.4, x, h + 3.0, z, 0.5);
    // 料位标签
    sign(world, 'TMR 原料仓', 'SILAGE / GRAIN', 5.4, 1.0, x + r + 0.02, 12.5, z, Math.PI / 2,
      { size: 74, subSize: 32, bg: 'rgba(10,14,16,0.75)', border: 'rgba(150,200,220,0.25)', color: '#d7e6ea' });
  }

  /* ---------------- 配料车间 ---------------- */
  function buildPlant(kit, M, world) {
    const cx = -102, cz = -10, w = 24, d = 18, h = 8.7;
    // 基座
    U.box(kit, M.apronEdge, w + 1.4, 0.5, d + 1.4, cx, 0.25, cz, 0, 0, 0, 0.05);
    // 主体
    U.box(kit, M.wallDark, w, h, d, cx, h / 2 + 0.4, cz, 0, 0, 0, 0.06);
    // 横向色带
    U.box(kit, M.steel, w + 0.16, 0.4, d + 0.16, cx, 5.6, cz);
    U.box(kit, M.steel, w + 0.16, 0.5, d + 0.16, cx, 0.7, cz);
    // 屋顶
    U.box(kit, M.roofPlant, w + 1.2, 0.35, d + 1.2, cx, h + 0.55, cz);
    U.box(kit, M.apronEdge, w + 1.5, 0.5, 0.35, cx, h + 0.9, cz + d / 2 + 0.55);
    U.box(kit, M.apronEdge, w + 1.5, 0.5, 0.35, cx, h + 0.9, cz - d / 2 - 0.55);
    U.box(kit, M.apronEdge, 0.35, 0.5, d + 1.5, cx + w / 2 + 0.55, h + 0.9, cz);
    U.box(kit, M.apronEdge, 0.35, 0.5, d + 1.5, cx - w / 2 - 0.55, h + 0.9, cz);
    // 屋顶风机 + 除尘器
    for (const xx of [-6, 2]) {
      U.box(kit, M.steel, 2.6, 1.4, 2.0, cx + xx, h + 1.6, cz - 2);
      U.cyl(kit, M.steelLight, 1.0, 1.0, 0.3, 12, cx + xx, h + 2.4, cz - 2);
    }
    // 旋风除尘
    U.cyl(kit, M.galv, 1.5, 1.5, 2.6, 16, cx + 8, h + 2.4, cz + 4);
    const cc = new THREE.ConeGeometry(1.5, 2.6, 16);
    kit.add(cc, M.galv, U.mat4(cx + 8, h + 0.0, cz + 4, Math.PI, 0, 0));
    U.cyl(kit, M.steel, 0.45, 0.45, 3.4, 10, cx + 8, h + 5.2, cz + 4);
    U.box(kit, M.steel, 3.2, 0.2, 0.2, cx + 6.6, h + 2.5, cz + 4);
    // 屋顶 TMR 字
    const roofTex = U.textTexture({
      w: 1024, h: 512, text: 'TMR', size: 250, color: 'rgba(210,225,230,0.5)',
      font: '"Bahnschrift","Microsoft YaHei",sans-serif', weight: 700,
    });
    const roofSign = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 6),
      new THREE.MeshBasicMaterial({ map: roofTex, transparent: true, depthWrite: false, opacity: 0.85 })
    );
    roofSign.rotation.x = -Math.PI / 2;
    roofSign.position.set(cx + 1, h + 0.76, cz + 2);
    roofSign.renderOrder = 2;
    world.group.add(roofSign);

    // 东侧大门
    const dx = cx + w / 2;
    U.box(kit, M.steel, 0.3, 6.6, 9.4, dx + 0.02, 3.6, -6);
    U.box(kit, M.glass, 0.16, 6.0, 8.6, dx + 0.16, 3.5, -6);
    glowPlane(world, 8.4, 5.8, dx + 0.18, 3.5, -6, Math.PI / 2, new THREE.Color(1.6, 0.86, 0.4), 0.2);
    glowSprite(world, 0xffb070, 16, dx + 1.5, 3.0, -6, 0.3);
    // 门框黄黑
    for (let i = 0; i < 6; i++) {
      U.box(kit, i % 2 ? M.yellow : M.steel, 0.24, 0.34, 9.4, dx + 0.2, 0.9 + i * 0.34, -6);
    }
    // 雨棚
    const cy = 6.5;
    U.box(kit, M.roofPlant, 7.4, 0.24, 12.4, dx + 3.4, cy, -6, 0, 0, 0.085);
    U.box(kit, M.steel, 0.22, cy - 0.2, 0.22, dx + 6.8, cy / 2, -11.4);
    U.box(kit, M.steel, 0.22, cy - 0.2, 0.22, dx + 6.8, cy / 2, -0.6);
    U.box(kit, M.warmGlow, 6.8, 0.08, 0.1, dx + 3.2, cy - 0.2, -6);
    // 车间标识
    sign(world, 'TMR 配料中心', 'TOTAL MIXED RATION', 9.6, 1.8, dx + 0.3, 7.6, -6, Math.PI / 2,
      { size: 88, subSize: 34, bg: 'rgba(6,10,12,0.94)', border: 'rgba(255,186,110,0.42)', glow: 'rgba(255,170,80,0.55)', color: '#ffe2b8' });

    // 投料斗
    U.box(kit, M.steel, 3.4, 2.2, 3.4, dx + 3.2, 2.0, -6);
    U.box(kit, M.steel, 2.6, 0.16, 2.6, dx + 3.2, 3.2, -6);
    U.cyl(kit, M.steelLight, 0.35, 0.35, 2.4, 10, dx + 3.2, 4.4, -6);
    // 控制室
    U.box(kit, M.wallCool, 3.4, 2.8, 3.0, dx + 3.0, 1.6, -16.2, 0, 0, 0, 0.05);
    U.box(kit, M.roofPlant, 3.8, 0.2, 3.4, dx + 3.0, 3.05, -16.2);
    U.box(kit, M.warmGlow, 2.4, 0.85, 0.06, dx + 3.0, 2.0, -14.68);

    // 筒仓
    buildSilo(kit, M, world, -108, -32, 3.9, 26);
    buildSilo(kit, M, world, -94, -32, 3.9, 26);
    buildSilo(kit, M, world, -80, -32, 3.9, 26);
    // 筒仓到车间的输送桁架
    U.box(kit, M.steel, 1.7, 1.5, 15, -94, 10.1, -24.4);
    for (let i = 0; i < 4; i++) {
      U.box(kit, M.steel, 0.18, 10.1, 0.18, -94, 5.05, -31 + i * 2.2);
    }
    U.box(kit, M.steelLight, 2.2, 0.25, 15.4, -94, 10.95, -24.4);
    world.pools.push({ x: dx + 2, z: -6, size: 22, warm: 1 });

    // 青贮窖
    const bx = -95, bz = 26, bw = 26, bd = 8;
    U.box(kit, M.yard, bw + 2, 0.3, bd + 4, bx, 0.25, bz + 1, 0, 0, 0, 0.06);
    // 三面墙（南侧开口）
    U.box(kit, M.concreteTrough, bw, 2.7, 0.5, bx, 1.35, bz + bd / 2);
    U.box(kit, M.concreteTrough, 0.5, 2.7, bd, bx - bw / 2, 1.35, bz);
    U.box(kit, M.concreteTrough, 0.5, 2.7, bd, bx + bw / 2, 1.35, bz);
    // 青贮堆：压实的圆头料堆，覆膜压胎，东端留取料断面
    U.box(kit, M.silage, bw - 1.2, 3.4, bd - 1.2, bx - 0.6, 1.9, bz - 0.6, 0, 0, 0, 1.5);
    U.box(kit, M.silage, 0.45, 2.9, bd - 2.4, bx + bw / 2 - 1.2, 1.6, bz - 0.6, 0, 0, 0, 0.12);
    U.box(kit, M.film, bw - 0.8, 0.14, bd - 0.7, bx - 0.6, 3.66, bz - 0.6, 0.01, 0, 0, 1.7);
    U.box(kit, M.film, 0.3, 1.5, bd - 2.2, bx - bw / 2 + 0.7, 2.0, bz - 0.6, 0, 0, 0, 0.1);
    // 压胎（两排）
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 7; i++) {
        const g = new THREE.TorusGeometry(0.5, 0.18, 6, 10);
        kit.add(g, M.soil, U.mat4(bx - 9.6 + i * 3.2, 3.78, bz - 2.1 + r * 2.8, Math.PI / 2, 0, 0));
      }
    }
    billboard(world, '青贮窖', 'SILAGE BUNKER', bx - 1.0, 9.2, bz, 15.0, '#e6f0d4');
    world.pools.push({ x: bx, z: bz + 2, size: 24, warm: 0.5 });
  }

  /* ---------------- 装载机 ---------------- */
  function buildLoader(kit, M, world, x, z, ry) {
    const m = U.mat4(x, 0, z, 0, ry, 0);
    const part = (geo, mat, lx, ly, lz) => {
      const g = geo;
      g.applyMatrix4(U.mat4(lx, ly, lz));
      g.applyMatrix4(m);
      kit.add(g, mat);
    };
    // 车身
    part(U.roundedBox(2.0, 1.1, 3.4, 0.2), M.yellow, 0, 1.25, -0.4);
    part(U.roundedBox(1.7, 1.0, 1.5, 0.18), M.steel, 0, 1.25, 1.55);
    part(U.roundedBox(1.2, 1.1, 1.0, 0.14), M.glass, 0, 2.3, 0.9);
    // 动臂
    part(U.roundedBox(0.24, 0.9, 2.4, 0.06), M.steel, -0.9, 1.9, 1.6);
    part(U.roundedBox(0.24, 0.9, 2.4, 0.06), M.steel, 0.9, 1.9, 1.6);
    part(U.roundedBox(2.3, 0.9, 1.0, 0.08), M.steel, 0, 1.1, 2.9);
    // 轮
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
    // 装卸平台
    U.box(kit, M.concreteTrough, 9, 1.3, 14, 102.5, 0.65, -69, 0, 0, 0, 0.06);
    U.box(kit, M.yard, 8.6, 0.06, 13.6, 102.5, 1.33, -69);
    // 上坡道
    U.box(kit, M.concreteTrough, 5.2, 0.3, 5.2, 95.4, 0.7, -69, 0, 0, 0.24);
    // 平台栏
    for (const zz of [-76, -62]) {
      for (let i = 0; i < 5; i++) {
        U.box(kit, M.steel, 0.1, 1.2, 0.1, 98.4 + i * 2.1, 1.95, zz);
      }
      U.box(kit, M.steel, 8.6, 0.1, 0.1, 102.5, 2.5, zz);
      U.box(kit, M.steel, 8.6, 0.1, 0.1, 102.5, 1.65, zz);
    }
    // 装车滑道
    U.box(kit, M.steelLight, 3.4, 0.16, 6.2, 106.4, 1.45, -69);
    for (const zz of [-72, -66]) {
      U.box(kit, M.steel, 0.1, 1.15, 0.1, 108.0, 2.0, zz);
      U.box(kit, M.steel, 0.1, 1.15, 0.1, 104.9, 2.0, zz);
      U.box(kit, M.steel, 3.2, 0.08, 0.08, 106.45, 2.55, zz);
      U.box(kit, M.steel, 3.2, 0.08, 0.08, 106.45, 1.85, zz);
    }
    // 滑道顶棚
    U.box(kit, M.roofPlant, 4.6, 0.16, 7.4, 106.4, 3.65, -69, 0, 0, -0.08);
    for (const zz of [-72.3, -65.7]) {
      U.box(kit, M.steel, 0.16, 3.2, 0.16, 108.3, 2.05, zz);
    }
    U.box(kit, M.steel, 0.16, 3.2, 0.16, 104.6, 2.05, -72.3);
    U.box(kit, M.steel, 0.16, 3.2, 0.16, 104.6, 2.05, -65.7);
    U.box(kit, M.warmGlow, 4.0, 0.07, 0.09, 106.4, 3.5, -69);
    // 赶牛门
    U.box(kit, M.steel, 0.12, 1.7, 6.2, 101.2, 2.2, -69);
    U.box(kit, M.steel, 6.0, 0.12, 0.12, 101.2, 3.1, -69);
    // 标识
    sign(world, '出栏装车', 'LOADING BAY', 6.6, 1.25, 106.4, 4.9, -65.4, 0,
      { size: 92, subSize: 36, bg: 'rgba(16,10,12,0.92)', border: 'rgba(255,150,180,0.4)', glow: 'rgba(255,120,150,0.5)', color: '#ffd3de' });
    world.pools.push({ x: 102.5, z: -69, size: 24, warm: 1 });
    // 装车围栏网
    for (const zz of [-76.2, -61.8]) {
      U.box(kit, M.steel, 0.1, 1.8, 0.1, 96.5, 1.05, zz);
    }
  }

  /* ---------------- 机修车库 · 停车场 ---------------- */
  function buildWorkshop(kit, M, world) {
    const cx = 34, cz = 13, w = 26, d = 14;
    const zf = cz + d / 2;

    U.box(kit, M.yard, w + 12, 0.1, d + 14, cx, 0.245, cz + 2, 0, 0, 0, 1.5);
    // 主体
    U.box(kit, M.wallCool, w, 4.6, d, cx, 2.52, cz, 0, 0, 0, 0.05);
    // 墙裙
    U.box(kit, M.timber, w + 0.1, 0.9, d + 0.1, cx, 0.68, cz);
    // 檐口
    U.box(kit, M.steel, w + 0.4, 0.22, d + 0.4, cx, 4.92, cz);
    // 双坡金属屋面
    const a = 0.245;
    for (const s of [-1, 1]) {
      U.box(kit, M.roofPlant, w + 1.2, 0.2, 7.9, cx, 5.55, cz + s * 3.6, s * a, 0, 0);
    }
    U.box(kit, M.steel, w + 1.4, 0.16, 0.7, cx, 6.42, cz);
    U.box(kit, M.warmGlow, w + 1.0, 0.05, 0.07, cx, 4.7, cz + 7.35);

    // 三樘卷帘门
    for (let i = 0; i < 3; i++) {
      const x = cx - 8 + i * 8;
      U.box(kit, M.steel, 5.0, 4.2, 0.16, x, 2.32, zf + 0.04);
      U.box(kit, M.wallDark, 4.5, 3.7, 0.1, x, 2.12, zf + 0.13);
      for (let r = 0; r < 4; r++) {
        U.box(kit, M.steel, 4.5, 0.05, 0.05, x, 0.52 + r * 0.88, zf + 0.2);
      }
      U.box(kit, M.warmGlow, 4.6, 0.09, 0.06, x, 4.22, zf + 0.14);
      world.pools.push({ x: x, z: zf + 3.2, size: 12, warm: 1 });
      // 门侧防撞柱
      U.cyl(kit, M.yellow, 0.11, 0.11, 1.05, 8, x - 2.7, 0.78, zf + 0.5);
      U.cyl(kit, M.yellow, 0.11, 0.11, 1.05, 8, x + 2.7, 0.78, zf + 0.5);
    }

    // 东侧雨棚 + 工作台
    U.box(kit, M.roofPlant, 6.4, 0.16, 14, 50.2, 3.9, cz, 0, 0, -0.03);
    for (const pz of [cz - 6.4, cz + 6.4]) {
      for (const px of [47.3, 52.9]) U.box(kit, M.steel, 0.16, 3.8, 0.16, px, 2.1, pz);
    }
    U.box(kit, M.warmGlow, 5.6, 0.06, 0.07, 50.2, 3.75, cz + 6.9);
    U.box(kit, M.timberLight, 3.6, 0.16, 1.1, 51.4, 1.18, 8.4);
    U.box(kit, M.steel, 3.4, 0.1, 0.9, 51.4, 1.02, 8.4);
    for (const pz of [7.2, 9.6]) U.box(kit, M.steel, 0.1, 0.95, 0.1, 51.4, 0.72, pz);
    for (let i = 0; i < 3; i++) {
      U.cyl(kit, i === 1 ? M.blue : M.red, 0.44, 0.44, 1.1, 12, 52.1, 0.8, 17.1 + (i % 2) * 1.0);
    }

    world.pools.push({ x: 50, z: cz + 4, size: 16, warm: 1 });

    // 消防水罐
    for (let i = 0; i < 2; i++) {
      const tz = 5 + i * 9.2;
      U.cyl(kit, M.galv, 2.0, 2.0, 6.2, 18, 56.2, 3.35, tz);
      U.cyl(kit, M.galv, 0.35, 2.0, 1.1, 18, 56.2, 7.0, tz);
      U.cyl(kit, M.steel, 2.05, 2.05, 0.14, 18, 56.2, 4.4, tz);
      U.cyl(kit, M.steel, 2.05, 2.05, 0.14, 18, 56.2, 2.2, tz);
      U.box(kit, M.steel, 0.06, 6.2, 0.5, 58.2, 3.3, tz);
      U.box(kit, M.concreteTrough, 5.0, 0.5, 5.0, 56.2, 0.3, tz, 0, 0, 0, 0.2);
    }
    U.box(kit, M.wallCool, 2.6, 1.9, 2.2, 56.2, 1.15, 20.4);
    U.cyl(kit, M.steel, 0.1, 0.1, 2.6, 8, 57.1, 3.0, 20.9);
  }

  /* 停放中的挂车 */
  function parkedTrailer(kit, M, x, z, rot) {
    const base = U.mat4(x, 0.24, z, 0, rot, 0);
    const put = (mat, w, h, d, px, py, pz) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.applyMatrix4(U.mat4(px, py, pz));
      g.applyMatrix4(base);
      kit.add(g, mat);
    };
    put(M.steel, 11.2, 0.26, 1.1, 0, 1.02, 0);
    put(M.timber, 11.6, 0.16, 2.5, 0, 1.2, 0);
    put(M.blue, 10.6, 1.9, 2.28, 0.15, 2.24, 0);
    put(M.plinth, 10.5, 0.14, 2.34, 0.15, 3.2, 0);
    put(M.steel, 0.16, 0.5, 2.5, -5.9, 1.35, 0);
    put(M.steel, 0.16, 0.5, 2.5, 5.9, 1.35, 0);
    put(M.steel, 0.28, 1.1, 0.3, 4.7, 0.62, 0.7);
    put(M.steel, 0.28, 1.1, 0.3, 4.7, 0.62, -0.7);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const g = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 14);
        g.applyMatrix4(U.mat4(0, 0.66, 0, Math.PI / 2, 0, 0));
        g.applyMatrix4(U.mat4(sx * 2.9, 0, sz * 1.15));
        g.applyMatrix4(base);
        kit.add(g, M.plinth);
      }
    }
  }

  /* ---------------- 干草棚 ---------------- */
  function buildHayBarn(kit, M, world) {
    const cx = -22, cz = 9, w = 22, d = 12;
    const zf = cz + d / 2;
    U.box(kit, M.yard, w + 10, 0.1, d + 10, cx, 0.235, cz, 0, 0, 0, 1.5);
    // 三面墙
    U.box(kit, M.wallDark, w, 4.4, 0.3, cx, 2.42, cz - d / 2);
    U.box(kit, M.wallDark, 0.3, 4.4, d, cx - w / 2, 2.42, cz);
    U.box(kit, M.wallDark, 0.3, 4.4, d, cx + w / 2, 2.42, cz);
    // 前柱与前梁
    for (let i = 0; i < 6; i++) {
      U.box(kit, M.steel, 0.22, 4.2, 0.22, cx - w / 2 + (i * w) / 5, 2.32, zf);
    }
    U.box(kit, M.steel, w + 0.4, 0.24, 0.28, cx, 4.42, zf);
    U.box(kit, M.steel, w + 0.4, 0.2, 0.28, cx, 4.96, cz - d / 2);
    // 单坡屋面
    U.box(kit, M.roofPlant, w + 1.8, 0.18, d + 2.4, cx, 4.86, cz, 0.075, 0, 0);
    // 干草捆
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 9; i++) {
        const g = new THREE.CylinderGeometry(0.84, 0.84, 1.4, 14);
        g.applyMatrix4(U.mat4(0, 0, 0, Math.PI / 2, 0, 0));
        g.applyMatrix4(U.mat4(cx - w / 2 + 2.1 + i * 2.24, 1.06, cz - 2.6 + row * 4.2));
        kit.add(g, row === 1 ? M.tarp : M.hay);
      }
    }
    // 前场草捆
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.9, 0.9, 1.5, 14);
      g.applyMatrix4(U.mat4(0, 0, 0, 0, 0, Math.PI / 2));
      g.applyMatrix4(U.mat4(cx + 6.5, 1.0, zf + 4.5 + i * 2.1));
      kit.add(g, M.hay);
    }
    sign(world, '干草棚', 'HAY BARN', 6.2, 1.2, cx + w / 2 + 0.16, 3.9, cz, Math.PI / 2, {
      size: 84, subSize: 32, bg: 'rgba(10,13,15,0.88)', border: 'rgba(220,200,150,0.32)',
      glow: 'rgba(220,190,130,0.3)', color: '#efe3c8',
    });
    world.pools.push({ x: cx, z: zf + 3, size: 20, warm: 0.4 });
    world.pools.push({ x: cx - 2, z: cz - 1, size: 13, warm: 1 });
  }

  /* ---------------- 入口 ---------------- */
  FL.buildBuildings = function (kit, M, world) {
    M.warmGlow.userData.noShadow = true;
    M.lamp.userData.noShadow = true;
    M.redBeam.userData.noShadow = true;

    for (const b of L.barns) buildBarn(kit, M, world, b);
    buildRamp(kit, M, world);
    buildWeigh(kit, M, world);
    buildGate(kit, M, world);
    buildOffice(kit, M, world);
    buildPlant(kit, M, world);
    buildDock(kit, M, world);
    buildLoader(kit, M, world, -114, 12, -Math.PI / 2);

    // 场区中部：机修车库 + 停车场 + 干草棚
    buildWorkshop(kit, M, world);
    buildHayBarn(kit, M, world);
    parkedTrailer(kit, M, 8, 36, 0);
    parkedTrailer(kit, M, 25, 36, 0.02);
    parkedTrailer(kit, M, 42, 36, -0.015);

    // 料槽前的日粮光斑（喂料区）
    for (const b of L.barns) {
      world.pools.push({ x: b.cx, z: b.cz + 11, size: 14, warm: 0.35 });
    }
  };

})(window);
