// Local dev server — tidak dipakai di Vercel
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Route semua /api/projects ke handler
app.all('/api/projects', require('./projects'));
app.all('/api/files',     require('./files'));
app.all('/api/upload',   require('./upload'));
app.all('/api/certificates', require('./certificates'));
app.all('/api/reading-list', require('./reading-list'));
app.all('/api/sketchbook', require('./sketchbook'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NochyOS Admin running at http://localhost:${PORT}`);
});
