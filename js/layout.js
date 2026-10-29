/* ============================================================
 *  layout.js — 场地坐标 / 路网 / 车辆路线 / 视角
 *  单位：米。相机从东南（+x +z）看向西北，所以画面左＝西，右＝东。
 * ============================================================ */
(function (root) {
  'use strict';
  const FL = (root.FL = root.FL || {});

  const L = (FL.LAYOUT = {
    plot: { x0: -127, x1: 127, z0: -99, z1: 95 },
    slab: { w: 254, d: 194, cx: 0, cz: -2 },

    roads: [
      {
        id: 'entry',
        width: 12,
        pts: [[-127, 56], [-116, 56], [-102, 56], [-88, 56], [-74, 56], [-65, 54], [-58, 50]],
      },
      {
        id: 'west',
        width: 11,
        pts: [[-58, 52], [-58, 28], [-58, 0], [-58, -30], [-58, -44], [-58, -62], [-58, -76], [-54, -82], [-40, -84], [0, -84], [50, -84], [100, -84], [112, -82]],
      },
      {
        id: 'east',
        width: 11,
        pts: [[112, -99], [112, -50], [112, 0], [112, 44], [112, 86]],
      },
      {
        id: 'south',
        width: 10,
        pts: [[-58, 52], [-30, 49], [0, 48], [40, 48], [80, 48], [106, 48], [112, 50]],
      },
      {
        id: 'plantAccess',
        width: 9,
        pts: [[-86, 50], [-87, 45], [-88, 40], [-89, 35], [-88, 30], [-87, 26]],
      },
      {
        id: 'feed',
        width: 12,
        pts: [[-58, -44], [-40, -44], [-20, -44], [0, -44], [28, -44], [48, -44], [76, -44], [92, -44], [98, -42], [99, -37]],
      },
    ],

    junctions: [
      { x: -58, z: 52, w: 26, d: 24 },
      { x: -58, z: -44, w: 22, d: 20 },
      { x: 112, z: 48, w: 22, d: 22 },
      { x: 112, z: -84, w: 20, d: 20 },
      { x: -88, z: 37, w: 16, d: 18 },
    ],

    slots: {
      gate: { x: -108, z: 56 },
      weighbridge: { x: -84, z: 56 },
      plantEntry: { x: -88, z: 30 },
      tmrBay: { x: -84, z: -6 },
      unloading: { x: -55, z: -66 },
      dock: { x: 112, z: -69 },
      exitGate: { x: 112, z: 86 },
      northGate: { x: 112, z: -86 },
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

    /* 场区中部（生产区以南，用围墙隔开）：交易中心 / 员工办公 / 机修 */
    market: {
      wall: { z: -11, x0: -50, x1: 104, gates: [[-48, -38]], walkGate: [58, 61.5] },
      hall: { cx: -20, cz: 2, w: 34, d: 19 },
      pens: { x0: 0, z0: -9, cols: 3, rows: 2, w: 8.4, d: 7.4, gx: 1.8, gz: 1.8 },
      ramp: { x: 31.5, z: 2 },
      scale: { x: 38, z: 16 },
      parking: { x0: 44, x1: 104, z0: 24, z1: 40, aisle: 5.2, stall: 2.7 },
      office: { cx: 12, cz: 68, w: 46, d: 12, rot: Math.PI },
      workshop: { cx: 92, cz: 26 },
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
        { x: -144, z: 56, stage: 'gate' },
        { x: -120, z: 56, stage: 'gate' },
        { x: -108, z: 56, stage: 'gate', label: '驶入大门' },
        { x: -96, z: 56, stage: 'weigh' },
        { x: -84, z: 56, stop: 3, stage: 'weigh', label: '地磅称重' },
        { x: -72, z: 56, stage: 'sort' },
        { x: -64, z: 54, stage: 'sort' },
        { x: -57, z: 48, stage: 'sort' },
        { x: -55, z: 36, stage: 'sort', label: '驶向卸牛台' },
        { x: -55, z: 0, stage: 'sort' },
        { x: -55, z: -44, stage: 'sort' },
        { x: -55, z: -58, stage: 'sort' },
        { x: -55, z: -66, stop: 10, stage: 'sort', label: '卸牛作业' },
        { x: -55, z: -76, stage: null },
        { x: -52, z: -82, stage: null },
        { x: -40, z: -84, stage: null },
        { x: 20, z: -84, stage: null, label: '空车离场' },
        { x: 80, z: -84, stage: null },
        { x: 104, z: -84, stage: null },
        { x: 112, z: -78, stage: null },
        { x: 112, z: -40, stage: null },
        { x: 112, z: 0, stage: null },
        { x: 112, z: 48, stage: null },
        { x: 112, z: 84, stage: null },
        { x: 116, z: 100, stage: null },
      ],

      forageTruck: [
        { x: -146, z: 52, stage: 'gate' },
        { x: -122, z: 55, stage: 'gate' },
        { x: -108, z: 56, stage: 'gate', label: '草料车进场' },
        { x: -96, z: 56, stage: 'weigh' },
        { x: -84, z: 56, stop: 3, stage: 'weigh', label: '草料过磅' },
        { x: -83.5, z: 51, stage: 'tmr' },
        { x: -80, z: 47, stage: 'tmr' },
        { x: -77.5, z: 42, stage: 'tmr' },
        { x: -76, z: 36, stage: 'tmr' },
        { x: -75.5, z: 30, stage: 'tmr' },
        { x: -75.5, z: 25, stage: 'tmr' },
        { x: -77, z: 20.4, stage: 'tmr' },
        { x: -80.5, z: 18.4, stage: 'tmr' },
        { x: -86, z: 17.8, stage: 'tmr' },
        { x: -92, z: 17.7, stop: 9, stage: 'tmr', label: '青贮卸料' },
        { x: -99, z: 17.7, stage: 'tmr' },
        { x: -105, z: 17.2, stage: 'tmr' },
        { x: -108.5, z: 14.6, stage: 'tmr' },
        { x: -109, z: 10.5, stage: 'tmr' },
        { x: -105.5, z: 7.2, stage: 'tmr' },
        { x: -98, z: 6.2, stage: 'tmr' },
        { x: -90, z: 6.6, stage: 'tmr' },
        { x: -84, z: 8.8, stage: 'tmr' },
        { x: -79.6, z: 13.5, stage: 'tmr' },
        { x: -78.6, z: 19, stage: 'tmr' },
        { x: -78.8, z: 25, stage: 'tmr' },
        { x: -79.8, z: 31, stage: 'tmr' },
        { x: -81.6, z: 37, stage: 'tmr' },
        { x: -83.2, z: 43, stage: 'tmr' },
        { x: -83.8, z: 48, stage: null },
        { x: -59, z: 52, stage: null },
        { x: -30, z: 49, stage: null },
        { x: 0, z: 48, stage: null },
        { x: 50, z: 48, stage: null },
        { x: 90, z: 48, stage: null },
        { x: 108, z: 49, stage: null },
        { x: 112, z: 58, stage: null },
        { x: 112, z: 86, stage: null, label: '空车离场' },
        { x: 116, z: 100, stage: null },
      ],

      tmrTruck: [
        { x: -84, z: -6, stage: 'tmr', label: '日粮装车' },
        { x: -80, z: -8, stage: 'tmr' },
        { x: -74, z: -10, stage: 'tmr' },
        { x: -68, z: -14, stage: 'tmr' },
        { x: -64, z: -20, stage: 'tmr' },
        { x: -61, z: -26, stage: 'tmr' },
        { x: -61, z: -32, stage: 'tmr' },
        { x: -60, z: -38, stage: 'tmr' },
        { x: -57, z: -42, stage: 'feed' },
        { x: -52, z: -46, stage: 'feed' },
        { x: -30, z: -47, stage: 'feed' },
        { x: -20, z: -47, stop: 6, stage: 'feed', label: '1 号牛舍投料' },
        { x: 0, z: -47, stage: 'feed' },
        { x: 18, z: -47, stage: 'feed' },
        { x: 28, z: -47, stop: 6, stage: 'feed', label: '2 号牛舍投料' },
        { x: 48, z: -47, stage: 'feed' },
        { x: 66, z: -47, stage: 'feed' },
        { x: 76, z: -47, stop: 6, stage: 'feed', label: '3 号牛舍投料' },
        { x: 90, z: -47, stage: 'feed' },
        { x: 96, z: -44, stage: 'feed' },
        { x: 99, z: -40, stage: 'feed' },
        { x: 99, z: -37, stage: 'feed' },
        { x: 94, z: -40, stage: 'feed' },
        { x: 86, z: -41, stage: 'feed' },
        { x: 76, z: -41, stop: 6, stage: 'feed', label: '6 号牛舍投料' },
        { x: 48, z: -41, stage: 'feed' },
        { x: 28, z: -41, stop: 6, stage: 'feed', label: '5 号牛舍投料' },
        { x: 0, z: -41, stage: 'feed' },
        { x: -20, z: -41, stop: 6, stage: 'feed', label: '4 号牛舍投料' },
        { x: -38, z: -41, stage: 'feed' },
        { x: -54, z: -41, stage: 'feed' },
        { x: -58, z: -36, stage: 'tmr' },
        { x: -58, z: -30, stage: 'tmr' },
        { x: -61, z: -24, stage: 'tmr' },
        { x: -64, z: -18, stage: 'tmr' },
        { x: -68, z: -12, stage: 'tmr' },
        { x: -72, z: -6, stage: 'tmr' },
        { x: -76, z: -2, stage: 'tmr' },
        { x: -82, z: -4, stage: 'tmr' },
        { x: -84, z: -6, stage: 'tmr' },
      ],

      outboundTruck: [
        { x: 112, z: -110, stage: null },
        { x: 112, z: -96, stage: null },
        { x: 112, z: -86, stage: null, label: '待装卡车进场' },
        { x: 110.6, z: -88, stage: 'load' },
        { x: 109.2, z: -80, stage: 'load' },
        { x: 109, z: -69, stop: 10, stage: 'load', label: '装车作业' },
        { x: 109, z: -57, stage: 'load' },
        { x: 109.4, z: -48, stage: 'load' },
        { x: 111.6, z: -40, stage: 'load' },
        { x: 112, z: -20, stage: 'load' },
        { x: 112, z: 0, stage: 'load' },
        { x: 112, z: 48, stage: 'load' },
        { x: 112, z: 82, stage: 'load', label: '满载出场' },
        { x: 112, z: 96, stage: 'load' },
      ],
    },

    /* 流向光带（画在路面上） */
    flow: [
      {
        id: 'intake',
        color: 0x63c9ff,
        width: 1.6,
        pts: [[-127, 56], [-108, 56], [-84, 56], [-68, 55], [-58, 50], [-56, 42]],
      },
      {
        id: 'forage',
        color: 0x9de07a,
        width: 1.5,
        pts: [[-84, 56], [-82, 49], [-78, 43], [-76, 35], [-75.5, 27], [-77.5, 21.5], [-82, 18.4], [-88, 17.9], [-95, 17.7], [-102, 17.4], [-107, 16.2]],
      },
      {
        id: 'cattle',
        color: 0xffc46b,
        width: 1.5,
        pts: [[-58, 50], [-55, 40], [-55, 0], [-55, -44], [-55, -58], [-55, -66], [-51, -68]],
      },
      {
        id: 'feed',
        color: 0xff9a52,
        width: 1.7,
        pts: [[-84, -6], [-74, -10], [-64, -16], [-61, -28], [-58, -38], [-52, -46], [-20, -47], [28, -47], [76, -47], [94, -44], [99, -39], [94, -41], [48, -41], [0, -41], [-40, -41], [-54, -41], [-58, -36], [-58, -30], [-61, -24], [-64, -18], [-74, -10], [-84, -6]],
      },
      {
        id: 'outbound',
        color: 0xff7f9e,
        width: 1.6,
        pts: [[96, -67], [100, -67], [104, -68], [108, -69], [112, -69], [112, -40], [112, 0], [112, 48], [112, 84]],
      },
    ],

    cameras: [
      { id: 'overview', label: '全览', target: [-2, 1, -9], theta: 0.66, phi: 0.72, zoom: 0.86 },
      { id: 'gate', label: '大门', target: [-104, 7, 56], theta: -1.15, phi: 0.95, zoom: 2.8 },
      { id: 'weigh', label: '地磅', target: [-84, 5, 56], theta: 0.30, phi: 0.92, zoom: 3.0 },
      { id: 'tmr', label: '配料', target: [-96, 9, -14], theta: 0.62, phi: 0.92, zoom: 2.3 },
      { id: 'barn', label: '牛舍', target: [-16, 6, -54], theta: 0.15, phi: 0.95, zoom: 2.2 },
      { id: 'dock', label: '装车', target: [100, 5, -64], theta: 0.50, phi: 0.98, zoom: 2.7 },    ],

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

})(window);
