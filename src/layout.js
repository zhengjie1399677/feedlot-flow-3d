import { FL } from './fl.js';

/* ============================================================
 *  layout.js — 场地坐标 / 路网 / 车辆路线 / 视角
 *  单位：米。相机从东南（+x +z）看向西北，所以画面左＝西，右＝东。
 * ============================================================ */

  const L = (FL.LAYOUT = {
    plot: { x0: -137, x1: 137, z0: -104, z1: 108 },
    slab: { w: 274, d: 212, cx: 0, cz: 2 },

    roads: [
      {
        id: 'entry',
        width: 11.5,
        centerStyle: 'double',
        pts: [[-138, 56], [-108, 56], [-84, 56], [-58, 56]],
      },
      {
        id: 'west',
        width: 11,
        centerStyle: 'double',
        pts: [[-58, 56], [-58, 48], [-58, 12], [-58, -26], [-58, -44], [-58, -74], [-56.5, -80.5], [-50, -84], [-10, -84], [45, -84], [112, -84]],
      },
      {
        id: 'east',
        width: 11,
        centerStyle: 'double',
        pts: [[112, -84], [112, -68], [112, -44], [112, 10], [112, 48], [112, 108]],
      },
      {
        id: 'south',
        width: 10,
        centerStyle: 'double',
        pts: [[-58, 48], [-20, 48], [20, 48], [77, 48], [112, 48]],
      },
      {
        id: 'silageSpur',
        width: 8.6,
        centerStyle: 'dash',
        pts: [[-58, -4], [-70, -4], [-82, -4]],
      },
      {
        id: 'tmrSouthSpur',
        width: 8.2,
        centerStyle: 'dash',
        pts: [[-58, -26], [-70, -26], [-78.2, -26], [-80.5, -28.2], [-80.8, -32.8]],
      },
      {
        id: 'tmrNorthSpur',
        width: 8.2,
        centerStyle: 'dash',
        pts: [[-80.8, -41.5], [-80.2, -43.5], [-77.8, -44], [-58, -44]],
      },
      {
        id: 'feed',
        width: 10.6,
        centerStyle: 'dash',
        pts: [[-58, -44], [-20, -44], [28, -44], [76, -44], [112, -44]],
      },
      {
        id: 'tradingAccess',
        width: 8.6,
        centerStyle: 'none',
        pts: [[-25, 48], [-25, 41], [-25, 33]],
      },
      {
        id: 'parkingAccess',
        width: 7.2,
        centerStyle: 'none',
        pts: [[71, 48], [71, 53], [71, 58.6]],
      },
    ],

    // 真实工程正交路口：core 为两路严丝合缝的矩形交汇区，fillets 为内凹圆角倒角（绝无外凸椭圆！）
    // corner 方向 [sx, sz] 表示倒角位于 (+x/-x, +z/-z) 象限
    junctions: [
      // 西进场大道(z=56) 汇入 西干道(x=-58)
      { x: -58, z: 56, w: 11.0, d: 11.5, r: 3.4, fillets: [[-1, -1]] },
      // 南干道(z=48) 接 西干道(x=-58)
      { x: -58, z: 48, w: 11.0, d: 10.0, r: 3.2, fillets: [[1, -1], [1, 1]] },
      // 青贮窖支路(z=-4) 接 西干道(x=-58)
      { x: -58, z: -4, w: 11.0, d: 8.6, r: 3.0, fillets: [[-1, -1], [-1, 1]] },
      // TMR 南进料支路(z=-26) 接 西干道(x=-58)
      { x: -58, z: -26, w: 11.0, d: 8.2, r: 2.8, fillets: [[-1, -1], [-1, 1]] },
      // 西干道(x=-58) × 中央日粮道/TMR 北出料道(z=-44) 十字路口
      { x: -58, z: -44, w: 11.0, d: 10.6, r: 3.2, fillets: [[-1, -1], [1, -1], [-1, 1], [1, 1]] },
      // 中央日粮道(z=-44) 接 东干道(x=112) T 字路口
      { x: 112, z: -44, w: 11.0, d: 10.6, r: 3.2, fillets: [[-1, -1], [-1, 1]] },
      // 北环道(z=-84) 接 东干道(x=112) 封闭直角转弯（东北出口已封闭）
      { x: 112, z: -84, w: 11.0, d: 11.0, r: 3.2, fillets: [[-1, 1]] },
      // 南干道(z=48) 接 东干道(x=112) T 字路口
      { x: 112, z: 48, w: 11.0, d: 10.0, r: 3.2, fillets: [[-1, -1], [-1, 1]] },
      // 交易大厅支路(x=-25) 接 南干道(z=48)
      { x: -25, z: 48, w: 8.6, d: 10.0, r: 2.6, fillets: [[-1, -1], [1, -1]] },
      // 停车场支路(x=71) 接 南干道(z=48)，向南接入综合楼东侧停车场
      { x: 71, z: 48, w: 7.2, d: 10.0, r: 2.4, fillets: [[-1, 1], [1, 1]] },
    ],

    slots: {
      gate: { x: -117, z: 56 },
      weighbridge: { x: -80, z: 56 },
      plantEntry: { x: -78, z: 16 },
      tmrBay: { x: -80.8, z: -38 },
      unloading: { x: -55, z: -66 },
      dock: { x: 112, z: -69 },
      exitGate: { x: 112, z: 103.5 },
    },

    barns: [
      // 日粮道北侧一排（面向 +z，即朝南面对日粮道）
      { cx: -20, cz: -62, len: 40, dep: 20, idx: 1 },
      { cx: 28, cz: -62, len: 40, dep: 20, idx: 2 },
      { cx: 76, cz: -62, len: 40, dep: 20, idx: 3 },
      // 日粮道南侧一排（mirror：整体绕自心转 180°，面向 -z）
      { cx: -20, cz: -28, len: 40, dep: 20, idx: 4, mirror: true },
      { cx: 28, cz: -28, len: 40, dep: 20, idx: 5, mirror: true },
      { cx: 76, cz: -28, len: 40, dep: 20, idx: 6, mirror: true },
    ],

    /* 场区中部（生产区以南，用围墙隔开）：交易中心 / 员工办公 / 精简生态停车场 */
    market: {
      wall: { z: -11, x0: -50, x1: 104, gates: [[-48, -38]], walkGate: [58, 61.5] },
      hall: { cx: -25, cz: 6, w: 44, d: 26 },
      pens: { x0: 2, z0: -9, cols: 3, rows: 2, w: 8.4, d: 7.4, gx: 1.8, gz: 1.8 },
      ramp: { x: 33.5, z: 2 },
      scale: { x: 40, z: 16 },
      parking: { x0: 44, x1: 101, z0: 58, z1: 96, aisle: 6.2, stall: 3.0 },
      office: { cx: 12, cz: 72, w: 44, d: 13.6, rot: Math.PI },
      forageYard: { cx: 77, cz: 17, w: 50, d: 44, shedCx: 77, shedCz: 9, shedW: 42, shedD: 24 },
    },

    colors: {
      intake: 0x63c9ff,
      forage: 0x9de07a,
      cattle: 0xffc46b,
      feed: 0xff9a52,
      outbound: 0xff7f9e,
    },

    /* 车辆路线：stage 用于联动底部流程条；stop 为停顿时长（秒） */
    routes: {
      cattleTruck: [
        { x: -215, z: 138, stage: 'gate' },
        { x: -168, z: 138, stage: 'gate' },
        { x: -160, z: 130, stage: 'gate' },
        { x: -160, z: 64, stage: 'gate' },
        { x: -152, z: 56, stage: 'gate' },
        { x: -124, z: 56, stage: 'gate' },
        { x: -117, z: 56, stage: 'gate', label: '驶入大门' },
        { x: -104, z: 56, stage: 'gate', label: '雾化消毒' },
        { x: -80, z: 56, stop: 3, stage: 'weigh', label: '地磅称重' },
        { x: -64, z: 56, stage: 'sort' },
        { x: -57.5, z: 54.5, stage: 'sort' },
        { x: -55.5, z: 48, stage: 'sort' },
        { x: -55.5, z: 32, stage: 'sort', label: '驶向卸牛台' },
        { x: -55.5, z: 0, stage: 'sort' },
        { x: -55.5, z: -44, stage: 'sort' },
        { x: -55.5, z: -58, stage: 'sort' },
        { x: -55.5, z: -65, stop: 10, stage: 'sort', label: '卸牛作业' },
        { x: -55.5, z: -74, stage: null },
        { x: -54, z: -80.5, stage: null },
        { x: -48, z: -84, stage: null },
        { x: 20, z: -84, stage: null, label: '空车离场' },
        { x: 80, z: -84, stage: null },
        { x: 104, z: -84, stage: null },
        { x: 111.5, z: -80, stage: null },
        { x: 113.5, z: -72, stage: null },
        { x: 113.5, z: -40, stage: null },
        { x: 113.5, z: 0, stage: null },
        { x: 113.5, z: 48, stage: null },
        { x: 113.5, z: 100, stage: null },
        { x: 113.5, z: 130, stage: null },
        { x: 121, z: 138, stage: null },
        { x: 210, z: 138, stage: null },
      ],

      forageTruck: [
        { x: -220, z: 138, stage: 'gate' },
        { x: -168, z: 138, stage: 'gate' },
        { x: -160, z: 130, stage: 'gate' },
        { x: -160, z: 64, stage: 'gate' },
        { x: -152, z: 56, stage: 'gate' },
        { x: -124, z: 56, stage: 'gate' },
        { x: -117, z: 56, stage: 'gate', label: '草料车进场' },
        { x: -104, z: 56, stage: 'gate', label: '雾化消毒' },
        { x: -80, z: 56, stop: 3, stage: 'weigh', label: '草料过磅' },
        { x: -64, z: 56, stage: 'tmr' },
        { x: -57.5, z: 54.5, stage: 'tmr' },
        { x: -55.5, z: 46, stage: 'tmr' },
        { x: -55.5, z: 22, stage: 'tmr' },
        { x: -55.5, z: 2, stage: 'tmr' },
        { x: -58.5, z: -4, stage: 'tmr' },
        { x: -68, z: -4, stage: 'tmr' },
        { x: -78.5, z: -4, stop: 9, stage: 'tmr', label: '青贮卸料' },
        { x: -81.5, z: -10, stage: 'tmr' },
        { x: -79, z: -15.5, stage: 'tmr' },
        { x: -72, z: -14, stage: 'tmr' },
        { x: -68, z: -6.5, stage: 'tmr' },
        { x: -62, z: -2.2, stage: 'tmr' },
        { x: -60.2, z: 4, stage: null },
        { x: -60.2, z: 24, stage: null },
        { x: -60.2, z: 44, stage: null },
        { x: -56, z: 49.5, stage: null },
        { x: -20, z: 49.8, stage: null },
        { x: 30, z: 49.8, stage: null },
        { x: 47, z: 49.8, stage: null },
        { x: 51, z: 44, stage: null },
        { x: 51, z: 37, stage: null },
        { x: 58, z: 35.6, stage: null },
        { x: 77, z: 35.6, stop: 4, stage: null, label: '草料库装车外销' },
        { x: 96, z: 35.6, stage: null },
        { x: 106, z: 37.5, stage: null },
        { x: 112.5, z: 44, stage: null },
        { x: 113.5, z: 100, stage: null, label: '满载出园外销' },
        { x: 113.5, z: 130, stage: null },
        { x: 121, z: 138, stage: null },
        { x: 210, z: 138, stage: null },
      ],

      tmrTruck: [
        { x: -80.8, z: -38, stage: 'tmr', label: '日粮装车' },
        { x: -80.8, z: -42.2, stage: 'tmr' },
        { x: -78.2, z: -44.2, stage: 'tmr' },
        { x: -68, z: -44.2, stage: 'tmr' },
        { x: -58, z: -45.5, stage: 'feed' },
        { x: -42, z: -46.6, stage: 'feed' },
        { x: -20, z: -46.8, stop: 6, stage: 'feed', label: '1 号牛舍投料' },
        { x: 4, z: -46.8, stage: 'feed' },
        { x: 28, z: -46.8, stop: 6, stage: 'feed', label: '2 号牛舍投料' },
        { x: 52, z: -46.8, stage: 'feed' },
        { x: 76, z: -46.8, stop: 6, stage: 'feed', label: '3 号牛舍投料' },
        { x: 98, z: -46.8, stage: 'feed' },
        { x: 106.5, z: -46.5, stage: 'feed' },
        { x: 108.6, z: -44.0, stage: 'feed' },
        { x: 106.5, z: -41.5, stage: 'feed' },
        { x: 98, z: -41.2, stage: 'feed' },
        { x: 76, z: -41.2, stop: 6, stage: 'feed', label: '6 号牛舍投料' },
        { x: 52, z: -41.2, stage: 'feed' },
        { x: 28, z: -41.2, stop: 6, stage: 'feed', label: '5 号牛舍投料' },
        { x: 4, z: -41.2, stage: 'feed' },
        { x: -20, z: -41.2, stop: 6, stage: 'feed', label: '4 号牛舍投料' },
        { x: -42, z: -41.2, stage: 'feed' },
        { x: -57, z: -41.2, stage: 'tmr' },
        { x: -60.2, z: -38.5, stage: 'tmr' },
        { x: -60.2, z: -29.5, stage: 'tmr' },
        { x: -63.5, z: -26.0, stage: 'tmr' },
        { x: -75.5, z: -26.0, stage: 'tmr' },
        { x: -80.2, z: -28.0, stage: 'tmr' },
        { x: -80.8, z: -32.8, stage: 'tmr' },
        { x: -80.8, z: -38, stage: 'tmr' },
      ],

      outboundTruck: [
        { x: -215, z: 138, stage: 'gate' },
        { x: -168, z: 138, stage: 'gate' },
        { x: -160, z: 130, stage: 'gate' },
        { x: -160, z: 64, stage: 'gate' },
        { x: -152, z: 56, stage: 'gate' },
        { x: -124, z: 56, stage: 'gate' },
        { x: -117, z: 56, stage: 'gate', label: '待装卡车进场' },
        { x: -104, z: 56, stage: 'gate', label: '雾化消毒' },
        { x: -80, z: 56, stop: 3, stage: 'weigh', label: '空车过磅' },
        { x: -64, z: 56, stage: 'load' },
        { x: -57.5, z: 54.5, stage: 'load' },
        { x: -55.5, z: 46, stage: 'load' },
        { x: -55.5, z: 0, stage: 'load' },
        { x: -55.5, z: -44, stage: 'load' },
        { x: -55.5, z: -74, stage: 'load' },
        { x: -54, z: -80.5, stage: 'load' },
        { x: -48, z: -84, stage: 'load' },
        { x: 20, z: -84, stage: 'load' },
        { x: 85, z: -84, stage: 'load' },
        { x: 105, z: -84, stage: 'load' },
        { x: 110.2, z: -81.5, stage: 'load' },
        { x: 110.2, z: -76, stage: 'load' },
        { x: 109.2, z: -69, stop: 10, stage: 'load', label: '装车作业' },
        { x: 109.6, z: -57, stage: 'load' },
        { x: 111.5, z: -45, stage: 'load' },
        { x: 112, z: -20, stage: 'load' },
        { x: 112, z: 15, stage: 'load' },
        { x: 112, z: 48, stage: 'load' },
        { x: 112, z: 100, stage: 'load', label: '出园检疫放行' },
        { x: 112.5, z: 130, stage: 'load' },
        { x: 121, z: 138, stage: 'load' },
        { x: 210, z: 138, stage: 'load' },
      ],
    },

    /* 流向光带（贴合正交车道中线） */
    flow: [
      {
        id: 'intake',
        color: 0x63c9ff,
        width: 1.5,
        pts: [[-128, 56], [-108, 56], [-84, 56], [-62, 56], [-56.5, 52], [-55.5, 38]],
      },
      {
        id: 'forage',
        color: 0x9de07a,
        width: 1.4,
        pts: [[-55.5, 38], [-55.5, 16], [-55.5, -1], [-60, -4], [-70, -4], [-80, -4]],
      },
      {
        id: 'cattle',
        color: 0xffc46b,
        width: 1.4,
        pts: [[-55.5, 38], [-55.5, 0], [-55.5, -44], [-55.5, -58], [-55.5, -65], [-51.5, -66]],
      },
      {
        id: 'feed',
        color: 0xff9a52,
        width: 1.5,
        pts: [[-80.8, -38], [-80.8, -42.5], [-77.5, -44.2], [-66, -44.2], [-58, -45.5], [-20, -46.8], [28, -46.8], [76, -46.8], [105, -46.5], [108.2, -44], [105, -41.5], [76, -41.2], [28, -41.2], [-20, -41.2], [-57, -41.2], [-60.2, -37.5], [-60.2, -29], [-64, -26], [-77, -26], [-80.5, -28.5], [-80.8, -33], [-80.8, -38]],
      },
      {
        id: 'outbound',
        color: 0xff7f9e,
        width: 1.5,
        pts: [[96, -67], [102, -67.5], [109, -69], [112, -66], [112, -30], [112, 10], [112, 48], [112, 92]],
      },
    ],

    cameras: [
      { id: 'overview', label: '全览', target: [0, 1, 2], theta: 0.44, phi: 0.82, zoom: 1.02 },
      { id: 'gate', label: '大门', target: [-106, 5, 56], theta: -0.92, phi: 0.94, zoom: 2.35 },
      { id: 'weigh', label: '地磅', target: [-82, 5, 56], theta: 0.34, phi: 0.92, zoom: 2.65 },
      { id: 'tmr', label: '配料', target: [-94, 11, -34], theta: 0.62, phi: 0.90, zoom: 2.05 },
      { id: 'barn', label: '牛舍', target: [-16, 6, -54], theta: 0.15, phi: 0.95, zoom: 2.2 },
      { id: 'dock', label: '装车', target: [100, 5, -64], theta: 0.50, phi: 0.98, zoom: 2.7 },
      { id: 'hall', label: '大厅内景', target: [-25.0, 3.2, -1.0], theta: -0.18, phi: 1.54, dist: 14.5 },
    ],

    stages: [
      { id: 'gate', no: '01', label: '车辆进场', en: 'INBOUND', color: 0x63c9ff },
      { id: 'weigh', no: '02', label: '地磅称重', en: 'WEIGHING', color: 0x63c9ff },
      { id: 'sort', no: '03', label: '分流卸牛', en: 'SORTING', color: 0xffc46b },
      { id: 'tmr', no: '04', label: 'TMR 配料', en: 'MIXING', color: 0x9de07a },
      { id: 'feed', no: '05', label: '日粮饲喂', en: 'FEEDING', color: 0xff9a52 },
      { id: 'load', no: '06', label: '出栏装车', en: 'OUTBOUND', color: 0xff7f9e },
    ],
  });

  L.barnFront = (b) => b.cz + b.dep / 2;
  L.barnBack = (b) => b.cz - b.dep / 2;
