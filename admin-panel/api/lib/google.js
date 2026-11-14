const { google } = require('googleapis');

// Auth dengan Service Account
function getAuth() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  return auth;
}

function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() });
}

function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() });
}

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Tab asli di spreadsheet "Noch port" 
const SHEET_NAME = 'Projects';
const IMAGES_SHEET = 'Project_Images';

// Urutan kolom asli di tab "Projects"
const COLS = ['id', 'title', 'slug', 'description', 'technologies', 'thumbnail', 'github_url', 'demo_url', 'folder'];

// Tab file/folder untuk OS NochyOS (item yang muncul di desktop / folder)
const FILES_SHEET = 'Files';
const FILES_COLS = ['id','kind','title','folder','page','desc','skills','link','image','app','sort_order'];
const FILES_LAST_COL = String.fromCharCode(64 + FILES_COLS.length); // 'K'
const FILES_RANGE = `A2:${FILES_LAST_COL}`;

// ── NORMALISASI URL GAMBAR ────────────────────────────────
// Bentuk asli di sheet ada dua macam, dan keduanya TIDAK bisa langsung
// dipakai di <img>:
//   drive.google.com/file/d/ID/view  → text/html
//   lh3.googleusercontent.com/d/ID/view → 400
// Yang bisa: https://lh3.googleusercontent.com/d/ID
function img(url) {
  if (!url) return '';
  const s = String(url).trim();
  let m = s.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  m = s.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  m = s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  if (m) return 'https://lh3.googleusercontent.com/d/' + m[1];
  return s;
}

function driveThumb(url) {
  if (!url) return '';
  const s = String(url).trim();
  const m = s.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/) || s.match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/) || s.match(/[?&]id=([A-Za-z0-9_-]+)/);
  return m ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600' : '';
}

function splitComma(str) {
  if (!str) return [];
  if (Array.isArray(str)) return str.map(s => String(s).trim()).filter(Boolean);
  return String(str).split(',').map(s => s.trim()).filter(Boolean);
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-');
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ── KONVERSI SHEET → BENTUK API ───────────────────────────
// Bentuk API lama dipakai oleh admin UI (f_judul, f_deskripsi, …)
// DAN oleh web utama (project.judul, project.url_thumbnail, …)
function rowToApi(row, images) {
  const s = {};
  COLS.forEach((c, i) => { s[c] = (row && row[i]) || ''; });
  return {
    id: s.id,
    judul: s.title,
    kategori: '',                       // sheet "Noch port" tidak punya kolom kategori
    deskripsi: s.description,
    url_thumbnail: img(s.thumbnail),
    gambar_detail: (images && images[s.id]) || [],
    link_project: s.demo_url || s.github_url || '',
    github_url: s.github_url || '',
    demo_url: s.demo_url || '',
    teknologi: splitComma(s.technologies),
    folder: s.folder || '',
  };
}

// ── KONVERSI BENTUK API → SHEET ───────────────────────────
// github_url: form admin sekarang punya field-nya — pakai nilai dari form
// kalau ada. Kalau tidak dikirim, merged berisi nilai baris lama (rowToApi),
// jadi tetap aman tidak tertimpa jadi kosong.
function apiToRow(api, existingRaw) {
  const e = existingRaw || [];
  return [
    api.id || '',
    api.judul || '',
    e[COLS.indexOf('slug')] || slugify(api.judul || ''),
    api.deskripsi || '',
    Array.isArray(api.teknologi) ? api.teknologi.join(', ') : (api.teknologi || ''),
    api.url_thumbnail || '',
    api.github_url || '',
    api.link_project || '',
    api.folder || '',
  ];
}

// ── KONVERSI FILE (tab Files) → BENTUK API ─────────────────
// Item ini dipakai untuk render di OS NochyOS (desktop / folder).
function rowToFile(row) {
  const s = {};
  FILES_COLS.forEach((c, i) => { s[c] = (row && row[i]) || ''; });
  return {
    id: s.id,
    kind: s.kind || 'project',
    title: s.title || '',
    folder: s.folder || '',
    page: parseInt(s.page) || 1,
    desc: s.desc || '',
    skills: Array.isArray(s.skills) ? s.skills : splitComma(s.skills),
    link: s.link || '',
    image: img(s.image || ''),
    app: s.app || '',
  };
}

// ── KONVERSI BENTUK API → FILE (tab Files) ──────────────────
function fileToRow(file, existingRaw) {
  const e = existingRaw || [];
  return [
    file.id || '',
    file.kind || 'project',
    file.title || '',
    file.folder || '',
    String(file.page || 1),
    file.desc || '',
    Array.isArray(file.skills) ? file.skills.join(', ') : (file.skills || ''),
    file.link || '',
    file.image || '',
    file.app || '',
    String(file.sort_order || (e.length + 1)),
  ];
}

// ── GAMBAR (tab Project_Images) ───────────────────────────
async function readImages() {
  try {
    const sheets = getSheets();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${IMAGES_SHEET}!A2:F`,
    });
    const map = {};
    for (const row of (res.data.values || [])) {
      if (!row || !row[1] || !row[2]) continue;
      (map[row[1]] = map[row[1]] || []).push(img(row[2]));
    }
    return map;
  } catch (e) {
    return {};
  }
}

// Menulis ulang gambar milik SATU project.
// Aturan pengaman: input kosong TIDAK pernah menghapus data yang ada —
// kalau form admin gagal terisi, gallery asli tetap utuh.
async function replaceImages(projectId, urls) {
  const list = splitComma(urls);
  if (!list.length) return false;

  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${IMAGES_SHEET}!A2:F`,
  });
  const oldRows = (res.data.values || []).filter(r => r && r[1]);
  const kept = oldRows.filter(r => r[1] !== projectId);
  const stamp = Date.now();
  const added = list.map((u, i) => [
    `${projectId}-${i}-${stamp}`,
    projectId,
    u,
    '',
    String(i + 1),
    new Date().toISOString(),
  ]);
  const rows = kept.concat(added);

  // Tulis dulu (bukan clear-dulu) supaya kegagalan di tengah tidak
  // menghapus data gallery yang lama.
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${IMAGES_SHEET}!A2`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // Baris lama yang tersisa setelah jumlah berkurang dibersihkan
  if (oldRows.length > rows.length) {
    const start = 2 + rows.length;
    const end = 1 + oldRows.length;
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${IMAGES_SHEET}!A${start}:F${end}`,
    });
  }
  return true;
}

