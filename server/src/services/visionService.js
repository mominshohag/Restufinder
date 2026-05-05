const Anthropic = require('@anthropic-ai/sdk');
const axios = require('axios');

let _client = null;
function client() {
  if (!_client && process.env.ANTHROPIC_API_KEY) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);

const PROMPT = `This image is from a restaurant's Facebook post, Instagram, or website.

Does it show a discount, special offer, deal, or promotion? Look for:
- Percentage or flat discounts ("50% off", "Flat ৳100 off")
- Buy-one-get-one or free item deals
- Combo / meal deal / value meal pricing
- Day-specific or seasonal offers (Monday deal, Eid offer, Ramadan special)
- Any promotional price or limited-time offer

If YES → Write 1–3 clear sentences describing the exact offer. Include: what is discounted, the amount/percentage, any conditions (valid on Mondays, minimum order, etc.). Be specific.
If NO offer → reply with exactly: NO_OFFER`;

/**
 * Analyse an image URL with Claude Haiku vision.
 * Returns a string description of the offer, or null if no offer found / on error.
 */
async function detectOfferInImage(imageUrl) {
  const c = client();
  if (!c || !imageUrl) return null;

  try {
    const imgRes = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 6 * 1024 * 1024, // 6 MB cap
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RestuFinder/1.0)',
        Referer: 'https://www.facebook.com/',
      },
    });

    const mimeRaw = (imgRes.headers['content-type'] || 'image/jpeg').split(';')[0].trim();
    const mimeType = mimeRaw === 'image/jpg' ? 'image/jpeg' : mimeRaw;
    if (!SUPPORTED_TYPES.has(mimeType)) return null;

    const base64 = Buffer.from(imgRes.data).toString('base64');

    const response = await c.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const text = (response.content[0]?.text || '').trim();
    if (!text || text.toUpperCase().startsWith('NO_OFFER')) return null;
    return text;
  } catch (err) {
    console.error('Vision error for', imageUrl, '—', err.message);
    return null;
  }
}

function isAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

module.exports = { detectOfferInImage, isAvailable };
