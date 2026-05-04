const axios = require('axios');
const cheerio = require('cheerio');

const HTTP_OPTS = {
  timeout: 8000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  maxRedirects: 5,
};

const DEAL_KEYWORDS = [
  'discount', 'offer', 'deal', 'special', 'promo', 'promotion',
  'coupon', 'happy hour', 'sale', '% off', 'percent off',
  'buy one get one', 'bogo', '2 for 1', 'two for one',
  'free', 'complimentary', 'save', 'reduced', 'half price',
  'limited time', 'today only', 'weekend special', 'lunch deal',
  'combo', 'meal deal', 'value meal', 'set meal', 'family deal',
  'student', 'cashback', 'flat', 'voucher', 'code', 'redeem',
  'tk off', '৳', 'taka', 'eid', 'ramadan', 'iftar', 'exclusive',
  'flash sale', 'grab', 'hurry', 'monday offer', 'tuesday offer',
];

const DEAL_SELECTORS = [
  '[class*="promo"]', '[class*="discount"]', '[class*="offer"]',
  '[class*="deal"]', '[class*="special"]', '[class*="coupon"]',
  '[class*="banner"]', '[class*="campaign"]', '[class*="flash"]',
  '[id*="promo"]', '[id*="discount"]', '[id*="offer"]',
  '[id*="deal"]', '[id*="special"]', '[id*="banner"]',
];

const DEAL_PATHS = [
  '/deals', '/offers', '/specials', '/promotions', '/discounts',
  '/happy-hour', '/coupons', '/menu-specials', '/combo', '/packages',
];

async function findDiscountsOnWebsite(websiteUrl) {
  const allDeals = [];
  const seen = new Set();

  // Scrape main page
  try {
    const { deals, ogImage } = await scrapePage(websiteUrl, websiteUrl);
    deals.forEach((d) => {
      const item = { ...d, url: websiteUrl };
      if (!item.imageUrl && ogImage) item.imageUrl = ogImage;
      allDeals.push(item);
    });
  } catch {
    // Site unreachable — skip silently
  }

  // Scrape common deal sub-pages in parallel
  let base;
  try { base = new URL(websiteUrl).origin; } catch { return dedup(allDeals, seen); }

  const subResults = await Promise.allSettled(
    DEAL_PATHS.map((path) =>
      scrapePage(base + path, base + path).then(({ deals, ogImage }) =>
        deals.map((d) => {
          const item = { ...d, url: base + path };
          if (!item.imageUrl && ogImage) item.imageUrl = ogImage;
          return item;
        })
      )
    )
  );

  subResults
    .filter((r) => r.status === 'fulfilled')
    .forEach((r) => allDeals.push(...r.value));

  return dedup(allDeals, seen);
}

function dedup(deals, seen) {
  return deals.filter((d) => {
    const key = d.description.substring(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapePage(url, pageUrl) {
  const { data } = await axios.get(url, HTTP_OPTS);
  const $ = cheerio.load(data);
  const found = [];

  // Extract OG image for the page (used as fallback for deals without their own image)
  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null;

  // High-confidence: elements with promo/deal classes or IDs
  DEAL_SELECTORS.forEach((sel) => {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length < 15 || text.length > 600) return;
      const imageUrl = findNearbyImage($, el, pageUrl);
      found.push({ description: text, imageUrl, confidence: 'high', source: 'website' });
    });
  });

  // Medium-confidence: any element with deal keywords
  $('p, li, h2, h3, h4, span, div').each((_, el) => {
    if ($(el).children('p, div, ul, ol, section').length > 0) return; // non-leaf
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 15 || text.length > 500) return;
    const lower = text.toLowerCase();
    if (!DEAL_KEYWORDS.some((kw) => lower.includes(kw))) return;
    const imageUrl = findNearbyImage($, el, pageUrl);
    found.push({ description: text, imageUrl, confidence: 'medium', source: 'website' });
  });

  // Deduplicate within this page before returning
  const seen = new Set();
  const unique = found.filter((d) => {
    const key = d.description.substring(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { deals: unique.slice(0, 8), ogImage };
}

// Walk up to 3 ancestor levels looking for an <img> or background-image
function findNearbyImage($, el, pageUrl) {
  let node = $(el);
  for (let i = 0; i < 3; i++) {
    // Check direct img descendants
    const img = node.find('img').first();
    if (img.length) {
      const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
      if (src) return resolveUrl(src, pageUrl);
    }
    // Check sibling img
    const sibImg = node.siblings('img').first();
    if (sibImg.length) {
      const src = sibImg.attr('src') || sibImg.attr('data-src');
      if (src) return resolveUrl(src, pageUrl);
    }
    node = node.parent();
  }
  return null;
}

function resolveUrl(src, pageUrl) {
  if (!src || src.startsWith('data:')) return null;
  if (src.startsWith('http')) return src;
  try {
    return new URL(src, pageUrl).href;
  } catch {
    return null;
  }
}

async function extractSocialMediaLinks(websiteUrl) {
  try {
    const { data } = await axios.get(websiteUrl, HTTP_OPTS);
    const $ = cheerio.load(data);
    const links = {};
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!links.facebookPage && href.includes('facebook.com')) links.facebookPage = href;
      if (!links.instagramPage && href.includes('instagram.com')) links.instagramPage = href;
    });
    return links;
  } catch {
    return {};
  }
}

module.exports = { findDiscountsOnWebsite, extractSocialMediaLinks };
