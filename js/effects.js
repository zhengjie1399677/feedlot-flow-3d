/* ============================================================
 *  effects.js — 环境光照 / 天空 / 相机 / 泛光后处理
 * ============================================================ */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  const FL = root.FL;
  const U = FL.U;
  const L = FL.LAYOUT;

  /* ---------------- 环境贴图 ---------------- */
  FL.createEnvironment = function (scene, renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const w = 512, h = 256;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, '#0a1424');
    g.addColorStop(0.32, '#12202f');
    g.addColorStop(0.50, '#3a3226');
    g.addColorStop(0.56, '#241d16');
    g.addColorStop(1.0, '#04060a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 月亮方向的一团冷光
    const rg = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, w * 0.16);
    rg.addColorStop(0, 'rgba(190,215,255,0.9)');
    rg.addColorStop(0.4, 'rgba(120,160,210,0.25)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
    // 地平线暖带
    const wg = ctx.createLinearGradient(0, h * 0.46, 0, h * 0.56);
    wg.addColorStop(0, 'rgba(255,150,70,0)');
    wg.addColorStop(0.5, 'rgba(255,150,70,0.28)');
    wg.addColorStop(1, 'rgba(255,150,70,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(0, h * 0.46, w, h * 0.1);
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const rt = pmrem.fromEquirectangular(tex);
    scene.environment = rt.texture;
    tex.dispose();
    pmrem.dispose();
  };

  /* ---------------- 天空 / 星空 / 灯柱 ---------------- */
  FL.createSky = function (scene, world) {
    const skyGeo = new THREE.SphereGeometry(1200, 32, 20);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        uMoon: { value: new THREE.Vector3(-0.52, 0.18, 0.83).normalize() },
      },
      vertexShader:
        'varying vec3 vDir;\n' +
        'void main(){\n' +
        '  vec4 wp = modelMatrix * vec4(position,1.0);\n' +
        '  vDir = normalize(wp.xyz);\n' +
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);\n' +
        '}',
      fragmentShader:
        'varying vec3 vDir;\n' +
        'uniform vec3 uMoon;\n' +
        'void main(){\n' +
        '  float h = vDir.y;\n' +
        '  vec3 top = vec3(0.008,0.015,0.030);\n' +
        '  vec3 mid = vec3(0.030,0.048,0.075);\n' +
        '  vec3 hor = vec3(0.085,0.085,0.080);\n' +
        '  vec3 col = mix(hor, mid, smoothstep(-0.02, 0.24, h));\n' +
        '  col = mix(col, top, smoothstep(0.18, 0.8, h));\n' +
        '  float az = max(0.0, dot(normalize(vec3(vDir.x,0.0,vDir.z)), normalize(vec3(uMoon.x,0.0,uMoon.z))));\n' +
        '  col += vec3(0.10,0.075,0.045) * pow(az,5.0) * (1.0 - smoothstep(0.05,0.42,h)) * smoothstep(-0.06,0.02,h);\n' +
        // 月亮与光晕
        '  vec3 md = normalize(vec3(-0.16, 0.30, -0.94));\n' +
        '  float m = dot(normalize(vDir), md);\n' +
        '  col += vec3(0.55,0.62,0.78) * (smoothstep(0.99955, 0.99985, m) * 1.15);\n' +
        '  col += vec3(0.10,0.13,0.20) * pow(max(m,0.0), 90.0);\n' +
        '  col += vec3(0.045,0.055,0.08) * pow(max(m,0.0), 12.0);\n' +
        '  col = mix(vec3(0.012,0.017,0.022), col, smoothstep(-0.22, -0.02, h));\n' +
        '  gl_FragColor = vec4(col,1.0);\n' +
        '}',
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    // 星空
    const N = 520;
    const pos = new Float32Array(N * 3);
    const rnd = U.rng(771);
    for (let i = 0; i < N; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.12 + rnd() * 0.85;
      const r = Math.sqrt(1 - y * y);
      const R = 1000;
      pos[i * 3] = Math.cos(a) * r * R;
      pos[i * 3 + 1] = y * R;
      pos[i * 3 + 2] = Math.sin(a) * r * R;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0xadc8e8, size: 1.7, sizeAttenuation: false, transparent: true,
        opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      })
    );
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

    scene.fog = new THREE.FogExp2(0x070c13, 0.0016);
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

})(window);
