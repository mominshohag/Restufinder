const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const placesService = require('../services/placesService');
const discountService = require('../services/discountService');
const menuService = require('../services/menuService');

const restaurantCache = new NodeCache({ stdTTL: 600 });
const discountCache = new NodeCache({ stdTTL: 1800 });
const menuCache = new NodeCache({ stdTTL: 3600 });
const enrichCache = new NodeCache({ stdTTL: 86400 });

// Tells the client which capabilities are available
router.get('/config', (_req, res) => {
  res.json({
    hasGooglePlaces: !!process.env.GOOGLE_PLACES_API_KEY,
    hasFacebook: !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET),
  });
});

// Restaurant list — only called when Google Places key is set (client falls back to Overpass otherwise)
router.get('/restaurants', async (req, res) => {
  const { lat, lng, radius = 2000 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const cacheKey = `${parseFloat(lat).toFixed(3)}_${parseFloat(lng).toFixed(3)}_${radius}`;
  const cached = restaurantCache.get(cacheKey);
  if (cached) return res.json({ restaurants: cached });

  try {
    const restaurants = await placesService.getNearbyRestaurants(
      parseFloat(lat), parseFloat(lng), parseInt(radius, 10)
    );
    restaurantCache.set(cacheKey, restaurants);
    res.json({ restaurants });
  } catch (err) {
    console.error('Restaurant fetch error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to fetch restaurants.' });
  }
});

// Google Places enrichment — must be defined BEFORE /:id routes
// Accepts ?placeId=... (Google restaurants) OR ?name=&lat=&lng= (OSM restaurants)
router.get('/restaurants/enrich', async (req, res) => {
  const { name, lat, lng, placeId } = req.query;
  if (!placeId && (!name || !lat || !lng)) {
    return res.status(400).json({ error: 'placeId or (name, lat, lng) required' });
  }

  const cacheKey = placeId
    ? `enrich_pid_${placeId}`
    : `enrich_${name}_${parseFloat(lat).toFixed(3)}_${parseFloat(lng).toFixed(3)}`;

  const cached = enrichCache.get(cacheKey);
  if (cached !== undefined) return res.json(cached);

  try {
    const details = await placesService.enrichRestaurant(
      name || '',
      lat ? parseFloat(lat) : 0,
      lng ? parseFloat(lng) : 0,
      placeId || null,
    );
    enrichCache.set(cacheKey, details || {});
    res.json(details || {});
  } catch (err) {
    console.error('Enrich error:', err.message);
    res.status(500).json({ error: 'Enrichment failed.' });
  }
});

// Discounts
router.get('/restaurants/:id/discounts', async (req, res) => {
  const { id } = req.params;
  const { website, facebookPage, restaurantName } = req.query;

  // Include website/fb in cache key so enriched calls get their own entry
  const cacheKey = `discounts_${id}_${website || ''}_${facebookPage || ''}`;
  const cached = discountCache.get(cacheKey);
  if (cached) return res.json({ discounts: cached });

  try {
    const discounts = await discountService.getDiscounts({
      website: website || null,
      facebookPage: facebookPage || null,
      restaurantName: restaurantName || null,
    });
    discountCache.set(cacheKey, discounts);
    res.json({ discounts });
  } catch (err) {
    console.error('Discount fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch discounts.' });
  }
});

// Menu — tries Google Places photos first, falls back to website scraping
router.get('/restaurants/:id/menu', async (req, res) => {
  const { id } = req.params;
  const { website, placeId } = req.query;

  const cacheKey = `menu_${placeId || id}`;
  const cached = menuCache.get(cacheKey);
  if (cached) return res.json({ items: cached });

  try {
    let items = [];

    // 1. Google Places photos (best source — real menu/food photos)
    if (placeId) {
      items = await menuService.getPhotosFromPlaces(placeId);
    }

    // 2. Fall back to website scraping if no photos found
    if (items.length === 0 && website) {
      items = await menuService.scrapeMenu(website);
    }

    menuCache.set(cacheKey, items);
    res.json({ items });
  } catch (err) {
    console.error('Menu error:', err.message);
    res.status(500).json({ error: 'Could not load menu.' });
  }
});

module.exports = router;