// ── SHEET OPERATIONS ──────────────────────────────────────
async function getAllProjects() {
  const sheets = getSheets();
  const [res, images] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:${String.fromCharCode(64 + COLS.length)}`,
    }),
    readImages(),
  ]);

  const rows = res.data.values || [];
  return rows
    .filter(row => row && row[0]) // skip empty rows
    .map(row => rowToApi(row, images));
}

async function getProjectById(id) {
  const all = await getAllProjects();
  return all.find(p => p.id === id) || null;
}

async function addProject(project) {
  if (!project.id) {
    project.id = slugify(project.judul);
  }

  const existing = await getAllProjects();
  if (existing.find(p => p.id === project.id)) {
    throw new Error(`ID sudah ada: ${project.id}`);
  }

  const sheets = getSheets();
  const row = apiToRow(project, null);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:${String.fromCharCode(64 + COLS.length)}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  await replaceImages(project.id, project.gambar_detail);

  return project.id;
}

async function updateProject(id, updates) {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:${String.fromCharCode(64 + COLS.length)}`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);

  if (rowIndex === -1) throw new Error(`Project tidak ditemukan: ${id}`);

  const rawExisting = rows[rowIndex];
  const images = await readImages();
  const existing = rowToApi(rawExisting, images);
  const merged = { ...existing, ...updates, id };
  const newRow = apiToRow(merged, rawExisting);

  const sheetRow = rowIndex + 1; // 1-indexed
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${sheetRow}:${String.fromCharCode(64 + COLS.length)}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [newRow] },
  });

  // Hanya sentuh tab gambar kalau memang ada isinya
  if (updates && Object.prototype.hasOwnProperty.call(updates, 'gambar_detail')) {
    await replaceImages(id, updates.gambar_detail);
  }

  return id;
}

async function deleteProject(id) {
  const sheets = getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:${String.fromCharCode(64 + COLS.length)}`,
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Project tidak ditemukan: ${id}`);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title === SHEET_NAME);
  if (!sheet) throw new Error('Sheet tidak ditemukan');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });

  return id;
}

