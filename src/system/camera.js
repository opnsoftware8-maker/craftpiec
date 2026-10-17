import * as THREE from 'three';

export function createCamera() {
  return new THREE.PerspectiveCamera(
    45, // FOV 42 มุมมองซูมไกลแบบ ARPG / ไอโซเมตริก ให้มุมมองกว้างและตัวละครคมชัดเหมือนในภาพต้นแบบ
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
}
