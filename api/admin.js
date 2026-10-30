const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const projectId = process.env.SUPABASE_PROJECT_ID || 'bpdyqvdebwaxcyipkftt';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Supabase credentials not found. Please set SUPABASE_ANON_KEY in Vercel Environment Variables.');
  }
  return createClient(`https://${projectId}.supabase.co`, key);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Key');
}

function auth(req) {
  const adminPass = process.env.ADMIN_PASSWORD || 'rewind2026';
  return req.headers['x-admin-key'] === adminPass;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!auth(req)) return res.status(401).json({ error: 'Unauthorized' });

  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');

  try {
    const supabase = getSupabase();

    // LIST submissions
    if (req.method === 'GET' && (!action || action === 'list')) {
      const status = url.searchParams.get('status') || 'pending';
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('status', status)
        .order('created_at', { ascending: false });

      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ submissions: data });
    }

    // APPROVE a submission
    if (req.method === 'POST' && action === 'approve') {
      const body = await parseBody(req);
      const { id } = body;
      if (!id) return res.status(400).json({ error: 'Missing submission id' });

      const { data: sub, error: fetchErr } = await supabase
        .from('submissions')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchErr || !sub) return res.status(404).json({ error: 'Submission not found' });

      const newPath = sub.file_path.replace('pending/', 'approved/');

      const { data: fileData, error: dlErr } = await supabase.storage
        .from('papers')
        .download(sub.file_path);

      if (dlErr) return res.status(500).json({ error: 'Failed to download file: ' + dlErr.message });

      const buffer = Buffer.from(await fileData.arrayBuffer());

      await supabase.storage.from('papers').upload(newPath, buffer, {
        contentType: 'application/pdf',
        upsert: true
      });

      await supabase.storage.from('papers').remove([sub.file_path]);

      const { error: updateErr } = await supabase
        .from('submissions')
        .update({ status: 'approved', file_path: newPath })
        .eq('id', id);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return res.status(200).json({ success: true, message: 'Paper approved!' });
    }

    // REJECT a submission
    if (req.method === 'POST' && action === 'reject') {
      const body = await parseBody(req);
      const { id, reason } = body;
      if (!id) return res.status(400).json({ error: 'Missing submission id' });

      const { data: sub } = await supabase
        .from('submissions')
        .select('file_path')
        .eq('id', id)
        .single();

      if (sub) {
        await supabase.storage.from('papers').remove([sub.file_path]);
      }

      const { error: updateErr } = await supabase
        .from('submissions')
        .update({ status: 'rejected', reject_reason: reason || 'Rejected by admin' })
        .eq('id', id);

      if (updateErr) return res.status(500).json({ error: updateErr.message });

      return res.status(200).json({ success: true, message: 'Paper rejected.' });
    }

    // STATS
    if (req.method === 'GET' && action === 'stats') {
      const { data: pending } = await supabase.from('submissions').select('id', { count: 'exact' }).eq('status', 'pending');
      const { data: approved } = await supabase.from('submissions').select('id', { count: 'exact' }).eq('status', 'approved');
      const { data: rejected } = await supabase.from('submissions').select('id', { count: 'exact' }).eq('status', 'rejected');

      return res.status(200).json({
        pending: pending?.length || 0,
        approved: approved?.length || 0,
        rejected: rejected?.length || 0
      });
    }

    return res.status(400).json({ error: 'Unknown action' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}