// ── FILE SYSTEM (tab Files) ───────────────────────────────
// Gabungan: baris di tab "Files" + project yang sudah ada di tab "Projects".
// Ini biar admin bisa nambah file/folder lewat tab Files, dan project bawaan
// dari tab Projects tetap muncul di OS NochyOS.
async function getAllFiles() {
  const sheets = getSheets();
  const [filesRes, projectsRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: FILES_RANGE,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A2:${String.fromCharCode(64 + COLS.length)}`,
    }),
  ]);

  const fileRows = (filesRes.data.values || []).filter(row => row && row[0]).map(row => rowToFile(row));
  const images = await readImages();
  const projectRows = (projectsRes.data.values || []).filter(row => row && row[0]).map(row => rowToApi(row, images));
  const mappedProjects = projectRows.map(p => ({
    id: p.id,
    kind: 'project',
    title: p.judul,
    folder: p.folder || 'Work',
    page: 1,
    desc: p.deskripsi,
    skills: Array.isArray(p.teknologi) ? p.teknologi : splitComma(p.teknologi),
    link: p.link_project || '',
    image: p.url_thumbnail || '',
    app: '',
  }));

  const merged = [];
  const seen = new Set();
  const push = (f) => { if (f && !seen.has(f.id)) { seen.add(f.id); merged.push(f); } };
  fileRows.forEach(push);
  mappedProjects.forEach(push);

  return merged.sort((a, b) => String(a.folder || '').localeCompare(String(b.folder || '')) || String(a.sort_order || 0).localeCompare(String(b.sort_order || 0)));
}

async function getFileById(id) {
  const all = await getAllFiles();
  return all.find(f => f.id === id) || null;
}

async function addFile(file) {
  const sheets = getSheets();
  const row = fileToRow(file, null);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${FILES_SHEET}!A:${FILES_LAST_COL}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return file.id;
}

async function updateFile(id, updates) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FILES_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`File tidak ditemukan: ${id}`);

  const rawExisting = rows[rowIndex];
  const merged = { ...rowToFile(rawExisting), ...updates, id };
  const row = fileToRow(merged, rawExisting);
  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${FILES_SHEET}!A${sheetRow}:${FILES_LAST_COL}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });

  return id;
}

async function deleteFile(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: FILES_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`File tidak ditemukan: ${id}`);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title === FILES_SHEET);
  if (!sheet) throw new Error('Sheet tidak ditemukan');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: sheet.properties.sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  return id;
}

// ── DRIVE OPERATIONS ──────────────────────────────────────
async function uploadToDrive(fileBuffer, fileName, mimeType) {
  const drive = getDrive();
  const folderId = process.env.DRIVE_FOLDER_ID;

  const fileMetadata = { name: fileName };
  if (folderId) fileMetadata.parents = [folderId];

  const res = await drive.files.create({
    requestBody: fileMetadata,
    media: {
      mimeType,
      body: require('stream').Readable.from(fileBuffer),
    },
    fields: 'id, webContentLink, webViewLink',
  });

  const fileId = res.data.id;

  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  return {
    id: fileId,
    url: `https://lh3.googleusercontent.com/d/${fileId}`,
    viewUrl: res.data.webViewLink,
  };
}

async function deleteFromDrive(fileId) {
  const drive = getDrive();
  await drive.files.delete({ fileId });
}

async function getAllCertificates() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'Certificates!A2:I',
  });
  const rows = res.data.values || [];
  return rows
    .filter(r => r && r[0] && String(r[1] || '').trim() && String(r[7] || 'false').toLowerCase() === 'true')
    .map(r => ({
      id: r[0],
      kind: 'certificate',
      title: String(r[1] || '').trim(),
      folder: 'Certificates',
      page: 1,
      desc: String(r[2] || '').trim(),
      skills: [String(r[3] || '').trim(), String(r[5] || '').trim()].filter(Boolean).join(', '),
      link: r[6] ? img(String(r[6])) : img(String(r[4] || '')),
      image: driveThumb(String(r[4] || '')) || img(String(r[4] || '')),
      app: '',
      sort_order: parseInt(r[8] || '0') || 0,
    }));
}

const CERT_COLS = ['id', 'title', 'description', 'issuer', 'image', 'issued_date', 'credential_url', 'published', 'sort_order'];
const CERT_LAST_COL = String.fromCharCode(64 + CERT_COLS.length);
const CERT_RANGE = `Certificates!A2:${CERT_LAST_COL}`;

