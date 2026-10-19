// src/player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Precomputed target quaternions for dynamic aerodynamic dash pose
const Q_SPINE_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (28 * Math.PI) / 180);
const Q_CHEST_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (10 * Math.PI) / 180);
const Q_HEAD_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (-14 * Math.PI) / 180);

const Q_REST_UPPER_ARM_L = new THREE.Quaternion(9.74745e-9, 9.32834e-8, -0.382683, 0.92388);
const Q_REST_UPPER_ARM_R = new THREE.Quaternion(9.74745e-9, -9.32834e-8, 0.382683, 0.92388);
// Upper arms sweep 55° backward and down relative to torso, flaring slightly outward for clean aerodynamics
const Q_UPPER_ARM_L_DASH = Q_REST_UPPER_ARM_L.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.58, 0, 0.20, 'YXZ')));
const Q_UPPER_ARM_R_DASH = Q_REST_UPPER_ARM_R.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.58, 0, -0.20, 'YXZ')));
const Q_LOWER_ARM_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.20);

const Q_REST_LEG = new THREE.Quaternion(4.37114e-8, 0, -1, 0);

// Left leg: forward stride (+35°) + natural knee stride flexion
const Q_UPPER_LEG_L_DASH = Q_REST_LEG.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), (35 * Math.PI) / 180));
const Q_LOWER_LEG_L_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.65);

