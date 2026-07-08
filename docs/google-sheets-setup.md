# Asset Care Google Sheets Setup

คู่มือนี้ใช้สำหรับเปลี่ยน Asset Care ให้ใช้งานจริงผ่าน Google Apps Script Web App เป็นตัวกลางระหว่าง React กับ Google Sheets และ Google Drive

## โครงสร้าง

React App เรียก `fetch` ไปที่ Google Apps Script Web App URL เท่านั้น

Google Apps Script จะอ่าน/เขียนข้อมูลใน Google Sheets และอัปโหลดรูปภาพเข้า Google Drive

React จะไม่อ่านหรือเขียน Google Sheets โดยตรง

## 1. สร้าง Google Sheet

1. เปิด Google Sheets
2. สร้างไฟล์ใหม่สำหรับ Asset Care
3. Copy Spreadsheet ID จาก URL

ตัวอย่าง URL:

```text
https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
```

## 2. เพิ่ม Apps Script

1. ใน Google Sheet ไปที่ `Extensions > Apps Script`
2. เปิดไฟล์ `Code.gs`
3. วางโค้ดจาก `apps-script/Code.gs`
4. แก้ค่าด้านบน:

```js
const SPREADSHEET_ID = "ใส่ Spreadsheet ID ที่นี่";
const DRIVE_FOLDER_ID = "";
```

ถ้าเว้น `DRIVE_FOLDER_ID` ไว้ ระบบจะสร้างโฟลเดอร์ `Asset Care Images` ใน Google Drive อัตโนมัติเมื่อมีการอัปโหลดรูป

## 3. สร้าง Sheet Tabs และ Seed ข้อมูลเริ่มต้น

ใน Apps Script ให้รัน:

1. `setupSheets()`
2. `seedInitialData()`

ระบบจะสร้าง 4 tabs:

- `assets`
- `history_logs`
- `users`
- `settings`

ผู้ใช้เริ่มต้น:

- `admin / k0000000`
- `0088 / f0000000`
- `0348 / j0000000`

## 4. Deploy เป็น Web App

1. กด `Deploy > New deployment`
2. เลือกชนิดเป็น `Web app`
3. ตั้งค่า:
   - Execute as: `Me`
   - Who has access: `Anyone with the link`
4. กด Deploy
5. Copy Web App URL

## 5. ตั้งค่า React

สร้างไฟล์ `.env` จาก `.env.example`

```text
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/xxxxx/exec
VITE_PUBLIC_APP_URL=https://your-production-domain.com
```

`VITE_PUBLIC_APP_URL` ต้องเป็น URL จริงที่มือถือเปิดได้ เพราะ QR Code จะลิงก์ไปที่:

```text
https://your-production-domain.com/asset/:id
```

ห้ามใช้ localhost สำหรับ QR Code ที่จะนำไปติดเครื่องจริง

## 6. ทดสอบระบบ

1. รัน React
2. Login ด้วย `admin / k0000000`
3. เพิ่มทรัพย์สิน 1 รายการ
4. ตรวจสอบว่าแถวใหม่ถูกเพิ่มใน sheet `assets`
5. เปิดรายละเอียดทรัพย์สินและอัปโหลดรูป
6. ตรวจสอบว่า URL รูปถูกบันทึกใน `assets.imageUrl`
7. ตรวจสอบว่า action ถูกบันทึกใน `history_logs`
8. เปิด QR Code แล้วสแกนจากมือถือ

ถ้า Apps Script URL ยังไม่ถูกตั้งค่า หรือ Web App ใช้งานไม่ได้ ระบบจะแสดงข้อความ “กำลังใช้งานข้อมูลภายในเครื่อง” และใช้ localStorage เป็น fallback ชั่วคราว

## 7. Deploy React

Deploy React ไปยัง hosting ที่มือถือเข้าถึงได้ เช่น Vercel, Netlify, Firebase Hosting หรือ Web Server ขององค์กร

หลัง deploy:

1. ตั้งค่า environment variables บน hosting
2. ใส่ `VITE_APPS_SCRIPT_URL`
3. ใส่ `VITE_PUBLIC_APP_URL` เป็น production URL
4. Build และ redeploy
5. สแกน QR จากมือถือเพื่อทดสอบ `/asset/:id`

## หมายเหตุความปลอดภัย

- รหัสผ่านในตัวอย่างเก็บใน Google Sheet เพื่อให้เริ่มใช้งานได้เร็ว ควรเปลี่ยนเป็นระบบ hash/password policy ก่อนใช้งานในองค์กรขนาดใหญ่
- ควรจำกัดสิทธิ์บัญชี Google ที่เป็นเจ้าของ Apps Script และ Spreadsheet
- รูปภาพที่อัปโหลดจะถูกตั้งค่าให้ Anyone with the link เปิดดูได้ เพื่อให้แสดงผลในเว็บและ QR detail ได้
