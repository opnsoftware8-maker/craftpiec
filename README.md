# CraftPiece - First Island

โปรเจกต์ 3D Island สำหรับเกม **CraftPiece** โดยใช้ Three.js แบบ Pure JavaScript ES Modules

## ฟีเจอร์หลัก (Features)

1. **ระบบอาวุธและดาบเริ่มต้น Blackblade (`src/combat/sword.js`)**:
   - จัดเก็บโมเดลดาบไว้ในโฟลเดอร์ระเบียบ `Models/sword/blackblade.glb`
   - มีระบบ `SwordManager` จัดเก็บข้อมูลสถานะดาบ: ชื่อ, ประเภท (Greatsword), ความเสียหาย, สเกล, และตำแหน่งจับ
   - **ติดตั้งดาบลงบนมือขวา (`hand.R`)**: เมื่อเริ่มเกมตัวละครจะถือดาบ Blackblade ในมือขวาโดยอัตโนมัติ และแกว่งตามการเคลื่อนไหวของกระดูกมือ
   - **ช่องเลือกดาบตรงกลางล่างของหน้าจอ (Hotbar Slot 1)**:
     - แสดง `[ 1 ] ⚔️ Blackblade`
     - แสดงสถานะการถือดาบ และสามารถกดปุ่ม **`1`** บนคีย์บอร์ด หรือคลิกที่ช่องเพื่อสลับการถือ/เก็บดาบได้

2. **ระบบการเคลื่อนไหว & ต่อสู้ (Movement & Combat Mechanics)**:
   - **ระบบแดช Blox Fruits**: กด **Q** หรือปุ่ม **แดช** บนมือถือ พุ่งตัวไปข้างหน้าพร้อมเอียงโครงร่าง (-5 Stamina, คูลดาวน์ 0.05 วิ)
   - **หลอด HP และ Stamina**: หลอดสถานะคลีน เรียบง่าย ชัดเจน พร้อมระบบฟื้นฟู Stamina 10 หน่วย/วินาที

3. **มุมกล้อง ARPG และการออฟติไมส์**:
   - กล้องซูมสูงไกล สไตล์เกม ARPG ล็อคติดตามตัวละคร
   - ปิดระบบเงา (Shadow Map) เพื่อความลื่นไหลสูงสุด 60 FPS+
   - เกาะสไตล์ Low-poly (Flat Shading)

## โครงสร้างไฟล์ (File Structure)

```
.
├── index.html              # ไฟล์ HTML หลักพร้อม importmap และ Error Listener
├── Models/
│   ├── stisland.glb        # โมเดลเกาะ 3D (Tinkercad Low-poly)
│   ├── playermodel.glb     # โมเดลตัวละคร 3D พร้อมอนิเมชั่น
│   └── sword/
│       └── blackblade.glb  # โมเดลดาบดำ Blackblade 3D
├── src/
│   ├── main.js             # ควบคุมฉาก แสง กล้อง ARPG และ Game Loop
│   ├── player.js           # จัดการตัวละคร, HP, Stamina, สวมใส่ดาบ Blackblade
│   ├── control.js          # ระบบ Multi-touch จอยสติ๊ก, ปุ่มแดช (Q)
│   ├── combat/
│       └── sword.js        # ข้อมูลสเปกดาบ, ตัวโหลด และระบบติดตั้งดาบเข้ามือตัวละคร
│   └── system/
│       └── camera.js       # ตั้งค่ากล้อง PerspectiveCamera ซูมสูงไกล
└── package.json            # การตั้งค่า Vite
```