function rowToCert(row) {
  const s = {};
  CERT_COLS.forEach((c, i) => { s[c] = (row && row[i]) || ''; });
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    issuer: s.issuer,
    image: s.image,
    issued_date: s.issued_date,
    credential_url: s.credential_url,
    published: String(s.published).toLowerCase() === 'true',
    sort_order: parseInt(s.sort_order || '0') || 0,
  };
}

function certToRow(c) {
  return [
    c.id || '',
    c.title || '',
    c.description || '',
    c.issuer || '',
    c.image || '',
    c.issued_date || '',
    c.credential_url || '',
    c.published ? 'true' : 'false',
    String(c.sort_order || 0),
  ];
}

async function getAllCertificatesAdmin() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: CERT_RANGE,
  });
  const rows = res.data.values || [];
  return rows
    .filter(r => r && r[0] && String(r[1] || '').trim())
    .map(r => ({ ...rowToCert(r), image: driveThumb(r[4]) || img(r[4]) }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

const CERT_FULL_RANGE = `Certificates!A:${CERT_LAST_COL}`;

async function getCertificateById(id) {
  const all = await getAllCertificatesAdmin();
  return all.find(c => c.id === id) || null;
}

async function addCertificate(cert) {
  if (!cert.id) cert.id = slugify(cert.title || '');
  if (!cert.id) throw new Error('Judul diperlukan');
  const existing = await getAllCertificatesAdmin();
  if (existing.find(c => c.id === cert.id)) {
    throw new Error(`ID sudah ada: ${cert.id}`);
  }
  const sheets = getSheets();
  const row = certToRow(cert);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `Certificates!A:${CERT_LAST_COL}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return cert.id;
}

async function updateCertificate(id, updates) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: CERT_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Certificate tidak ditemukan: ${id}`);
  const merged = { ...rowToCert(rows[rowIndex]), ...updates, id };
  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Certificates!A${sheetRow}:${CERT_LAST_COL}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [certToRow(merged)] },
  });
  return id;
}

async function deleteCertificate(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: CERT_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Certificate tidak ditemukan: ${id}`);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title === 'Certificates');
  if (!sheet) throw new Error('Sheet Certificates tidak ditemukan');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });

  return id;
}

const READING_COLS = ['id', 'title', 'author', 'status', 'progress', 'quote', 'note', 'sort_order', 'goodreads_url', 'logo_url'];
const READING_LAST_COL = String.fromCharCode(64 + READING_COLS.length);
const READING_RANGE = `Reading List!A2:${READING_LAST_COL}`;
const READING_FULL_RANGE = `Reading List!A:${READING_LAST_COL}`;

function rowToReadingItem(row) {
  const s = {};
  READING_COLS.forEach((c, i) => { s[c] = (row && row[i]) || ''; });
  return {
    id: s.id,
    title: s.title,
    author: s.author,
    status: s.status,
    progress: parseInt(s.progress || '0') || 0,
    quote: s.quote,
    note: s.note,
    sort_order: parseInt(s.sort_order || '0') || 0,
    goodreads_url: s.goodreads_url,
    logo_url: s.logo_url,
  };
}

function readingItemToRow(c) {
  return [
    c.id || '',
    c.title || '',
    c.author || '',
    c.status || 'next',
    String(c.progress || 0),
    c.quote || '',
    c.note || '',
    String(c.sort_order || 0),
    c.goodreads_url || '',
    c.logo_url || '',
  ];
}

async function getAllReadingList() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: READING_RANGE,
  });
  const rows = res.data.values || [];
  return rows
    .filter(r => r && r[0] && String(r[1] || '').trim())
    .map(rowToReadingItem)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function getReadingListItemById(id) {
  const all = await getAllReadingList();
  return all.find(c => c.id === id) || null;
}

async function addReadingListItem(item) {
  if (!item.id) item.id = slugify(item.title || '');
  if (!item.id) throw new Error('Judul diperlukan');
  const existing = await getAllReadingList();
  if (existing.find(c => c.id === item.id)) {
    throw new Error(`ID sudah ada: ${item.id}`);
  }
  const sheets = getSheets();
  const row = readingItemToRow(item);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `Reading List!A:${READING_LAST_COL}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return item.id;
}

