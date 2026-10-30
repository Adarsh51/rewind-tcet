const { createClient } = require('@supabase/supabase-js');
const Busboy = require('busboy');
const crypto = require('crypto');

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function getSupabase() {
  const projectId = process.env.SUPABASE_PROJECT_ID || 'bpdyqvdebwaxcyipkftt';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Supabase credentials not found. Please set SUPABASE_ANON_KEY in Vercel.');
  }
  return createClient(`https://${projectId}.supabase.co`, key);
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function parseMultipartBody(req) {
  return new Promise((resolve, reject) => {
    try {
      const busboy = Busboy({
        headers: req.headers,
        limits: { fileSize: MAX_FILE_SIZE }
      });

      const fields = {};
      let filePart = null;

      busboy.on('field', (name, val) => {
        fields[name] = val;
      });

      busboy.on('file', (name, file, info) => {
        const { filename, mimeType } = info;
        const chunks = [];
        file.on('data', chunk => chunks.push(chunk));
        file.on('end', () => {
          filePart = {
            name,
            filename,
            mimeType,
            data: Buffer.concat(chunks)
          };
        });
      });

      busboy.on('finish', () => resolve({ fields, filePart }));
      busboy.on('close', () => resolve({ fields, filePart }));
      busboy.on('error', err => reject(err));

      if (req.body && Buffer.isBuffer(req.body)) {
        busboy.end(req.body);
      } else {
        req.pipe(busboy);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// ---- handler ----
async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabase();

    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    const { fields, filePart } = await parseMultipartBody(req);

    const groupId = fields.group_id;
    const subjectId = fields.subject_id;
    const subjectName = fields.subject_name;
    let examType = fields.exam_type;
    const semester = fields.semester;
    const year = fields.year;
    let title = fields.title;
    const examChoice = fields.exam_choice;
    const contributorName = fields.contributor_name ? fields.contributor_name.trim() : 'Anonymous';

    if (examChoice) {
      if (!title) title = examChoice;
      if (!examType) {
        if (examChoice.startsWith('ISE')) examType = 'ISE';
        else if (examChoice.startsWith('ESE')) examType = 'ESE';
        else if (examChoice.startsWith('MSE')) examType = 'MSE';
        else examType = 'PYQ';
      }
    }
    if (!title && examType) title = examType;
    if (!examType && title) {
      if (title.startsWith('ISE')) examType = 'ISE';
      else if (title.startsWith('ESE')) examType = 'ESE';
      else if (title.startsWith('MSE')) examType = 'MSE';
      else examType = 'PYQ';
    }

    if (!groupId || !subjectId || !examType || !semester || !year || !title) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    if (!filePart || !filePart.data || filePart.data.length === 0) {
      return res.status(400).json({ error: 'Please choose a PDF question paper to upload.' });
    }

    if (filePart.data.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File size exceeds maximum limit of 5 MB.' });
    }

    // Verify it's a PDF
    const pdfHeader = filePart.data.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      return res.status(400).json({ error: 'Invalid file format. Please upload a genuine PDF document.' });
    }

    // Duplicate check
    const fileHash = hashBuffer(filePart.data);
    const { data: existing } = await supabase
      .from('submissions')
      .select('id')
      .eq('file_hash', fileHash)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        error: 'This exact question paper has already been submitted!'
      });
    }

    // Upload PDF to Supabase Storage
    const storagePath = `pending/${groupId}/${subjectId}/${Date.now()}_${fileHash.substring(0, 8)}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('papers')
      .upload(storagePath, filePart.data, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage error:', uploadError);
      return res.status(500).json({ error: 'Storage upload failed: ' + uploadError.message });
    }

    // Record submission for admin review
    const { data: record, error: dbError } = await supabase
      .from('submissions')
      .insert({
        group_id: groupId,
        subject_id: subjectId,
        subject_name: subjectName || subjectId,
        exam_type: examType,
        semester,
        year,
        title,
        contributor_name: contributorName,
        file_path: storagePath,
        file_size: filePart.data.length,
        file_hash: fileHash,
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Database save failed: ' + dbError.message });
    }

    return res.status(200).json({
      success: true,
      id: record.id,
      message: 'Paper submitted successfully! It will be published soon. Thank you for your contribution!'
    });

  } catch (err) {
    console.error('Upload handler error:', err);
    return res.status(500).json({ error: err.message || 'Server error uploading file' });
  }
}

module.exports = handler;
module.exports.config = {
  api: {
    bodyParser: false,
  },
};
