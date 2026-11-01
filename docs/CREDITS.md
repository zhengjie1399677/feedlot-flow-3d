# 素材来源与许可

这个仓里除代码外，用了四份现成素材。全部是 CC0 / 公共领域，允许商用、可再分发，不强制署名——这里仍然逐条写清楚来源，方便日后替换或追责。

## 1. 牛 `public/models/cow_polyfork.glb`

- 来源：<https://polyfork.dev/asset/cow-base>
- 许可：CC0 1.0
- 用途：场内 66 头牛。带 Idle / Walk 两段骨骼动画，`SkeletonUtils.clone` 克隆后各自驱动 `AnimationMixer`。

## 2. 车辆 `public/models/cars/*.glb`

- 来源：Kenney · Car Kit 3.1 <https://kenney.nl/assets/car-kit>
- 许可：CC0 1.0（压缩包内 `License.txt` 原文："License: (Creative Commons Zero, CC0)"）
- 改动：
  - 只取了 7 个车型（sedan / suv / van / delivery / hatchback-sports / truck / taxi）；
  - GLB 内部的贴图引用从 `Textures/colormap.png` 改成本目录的 `colormap.png`（重写 JSON chunk，保持 4 字节对齐）；
  - `colormap.png` 整体降饱和到 32%、压暗到 86%——原色板太艳，整片停车场比场地本体还抢眼。
- 用途：员工楼前的停车场（38 个车位）。场地里跑的三台货车仍是程序化建模，因为要按路线行驶、带刹车灯与转向灯，用现成低模反而不好接。

## 3. 全景图 `public/hdri/*.hdr`

- 来源：Poly Haven · Qwantani 系列 <https://polyhaven.com/a/qwantani_noon_puresky> 等四张
  - `qwantani_dawn_puresky.hdr` → `dawn`
  - `qwantani_noon_puresky.hdr` → `day`
  - `qwantani_sunset_puresky.hdr` → `dusk`
  - `qwantani_night_puresky.hdr` → `night`
- 许可：CC0 1.0
- 改动：原图 1k（1024×512），用 `tools/hdr_min.py` 自写的 Radiance RGBE 读写降采样到 256×128，每张约 131 KB，四张共 512 KB。原始文件不入库。
- 用途：`scene.environment`。按昼夜权重切换，强度压得很低（0.035–0.10），主要给玻璃和金属提供反射，漫反射补光仍由半球光和主光负责。

## 4. PBR 贴图 `public/tex/<AssetId>/`

- 来源：ambientCG <https://ambientcg.com/>
  - `Concrete034` → 混凝土地坪、场地
  - `Asphalt033` → 沥青路面、停车场
  - `CorrugatedSteel009` → 彩钢瓦墙面、镀锌件
  - `PaintedPlaster017` → 抹灰墙面
- 许可：CC0 1.0
- 改动：
  - 用 `tools/tex_prep.py` 从 1K JPG 压缩包中提取 color / normal / roughness / ambient occlusion，统一缩到 512²（每套 4–5 张，共 15 张 760 KB）；
  - 混凝土与抹灰的 albedo 做了去色（`Image.blend` 与自身灰度图混合，k = 0.88 / 0.6），色相全部交给材质的 `color`——否则暖光乘暖图会糊成一片土黄。
- 用途：`src/utils.js` 的 `U.surface()` 按名字载入，`U.boxUV()` 把盒子的 uv 换算成"每 N 米一次"，让 40 m 的墙和 2 m 的箱子共用同一个物理尺度。

## 未使用外部素材的部分

建筑、筒仓、围栏、灯杆、树、道路、地形贴图、天空穹顶、牛栏、传送带、光带全部由代码程序化生成（`src/utils.js` 的 canvas 贴图 + `src/world.js` / `src/buildings.js` / `src/terrain.js` 的几何拼装），不依赖任何外部文件。
