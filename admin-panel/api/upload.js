const { uploadToDrive } = require('./lib/google');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Hanya file gambar yang diizinkan'));
  },
});

function checkAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Vercel tidak support multer langsung, parse manual
async function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    upload.single('file')(req, {
      setHeader: () => {},
      end: () => {},
    }, (err) => {
      if (err) reject(err);
      else resolve(req.file);
    });
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth check
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const file = await parseMultipart(req);
    if (!file) return res.status(400).json({ error: 'Tidak ada file' });

    const result = await uploadToDrive(
      file.buffer,
      file.originalname,
      file.mimetype
    );

    return res.json({ status: 'ok', ...result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
};