async function updateReadingListItem(id, updates) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: READING_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Item tidak ditemukan: ${id}`);
  const merged = { ...rowToReadingItem(rows[rowIndex]), ...updates, id };
  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Reading List!A${sheetRow}:${READING_LAST_COL}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [readingItemToRow(merged)] },
  });
  return id;
}

async function deleteReadingListItem(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: READING_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Item tidak ditemukan: ${id}`);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title === 'Reading List');
  if (!sheet) throw new Error('Sheet Reading List tidak ditemukan');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });

  return id;
}

const SKETCHBOOK_COLS = ['id', 'title', 'description', 'technologies', 'thumbnail', 'sort_order'];
const SKETCHBOOK_LAST_COL = String.fromCharCode(64 + SKETCHBOOK_COLS.length);
const SKETCHBOOK_RANGE = `Sketchbook!A2:${SKETCHBOOK_LAST_COL}`;
const SKETCHBOOK_FULL_RANGE = `Sketchbook!A:${SKETCHBOOK_LAST_COL}`;

function rowToSketchbookItem(row) {
  const s = {};
  SKETCHBOOK_COLS.forEach((c, i) => { s[c] = (row && row[i]) || ''; });
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    technologies: splitComma(s.technologies),
    thumbnail: s.thumbnail,
    sort_order: parseInt(s.sort_order || '0') || 0,
  };
}

function sketchbookItemToRow(c) {
  return [
    c.id || '',
    c.title || '',
    c.description || '',
    Array.isArray(c.technologies) ? c.technologies.join(', ') : (c.technologies || ''),
    c.thumbnail || '',
    String(c.sort_order || 0),
  ];
}

async function getAllSketchbook() {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SKETCHBOOK_RANGE,
  });
  const rows = res.data.values || [];
  return rows
    .filter(r => r && r[0] && String(r[1] || '').trim())
    .map(rowToSketchbookItem)
    .map(c => ({ ...c, thumbnail: driveThumb(c.thumbnail) || img(c.thumbnail) }))
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

async function getSketchbookItemById(id) {
  const all = await getAllSketchbook();
  return all.find(c => c.id === id) || null;
}

async function addSketchbookItem(item) {
  if (!item.id) item.id = slugify(item.title || '');
  if (!item.id) throw new Error('Judul diperlukan');
  const existing = await getAllSketchbook();
  if (existing.find(c => c.id === item.id)) {
    throw new Error(`ID sudah ada: ${item.id}`);
  }
  const sheets = getSheets();
  const row = sketchbookItemToRow(item);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `Sketchbook!A:${SKETCHBOOK_LAST_COL}`,
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  });
  return item.id;
}

async function updateSketchbookItem(id, updates) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SKETCHBOOK_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Item tidak ditemukan: ${id}`);
  const merged = { ...rowToSketchbookItem(rows[rowIndex]), ...updates, id };
  const sheetRow = rowIndex + 1;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `Sketchbook!A${sheetRow}:${SKETCHBOOK_LAST_COL}${sheetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [sketchbookItemToRow(merged)] },
  });
  return id;
}

async function deleteSketchbookItem(id) {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SKETCHBOOK_FULL_RANGE,
  });
  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0] === id);
  if (rowIndex === -1) throw new Error(`Item tidak ditemukan: ${id}`);

  const metaRes = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = metaRes.data.sheets.find(s => s.properties.title === 'Sketchbook');
  if (!sheet) throw new Error('Sheet Sketchbook tidak ditemukan');

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowIndex,
            endIndex: rowIndex + 1,
          },
        },
      }],
    },
  });

  return id;
}

module.exports = {
  getAllProjects,
  getProjectById,
  addProject,
  updateProject,
  deleteProject,
  getAllFiles,
  getFileById,
  addFile,
  updateFile,
  deleteFile,
  getAllCertificates,
  getAllCertificatesAdmin,
  getCertificateById,
  addCertificate,
  updateCertificate,
  deleteCertificate,
  getAllReadingList,
  getReadingListItemById,
  addReadingListItem,
  updateReadingListItem,
  deleteReadingListItem,
  getAllSketchbook,
  getSketchbookItemById,
  addSketchbookItem,
  updateSketchbookItem,
  deleteSketchbookItem,
  uploadToDrive,
  deleteFromDrive,
};
