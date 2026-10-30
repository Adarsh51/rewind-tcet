const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  const projectId = process.env.SUPABASE_PROJECT_ID || 'bpdyqvdebwaxcyipkftt';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Supabase credentials not found. Please set SUPABASE_ANON_KEY in Vercel Environment Variables.');
  }
  return createClient(`https://${projectId}.supabase.co`, key);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('submissions')
      .select('id, group_id, subject_id, exam_type, semester, year, title, contributor_name, file_path, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const projectId = process.env.SUPABASE_PROJECT_ID || 'bpdyqvdebwaxcyipkftt';
    const bucketUrl = `https://${projectId}.supabase.co/storage/v1/object/public/papers/`;
    const papers = (data || []).map(p => ({
      ...p,
      url: bucketUrl + p.file_path
    }));

    return res.status(200).json({ papers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
