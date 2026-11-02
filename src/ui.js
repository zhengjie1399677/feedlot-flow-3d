import { FL } from './fl.js';

/* ============================================================
 *  ui.js — 2D 界面：图例 / 视角 / 流程条 / 时钟
 * ============================================================ */
  const L = FL.LAYOUT;

  const hex = (c) => '#' + ('000000' + c.toString(16)).slice(-6);
  const pad = (n) => (n < 10 ? '0' + n : '' + n);

  const LEGEND = [
    ['进场车流', L.colors.intake],
    ['草料进厂', L.colors.forage],
    ['牛只分流', L.colors.cattle],
    ['日粮饲喂', L.colors.feed],
    ['出栏装车', L.colors.outbound],
  ];

  FL.createUI = function (fleet, rig) {
    const stepsEl = document.getElementById('steps');
    const viewsEl = document.getElementById('views');
    const legendEl = document.getElementById('legend');
    const clockEl = document.getElementById('clock');
    const veil = document.getElementById('veil');
    const stepEls = new Map();

    /* 图例 */
    if (legendEl) {
      for (const [label, color] of LEGEND) {
        const li = document.createElement('li');
        li.innerHTML = '<i></i><span></span>';
        li.style.setProperty('--dot', hex(color));
        li.querySelector('span').textContent = label;
        legendEl.appendChild(li);
      }
    }

    /* 流程条 */
    for (const st of L.stages) {
      const li = document.createElement('li');
      li.style.setProperty('--c', hex(st.color));
      li.dataset.stage = st.id;
      li.innerHTML =
        '<span class="no">' + st.no + '</span>' +
        '<span class="txt"><b></b><i></i></span>' +
        '<span class="pulse"></span>';
      li.querySelector('b').textContent = st.label;
      li.querySelector('.txt i').textContent = st.en;
      stepsEl.appendChild(li);
      stepEls.set(st.id, li);
    }

    /* 视角 */
    const viewEls = new Map();
    L.cameras.forEach((cam, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.view = cam.id;
      btn.innerHTML = '<span class="k">' + (i + 1) + '</span><span></span>';
      btn.querySelector('span:last-child').textContent = cam.label;
      btn.addEventListener('click', () => rig.goPreset(cam.id));
      viewsEl.appendChild(btn);
      viewEls.set(cam.id, btn);
    });

    /* 剖视开关：收起牛舍屋顶，露出舍内 */
    const cutState = { on: true, onChange: null };
    const cutBtn = document.createElement('button');
    cutBtn.type = 'button';
    cutBtn.className = 'cut';
    cutBtn.title = '收起 / 放下牛舍屋顶（快捷键 R）';
    cutBtn.innerHTML = '<span class="k">R</span><span></span>';
    cutBtn.querySelector('span:last-child').textContent = '剖视';
    function applyCut(on) {
      cutState.on = on;
      cutBtn.classList.toggle('on', on);
      if (cutState.onChange) cutState.onChange(on);
    }
    cutBtn.addEventListener('click', function () { applyCut(!cutState.on); });
    viewsEl.appendChild(cutBtn);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'r' || e.key === 'R') applyCut(!cutState.on);
    });

    /* 第一人称跟车：按钮 / HUD / 与相机状态同步 */
    const viewsWrap = viewsEl.parentNode;
    const rideBtn = document.createElement('button');
    rideBtn.type = 'button';
    rideBtn.className = 'ride-launch';
    rideBtn.title = '坐进驾驶室，跟着一辆车平视看园区（快捷键 C）';
    rideBtn.innerHTML = '<span class="k">C</span><span class="txt">跟车视角</span><span class="en">RIDE</span>';
    viewsWrap.appendChild(rideBtn);

    const rideHud = document.getElementById('ride-hud');
    const rideNameEl = document.getElementById('ride-name');
    const rideTabsEl = document.getElementById('ride-tabs');
    const rideExitEl = document.getElementById('ride-exit');
    const rideVehicles = rig.rideVehicles || [];
    const RIDE_SHORT = { cattle: '活牛', forage: '草料', tmr: 'TMR', out: '出栏' };
    const tabEls = new Map();
    let activeView = rig.currentPreset || 'overview';

    rideVehicles.forEach(function (v, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.title = '换到' + v.label + '（快捷键 ' + (i + 1) + ' / ←→）';
      b.innerHTML = '<span class="k">' + (i + 1) + '</span><span></span>';
      b.querySelector('span:last-child').textContent = RIDE_SHORT[v.id] || v.label;
      b.addEventListener('click', function () { rig.setRideVehicle(v.id); });
      if (rideTabsEl) rideTabsEl.appendChild(b);
      tabEls.set(v.id, b);
    });

    if (!rideVehicles.length) {
      rideBtn.style.display = 'none';
      if (rideHud) rideHud.style.display = 'none';
    }
    rideBtn.addEventListener('click', function () { rig.toggleRide(); });
    if (rideExitEl) rideExitEl.addEventListener('click', function () { rig.exitRide(); });

    function syncRide(active, id) {
      document.body.classList.toggle('ride', !!active);
      rideBtn.classList.toggle('on', !!active);
      const txt = rideBtn.querySelector('.txt');
      if (txt) txt.textContent = active ? '退出跟车' : '跟车视角';
      rideBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
      for (const [key, el] of tabEls) el.classList.toggle('on', !!active && key === id);
      const item = rideVehicles.find(function (v) { return v.id === id; });
      if (rideNameEl) rideNameEl.textContent = active && item ? item.label + ' · ' + item.en : '—';
      if (active) {
        for (const [, el] of viewEls) el.classList.remove('on');
      } else {
        // 退出跟车时恢复进入前的轨道视角；若退出时点了预设，activeView 已经是新预设
        setActiveView(activeView);
      }
    }
    rig.onRideChange(syncRide);

    function setActiveView(id) {
      activeView = id;
      for (const [key, el] of viewEls) el.classList.toggle('on', key === id);
    }
    if (!rig.isRiding) setActiveView(rig.currentPreset || 'overview');

    // 所有视角切换（按钮 / 数字键 / 双击）都经过这里，统一高亮
    const goPreset = rig.goPreset.bind(rig);
    rig.goPreset = function (id, instant) {
      setActiveView(id);
      return goPreset(id, instant);
    };

    // 手动拖拽后取消视角高亮
    const canvas = document.getElementById('scene');
    if (canvas) {
      canvas.addEventListener('pointerdown', () => {
        for (const [, el] of viewEls) el.classList.remove('on');
      });
    }

    /* 时钟：跟着昼夜循环走 */
    const phaseEl = document.getElementById('phase');
    let lastClock = '';
    let lastKey = '';
    let lastPhase = '';

    function phaseOf(hour) {
      if (hour < 6.2) return ['黎明', 'DAWN'];
      if (hour < 9.5) return ['清晨', 'MORNING'];
      if (hour < 16.5) return ['白天', 'DAY'];
      if (hour < 19.6) return ['黄昏', 'DUSK'];
      return ['夜间', 'NIGHT'];
    }

    const api = {
      setCutaway: applyCut,
      onCutaway: function (fn) { cutState.onChange = fn; },
      update: function (hour, stages) {
        const key = stages ? Array.from(stages).sort().join('|') : '';
        if (key !== lastKey) {
          lastKey = key;
          for (const [id, el] of stepEls) {
            el.classList.toggle('on', !!(stages && stages.has(id)));
          }
        }
        const hh = ((hour % 24) + 24) % 24;
        const sec = Math.floor(hh * 3600);
        const txt = pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor((sec % 3600) / 60)) + ':' + pad(sec % 60);
        if (txt !== lastClock) {
          lastClock = txt;
          clockEl.textContent = txt;
        }
        const ph = phaseOf(hh);
        const phTxt = ph[0] + ' ' + ph[1];
        if (phTxt !== lastPhase) {
          lastPhase = phTxt;
          if (phaseEl) phaseEl.textContent = phTxt;
        }
      },
      reveal: function () {
        document.body.classList.add('ready');
        if (veil) veil.classList.add('gone');
      },
    };

    return api;
  };
