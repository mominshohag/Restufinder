require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const restaurantRoutes = require('./routes/restaurants');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    message: { error: 'Too many requests, please slow down.' },
  })
);

app.use('/api', restaurantRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  const usingGooglePlaces = !!process.env.GOOGLE_PLACES_API_KEY;
  const usingFacebook = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
  console.log(`RestuFinder server running on port ${PORT}`);
  console.log(`  Restaurant data: ${usingGooglePlaces ? 'Google Places API' : 'OpenStreetMap (Overpass) — free'}`);
  console.log(`  Facebook discounts: ${usingFacebook ? 'enabled' : 'disabled (set FACEBOOK_APP_ID + FACEBOOK_APP_SECRET)'}`);
});
