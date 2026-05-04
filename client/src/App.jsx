import { useState, useCallback } from 'react';
import LocationPrompt from './components/LocationPrompt';
import RestaurantList from './components/RestaurantList';
import LoadingSpinner from './components/LoadingSpinner';
import { getNearbyRestaurants } from './services/overpassService.js';

// Backend is only used for discount scraping (needs server-side for CORS/scraping).
// Restaurant data is fetched directly from Overpass API in the browser —
// Overpass blocks cloud-server IPs (Render/AWS) but allows browser requests.
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(2000);

  const fetchRestaurants = useCallback(
    async (coords, searchRadius = radius) => {
      setLoading(true);
      setError(null);
      try {
        const results = await getNearbyRestaurants(coords.lat, coords.lng, searchRadius);
        setRestaurants(results);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [radius]
  );

  const handleLocationGranted = useCallback(
    (coords) => {
      setLocation(coords);
      fetchRestaurants(coords, radius);
    },
    [fetchRestaurants, radius]
  );

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (location) fetchRestaurants(location, newRadius);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-2xl" role="img" aria-label="restaurant">🍽️</span>
            <span className="font-bold text-xl text-gray-900 tracking-tight">RestuFinder</span>
          </div>

          {location && !loading && (
            <div className="flex items-center gap-3 text-sm">
              {location.label && (
                <span className="text-gray-700 font-medium text-sm hidden sm:inline">
                  📍 {location.label}
                </span>
              )}
              <span className="hidden sm:inline bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                OpenStreetMap
              </span>
              <button
                onClick={() => { setLocation(null); setRestaurants([]); setError(null); }}
                className="text-xs text-orange-500 hover:text-orange-700 underline"
              >
                Change location
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {!location ? (
          <LocationPrompt onLocationGranted={handleLocationGranted} />
        ) : loading ? (
          <LoadingSpinner message="Finding restaurants near you…" />
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">😕</p>
            <p className="text-red-600 text-lg font-medium mb-2">Could not load restaurants</p>
            <p className="text-gray-500 mb-6">{error}</p>
            <button
              onClick={() => fetchRestaurants(location, radius)}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <RestaurantList
            restaurants={restaurants}
            location={location}
            radius={radius}
            onRadiusChange={handleRadiusChange}
            onRefresh={() => fetchRestaurants(location, radius)}
          />
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
        RestuFinder — restaurant data via OpenStreetMap · discounts scraped from public sources
        <span className="ml-2 text-gray-300">v1.2</span>
      </footer>
    </div>
  );
}
