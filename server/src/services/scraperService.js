const axios = require('axios');
const cheerio = require('cheerio');

const HTTP_OPTS = {
  timeout: 7000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (compatible; RestuFinder/1.0; +https://github.com/mominshohag/restufinder)',
    Accept: 'text/html,application/xhtml+xml',
  },
  maxRedirects: 5,
};

const DISCOUNT_KEYWORDS = [
  'discount', 'offer', 'deal', 'special', 'promo', 'promotion',
  'coupon', 'happy hour', 'sale', '% off', 'percent off',
  'buy one get one', 'bogo', '2 for 1', 'two for one',
  'free', 'complimentary', 'save', 'reduced', 'half price',
  'limited time', 'today only', 'weekend special', 'lunch deal',
];

const DISCOUNT_SELECTORS = [
  '[class*="promo"]', '[class*="discount"]', '[class*="offer"]',
  '[class*="deal"]', '[class*="special"]', '[class*="coupon"]',
  '[id*="promo"]', '[id*="discount"]', '[id*="offer"]',
  '[id*="deal"]', '[id*="special"]',
];

const DISCOUNT_PATHS = [
  '/deals', '/offers', '/specials', '/promotions', '/discounts',
  '/happy-hour', '/specials', '/coupons', '/menu-specials',
];

async function findDiscountsOnWebsite(websiteUrl) {
  const allDiscounts = [];
  const seen = new Set();

  // Scrape main page
  try {
    const main = await scrapePage(websiteUrl);
    main.forEach((d) => allDiscounts.push({ ...d, url: websiteUrl }));
  } catch {
    // Site unreachable
  }

  // Scrape common discount sub-pages
  let base;
  try {
    base = new URL(websiteUrl).origin;
  } catch {
    return allDiscounts;
  }

  const subResults = await Promise.allSettled(
    DISCOUNT_PATHS.map((path) =>
      scrapePage(base + path).then((ds) => ds.map((d) => ({ ...d, url: base + path })))
    )
  );
  subResults
    .filter((r) => r.status === 'fulfilled')
    .forEach((r) => allDiscounts.push(...r.value));

  // Deduplicate by first 60 chars of description
  return allDiscounts.filter((d) => {
    const key = d.description.substring(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function scrapePage(url) {
  const { data } = await axios.get(url, HTTP_OPTS);
  const $ = cheerio.load(data);
  const found = [];

  // High-confidence: elements with promo/discount-related classes or IDs
  DISCOUNT_SELECTORS.forEach((sel) => {
    $(sel).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, ' ').trim();
      if (text.length >= 15 && text.length <= 500) {
        found.push({ description: text, confidence: 'high' });
      }
    });
  });

  // Medium-confidence: text nodes containing discount keywords
  $('p, li, h2, h3, h4, span').each((_, el) => {
    if ($(el).children('p, div, ul, ol').length > 0) return; // skip non-leaf containers
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 15 || text.length > 400) return;
    const lower = text.toLowerCase();
    if (DISCOUNT_KEYWORDS.some((kw) => lower.includes(kw))) {
      found.push({ description: text, confidence: 'medium' });
    }
  });

  return found.slice(0, 6);
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
