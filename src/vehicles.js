import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FL } from './fl.js';

/* ============================================================
 *  vehicles.js — Blender 精模车队装配 / 路线运行 / 机械作业动画
 *    - models/stock_truck.glb   Freightliner FL70 高栏活牛运输车（入栏/出栏涂装独立）
 *    - models/forage_truck.glb  Freightliner FL70 草料自卸车（含独立可抬升 Bed_Tilt + 散装 Cargo_Forage）
 *    - models/tmr_truck.glb     自走式双绞龙 TMR 搅拌投料车（含农业人字宽胎、反向旋转双螺旋绞龙、+X 横向出料流）
 * ============================================================ */
  const U = FL.U;
  const L = FL.LAYOUT;

  const ROAD_Y = 0.24;
  const glbLoader = new GLTFLoader();
  const glbCache = new Map();

  function loadVehicleGLB(url) {
    if (!glbCache.has(url)) {
      glbCache.set(url, new Promise(function (resolve, reject) {
        glbLoader.load(url, function (gltf) { resolve(gltf.scene); }, undefined, reject);
      }));
    }
    return glbCache.get(url);
  }

  const labelCache = new Map();
  function labelSprite(text) {
    if (!text) return null;
    if (!labelCache.has(text)) {
      const tex = U.textTexture({
        w: 640, h: 136, text: text,
        size: 62, color: '#ffd9a4', bg: 'rgba(8,10,12,0.74)',
        border: 'rgba(255,176,96,0.5)', font: '"Microsoft YaHei","Bahnschrift",sans-serif',
      });
      labelCache.set(text, U.signMaterial(tex, 0.95, false));
    }
    return labelCache.get(text);
  }

  /* ============================================================
   *  路线站表
   *  —— 不再预生成"时间→位置"的表，而是按距离实时积分：
   *     进站前按 v²=2as 减速、出站后加速、前车占路则跟车等待。
   * ============================================================ */
  function buildTimeline(ways, path) {
    const marks = [];
    for (let i = 0; i < ways.length; i++) {
      const w = ways[i];
      marks.push({ i: i, s: path.distOf(i), stage: w.stage || null, stop: w.stop || 0, label: w.label || null });
    }
    marks.sort(function (a, b) { return a.s - b.s; });
    const stops = marks.filter(function (m) { return m.stop > 0; })
      .map(function (m) { return { s: m.s, stop: m.stop, label: m.label }; });
    return { marks: marks, stops: stops, length: path.length };
  }

  function stageAt(tl, s) {
    let stage = null;
    for (let i = 0; i < tl.marks.length; i++) {
      if (tl.marks[i].s <= s + 0.6) stage = tl.marks[i].stage;
      else break;
    }
    return stage;
  }

  /* ---------------- 车辆运动参数 ---------------- */
  const ACC = 2.3;      // 起步加速度 m/s²
  const DEC = 3.3;      // 制动减速度 m/s²
  const SCAN = 34;      // 前车探测距离
  const LANE = 3.3;     // 侧向容差：同向车道内才算"前车"
  const FOLLOW = 4.5;   // 跟车时留出的净空
  const TURN_LOOK = 8;  // 转向预判距离 m

  /* ============================================================
   *  Fleet（装配 Blender 精模 GLB + 实时车轮/自卸斗/双绞龙/抛料流联动）
   * ============================================================ */
  FL.buildFleet = function (scene) {
    const specs = [
      { id: 'cattle', route: 'cattleTruck', glb: 'models/stock_truck.glb',
        len: 12.6, lightZ: 6.15, tailZ: -6.05, labelY: 5.8, wheelR: 0.56,
        speed: 10.4, phase: 26, color: 0xffc46b,
        P: { paint: 0xc8d2d4, accent: 0x2a7d8a } },
      { id: 'forage', route: 'forageTruck', glb: 'models/forage_truck.glb',
        len: 12.4, lightZ: 6.15, tailZ: -6.05, labelY: 5.5, wheelR: 0.56,
        speed: 9.6, phase: 9, color: 0x9de07a,
        P: { paint: 0xa04132, accent: 0xd9a84e } },
      { id: 'tmr', route: 'tmrTruck', glb: 'models/tmr_truck.glb',
        len: 10.6, lightZ: 5.65, tailZ: -4.65, labelY: 5.0, wheelR: 0.70,
        speed: 7.8, phase: 46, color: 0xff9a52,
        P: { paint: null, accent: null } },
      { id: 'out', route: 'outboundTruck', glb: 'models/stock_truck.glb',
        len: 12.6, lightZ: 6.15, tailZ: -6.05, labelY: 5.8, wheelR: 0.56,
        speed: 11.2, phase: 64, color: 0xff7f9e,
        P: { paint: 0xe6e2d6, accent: 0xaa362c } },
    ];

    const fleet = { list: [], now: 0, update: null, seek: null, stageSet: function () { return new Set(); } };
    const tmpPos = new THREE.Vector3();
    const tmpTan = new THREE.Vector3();
    const tmpTan2 = new THREE.Vector3();

    for (const spec of specs) {
      const ways = L.routes[spec.route];
      const path = new U.Path(ways, { tension: 0.3 });
      const tl = buildTimeline(ways, path);
      const group = new THREE.Group();
      group.rotation.order = 'YXZ';

      // 接触阴影（跟着车走，让车"压"在地上）
      const aoQuad = U.aoPatch(3.7, spec.len + 2.4, 0.42);
      aoQuad.position.set(0, 0.014, 0);
      group.add(aoQuad);

      // 头灯 / 尾灯 / 作业光 / 标签
      const headGlow = U.sprite(0xffd9a8, 5.2, 0.48);
      headGlow.position.set(0.78, 1.48, spec.lightZ + 0.15);
      group.add(headGlow);
      const headGlow2 = U.sprite(0xffd9a8, 5.2, 0.48);
      headGlow2.position.set(-0.78, 1.48, spec.lightZ + 0.15);
      group.add(headGlow2);
      const tailGlow = U.sprite(0xff3a1e, 2.5, 0.48);
      tailGlow.position.set(0, 1.15, spec.tailZ - 0.12);
      group.add(tailGlow);
      // 转向灯（左 +x 侧 / 右 -x 侧）
      const blinkerL = U.sprite(0xffb347, 3.2, 0.0);
      blinkerL.position.set(1.34, 1.45, spec.lightZ - 0.4);
      group.add(blinkerL);
      const blinkerR = U.sprite(0xffb347, 3.2, 0.0);
      blinkerR.position.set(-1.34, 1.45, spec.lightZ - 0.4);
      group.add(blinkerR);
      // 地面光斑（前照灯）
      const beamPool = U.groundGlow(0xffc98a, 24, 0.18);
      beamPool.position.set(0, 0.05, 9.2);
      group.add(beamPool);
      // 作业光斑
      const workGlow = U.groundGlow(spec.color, 15, 0.0);
      workGlow.position.set(0, 0.06, 0);
      group.add(workGlow);
      // 标签
      const label = new THREE.Sprite(U.signMaterial(null, 0, false));
      label.visible = false;
      label.position.set(0, spec.labelY, 0);
      label.scale.set(7.6, 1.6, 1);
      group.add(label);

      group.position.set(0, ROAD_Y, 0);
      scene.add(group);

      // 初始位置与朝向（后续由 stepSim 维护 x/z 与单位朝向 hx/hz）
      path.pointAt(0, tmpPos);
      path.tangentAt(0, tmpTan);
      const tl0 = Math.hypot(tmpTan.x, tmpTan.z) || 1;

      const veh = {
        id: spec.id,
        group: group,
        path: path,
        tl: tl,
        stops: tl.stops,
        phase: spec.phase,
        len: spec.len,
        wheelR: spec.wheelR || 0.56,
        vmax: spec.speed,
        s: 0, v: 0, si: 0, dwellLeft: 0,
        x: tmpPos.x, z: tmpPos.z,
        hx: tmpTan.x / tl0, hz: tmpTan.z / tl0,
        vPrev: 0,
        mats: [],
        headGlow: headGlow,
        headGlow2: headGlow2,
        tailGlow: tailGlow,
        blinkerL: blinkerL,
        blinkerR: blinkerR,
        beamPool: beamPool,
        workGlow: workGlow,
        label: label,
        labelText: null,
        stage: null,
        dwell: false,
        fade: 1,
        color: spec.color,
        wheels: [],
        bed: null,
        drum: null,
        gate: null,
        pour: null,
        roll: 0,
        pitch: 0,
        cargo: null,
        loaded: true,
        drumSpin: 0,
      };
      fleet.list.push(veh);

      // 异步装配高精 Blender GLB 车身并绑定可动节点
      loadVehicleGLB(spec.glb).then(function (proto) {
        const model = proto.clone(true);
        const clonedMats = new Map();
        // 按精确节点名绑定可动部件（避免 GLTF 多材质子 Mesh 覆盖父级 Group！）
        const bedNode = model.getObjectByName('Bed_Tilt');
        if (bedNode) veh.bed = bedNode;
        const cargoNode = model.getObjectByName('Cargo_Forage');
        if (cargoNode) { veh.cargo = cargoNode; cargoNode.visible = veh.loaded; }
        const augerL = model.getObjectByName('Auger_L');
        const augerR = model.getObjectByName('Auger_R');
        if (augerL && augerR) veh.drum = { userData: { spinners: [augerL, augerR] } };
        const gateNode = model.getObjectByName('Gate_Rear');
        if (gateNode) veh.gate = gateNode;
        const pourNode = model.getObjectByName('Pour_Stream');
        if (pourNode) { veh.pour = pourNode; pourNode.visible = false; }

        model.traverse(function (o) {
          const nm = o.name || '';
          if (/^Wheel_[A-Z0-9]+$/i.test(nm)) veh.wheels.push(o);

          if (!o.isMesh) return;
          const isEmissive = o.material && o.material.emissive &&
            (o.material.emissive.r + o.material.emissive.g + o.material.emissive.b) > 0.05;
          o.castShadow = !isEmissive;
          o.receiveShadow = true;

          if (o.material) {
            let m = clonedMats.get(o.material);
            if (!m) {
              m = o.material.clone();
              const mn = m.name || '';
              if (spec.P && spec.P.paint != null && /^TruckPaint/i.test(mn)) {
                m.color.setHex(spec.P.paint);
              }
              if (spec.P && spec.P.accent != null && /^TruckAccent/i.test(mn)) {
                m.color.setHex(spec.P.accent);
              }
              if (/CabGlass|Chrome/i.test(mn)) m.envMapIntensity = 1.45;
              else if (/Forage|Tire|Rubber|rueda/i.test(mn)) m.envMapIntensity = 0.35;
              else m.envMapIntensity = 0.85;
              clonedMats.set(o.material, m);
              if (m.isMeshStandardMaterial) veh.mats.push(m);
            }
            o.material = m;
          }
        });

        // 与当前淡出状态同步，防止车辆在边界加载完成时闪烁
        if (veh.fade < 0.999) {
          for (let k = 0; k < veh.mats.length; k++) {
            const m = veh.mats[k];
            m.transparent = true;
            m.opacity = veh.fade;
            m.depthWrite = false;
          }
        }
        group.add(model);
      }).catch(function (err) {
        console.warn('车辆 GLB 加载失败:', spec.glb, err);
      });
    }

    /* ---------------- 运动核心 ---------------- */
    function followSpeed(v) {
      if (v.solo) return v.vmax;
      let best = v.vmax;
      for (let i = 0; i < fleet.list.length; i++) {
        const o = fleet.list[i];
        if (o === v) continue;
        const dx = o.x - v.x, dz = o.z - v.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-3) continue;
        const ahead = dx * v.hx + dz * v.hz;
        if (ahead <= 0) continue;
        // 1) 同车道跟车：留净空（侧向容差内才算是"前车"）
        if (ahead <= SCAN) {
          const lat = Math.abs(dz * v.hx - dx * v.hz);
          if (lat <= LANE) {
            const clear = ahead - (v.len + o.len) * 0.5 - FOLLOW;
            const allow = clear <= 0 ? 0 : Math.min(1, clear / 13) * v.vmax;
            if (allow < best) best = allow;
          }
        }
        // 2) 斜切与路口：两条路线在这里交汇时，横向距离会被角度放大，
        //    只靠车道容差看不见对方，于是两车会直接插到一起。这条按距离兜底。
        // 留出制动距离：10 m/s + DEC 3.3 需要约 16 m，再加车身长度
        const reach = Math.max(SCAN, (v.len + o.len) * 0.5 + FOLLOW + 20);
        if (dist < reach && ahead > 0.55 * dist && best > 0) best = 0;
      }
      return best;
    }

    function advance(v, dt) {
      const len = v.path.length;
      if (!v.stops.length) {        // 兜底：没有停靠点的路线匀速绕行
        v.v = Math.min(v.vmax, v.v + ACC * dt);
        v.s = (v.s + v.v * dt) % len;
        if (v.s < v.v * dt * 0.5) v.sWrap = true;
        return;
      }
      if (v.dwellLeft > 0) {
        v.dwellLeft -= dt;
        v.v = 0;
        if (v.dwellLeft <= 1e-6) {
          v.dwellLeft = 0;
          v.si = (v.si + 1) % v.stops.length;
        }
        return;
      }
      const st = v.stops[v.si];
      let dn = st.s - v.s;
      if (dn < 0.001) dn += len;
      const limit = followSpeed(v);
      if (dn <= 0.4 && limit > 0.4 && v.v < 1.4) {   // 到站：前方没车挡着才入位
        v.s = st.s;
        v.v = 0;
        v.dwellLeft = st.stop;
        return;
      }
      const vArr = Math.sqrt(2 * DEC * Math.max(0, dn - 0.4));
      const vd = Math.min(v.vmax, limit, vArr);
      const a = vd > v.v ? ACC : DEC;
      v.v += Math.max(-a * dt, Math.min(a * dt, vd - v.v));
      if (v.v < 0.02) v.v = 0;
      v.s += v.v * dt;
      if (v.s >= len) { v.s -= len; v.sWrap = true; }
    }

    function stepSim(dt) {
      for (let i = 0; i < fleet.list.length; i++) advance(fleet.list[i], dt);
      // 载货状态：在青贮窖卸完就空车，跑完一圈回到起点再装满
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        if (!v.cargo) continue;
        if (v.sWrap) { v.loaded = true; v.sWrap = false; }
        const st = v.dwellLeft > 0 ? v.stops[v.si] : null;
        if (st && /青贮/.test(String(st.label || '')) && (st.stop - v.dwellLeft) > st.stop * 0.35) {
          v.loaded = false;
        }
      }
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        const px = v.x, pz = v.z;
        v.path.pointAt(v.s, tmpPos);
        v.x = tmpPos.x;
        v.z = tmpPos.z;
        const dx = v.x - px, dz = v.z - pz;
        const d = Math.hypot(dx, dz);
        if (d > 1e-4) { v.hx = dx / d; v.hz = dz / d; }
      }
    }

    function resetVehicle(v) {
      v.s = 0; v.v = 0; v.si = 0; v.dwellLeft = 0; v.vPrev = 0;
      v.path.pointAt(0, tmpPos);
      v.path.tangentAt(0, tmpTan);
      const d = Math.hypot(tmpTan.x, tmpTan.z) || 1;
      v.x = tmpPos.x; v.z = tmpPos.z;
      v.hx = tmpTan.x / d; v.hz = tmpTan.z / d;
    }

    /* 快进到某一时刻（截图 / 首帧对齐用）
     * 1) 各车先单独预热 phase 秒，错开出场节奏（此阶段互不干扰）
     * 2) 之后全局同步推进，跟车/让行在这段里才生效 */
    fleet.seek = function (seconds) {
      const dt = 1 / 60;
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        resetVehicle(v);
        const warm = Math.max(0, v.phase);
        v.solo = true;
        for (let t = 0; t < warm; t += dt) advance(v, dt);
        v.solo = false;
        v.path.pointAt(v.s, tmpPos);
        v.x = tmpPos.x; v.z = tmpPos.z;
      }
      const run = Math.max(0, seconds);
      for (let t = 0; t < run; t += dt) stepSim(dt);
      fleet.now = seconds;
    };

    const X0 = -126, X1 = 126, Z0 = -98, Z1 = 94;
    function fadeAt(x, z) {
      const f = Math.min((x - X0) / 9, (X1 - x) / 9, (z - Z0) / 9, (Z1 - z) / 9, 1);
      return Math.max(0, Math.min(1, f));
    }

    fleet.update = function (dt) {
      if (dt > 0) {
        stepSim(Math.min(dt, 0.05));
        fleet.now += dt;
      }
      const time = fleet.now;
      const stages = new Set();
      for (let i = 0; i < fleet.list.length; i++) {
        const v = fleet.list[i];
        v.path.pointAt(v.s, tmpPos);
        v.path.tangentAt(v.s, tmpTan);
        v.group.position.set(tmpPos.x, ROAD_Y, tmpPos.z);
        v.group.rotation.y = Math.atan2(tmpTan.x, tmpTan.z);
        v.stage = stageAt(v.tl, v.s);
        v.dwell = v.dwellLeft > 0;
        if (v.stage) stages.add(v.stage);

        // 淡出（驶出地块边缘）
        const f = fadeAt(tmpPos.x, tmpPos.z);
        if (Math.abs(f - v.fade) > 0.001) {
          v.fade = f;
          const transparent = f < 0.999;
          for (let k = 0; k < v.mats.length; k++) {
            const m = v.mats[k];
            m.transparent = transparent;
            m.opacity = f;
            m.depthWrite = !transparent;
          }
          v.group.visible = f > 0.02;
        }

        // 作业光斑随停留脉动
        const pulse = 0.5 + 0.5 * Math.sin(time * 4.1 + v.phase);
        v.workGlow.material.opacity = v.dwell ? 0.22 + pulse * 0.2 : 0.0;

        // 标签
        if (v.dwell) {
          const st = v.stops[v.si];
          const txt = st ? st.label : null;
          if (txt && v.labelText !== txt) {
            v.labelText = txt;
            const sm = labelSprite(txt);
            if (sm) {
              sm.depthWrite = false;
              v.label.material = sm;
            }
            v.label.visible = true;
          }
          if (txt) {
            const sc = 0.95 + pulse * 0.05;
            v.label.scale.set(7.6 * sc, 1.6 * sc, 1);
          }
        } else if (v.label.visible) {
          v.label.visible = false;
          v.labelText = null;
        }

        // 前照灯
        const hf = 0.42 + 0.08 * Math.sin(time * 3.0 + v.phase);
        v.headGlow.material.opacity = hf * f;
        v.headGlow2.material.opacity = hf * f;
        v.beamPool.material.opacity = 0.18 * f;

        // 刹车灯：减速或停住时变亮
        const braking = v.v < v.vmax * 0.55;
        const tailBase = braking ? 1.5 : 0.4;
        v.tailGlow.material.opacity = tailBase * f;

        // 转向灯：看前方 8m 的航向变化
        let turn = 0;
        if (!v.dwell && v.v > 0.6) {
          const aheadS = (v.s + TURN_LOOK) % v.path.length;
          v.path.tangentAt(aheadS, tmpTan2);
          const cross = tmpTan.z * tmpTan2.x - tmpTan.x * tmpTan2.z;
          const dot = tmpTan.x * tmpTan2.x + tmpTan.z * tmpTan2.z;
          const ang = Math.atan2(cross, dot);
          if (Math.abs(ang) > 0.16) turn = ang > 0 ? 1 : -1;
        }
        const blink = (Math.sin(time * 11.5) > 0.15) ? 1 : 0;
        v.blinkerL.material.opacity = (turn === 1 ? 0.95 : 0) * blink * f;
        v.blinkerR.material.opacity = (turn === -1 ? 0.95 : 0) * blink * f;

        /* ---- 机械动作 ---- */
        const sdt = dt > 0 ? Math.min(dt, 0.05) : 0;
        // 车轮滚动（按实际轮径准确计算角速度）
        if (sdt > 0) {
          const spin = (v.v * sdt) / (v.wheelR || 0.56);
          for (let k = 0; k < v.wheels.length; k++) v.wheels[k].rotation.x += spin;
        }
        // 车身姿态：转弯侧倾 + 制动点头
        const accel = sdt > 0 ? (v.v - v.vPrev) / sdt : 0;
        if (sdt > 0) v.vPrev = v.v;
        const wantRoll = turn ? -turn * Math.min(0.045, v.v * 0.004) : 0;
        const wantPitch = Math.max(-0.045, Math.min(0.045, -accel * 0.010));
        const kk = 1 - Math.exp(-sdt * 6);
        v.roll += (wantRoll - v.roll) * kk;
        v.pitch += (wantPitch - v.pitch) * kk;
        v.group.rotation.z = v.roll;
        v.group.rotation.x = v.pitch;
        // TMR 双螺旋绞龙：各自绕轴反向旋转，投料时加快翻拌
        if (v.drum && sdt > 0) {
          v.drumSpin += sdt * (v.dwell ? 2.4 : 1.25);
          const sps = v.drum.userData && v.drum.userData.spinners;
          if (sps && sps.length >= 2) {
            sps[0].rotation.z = v.drumSpin;
            sps[1].rotation.z = -v.drumSpin;
          } else {
            v.drum.rotation.z = v.drumSpin;
          }
        }
        // 自卸斗：在青贮窖卸料时抬起
        if (v.bed) {
          const lbl = v.dwell && v.stops[v.si] ? String(v.stops[v.si].label || '') : '';
          const want = /青贮/.test(lbl) ? -0.40 : 0;
          v.bed.rotation.x += (want - v.bed.rotation.x) * (1 - Math.exp(-sdt * 1.8));
        }
        // 草料：卸到一半就没货了（空车）
        if (v.cargo) v.cargo.visible = v.loaded;
        // TMR 尾部检修门 & 侧出料草料流（停靠投料时显示动态抛料流）
        if (v.gate) {
          const lbl = v.dwell && v.stops[v.si] ? String(v.stops[v.si].label || '') : '';
          const feeding = /投料|饲喂/.test(lbl);
          const want = feeding ? -0.35 : 0;
          v.gate.rotation.x += (want - v.gate.rotation.x) * (1 - Math.exp(-sdt * 3));
          if (v.pour) {
            v.pour.visible = feeding;
            if (feeding) {
              v.pour.scale.set(0.92 + 0.12 * Math.sin(time * 9.0), 1.0, 0.92 + 0.12 * Math.cos(time * 11.0));
            }
          }
        }
      }
      fleet._stages = stages;
      return stages;
    };

    fleet.stageSet = function () { return fleet._stages || new Set(); };
    fleet.vehicles = fleet.list;
    return fleet;
  };
