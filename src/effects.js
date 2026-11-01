import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { FL } from './fl.js';

/* ============================================================
 *  effects.js — 环境光照 / 天空 / 相机 / 泛光后处理
 * ============================================================ */
  const U = FL.U;
  const L = FL.LAYOUT;

  /* ---------------- 环境贴图 ---------------- */
  // 环境图用 Poly Haven 的 CC0 全景图（土默川那种干爽天空），按时段挑一张，
  // 转成 PMREM 交给 scene.environment。程序化那张 canvas 图留作兜底：
  // 文件没到位、或者 .hdr 解析失败时仍然能有一个跟天光同步的反射。
  FL.createEnvironment = function (scene, renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();

    const w = 256, h = 128;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    let rt = null;
    const last = { r: -9, g: -9, b: -9, sun: new THREE.Vector2(0, 0) };
    let phaseKey = 'day';

    /* --- 四张 CC0 全景图，按天光强度缩放 --- */
    const FILES = {
      dawn: 'hdri/qwantani_dawn_puresky.hdr',
      day: 'hdri/qwantani_noon_puresky.hdr',
      dusk: 'hdri/qwantani_sunset_puresky.hdr',
      night: 'hdri/qwantani_night_puresky.hdr',
    };
    const INTENSITY = { dawn: 0.05, day: 0.10, dusk: 0.035, night: 0.08 };
    const envs = {};
    const loading = {};

    function ensureEnv(key) {
      if (envs[key] || loading[key]) return;
      loading[key] = true;
      new RGBELoader().load(FILES[key], function (t) {
        t.mapping = THREE.EquirectangularReflectionMapping;
        const out = pmrem.fromEquirectangular(t);
        envs[key] = out.texture;
        loading[key] = false;
        t.dispose();
        if (key === phaseKey) apply(key);
      }, undefined, function () {
        loading[key] = false;
      });
    }

    function apply(key) {
      const e = envs[key];
      if (!e) return false;
      scene.environment = e;
      scene.environmentIntensity = INTENSITY[key] || 1;
      return true;
    }

    /* --- 程序化兜底 --- */
    function paint(top, mid, hor, glow, sunDir) {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0.0, '#' + top.getHexString());
      g.addColorStop(0.34, '#' + mid.getHexString());
      g.addColorStop(0.49, '#' + hor.getHexString());
      g.addColorStop(0.56, '#' + hor.clone().multiplyScalar(0.45).getHexString());
      g.addColorStop(1.0, '#0b0d0b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (sunDir) {
        const sx = ((Math.atan2(sunDir.x, sunDir.z) / (Math.PI * 2)) + 0.5) * w;
        const sy = h * 0.44;
        const rg = ctx.createRadialGradient(sx, sy, 0, sx, sy, w * 0.22);
        rg.addColorStop(0, 'rgba(' + [
          Math.round(255 * Math.min(1, glow.r * 1.6 + 0.15)),
          Math.round(255 * Math.min(1, glow.g * 1.6 + 0.12)),
          Math.round(255 * Math.min(1, glow.b * 1.6 + 0.10)),
        ].join(',') + ',0.95)');
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(0, 0, w, h);
        const bx = (sx + w / 2) % w;
        const bg = ctx.createRadialGradient(bx, h * 0.5, 0, bx, h * 0.5, w * 0.3);
        bg.addColorStop(0, 'rgba(120,140,170,0.22)');
        bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }
      tex.needsUpdate = true;
    }

    function rebuild(top, mid, hor, glow, sunDir) {
      paint(top, mid, hor, glow, sunDir);
      const next = pmrem.fromEquirectangular(tex);
      scene.environment = next.texture;
      scene.environmentIntensity = 1;
      if (rt) rt.dispose();
      rt = next;
    }

    rebuild(new THREE.Color(0.16, 0.21, 0.30), new THREE.Color(0.42, 0.47, 0.55),
      new THREE.Color(0.72, 0.68, 0.60), new THREE.Color(1.0, 0.72, 0.42), null);

    return {
      update: function (top, mid, hor, glow, sunDir, nightF, duskF, dayF) {
        if (!top) return;
        const dr = Math.abs(top.r - last.r) + Math.abs(mid.g - last.g) + Math.abs(hor.b - last.b);
        const sunMoved = sunDir ? Math.hypot(sunDir.x - last.sun.x, sunDir.z - last.sun.y) : 0;
        if (dr < 0.05 && sunMoved < 0.06) return;
        last.r = top.r; last.g = mid.g; last.b = hor.b;
        if (sunDir) { last.sun.x = sunDir.x; last.sun.y = sunDir.z; }

        // 哪一段当权重最大就用哪一张全景图；四张都预取，切换时不用等
        const night = nightF == null ? 0 : nightF;
        const dusk = duskF == null ? 0 : duskF;
        const day = dayF == null ? 0 : dayF;
        let key = 'day';
        if (night > 0.6) key = 'night';
        else if (dusk > 0.55) key = 'dusk';
        else if (night > 0.32) key = night > dusk ? 'night' : 'dusk';
        else if (dusk > 0.28 && day < 0.55) key = 'dusk';
        else if (dusk > 0.15 && day < 0.35) key = 'dawn';
        phaseKey = key;

        ensureEnv(key);
        if (!apply(key)) rebuild(top, mid, hor, glow, sunDir);
      },
      preload: function () { Object.keys(FILES).forEach(ensureEnv); },
    };
  };

  /* ---------------- 天空 / 星空 / 灯柱 ---------------- */
  FL.createSky = function (scene, world) {
    // 穹顶用一个小 shader 逐像素画：竖直梯度 + 地平线暖带 + 日/月晕 + 薄云 + 地平线下地气。
    // 用 shader 而不是顶点色的原因：地平线那圈渐变在 0.18 的球体高度里就完成，
    // 28 段球体每段 ~6°，等于把渐变压成了一条硬边，黄昏一出就是一条横带。
    // 注意：pow() 的底数一旦为负会得到 NaN，在 ANGLE 上表现为整片黑块——这里所有
    // pow 的底数都先夹到非负（历史上就栽在这上面，所以天空一直退回顶点色）。
    const skyGeo = new THREE.SphereGeometry(9000, 48, 32);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
      uniforms: {
        uTop: { value: new THREE.Color(0.030, 0.040, 0.090) },
        uMid: { value: new THREE.Color(0.105, 0.070, 0.095) },
        uHor: { value: new THREE.Color(0.620, 0.260, 0.100) },
        uLand: { value: new THREE.Color(0.055, 0.048, 0.045) },
        uGlow: { value: new THREE.Color(0.80, 0.30, 0.09) },
        uGlowI: { value: 1.0 },
        uSun: { value: new THREE.Vector3(0.3, 0.1, 0.9).normalize() },
        uSunCol: { value: new THREE.Color(1.0, 0.72, 0.42) },
        uSunI: { value: 1.0 },
        uCloudI: { value: 0.5 },
        uTime: { value: 0 },
      },
      vertexShader: [
        'varying vec3 vDir;',
        'void main() {',
        '  vDir = position;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'varying vec3 vDir;',
        'uniform vec3 uTop, uMid, uHor, uLand, uGlow, uSunCol, uSun;',
        'uniform float uGlowI, uSunI, uCloudI, uTime;',
        '',
        'float hash21(vec2 p) {',
        '  p = fract(p * vec2(123.34, 345.45));',
        '  p += dot(p, p + 34.345);',
        '  return fract(p.x * p.y);',
        '}',
        'float vnoise(vec2 p) {',
        '  vec2 i = floor(p), f = fract(p);',
        '  f = f * f * (3.0 - 2.0 * f);',
        '  float a = hash21(i);',
        '  float b = hash21(i + vec2(1.0, 0.0));',
        '  float c = hash21(i + vec2(0.0, 1.0));',
        '  float d = hash21(i + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
        '}',
        'float fbm(vec2 p) {',
        '  float s = 0.0, a = 0.55;',
        '  for (int i = 0; i < 4; i++) {',
        '    s += a * vnoise(p);',
        '    p = p * 2.03 + 17.0;',
        '    a *= 0.5;',
        '  }',
        '  return s;',
        '}',
        '',
        'void main() {',
        '  vec3 d = normalize(vDir);',
        '  float y = d.y;',
        '  float hy = max(y, 0.0);',
        '  vec3 sun = normalize(uSun);',
        // 只取水平分量做方位权重，太阳落下去时暖带才会沿地平线铺开
        '  vec3 dh = normalize(vec3(d.x, 0.0, d.z) + vec3(1e-5));',
        '  vec3 sh = normalize(vec3(sun.x, 0.0, sun.z) + vec3(1e-5));',
        '  float az = max(0.0, dot(dh, sh));',
        '',
        // 竖直梯度：地平线 → 中段 → 天顶，三段用 smoothstep 过渡（逐像素，没有分段硬边）
        '  vec3 col = mix(uHor, uMid, smoothstep(0.0, 0.16, hy));',
        '  col = mix(col, uTop, smoothstep(0.10, 0.62, hy));',
        '',
        // 地平线暖带：朝太阳方位最亮，两侧迅速衰减
        '  float band = (1.0 - smoothstep(0.0, 0.30, hy)) * smoothstep(-0.05, 0.02, y);',
        '  col += uGlow * pow(az, 3.0) * band * uGlowI;',
        '',
        // 日晕：一级宽散射 + 二级紧贴核心，日落时整片天会跟着橙
        '  float sd = max(0.0, dot(d, sun));',
        '  col += uSunCol * (pow(sd, 8.0) * 0.16 + pow(sd, 220.0) * 0.95) * uSunI;',
        '',
        // 薄云：把视线投到一块高空平面上取 fbm，纯装饰，不参与光照
        '  if (uCloudI > 0.002 && y > 0.012) {',
        '    vec2 cuv = d.xz / max(y, 0.05) * 0.11;',
        '    cuv += vec2(uTime * 0.0032, uTime * 0.0011);',
        // 覆盖率靠 smoothstep 的下限压住：fbm 的均值在 0.5 附近，
        // 下限给低了整片天都会糊上一层灰
        '    float c = smoothstep(0.58, 0.86, fbm(cuv * 1.9));',
        '    float alt = smoothstep(0.012, 0.10, y) * (1.0 - smoothstep(0.70, 1.0, y) * 0.45);',
        '    vec3 lit = mix(uMid * 2.4 + uHor * 1.0, uSunCol * 1.35, 0.25 + 0.75 * pow(az, 4.0));',
        '    col = mix(col, lit, c * alt * uCloudI);',
        '  }',
        '',
        // 地平线以下：地气（远景地面会在这里接上），避免场地像一块浮板
        '  if (y < 0.0) {',
        '    col = mix(uHor, uLand, smoothstep(0.0, -0.45, y) * 0.85);',
        '  }',
        '',
        '  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);',
        '}',
      ].join('\n'),
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    // 日/月圆盘：一张径向渐变的软圆片，贴在穹顶上朝向球心
    const discTex = (function () {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 128;
      const ctx = cv.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0.0, 'rgba(255,255,255,1)');
      g.addColorStop(0.34, 'rgba(255,255,255,1)');
      g.addColorStop(0.52, 'rgba(255,255,255,0.22)');
      g.addColorStop(1.0, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const makeDisc = function (size, color) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: discTex, color: color, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
        }));
      m.frustumCulled = false;
      m.renderOrder = -9;
      scene.add(m);
      return m;
    };
    const sunDisc = makeDisc(170, 0xffe6bd);
    const moonDisc = makeDisc(96, 0xdfe9ff);

    // 星空
    const N = 520;
    const sp = new Float32Array(N * 3);
    const rnd = U.rng(771);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.12 + rnd() * 0.85;
      const r = Math.sqrt(1 - y * y);
      const R = 1000;
      sp[i * 3] = Math.cos(a) * r * R;
      sp[i * 3 + 1] = y * R;
      sp[i * 3 + 2] = Math.sin(a) * r * R;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xadc8e8, size: 1.7, sizeAttenuation: false, transparent: true,
      opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    stars.frustumCulled = false;
    scene.add(stars);

    // 灯柱体积光（很淡）
    const coneGeo = new THREE.ConeGeometry(5.4, 9.6, 20, 1, true);
    const coneMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      uniforms: {
        uColor: { value: new THREE.Color(0xffb268).convertSRGBToLinear() },
        uOpacity: { value: 0.16 },
      },
      vertexShader:
        'varying vec2 vUv; varying vec3 vN; varying vec3 vV;\n' +
        'void main(){\n' +
        '  vUv = uv;\n' +
        '  vec4 wp = modelMatrix * vec4(position,1.0);\n' +
        '  vN = normalize(mat3(modelMatrix) * normal);\n' +
        '  vV = normalize(cameraPosition - wp.xyz);\n' +
        '  gl_Position = projectionMatrix * viewMatrix * wp;\n' +
        '}',
      fragmentShader:
        'varying vec2 vUv; varying vec3 vN; varying vec3 vV;\n' +
        'uniform vec3 uColor; uniform float uOpacity;\n' +
        'void main(){\n' +
        // pow() 的底数为负会得到 NaN（真实 GPU 上表现为黑块），这里全部夹到非负
        '  float facing = max(0.0, 1.0 - abs(dot(normalize(vN), normalize(vV))));\n' +
        '  float edge = pow(facing, 2.2);\n' +
        '  float fade = pow(max(vUv.y, 0.0), 2.4) * 0.85 + 0.15;\n' +
        '  float a = edge * fade * uOpacity;\n' +
        '  gl_FragColor = vec4(uColor * a, a);\n' +
        '}',
    });
    for (const head of world.lampHeads) {
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(head.x, 4.9, head.z);
      cone.renderOrder = 5;
      scene.add(cone);
    }

    // 用线性雾而不是 FogExp2：指数雾在 400m 处就吃掉一半反差，整个场地都会被罩灰，
    // 而场景本体只有 254m，需要的是"远处褪色"而不是"整体压灰"
    scene.fog = new THREE.Fog(0x070c13, 260, 1800);

    const U2 = skyMat.uniforms;
    const api = {
      mesh: sky,
      stars: stars,
      coneMat: coneMat,
      mat: skyMat,
      sunDisc: sunDisc,
      moonDisc: moonDisc,
      // 三段竖直配色 + 地平线暖带；太阳方位由 setSun 喂进来的 uSun 决定
      setSky: function (top, mid, hor, glowCol, glowAz, glowI) {
        U2.uTop.value.copy(top);
        U2.uMid.value.copy(mid);
        U2.uHor.value.copy(hor);
        if (glowCol) U2.uGlow.value.copy(glowCol);
        U2.uGlowI.value = glowI == null ? 1 : glowI;
      },
      // 地平线以下的地气颜色（白天是灰绿的远野，夜里接近全黑）
      setLand: function (col) { U2.uLand.value.copy(col); },
      // 云的密度：0 完全无云
      setCloud: function (i) { U2.uCloudI.value = i; },
      update: function (dt) { U2.uTime.value += dt; },
      setSun: function (dir, color, scale, opacity) {
        U2.uSun.value.copy(dir).normalize();
        if (color) U2.uSunCol.value.copy(color);
        U2.uSunI.value = Math.min(1.4, Math.max(0, opacity));
        sunDisc.position.copy(dir).normalize().multiplyScalar(1120);
        sunDisc.lookAt(0, 0, 0);
        sunDisc.material.color.copy(color);
        sunDisc.material.opacity = Math.min(1, Math.max(0, opacity));
        sunDisc.scale.setScalar(scale);
      },
      setMoon: function (dir, scale, opacity) {
        moonDisc.position.copy(dir).normalize().multiplyScalar(1120);
        moonDisc.lookAt(0, 0, 0);
        moonDisc.material.opacity = Math.min(1, Math.max(0, opacity));
        moonDisc.scale.setScalar(scale);
      },
    };
    world.sky = api;
    world.coneMat = coneMat;
    return api;
  };

  /* ---------------- 相机 ---------------- */
  FL.createCameraRig = function (camera, dom) {
    const presets = L.cameras;
    const base = 336;
    const state = {
      theta: 0.62, phi: 0.98, dist: base, target: new THREE.Vector3(-4, 0, -10),
    };
    const goal = {
      theta: state.theta, phi: state.phi, dist: state.dist, target: state.target.clone(),
    };
    let dragging = false;
    let panning = false;
    let lastX = 0, lastY = 0;
    let vTheta = 0, vPhi = 0;
    let pointers = new Map();
    let pinchDist = 0;
    let lastMid = null;
    let interacting = false;
    let lastInteract = -1e9;
    const keys = new Set();

    const clampPhi = (v) => Math.max(0.36, Math.min(1.2, v));
    const clampDist = (v) => Math.max(base / 7, Math.min(base * 1.75, v));

    // 自由视角：允许把镜头中心挪到地块上任意位置（夹在地块范围内）
    const PAN_X = 118, PAN_Z = 92;
    function clampTarget(t) {
      t.x = Math.max(-PAN_X, Math.min(PAN_X, t.x));
      t.z = Math.max(-PAN_Z, Math.min(PAN_Z, t.z));
      t.y = Math.max(0, Math.min(16, t.y));
      return t;
    }
    // du 沿屏幕右、dv 沿屏幕里（都以米为单位）
    function panWorld(du, dv) {
      const c = Math.cos(goal.theta), s = Math.sin(goal.theta);
      goal.target.x += c * du - s * dv;
      goal.target.z += -s * du - c * dv;
      clampTarget(goal.target);
      lastInteract = performance.now();
    }
    function panScreen(dxPx, dyPx) {
      const h = Math.max(240, dom.clientHeight || 900);
      const scale = (2 * goal.dist * Math.tan((camera.fov * Math.PI) / 360)) / h;
      panWorld(-dxPx * scale, dyPx * scale);
    }

    function place() {
      const sp = Math.sin(state.phi);
      camera.position.set(
        state.target.x + state.dist * sp * Math.sin(state.theta),
        state.target.y + state.dist * Math.cos(state.phi),
        state.target.z + state.dist * sp * Math.cos(state.theta)
      );
      camera.lookAt(state.target);
    }
    place();

    function onDown(e) {
      if (e.target !== dom) return;
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        // 右键 / 中键 / Shift + 拖拽 = 平移，否则旋转
        panning = e.button === 2 || e.button === 1 || e.shiftKey || e.altKey;
        dragging = !panning;
        lastX = e.clientX;
        lastY = e.clientY;
        vTheta = vPhi = 0;
      } else if (pointers.size === 2) {
        const p = Array.from(pointers.values());
        pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        lastMid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
      }
      interacting = true;
      lastInteract = performance.now();
    }
    function onMove(e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const p = Array.from(pointers.values());
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        if (pinchDist > 0) {
          goal.dist = clampDist(goal.dist * (pinchDist / Math.max(1, d)));
        }
        pinchDist = d;
        const mid = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        if (lastMid) panScreen(mid.x - lastMid.x, mid.y - lastMid.y);
        lastMid = mid;
        return;
      }
      if (!dragging && !panning) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (panning) { panScreen(dx, dy); return; }
      vTheta = -dx * 0.0034;
      vPhi = -dy * 0.0028;
      goal.theta += vTheta;
      goal.phi = clampPhi(goal.phi + vPhi);
      lastInteract = performance.now();
    }
    function onUp(e) {
      pointers.delete(e.pointerId);
      lastMid = null;
      if (pointers.size === 0) { dragging = false; panning = false; }
      else if (pointers.size === 1) {
        const p = Array.from(pointers.values())[0];
        lastX = p.x; lastY = p.y;
      }
      interacting = false;
      lastInteract = performance.now();
    }
    function onWheel(e) {
      e.preventDefault();
      goal.dist = clampDist(goal.dist * Math.pow(1.0016, e.deltaY));
      lastInteract = performance.now();
    }

    dom.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('dblclick', () => rig.goPreset('overview', true));
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    const rig = {
      presets: presets,
      state: state,
      goPreset: function (id, instant) {
        const p = presets.find((x) => x.id === id) || presets[0];
        goal.theta = p.theta;
        goal.phi = p.phi;
        goal.dist = base / p.zoom;
        goal.target.set(p.target[0], p.target[1], p.target[2]);
        if (instant) {
          state.theta = goal.theta; state.phi = goal.phi; state.dist = goal.dist;
          state.target.copy(goal.target);
          place();
        }
        lastInteract = performance.now();
      },
      // 直接指定镜头中心（供 ?pan=x,z 与双指/程序化定位使用）
      panTo: function (x, z, instant) {
        goal.target.x = x;
        goal.target.z = z;
        clampTarget(goal.target);
        if (instant) { state.target.copy(goal.target); place(); }
        lastInteract = performance.now();
      },
      update: function (dt) {
        if (keys.size) {
          let du = 0, dv = 0;
          if (keys.has('l')) du -= 1;
          if (keys.has('r')) du += 1;
          if (keys.has('u')) dv += 1;
          if (keys.has('d')) dv -= 1;
          if (du || dv) {
            const speed = goal.dist * 0.55 * dt;
            panWorld(du * speed, dv * speed);
          }
        }
        if (!dragging && (Math.abs(vTheta) + Math.abs(vPhi)) > 0.00001) {
          goal.theta += vTheta;
          goal.phi = clampPhi(goal.phi + vPhi);
          vTheta *= 0.9;
          vPhi *= 0.9;
        }
        const k = 1 - Math.exp(-dt * 5.2);
        state.theta += (goal.theta - state.theta) * k;
        state.phi += (goal.phi - state.phi) * k;
        state.dist += (goal.dist - state.dist) * k;
        state.target.lerp(goal.target, k);
        place();
      },
      get zoom() { return base / state.dist; },
      get dist() { return state.dist; },
    };
    const PAN_KEYS = { arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r', arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd' };
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (PAN_KEYS[k]) { keys.add(PAN_KEYS[k]); e.preventDefault(); return; }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= presets.length) rig.goPreset(presets[n - 1].id);
    });
    window.addEventListener('keyup', (e) => {
      const k = PAN_KEYS[e.key.toLowerCase()];
      if (k) keys.delete(k);
    });
    window.addEventListener('blur', () => keys.clear());
    return rig;
  };

  /* ---------------- 泛光后处理 ---------------- */
  FL.createPipeline = function (renderer, opts) {
    opts = opts || {};
    const enabled = opts.enabled !== false;
    const gl2 = renderer.capabilities.isWebGL2;
    const rtOpts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    };
    const sceneRT = new THREE.WebGLRenderTarget(1, 1, Object.assign({}, rtOpts, {
      samples: gl2 ? 4 : 0,
    }));
    const brightRT = new THREE.WebGLRenderTarget(1, 1, Object.assign({}, rtOpts, { depthBuffer: false }));
    const blurA = new THREE.WebGLRenderTarget(1, 1, Object.assign({}, rtOpts, { depthBuffer: false }));
    const blurB = new THREE.WebGLRenderTarget(1, 1, Object.assign({}, rtOpts, { depthBuffer: false }));

    const quadScene = new THREE.Scene();
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    quad.frustumCulled = false;
    quadScene.add(quad);

    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

    const brightMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uThreshold: { value: 0.92 },
        uKnee: { value: 0.55 },
      },
      vertexShader: VS,
      fragmentShader:
        'varying vec2 vUv; uniform sampler2D tDiffuse; uniform float uThreshold; uniform float uKnee;\n' +
        'void main(){\n' +
        '  vec3 c = texture2D(tDiffuse, vUv).rgb;\n' +
        '  float l = max(c.r, max(c.g, c.b));\n' +
        '  float k = smoothstep(uThreshold, uThreshold + uKnee, l);\n' +
        '  gl_FragColor = vec4(c * k, 1.0);\n' +
        '}',
      depthTest: false,
      depthWrite: false,
    });

    const blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uDir: { value: new THREE.Vector2(1, 0) },
        uTexel: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: VS,
      fragmentShader:
        'varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel;\n' +
        'void main(){\n' +
        '  vec2 st = uDir * uTexel;\n' +
        '  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.2270270270;\n' +
        '  c += texture2D(tDiffuse, vUv + st * 1.3846153846).rgb * 0.3162162162;\n' +
        '  c += texture2D(tDiffuse, vUv - st * 1.3846153846).rgb * 0.3162162162;\n' +
        '  c += texture2D(tDiffuse, vUv + st * 3.2307692308).rgb * 0.0702702703;\n' +
        '  c += texture2D(tDiffuse, vUv - st * 3.2307692308).rgb * 0.0702702703;\n' +
        '  gl_FragColor = vec4(c, 1.0);\n' +
        '}',
      depthTest: false,
      depthWrite: false,
    });

    const compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloom: { value: 0.62 },
        uExposure: { value: 1.36 },
        uAspect: { value: 1.0 },
        uTime: { value: 0.0 },
      },
      vertexShader: VS,
      fragmentShader:
        'varying vec2 vUv;\n' +
        'uniform sampler2D tScene; uniform sampler2D tBloom;\n' +
        'uniform float uBloom; uniform float uExposure; uniform float uAspect; uniform float uTime;\n' +
        'vec3 aces(vec3 x){\n' +
        '  const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14;\n' +
        '  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);\n' +
        '}\n' +
        'vec3 toSRGB(vec3 c){\n' +
        '  return mix(c*12.92, 1.055*pow(max(c,vec3(0.0)), vec3(1.0/2.4)) - 0.055, step(0.0031308, c));\n' +
        '}\n' +
        'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }\n' +
        'void main(){\n' +
        '  vec3 scene = texture2D(tScene, vUv).rgb;\n' +
        '  vec3 bloom = texture2D(tBloom, vUv).rgb;\n' +
        '  vec3 c = scene + bloom * uBloom;\n' +
        '  c = aces(c * uExposure);\n' +
        '  float l = dot(c, vec3(0.2126,0.7152,0.0722));\n' +
        '  c = mix(c * vec3(0.88,0.97,1.10), c * vec3(1.06,1.0,0.94), smoothstep(0.02,0.55,l));\n' +
        '  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);\n' +
        '  float vig = 1.0 - smoothstep(0.58, 1.18, length(q)) * 0.26;\n' +
        '  c *= vig;\n' +
        '  c = toSRGB(clamp(c, 0.0, 1.0));\n' +
        '  c += (hash(vUv * 1024.0 + uTime) - 0.5) / 255.0;\n' +
        '  gl_FragColor = vec4(c, 1.0);\n' +
        '}',
      depthTest: false,
      depthWrite: false,
    });

    let w = 1, h = 1;

    function pass(mat, target) {
      quad.material = mat;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(quadScene, quadCam);
    }

    const api = {
      enabled: enabled,
      setSize: function (width, height) {
        w = Math.max(1, Math.floor(width));
        h = Math.max(1, Math.floor(height));
        sceneRT.setSize(w, h);
        const bw = Math.max(1, Math.floor(w / 2));
        const bh = Math.max(1, Math.floor(h / 2));
        brightRT.setSize(bw, bh);
        blurA.setSize(bw, bh);
        blurB.setSize(bw, bh);
        compMat.uniforms.uAspect.value = w / h;
      },
      setExposure: function (v) { compMat.uniforms.uExposure.value = v; },
      render: function (scene, camera, time) {
        if (!enabled) {
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(scene, camera);
          return;
        }
        renderer.setRenderTarget(sceneRT);
        renderer.clear();
        renderer.render(scene, camera);

        brightMat.uniforms.tDiffuse.value = sceneRT.texture;
        pass(brightMat, brightRT);

        const tw = 1 / (w / 2), th = 1 / (h / 2);
        blurMat.uniforms.tDiffuse.value = brightRT.texture;
        blurMat.uniforms.uDir.value.set(1, 0);
        blurMat.uniforms.uTexel.value.set(tw, th);
        pass(blurMat, blurA);
        blurMat.uniforms.tDiffuse.value = blurA.texture;
        blurMat.uniforms.uDir.value.set(0, 1);
        pass(blurMat, blurB);

        compMat.uniforms.tScene.value = sceneRT.texture;
        compMat.uniforms.tBloom.value = blurB.texture;
        compMat.uniforms.uTime.value = time || 0;
        pass(compMat, null);
      },
    };
    return api;
  };
