/* =========================================================
 *  昼夜循环 —— 天光、月亮、场灯、雾、曝光随时刻一起变
 *  由 main.js 每帧喂一个 0..24 的小时数进来
 * ========================================================= */
(function (window) {
  'use strict';
  const THREE = window.THREE;
  const FL = (window.FL = window.FL || {});

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const C = (r, g, b) => new THREE.Color(r, g, b);

  /* 三套配色：深夜 / 晨昏 / 正午 */
  const P = {
    night: {
      top: C(0.004, 0.008, 0.016), mid: C(0.012, 0.020, 0.032), hor: C(0.028, 0.032, 0.038),
      glow: C(0.055, 0.045, 0.032), key: C(0xc9dbff), sky: C(0x5b7fa6), ground: C(0x1a231d),
      fog: C(0x070c13), warm: C(0xffa06a),
    },
    dusk: {
      top: C(0.030, 0.040, 0.090), mid: C(0.105, 0.070, 0.095), hor: C(0.62, 0.26, 0.10),
      glow: C(0.80, 0.30, 0.09), key: C(0xffb478), sky: C(0x6b6a90), ground: C(0x2c2119),
      fog: C(0x241a1a), warm: C(0xff9a58),
    },
    day: {
      top: C(0.045, 0.150, 0.420), mid: C(0.115, 0.290, 0.620), hor: C(0.320, 0.500, 0.760),
      glow: C(0.20, 0.20, 0.20), key: C(0xfff2e0), sky: C(0x9fc6ea), ground: C(0x6d6a55),
      fog: C(0x9db6c9), warm: C(0xfff0d8),
    },
  };

  FL.createDay = function (scene, world, sky, pipe) {
    const L = world.lights;
    const key = L.moon; // 同一个主光：白天当太阳，夜里当月亮（只占一张阴影图）
    const hemi = L.hemi;
    const warm = L.warm;
    const fill = L.fill;

    const mats = world.mats || {};
    const glowMats = [mats.lamp, mats.warmGlow, mats.redBeam, mats.waterGlow].filter(Boolean);
    const glowBase = glowMats.map((m) => (m.emissiveIntensity === undefined ? 1 : m.emissiveIntensity));

    const pts = world.pointLights || [];
    const ptBase = pts.map((p) => p.intensity);

    const poolMats = world.poolMats || [];
    const poolBase = poolMats.map((m) => m.opacity);

    const sprites = world.lampSprites || [];
    const spriteBase = sprites.map((s) => s.material.opacity);

    const baseGlowMat = world.baseGlowMat || null;
    const baseGlowBase = baseGlowMat ? baseGlowMat.opacity : 0;

    const sunPos = new THREE.Vector3();
    const moonPos = new THREE.Vector3(-200, 285, 220);
    const tmp = new THREE.Color();
    const cTop = new THREE.Color();
    const cMid = new THREE.Color();
    const cHor = new THREE.Color();
    const cGlow = new THREE.Color();
    const cSun = new THREE.Color();
    const cWhite = new THREE.Color(0xfff6ea);
    const cGold = new THREE.Color(0xff9a45);
    const dayKey = new THREE.Color();
    const azVec = new THREE.Vector3();
    const moonDirTmp = new THREE.Vector3();

    /* 夜 → 日 插值，再按晨昏权重压一层暖调 */
    let duskMix = 0;
    function blend(night, dusk, day, nightF, dayF) {
      return tmp.copy(night).lerp(day, dayF).lerp(dusk, duskMix);
    }

    let lastHour = -999;

    function setHour(hour) {
      const h = ((hour % 24) + 24) % 24;
      if (Math.abs(h - lastHour) < 0.002) return;
      lastHour = h;

      // 06:00 日出、19:30 日落
      const u = (h - 6) / 13.5;
      const s = Math.sin(Math.PI * u); // >0 表示太阳在地平线上
      const dayF = smooth(-0.02, 0.16, s);
      const nightF = 1 - smooth(-0.09, 0.005, s);
      const duskF = clamp01(1 - Math.abs(s) / 0.24) * (1 - nightF * 0.7);
      duskMix = clamp01(1 - Math.abs(s) / 0.42) * (1 - nightF);

      /* ---- 太阳 / 月亮方位（天空与主光共用） ---- */
      const az = -0.30 + Math.PI * clamp01(u);
      const el = Math.max(0.045, s) * 1.12;
      const ce = Math.cos(el);
      sunPos.set(Math.cos(az) * ce * 400, Math.sin(el) * 400 + 45, Math.sin(az) * ce * 400 * 0.92);

      /* ---- 天空穹顶（顶点色） ---- */
      if (sky && sky.setSky) {
        cTop.copy(blend(P.night.top, P.dusk.top, P.day.top, nightF, dayF));
        cMid.copy(blend(P.night.mid, P.dusk.mid, P.day.mid, nightF, dayF));
        cHor.copy(blend(P.night.hor, P.dusk.hor, P.day.hor, nightF, dayF));
        cGlow.copy(blend(P.night.glow, P.dusk.glow, P.day.glow, nightF, dayF));
        azVec.set(Math.cos(az), 0, Math.sin(az));
        sky.setSky(cTop, cMid, cHor, cGlow, azVec, 1.0);
        if (sky.stars) {
          sky.stars.material.opacity = 0.55 * nightF;
          sky.stars.visible = nightF > 0.02;
        }
        if (sky.setSun) {
          moonDirTmp.copy(moonPos).normalize();
          sky.setMoon(moonDirTmp, 1.0, nightF * 0.95);
        }
      }

      /* ---- 主光：太阳 / 月亮 ---- */
      // 夜里把主光挪到月亮那边（位置过渡是平滑的，阴影方向会跟着转）
      // 太阳色温与强度分开随高度角走：低角度偏金偏弱，正午偏白偏强
      const hiF = smooth(0.10, 0.68, s);
      dayKey.copy(cGold).lerp(cWhite, hiF);
      const dayI = 2.3 + 3.9 * hiF;
      if (sky && sky.setSun) {
        cSun.copy(dayKey);
        sky.setSun(sunPos, cSun, 1.0 + duskF * 0.5, clamp01(1 - nightF) * 0.85 + duskF * 0.15);
      }
      key.position.copy(sunPos).lerp(moonPos, nightF);
      key.color.copy(blend(P.night.key, P.dusk.key, dayKey, nightF, dayF));
      key.intensity = 6.4 * nightF + (1 - nightF) * (dayI * dayF + 2.6 * duskF);

      /* ---- 环境光 / 暖补光 / 侧补光 ---- */
      hemi.color.copy(blend(P.night.sky, P.dusk.sky, P.day.sky, nightF, dayF));
      hemi.groundColor.copy(blend(P.night.ground, P.dusk.ground, P.day.ground, nightF, dayF));
      hemi.intensity = 2.1 * nightF + 2.2 * duskF + 2.05 * dayF;
      warm.color.copy(blend(P.night.warm, P.dusk.warm, P.day.warm, nightF, dayF));
      warm.intensity = 1.5 * nightF + 1.9 * duskF + 0.7 * dayF;
      fill.intensity = 1.3 * nightF + 1.0 * duskF + 0.55 * dayF;

      /* ---- 场内灯具（白天基本关掉）---- */
      const lampF = 0.08 + 0.92 * nightF;
      for (let i = 0; i < pts.length; i++) {
        pts[i].intensity = ptBase[i] * lampF;
        pts[i].userData.dayBase = pts[i].intensity;
      }
      for (let i = 0; i < poolMats.length; i++) poolMats[i].opacity = poolBase[i] * (0.10 + 0.90 * nightF);
      for (let i = 0; i < sprites.length; i++) sprites[i].material.opacity = spriteBase[i] * (0.15 + 0.85 * nightF);
      for (let i = 0; i < glowMats.length; i++) glowMats[i].emissiveIntensity = glowBase[i] * (0.34 + 0.66 * nightF);
      if (world.coneMat) world.coneMat.uniforms.uOpacity.value = 0.16 * (0.10 + 0.90 * nightF);
      if (baseGlowMat) baseGlowMat.opacity = baseGlowBase * (0.30 + 0.70 * nightF);

      /* ---- 雾与曝光 ---- */
      if (scene.fog) {
        scene.fog.color.copy(blend(P.night.fog, P.dusk.fog, P.day.fog, nightF, dayF));
        scene.fog.density = 0.0016 * nightF + 0.0009 * duskF + 0.00045 * dayF;
      }
      if (pipe && pipe.setExposure) pipe.setExposure(1.36 * nightF + 1.18 * duskF + 1.06 * dayF);

      // 供 UI 判断时段
      return { night: nightF, dusk: duskF, day: dayF };
    }

    return { setHour: setHour };
  };
})(window);
