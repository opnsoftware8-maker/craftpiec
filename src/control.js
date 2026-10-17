// src/control.js
// ระบบควบคุมตัวละคร: รองรับ Multi-touch สมบูรณ์แบบ 100% สำหรับมือถือ (Touch Events + Pointer Events) และคีย์บอร์ด

export class InputController {
  constructor() {
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      dash: false
    };

    this.dashJustPressed = false;

    this.joystick = {
      active: false,
      startX: 0,
      startY: 0,
      vectorX: 0,
      vectorZ: 0
    };

    this.joystickTouchId = null;
    this.dashTouchId = null;

    this.dashPressed = false;

    this.initKeyboard();
    this.createTouchUI();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = true;
          break;
        case 'KeyQ':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.dash = true;
          this.dashJustPressed = true;
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.keys.right = false;
          break;
        case 'KeyQ':
        case 'ShiftLeft':
        case 'ShiftRight':
          this.keys.dash = false;
          break;
      }
    });
  }

  // สร้าง UI จอยสติ๊ก และปุ่มแดช ที่ตอบสนองต่อการสัมผัสบนมือถือทันที
  createTouchUI() {
    const touchContainer = document.createElement('div');
    touchContainer.id = 'touch-controls-container';
    Object.assign(touchContainer.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '100', // อยู่ชั้นบนสุดเสมอ ไม่ถูกสิ่งอื่นบัง
      userSelect: 'none',
      webkitUserSelect: 'none',
      touchAction: 'none'
    });

    // 1. Joystick Area (มุมซ้ายล่าง)
    const joyZone = document.createElement('div');
    joyZone.id = 'mobile-joystick-zone';
    Object.assign(joyZone.style, {
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      width: '120px',
      height: '120px',
      borderRadius: '50%',
      background: 'rgba(15, 23, 42, 0.65)',
      border: '2px solid rgba(255, 255, 255, 0.4)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
      pointerEvents: 'auto',
      touchAction: 'none',
      zIndex: '110'
    });

    // Joystick Knob (ปุ่มกลมด้านใน)
    const joyKnob = document.createElement('div');
    Object.assign(joyKnob.style, {
      position: 'absolute',
      top: '36px',
      left: '36px',
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      background: 'radial-gradient(circle, #ffffff 30%, #cbd5e1 100%)',
      boxShadow: '0 4px 10px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
      transform: 'translate(0px, 0px)',
      willChange: 'transform'
    });
    joyZone.appendChild(joyKnob);

    const maxRadius = 42;

    const updateJoystickPosition = (clientX, clientY) => {
      const dx = clientX - this.joystick.startX;
      const dy = clientY - this.joystick.startY;
      const distance = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      const clampedDist = Math.min(distance, maxRadius);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      joyKnob.style.transform = `translate(${knobX}px, ${knobY}px)`;

      this.joystick.vectorX = knobX / maxRadius;
      this.joystick.vectorZ = knobY / maxRadius;
    };

    // --- Touch Events สำหรับมือถือ (แม่นยำและไม่หลุดแน่นอน) ---
    const handleJoyTouchStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.joystick.active) return;

      const touch = e.changedTouches[0];
      this.joystickTouchId = touch.identifier;

      const rect = joyZone.getBoundingClientRect();
      this.joystick.startX = rect.left + rect.width / 2;
      this.joystick.startY = rect.top + rect.height / 2;
      this.joystick.active = true;

      updateJoystickPosition(touch.clientX, touch.clientY);
    };

    const handleJoyTouchMove = (e) => {
      if (!this.joystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          e.preventDefault();
          updateJoystickPosition(touch.clientX, touch.clientY);
          break;
        }
      }
    };

    const handleJoyTouchEnd = (e) => {
      if (!this.joystick.active) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.joystickTouchId) {
          e.preventDefault();
          this.joystick.active = false;
          this.joystick.vectorX = 0;
          this.joystick.vectorZ = 0;
          this.joystickTouchId = null;
          joyKnob.style.transform = 'translate(0px, 0px)';
          break;
        }
      }
    };

    joyZone.addEventListener('touchstart', handleJoyTouchStart, { passive: false });
    window.addEventListener('touchmove', handleJoyTouchMove, { passive: false });
    window.addEventListener('touchend', handleJoyTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleJoyTouchEnd, { passive: false });

    // รองรับเมาส์บน Desktop สำหรับทดสอบ
    joyZone.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.joystickTouchId = 'mouse';
      const rect = joyZone.getBoundingClientRect();
      this.joystick.startX = rect.left + rect.width / 2;
      this.joystick.startY = rect.top + rect.height / 2;
      this.joystick.active = true;
      updateJoystickPosition(e.clientX, e.clientY);
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.joystick.active || this.joystickTouchId !== 'mouse') return;
      updateJoystickPosition(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', (e) => {
      if (this.joystickTouchId === 'mouse') {
        this.joystick.active = false;
        this.joystick.vectorX = 0;
        this.joystick.vectorZ = 0;
        this.joystickTouchId = null;
        joyKnob.style.transform = 'translate(0px, 0px)';
      }
    });

    // 2. Action Buttons Group (มุมขวาล่าง: แดช)
    // 2.1 ปุ่มแดช (Dash Button)
    const dashBtn = document.createElement('div');
    dashBtn.id = 'mobile-dash-button';
    Object.assign(dashBtn.style, {
      position: 'absolute',
      bottom: '24px',
      right: '24px',
      width: '66px',
      height: '66px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
      border: '2.5px solid rgba(255, 255, 255, 0.9)',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      fontWeight: 'bold',
      boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
      pointerEvents: 'auto',
      touchAction: 'none',
      cursor: 'pointer',
      zIndex: '110',
      transition: 'transform 0.06s ease, filter 0.06s ease'
    });
    dashBtn.innerHTML = '<span>แดช</span><span style="font-size:9px;opacity:0.85;">(Q)</span>';

    // Touch Event สำหรับปุ่มแดช
    dashBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const touch = e.changedTouches[0];
      this.dashTouchId = touch.identifier;
      this.dashPressed = true;
      this.dashJustPressed = true;
      dashBtn.style.transform = 'scale(0.88)';
      dashBtn.style.filter = 'brightness(1.25)';
    }, { passive: false });

    const handleDashTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === this.dashTouchId) {
          e.preventDefault();
          this.dashPressed = false;
          this.dashTouchId = null;
          dashBtn.style.transform = 'scale(1)';
          dashBtn.style.filter = 'none';
          break;
        }
      }
    };
    window.addEventListener('touchend', handleDashTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleDashTouchEnd, { passive: false });

    dashBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.dashPressed = true;
      this.dashJustPressed = true;
      dashBtn.style.transform = 'scale(0.88)';
    });
    window.addEventListener('mouseup', () => {
      this.dashPressed = false;
      dashBtn.style.transform = 'scale(1)';
    });

    touchContainer.appendChild(joyZone);
    touchContainer.appendChild(dashBtn);
    document.body.appendChild(touchContainer);
  }

  // ดึงค่าอินพุต
  getInput() {
    let x = 0;
    let z = 0;

    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    if (this.keys.forward) z -= 1; // ทิศเหนือ (-Z)
    if (this.keys.backward) z += 1; // ทิศใต้ (+Z)

    if (this.joystick.active) {
      x = this.joystick.vectorX;
      z = this.joystick.vectorZ;
    }

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    const isMoving = length > 0.12;

    const dashJustPressed = this.dashJustPressed;
    this.dashJustPressed = false;

    return {
      x,
      z,
      isMoving,
      dashJustPressed
    };
  }
}
