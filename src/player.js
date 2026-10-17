// src/player.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

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
    this.jumpForce = 13.0;
    this.gravity = -34.0;

    this.maxAirJumps = 10;
    this.airJumpsLeft = 10;

    this.isDashing = false;
    this.dashSpeed = 28.0;
    this.dashDuration = 0.16;
    this.dashTimer = 0;
    this.dashCooldown = 0.25;
    this.dashCooldownTimer = 0;
    this.dashDirection = new THREE.Vector3(0, 0, -1);
    this.bodyLeanAngle = 0;


    this.raycaster = new THREE.Raycaster();
    this.downVector = new THREE.Vector3(0, -1, 0);

    this.createStatusHUD();
  }

  createStatusHUD() {
    const hud = document.createElement('div');
    hud.id = 'player-hud';
    Object.assign(hud.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      zIndex: '60',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 16px',
      background: 'rgba(15, 23, 42, 0.85)',
      borderRadius: '12px',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.5)',
      color: '#ffffff',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      minWidth: '220px',
      userSelect: 'none',
      pointerEvents: 'none'
    });

    const hpWrapper = document.createElement('div');
    hpWrapper.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:3px;">
        <span style="color:#ef4444;">HP</span>
        <span id="hud-hp-text">100 / 100</span>
      </div>
      <div style="width:100%; height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;">
        <div id="hud-hp-bar" style="width:100%; height:100%; background:linear-gradient(90deg, #dc2626, #ef4444); border-radius:6px; transition:width 0.1s linear;"></div>
      </div>
    `;

    const staminaWrapper = document.createElement('div');
    staminaWrapper.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:700; margin-bottom:3px;">
        <span style="color:#0ea5e9;">STAMINA</span>
        <span id="hud-stamina-text">100 / 100</span>
      </div>
      <div style="width:100%; height:12px; background:rgba(255,255,255,0.1); border-radius:6px; overflow:hidden;">
        <div id="hud-stamina-bar" style="width:100%; height:100%; background:linear-gradient(90deg, #0284c7, #38bdf8); border-radius:6px; transition:width 0.05s linear;"></div>
      </div>
    `;

    const airJumpIndicator = document.createElement('div');
    airJumpIndicator.id = 'hud-airjump-info';
    airJumpIndicator.style.fontSize = '11px';
    airJumpIndicator.style.color = '#cbd5e1';
    airJumpIndicator.style.marginTop = '2px';
    airJumpIndicator.innerHTML = 'กระโดดอากาศ: <b style="color:#38bdf8;">3/10</b> • แดช: <b>พร้อม</b>';

    hud.appendChild(hpWrapper);
    hud.appendChild(staminaWrapper);
    hud.appendChild(airJumpIndicator);
    document.body.appendChild(hud);

    this.hudElements = {
      hpText: document.getElementById('hud-hp-text'),
      hpBar: document.getElementById('hud-hp-bar'),
      staminaText: document.getElementById('hud-stamina-text'),
      staminaBar: document.getElementById('hud-stamina-bar'),
      airJumpInfo: document.getElementById('hud-airjump-info')
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

    const dashStatus = this.dashCooldownTimer <= 0 && !this.isDashing
      ? '<b style="color:#22c55e;">พร้อม (-5)</b>'
      : `<b style="color:#f59e0b;">${this.dashCooldownTimer.toFixed(2)}s</b>`;

    this.hudElements.airJumpInfo.innerHTML = `กระโดดอากาศ: <b style="color:#38bdf8;">${this.airJumpsLeft}/10</b> (-20) • แดช: ${dashStatus}`;
  }

  snapToCenter(islandMesh) {
    if (!this.characterGroup || !islandMesh) return;
    this.characterGroup.position.set(0, 50, 0);
    this.velocity.set(0, 0, 0);
    const rayOrigin = new THREE.Vector3(0, 100, 0);
    this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
    const intersects = this.raycaster.intersectObject(islandMesh, true);
    if (intersects.length > 0) {
      this.characterGroup.position.y = intersects[0].point.y + 0.05;
    } else {
      this.characterGroup.position.set(0, 5, 0);
    }
    this.position.copy(this.characterGroup.position);
  }

  load(url, onLoaded, isFallback = false) {
    const loader = new GLTFLoader();

    loader.load(
      url,
      (gltf) => {
        this.mesh = gltf.scene;

        this.characterGroup = new THREE.Group();
        this.characterGroup.add(this.mesh);

        this.boneUpperArmR = null;
        this.boneUpperArmL = null;
        this.boneUpperLegR = null;
        this.boneUpperLegL = null;

        this.characterGroup.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = false;
            child.receiveShadow = false;
          }
          if (child.name === 'upperArm.R') this.boneUpperArmR = child;
          if (child.name === 'upperArm.L') this.boneUpperArmL = child;
          if (child.name === 'upperLeg.R') this.boneUpperLegR = child;
          if (child.name === 'upperLeg.L') this.boneUpperLegL = child;
        });

        this.characterGroup.position.set(0, 5, 0);
        this.scene.add(this.characterGroup);

        this.mixer = new THREE.AnimationMixer(this.mesh);

        gltf.animations.forEach((clip) => {
          const action = this.mixer.clipAction(clip);
          if (clip.name === 'jump') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
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

  performJump(isGroundJump) {
    if (isGroundJump) {
      if (this.stamina < 10) return false;
      this.stamina -= 10;
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
      if (this.actions['jump']) {
        this.fadeToAction('jump', 0.08);
      }
      return true;
    } else {
      if (this.airJumpsLeft <= 0 || this.stamina < 20) return false;
      this.stamina -= 20;
      this.airJumpsLeft--;
      this.velocity.y = this.jumpForce * 0.95;
      if (this.actions['jump']) {
        this.actions['jump'].reset().play();
      }
      return true;
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

      this.bodyLeanAngle = THREE.MathUtils.lerp(this.bodyLeanAngle, 0.45, 20 * delta);

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.dashCooldownTimer = this.dashCooldown;
      }
    } else {
      this.bodyLeanAngle = THREE.MathUtils.lerp(this.bodyLeanAngle, 0, 16 * delta);

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


    if (!this.isGrounded && input.jumpJustPressed) {
      this.performJump(false);
    } else if (this.isGrounded && (input.jumpHeld || input.jumpJustPressed)) {
      this.performJump(true);
    }

    this.velocity.y += this.gravity * delta;

    this.characterGroup.position.x += this.velocity.x * delta;
    this.characterGroup.position.z += this.velocity.z * delta;
    this.characterGroup.position.y += this.velocity.y * delta;

    if (islandMesh) {
      const rayOrigin = new THREE.Vector3(
        this.characterGroup.position.x,
        this.characterGroup.position.y + 2.5,
        this.characterGroup.position.z
      );
      this.raycaster.set(rayOrigin, this.downVector);

      const intersects = this.raycaster.intersectObject(islandMesh, true);

      if (intersects.length > 0) {
        const groundHeight = intersects[0].point.y;

        if (this.characterGroup.position.y <= groundHeight) {
          this.characterGroup.position.y = groundHeight;
          if (this.velocity.y < 0) {
            this.velocity.y = 0;
          }

          if (!this.isGrounded) {
            this.isGrounded = true;
            this.airJumpsLeft = this.maxAirJumps;

            if (input.jumpHeld || input.jumpJustPressed) {
              this.performJump(true);
            } else {
              this.fadeToAction(input.isMoving ? 'walk' : 'idle', 0.1);
            }
          }
        } else {
          this.isGrounded = false;
        }
      } else {
        if (this.characterGroup.position.y < -25) {
          this.characterGroup.position.set(0, 10, 0);
          this.velocity.set(0, 0, 0);
          this.hp = Math.max(10, this.hp - 15);
        }
      }
    }

this.position.copy(this.characterGroup.position);

  if (this.mixer) {
      if (this.activeAction) {
          this.activeAction.setEffectiveWeight(this.isDashing ? 0 : 1);
            }
              this.mixer.update(delta);
              }

              const targetArmRotX      = this.isDashing ? -Math.PI * 0.25 : 0;
              const targetRightLegRotX = this.isDashing ? (55 * Math.PI / 180) : 0;
              const targetLeftLegRotX  = this.isDashing ? -Math.PI * 0.25 : 0;

              const boneLerpSpeed = Math.min(1, 18 * delta);
              if (this.boneUpperArmR) this.boneUpperArmR.rotation.x = THREE.MathUtils.lerp(this.boneUpperArmR.rotation.x, targetArmRotX,      boneLerpSpeed);
              if (this.boneUpperArmL) this.boneUpperArmL.rotation.x = THREE.MathUtils.lerp(this.boneUpperArmL.rotation.x, targetArmRotX,      boneLerpSpeed);
              if (this.boneUpperLegR) this.boneUpperLegR.rotation.x = THREE.MathUtils.lerp(this.boneUpperLegR.rotation.x, targetRightLegRotX, boneLerpSpeed);
              if (this.boneUpperLegL) this.boneUpperLegL.rotation.x = THREE.MathUtils.lerp(this.boneUpperLegL.rotation.x, targetLeftLegRotX,  boneLerpSpeed);
  }
  
}
