const { createClient } = require('@supabase/supabase-js');
const pdfParse = require('pdf-parse');
const Busboy = require('busboy');
const crypto = require('crypto');

// ---- config ----
const supabase = createClient(
  `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// Subject keywords for validation
const SUBJECT_KEYWORDS = {
  phy:   ['physics', 'optics', 'quantum', 'thermodynamics', 'semiconductor', 'laser', 'interference', 'diffraction', 'wave', 'electromagnetic'],
  maths: ['mathematics', 'calculus', 'matrix', 'differential', 'integral', 'laplace', 'fourier', 'algebra', 'equation', 'theorem', 'derivative'],
  bee:   ['electrical', 'circuit', 'kirchhoff', 'transformer', 'motor', 'generator', 'voltage', 'current', 'resistance', 'ohm', 'ac', 'dc', 'diode'],
  egd:   ['graphics', 'projection', 'orthographic', 'isometric', 'drawing', 'engineering drawing', 'autocad', 'scale', 'dimension'],
  eng:   ['english', 'communication', 'grammar', 'writing', 'comprehension', 'vocabulary', 'language', 'essay', 'paragraph', 'professional communication'],
  chem:  ['chemistry', 'corrosion', 'polymer', 'fuel', 'lubricant', 'water treatment', 'electrochemistry', 'spectroscopy', 'chemical', 'organic', 'inorganic'],
  pps:   ['programming', 'c language', 'function', 'pointer', 'array', 'loop', 'algorithm', 'flowchart', 'data type', 'struct', 'printf', 'scanf', 'variable'],
  em:    ['mechanics', 'force', 'moment', 'friction', 'equilibrium', 'truss', 'centroid', 'beam', 'stress', 'strain', 'shear', 'newton', 'torque'],
  iks:   ['indian knowledge', 'vedic', 'yoga', 'ayurveda', 'ancient', 'philosophy', 'dharma', 'sanskrit', 'tradition', 'heritage', 'culture']
};

// ---- helpers ----
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function extractText(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text || '';
  } catch {
    return '';
  }
}

function checkSubjectMatch(text, subjectId) {
  const keywords = SUBJECT_KEYWORDS[subjectId];
  if (!keywords) return { match: true, confidence: 0, message: 'Unknown subject, skipping keyword check' };

  const lower = text.toLowerCase();
  const matches = keywords.filter(kw => lower.includes(kw));
  const ratio = matches.length / keywords.length;

  if (ratio >= 0.15) return { match: true, confidence: ratio, matched: matches };
  return {
    match: false,
    confidence: ratio,
    matched: matches,
    message: `This doesn't look like a ${subjectId.toUpperCase()} paper. Found keywords: ${matches.join(', ') || 'none'}`
  };
}

function checkExamStructure(text) {
  const lower = text.toLowerCase();
  const examIndicators = ['q.', 'q1', 'q2', 'q3', 'q4', 'question', 'marks', 'time:', 'total marks', 'attempt', 'answer', 'exam', 'university', 'semester', 'engineering'];
  const matches = examIndicators.filter(kw => lower.includes(kw));
  return {
    isExamPaper: matches.length >= 3,
    indicators: matches,
    message: matches.length < 3 ? 'This file does not appear to have standard question paper headings or question numbers.' : null
  };
}

async function moderateWithGemini(text, subjectName, examType) {
  if (!GEMINI_KEY || text.length < 20) {
    return { safe: true, skipped: true, reason: 'No text extracted or GEMINI_API_KEY missing' };
  }

  const truncated = text.substring(0, 3000);
  const prompt = `You are an automated academic content moderator for an engineering college previous year question paper (PYQ) portal.
Analyze this text extracted from a student-uploaded PDF intended for exam type "${examType}" and subject "${subjectName}".

Requirements:
1. Is this genuine academic / question paper content?
2. Does it contain any inappropriate, explicit, abusive, or offensive material?
3. Does the text content broadly match the curriculum for "${subjectName}"?

Respond ONLY with a valid JSON object matching this schema:
{"is_academic": true, "is_inappropriate": false, "matches_subject": true, "confidence": 0.9, "reason": "short explanation"}

Extracted Text:
"""
${truncated}
"""`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    if (!res.ok) {
      return { safe: true, skipped: true, reason: 'Gemini HTTP ' + res.status };
    }

    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { safe: true, skipped: true, reason: 'Unparseable Gemini response' };

    const result = JSON.parse(jsonMatch[0]);
    return {
      safe: result.is_academic && !result.is_inappropriate,
      is_academic: Boolean(result.is_academic),
      is_inappropriate: Boolean(result.is_inappropriate),
      matches_subject: Boolean(result.matches_subject),
      confidence: result.confidence || 0.8,
      reason: result.reason || ''
    };
  } catch (err) {
    return { safe: true, skipped: true, reason: 'Gemini error: ' + err.message };
  }
}

