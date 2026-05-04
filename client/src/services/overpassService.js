// Calls Overpass (OpenStreetMap) directly from the browser.
// Overpass allows browser requests but blocks cloud-server IPs (Render, AWS etc),
// so we must not proxy this through the backend.

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const PRICE_MAP = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

export async function getNearbyRestaurants(lat, lng, radius = 2000) {
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

  let lastError;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: query,
        signal: AbortSignal.timeout(35000),
      });
      if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
      const data = await res.json();
      return parseElements(data.elements || []);
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(lastError?.message || 'Could not reach map data. Please try again.');
}

function parseElements(elements) {
  return elements
    .filter((el) => el.tags?.name)
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
        priceLevel: PRICE_MAP[tags.price_range] ?? null,
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
    .slice(0, 40);
}

function formatAddress(tags) {
  return (
    [tags['addr:housenumber'], tags['addr:street'], tags['addr:city'], tags['addr:country']]
      .filter(Boolean)
      .join(', ') || null
  );
}
