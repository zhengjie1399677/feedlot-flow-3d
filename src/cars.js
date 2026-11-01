import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { FL } from './fl.js';

/* ============================================================
 *  cars.js — 停车场的车（Kenney Car Kit，CC0）
 *  原来那 40 台是圆角盒子拼的，颜色又艳，整片停车区比场地本体还抢眼。
 *  换成现成模型以后形状、车窗、车灯、轮子都是对的，只要把饱和度压下来。
 * ============================================================ */
const U = FL.U;

const MODELS = [
  'sedan',
  'suv',
  'van',
  'delivery',
  'hatchback-sports',
  'truck',
  'taxi',
];

// 车身贴图是同一张色板，直接用材质的 color 整体压一点、往灰里拉，
// 免得停车场变成一排彩虹。压太狠会发脏，这个数是看图调出来的。
const TINT = new THREE.Color(0xb9b6b0);
const SCALE = 1.35;

FL.createParkedCars = function (world) {
  const slots = world.parkingSlots;
  if (!slots || !slots.length) return;

  const loader = new GLTFLoader();
  const group = new THREE.Group();
  group.name = 'parkedCars';
  world.group.add(group);

  let loaded = 0;
  MODELS.forEach(function (name) {
    loader.load('models/cars/' + name + '.glb', function (gltf) {
      const proto = gltf.scene;
      proto.traverse(function (o) {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = false;
          const m = o.material.clone();
          if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
          m.color = m.color.clone().multiply(TINT);
          m.roughness = Math.min(1, (m.roughness == null ? 0.6 : m.roughness) + 0.18);
          m.metalness = Math.max(0, (m.metalness == null ? 0 : m.metalness) - 0.15);
          m.envMapIntensity = 0.9;
          o.material = m;
        }
      });

      // 同一个模型只在它对应的车位上出现，避免一排全是同一辆车
      for (let i = 0; i < slots.length; i++) {
        if (slots[i].kind !== name) continue;
        const car = cloneSkinned(proto);
        car.position.set(slots[i].x, slots[i].y, slots[i].z);
        car.rotation.y = slots[i].rot;
        car.scale.setScalar(SCALE * (0.94 + ((i * 37) % 13) / 100));
        group.add(car);
      }
      loaded++;
      if (loaded === MODELS.length && U && U.stats) U.stats.cars = group.children.length;
    }, undefined, function () { /* 模型缺失就空着，不影响场景 */ });
  });
};

FL.CAR_MODELS = MODELS;
