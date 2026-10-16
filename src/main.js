import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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

// OrbitControls เพื่อให้หมุนดูเกาะรอบทิศทางได้ทั้งบนมือถือและคอมพิวเตอร์
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// แสงสว่างรอบทิศและแสงแดดส่องกระทบเกาะ
scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 2.5));

const sunlight = new THREE.DirectionalLight(0xffffff, 3.5);
sunlight.position.set(500, 1000, 500);
scene.add(sunlight);

scene.add(new THREE.AmbientLight(0xffffff, 1.2));

// กล่องแสดงสถานะที่มุมซ้ายบนตามโค้ดเดิม
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
  overflowWrap: 'anywhere',
  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
});

status.textContent = 'กำลังโหลดเกาะ...';
document.body.appendChild(status);

const modelURL = new URL('/Models/stisland.glb', window.location.origin).href;

const loader = new GLTFLoader();

loader.load(
  modelURL,
  (gltf) => {
    const island = gltf.scene;

    // คำนวณ Normals ให้โมเดลกรณีไม่มี Normals เพื่อให้รับแสงสว่างได้สมบูรณ์
    island.traverse((child) => {
      if (child.isMesh) {
        if (!child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.material.side = THREE.DoubleSide;
        if (child.geometry.attributes.color) {
          child.material.vertexColors = true;
        }
      }
    });

    scene.add(island);

    // จัดเกาะให้อยู่ตรงกลาง Scene
    const box = new THREE.Box3().setFromObject(island);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    island.position.sub(center);

    // ปรับระยะกล้องให้มองเห็นเกาะพอดีเฟรม
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
      camera.near = Math.max(radius / 1000, 0.01);
      camera.far = Math.max(radius * 100, 10000);
      camera.updateProjectionMatrix();

      controls.target.set(0, 0, 0);
      controls.update();
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
    status.textContent = `โหลดเกาะไม่สำเร็จ: ${modelURL} (${error.message || error})`;
    status.style.background = '#dc2626';
  }
);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
