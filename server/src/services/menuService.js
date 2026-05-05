const axios = require('axios');
const cheerio = require('cheerio');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const HTTP = {
  timeout: 8000,
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
  },
  maxRedirects: 4,
};

// Price patterns for text-based menu scraping
const PRICE_RE = /(?:৳|BDT|Tk\.?|Rs\.?|\$|€|£)\s*\d+(?:[.,]\d+)?|\d+\s*(?:\/\-|BDT|Tk)/i;
const MENU_SELECTORS = [
  '[class*="menu-item"]', '[class*="menu__item"]', '[class*="dish"]',
  '[class*="food-item"]', '[class*="item-name"]', '[class*="product-title"]',
  '[data-item-name]', '[class*="menu-card"]',
];

// ── Google Places photo gallery ──────────────────────────────────────────────

async function getPhotosFromPlaces(placeId) {
  if (!API_KEY || !placeId) return [];

  try {
    const { data } = await axios.get(`${PLACES_BASE}/details/json`, {
      params: {
        place_id: placeId,
        fields: 'photos',
        key: API_KEY,
      },
      timeout: 8000,
    });

    if (data.status !== 'OK' || !data.result?.photos?.length) return [];

    const all = data.result.photos;

    // Heuristic: very wide landscape photos (ratio > 1.8) are usually exterior/street
    // shots. Keep the rest — square and portrait are almost always food/menu photos.
    const foodLikely = all.filter((ph) => {
      if (!ph.width || !ph.height) return true;
      return ph.width / ph.height <= 1.8;
    });

    // Use filtered set; fall back to all photos if filtering leaves nothing
    const source = foodLikely.length > 0 ? foodLikely : all;

    return source.slice(0, 20).map((ph) => {
      // Strip HTML tags from attribution to get contributor name
      const rawAttr = ph.html_attributions?.[0] || '';
      const contributor = rawAttr.replace(/<[^>]+>/g, '').trim();
      return {
        name: null,           // no item name available from the photo API
        contributor,          // "Uploaded by: John Doe" shown as subtle caption
        description: null,
        price: null,
        category: 'mapPhoto',
        image: `${PLACES_BASE}/photo?maxwidth=800&photoreference=${ph.photo_reference}&key=${API_KEY}`,
        isPhoto: true,
      };
    });
  } catch {
    return [];
  }
}

// ── Website menu scraping (fallback when no Google Places key) ───────────────

async function scrapeMenu(websiteUrl) {
  if (!websiteUrl) return [];

  const results = [];

  try {
    const { data: html } = await axios.get(websiteUrl, HTTP);
    const $ = cheerio.load(html);

    const jsonld = extractJsonLd($);
    if (jsonld.length > 0) return jsonld;

    const selectorItems = extractBySelectors($, websiteUrl);
    if (selectorItems.length > 0) return selectorItems;

    results.push(...extractByPricePattern($));
  } catch {
    // site unreachable
  }

  if (results.length === 0) {
    const base = (() => { try { return new URL(websiteUrl).origin; } catch { return null; } })();
    if (base) {
      for (const path of ['/menu', '/food-menu', '/our-menu', '/meals']) {
        try {
          const { data: html } = await axios.get(base + path, HTTP);
          const $ = cheerio.load(html);
          const items = [...extractBySelectors($, base + path), ...extractByPricePattern($)];
          if (items.length > 0) return items.slice(0, 20);
        } catch { /* ignore */ }
      }
    }
  }

  return results.slice(0, 20);
}

function extractJsonLd($) {
  const items = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw = $(el).html();
      const data = JSON.parse(raw);
      const entries = Array.isArray(data) ? data : [data];
      for (const entry of entries) {
        if (entry.hasMenu && typeof entry.hasMenu === 'object') {
          extractMenuFromSchema(entry.hasMenu, items);
        }
        if (entry['@type'] === 'Menu') {
          extractMenuFromSchema(entry, items);
        }
        if (entry['@type'] === 'ItemList' && entry.itemListElement) {
          for (const item of entry.itemListElement) {
            if (item.name) {
              items.push({
                name: item.name,
                description: item.description || null,
                price: item.offers?.price
                  ? `${item.offers.priceCurrency || ''}${item.offers.price}`
                  : null,
                image: item.image || null,
              });
            }
          }
        }
      }
    } catch { /* malformed JSON-LD */ }
  });
  return items;
}

function extractMenuFromSchema(menu, out) {
  if (!menu) return;
  const sections = menu.hasMenuSection || menu.menuSection || [];
  for (const section of Array.isArray(sections) ? sections : [sections]) {
    const items = section.hasMenuItem || section.menuItem || [];
    for (const item of Array.isArray(items) ? items : [items]) {
      if (!item.name) continue;
      out.push({
        name: item.name,
        description: item.description || null,
        price: item.offers?.price
          ? `${item.offers.priceCurrency || ''}${item.offers.price}`
          : null,
        image: typeof item.image === 'string' ? item.image : item.image?.url || null,
        category: section.name || null,
      });
    }
  }
}

function extractBySelectors($, url) {
  const items = [];
  const seen = new Set();
  MENU_SELECTORS.forEach((sel) => {
    $(sel).each((_, el) => {
      const name = $(el).find('[class*="name"], h3, h4, strong').first().text().trim()
        || $(el).text().trim().split('\n')[0].trim();
      if (!name || name.length > 80 || seen.has(name)) return;
      const priceEl = $(el).find('[class*="price"]').first().text().trim()
        || $(el).text().match(PRICE_RE)?.[0];
      seen.add(name);
      items.push({ name, price: priceEl || null, description: null, image: null });
    });
  });
  return items;
}

function extractByPricePattern($) {
  const items = [];
  const seen = new Set();
  $('tr, li, p, div').each((_, el) => {
    const text = $(el).clone().children().remove().end().text().trim();
    if (!text || text.length > 100 || !PRICE_RE.test(text)) return;
    const price = text.match(PRICE_RE)?.[0];
    const name = text.replace(PRICE_RE, '').replace(/[.\-–:]+$/, '').trim();
    if (!name || name.length < 3 || seen.has(name)) return;
    seen.add(name);
    items.push({ name, price: price || null, description: null, image: null });
  });
  return items;
}

module.exports = { scrapeMenu, getPhotosFromPlaces };