// Right leg: backward stride (-55°) + trailing knee flexion (-49°)
const Q_UPPER_LEG_R_DASH = Q_REST_LEG.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.95));
const Q_LOWER_LEG_R_DASH = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.85);

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.mesh = null;
    this.characterGroup = null;
    this.mixer = null;
    this.actions = {};
    this.activeAction = null;

    this.maxHp = 1000;
    this.hp = 1000;
    this.maxStamina = 1000;
    this.stamina = 1000;
    this.staminaRegenRate = 10;

    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.facingAngle = 0;
    this.isGrounded = true;

    this.moveSpeed = 8.5;
    this.gravity = -34.0;

    this.isDashing = false;
    this.dashSpeed = 28.0;
    this.dashDuration = 0.26;
    this.dashTimer = 0;
    this.dashCooldown = 0.05;
    this.dashCooldownTimer = 0;
    this.dashDirection = new THREE.Vector3(0, 0, -1);
    this.dashPoseWeight = 0;

    // การอ้างอิงกระดูกทุกข้อต่อสำหรับท่าแดชที่พริ้วไหว
    this.boneHips = null;
    this.boneSpine = null;
    this.boneChest = null;
    this.boneNeck = null;
    this.boneHead = null;
    this.boneUpperArmR = null;
    this.boneLowerArmR = null;
    this.boneUpperArmL = null;
    this.boneLowerArmL = null;
    this.boneUpperLegL = null;
    this.boneLowerLegL = null;
    this.boneUpperLegR = null;
    this.boneLowerLegR = null;
    this.boneHandR = null;

    this.characterHeight = 2.85;
    // ความสูงสูงสุดของสิ่งกีดขวางที่ยอมให้ "ข้าม" ได้ = 40% ของความสูงตัวละคร
    this.stepHeightRatio = 0.4;
    this.stepHeight = this.characterHeight * this.stepHeightRatio;
    this.characterRadius = 0.45;

    this.raycaster = new THREE.Raycaster();
    this.downVector = new THREE.Vector3(0, -1, 0);
    this.upVector = new THREE.Vector3(0, 1, 0);
    this.forwardVector = new THREE.Vector3();
    this.rayOrigin = new THREE.Vector3();
    this.probeOrigin = new THREE.Vector3();
    this.stepCheckOrigin = new THREE.Vector3();
    this.headCheckOrigin = new THREE.Vector3();
    this.vaultDirection = new THREE.Vector3();
    this.vaultTopOrigin = new THREE.Vector3();
    this.vaultStandPoint = new THREE.Vector3();

    // เวกเตอร์นำกลับมาใช้ซ้ำ (Reusable Vectors) เพื่อลด Garbage Collection และประหยัดแรม
    this.moveDelta = new THREE.Vector3();
    this.moveDir = new THREE.Vector3();
    this.kneeOrigin = new THREE.Vector3();
    this.highOrigin = new THREE.Vector3();
    this.topProbeOrigin = new THREE.Vector3();
    this.headOrigin = new THREE.Vector3();
    this.wallNormal = new THREE.Vector3();
    this.slideDelta = new THREE.Vector3();

    this.createStatusHUD();
  }

  createStatusHUD() {
    const existingHud = document.getElementById('player-hud');
    if (existingHud) existingHud.remove();
    const existingVignette = document.getElementById('player-hurt-vignette');
    if (existingVignette) existingVignette.remove();

    const hud = document.createElement('div');
    hud.id = 'player-hud';
    Object.assign(hud.style, {
      position: 'fixed',
      top: '16px',
      left: '16px',
      zIndex: '60',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 16px',
      background: 'rgba(15, 23, 42, 0.85)',
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
      color: '#ffffff',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      minWidth: '220px',
      userSelect: 'none',
      pointerEvents: 'none'
    });

    hud.innerHTML = `
      <div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 3px;">
          <span style="color: #ef4444;">HP</span>
          <span id="hud-hp-text">1000 / 1000</span>
        </div>
        <div style="width: 100%; height: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden;">
          <div id="hud-hp-bar" style="width: 100%; height: 100%; background: #ef4444; border-radius: 6px; transition: width 0.1s linear;"></div>
        </div>
      </div>

      <div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; margin-bottom: 3px;">
          <span style="color: #0ea5e9;">STAMINA</span>
          <span id="hud-stamina-text">1000 / 1000</span>
        </div>
        <div style="width: 100%; height: 12px; background: rgba(255, 255, 255, 0.1); border-radius: 6px; overflow: hidden;">
          <div id="hud-stamina-bar" style="width: 100%; height: 100%; background: #0ea5e9; border-radius: 6px; transition: width 0.05s linear;"></div>
        </div>
      </div>
    `;

    document.body.appendChild(hud);

    this.hudElements = {
      hpText: document.getElementById('hud-hp-text'),
      hpBar: document.getElementById('hud-hp-bar'),
      staminaText: document.getElementById('hud-stamina-text'),
      staminaBar: document.getElementById('hud-stamina-bar')
    };
  }

  updateHUD() {
    if (!this.hudElements) return;

    const hpPercent = Math.max(0, Math.min(100, (this.hp / this.maxHp) * 100));
    const staPercent = Math.max(0, Math.min(100, (this.stamina / this.maxStamina) * 100));

    this.hudElements.hpText.textContent = `${Math.round(this.hp)} / ${this.maxHp}`;
    this.hudElements.hpBar.style.width = `${hpPercent}%`;

    this.hudElements.staminaText.textContent = `${Math.round(this.stamina)} / ${this.maxStamina}`;
    this.hudElements.staminaBar.style.width = `${staPercent}%`;
  }

  snapToCenter(islandMesh) {
    if (!this.characterGroup || !islandMesh) return;
    this.velocity.set(0, 0, 0);

    // จุดเกิดบน "เกาะข้างซ้าย" (เกาะแรก)
    const spawnX = -40;
    const spawnZ = -25;
    this.characterGroup.position.set(spawnX, 50, spawnZ);
    this.facingAngle = Math.PI * 0.35;
    this.characterGroup.rotation.y = this.facingAngle;

    const rayOrigin = new THREE.Vector3(spawnX, 60, spawnZ);
    this.raycaster.set(rayOrigin, this.downVector);
    this.raycaster.far = 120.0;
    const intersects = this.raycaster.intersectObject(islandMesh, true);
    if (intersects.length > 0) {
      this.characterGroup.position.y = intersects[0].point.y + 0.05;
      this.isGrounded = true;
    } else {
      this.characterGroup.position.set(spawnX, 10.25, spawnZ);
      this.isGrounded = true;
    }
    this.position.copy(this.characterGroup.position);
  }

  getRightHandBone() {
    if (this.boneHandR) return this.boneHandR;
    if (this.characterGroup) {
      let found = null;
      this.characterGroup.traverse((child) => {
        if (!found && child.isBone) {
          const cName = child.name ? child.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          if (cName === 'handr' || child.name === 'hand.R') {
            found = child;
          }
        }
      });
      if (found) this.boneHandR = found;
      return found;
    }
    return null;
  }

  load(url, onLoaded, isFallback = false) {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        this.mesh = gltf.scene;

        this.characterGroup = new THREE.Group();
        this.characterGroup.add(this.mesh);

        this.boneHips = null;
        this.boneSpine = null;
        this.boneChest = null;
        this.boneNeck = null;
        this.boneHead = null;
        this.boneUpperArmR = null;
        this.boneLowerArmR = null;
        this.boneUpperArmL = null;
        this.boneLowerArmL = null;
        this.boneUpperLegL = null;
        this.boneLowerLegL = null;
        this.boneUpperLegR = null;
        this.boneLowerLegR = null;
        this.boneHandR = null;

        this.characterGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
          const clean = child.name ? child.name.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
          if (clean === 'hips') this.boneHips = child;
          if (clean === 'spine') this.boneSpine = child;
          if (clean === 'chest') this.boneChest = child;
          if (clean === 'neck') this.boneNeck = child;
          if (clean === 'head') this.boneHead = child;
          if (clean === 'upperarmr') this.boneUpperArmR = child;
          if (clean === 'lowerarmr') this.boneLowerArmR = child;
          if (clean === 'upperarml') this.boneUpperArmL = child;
          if (clean === 'lowerarml') this.boneLowerArmL = child;
          if (clean === 'upperlegl') this.boneUpperLegL = child;
          if (clean === 'lowerlegl') this.boneLowerLegL = child;
          if (clean === 'upperlegr') this.boneUpperLegR = child;
          if (clean === 'lowerlegr') this.boneLowerLegR = child;
          if (clean === 'handr') this.boneHandR = child;
        });

        this.characterGroup.position.set(0, 5, 0);
        this.scene.add(this.characterGroup);

        // คำนวณความสูงตัวละครที่แท้จริงด้วย Box3 / Vector3
        const bbox = new THREE.Box3().setFromObject(this.characterGroup);
        const bboxSize = new THREE.Vector3();
        bbox.getSize(bboxSize);
        if (bboxSize.y > 0.5) {
          this.characterHeight = bboxSize.y;
        }
        this.stepHeight = this.characterHeight * this.stepHeightRatio;

        this.mixer = new THREE.AnimationMixer(this.mesh);

        gltf.animations.forEach((clip) => {
          const action = this.mixer.clipAction(clip);
          this.actions[clip.name] = action;
        });

        if (this.actions['idle']) {
          this.activeAction = this.actions['idle'];
          this.activeAction.play();
        }

        if (onLoaded) onLoaded(this);
      },
      undefined,
      (error) => {
        if (!isFallback) {
          this.load('/playermodel.glb', onLoaded, true);
        } else {
          console.error('Error loading playermodel.glb:', error);
        }
      }
    );
  }

  fadeToAction(name, duration = 0.15) {
    const nextAction = this.actions[name];
    if (!nextAction || this.activeAction === nextAction) return;

    if (this.activeAction) {
      this.activeAction.fadeOut(duration);
    }

    nextAction
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .fadeIn(duration)
      .play();

    this.activeAction = nextAction;
  }

  performDash(input) {
    if (this.isDashing || this.dashCooldownTimer > 0) return;
    if (this.stamina < 5) return;

    this.stamina -= 5;
    this.isDashing = true;
    this.dashTimer = this.dashDuration;

    if (input.isMoving) {
      this.dashDirection.set(input.x, 0, input.z).normalize();
      this.facingAngle = Math.atan2(input.x, input.z);
    } else {
      this.dashDirection.set(Math.sin(this.facingAngle), 0, Math.cos(this.facingAngle)).normalize();
    }
  }


  update(delta, input, islandMesh) {
    if (!this.characterGroup || !this.mesh) return;

    if (this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * delta);
    }

    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer -= delta;
    }

    if (input.dashJustPressed) {
      this.performDash(input);
    }

    if (this.isDashing) {
      this.dashTimer -= delta;

      this.velocity.x = this.dashDirection.x * this.dashSpeed;
      this.velocity.z = this.dashDirection.z * this.dashSpeed;

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashCooldownTimer = this.dashCooldown;
      }
    } else {
      if (input.isMoving) {
        this.velocity.x = input.x * this.moveSpeed;
        this.velocity.z = input.z * this.moveSpeed;
        this.facingAngle = Math.atan2(input.x, input.z);

        if (this.isGrounded && this.activeAction !== this.actions['walk']) {
          this.fadeToAction('walk', 0.12);
        }
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;

        if (this.isGrounded && this.activeAction !== this.actions['idle']) {
          this.fadeToAction('idle', 0.18);
        }
      }
    }

    let diff = this.facingAngle - this.characterGroup.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    this.characterGroup.rotation.y += diff * Math.min(1.0, 18.0 * delta);

    const oldX = this.characterGroup.position.x;
    const oldZ = this.characterGroup.position.z;
    const oldY = this.characterGroup.position.y;

    // 1. คำนวณการเคลื่อนที่แนวนอน (Horizontal displacement)
    this.moveDelta.set(this.velocity.x * delta, 0, this.velocity.z * delta);
    const moveDist = this.moveDelta.length();

    if (islandMesh && moveDist > 0.0001) {
      this.moveDir.copy(this.moveDelta).normalize();
      const checkDist = moveDist + this.characterRadius;

      // 1.1 ตรวจจับสิ่งกีดขวางด้านหน้าในแนวเดินจริง (ระดับหัวเข่า)
      // ของที่แขวนอยู่เหนือหัวจะไม่โดนลำแสงนี้เด็ดขาด => ป้องกันบัคเด้งเพราะของบนหัว
      const kneeHeight = Math.min(0.35, this.stepHeight * 0.45);
      this.kneeOrigin.set(oldX, oldY + kneeHeight, oldZ);
      this.raycaster.set(this.kneeOrigin, this.moveDir);
      this.raycaster.far = checkDist;
      const frontHits = this.raycaster.intersectObject(islandMesh, true);

      let steppedUp = false;

      if (frontHits.length > 0) {
        const hit = frontHits[0];
        const hitDist = hit.distance;

        // 1.2 ตรวจสอบความสูงของสิ่งกีดขวาง: ต้อง "ไม่สูงเกิน 40% ของตัวละคร" (stepHeight)
        // ยิงลำแสงแนวนอนที่ความสูง stepHeight + 0.05
        this.highOrigin.set(oldX, oldY + this.stepHeight + 0.05, oldZ);
        this.raycaster.set(this.highOrigin, this.moveDir);
        this.raycaster.far = hitDist + 0.35;
        const highHits = this.raycaster.intersectObject(islandMesh, true);

        // หากลำแสงระดับสูงไม่ชน แสดงว่าบล็อกด้านหน้าสูงไม่เกิน 40% -> ดำเนินการเด้งข้ามบล็อก
        if (highHits.length === 0) {
          // หาผิวด้านบนของบล็อกโดยยิงลำแสงดิ่งลง
          this.topProbeOrigin.set(
            hit.point.x + this.moveDir.x * 0.20,
            oldY + this.stepHeight + 0.25,
            hit.point.z + this.moveDir.z * 0.20
          );
          this.raycaster.set(this.topProbeOrigin, this.downVector);
          this.raycaster.far = this.stepHeight + 0.5;
          const topHits = this.raycaster.intersectObject(islandMesh, true);

          if (topHits.length > 0) {
            const topY = topHits[0].point.y;
            const rise = topY - oldY;

            // สิ่งกีดขวางต้องสูงกว่าพื้นเดิม และต้องไม่เกิน 40%
            if (rise > 0.02 && rise <= this.stepHeight) {
              // ตรวจ Headroom: ตรวจสอบว่าไม่มีสิ่งกีดขวางเหนือศีรษะ
              this.headOrigin.set(this.topProbeOrigin.x, topY + 0.05, this.topProbeOrigin.z);
              this.raycaster.set(this.headOrigin, this.upVector);
              this.raycaster.far = this.characterHeight * 0.9;
              const headHits = this.raycaster.intersectObject(islandMesh, true);

              if (headHits.length === 0) {
                // เด้งข้ามบล็อกขึ้นไปยืนทันทีตามคำสั่ง!
                this.characterGroup.position.x = oldX + this.moveDelta.x;
                this.characterGroup.position.z = oldZ + this.moveDelta.z;
                this.characterGroup.position.y = topY;
                this.velocity.y = 0;
                this.isGrounded = true;
                steppedUp = true;
              }
            }
          }
        }

        // หากไม่สามารถเด้งข้ามได้ (เช่น สูงเกิน 40% หรือเป็นกำแพงสูง)
        // -> ห้ามเดินทะลุเด็ดขาด! ให้เป็นสิ่งกีดขวางข้างหน้าเรา และเลื่อนไถลขนานไปกับกำแพง
        if (!steppedUp) {
          if (hit.face && hit.object) {
            this.wallNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
            this.wallNormal.y = 0;
            this.wallNormal.normalize();

            const intoWall = this.moveDelta.dot(this.wallNormal);
            if (intoWall < 0) {
              this.slideDelta.copy(this.moveDelta).sub(
                this.wallNormal.clone().multiplyScalar(intoWall)
              );
              this.characterGroup.position.x = oldX + this.slideDelta.x;
              this.characterGroup.position.z = oldZ + this.slideDelta.z;
            } else {
              this.characterGroup.position.x = oldX;
              this.characterGroup.position.z = oldZ;
            }

            // ล็อคระยะห่างไม่ให้เดินทะลุหรือจมเข้าไปในกำแพงเด็ดขาด
            if (hitDist < this.characterRadius) {
              const pushDist = this.characterRadius - hitDist;
              this.characterGroup.position.addScaledVector(this.wallNormal, pushDist);
            }
          } else {
            this.characterGroup.position.x = oldX;
            this.characterGroup.position.z = oldZ;
          }
        }
      } else {
        // ไม่มีสิ่งกีดขวางตรงหน้า เคลื่อนที่ตามปกติ
        this.characterGroup.position.x = oldX + this.moveDelta.x;
        this.characterGroup.position.z = oldZ + this.moveDelta.z;
      }
    } else {
      this.characterGroup.position.x = oldX + this.moveDelta.x;
      this.characterGroup.position.z = oldZ + this.moveDelta.z;
    }

    // 2. จัดการแรงโน้มถ่วงและการยืนบนพื้น (Ground check & Gravity)
    this.velocity.y += this.gravity * delta;
    this.characterGroup.position.y += this.velocity.y * delta;

    if (islandMesh) {
      // ยิงลำแสงจากความสูงที่ครอบคลุมเนินเขาและภูมิประเทศของเกาะ
      const castOriginY = Math.max(oldY, this.characterGroup.position.y) + 3.5;
      this.rayOrigin.set(
        this.characterGroup.position.x,
        castOriginY,
        this.characterGroup.position.z
      );
      this.raycaster.set(this.rayOrigin, this.downVector);
      this.raycaster.far = 50.0;

      const groundHits = this.raycaster.intersectObject(islandMesh, true);

      // กรองเฉพาะจุดตกกระทบที่ไม่สูงเกินระดับศีรษะ (ไม่เอาของที่ลอยอยู่เหนือหัว เพื่อป้องกันบัคของบนหัว)
      const validGround = groundHits.find(
        (h) => h.point.y <= oldY + this.stepHeight + 0.35
      );

      if (validGround) {
        const groundY = validGround.point.y;

        // ล็อคให้ยืนบนพื้นเกาะเสมอ ไม่จมหรือทะลุลงไปใต้เกาะเด็ดขาด
        if (this.characterGroup.position.y <= groundY + 0.1) {
          this.characterGroup.position.y = groundY;
          if (this.velocity.y < 0) {
            this.velocity.y = 0;
          }

          if (!this.isGrounded) {
            this.isGrounded = true;
            this.fadeToAction(input.isMoving ? 'walk' : 'idle', 0.1);
          }
        } else {
          this.isGrounded = false;
        }
      } else {
        this.isGrounded = false;
        // ตกออกจากเกาะลงน้ำ รีเซ็ตตำแหน่งกลับสู่เกาะข้างซ้าย (เกาะแรก) ทันที
        if (this.characterGroup.position.y < -25) {
          this.snapToCenter(islandMesh);
        }
      }
    }

