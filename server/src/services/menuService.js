const axios = require('axios');
const cheerio = require('cheerio');

const HTTP = {
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; RestuFinder/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  maxRedirects: 4,
};

// Price patterns: $12.99  ৳250  BDT 300  Tk.150  120/-
const PRICE_RE = /(?:৳|BDT|Tk\.?|Rs\.?|\$|€|£)\s*\d+(?:[.,]\d+)?|\d+\s*(?:\/\-|BDT|Tk)/i;
const MENU_SELECTORS = [
  '[class*="menu-item"]', '[class*="menu__item"]', '[class*="dish"]',
  '[class*="food-item"]', '[class*="item-name"]', '[class*="product-title"]',
  '[data-item-name]', '[class*="menu-card"]',
];

async function scrapeMenu(websiteUrl) {
  if (!websiteUrl) return [];

  const results = [];

  // 1. Try to find JSON-LD structured data
  try {
    const { data: html } = await axios.get(websiteUrl, HTTP);
    const $ = cheerio.load(html);
    const jsonld = extractJsonLd($);
    if (jsonld.length > 0) return jsonld;

    // 2. Try CSS selector approach
    const selectorItems = extractBySelectors($, websiteUrl);
    if (selectorItems.length > 0) return selectorItems;

    // 3. Try scanning for price patterns near text
    const priceItems = extractByPricePattern($);
    results.push(...priceItems);
  } catch {
    // site unreachable
  }

  // 4. Try common menu sub-pages
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
        // Restaurant or FoodEstablishment with hasMenu
        if (entry.hasMenu && typeof entry.hasMenu === 'object') {
          extractMenuFromSchema(entry.hasMenu, items);
        }
        if (entry['@type'] === 'Menu') {
          extractMenuFromSchema(entry, items);
        }
        // ItemList of food items
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

module.exports = { scrapeMenu };
