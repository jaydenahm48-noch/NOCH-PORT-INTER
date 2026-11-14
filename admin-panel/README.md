# NochyOS Admin Panel

Admin panel untuk manage project portofolio NochyOS, menggunakan:
- **Backend**: Node.js + Express, deploy ke Vercel (serverless)
- **Database**: Google Sheets
- **Storage**: Google Drive

---

## Setup Google Cloud

### 1. Buat Project di Google Cloud
1. Buka https://console.cloud.google.com
2. Buat project baru (misal: `nochyos-admin`)
3. Enable dua API:
   - **Google Sheets API**
   - **Google Drive API**

### 2. Buat Service Account
1. IAM & Admin → Service Accounts → Create Service Account
2. Isi nama, klik Create
3. Skip bagian roles, klik Done
4. Klik service account yang baru dibuat → Keys → Add Key → JSON
5. Download file JSON — simpan baik-baik

### 3. Setup Google Sheet
1. Buat Google Spreadsheet baru di https://sheets.google.com
2. Beri nama sheet pertama: `projects`
3. Isi baris pertama (header):
   ```
   id | judul | kategori | deskripsi | url_thumbnail | gambar_detail | link_project | teknologi
   ```
4. Share spreadsheet ke email service account (dari file JSON: `client_email`)
   - Klik Share → paste email → pilih Editor

### 4. Setup Google Drive Folder
1. Buat folder baru di Google Drive untuk menyimpan gambar
2. Klik kanan folder → Share → paste email service account → Editor
3. Copy ID folder dari URL: `https://drive.google.com/drive/folders/FOLDER_ID`

---

## Setup Project

### 1. Install dependencies
```bash
cd admin-panel
npm install
```

### 2. Buat file .env
Copy dari `.env.example` lalu isi:
```bash
cp .env.example .env
```

Isi `.env` dengan data dari file JSON service account:
```env
GOOGLE_CLIENT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
SPREADSHEET_ID=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms
DRIVE_FOLDER_ID=1a2b3c4d5e6f...
ADMIN_PASSWORD=password_admin_kamu
```

> **Penting**: `GOOGLE_PRIVATE_KEY` harus dalam tanda kutip dan `\n` tetap literal

### 3. Jalankan local
```bash
npm run dev
# atau
node api/index.js
```

Buka http://localhost:3000

---

## Deploy ke Vercel

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Login
```bash
vercel login
```

### 3. Deploy
```bash
vercel
```

Ikuti promptnya. Pertama kali akan tanya beberapa pertanyaan:
- Set up and deploy? **Y**
- Which scope? pilih akun kamu
- Link to existing project? **N**
- Project name: `nochyos-admin`
- Directory: `./` (default)
- Override settings? **N**

### 4. Set Environment Variables di Vercel
```bash
vercel env add GOOGLE_CLIENT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
vercel env add SPREADSHEET_ID
vercel env add DRIVE_FOLDER_ID
vercel env add ADMIN_PASSWORD
```

Atau lewat Vercel Dashboard → Project → Settings → Environment Variables

### 5. Deploy ulang setelah set env
```bash
vercel --prod
```

---

## Struktur Folder

```
admin-panel/
├── api/
│   ├── index.js        # Local dev server
│   ├── projects.js     # CRUD projects endpoint
│   ├── upload.js       # Upload ke Google Drive
│   └── lib/
│       └── google.js   # Google Sheets & Drive helper
├── public/
│   └── index.html      # Admin UI
├── .env.example
├── package.json
├── vercel.json
└── README.md
```

---

## API Endpoints

| Method | URL | Keterangan |
|--------|-----|------------|
| GET | `/api/projects` | Ambil semua project |
| GET | `/api/projects?id=xxx` | Ambil 1 project |
| POST | `/api/projects` | Tambah project baru |
| PUT | `/api/projects?id=xxx` | Update project |
| DELETE | `/api/projects?id=xxx` | Hapus project |
| POST | `/api/upload` | Upload gambar ke Drive |

Semua endpoint selain GET butuh header:
```
x-admin-token: YOUR_ADMIN_PASSWORD
```
