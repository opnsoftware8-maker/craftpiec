// src/combat/sword.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class SwordManager {
  constructor(player, scene) {
    this.player = player;
    this.scene = scene;

    // สถานะดาบที่ใช้งาน (ยืดหยุ่น รับค่าตัวแปรสถานะดาบที่ใช้)
    this.swordName = 'Blackblade';
    this.modelUrl = '/blackblade.glb';

    // ตัวแปรสถานะแอคทีฟ (Active State)
    // คุมทั้งว่าปุ่มนี้ควรมีขอบฟ้าไหม และต้องวาดโมเดลดาบลงมือตัวละครไหม
    this.isActive = false;

    this.swordGroup = null;
    this.handBone = null;
    this.buttonElement = null;
    this.nameLabelElement = null;

    this.createSlotUI();
    this.loadSwordModel();
  }

  // สร้างปุ่มสี่เหลี่ยมจัตุรัส สีดำ ตามภาพต้นแบบ
  createSlotUI() {
    const btn = document.createElement('div');
    btn.id = 'sword-slot-button';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '64px',
      height: '64px',
      backgroundColor: '#2e2e2e',
      border: '2px solid rgba(255, 255, 255, 0.25)',
      borderRadius: '4px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      cursor: 'pointer',
      userSelect: 'none',
      webkitUserSelect: 'none',
      zIndex: '120',
      touchAction: 'manipulation',
      boxSizing: 'border-box',
      padding: '4px'
    });

    btn.innerHTML = `
      <div style="position: absolute; top: 4px; left: 6px; font-size: 12px; font-weight: 800; color: #ffffff; text-shadow: 1px 1px 2px #000000; pointer-events: none;">1</div>
      <div id="sword-name-text" style="font-size: 11px; font-weight: 700; color: #ffffff; text-align: center; line-height: 1.15; word-break: break-word; text-shadow: 1px 1px 3px #000000; pointer-events: none;">
        ${this.swordName}
      </div>
    `;

    // กดปุ่มเพื่อสลับสถานะแอคทีฟ
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.toggleActive();
    });

    // รองรับกดปุ่ม 1 บนคีย์บอร์ด
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Digit1' || e.key === '1') {
        this.toggleActive();
      }
    });

    document.body.appendChild(btn);
    this.buttonElement = btn;
    this.nameLabelElement = btn.querySelector('#sword-name-text');
  }

  // ฟังก์ชันยืดหยุ่นสำหรับเปลี่ยนชื่อดาบใน UI
  setSwordName(name) {
    this.swordName = name;
    if (this.nameLabelElement) {
      this.nameLabelElement.textContent = name;
    }
  }

  // โหลดโมเดล blackblade.glb
  loadSwordModel() {
    const loader = new GLTFLoader();
    loader.load(
      this.modelUrl,
      (gltf) => {
        const swordScene = gltf.scene;

        swordScene.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
        });

        // สร้าง Group เป็นจุด Pivot ตรงด้ามจับดาบ
        this.swordGroup = new THREE.Group();
        swordScene.position.set(-1.0, -5.5, 3.5);
        this.swordGroup.add(swordScene);

        // ปรับสเกลให้สมส่วนกับมือตัวละคร
        this.swordGroup.scale.set(0.045, 0.045, 0.045);
        this.swordGroup.rotation.set(Math.PI / 2, 0, 0);

        // เริ่มต้น: ดับโมเดลไว้ก่อน
        this.swordGroup.visible = false;

        this.attachToHand();
      },
      undefined,
      (error) => {
        console.error('Error loading blackblade.glb:', error);
      }
    );
  }

  // วาด/เชื่อมโมเดลดาบลงบนมือขวาของตัวละคร
  attachToHand() {
    if (!this.swordGroup) return;

    if (!this.handBone && this.player) {
      this.handBone = this.player.getRightHandBone();
    }

    if (this.handBone && this.swordGroup.parent !== this.handBone) {
      this.handBone.add(this.swordGroup);
    }

    this.applyActiveState();
  }

  // สลับสถานะแอคทีฟ
  toggleActive() {
    this.isActive = !this.isActive;
    this.applyActiveState();
  }

  // ตัวแปร isActive คุมทั้งขอบสีฟ้าของปุ่ม และการวาดโมเดลดาบลงมือ
  applyActiveState() {
    // 1. ควบคุมขอบปุ่มด้วย JS DOM
    if (this.buttonElement) {
      if (this.isActive) {
        this.buttonElement.style.border = '2.5px solid #00bfff';
        this.buttonElement.style.boxShadow = '0 0 10px rgba(0, 191, 255, 0.8)';
      } else {
        this.buttonElement.style.border = '2px solid rgba(255, 255, 255, 0.25)';
        this.buttonElement.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.6)';
      }
    }

    // 2. ควบคุมการวาดโมเดลดาบลงมือ
    if (this.swordGroup) {
      if (!this.handBone && this.player) {
        this.handBone = this.player.getRightHandBone();
        if (this.handBone && this.swordGroup.parent !== this.handBone) {
          this.handBone.add(this.swordGroup);
        }
      }

      this.swordGroup.visible = this.isActive;
    }
  }
}
