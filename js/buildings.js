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

  // 接触阴影：贴地的黑色软片（成本极低，但能让建筑"坐"在地面上）
  function ao(world, w, d, x, z, opacity, rotY) {
    const m = U.aoPatch(w, d, opacity == null ? 0.34 : opacity);
    m.position.set(x, 0.207, z);
    if (rotY) m.rotation.z = rotY;
    world.group.add(m);
    return m;
  }

  /* 全场的接触阴影一次铺好（只按建筑轮廓，不做逐像素 AO） */
  function buildAO(world) {
    for (const b of L.barns) ao(world, b.len + 3.0, b.dep + 3.0, b.cx, b.cz, 0.38);
    ao(world, 27.0, 21.0, -102, -10, 0.40);            // TMR 配料车间
    ao(world, 10.0, 10.0, -108, -32, 0.32);            // 筒仓
    ao(world, 10.0, 10.0, -94, -32, 0.32);
    ao(world, 10.0, 10.0, -80, -32, 0.32);
    ao(world, 28.0, 11.0, -95, 26, 0.34);              // 青贮窖
    ao(world, 25.0, 13.0, -84, 56, 0.34);              // 地磅棚
    ao(world, 15.0, 15.0, -46, -64, 0.30);             // 卸牛台
    ao(world, 12.0, 17.0, 103.5, -69, 0.32);           // 装车台
    ao(world, 20.0, 11.0, -110, 77.5, 0.34);           // 综合楼
    ao(world, 7.0, 6.0, -113.6, 70, 0.28);             // 门卫房
    const mk = L.market;
    ao(world, mk.hall.w + 3.0, mk.hall.d + 3.0, mk.hall.cx, mk.hall.cz, 0.36);
    ao(world, mk.office.w + 3.0, mk.office.d + 3.0, mk.office.cx, mk.office.cz, 0.34);
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

  /* 镜像排：几何绕自心转 180°（用旋转而不是负缩放，否则法线/绕序会反） */
  /* 把一棵 kit 子树整体绕 (cx,cz) 旋转 rot —— 用来做镜像牛舍和朝北的员工楼 */
  function mirrorKit(kit, cx, cz, rot) {
    const pre = new THREE.Matrix4()
      .makeTranslation(cx, 0, cz)
      .multiply(new THREE.Matrix4().makeRotationY(rot === undefined ? Math.PI : rot))
      .multiply(new THREE.Matrix4().makeTranslation(-cx, 0, -cz));
    return {
      add: function (geo, mat, matrix) {
        const m = (matrix ? matrix.clone() : new THREE.Matrix4()).premultiply(pre);
        kit.add(geo, mat, m);
      },
    };
  }

  function buildBarn(kit, M, world, b) {
    const cx = b.cx, cz = b.cz, len = b.len, dep = b.dep;
    const mir = !!b.mirror;
    // 非几何挂件（标签/光片/光斑）不在 kit 里，需要自己按镜像位摆放
    const mx = (x) => (mir ? 2 * cx - x : x);
    const mz = (z) => (mir ? 2 * cz - z : z);
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
    // 背墙立面：勒脚、高位通风格栅、雨水管（南排这面正对园区）
    U.box(kit, M.apronEdge, len + 0.3, 0.9, 0.36, cx, 0.86, zb - 0.06);
    U.box(kit, M.timber, len + 0.2, 0.14, 0.3, cx, 1.36, zb - 0.06);
    for (let i = 0; i < 7; i++) {
      const vx = cx - halfL + 3.4 + i * ((len - 6.8) / 6);
      U.box(kit, M.steel, 2.0, 0.98, 0.12, vx, eave - 1.25, zb - 0.02);
      U.box(kit, M.warmGlow, 1.66, 0.56, 0.07, vx, eave - 1.25, zb - 0.1);
    }
    for (const px of [cx - halfL + 0.95, cx + halfL - 0.95]) {
      U.cyl(kit, M.steel, 0.1, 0.1, eave - 0.9, 8, px, (eave - 0.9) / 2 + 0.45, zb - 0.2);
      U.box(kit, M.steel, 0.5, 0.16, 0.16, px, eave - 0.9, zb - 0.2);
    }
    // 端墙
    const d1 = (b.idx === 1 || b.idx === 4) ? { z0: doorZ - doorW / 2, z1: doorZ + doorW / 2, h: doorH } : null;
    const d3 = (b.idx === 3 || b.idx === 6) ? { z0: doorZ - doorW / 2, z1: doorZ + doorW / 2, h: doorH } : null;
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
    // 槽底薄薄一层（永远有），以及随投料长高的日粮堆（独立网格）
    U.box(kit, M.feed, tlen - 0.3, 0.08, 1.5, cx, 0.47, tz);
    const pileGeo = new THREE.BoxGeometry(tlen - 0.7, 1, 1.42);
    pileGeo.translate(0, 0.5, 0);
    const pile = new THREE.Mesh(pileGeo, M.feedPile || M.feed);
    pile.position.set(cx, 0.5, tz);
    pile.scale.y = 0.12;
    pile.castShadow = true;
    pile.receiveShadow = true;
    world.group.add(pile);
    world.feedPiles.push({ mesh: pile, x: cx, z: tz, idx: b.idx, show: -1 });

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
      glowSprite(world, 0xffc180, 3.4, mx(lx), 5.35, cz, 0.4);
    }
    // 室内地面光斑
    world.pools.push({ x: cx, z: mz(cz), size: 34, warm: 1 });

    // 门洞暖光
    if (b.idx === 1) {
      glowPlane(world, 5.6, 4.4, mx(cx - halfL + 0.02), y0 + 2.2, mz(doorZ), Math.PI / 2, new THREE.Color(1.5, 0.85, 0.4), 0.16);
      glowSprite(world, 0xffb070, 13, mx(cx - halfL - 1), 2.4, mz(doorZ), 0.32);
    }
    if (b.idx === 3) {
      glowPlane(world, 5.6, 4.4, mx(cx + halfL - 0.02), y0 + 2.2, mz(doorZ), -Math.PI / 2, new THREE.Color(1.5, 0.85, 0.4), 0.16);
      glowSprite(world, 0xffb070, 13, mx(cx + halfL + 1), 2.4, mz(doorZ), 0.32);
    }

    // 牛舍标识
    sign(world, '0' + b.idx + ' 育肥牛舍', 'FATTENING BARN 0' + b.idx, 9, 1.5,
      cx, eave + 1.4, mz(zf + 0.35), 0, { size: 92, subSize: 36, bg: 'rgba(14,12,9,0.86)', border: 'rgba(220,180,120,0.35)' });
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

    // 道闸：立柱固定，横杆做成独立组（车辆通过时抬起 → 见 main.js）
    const bx = -104.5, bz = g.z + 7.4;
    U.box(kit, M.steel, 0.5, 1.3, 0.5, bx, 0.85, bz);
    U.box(kit, M.yellow, 0.6, 0.2, 0.6, bx, 1.55, bz);
    const arm = new THREE.Group();
    arm.position.set(bx, 1.55, bz);
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

    // ── 高跨中厅（把平屋顶拔起来一块，剪影不再是一只盒子）──
    const cw = 11, cd = 12.5, chh = 4.4;
    U.box(kit, M.wallCool, cw, chh, cd, cx - 1.5, h + 0.75 + chh / 2, cz - 1.5, 0, 0, 0, 0.05);
    U.box(kit, M.steel, cw + 0.24, 0.4, cd + 0.24, cx - 1.5, h + 0.75 + chh * 0.52, cz - 1.5);
    U.box(kit, M.roofPlant, cw + 1.4, 0.3, cd + 1.4, cx - 1.5, h + 0.75 + chh + 0.2, cz - 1.5);
    U.box(kit, M.apronEdge, cw + 1.5, 0.44, 0.3, cx - 1.5, h + 0.75 + chh + 0.5, cz - 1.5 + cd / 2 + 0.6);
    for (const sx of [-1, 1]) {
      U.box(kit, M.glass, 0.14, 1.5, cd - 2.4, cx - 1.5 + sx * (cw / 2 + 0.03), h + 0.75 + chh * 0.62, cz - 1.5);
    }
    U.box(kit, M.glass, cw - 2.2, 1.5, 0.14, cx - 1.5, h + 0.75 + chh * 0.62, cz - 1.5 + cd / 2 + 0.04);
    // 中厅顶的检修走道与栏杆
    U.box(kit, M.steel, cw + 1.2, 0.1, 1.1, cx - 1.5, h + 0.75 + chh + 0.4, cz - 1.5 - cd / 2 - 1.0);
    for (let i = 0; i < 7; i++) {
      U.box(kit, M.steelLight, 0.08, 0.9, 0.08, cx - 1.5 - cw / 2 + i * 2.0, h + 0.75 + chh + 0.85, cz - 1.5 - cd / 2 - 1.5);
    }

    // ── 成品日粮仓（两只立式料仓，贴着车间北墙）──
    for (const bx2 of [cx - 8.5, cx - 3.2]) {
      const bh = 13.5, br = 2.6, bz2 = cz - d / 2 - 3.2;
      U.cyl(kit, M.galv, br, br, bh, 18, bx2, bh / 2 + 1.2, bz2);
      const cone = new THREE.ConeGeometry(br, 2.6, 18);
      kit.add(cone, M.galv, U.mat4(bx2, 1.0, bz2, Math.PI, 0, 0));
      U.cyl(kit, M.steelLight, br * 0.55, br * 0.55, 0.5, 14, bx2, bh + 1.5, bz2);
      for (let r = 0; r < 3; r++) {
        U.cyl(kit, M.steel, br + 0.06, br + 0.06, 0.16, 18, bx2, 4.2 + r * 3.6, bz2);
      }
      U.box(kit, M.steel, 0.9, 9.0, 0.9, bx2 + br - 0.5, 7.0, bz2 + br - 0.4);
      for (const lx of [-1, 1]) {
        U.box(kit, M.steelLight, 0.16, 3.0, 0.16, bx2 + lx * br * 0.7, 0.6, bz2);
      }
    }
    // 日粮仓到车间的螺旋输送机（斜管）
    const aug = new THREE.CylinderGeometry(0.42, 0.42, 9.2, 10);
    kit.add(aug, M.galv, U.mat4(cx - 5.8, 9.4, cz - d / 2 - 3.2, 0, 0, Math.PI / 2 + 0.28));
    // 出料口下的装车平台
    U.box(kit, M.apronEdge, 9.0, 0.4, 4.0, cx - 5.8, 0.3, cz - d / 2 - 7.4, 0, 0, 0, 0.14);
    for (const px of [cx - 9.2, cx - 2.4]) {
      U.box(kit, M.yellow, 0.28, 1.2, 0.28, px, 0.95, cz - d / 2 - 8.9);
    }

    // ── 西侧苜蓿/干草棚（单坡，和主车间连成一片）──
    U.box(kit, M.wallDark, 7.0, 4.6, 14, cx - w / 2 - 3.6, 2.7, cz + 1.5, 0, 0, 0, 0.04);
    U.box(kit, M.roofPlant, 8.2, 0.24, 15.4, cx - w / 2 - 3.6, 5.2, cz + 1.5, 0, 0, 0.12);
    for (let i = 0; i < 3; i++) {
      U.box(kit, M.hay, 5.6, 1.3, 1.5, cx - w / 2 - 3.6, 1.2 + i * 0.0, cz - 4.2 + i * 3.0);
    }

    // ── 车间南墙的物流门 + 卸料月台 ──
    U.box(kit, M.steel, 0.3, 4.6, 7.2, cx, 2.8, cz + d / 2 + 0.02);
    U.box(kit, M.glass, 0.16, 4.0, 6.4, cx, 2.8, cz + d / 2 + 0.16);
    for (let i = 0; i < 5; i++) {
      U.box(kit, i % 2 ? M.yellow : M.steel, 0.22, 0.3, 7.2, cx + 2.6, 0.85 + i * 0.3, cz + d / 2 + 0.2);
    }
    U.box(kit, M.apronEdge, 12, 1.1, 5.0, cx + 1.2, 0.45, cz + d / 2 + 2.6, 0, 0, 0, 0.1);
    for (const px of [cx - 4.2, cx + 1.2, cx + 6.4]) {
      U.box(kit, M.soil, 0.5, 0.6, 0.5, px, 0.55, cz + d / 2 + 4.6, 0, 0, 0, 0.12);
    }

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
  function buildWorkshop(kit, M, world, cx, cz) {
    const w = 22, d = 13;
    const zf = cz + d / 2, zb = cz - d / 2;

    U.box(kit, M.yard, w + 14, 0.1, d + 20, cx, 0.245, cz + 1, 0, 0, 0, 1.5);
    // 主体
    U.box(kit, M.wallCool, w, 4.6, d, cx, 2.52, cz, 0, 0, 0, 0.05);
    // 墙裙
    U.box(kit, M.timber, w + 0.1, 0.9, d + 0.1, cx, 0.68, cz);
    // 檐口
    U.box(kit, M.steel, w + 0.4, 0.22, d + 0.4, cx, 4.92, cz);
    // 双坡金属屋面
    const a2 = 0.245;
    for (const s2 of [-1, 1]) {
      U.box(kit, M.roofPlant, w + 1.2, 0.2, d / 2 + 0.95, cx, 5.55, cz + s2 * 3.35, s2 * a2, 0, 0);
    }
    U.box(kit, M.steel, w + 1.4, 0.16, 0.7, cx, 6.42, cz);
    U.box(kit, M.warmGlow, w + 1.0, 0.05, 0.07, cx, 4.7, zf + 0.42);

    // 三樘卷帘门（朝南）
    for (let i = 0; i < 3; i++) {
      const x = cx - 7 + i * 7;
      U.box(kit, M.steel, 5.0, 4.2, 0.16, x, 2.32, zf + 0.04);
      U.box(kit, M.wallDark, 4.5, 3.7, 0.1, x, 2.12, zf + 0.13);
      for (let r = 0; r < 4; r++) {
        U.box(kit, M.steel, 4.5, 0.05, 0.05, x, 0.52 + r * 0.88, zf + 0.2);
      }
      U.box(kit, M.warmGlow, 4.6, 0.09, 0.06, x, 4.22, zf + 0.14);
      world.pools.push({ x: x, z: zf + 3.4, size: 12, warm: 1 });
      U.cyl(kit, M.yellow, 0.11, 0.11, 1.05, 8, x - 2.7, 0.78, zf + 0.5);
      U.cyl(kit, M.yellow, 0.11, 0.11, 1.05, 8, x + 2.7, 0.78, zf + 0.5);
    }

    // 东侧雨棚 + 工作台 + 油桶
    const xc = cx + w / 2 + 5.4;
    U.box(kit, M.roofPlant, 6.4, 0.16, 12, xc, 3.9, cz, 0, 0, -0.03);
    for (const pz of [cz - 5.4, cz + 5.4]) {
      for (const px of [xc - 2.9, xc + 2.7]) U.box(kit, M.steel, 0.16, 3.8, 0.16, px, 2.1, pz);
    }
    U.box(kit, M.warmGlow, 5.6, 0.06, 0.07, xc, 3.75, cz + 5.9);
    U.box(kit, M.timberLight, 3.6, 0.16, 1.1, xc + 1.2, 1.18, cz - 2.6);
    U.box(kit, M.steel, 3.4, 0.1, 0.9, xc + 1.2, 1.02, cz - 2.6);
    for (const pz of [cz - 3.8, cz - 1.6]) U.box(kit, M.steel, 0.1, 0.95, 0.1, xc + 1.2, 0.72, pz);
    for (let i = 0; i < 3; i++) {
      U.cyl(kit, i === 1 ? M.blue : M.red, 0.44, 0.44, 1.1, 12, xc + 1.9, 0.8, cz + 6.4 + (i % 2) * 1.0);
    }
    world.pools.push({ x: xc, z: cz + 3, size: 16, warm: 1 });

    // 消防水罐（北侧）
    for (let i = 0; i < 2; i++) {
      const tx = cx - 5 + i * 8.6;
      const tz = zb - 4.4;
      U.cyl(kit, M.galv, 2.0, 2.0, 6.2, 18, tx, 3.35, tz);
      U.cyl(kit, M.galv, 0.35, 2.0, 1.1, 18, tx, 7.0, tz);
      U.cyl(kit, M.steel, 2.05, 2.05, 0.14, 18, tx, 4.4, tz);
      U.cyl(kit, M.steel, 2.05, 2.05, 0.14, 18, tx, 2.2, tz);
      U.box(kit, M.concreteTrough, 5.0, 0.5, 5.0, tx, 0.3, tz, 0, 0, 0, 0.2);
    }
    U.box(kit, M.wallCool, 2.6, 1.9, 2.2, cx + w / 2 - 2.2, 1.15, zf + 1.6);
    U.cyl(kit, M.steel, 0.1, 0.1, 2.6, 8, cx + w / 2 - 1.3, 3.0, zf + 2.1);
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

  /* ---------------- 生产区 / 交易区之间的围墙 ---------------- */
  function buildCompoundWall(kit, M, world) {
    const W = L.market.wall;
    const H = 2.4;
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
      const n = Math.max(1, Math.round(len / 4));
      const step = len / n;
      U.box(kit, M.concreteTrough, len, 0.24, 0.76, (x0 + x1) / 2, 0.32, W.z);
      U.box(kit, M.steel, len, 0.15, 0.38, (x0 + x1) / 2, 0.44 + H + 0.07, W.z);
      for (let i = 0; i < n; i++) {
        const x = x0 + (i + 0.5) * step;
        U.box(kit, M.wallCool, step - 0.14, H, 0.26, x, 0.44 + H / 2, W.z);
        U.box(kit, M.steel, step - 0.22, 0.05, 0.3, x, 0.44 + H * 0.68, W.z);
      }
      for (let i = 0; i <= n; i++) {
        const x = x0 + i * step;
        U.box(kit, M.wallDark, 0.3, H + 0.34, 0.36, x, 0.44 + (H + 0.34) / 2, W.z);
      }
      // 南侧绿化带
      U.box(kit, M.grass, len, 0.14, 1.0, (x0 + x1) / 2, 0.31, W.z + 0.94);
      for (let i = 0; i * 6.5 + 3 < len; i++) {
        const x = x0 + 3 + i * 6.5;
        U.box(kit, i % 2 ? M.leafA : M.leafB, 1.2, 0.8, 1.0, x, 0.78, W.z + 0.94, 0, i * 0.7, 0, 0.3);
      }
    }

    // 车行大门
    for (const g of gates) {
      const gx0 = g[0], gx1 = g[1], mid = (gx0 + gx1) / 2, gw = gx1 - gx0;
      for (const x of [gx0, gx1]) {
        U.box(kit, M.wallDark, 0.6, H + 1.0, 0.62, x, 0.44 + (H + 1.0) / 2, W.z);
        U.box(kit, M.steel, 0.7, 0.14, 0.7, x, 0.44 + H + 1.06, W.z);
      }
      U.box(kit, M.steel, gw + 0.5, 0.2, 0.34, mid, 0.44 + H + 0.74, W.z);
      const leaf = gw * 0.52;
      for (let r = 0; r < 5; r++) {
        U.box(kit, M.steel, leaf, 0.09, 0.1, gx0 + leaf / 2 + 0.3, 0.92 + r * 0.4, W.z + 0.27);
      }
      U.box(kit, M.steel, 0.12, 2.05, 0.13, gx0 + leaf + 0.3, 1.5, W.z + 0.27);
      sign(world, '生产区', 'PRODUCTION AREA · 谢绝参观', 5.6, 1.25, mid, 3.74, W.z + 0.17, 0, {
        size: 78, subSize: 28, bg: 'rgba(8,11,13,0.9)', border: 'rgba(255,180,110,0.34)',
        glow: 'rgba(255,150,80,0.22)', color: '#f6e7cf',
      });
      world.pools.push({ x: mid, z: W.z + 2.4, size: 14, warm: 0.7 });
    }

    // 人行小门
    const wg = W.walkGate;
    if (wg) {
      const mid = (wg[0] + wg[1]) / 2;
      for (const x of [wg[0], wg[1]]) U.box(kit, M.steel, 0.18, 2.3, 0.18, x, 1.4, W.z);
      U.box(kit, M.steel, wg[1] - wg[0], 0.12, 0.2, mid, 2.6, W.z);
      U.box(kit, M.wallDark, (wg[1] - wg[0]) * 0.46, 1.9, 0.08, wg[0] + (wg[1] - wg[0]) * 0.3, 1.2, W.z + 0.14);
    }
  }

  /* ---------------- 活牛交易中心 ---------------- */
  function buildTradingCenter(kit, M, world) {
    const Hh = L.market.hall;
    const P = L.market.pens;
    const cx = Hh.cx, cz = Hh.cz, hw = Hh.w / 2, hd = Hh.d / 2;
    const zf = cz + hd;

    // 交易广场（浅色铺装 + 标线）
    U.box(kit, M.apron, 84, 0.08, 46, -2, 0.256, 12, 0, 0, 0, 1.6);
    U.box(kit, M.yellow, 66, 0.03, 0.22, -6, 0.3, 31);
    U.box(kit, M.line, 0.22, 0.03, 22, 36, 0.3, 20);

    // ── 交易大厅：抬高的台基 + 柱廊 + 玻璃幕墙 + 中庭 ──
    U.box(kit, M.concreteTrough, Hh.w + 9, 0.3, Hh.d + 9, cx, 0.3, cz, 0, 0, 0, 1.8);
    U.box(kit, M.concreteTrough, Hh.w + 4.6, 0.34, Hh.d + 4.6, cx, 0.62, cz, 0, 0, 0, 1.2);
    for (let s = 0; s < 3; s++) {
      U.box(kit, M.concreteTrough, 24 - s * 1.8, 0.22, 1.2, cx, 0.11 + s * 0.22, zf + 3.4 + s * 1.1, 0, 0, 0, 0.18);
    }
    // 主体
    U.box(kit, M.wall, Hh.w, 11.2, Hh.d, cx, 0.96 + 5.6, cz, 0, 0, 0, 0.04);
    U.box(kit, M.wallCool, Hh.w + 0.14, 2.6, Hh.d + 0.14, cx, 10.3, cz);
    U.box(kit, M.steelLight, Hh.w + 2.0, 0.5, Hh.d + 2.0, cx, 12.8, cz, 0, 0, 0, 0.2);
    U.box(kit, M.roofPlant, Hh.w + 2.1, 0.16, Hh.d + 2.1, cx, 13.1, cz);
    // 屋顶采光带 + 设备
    U.box(kit, M.glass, 18, 0.55, 6, cx, 13.35, cz - 1);
    U.box(kit, M.steelLight, 19.2, 0.2, 7.2, cx, 13.62, cz - 1);
    for (const px of [cx - 12, cx + 10]) {
      U.box(kit, M.galv, 3.4, 1.2, 2.6, px, 13.1, cz - 4.2);
      U.cyl(kit, M.steel, 1.1, 1.1, 0.16, 12, px + 1.4, 13.8, cz - 4.2);
    }
    U.cyl(kit, M.steel, 0.12, 0.12, 6.0, 8, cx + 13.5, 16.0, cz - 5);
    glowSprite(world, 0xff5a4a, 1.8, cx + 13.5, 19.1, cz - 5, 0.9);

    // 南立面：竖向石柱 + 玻璃幕墙
    const bays = 8, bayW = Hh.w / bays;
    for (let i = 0; i <= bays; i++) {
      U.box(kit, M.wallCool, 0.9, 7.4, 0.7, cx - hw + bayW * i, 4.2, zf + 0.1);
    }
    for (let i = 0; i < bays; i++) {
      const x = cx - hw + bayW * (i + 0.5);
      U.box(kit, M.glass, bayW - 1.0, 6.6, 0.16, x, 4.0, zf - 0.04);
      U.box(kit, M.steel, bayW - 0.9, 0.1, 0.2, x, 1.0, zf + 0.06);
      U.box(kit, M.steel, bayW - 0.9, 0.1, 0.2, x, 7.5, zf + 0.06);
    }
    U.box(kit, M.steel, Hh.w + 0.8, 0.3, 0.5, cx, 8.1, zf + 0.1);
    glowPlane(world, Hh.w - 4, 5.2, cx, 3.6, zf - 0.7, 0, 0xffc98a, 0.2);

    // 入口中庭（外凸 1.6m 的高玻璃盒）+ 柱廊
    const atW = 12.0, atH = 10.4;
    U.box(kit, M.steelLight, atW + 1.2, atH + 0.6, 1.9, cx, 0.96 + (atH + 0.6) / 2, zf + 0.9, 0, 0, 0, 0.1);
    U.box(kit, M.glass, atW, atH, 1.1, cx, 0.96 + atH / 2, zf + 1.0);
    for (let i = -2; i <= 2; i++) {
      U.box(kit, M.steelLight, 0.18, atH, 0.2, cx + i * (atW / 5), 0.96 + atH / 2, zf + 1.56);
    }
    U.box(kit, M.warmGlow, atW, 0.1, 0.12, cx, 11.5, zf + 1.6);
    glowPlane(world, atW - 1, atH - 1.2, cx, 1.1 + (atH - 1.2) / 2, zf - 0.2, 0, 0xffbb78, 0.3);
    // 柱廊（六根方柱 + 檐口梁）
    for (const px of [-13.2, -7.9, -2.6, 2.6, 7.9, 13.2]) {
      U.box(kit, M.wallCool, 0.78, 7.0, 0.78, cx + px, 4.0, zf + 2.9, 0, 0, 0, 0.08);
      U.box(kit, M.steelLight, 1.0, 0.24, 1.0, cx + px, 0.86, zf + 2.9, 0, 0, 0, 0.1);
      U.box(kit, M.steelLight, 1.0, 0.26, 1.0, cx + px, 7.5, zf + 2.9, 0, 0, 0, 0.1);
    }
    U.box(kit, M.steelLight, 30.5, 0.55, 4.6, cx, 7.9, zf + 2.9, 0, 0, 0, 0.14);
    U.box(kit, M.warmGlow, 28.5, 0.07, 0.1, cx, 7.6, zf + 4.9);
    world.pools.push({ x: cx, z: zf + 4.2, size: 30, warm: 1 });
    glowSprite(world, 0xffcf9a, 7.5, cx, 5.0, zf + 2.2, 0.5);

    // 屋顶招牌（立在女儿墙上，不会被雨棚遮住）
    U.box(kit, M.steel, 26.5, 0.3, 0.5, cx, 12.7, zf - 1.4);
    sign(world, '活牛交易中心', 'LIVE CATTLE MARKET · 每日竞价', 26, 3.4, cx, 14.6, zf - 1.5, 0, {
      size: 108, subSize: 38, bg: 'rgba(9,12,14,0.94)', border: 'rgba(255,178,104,0.55)',
      glow: 'rgba(255,160,80,0.4)', color: '#ffe6c4', subColor: 'rgba(255,196,150,0.82)',
    });
    // 广场上的行情立牌
    U.box(kit, M.steel, 7.2, 3.4, 0.6, cx + 19, 2.0, zf + 9.5, 0, 0, 0, 0.14);
    U.box(kit, M.steel, 0.9, 0.7, 1.4, cx + 19, 0.6, zf + 9.5, 0, 0, 0, 0.1);
    sign(world, '今日活牛 32.6 元/公斤', '挂牌 128 头 · 成交 96 头', 6.6, 2.6, cx + 19, 2.6, zf + 9.82, 0, {
      size: 54, subSize: 34, bg: 'rgba(10,14,12,0.94)', border: 'rgba(140,235,170,0.46)',
      glow: 'rgba(120,240,180,0.24)', color: '#c8f5d6', subColor: 'rgba(150,240,190,0.85)',
    });

    // ── 待售栏 ──
    const penX = P.x0, penZ = P.z0;
    const penW = P.w, penD = P.d, gx = P.gx, gz = P.gz;
    const totalW = P.cols * penW + (P.cols - 1) * gx;
    const totalD = P.rows * penD + (P.rows - 1) * gz;
    U.box(kit, M.penPad, totalW + 6, 0.1, totalD + 6, penX + totalW / 2, 0.27, penZ + totalD / 2, 0, 0, 0, 1.2);
    for (let r = 0; r < P.rows; r++) {
      for (let c = 0; c < P.cols; c++) {
        const x0 = penX + c * (penW + gx), z0 = penZ + r * (penD + gz);
        const mx = x0 + penW / 2, mz = z0 + penD / 2;
        const posts = 4;
        for (let i = 0; i <= posts; i++) {
          const t = i / posts;
          const pts = [
            [x0 + penW * t, z0], [x0 + penW * t, z0 + penD],
            [x0, z0 + penD * t], [x0 + penW, z0 + penD * t],
          ];
          for (const p of pts) U.box(kit, M.steel, 0.13, 1.5, 0.13, p[0], 1.02, p[1]);
        }
        for (const y of [0.72, 1.28]) {
          U.box(kit, M.steel, penW, 0.08, 0.08, mx, y, z0);
          U.box(kit, M.steel, penW, 0.08, 0.08, mx, y, z0 + penD);
          U.box(kit, M.steel, 0.08, 0.08, penD, x0, y, mz);
          U.box(kit, M.steel, 0.08, 0.08, penD, x0 + penW, y, mz);
        }
        // 料槽（北侧）+ 水槽（东南角）
        U.box(kit, M.concreteTrough, penW - 0.6, 0.62, 0.95, mx, 0.72, z0 + 0.62, 0, 0, 0, 0.22);
        U.box(kit, M.feed, penW - 1.0, 0.18, 0.72, mx, 1.06, z0 + 0.62);
        U.box(kit, M.steel, 1.7, 0.62, 0.7, x0 + penW - 1.4, 0.72, z0 + penD - 1.1, 0, 0, 0, 0.16);
        U.box(kit, M.water, 1.5, 0.06, 0.52, x0 + penW - 1.4, 1.0, z0 + penD - 1.1);
        if (r === 0 && c === 0) world.pools.push({ x: mx, z: mz, size: 14, warm: 0.32 });
      }
    }
    // 栏间过道灯
    for (let c = 0; c < P.cols - 1; c++) {
      const x = penX + c * (penW + gx) + penW + gx / 2;
      U.cyl(kit, M.steel, 0.09, 0.11, 4.6, 8, x, 2.5, penZ + totalD / 2);
      glowSprite(world, 0xffd7a0, 2.2, x, 4.9, penZ + totalD / 2, 0.7);
    }

    // ── 装牛台 + 停着的活牛车 ──
    const R = L.market.ramp;
    U.box(kit, M.concreteTrough, 4.4, 1.1, 7.6, R.x, 0.86, R.z, 0, 0, 0, 0.3);
    U.box(kit, M.concreteTrough, 3.2, 0.4, 7.6, R.x - 3.6, 0.5, R.z, 0, 0, -0.16, 0.2);
    for (const pz of [R.z - 3.6, R.z + 3.6]) {
      U.box(kit, M.steel, 4.4, 0.08, 0.08, R.x, 2.1, pz);
      U.box(kit, M.steel, 0.08, 1.0, 0.08, R.x - 2.1, 1.9, pz);
      U.box(kit, M.steel, 0.08, 1.0, 0.08, R.x + 2.1, 1.9, pz);
    }
    parkedStockTruck(kit, M, R.x + 10.5, R.z - 0.4, 0);
    world.pools.push({ x: R.x + 4, z: R.z, size: 13, warm: 0.85 });

    // ── 交易小地磅 ──
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
    sign(world, '交易地磅', 'LIVE SCALE', 3.4, 0.9, SC.x, 1.9, SC.z - 2.6, 0, {
      size: 62, subSize: 24, bg: 'rgba(8,12,14,0.9)', border: 'rgba(120,200,255,0.35)',
      glow: 'rgba(90,180,255,0.2)', color: '#d6ecff',
    });

    // ── 广场彩旗 ──
    const flagCols = [M.red, M.blue, M.yellow, M.red, M.blue, M.yellow];
    for (let i = 0; i < flagCols.length; i++) {
      const x = 2 + i * 5.4;
      U.cyl(kit, M.steelLight, 0.06, 0.09, 6.4, 6, x, 3.4, 14.4);
      U.box(kit, flagCols[i], 1.5, 0.85, 0.05, x + 0.8, 6.0, 14.4, 0, 0.22, 0);
      U.box(kit, flagCols[i], 0.9, 0.6, 0.05, x + 0.5, 5.5, 14.4, 0, 0.1, 0);
    }
    // 广场花箱
    for (let i = 0; i < 4; i++) {
      const x = -32 + i * 12;
      U.box(kit, M.concreteTrough, 2.0, 0.6, 2.0, x, 0.5, 27, 0, 0, 0, 0.16);
      U.box(kit, M.leafA, 1.7, 0.9, 1.7, x, 1.1, 27, 0, 0.3, 0, 0.3);
    }
    // 中央圆形花池
    U.cyl(kit, M.concreteTrough, 4.4, 4.6, 0.7, 28, 6, 0.46, 24);
    U.cyl(kit, M.apron, 4.0, 4.0, 0.2, 28, 6, 0.82, 24);
    U.cyl(kit, M.leafA, 3.3, 3.5, 1.0, 24, 6, 1.1, 24);
    U.cyl(kit, M.leafB, 2.0, 2.2, 1.1, 20, 6, 1.5, 24);
    world.pools.push({ x: 6, z: 24, size: 12, warm: 0.5 });
    // 广场路灯
    for (const lp of [[-16, 30], [14, 30], [30, 14], [-30, 12]]) {
      U.cyl(kit, M.steel, 0.09, 0.12, 5.2, 8, lp[0], 2.8, lp[1]);
      U.box(kit, M.lamp, 0.9, 0.18, 0.6, lp[0], 5.4, lp[1]);
      glowSprite(world, 0xffd7a0, 2.6, lp[0], 5.4, lp[1], 0.85);
      world.pools.push({ x: lp[0], z: lp[1], size: 13, warm: 0.85 });
    }
  }

  /* ---------------- 员工办公楼 ---------------- */
  function buildStaffOffice(rawKit, M, world) {
    const O = L.market.office;
    const cx = O.cx, cz = O.cz, w = O.w, d = O.d;
    const kit = O.rot ? mirrorKit(rawKit, cx, cz, O.rot) : rawKit;
    const zf = cz + d / 2;
    const H = 10.6;

    U.box(kit, M.concreteTrough, w + 4, 0.6, d + 4, cx, 0.52, cz, 0, 0, 0, 1.4);
    U.box(kit, M.wall, w, H, d, cx, 0.8 + H / 2, cz, 0, 0, 0, 0.04);
    for (const y of [0.8 + 3.3, 0.8 + 6.6]) {
      U.box(kit, M.wallCool, w + 0.12, 0.42, d + 0.12, cx, y, cz);
    }
    U.box(kit, M.steel, w + 0.5, 0.24, d + 0.5, cx, 0.8 + H + 0.1, cz);
    U.box(kit, M.wallCool, w + 0.4, 1.0, 0.3, cx, 0.8 + H + 0.62, zf - 0.2);
    U.box(kit, M.wallCool, w + 0.4, 1.0, 0.3, cx, 0.8 + H + 0.62, cz - d / 2 + 0.2);

    // 中部塔楼：入口门厅 + 通高玻璃中庭（让立面不至于一片平）
    const pavW = 16, pavD = 14.5, pavZ = cz + 2.2;
    U.box(kit, M.wall, pavW, 14.6, pavD, cx, 0.8 + 7.3, pavZ, 0, 0, 0, 0.04);
    U.box(kit, M.wallCool, pavW + 0.24, 3.2, pavD + 0.24, cx, 13.4, pavZ);
    U.box(kit, M.steelLight, pavW + 1.6, 0.42, pavD + 1.6, cx, 15.6, pavZ, 0, 0, 0, 0.22);
    U.box(kit, M.steel, pavW + 1.7, 0.14, pavD + 1.7, cx, 15.9, pavZ);
    // 通高中庭玻璃（贴着塔楼前脸）
    const pgW = 11.4, pgH = 10.2;
    U.box(kit, M.steelLight, pgW + 1.0, pgH + 0.5, 0.5, cx, 0.8 + (pgH + 0.5) / 2, pavZ + pavD / 2 + 0.2, 0, 0, 0, 0.1);
    U.box(kit, M.glass, pgW, pgH, 0.2, cx, 0.8 + pgH / 2, pavZ + pavD / 2 + 0.42);
    for (let i = -2; i <= 2; i++) {
      U.box(kit, M.steelLight, 0.22, pgH, 0.24, cx + i * (pgW / 5), 0.8 + pgH / 2, pavZ + pavD / 2 + 0.5);
    }
    U.box(kit, M.warmGlow, pgW, 0.12, 0.1, cx, 0.9 + pgH, pavZ + pavD / 2 + 0.56);
    glowPlane(world, pgW - 1.5, 8.0, cx, 4.4, pavZ + pavD / 2 + 0.62, 0, 0xffc98a, 0.2);
    // 门厅雨棚
    U.box(kit, M.steelLight, pavW + 6, 0.4, 5.2, cx, 8.4, pavZ + pavD / 2 + 2.6, -0.02, 0, 0, 0.14);
    U.box(kit, M.warmGlow, pavW + 5, 0.07, 0.1, cx, 8.16, pavZ + pavD / 2 + 5.2);
    for (const px of [cx - pavW / 2 - 1.6, cx + pavW / 2 + 1.6]) {
      U.cyl(kit, M.steelLight, 0.24, 0.28, 7.6, 12, px, 4.6, pavZ + pavD / 2 + 4.6);
    }
    world.pools.push({ x: cx, z: pavZ + pavD / 2 + 5.2, size: 24, warm: 1 });
    // 塔楼顶的楼名
    sign(world, '牧野牧业', 'MUYE CATTLE · 员工办公楼', 15, 2.4, cx, 13.6, pavZ + pavD / 2 + 0.3, 0, {
      size: 96, subSize: 34, bg: 'rgba(9,12,15,0.94)', border: 'rgba(150,205,255,0.46)',
      glow: 'rgba(120,180,255,0.3)', color: '#e6f1ff', subColor: 'rgba(175,205,235,0.82)',
    });

    // 三层窗（前后两个长立面都开窗，楼在路南侧、镜头从东南看过来）
    const bays = 11, bw = w / bays;
    const zb = cz - d / 2;
    for (let f = 0; f < 3; f++) {
      const y = 2.2 + f * 3.3;
      for (let i = 0; i < bays; i++) {
        const x = cx - w / 2 + bw * (i + 0.5);
        const frontDoor = i === 4 || i === 5 || i === 6;
        if (!frontDoor) {
          U.box(kit, M.glass, bw - 1.05, 1.85, 0.14, x, y + 0.5, zf + 0.02);
          U.box(kit, M.warmGlow, bw - 1.5, 1.5, 0.06, x, y + 0.5, zf + 0.1);
          U.box(kit, M.steelLight, 0.14, 1.9, 0.2, x - (bw - 1.05) / 2, y + 0.5, zf + 0.06);
          U.box(kit, M.steelLight, 0.14, 1.9, 0.2, x + (bw - 1.05) / 2, y + 0.5, zf + 0.06);
        }
        U.box(kit, M.glass, bw - 1.05, 1.85, 0.14, x, y + 0.5, zb - 0.02);
        U.box(kit, M.warmGlow, bw - 1.5, 1.5, 0.06, x, y + 0.5, zb - 0.1);
        U.box(kit, M.steelLight, 0.14, 1.9, 0.2, x - (bw - 1.05) / 2, y + 0.5, zb - 0.06);
        U.box(kit, M.steelLight, 0.14, 1.9, 0.2, x + (bw - 1.05) / 2, y + 0.5, zb - 0.06);
      }
    }
    // 背面（园区朝南那侧）也留个入口门廊与楼名
    U.box(kit, M.glass, 7.2, 4.2, 0.16, cx, 2.5, zb - 0.04);
    for (const px of [cx - 3.6, cx, cx + 3.6]) {
      U.box(kit, M.steelLight, 0.2, 4.3, 0.2, px, 2.5, zb - 0.1);
    }
    sign(world, '员工办公楼', 'STAFF OFFICE · 综合管理', 10, 1.6, cx, 6.3, zb - 0.22, Math.PI, {
      size: 88, subSize: 34, bg: 'rgba(9,12,15,0.92)', border: 'rgba(150,205,255,0.42)',
      glow: 'rgba(120,180,255,0.28)', color: '#e6f1ff', subColor: 'rgba(175,205,235,0.8)',
    });
    glowPlane(world, 7.0, 3.4, cx, 2.5, zb - 0.3, Math.PI, 0xffc98a, 0.14);
    world.pools.push({ x: cx, z: zb - 3.4, size: 18, warm: 0.85 });
    // 东西两侧条窗
    for (let f = 0; f < 3; f++) {
      const y = 2.2 + f * 3.3;
      for (const sx of [-1, 1]) {
        U.box(kit, M.glass, 0.14, 1.8, d - 2.6, cx + sx * (w / 2 + 0.02), y + 0.5, cz);
        U.box(kit, M.warmGlow, 0.06, 1.4, d - 3.4, cx + sx * (w / 2 + 0.08), y + 0.5, cz);
      }
    }

    // 入口
    const doorX = cx;
    U.box(kit, M.glass, 8.4, 4.4, 0.16, doorX, 2.6, zf + 0.04);
    for (const px of [doorX - 4.2, doorX - 1.4, doorX + 1.4, doorX + 4.2]) {
      U.box(kit, M.steelLight, 0.2, 4.5, 0.22, px, 2.6, zf + 0.1);
    }
    U.box(kit, M.concreteTrough, 12, 0.3, 4.2, doorX, 0.62, zf + 2.2, 0, 0, 0, 0.8);
    U.box(kit, M.roofPlant, 13, 0.22, 4.6, doorX, 5.3, zf + 2.4, -0.02, 0, 0);
    U.box(kit, M.warmGlow, 12, 0.08, 0.09, doorX, 5.1, zf + 4.5);
    for (const px of [doorX - 5.6, doorX + 5.6]) {
      U.box(kit, M.steelLight, 0.26, 4.4, 0.26, px, 2.4, zf + 4.3);
    }
    glowPlane(world, 8.0, 3.6, doorX, 2.6, zf + 0.2, 0, 0xffc98a, 0.16);
    world.pools.push({ x: doorX, z: zf + 4.6, size: 22, warm: 1 });
    glowSprite(world, 0xffd0a0, 5.4, doorX, 3.2, zf + 1.6, 0.45);

    sign(world, '员工办公楼', 'STAFF OFFICE · 综合管理', 12, 1.7, doorX, 6.35, zf + 0.2, 0, {
      size: 88, subSize: 34, bg: 'rgba(9,12,15,0.92)', border: 'rgba(150,205,255,0.42)',
      glow: 'rgba(120,180,255,0.28)', color: '#e6f1ff', subColor: 'rgba(175,205,235,0.8)',
    });

    // 屋顶设备 + 旗杆
    for (const px of [cx - 12, cx + 6]) {
      U.box(kit, M.galv, 3.0, 1.1, 2.4, px, 0.8 + H + 1.0, cz + 1);
    }
    U.cyl(kit, M.steelLight, 0.07, 0.09, 7.5, 6, cx - 20, 4.3, zf + 3.4);
    U.box(kit, M.red, 1.7, 1.0, 0.05, cx - 20 + 0.9, 7.5, zf + 3.4, 0, 0.2, 0);
    // ── 楼前广场：旗阵 + 绿篱 + 落客车道 + 访客车位 ──
    const fy = zf + 9.0;
    U.box(rawKit, M.apron, 62, 0.2, 26, cx, 0.22, cz + d / 2 + 11, 0, 0, 0, 0.06);
    U.box(rawKit, M.apronEdge, 62, 0.24, 0.6, cx, 0.26, cz + d / 2 + 24.2);
    for (const fx of [cx - 9, cx, cx + 9]) {
      U.cyl(rawKit, M.steelLight, 0.09, 0.12, 12.5, 8, fx, 6.5, fy);
      U.box(rawKit, fx === cx ? M.red : (fx < cx ? M.blue : M.yellow), 1.9, 1.15, 0.06, fx + 1.0, 11.4, fy, 0, 0.24, 0);
      U.cyl(rawKit, M.concreteTrough, 0.5, 0.6, 0.4, 10, fx, 0.45, fy);
    }
    for (const hx of [cx - 22, cx - 16, cx + 16, cx + 22]) {
      U.box(rawKit, M.leafA, 5.4, 1.5, 1.4, hx, 1.0, cz + d / 2 + 6.5, 0, 0, 0, 0.4);
    }
    // 访客停车位（楼前偏东）
    U.box(rawKit, M.apron, 22, 0.19, 9.5, cx + 20, 0.21, cz + d / 2 + 12, 0, 0, 0, 0.04);
    for (let i = 0; i < 5; i++) {
      U.box(rawKit, M.line, 0.12, 0.02, 4.6, cx + 11.4 + i * 4.3, 0.31, cz + d / 2 + 12.2);
      if (i % 2 === 0) parkedCar(rawKit, M, cx + 13.6 + i * 4.3, cz + d / 2 + 12.2, Math.PI / 2, [M.wall, M.blue, M.red, M.galv][i % 4]);
    }
    // 门卫岗亭 + 道闸
    U.box(rawKit, M.wallCool, 3.2, 2.6, 3.2, cx - 26.5, 1.9, cz + d / 2 + 22.6, 0, 0, 0, 0.06);
    U.box(rawKit, M.roofPlant, 3.9, 0.22, 3.9, cx - 26.5, 3.34, cz + d / 2 + 22.6);
    U.box(rawKit, M.glass, 2.4, 1.1, 0.08, cx - 26.5, 2.3, cz + d / 2 + 21.02);
    U.box(rawKit, M.warmGlow, 2.2, 0.7, 0.06, cx - 26.5, 2.3, cz + d / 2 + 21.06);
    world.pools.push({ x: cx - 26.5, z: cz + d / 2 + 21, size: 12, warm: 0.8 });

    // 楼前绿篱 / 花箱
    for (let i = 0; i < 2; i++) {
      const x = cx - 18 + i * 36;
      U.box(kit, M.leafB, 9, 1.0, 1.3, x, 0.85, zf + 1.2, 0, 0, 0, 0.3);
    }
    for (let i = 0; i < 3; i++) {
      const x = cx - 9 + i * 9;
      U.box(kit, M.concreteTrough, 1.8, 0.55, 1.8, x, 0.48, zf + 2.6, 0, 0, 0, 0.14);
      U.box(kit, M.leafA, 1.5, 0.8, 1.5, x, 1.0, zf + 2.6, 0, 0.4, 0, 0.3);
    }
  }

  /* 静态停放的一台活牛车（交易区用） */
  function parkedStockTruck(kit, M, x, z, rot) {
    const base = U.mat4(x, 0.24, z, 0, rot, 0);
    const put = function (mat, w, h, d, px, py, pz, r) {
      const g = U.roundedBox(w, h, d, r === undefined ? 0.06 : r);
      g.applyMatrix4(U.mat4(px, py, pz));
      g.applyMatrix4(base);
      kit.add(g, mat);
    };
    put(M.plinth, 13.2, 0.34, 2.3, 0, 0.62, 0, 0.08);
    put(M.blue, 2.6, 2.5, 2.35, 5.6, 1.6, 0, 0.16);
    put(M.plinth, 1.2, 0.6, 2.2, 4.2, 1.0, 0, 0.1);
    put(M.glass, 2.2, 0.9, 2.28, 5.9, 2.35, 0, 0.12);
    put(M.timber, 8.2, 0.22, 2.3, -1.2, 1.16, 0, 0.06);
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        put(M.steel, 0.12, 1.9, 0.12, -5.1 + i * 1.0, 2.2, sz * 1.1, 0.03);
      }
      for (const y of [1.6, 2.4, 3.1]) put(M.steel, 8.2, 0.1, 0.1, -1.2, y, sz * 1.1, 0.04);
    }
    put(M.steel, 0.12, 1.9, 2.3, -5.2, 2.2, 0, 0.03);
    for (const wx of [5.6, -4.4, -3.0]) {
      for (const wz of [-1.16, 1.16]) {
        const g = new THREE.CylinderGeometry(0.66, 0.66, 0.42, 16);
        g.applyMatrix4(U.mat4(0, 0, 0, Math.PI / 2, 0, 0));
        g.applyMatrix4(U.mat4(wx, 0.9, wz));
        g.applyMatrix4(base);
        kit.add(g, M.plinth);
      }
    }
  }

  /* ---------------- 交易中心停车场 ---------------- */
  function parkedCar(kit, M, x, z, rot, paint) {
    const base = U.mat4(x, 0.24, z, 0, rot, 0);
    const put = function (mat, w, h, d, px, py, pz, r) {
      const g = U.roundedBox(w, h, d, r === undefined ? 0.06 : r);
      g.applyMatrix4(U.mat4(px, py, pz));
      g.applyMatrix4(base);
      kit.add(g, mat);
    };
    put(M.plinth, 4.3, 0.34, 1.86, 0, 0.52, 0, 0.1);
    put(paint, 3.9, 0.66, 1.8, 0, 0.86, 0, 0.24);
    put(paint, 1.95, 0.6, 1.62, -0.15, 1.44, 0, 0.26);      // 车顶（跟车身同色，从上往下看才不是黑块）
    put(M.glass, 1.9, 0.34, 1.66, -0.15, 1.3, 0, 0.1);      // 一圈车窗带
    put(paint, 1.6, 0.16, 1.66, 1.5, 1.26, 0, 0.08);
    put(M.plinth, 3.9, 0.12, 1.7, 0, 0.44, 0, 0.04);
    for (const px of [1.32, -1.32]) {
      for (const pz of [-0.8, 0.8]) {
        const g = new THREE.CylinderGeometry(0.33, 0.33, 0.24, 12);
        g.applyMatrix4(U.mat4(0, 0, 0, Math.PI / 2, 0, 0));
        g.applyMatrix4(U.mat4(px, 0.38, pz));
        g.applyMatrix4(base);
        kit.add(g, M.plinth);
      }
    }
  }

  function buildParking(kit, M, world) {
    const P = L.market.parking;
    const st = P.stall || 2.7;
    const midZ = (P.z0 + P.z1) / 2;
    const aisle = P.aisle || 5.2;
    const rowD = Math.min(5.2, (P.z1 - P.z0 - aisle) / 2);
    const n = Math.floor((P.x1 - P.x0) / st);
    const paints = [M.wall, M.galv, M.red, M.blue, M.steelLight, M.timberLight, M.wall, M.galv];

    // 铺装与车位线
    U.box(kit, M.asphalt, P.x1 - P.x0, 0.1, P.z1 - P.z0, (P.x0 + P.x1) / 2, 0.29, midZ, 0, 0, 0, 2);
    for (let i = 0; i <= n; i++) {
      const x = P.x0 + i * st;
      U.box(kit, M.line, 0.14, 0.03, rowD - 0.5, x, 0.36, P.z0 + rowD / 2, 0, 0, 0, 0.02);
      U.box(kit, M.line, 0.14, 0.03, rowD - 0.5, x, 0.36, P.z1 - rowD / 2, 0, 0, 0, 0.02);
    }
    U.box(kit, M.line, P.x1 - P.x0, 0.03, 0.14, (P.x0 + P.x1) / 2, 0.36, midZ - aisle / 2);
    U.box(kit, M.line, P.x1 - P.x0, 0.03, 0.14, (P.x0 + P.x1) / 2, 0.36, midZ + aisle / 2);

    // 车位上的车（按固定节奏留空位，看着像停了大半）
    const order = [3, 1, 5, 2, 0, 4, 6, 2, 7, 0, 3, 5, 1, 4, 0, 6, 2, 7, 3, 1, 5, 0, 4, 2, 6, 3, 1, 0, 5, 2, 7, 4];
    let k = 0;
    for (let i = 0; i < n; i++) {
      const x = P.x0 + st * (i + 0.5);
      for (const half of [0, 1]) {
        const z = half === 0 ? P.z0 + rowD / 2 - 0.15 : P.z1 - rowD / 2 + 0.15;
        const rot = half === 0 ? Math.PI / 2 : -Math.PI / 2;
        if ((i * 3 + half * 5) % 7 === 2) { k++; continue; }
        parkedCar(kit, M, x, z, rot, paints[order[k % order.length]]);
        k++;
      }
    }

    // 车位灯 + 两个出入口
    for (const lx of [P.x0 + 10, P.x1 - 10, P.x0 + 34, P.x1 - 34]) {
      U.cyl(kit, M.steel, 0.08, 0.1, 5.0, 8, lx, 2.7, P.z1 - 1.0);
      U.box(kit, M.lamp, 0.7, 0.16, 0.5, lx, 5.15, P.z1 - 1.0);
      glowSprite(world, 0xffd7a0, 2.2, lx, 5.15, P.z1 - 1.0, 0.8);
      world.pools.push({ x: lx, z: midZ, size: 12, warm: 0.8 });
    }
    sign(world, 'P 员工停车场', 'STAFF PARKING · 48 车位', 7.6, 1.5, (P.x0 + P.x1) / 2, 3.1, P.z1 + 1.2, 0, {
      size: 72, subSize: 30, bg: 'rgba(8,12,14,0.9)', border: 'rgba(120,200,255,0.35)',
      glow: 'rgba(90,180,255,0.2)', color: '#d6ecff',
    });
    // 入口花箱
    for (const bx of [P.x0 - 3, P.x1 + 3]) {
      U.box(kit, M.concreteTrough, 1.6, 0.6, 1.6, bx, 0.5, midZ, 0, 0, 0, 0.14);
      U.box(kit, M.leafA, 1.35, 0.8, 1.35, bx, 1.0, midZ, 0, 0.4, 0, 0.3);
    }
    // 大厅门前几台临停
    parkedCar(kit, M, -8, 15.4, Math.PI * 0.5, M.steelLight);
    parkedCar(kit, M, 40, 15.4, Math.PI * 0.5, M.blue);
    parkedCar(kit, M, 45.5, 15.4, Math.PI * 0.5, M.wall);
  }

  /* ---------------- 入口 ---------------- */
  FL.buildBuildings = function (kit, M, world) {
    M.warmGlow.userData.noShadow = true;
    M.lamp.userData.noShadow = true;
    M.redBeam.userData.noShadow = true;

    for (const b of L.barns) buildBarn(b.mirror ? mirrorKit(kit, b.cx, b.cz) : kit, M, world, b);
    buildRamp(kit, M, world);
    buildWeigh(kit, M, world);
    buildGate(kit, M, world);
    buildOffice(kit, M, world);
    buildPlant(kit, M, world);
    buildDock(kit, M, world);
    buildLoader(kit, M, world, -114, 12, -Math.PI / 2);

    // 生产区与交易区的分界：围墙 + 活牛交易中心 + 员工办公楼
    buildCompoundWall(kit, M, world);
    buildTradingCenter(kit, M, world);
    buildStaffOffice(kit, M, world);
    buildParking(kit, M, world);


    // 接触阴影
    buildAO(world);

    // 料槽前的日粮光斑（喂料区）
    for (const b of L.barns) {
      world.pools.push({ x: b.cx, z: b.cz + 11, size: 14, warm: 0.35 });
    }
  };

})(window);
