const {
  getAllProjects,
  getProjectById,
  addProject,
  updateProject,
  deleteProject,
} = require('./lib/google');

// ── HANDLER ───────────────────────────────────────────────
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
    // GET semua project
    if (method === 'GET' && !query.id) {
      const projects = await getAllProjects();
      return res.json({ status: 'ok', data: projects });
    }

    // GET satu project
    if (method === 'GET' && query.id) {
      const project = await getProjectById(query.id);
      if (!project) return res.status(404).json({ error: 'Not found' });
      return res.json({ status: 'ok', data: project });
    }

    // POST - tambah project
    if (method === 'POST') {
      const id = await addProject(req.body);
      return res.status(201).json({ status: 'ok', id });
    }

    // PUT - update project
    if (method === 'PUT' && query.id) {
      await updateProject(query.id, req.body);
      return res.json({ status: 'ok', id: query.id });
    }

    // DELETE - hapus project
    if (method === 'DELETE' && query.id) {
      await deleteProject(query.id);
      return res.json({ status: 'ok', deleted: query.id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
