import axios from 'axios';

const DreamRenderPool = (process.env.try || '')
  .split(',')
  .map(k => k.trim())
  .filter(Boolean);

const modelURL = process.env.model;

const blockedWords = (process.env.BLOCK_PROMPT || '')
  .split(',')
  .map(w => w.trim().toLowerCase())
  .filter(Boolean);

function getDreamRenderTry(DreamRenderUsed) {
  return DreamRenderPool.find(k => !DreamRenderUsed.has(k)) || null;
}

async function generateImage(prompt, DreamRenderUsed) {
  const DreamTry = getDreamRenderTry(DreamRenderUsed);
  if (!DreamTry) return null;

  try {
    const response = await axios.post(
      modelURL,
      { inputs: prompt },
      {
        headers: {
          Authorization: `Bearer ${DreamTry}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    DreamRenderUsed.add(DreamTry);
    const base64Image = Buffer.from(response.data, 'binary').toString('base64');
    return `data:image/png;base64,${base64Image}`;
  } catch {
    DreamRenderUsed.add(DreamTry);
    return generateImage(prompt, DreamRenderUsed);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST supported' });
  }

  const prompt = req.body && req.body.prompt;
  if (!prompt || typeof prompt !== 'string') {
    return res.json({ images: [] });
  }

  const lowerPrompt = prompt.toLowerCase();
  const isBlocked = blockedWords.some(word => lowerPrompt.includes(word));
  if (isBlocked) {
    return res.status(403).json({
      error: 'Blocked Prompts',
      message: 'Your prompt contains restricted content.'
    });
  }

  const DreamRenderUsed = new Set();
  const promptVariants = [
    `${prompt}, ultra-detailed`,
    `${prompt}, fantasy style`,
    `${prompt}, cinematic lighting`,
    `${prompt}, realistic photo`
  ];

  try {
    const imagePromises = promptVariants.map(p => generateImage(p, DreamRenderUsed));
    const images = await Promise.all(imagePromises);
    res.json({ images: images.filter(Boolean) });
  } catch {
    res.json({ images: [] });
  }
}
