const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');
const placesService = require('../services/placesService');
const discountService = require('../services/discountService');

// Cache restaurant results for 10 minutes, discount results for 30 minutes
const restaurantCache = new NodeCache({ stdTTL: 600 });
const discountCache = new NodeCache({ stdTTL: 1800 });

router.get('/restaurants', async (req, res) => {
  const { lat, lng, radius = 2000 } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query params are required' });
  }

  // Round to 3 decimal places (~111m precision) for cache key
  const cacheKey = `${parseFloat(lat).toFixed(3)}_${parseFloat(lng).toFixed(3)}_${radius}`;
  const cached = restaurantCache.get(cacheKey);
  if (cached) return res.json({ restaurants: cached, cached: true });

  try {
    const restaurants = await placesService.getNearbyRestaurants(
      parseFloat(lat),
      parseFloat(lng),
      parseInt(radius, 10)
    );
    restaurantCache.set(cacheKey, restaurants);
    res.json({ restaurants });
  } catch (err) {
    console.error('Restaurant fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch restaurants. Please try again.' });
  }
});

router.get('/restaurants/:id/discounts', async (req, res) => {
  const { id } = req.params;
  const { website, facebookPage, restaurantName } = req.query;

  const cacheKey = `discounts_${id}`;
  const cached = discountCache.get(cacheKey);
  if (cached) return res.json({ discounts: cached, cached: true });

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

module.exports = router;
