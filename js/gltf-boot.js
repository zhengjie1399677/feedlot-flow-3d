// 运行时加载器：只有在 http(s) 下才走到这里（file:// 打不开 module）
import { GLTFLoader } from '../vendor/addons/GLTFLoader.js';
import { clone as cloneSkinned } from '../vendor/addons/SkeletonUtils.js';

window.FL_GLTF = { GLTFLoader, cloneSkinned };
document.body.dataset.gltf = 'ready';
window.dispatchEvent(new Event('fl-gltf-ready'));
