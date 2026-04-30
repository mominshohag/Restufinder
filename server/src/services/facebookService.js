const axios = require('axios');

const APP_ID = process.env.FACEBOOK_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const GRAPH = 'https://graph.facebook.com/v19.0';

const DISCOUNT_KEYWORDS = [
  'discount', 'offer', 'deal', 'special', 'promo', '% off',
  'free', 'happy hour', 'save', 'limited time', 'today only',
  'bogo', 'buy one', 'half price',
];

let cachedToken = null;
let tokenExpiry = 0;

async function getAppToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const { data } = await axios.get(`${GRAPH}/oauth/access_token`, {
    params: { client_id: APP_ID, client_secret: APP_SECRET, grant_type: 'client_credentials' },
  });
  cachedToken = data.access_token;
  // App tokens are long-lived; refresh every 50 days to be safe
  tokenExpiry = Date.now() + 50 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function findDiscounts(facebookPageUrl, restaurantName) {
  if (!APP_ID || !APP_SECRET) return [];

  try {
    const token = await getAppToken();
    let pageId = extractPageSlug(facebookPageUrl);

    if (!pageId && restaurantName) {
      pageId = await searchPageByName(restaurantName, token);
    }
    if (!pageId) return [];

    const { data } = await axios.get(`${GRAPH}/${pageId}/posts`, {
      params: {
        fields: 'message,story,created_time,full_picture',
        limit: 20,
        access_token: token,
      },
    });

    return (data.data || [])
      .filter((post) => {
        const text = (post.message || post.story || '').toLowerCase();
        return DISCOUNT_KEYWORDS.some((kw) => text.includes(kw));
      })
      .map((post) => ({
        description: post.message || post.story || 'Facebook promotion',
        imageUrl: post.full_picture || null,
        postedAt: post.created_time,
        url: `https://www.facebook.com/${pageId}`,
        confidence: 'high',
      }))
      .slice(0, 5);
  } catch (err) {
    console.error('Facebook API error:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

function extractPageSlug(url) {
  if (!url) return null;
  try {
    const normalized = url.startsWith('http') ? url : `https://${url}`;
    const { pathname } = new URL(normalized);
    const slug = pathname.split('/').filter(Boolean)[0];
    return slug || null;
  } catch {
    return null;
  }
}

async function searchPageByName(name, token) {
  try {
    const { data } = await axios.get(`${GRAPH}/search`, {
      params: { q: name, type: 'page', fields: 'id,name', limit: 1, access_token: token },
    });
    return data.data?.[0]?.id || null;
  } catch {
    return null;
  }
}

module.exports = { findDiscounts };
