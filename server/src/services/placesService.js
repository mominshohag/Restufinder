const axios = require('axios');
const scraperService = require('./scraperService');
const overpassService = require('./overpassService');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

async function getNearbyRestaurants(lat, lng, radius = 2000) {
  if (API_KEY) {
    return getFromGooglePlaces(lat, lng, radius);
  }
  return overpassService.getNearbyRestaurants(lat, lng, radius);
}

async function getFromGooglePlaces(lat, lng, radius) {
  const { data } = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
    params: {
      location: `${lat},${lng}`,
      radius,
      type: 'restaurant',
      key: API_KEY,
    },
  });

  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK') {
    throw new Error(`Google Places API error: ${data.status} — ${data.error_message || ''}`);
  }

  // Fetch details for the top 20 results in parallel
  const settled = await Promise.allSettled(
    data.results.slice(0, 20).map((p) => getPlaceDetails(p.place_id))
  );

  return settled
    .filter((r) => r.status === 'fulfilled' && r.value)
    .map((r) => r.value)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

async function getPlaceDetails(placeId) {
  const { data } = await axios.get(`${PLACES_BASE}/details/json`, {
    params: {
      place_id: placeId,
      fields: [
        'place_id', 'name', 'rating', 'user_ratings_total',
        'formatted_address', 'website', 'photos', 'price_level',
        'opening_hours', 'geometry', 'types', 'formatted_phone_number',
      ].join(','),
      key: API_KEY,
    },
  });

  if (data.status !== 'OK') return null;
  const p = data.result;

  const photoUrl =
    p.photos && p.photos[0]
      ? `${PLACES_BASE}/photo?maxwidth=600&photoreference=${p.photos[0].photo_reference}&key=${API_KEY}`
      : null;

  // Attempt to extract social links from the restaurant's own website
  let socialLinks = {};
  if (p.website) {
    socialLinks = await scraperService.extractSocialMediaLinks(p.website).catch(() => ({}));
  }

  return {
    id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    reviewCount: p.user_ratings_total ?? null,
    address: p.formatted_address ?? null,
    phone: p.formatted_phone_number ?? null,
    website: p.website ?? null,
    photoUrl,
    priceLevel: p.price_level ?? null,
    isOpen: p.opening_hours?.open_now ?? null,
    openingHours: p.opening_hours?.weekday_text ?? null,
    location: p.geometry?.location ?? null,
    cuisineTypes: (p.types || []).filter(
      (t) => !['establishment', 'food', 'point_of_interest', 'restaurant'].includes(t)
    ),
    source: 'google',
    ...socialLinks,
  };
}

module.exports = { getNearbyRestaurants };
