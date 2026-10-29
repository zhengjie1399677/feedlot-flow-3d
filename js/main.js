/* ============================================================
 *  main.js — 装配、循环、自适应
 *  URL 参数：?t=20 定格在第 20 秒（截图用）；?fx=0 关泛光；?ui=0 隐藏界面
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = root.FL;
  const U = FL.U;

  const q = new URLSearchParams(location.search);
  const fixed = q.has('t') ? Math.max(0, parseFloat(q.get('t')) || 0) : null;
  const fxOn = q.get('fx') !== '0';
  const uiOn = q.get('ui') !== '0';
  // 昼夜：一个循环 DAY_SECONDS 秒，从 05:00 走到 23:00（夜色的两端都是深夜，循环处看不出来）
  const DAY_SECONDS = 210;
  const HOUR_FROM = 5, HOUR_TO = 23;
  const hourFix = q.has('hour') ? Math.max(0, Math.min(24, parseFloat(q.get('hour')) || 0)) : null;
  function hourAt(t) {
    if (hourFix != null) return hourFix;
    const u = ((t / DAY_SECONDS) % 1 + 1) % 1;
    return HOUR_FROM + u * (HOUR_TO - HOUR_FROM);
  }

  // 运行期错误落到标题里，便于无头截图排查
  root.addEventListener('error', function (e) {
    document.title = 'ERR ' + (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno;
  });

  const canvas = document.getElementById('scene');
  const veil = document.getElementById('veil');

  function fail(err) {
    console.error(err);
    if (veil) {
      veil.classList.remove('gone');
      veil.innerHTML =
        '<div class="box"><div class="mark"></div><h2>场景未能启动</h2>' +
        '<p>请确认浏览器支持 WEBGL2</p></div>';
    }
  }

  if (fixed != null) document.body.classList.add('instant');
  if (!uiOn) {
    const uiEl = document.getElementById('ui');
    if (uiEl) uiEl.classList.add('hidden');
  }

  let renderer;
  try {
    U.initTextures();
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
  } catch (err) {
    fail(err);
    return;
  }

  renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.6));
  renderer.setSize(root.innerWidth, root.innerHeight, false);
  renderer.shadowMap.enabled = q.get('sh') !== '0';
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = fxOn ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04070a);

  const camera = new THREE.PerspectiveCamera(36, root.innerWidth / Math.max(1, root.innerHeight), 4, 3400);

  let world, fleet, rig, pipe, ui, sky, day;
  try {
    FL.createEnvironment(scene, renderer);
    world = FL.buildWorld(scene);
    sky = FL.createSky(scene, world);
    fleet = FL.buildFleet(scene);
    rig = FL.createCameraRig(camera, canvas);
    const camId = q.get('cam');
    const known = rig.presets && rig.presets.some(function (p) { return p.id === camId; });
    rig.goPreset(known ? camId : 'overview', true);
    const pan = (q.get('pan') || '').split(',').map(Number);
    if (pan.length === 2 && isFinite(pan[0]) && isFinite(pan[1])) rig.panTo(pan[0], pan[1], true);
    pipe = FL.createPipeline(renderer, { enabled: fxOn });
    day = FL.createDay(scene, world, sky, pipe);
    ui = uiOn ? FL.createUI(fleet, rig) : { update: function () {}, reveal: function () {} };
  } catch (err) {
    fail(err);
    return;
  }

  // 车辆物理是实时积分的：先按各车相位预热，定格截图时再快进到目标时刻
  fleet.seek(fixed != null ? fixed : 0);

  const size = new THREE.Vector2();
  function resize() {
    const w = Math.max(1, root.innerWidth);
    const h = Math.max(1, root.innerHeight);
    renderer.setPixelRatio(Math.min(root.devicePixelRatio || 1, 1.6));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(size);
    pipe.setSize(size.x, size.y);
  }
  root.addEventListener('resize', resize);
  resize();

  for (const pl of world.pointLights) pl.userData.base = pl.intensity;

  /* ---------------- 循环 ---------------- */
  let simTime = fixed != null ? fixed : 0;
  let last = performance.now();
  let frames = 0;

  function frame(now) {
    const dt = Math.min(Math.max(0, (now - last) / 1000), 0.05);
    last = now;
    if (fixed == null) simTime += dt;

    for (let i = 0; i < world.flows.length; i++) {
      world.flows[i].mat.uniforms.uTime.value = simTime;
    }

    for (let i = 0; i < world.labels.length; i++) {
      const l = world.labels[i];
      l.sprite.position.y = l.base + Math.sin(simTime * 0.8 + i * 1.7) * 0.32;
    }

    const hour = hourAt(simTime);
    const phase = day.setHour(hour);
    for (let i = 0; i < world.pointLights.length; i++) {
      const pl = world.pointLights[i];
      const base = pl.userData.dayBase == null ? pl.userData.base : pl.userData.dayBase;
      pl.intensity = base * (0.94 + 0.06 * Math.sin(simTime * 2.3 + i * 2.1));
    }

    fleet.update(fixed != null ? 0 : dt);
    ui.update(hour, fleet.stageSet(), phase);
    rig.update(dt);

    pipe.render(scene, camera, simTime);

    if (q.get('dbg') && frames === 1) {
      document.title = 'h=' + hour.toFixed(2) +
        ' f=' + (phase ? phase.night.toFixed(2) + '/' + phase.dusk.toFixed(2) + '/' + phase.day.toFixed(2) : 'null') +
        ' key=' + world.lights.moon.intensity.toFixed(2) + ' hemi=' + world.lights.hemi.intensity.toFixed(2);
    }
    if (frames === 1) ui.reveal();
    frames++;
    root.requestAnimationFrame(frame);
  }

  root.requestAnimationFrame(frame);

  root.FL_APP = { scene: scene, camera: camera, renderer: renderer, world: world, fleet: fleet, rig: rig, day: day };
})(window);
