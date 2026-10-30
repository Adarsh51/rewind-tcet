const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select('id, group_id, subject_id, exam_type, semester, year, title, contributor_name, file_path, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Add public URL for each paper
    const bucketUrl = `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/papers/`;
    const papers = (data || []).map(p => ({
      ...p,
      url: bucketUrl + p.file_path
    }));

    return res.status(200).json({ papers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
