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

// STRONG keywords — at least one must be present. These are unambiguously promotional.
const STRONG_KEYWORDS = [
  '% off', 'percent off', 'tk off', '৳ off', 'taka off',
  'buy one get one', 'buy 1 get 1', 'bogo', '2 for 1', 'two for one', 'get one free',
  'flat discount', 'flat off', 'flat tk', 'flat ৳',
  'promo code', 'coupon code', 'voucher code', 'use code',
  'cashback', 'money back',
  'happy hour', 'flash sale', 'limited time offer', 'today only', 'today\'s offer',
  'monday offer', 'tuesday offer', 'wednesday offer', 'thursday offer',
  'friday offer', 'saturday offer', 'sunday offer',
  'eid offer', 'eid deal', 'eid special', 'eid discount',
  'ramadan offer', 'ramadan deal', 'iftar deal', 'iftar offer',
  'pohela boishakh', 'new year offer', 'new year deal',
  'combo offer', 'combo deal', 'meal deal', 'value meal offer',
  'student discount', 'student offer',
  'introductory offer', 'opening offer', 'grand opening',
  'save tk', 'save ৳', 'save up to',
];

// Supportive keywords — count as a deal only when combined with a strong keyword
// (we don't use these alone to avoid false positives like "free wifi", "free parking")
const SUPPORT_KEYWORDS = [
  'offer', 'deal', 'discount', 'special', 'promo', 'promotion', 'sale',
  'free', 'complimentary', 'save', 'exclusive', 'limited', 'hurry',
  'grab', 'don\'t miss', 'celebrate', 'enjoy', 'festive',
];

// Negative keywords — immediately discard any text containing these
const NEGATIVE_KEYWORDS = [
  'university', 'college', 'school', 'admission', 'scholarship', 'faculty',
  'professor', 'student loan', 'tuition',
  'privacy policy', 'terms of service', 'terms & conditions', 'cookie policy',
  'copyright ©', 'all rights reserved',
  'job opening', 'we are hiring', 'career', 'vacancy', 'internship',
  'free wifi', 'free wi-fi', 'free parking', 'free delivery',
  'download our app', 'subscribe to', 'newsletter',
  'opening hours', 'we are open', 'we are closed', 'business hours',
];

// CSS selectors that strongly suggest promotional content
const PROMO_SELECTORS = [
  '[class*="promo"]', '[class*="promotion"]',
  '[class*="offer"]', '[class*="deal"]',
  '[class*="discount"]', '[class*="coupon"]',
  '[class*="campaign"]', '[class*="flash"]',
  '[class*="banner--sale"]', '[class*="sale-banner"]',
  '[id*="promo"]', '[id*="offer"]', '[id*="deal"]', '[id*="discount"]',
];

// Only scrape pages that are explicitly about deals/offers
const DEAL_PATHS = [
  '/deals', '/offers', '/specials', '/promotions', '/discounts',
  '/happy-hour', '/coupons', '/combo', '/packages', '/special-offers',
  '/today-offer', '/current-offers', '/ongoing-offers',
];

async function findDiscountsOnWebsite(websiteUrl) {
  const allDeals = [];
  const seen = new Set();
  let base;
  try { base = new URL(websiteUrl).origin; } catch { return []; }

  // 1. Scrape only explicit deal sub-pages (not the whole website)
  const subResults = await Promise.allSettled(
    DEAL_PATHS.map((path) =>
      scrapePage(base + path, base + path).then(({ deals, ogImage }) =>
        deals.map((d) => {
          if (!d.imageUrl && ogImage) d.imageUrl = ogImage;
          return { ...d, url: base + path };
        })
      )
    )
  );

  subResults
    .filter((r) => r.status === 'fulfilled')
    .forEach((r) => allDeals.push(...r.value));

  // 2. If dedicated deal pages found nothing, try the main page but only
  //    look at elements that have promo/offer CSS classes — not general text
  if (allDeals.length === 0) {
    try {
      const { deals, ogImage } = await scrapePageStrictMode(websiteUrl);
      deals.forEach((d) => {
        if (!d.imageUrl && ogImage) d.imageUrl = ogImage;
        allDeals.push({ ...d, url: websiteUrl });
      });
    } catch { /* unreachable */ }
  }

  return dedup(allDeals, seen);
}

async function scrapePage(url, pageUrl) {
  const { data } = await axios.get(url, HTTP_OPTS);
  const $ = cheerio.load(data);
  const found = [];

  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null;

  // Promo-class elements
  PROMO_SELECTORS.forEach((sel) => {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!isValidDeal(text)) return;
      found.push({
        description: text,
        imageUrl: findNearbyImage($, el, pageUrl),
        confidence: 'high',
        source: 'website',
      });
    });
  });

  // Any element on a deals page — just needs a strong keyword
  $('p, li, h1, h2, h3, h4, div').each((_, el) => {
    if ($(el).children('p, div, ul, ol, section').length > 0) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!isValidDeal(text)) return;
    found.push({
      description: text,
      imageUrl: findNearbyImage($, el, pageUrl),
      confidence: 'medium',
      source: 'website',
    });
  });

  return { deals: dedupLocal(found).slice(0, 6), ogImage };
}

// Strict mode for main page: only trust promo-class elements
async function scrapePageStrictMode(url) {
  const { data } = await axios.get(url, HTTP_OPTS);
  const $ = cheerio.load(data);
  const found = [];

  const ogImage =
    $('meta[property="og:image"]').attr('content') ||
    $('meta[name="twitter:image"]').attr('content') ||
    null;

  PROMO_SELECTORS.forEach((sel) => {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (!isValidDeal(text)) return;
      found.push({
        description: text,
        imageUrl: findNearbyImage($, el, url),
        confidence: 'high',
        source: 'website',
      });
    });
  });

  return { deals: dedupLocal(found).slice(0, 4), ogImage };
}

function isValidDeal(text) {
  if (!text || text.length < 10 || text.length > 600) return false;

  const lower = text.toLowerCase();

  // Reject if any negative keyword is present
  if (NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw))) return false;

  // Must contain at least one strong keyword
  if (STRONG_KEYWORDS.some((kw) => lower.includes(kw))) return true;

  // OR: contains 2+ support keywords (e.g. "special offer", "exclusive deal")
  const supportCount = SUPPORT_KEYWORDS.filter((kw) => lower.includes(kw)).length;
  return supportCount >= 2;
}

function findNearbyImage($, el, pageUrl) {
  let node = $(el);
  for (let i = 0; i < 3; i++) {
    const img = node.find('img').first();
    if (img.length) {
      const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src');
      if (src) return resolveUrl(src, pageUrl);
    }
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
  try { return new URL(src, pageUrl).href; } catch { return null; }
}

function dedupLocal(deals) {
  const seen = new Set();
  return deals.filter((d) => {
    const key = d.description.substring(0, 50).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedup(deals, seen) {
  return deals.filter((d) => {
    const key = (d.description || '').substring(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
