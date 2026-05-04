const axios = require('axios');

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const GRAPH = 'https://graph.facebook.com/v19.0';

// Broad keyword list — English + Bangladesh restaurant-specific terms
const DEAL_KEYWORDS = [
  // English generic
  'discount', 'offer', 'deal', 'special', 'promo', 'promotion',
  '% off', 'percent off', 'sale', 'coupon', 'voucher', 'code',
  'free', 'complimentary', 'save', 'reduced', 'half price',
  'buy one', 'bogo', '2 for 1', 'two for one', 'get one',
  'happy hour', 'limited time', 'today only', 'flash sale',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday',
  'saturday', 'sunday', 'weekend', 'weekday',
  // Food-specific
  'combo', 'meal deal', 'value meal', 'set meal', 'platter deal',
  'family deal', 'student discount', 'cashback', 'flat', 'tk off',
  '৳ off', 'taka off',
  // Bangladesh / South Asia seasonal
  'eid', 'ramadan', 'iftar', 'sehri', 'pohela boishakh', 'puja',
  'new year', 'winter special', 'summer special', 'monsoon',
  // Urgency / action
  'grab', 'hurry', 'don\'t miss', 'exclusive', 'member',
  'loyalty', 'reward', 'redeem',
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

async function findDiscounts(facebookPageUrl, restaurantName) {
  if (!APP_ID || !APP_SECRET) return [];

  try {
    const token = await getAppToken();

    // Resolve page identifier — prefer slug from URL, fall back to search
    let pageId = extractPageSlug(facebookPageUrl);
    if (!pageId && restaurantName) {
      pageId = await searchPageByName(restaurantName, token);
    }
    if (!pageId) return [];

    // Fetch recent posts with all image + permalink fields
    const { data } = await axios.get(`${GRAPH}/${pageId}/posts`, {
      params: {
        fields: [
          'message',
          'story',
          'created_time',
          'full_picture',
          'permalink_url',
          'attachments{media,subattachments{media}}',
        ].join(','),
        limit: 30,
        access_token: token,
      },
      timeout: 10000,
    });

    const posts = data.data || [];
    const deals = [];

    for (const post of posts) {
      const text = (post.message || post.story || '').trim();
      if (!text) continue;

      const lower = text.toLowerCase();
      if (!DEAL_KEYWORDS.some((kw) => lower.includes(kw))) continue;

      // Pick the best image available
      const imageUrl =
        post.full_picture ||
        post.attachments?.data?.[0]?.media?.image?.src ||
        post.attachments?.data?.[0]?.subattachments?.data?.[0]?.media?.image?.src ||
        null;

      deals.push({
        description: text,
        imageUrl,
        postedAt: post.created_time,
        // Use the exact post permalink when available, fall back to page URL
        url: post.permalink_url || `https://www.facebook.com/${pageId}`,
        confidence: 'high',
        source: 'facebook',
      });

      if (deals.length >= 8) break;
    }

    return deals;
  } catch (err) {
    const msg = err.response?.data?.error?.message || err.message;
    console.error('Facebook API error:', msg);
    return [];
  }
}

function extractPageSlug(url) {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const { pathname } = new URL(normalized);
    // Strip trailing slash, query params already removed by URL parser
    const parts = pathname.split('/').filter(Boolean);
    // Facebook URLs: /pageName or /pages/pageName/id
    const slug = parts[0] === 'pages' ? parts[2] : parts[0];
    return slug || null;
  } catch {
    return null;
  }
}

async function searchPageByName(name, token) {
  try {
    // Try with "Bangladesh" appended for better geo-match
    for (const query of [`${name} Bangladesh`, name]) {
      const { data } = await axios.get(`${GRAPH}/search`, {
        params: { q: query, type: 'page', fields: 'id,name', limit: 3, access_token: token },
        timeout: 6000,
      });
      const pages = data.data || [];
      if (pages.length > 0) {
        // Pick the page whose name most closely matches
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
