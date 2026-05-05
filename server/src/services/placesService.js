const axios = require('axios');
const overpassService = require('./overpassService');

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const PLACES_BASE = 'https://maps.googleapis.com/maps/api/place';

const EXCLUDED_TYPES = new Set([
  'establishment', 'food', 'point_of_interest', 'restaurant', 'store',
]);

async function getNearbyRestaurants(lat, lng, radius = 2000) {
  if (API_KEY) return getFromGooglePlaces(lat, lng, radius);
  return overpassService.getNearbyRestaurants(lat, lng, radius);
}

// Fast path — single nearbysearch call, no per-restaurant detail fetches
async function getFromGooglePlaces(lat, lng, radius) {
  const { data } = await axios.get(`${PLACES_BASE}/nearbysearch/json`, {
    params: {
      location: `${lat},${lng}`,
      radius,
      type: 'restaurant',
      key: API_KEY,
    },
    timeout: 10000,
  });

  if (data.status === 'ZERO_RESULTS') return [];
  if (data.status !== 'OK') {
    throw new Error(`Google Places error: ${data.status} — ${data.error_message || ''}`);
  }

  return data.results
    .slice(0, 20)
    .map(mapNearbyResult)
    .filter(Boolean)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0));
}

// Map a nearbysearch result to our restaurant shape.
// website/phone/weekday_text are NOT available here — fetched lazily when the
// user opens the modal (via /restaurants/enrich?placeId=...).
function mapNearbyResult(p) {
  if (!p.place_id) return null;
  const photoRef = p.photos?.[0]?.photo_reference;
  return {
    id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    reviewCount: p.user_ratings_total ?? null,
    address: p.vicinity ?? null,
    phone: null,
    website: null,
    photoUrl: photoRef
      ? `${PLACES_BASE}/photo?maxwidth=600&photoreference=${photoRef}&key=${API_KEY}`
      : null,
    priceLevel: p.price_level ?? null,
    isOpen: p.opening_hours?.open_now ?? null,
    openingHours: null,
    location: p.geometry?.location
      ? { lat: p.geometry.location.lat, lng: p.geometry.location.lng }
      : null,
    cuisineTypes: (p.types || []).filter((t) => !EXCLUDED_TYPES.has(t)),
    source: 'google',
    needsDetails: true, // signals modal to fetch full details on open
  };
}

// Full details for a single place — called only when the modal opens.
// Social-link scraping removed: discovered lazily by discountService instead.
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
    timeout: 8000,
  });

  if (data.status !== 'OK') return null;
  const p = data.result;

  const photoRef = p.photos?.[0]?.photo_reference;
  return {
    id: p.place_id,
    name: p.name,
    rating: p.rating ?? null,
    reviewCount: p.user_ratings_total ?? null,
    address: p.formatted_address ?? null,
    phone: p.formatted_phone_number ?? null,
    website: p.website ?? null,
    photoUrl: photoRef
      ? `${PLACES_BASE}/photo?maxwidth=600&photoreference=${photoRef}&key=${API_KEY}`
      : null,
    priceLevel: p.price_level ?? null,
    isOpen: p.opening_hours?.open_now ?? null,
    openingHours: p.opening_hours?.weekday_text ?? null,
    location: p.geometry?.location ?? null,
    cuisineTypes: (p.types || []).filter((t) => !EXCLUDED_TYPES.has(t)),
    source: 'google',
    needsDetails: false,
  };
}

// Enrich a restaurant with full Google Places details.
// Accepts either a placeId directly (Google restaurants) or name+lat+lng (OSM).
async function enrichRestaurant(name, lat, lng, placeId = null) {
  if (!API_KEY) return null;

  try {
    let targetId = placeId;

    if (!targetId) {
      const { data } = await axios.get(`${PLACES_BASE}/findplacefromtext/json`, {
        params: {
          input: name,
          inputtype: 'textquery',
          locationbias: `circle:500@${lat},${lng}`,
          fields: 'place_id,name',
          key: API_KEY,
        },
        timeout: 6000,
      });
      if (!data.candidates?.length) return null;
      targetId = data.candidates[0].place_id;
    }

    return await getPlaceDetails(targetId);
  } catch {
    return null;
  }
}

module.exports = { getNearbyRestaurants, enrichRestaurant };
