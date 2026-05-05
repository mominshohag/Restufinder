/**
 * Free OCR service using Tesseract.js (no API key, no cost, runs locally).
 * Extracts text from promotional images so we can detect deals even when
 * the offer is written inside the image rather than in the caption.
 */
const Tesseract = require('tesseract.js');
const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 86400 }); // cache OCR results for 24 h

let workerPromise = null;

// Persistent worker — created once, reused for all requests
function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker('eng', 1, {
      logger: () => {}, // suppress per-character progress logs
    }).catch((err) => {
      console.error('Tesseract worker init failed:', err.message);
      workerPromise = null;
      return null;
    });
  }
  return workerPromise;
}

/**
 * Download an image and run OCR on it.
 * Returns extracted text string, or null on failure.
 */
async function extractTextFromImage(imageUrl) {
  if (!imageUrl) return null;

  const cacheKey = `ocr_${imageUrl}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const imgRes = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      maxContentLength: 6 * 1024 * 1024,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RestuFinder/1.0)',
        Referer: 'https://www.facebook.com/',
      },
    });

    const worker = await getWorker();
    if (!worker) return null;

    const { data: { text } } = await worker.recognize(Buffer.from(imgRes.data));
    const result = text.replace(/\s+/g, ' ').trim() || null;

    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('OCR error for', imageUrl.slice(0, 80), '—', err.message);
    cache.set(cacheKey, null);
    return null;
  }
}

// Always available — pure local processing, no API key needed
function isAvailable() { return true; }

module.exports = { extractTextFromImage, isAvailable };