this.position.copy(this.characterGroup.position);

    if (this.mixer) {
      this.mixer.update(delta);
    }

    // คำนวณน้ำหนักการแสดงผลท่าทางแดช (Dash Pose Weight) ให้เข้าและออกอย่างนุ่มนวล
    this.dashPoseWeight = THREE.MathUtils.lerp(
      this.dashPoseWeight || 0,
      this.isDashing ? 1.0 : 0.0,
      Math.min(1.0, (this.isDashing ? 32.0 : 16.0) * delta)
    );

    if (this.dashPoseWeight > 0.001) {
      const w = this.dashPoseWeight;

      // ปรับสะโพกให้ย่อตัวลงแบบนักวิ่งลมกรด เพิ่มความปราดเปรียว
      if (this.boneHips) {
        this.boneHips.position.y = 0.90 - 0.07 * w;
      }

      // 1. ลำตัวและอกเอนไปข้างหน้าแบบพริ้วไหว
      if (this.boneSpine) {
        this.boneSpine.quaternion.slerp(Q_SPINE_DASH, w);
      }
      if (this.boneChest) {
        this.boneChest.quaternion.slerp(Q_CHEST_DASH, w);
      }
      // หัวมองมุ่งมั่นไปข้างหน้าตามทิศทางพุ่งทะยาน (ไม่แข็งทื่อติดกับอก)
      if (this.boneHead) {
        this.boneHead.quaternion.slerp(Q_HEAD_DASH, w);
      }

      // 2. แขนสองข้างเอียงไปข้างหลังลง 55° นับอิงจากลำตัว พร้อมข้อศอกพริ้วเป็นธรรมชาติ
      if (this.boneUpperArmL) {
        this.boneUpperArmL.quaternion.slerp(Q_UPPER_ARM_L_DASH, w);
      }
      if (this.boneLowerArmL) {
        this.boneLowerArmL.quaternion.slerp(Q_LOWER_ARM_DASH, w);
      }
      if (this.boneUpperArmR) {
        this.boneUpperArmR.quaternion.slerp(Q_UPPER_ARM_R_DASH, w);
      }
      if (this.boneLowerArmR) {
        this.boneLowerArmR.quaternion.slerp(Q_LOWER_ARM_DASH, w);
      }

      // 3. ขาข้างซ้ายเอียงไปข้างหน้าเล็กน้อย พร้อมข้อเข่างอรับจังหวะก้าวทะยาน
      if (this.boneUpperLegL) {
        this.boneUpperLegL.quaternion.slerp(Q_UPPER_LEG_L_DASH, w);
      }
      if (this.boneLowerLegL) {
        this.boneLowerLegL.quaternion.slerp(Q_LOWER_LEG_L_DASH, w);
      }

      // 4. ขาข้างขวาเอียงไปข้างหลังมากกว่าข้างซ้าย พร้อมข้อเข่าเหยียดส่งแรงไปด้านหลัง
      if (this.boneUpperLegR) {
        this.boneUpperLegR.quaternion.slerp(Q_UPPER_LEG_R_DASH, w);
      }
      if (this.boneLowerLegR) {
        this.boneLowerLegR.quaternion.slerp(Q_LOWER_LEG_R_DASH, w);
      }
    } else if (this.boneHips && this.boneHips.position.y !== 0.90) {
      this.boneHips.position.y = 0.90;
    }

    this.updateHUD();
  }
}
