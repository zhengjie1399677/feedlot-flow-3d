import * as THREE from 'three';
import { FL } from './fl.js';

/* =========================================================
 *  昼夜循环 —— 天光、月亮、场灯、雾、曝光随时刻一起变
 *  由 main.js 每帧喂一个 0..24 的小时数进来
 * ========================================================= */

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const smooth = (a, b, x) => {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  };
  const C = (r, g, b) => new THREE.Color(r, g, b);
  // 保亮度提饱和：颜色混到中间灰时把色相拉回来
  const saturate = (c, k) => {
    const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.r = Math.max(0, l + (c.r - l) * k);
    c.g = Math.max(0, l + (c.g - l) * k);
    c.b = Math.max(0, l + (c.b - l) * k);
    return c;
  };

  /* 三套配色：深夜 / 晨昏 / 正午 */
  const P = {
    night: {
      top: C(0.004, 0.008, 0.016), mid: C(0.012, 0.020, 0.032), hor: C(0.028, 0.032, 0.038),
      glow: C(0.055, 0.045, 0.032), key: C(0xc9dbff), sky: C(0x5b7fa6), ground: C(0x1a231d),
      fog: C(0x070c13), warm: C(0xffa06a), land: C(0.010, 0.013, 0.020), cloud: 0.10,
    },
    dusk: {
      top: C(0.030, 0.040, 0.090), mid: C(0.105, 0.070, 0.095), hor: C(0.62, 0.26, 0.10),
      glow: C(0.80, 0.30, 0.09), key: C(0xffb478), sky: C(0x6b6a90), ground: C(0x2c2119),
      fog: C(0x241a1a), warm: C(0xff9a58), land: C(0.140, 0.100, 0.086), cloud: 0.55,
    },
    day: {
      top: C(0.045, 0.150, 0.420), mid: C(0.115, 0.290, 0.620), hor: C(0.320, 0.500, 0.760),
      glow: C(0.20, 0.20, 0.20), key: C(0xfff2e0), sky: C(0x9fc6ea), ground: C(0x6d6a55),
      fog: C(0x9db6c9), warm: C(0xfff0d8), land: C(0.165, 0.215, 0.285), cloud: 0.30,
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
    const cFog = new THREE.Color();
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

    // 夜里 → 晨昏 → 白天 的三段权重混合（nightF 与 duskMix 一起决定）
    let mix3 = (n, d, y) => n;

    let lastHour = -999;

    let fogSpan = 0;
    const phaseOut = { night: 1, dusk: 0, day: 0, fogSpan: 0 };

    function setHour(hour) {
      const h = ((hour % 24) + 24) % 24;
      if (Math.abs(h - lastHour) < 0.002) return;
      lastHour = h;

      // 06:00 日出、19:30 日落
      const u = (h - 6) / 13.5;
      const s = Math.sin(Math.PI * u); // >0 表示太阳在地平线上
      const dayF = smooth(-0.02, 0.16, s);
      const nightF = 1 - smooth(-0.09, 0.005, s);
      // 太阳高度角 17° 时（18:20 前后）就该是金色了，原来 0.24 的窗口到这里已经衰减成 0，
      // 画面就停在"白天蓝 + 一点粉"的灰调上
      const duskF = clamp01(1 - Math.abs(s) / 0.30) * (1 - nightF * 0.7);
      duskMix = clamp01(1 - Math.abs(s) / 0.60) * (1 - nightF);
      mix3 = (n, d, y) => n * nightF + (d * duskMix + y * (1 - duskMix)) * (1 - nightF);

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
        // 蓝和橙在 RGB 里直接插值会经过灰色，18:20 前后这片天就是这么变成"灰粉"的。
        // 过渡中段把饱和度补回来：两端不动，中点最猛。
        const satK = 1 + 0.85 * (4 * duskMix * (1 - duskMix));
        if (satK > 1.001) {
          saturate(cMid, satK);
          saturate(cHor, satK);
          saturate(cGlow, satK * 1.05);
        }
        azVec.set(Math.cos(az), 0, Math.sin(az));
        sky.setSky(cTop, cMid, cHor, cGlow, azVec, 1.0);
        // 环境图跟着同一套颜色重烘，金属/玻璃的反光才不会永远是夜空
        if (FL.env && FL.env.update) FL.env.update(cTop, cMid, cHor, cGlow, azVec);
        // 地平线以下的地气与云量：让场地边缘不再是一刀切进天空
        if (sky.setLand) sky.setLand(blend(P.night.land, P.dusk.land, P.day.land, nightF, dayF));
        if (sky.setCloud) sky.setCloud(P.night.cloud * nightF + P.dusk.cloud * duskMix + P.day.cloud * dayF * (1 - duskMix));
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
      if (sky && sky.setSun) {
        cSun.copy(dayKey);
        sky.setSun(sunPos, cSun, 1.0 + duskF * 0.5, clamp01(1 - nightF) * 0.85 + duskF * 0.15);
      }
      key.position.copy(sunPos).lerp(moonPos, nightF);
      key.color.copy(blend(P.night.key, P.dusk.key, dayKey, nightF, dayF));
      // 主光：正午 9.4 / 黄昏 5.4 / 夜 6.6（月光）
      key.intensity = mix3(6.6, 5.4, 9.4);

      /* ---- 环境光 / 暖补光 / 侧补光 ---- */
      hemi.color.copy(blend(P.night.sky, P.dusk.sky, P.day.sky, nightF, dayF));
      hemi.groundColor.copy(blend(P.night.ground, P.dusk.ground, P.day.ground, nightF, dayF));
      // 环境光压到主光的 1/3 以下，阴影才有形状
      hemi.intensity = mix3(2.0, 1.05, 1.15);
      warm.color.copy(blend(P.night.warm, P.dusk.warm, P.day.warm, nightF, dayF));
      warm.intensity = mix3(1.4, 0.95, 0.42);
      fill.intensity = mix3(1.2, 0.60, 0.34);

      /* ---- 场内灯具（白天基本关掉）---- */
      const lampF = 0.08 + 0.92 * nightF;
      for (let i = 0; i < pts.length; i++) {
        pts[i].intensity = ptBase[i] * lampF;
        pts[i].userData.dayBase = pts[i].intensity;
      }
      for (let i = 0; i < poolMats.length; i++) poolMats[i].opacity = poolBase[i] * (0.10 + 0.90 * nightF);
      for (let i = 0; i < sprites.length; i++) sprites[i].material.opacity = spriteBase[i] * (0.15 + 0.85 * nightF);
      for (let i = 0; i < glowMats.length; i++) glowMats[i].emissiveIntensity = glowBase[i] * (0.10 + 0.90 * nightF);
      if (world.coneMat) world.coneMat.uniforms.uOpacity.value = 0.16 * (0.10 + 0.90 * nightF);
      if (baseGlowMat) baseGlowMat.opacity = baseGlowBase * (0.30 + 0.70 * nightF);

      /* ---- 雾与曝光 ---- */
      if (scene.fog) {
        // 雾色必须等于看向地平线时看到的颜色，否则远景和天空之间会有一条缝
        cFog.copy(P.night.fog).lerp(cHor, 1 - nightF).lerp(cGlow, 0.22 * duskMix);
        scene.fog.color.copy(cFog);
        // 雾的起点只是「下限」：主循环会按相机距离把它推到场地之外，
        // 否则镜头一拉远，场地本体自己就先被雾糊住了（雾该吃的是远景）
        fogSpan = mix3(1150, 1450, 2000);
        scene.fog.near = mix3(180, 240, 300);
        scene.fog.far = scene.fog.near + fogSpan;
        // 地平线以下的地色直接取雾色：远处地形吃成全雾色后与天空无缝
        if (sky && sky.setLand) sky.setLand(cFog);
      }
      if (pipe && pipe.setExposure) pipe.setExposure(mix3(1.30, 1.18, 0.98));

      // 供 UI 判断时段
      phaseOut.night = nightF; phaseOut.dusk = duskF; phaseOut.day = dayF;
      phaseOut.fogSpan = fogSpan;
      return phaseOut;
    }

    return { setHour: setHour };
  };
