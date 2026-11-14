const {
  getAllFiles,
  getFileById,
  addFile,
  updateFile,
  deleteFile,
  getAllCertificates,
} = require('./lib/google');

// ── HANDLER ───────────────────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { method, query } = req;

  // Auth check untuk method yang butuh auth
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const token = req.headers['x-admin-token'];
    if (token !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // GET semua file (termasuk sertifikat)
    if (method === 'GET' && !query.id) {
      const files = await getAllFiles();
      let certs = [];
      try { certs = await getAllCertificates(); } catch (e) { certs = []; }
      return res.json({ status: 'ok', data: [...files, ...certs] });
    }

    // GET satu file
    if (method === 'GET' && query.id) {
      const file = await getFileById(query.id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      return res.json({ status: 'ok', data: file });
    }

    // POST - tambah file
    if (method === 'POST') {
      const id = await addFile(req.body);
      return res.status(201).json({ status: 'ok', id });
    }

    // PUT - update file
    if (method === 'PUT' && query.id) {
      await updateFile(query.id, req.body);
      return res.status(200).json({ status: 'ok', id: query.id });
    }

    // DELETE - hapus file
    if (method === 'DELETE' && query.id) {
      await deleteFile(query.id);
      return res.status(200).json({ status: 'ok', deleted: query.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
