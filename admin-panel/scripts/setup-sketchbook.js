require('dotenv').config();
const { google } = require('googleapis');

async function main() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_CLIENT_EMAIL,
    null,
    process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.SPREADSHEET_ID;

  // 1. Tambah tab baru "Sketchbook"
  console.log('Membuat tab "Sketchbook"...');
  const addSheet = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: 'Sketchbook',
            },
          },
        },
      ],
    },
  });

  const sheetId = addSheet.data.replies[0].addSheet.properties.sheetId;
  console.log(`Tab berhasil dibuat, sheetId: ${sheetId}`);

  // 2. Tulis header
  const header = [['id', 'title', 'description', 'technologies', 'thumbnail', 'sort_order']];

  console.log('Menulis header...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Sketchbook!A1',
    valueInputOption: 'RAW',
    requestBody: { values: header },
  });

  // 3. Format: bold header + warna + auto-resize
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                textFormat: { bold: true },
                backgroundColor: { red: 0.95, green: 0.88, blue: 1.0 },
              },
            },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: 0,
              endIndex: 6,
            },
          },
        },
      ],
    },
  });

  console.log('\n✅ Selesai!');
  console.log('Tab    : "Sketchbook"');
  console.log('Kolom  : id | title | description | technologies | thumbnail | sort_order');
  console.log('Note   : kolom "technologies" diisi pakai koma, contoh: Figma, Procreate, Blender');
  console.log(`\nBuka   : https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
