/* ============================================================
 *  ui.js — 2D 界面：图例 / 视角 / 流程条 / 时钟
 * ============================================================ */
(function (root) {
  'use strict';
  const FL = root.FL;
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

    function setActiveView(id) {
      for (const [key, el] of viewEls) el.classList.toggle('on', key === id);
    }
    setActiveView('overview');

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

    /* 时钟：从 03:18 开始，跟着动画走 */
    const base = 3 * 3600 + 18 * 60;
    let lastClock = '';
    let lastKey = '';

    const api = {
      update: function (time, stages) {
        const key = stages ? Array.from(stages).sort().join('|') : '';
        if (key !== lastKey) {
          lastKey = key;
          for (const [id, el] of stepEls) {
            el.classList.toggle('on', !!(stages && stages.has(id)));
          }
        }
        const sec = Math.floor((base + time) % 86400);
        const txt = pad(Math.floor(sec / 3600)) + ':' + pad(Math.floor((sec % 3600) / 60)) + ':' + pad(sec % 60);
        if (txt !== lastClock) {
          lastClock = txt;
          clockEl.textContent = txt;
        }
      },
      reveal: function () {
        document.body.classList.add('ready');
        if (veil) veil.classList.add('gone');
      },
    };

    return api;
  };

})(window);
