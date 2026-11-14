// Jalankan sekali untuk setup Google Sheet
// Usage: node scripts/setup-sheet.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { google } = require('googleapis');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = 'projects';
const HEADERS = ['id', 'judul', 'kategori', 'deskripsi', 'url_thumbnail', 'gambar_detail', 'link_project', 'teknologi'];

const SAMPLE_DATA = [
  [
    'nochy-eat',
    'Nochy Eat',
    'Mobile App',
    'Aplikasi layanan pesan-antar makanan berbasis Flutter (Android & iOS) dengan sistem multi-role (Customer, Driver, Seller). Dilengkapi realtime tracking, Midtrans Payment Gateway, dan manajemen voucher.',
    'https://drive.google.com/uc?id=GANTI_DENGAN_ID_GAMBAR',
    'https://drive.google.com/uc?id=IMG1_ID,https://drive.google.com/uc?id=IMG2_ID',
    'https://github.com/username/nochy-eat',
    'Flutter,Dart,Supabase,PostgreSQL,Midtrans API,OpenStreetMap,Geolocator'
  ]
];

async function main() {
  if (!SPREADSHEET_ID) {
    console.error('❌ SPREADSHEET_ID belum diset di .env');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // Cek apakah sheet sudah ada
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const existing = meta.data.sheets.find(s => s.properties.title === SHEET_NAME);

    if (!existing) {
      // Buat sheet baru
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
        }
      });
      console.log(`✅ Sheet "${SHEET_NAME}" dibuat`);
    } else {
      console.log(`ℹ️  Sheet "${SHEET_NAME}" sudah ada`);
    }

    // Clear existing content
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    });

    // Set header + sample data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [HEADERS, ...SAMPLE_DATA]
      }
    });

    // Format header (bold + background)
    const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const sheet = sheetMeta.data.sheets.find(s => s.properties.title === SHEET_NAME);

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: sheet.properties.sheetId,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: HEADERS.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.1, green: 0.1, blue: 0.17 },
                  textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
                }
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)'
            }
          },
          // Freeze header row
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheet.properties.sheetId,
                gridProperties: { frozenRowCount: 1 }
              },
              fields: 'gridProperties.frozenRowCount'
            }
          }
        ]
      }
    });

    console.log('✅ Header diformat');
    console.log('✅ Sample data Nochy Eat ditambahkan');
    console.log('');
    console.log('🎉 Sheet berhasil di-setup!');
    console.log(`   Buka: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.message.includes('PERMISSION_DENIED')) {
      console.error('   Pastikan spreadsheet sudah di-share ke:', process.env.GOOGLE_CLIENT_EMAIL);
    }
  }
}

main();
