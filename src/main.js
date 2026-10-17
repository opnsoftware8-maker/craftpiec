import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createCamera } from './system/camera.js';
import { Player } from './player.js';
import { InputController } from './control.js';

// 1. สร้างฉาก 3D และตัวเรนเดอร์ (Optimized: ปิดแสงเงา Shadow Map ทั้งหมด เพื่อความลื่นไหลสูงสุด)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

// ออฟติไมส์ PixelRatio ให้ลื่นไหลบนทุกอุปกรณ์
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false; // ปิดเงาตามคำขอเพื่อความลื่นไหล
document.body.appendChild(renderer.domElement);

// 2. กล้องมุมมองซูมสูงไกล สไตล์เกม ARPG (ตามภาพต้นแบบ)
const camera = createCamera();
const cameraOffset = new THREE.Vector3(0, 50, 50);

// 3. แสงสว่าง (ปรับแสงแบบไม่มีเงา นุ่มนวลและไม่กินทรัพยากร)
scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 2.2));

const sunlight = new THREE.DirectionalLight(0xffffff, 2.8);
sunlight.position.set(200, 400, 150);
sunlight.castShadow = false;
scene.add(sunlight);

scene.add(new THREE.AmbientLight(0xffffff, 0.8));



// 5. โหลดเกาะ (stisland.glb) ลดขนาด 2.5 เท่า แปลงวัสดุ Low-poly (Flat Shading)
let islandModel = null;
const loader = new GLTFLoader();

function loadIsland(url, isFallback = false) {
  loader.load(
    url,
    (gltf) => {
      const island = gltf.scene;

      island.traverse((child) => {
        if (child.isMesh) {
          // แปลง Geometry ให้เป็น Non-Indexed เพื่อโชว์เหลี่ยม Low-poly คมชัด
          if (child.geometry) {
            if (child.geometry.index) {
              child.geometry = child.geometry.toNonIndexed();
            }
            child.geometry.computeVertexNormals();
          }

          // ปรับวัสดุ Flat Shading สไตล์ Low-poly
          if (child.material) {
            child.material.flatShading = true;
            child.material.roughness = 0.88;
            child.material.metalness = 0.05;
            child.material.side = THREE.DoubleSide;
            if (child.geometry.attributes.color) {
              child.material.vertexColors = true;
            }
            child.material.needsUpdate = true;
          }

          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      // ย่อขนาดเกาะ 2.5 เท่า
      const scaleFactor = 1 / 3.75;
      island.scale.set(scaleFactor, scaleFactor, scaleFactor);
      island.updateMatrixWorld(true);

      // จัดเกาะไว้ตรงกลางจุดเริ่มต้น (0, 0, 0)
      const box = new THREE.Box3().setFromObject(island);
      const center = box.getCenter(new THREE.Vector3());
      island.position.sub(center);
      island.updateMatrixWorld(true);

      scene.add(island);
      islandModel = island;

      if (player && player.characterGroup) {
        player.snapToCenter(islandModel);
      }
    },
    undefined,
    (error) => {
      if (!isFallback) {
        loadIsland('/stisland.glb', true);
      } else {
        console.error('Island loading error:', error);
      }
    }
  );
}

// 6. ตัวละคร (Player) และระบบอินพุต (InputController)
const player = new Player(scene);
const inputController = new InputController();

player.load('/playermodel.glb', () => {
  if (islandModel) {
    player.snapToCenter(islandModel);
  }
});

// เริ่มโหลดเกาะ
loadIsland('/stisland.glb');

// 7. จัดการ Resize หน้าจอ
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// 8. Animation & Game Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const input = inputController.getInput();

  // อัปเดตตัวละคร (เดิน, แดช, กระโดดต่อเนื่อง, กระโดดซ้ำบนอากาศ, ฟื้น Stamina)
  player.update(delta, input, islandModel);

  // กล้องซูมสูงไกล ล็อคติดตามตัวละคร
  if (player.characterGroup) {
    camera.position.x = player.position.x + cameraOffset.x;
    camera.position.y = player.position.y + cameraOffset.y;
    camera.position.z = player.position.z + cameraOffset.z;

    camera.lookAt(
      player.position.x,
      player.position.y + 0.5,
      player.position.z - 4.0
    );
  }

  renderer.render(scene, camera);
}

animate();
