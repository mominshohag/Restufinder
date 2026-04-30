const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function getNearbyRestaurants(lat, lng, radius = 2000) {
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|bistro)$"](around:${radius},${lat},${lng});
      way["amenity"~"^(restaurant|cafe|fast_food|bar|pub|food_court|bistro)$"](around:${radius},${lat},${lng});
    );
    out body;
    >;
    out skel qt;
  `;

  const { data } = await axios.post(OVERPASS_URL, query, {
    headers: { 'Content-Type': 'text/plain' },
    timeout: 35000,
  });

  const elements = (data.elements || []).filter((el) => el.tags?.name);

  return elements
    .map((el) => {
      const tags = el.tags;
      const location =
        el.lat != null
          ? { lat: el.lat, lng: el.lon }
          : el.center
          ? { lat: el.center.lat, lng: el.center.lon }
          : null;

      return {
        id: `osm_${el.type}_${el.id}`,
        name: tags.name,
        rating: null,
        reviewCount: null,
        address: formatAddress(tags),
        phone: tags.phone || tags['contact:phone'] || null,
        website: tags.website || tags['contact:website'] || null,
        photoUrl: null,
        priceLevel: parsePriceLevel(tags),
        isOpen: null,
        openingHours: null,
        location,
        cuisineTypes: tags.cuisine ? tags.cuisine.split(';').map((c) => c.trim()) : [],
        facebookPage: tags['contact:facebook'] || null,
        instagramPage: tags['contact:instagram'] || null,
        source: 'openstreetmap',
      };
    })
    .filter((r) => r.location)
    .slice(0, 30);
}

function formatAddress(tags) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:country']]
    .filter(Boolean)
    .join(', ') || null;
}

function parsePriceLevel(tags) {
  const map = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
  return map[tags.price_range] ?? null;
}

module.exports = { getNearbyRestaurants };
