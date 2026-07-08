# Asset Care

ระบบทะเบียนทรัพย์สินสำหรับหน่วยงานวิสัญญี ใช้ React + Vite + Tailwind CSS และรองรับการใช้งานจริงผ่าน Google Apps Script Web App + Google Sheets + Google Drive

## ไฟล์สำคัญ

- `apps-script/Code.gs` โค้ดสำหรับวางใน Google Apps Script
- `src/services/googleAppsScriptService.js` service ฝั่ง React สำหรับเรียก Web App URL
- `.env.example` ตัวอย่าง environment variables
- `docs/google-sheets-setup.md` คู่มือตั้งค่า Google Sheets, Apps Script, Web App และ deploy React

## Environment Variables

สร้างไฟล์ `.env`

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxxx/exec
VITE_PUBLIC_APP_URL=https://your-production-domain.com
```

`VITE_PUBLIC_APP_URL` ใช้สร้าง QR Code สำหรับเปิด `/asset/:id` จากมือถือ จึงต้องเป็น URL จริงที่เข้าถึงได้จากมือถือ

## เริ่มใช้งาน

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## ตั้งค่า Google Sheets

ทำตามขั้นตอนใน `docs/google-sheets-setup.md`

ภาพรวม:

1. สร้าง Google Sheet
2. Copy Spreadsheet ID
3. เปิด `Extensions > Apps Script`
4. วางโค้ดจาก `apps-script/Code.gs`
5. ใส่ `SPREADSHEET_ID`
6. Run `setupSheets()`
7. Run `seedInitialData()`
8. Deploy เป็น Web App
9. Copy Web App URL
10. ใส่ URL ใน `.env`
11. Deploy React ด้วย production URL

## Login เริ่มต้น

- Admin: `admin / k0000000`
- Staff: `0088 / f0000000`
- Staff: `0348 / j0000000`

## การทำงานเมื่อ Apps Script ไม่พร้อม

ถ้าไม่ได้ตั้งค่า `VITE_APPS_SCRIPT_URL` หรือ Apps Script ใช้งานไม่ได้ ระบบจะใช้ localStorage เป็น fallback และแสดงข้อความ “กำลังใช้งานข้อมูลภายในเครื่อง”
