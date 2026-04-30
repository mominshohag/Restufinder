import { useState, useCallback } from 'react';
import LocationPrompt from './components/LocationPrompt';
import RestaurantList from './components/RestaurantList';
import LoadingSpinner from './components/LoadingSpinner';

// In production the client is on Vercel and the server is on Render — different origins.
// Set VITE_API_URL on Vercel to your Render service URL (e.g. https://restufinder-api.onrender.com/api)
const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(2000);
  const [dataSource, setDataSource] = useState(null);

  const fetchRestaurants = useCallback(
    async (coords, searchRadius = radius) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/restaurants?lat=${coords.lat}&lng=${coords.lng}&radius=${searchRadius}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error ${res.status}`);
        }
        const data = await res.json();
        setRestaurants(data.restaurants || []);
        setDataSource(data.restaurants?.[0]?.source || 'unknown');
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
            <div className="flex items-center gap-3 text-sm text-gray-500">
              {dataSource === 'openstreetmap' && (
                <span className="hidden sm:inline bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                  OpenStreetMap
                </span>
              )}
              {dataSource === 'google' && (
                <span className="hidden sm:inline bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">
                  Google Places
                </span>
              )}
              <span className="text-gray-400 hidden md:inline">
                📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </span>
              <button
                onClick={() => {
                  setLocation(null);
                  setRestaurants([]);
                  setError(null);
                }}
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
          <LoadingSpinner message="Finding top restaurants near you…" />
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">😕</p>
            <p className="text-red-600 text-lg font-medium mb-2">Something went wrong</p>
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
        RestuFinder — restaurant data via{' '}
        {dataSource === 'google' ? 'Google Places' : 'OpenStreetMap'} · discounts scraped from
        public sources
      </footer>
    </div>
  );
}