function parseMultipartBody(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_FILE_SIZE }
    });

    const fields = {};
    let filePart = null;

    busboy.on('field', (fieldname, val) => {
      fields[fieldname] = val;
    });

    busboy.on('file', (fieldname, file, info) => {
      const { filename, mimeType } = info;
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('end', () => {
        filePart = {
          name: fieldname,
          filename,
          mimeType,
          data: Buffer.concat(chunks)
        };
      });
    });

    busboy.on('finish', () => {
      resolve({ fields, filePart });
    });

    busboy.on('error', err => reject(err));

    req.pipe(busboy);
  });
}

// ---- main handler ----
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Expected multipart/form-data' });
    }

    const { fields, filePart } = await parseMultipartBody(req);

    const groupId = fields.group_id;
    const subjectId = fields.subject_id;
    const subjectName = fields.subject_name;
    const examType = fields.exam_type;
    const semester = fields.semester;
    const year = fields.year;
    const title = fields.title;
    const contributorName = fields.contributor_name ? fields.contributor_name.trim() : 'Anonymous';

    if (!groupId || !subjectId || !examType || !semester || !year || !title) {
      return res.status(400).json({ error: 'Please fill in all required fields.' });
    }

    if (!filePart || !filePart.data || filePart.data.length === 0) {
      return res.status(400).json({ error: 'Please choose a PDF question paper to upload.' });
    }

    if (filePart.data.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File size exceeds maximum limit of 5 MB.' });
    }

    // Check PDF magic bytes (%PDF-)
    const pdfHeader = filePart.data.slice(0, 5).toString('ascii');
    if (pdfHeader !== '%PDF-') {
      return res.status(400).json({ error: 'Invalid file format. Only genuine PDF documents are supported.' });
    }

    // SHA-256 duplicate check
    const fileHash = hashBuffer(filePart.data);
    const { data: existing, error: dupErr } = await supabase
      .from('submissions')
      .select('id, status')
      .eq('file_hash', fileHash)
      .limit(1);

    if (!dupErr && existing && existing.length > 0) {
      return res.status(409).json({
        error: 'This exact question paper has already been uploaded to the database!'
      });
    }

    // Extract text from PDF
    const pdfText = await extractText(filePart.data);

    // AI & Heuristic Moderation
    const structureCheck = checkExamStructure(pdfText);
    const subjectCheck = checkSubjectMatch(pdfText, subjectId);
    const aiCheck = await moderateWithGemini(pdfText, subjectName || subjectId, examType);

    // Hard reject for inappropriate content
    if (aiCheck.is_inappropriate) {
      return res.status(400).json({
        error: 'Upload rejected: This file was flagged as containing inappropriate or non-academic material.'
      });
    }

    const warnings = [];
    if (!structureCheck.isExamPaper && pdfText.length > 50) {
      warnings.push('The document structure may not match a standard question paper.');
    }
    if (!subjectCheck.match && pdfText.length > 50) {
      warnings.push(subjectCheck.message);
    }
    if (aiCheck.matches_subject === false && pdfText.length > 50) {
      warnings.push(`AI suggests this may belong to a different subject: ${aiCheck.reason}`);
    }

    // Upload to Supabase Storage Bucket ('papers')
    const storagePath = `pending/${groupId}/${subjectId}/${Date.now()}_${fileHash.substring(0, 8)}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from('papers')
      .upload(storagePath, filePart.data, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return res.status(500).json({
        error: 'Could not store PDF file: ' + uploadError.message
      });
    }

    // Save record in submissions table
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
        status: 'pending',
        moderation_result: {
          structure: structureCheck,
          subject: subjectCheck,
          ai: aiCheck,
          warnings
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database insert error:', dbError);
      return res.status(500).json({
        error: 'Failed to record submission: ' + dbError.message
      });
    }

    return res.status(200).json({
      success: true,
      id: record.id,
      warnings,
      message: warnings.length > 0
        ? 'Paper uploaded and queued for review with AI advisory notes.'
        : 'Paper uploaded successfully! It has passed initial checks and will be published shortly.'
    });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Server error processing file: ' + err.message });
  }
};
