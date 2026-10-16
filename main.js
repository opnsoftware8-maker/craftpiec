import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { createCamera } from './system/camera.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = createCamera();

scene.add(new THREE.HemisphereLight(0xffffff, 0x808080, 2));

const light = new THREE.DirectionalLight(0xffffff, 3);
light.position.set(10, 20, 10);
scene.add(light);

const status = document.createElement('div');

Object.assign(status.style, {
  position: 'fixed',
  top: '10px',
  left: '10px',
  zIndex: '9999',
  padding: '10px',
  background: '#111827',
  color: 'white',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  overflowWrap: 'anywhere',
  maxWidth: '90%',
  borderRadius: '8px'
});

status.textContent = 'กำลังโหลดโมเดล...';
document.body.appendChild(status);

const loader = new GLTFLoader();

loader.load(
  new URL('./Models/stisland.glb', import.meta.url).href,
  (gltf) => {
    const island = gltf.scene;

    scene.add(island);

    const box = new THREE.Box3().setFromObject(island);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    island.position.sub(center);

    const sphere = new THREE.Sphere();
    new THREE.Box3().setFromObject(island).getBoundingSphere(sphere);

    if (sphere.radius > 0) {
      const distance = sphere.radius / Math.sin(
        THREE.MathUtils.degToRad(camera.fov / 2)
      );

      camera.position.set(
        distance * 0.6,
        distance * 0.4,
        distance * 1.5
      );

      camera.lookAt(0, 0, 0);
      camera.near = Math.max(sphere.radius / 1000, 0.001);
      camera.far = sphere.radius * 100;
      camera.updateProjectionMatrix();
    }

    status.textContent =
      `โหลดโมเดลสำเร็จ! ขนาด X:${size.x.toFixed(2)} Y:${size.y.toFixed(2)} Z:${size.z.toFixed(2)}`;
  },
  (progress) => {
    status.textContent = progress.total
      ? `กำลังโหลดโมเดล ${Math.round(progress.loaded / progress.total * 100)}%`
      : `กำลังโหลดโมเดล ${progress.loaded} bytes`;
  },
  (error) => {
    status.textContent = `โหลดโมเดลไม่สำเร็จ: ${error.message || error}`;
    console.error(error);
  }
);

window.addEventListener('error', (event) => {
  status.textContent = `JavaScript Error: ${event.message}`;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

animate();