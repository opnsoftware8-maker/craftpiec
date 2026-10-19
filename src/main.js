import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { createCamera } from './system/camera.js';
import { Player } from './player.js';
import { InputController } from './control.js';
import { SwordManager } from './combat/sword.js';

// ติดตั้ง Accelerated Raycast เข้ากับ THREE.Mesh เพื่อประสิทธิภาพ Raycasting สูงสุด 60 FPS (ไม่แลค)
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// 1. สร้างฉาก 3D และตัวเรนเดอร์ (Optimized: ปิดแสงเงา Shadow Map ทั้งหมด เพื่อความลื่นไหลสูงสุด)
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7bc5e8);
scene.fog = new THREE.FogExp2(0x7bc5e8, 0.0035);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: 'high-performance'
});

// ออฟติไมส์ PixelRatio ให้ลื่นไหลบนทุกอุปกรณ์
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

// 2. กล้องมุมมองบุคคลที่สาม ARPG สวยงาม สเกลพอดีตัวละครและเกาะ
const camera = createCamera();
const cameraOffset = new THREE.Vector3(0, 11, 16);

// 3. แสงสว่างสดใส สไตล์ One Piece
scene.add(new THREE.HemisphereLight(0xffffff, 0x557799, 2.4));

const sunlight = new THREE.DirectionalLight(0xfffaed, 2.5);
sunlight.position.set(150, 300, 100);
sunlight.castShadow = false;
scene.add(sunlight);

scene.add(new THREE.AmbientLight(0xffffff, 0.9));

// 4. ผืนน้ำทะเลสีฟ้าใสรอบเกาะทั้งสอง (Water Plane)
const oceanGeometry = new THREE.PlaneGeometry(1200, 1200);
const oceanMaterial = new THREE.MeshBasicMaterial({
  color: 0x1f90cf,
  transparent: true,
  opacity: 0.72,
  side: THREE.DoubleSide
});
const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -3.8;
scene.add(ocean);

// 5. โหลดเกาะใหม่ (stisland.glb) พร้อมสร้าง BVH เพื่อการเดินที่ไม่ทะลุและลื่นไหล 60 FPS ไร้แลค
let islandModel = null;
const loader = new GLTFLoader();

function loadIsland(url, isFallback = false) {
  loader.load(
    url,
    (gltf) => {
      const island = gltf.scene;

      // ปรับขนาดเกาะให้ใหญ่พอดีกับตัวละครเรา (กว้างประมาณ 150 เมตร มีสองเกาะและร่องน้ำตรงกลาง)
      const scaleFactor = 80;
      island.scale.set(scaleFactor, scaleFactor, scaleFactor);
      island.updateMatrixWorld(true);

      // จัดจุดกึ่งกลางของระบบเกาะในแนวระนาบ (X, Z) และขยับความสูง (Y) ขึ้นตามความสูงเดิมของเกาะ ไม่ให้จมน้ำ
      const box = new THREE.Box3().setFromObject(island);
      const center = box.getCenter(new THREE.Vector3());
      const islandLiftY = 5.0; // ขยับเกาะให้สูงขึ้นประมาณความสูงเดิมของเกาะ พ้นระดับน้ำทะเล
      island.position.set(-center.x, -center.y + islandLiftY, -center.z);
      island.updateMatrixWorld(true);

      // สร้าง BVH (Bounding Volume Hierarchy) บน Mesh ทุกชิ้นของเกาะ เพื่อการ Raycast ที่เร็วระดับเสี้ยววินาที
      island.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          if (child.material) {
            child.material.side = THREE.DoubleSide;
          }
          if (child.geometry) {
            child.geometry.boundsTree = new MeshBVH(child.geometry);
          }
        }
      });

      scene.add(island);
      islandModel = island;

      // นำตัวละครไปเกิดที่ "เกาะข้างซ้าย" (เกาะแรก) ทันที
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

// 6. ตัวละคร (Player), ดาบ (SwordManager) และระบบอินพุต (InputController)
const player = new Player(scene);
const inputController = new InputController();
const swordManager = new SwordManager(player, scene);

player.load('/playermodel.glb', () => {
  if (islandModel) {
    player.snapToCenter(islandModel);
  }
  swordManager.attachToHand();
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

  // อัปเดตตัวละคร (เดิน, แดช, ฟื้น Stamina, ตรวจสอบการเดินบนพื้นเกาะไม่ทะลุ)
  player.update(delta, input, islandModel);

  // กล้อง ARPG ล็อคติดตามตัวละครอย่างนุ่มนวล
  if (player.characterGroup) {
    camera.position.x = player.position.x + cameraOffset.x;
    camera.position.y = player.position.y + cameraOffset.y;
    camera.position.z = player.position.z + cameraOffset.z;

    camera.lookAt(
      player.position.x,
      player.position.y + 1.2,
      player.position.z - 2.0
    );
  }

  renderer.render(scene, camera);
}

animate();
