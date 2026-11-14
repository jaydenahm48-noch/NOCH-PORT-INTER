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

  // 1. Tambah tab baru "Reading List"
  console.log('Membuat tab "Reading List"...');
  const addSheet = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: 'Reading List',
            },
          },
        },
      ],
    },
  });

  const sheetId = addSheet.data.replies[0].addSheet.properties.sheetId;
  console.log(`Tab berhasil dibuat, sheetId: ${sheetId}`);

  // 2. Tulis header + 5 buku
  const rows = [
    // Header
    ['id', 'title', 'author', 'status', 'progress', 'quote', 'note', 'sort_order', 'goodreads_url'],
    // Data
    [
      'together-everyday',
      'The Design of Everyday Things',
      'Don Norman',
      'done',
      100,
      'Good design is actually a lot harder to notice than poor design.',
      'Still the best case for kind interfaces.',
      1,
      '',
    ],
    [
      'a-pattern-language',
      'A Pattern Language',
      'Christopher Alexander',
      'reading',
      62,
      'Rooms, light and the way people actually live.',
      '',
      2,
      '',
    ],
    [
      'shape-up',
      'Shape Up',
      'Ryan Singer',
      'done',
      100,
      '',
      '',
      3,
      '',
    ],
    [
      'pachinko',
      'Pachinko',
      'Min Jin Lee',
      'next',
      0,
      '',
      '',
      4,
      '',
    ],
    [
      'the-remains-of-the-day',
      'The Remains of the Day',
      'Kazuo Ishiguro',
      'next',
      0,
      '',
      '',
      5,
      '',
    ],
  ];

  console.log('Menulis header dan data...');
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Reading List!A1',
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });

  // 3. Bold header row
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
                backgroundColor: { red: 0.85, green: 0.92, blue: 0.98 },
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
              endIndex: 9,
            },
          },
        },
      ],
    },
  });

  console.log('\n✅ Selesai!');
  console.log('Tab: "Reading List"');
  console.log('Kolom: id | title | author | status | progress | quote | note | sort_order | goodreads_url');
  console.log('Data: 5 buku sudah terisi');
  console.log(`\nBuka: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
