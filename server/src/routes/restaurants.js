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
router.get('/restaurants/enrich', async (req, res) => {
  const { name, lat, lng } = req.query;
  if (!name || !lat || !lng) return res.status(400).json({ error: 'name, lat, lng required' });

  const cacheKey = `enrich_${name}_${parseFloat(lat).toFixed(3)}_${parseFloat(lng).toFixed(3)}`;
  const cached = enrichCache.get(cacheKey);
  if (cached !== undefined) return res.json(cached);

  try {
    const details = await placesService.enrichRestaurant(name, parseFloat(lat), parseFloat(lng));
    enrichCache.set(cacheKey, details);
    res.json(details);
  } catch (err) {
    console.error('Enrich error:', err.message);
    res.status(500).json({ error: 'Enrichment failed.' });
  }
});

// Discounts
router.get('/restaurants/:id/discounts', async (req, res) => {
  const { id } = req.params;
  const { website, facebookPage, restaurantName } = req.query;

  const cacheKey = `discounts_${id}`;
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

// Menu scraping
router.get('/restaurants/:id/menu', async (req, res) => {
  const { id } = req.params;
  const { website } = req.query;

  const cacheKey = `menu_${id}`;
  const cached = menuCache.get(cacheKey);
  if (cached) return res.json({ items: cached });

  try {
    const items = await menuService.scrapeMenu(website || null);
    menuCache.set(cacheKey, items);
    res.json({ items });
  } catch (err) {
    console.error('Menu scrape error:', err.message);
    res.status(500).json({ error: 'Could not scrape menu.' });
  }
});

module.exports = router;
