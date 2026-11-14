const {
  getAllCertificatesAdmin,
  getCertificateById,
  addCertificate,
  updateCertificate,
  deleteCertificate,
} = require('./lib/google');

// ── HANDLER ────────────────────────────────────────
module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { method, query } = req;

  // Verify token — dipakai login & cek sesi, tidak mengembalikan data
  if (method === 'GET' && query.verify) {
    const token = req.headers['x-admin-token'];
    if (token !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.json({ status: 'ok' });
  }

  // Auth check untuk method yang butuh auth
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const token = req.headers['x-admin-token'];
    if (token !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // GET semua certificate (termasuk yang masih draft)
    if (method === 'GET' && !query.id) {
      const certificates = await getAllCertificatesAdmin();
      return res.json({ status: 'ok', data: certificates });
    }

    // GET satu certificate
    if (method === 'GET' && query.id) {
      const certificate = await getCertificateById(query.id);
      if (!certificate) return res.status(404).json({ error: 'Not found' });
      return res.json({ status: 'ok', data: certificate });
    }

    // POST - tambah certificate
    if (method === 'POST') {
      const id = await addCertificate(req.body);
      return res.status(201).json({ status: 'ok', id });
    }

    // PUT - update certificate
    if (method === 'PUT' && query.id) {
      await updateCertificate(query.id, req.body);
      return res.json({ status: 'ok', id: query.id });
    }

    // DELETE - hapus certificate
    if (method === 'DELETE' && query.id) {
      await deleteCertificate(query.id);
      return res.json({ status: 'ok', deleted: query.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
