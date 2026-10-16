# CraftPiece - First Island

โปรเจกต์ 3D Island สำหรับเกม **CraftPiece** โดยใช้ Three.js แบบ Pure JavaScript ES Modules (ไม่มี React, ไม่มี Next.js)

## สาเหตุที่หน้าจอขาวบน Vercel และวิธีแก้ (Root Cause Analysis & Fix)

1. **ปัญหา Failed to resolve module specifier "three"**:
   - ในไฟล์ `GLTFLoader.js` ของ Three.js มีการเขียน `import ... from 'three';`
   - เมื่อโหลดผ่านเบราว์เซอร์หรือ Vercel โดยไม่มี Import Map เบราว์เซอร์จะหยุดทำงานทันทีพร้อม Error: `Uncaught TypeError: Failed to resolve module specifier "three"` ส่งผลให้หน้าจอขาวสนิท
   - **การแก้ไข**: เพิ่ม `<script type="importmap">` ใน `index.html` เพื่อจับคู่ `three` และ `three/addons/` ทำให้เบราว์เซอร์ดึง Three.js และ GLTFLoader ได้โดยตรงและสมบูรณ์ 100%

2. **ปัญหา Normals ในไฟล์ stisland.glb**:
   - โมเดล `stisland.glb` ไม่มี Attribute `NORMAL` จากโปรแกรมต้นทาง ทำให้แสงส่องไม่ติดและโมเดลอาจมืดดำ
   - **การแก้ไข**: เพิ่ม `child.geometry.computeVertexNormals()` และเปิด `DoubleSide` ใน `src/main.js` เพื่อให้โมเดลเกาะสะท้อนแสงแดดและแสดงสี Vertex Color (สีเขียวธรรมชาติ) อย่างชัดเจน

3. **ปัญหาตรวจไม่พบ Error บนมือถือ**:
   - เพิ่ม Error Listener ใน `index.html` เพื่อแสดงข้อความ Error สีแดงบนหน้าจอทันทีหากมีปัญหาเกิดขึ้น

## โครงสร้างไฟล์ (File Structure)

```
.
├── index.html              # ไฟล์ HTML หลักพร้อม importmap และ Error Listener
├── Models/
│   └── stisland.glb        # ไฟล์โมเดล 3D เกาะ
├── src/
│   ├── main.js             # โค้ดเรนเดอร์ Three.js และโหลดโมเดลเกาะ
│   └── system/
│       └── camera.js       # ฟังก์ชันสร้าง PerspectiveCamera
└── package.json            # การตั้งค่ารัน Vite
```
