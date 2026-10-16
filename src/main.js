import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js';
import { createCamera } from './system/camera.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const camera = createCamera();

scene.add(new THREE.HemisphereLight(0xffffff, 0x808080, 2));

const sunlight = new THREE.DirectionalLight(0xffffff, 3);
sunlight.position.set(10, 20, 10);
scene.add(sunlight);

const status = document.createElement('div');

Object.assign(status.style, {
  position: 'fixed',
  top: '12px',
  left: '12px',
  zIndex: '10',
  padding: '10px 14px',
  background: '#111827',
  color: '#ffffff',
  borderRadius: '8px',
  font: '14px sans-serif',
  maxWidth: '90%',
  overflowWrap: 'anywhere'
});

status.textContent = 'กำลังโหลดเกาะ...';
document.body.appendChild(status);

const modelURL = new URL('/Models/stisland.glb', window.location.origin).href;

const loader = new GLTFLoader();

loader.load(
  modelURL,
  (gltf) => {
    const island = gltf.scene;

    scene.add(island);

    const box = new THREE.Box3().setFromObject(island);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    island.position.sub(center);

    const sphere = new THREE.Sphere();
    new THREE.Box3().setFromObject(island).getBoundingSphere(sphere);

    if (sphere.radius > 0) {
      const radius = sphere.radius;
      const verticalFov = THREE.MathUtils.degToRad(camera.fov);
      const horizontalFov = 2 * Math.atan(
        Math.tan(verticalFov / 2) * camera.aspect
      );

      const limitingFov = Math.min(verticalFov, horizontalFov);
      const distance = radius / Math.sin(limitingFov / 2);

      camera.position.set(
        distance * 0.7,
        distance * 0.55,
        distance * 1.5
      );

      camera.lookAt(0, 0, 0);
      camera.near = Math.max(radius / 1000, 0.001);
      camera.far = Math.max(radius * 100, 1000);
      camera.updateProjectionMatrix();
    }

    status.textContent = `โหลดเกาะสำเร็จ | ${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)}`;
  },
  (progress) => {
    if (progress.total > 0) {
      status.textContent = `กำลังโหลดเกาะ ${Math.round(progress.loaded / progress.total * 100)}%`;
    }
  },
  (error) => {
    console.error('GLB loading error:', error);
    status.textContent = `โหลดเกาะไม่สำเร็จ: ${modelURL}`;
  }
);

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
