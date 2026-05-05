const axios = require('axios');
const cheerio = require('cheerio');
const visionService = require('./visionService');

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const GRAPH = 'https://graph.facebook.com/v19.0';

// Caption keywords — used to pre-qualify posts for inclusion even without vision
const CAPTION_KEYWORDS = [
  'discount', 'offer', 'deal', 'special', 'promo', 'promotion',
  '% off', 'percent off', 'sale', 'coupon', 'voucher', 'code',
  'free', 'buy one', 'bogo', '2 for 1', 'get one', 'happy hour',
  'limited time', 'today only', 'flash sale', 'combo', 'cashback',
  'eid', 'ramadan', 'iftar', 'pohela', 'monday', 'tuesday',
  'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'grab', 'exclusive', 'save', 'flat', '৳ off', 'tk off',
];

let cachedToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: { client_id: APP_ID, client_secret: APP_SECRET, grant_type: 'client_credentials' },
    timeout: 8000,
  });
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

// ── Main entry point ─────────────────────────────────────────────────────────

async function findDiscounts(facebookPageUrl, restaurantName) {
  let posts = [];

  // 1. Try Graph API (works when FACEBOOK_APP_ID + FACEBOOK_APP_SECRET are set)
  if (APP_ID && APP_SECRET) {
    posts = await fetchViaGraphApi(facebookPageUrl, restaurantName);
  }

  // 2. Fallback: scrape the public mobile Facebook page
  if (posts.length === 0 && facebookPageUrl) {
    posts = await scrapePublicPage(facebookPageUrl);
  }

  if (posts.length === 0) return [];

  // 3. Analyse each post: caption keywords + Claude Vision on the image
  return buildDeals(posts);
}

// ── Graph API path ────────────────────────────────────────────────────────────

async function fetchViaGraphApi(facebookPageUrl, restaurantName) {
  try {
    const token = await getAppToken();
    let pageId = extractPageSlug(facebookPageUrl);
    if (!pageId && restaurantName) {
      pageId = await searchPageByName(restaurantName, token);
    }
    if (!pageId) return [];

    const FIELDS = 'message,story,created_time,full_picture,permalink_url,attachments{media,subattachments{media}}';

    // Try three endpoint variants — different ones work for different page types
    for (const endpoint of [
      `${GRAPH}/${pageId}/posts`,
      `${GRAPH}/${pageId}/feed`,
      `${GRAPH}/${pageId}?fields=posts.limit(25){${FIELDS}}`,
    ]) {
      try {
        const params = endpoint.includes('?fields=')
          ? { access_token: token }
          : { fields: FIELDS, limit: 25, access_token: token };

        const { data } = await axios.get(endpoint, { params, timeout: 12000 });
        const raw = data.posts?.data || data.data || [];
        if (raw.length > 0) {
          console.log(`Facebook: got ${raw.length} posts for ${pageId} via ${endpoint.split('/').pop().split('?')[0]}`);
          return raw.map(normalisePost);
        }
      } catch (err) {
        console.error(`Facebook Graph (${endpoint.split('/').pop().split('?')[0]}):`, err.response?.data?.error?.message || err.message);
      }
    }
    return [];
  } catch (err) {
    console.error('Facebook getAppToken:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

function normalisePost(raw) {
  const imageUrl =
    raw.full_picture ||
    raw.attachments?.data?.[0]?.media?.image?.src ||
    raw.attachments?.data?.[0]?.subattachments?.data?.[0]?.media?.image?.src ||
    null;
  return {
    caption: (raw.message || raw.story || '').trim(),
    imageUrl,
    postedAt: raw.created_time || null,
    url: raw.permalink_url || null,
    source: 'facebook',
  };
}

// ── Public page scrape fallback ───────────────────────────────────────────────

async function scrapePublicPage(facebookPageUrl) {
  try {
    const slug = extractPageSlug(facebookPageUrl);
    if (!slug) return [];

    const mobileUrl = `https://m.facebook.com/${slug}`;
    const { data } = await axios.get(mobileUrl, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const $ = cheerio.load(data);
    const posts = [];

    // Mobile Facebook wraps posts in div.story_body_container or similar
    $('div[data-ft], article, .story_body_container, ._5rgt').each((_, el) => {
      const caption = $(el).find('p, span[dir]').first().text().replace(/\s+/g, ' ').trim();
      const imgSrc = $(el).find('img[src*="scontent"]').first().attr('src') || null;
      if (caption || imgSrc) {
        posts.push({ caption, imageUrl: imgSrc, postedAt: null, url: `https://www.facebook.com/${slug}`, source: 'facebook' });
      }
    });

    console.log(`Facebook scrape: found ${posts.length} posts for ${slug}`);
    return posts.slice(0, 20);
  } catch (err) {
    console.error('Facebook scrape:', err.message);
    return [];
  }
}

// ── Deal extraction — caption keywords + Claude Vision ────────────────────────

async function buildDeals(posts) {
  const deals = [];

  // Run vision analysis in parallel (max 10 posts to keep latency reasonable)
  const targets = posts.slice(0, 10);

  const analysed = await Promise.all(
    targets.map(async (post) => {
      const captionHasDeal = captionMatchesDeal(post.caption);

      // Always run vision if image exists (offers are often image-only)
      let visionDescription = null;
      if (post.imageUrl) {
        visionDescription = await visionService.detectOfferInImage(post.imageUrl).catch(() => null);
      }

      const isDeal = captionHasDeal || !!visionDescription;
      if (!isDeal) return null;

      // Prefer vision description (more precise) but fall back to caption
      const description = visionDescription
        ? visionDescription + (post.caption ? `\n\n${post.caption}` : '')
        : post.caption;

      return {
        description,
        imageUrl: post.imageUrl,
        postedAt: post.postedAt,
        url: post.url,
        confidence: visionDescription ? 'high' : 'medium',
        source: 'facebook',
        detectedBy: visionDescription ? 'vision+caption' : 'caption',
      };
    })
  );

  for (const d of analysed) {
    if (d) deals.push(d);
    if (deals.length >= 8) break;
  }

  return deals;
}

function captionMatchesDeal(caption) {
  if (!caption) return false;
  const lower = caption.toLowerCase();
  return CAPTION_KEYWORDS.some((kw) => lower.includes(kw));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPageSlug(url) {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const { pathname } = new URL(normalized);
    const parts = pathname.split('/').filter(Boolean);
    return (parts[0] === 'pages' ? parts[2] : parts[0]) || null;
  } catch {
    return null;
  }
}

async function searchPageByName(name, token) {
  try {
    for (const q of [`${name} Bangladesh`, name]) {
      const { data } = await axios.get(`${GRAPH}/search`, {
        params: { q, type: 'page', fields: 'id,name', limit: 3, access_token: token },
        timeout: 6000,
      });
      const pages = data.data || [];
      if (pages.length > 0) {
        const exact = pages.find((p) =>
          p.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(p.name.toLowerCase())
        );
        return (exact || pages[0]).id;
      }
    }
    return null;
  } catch {
    return null;
  }
}

module.exports = { findDiscounts };
