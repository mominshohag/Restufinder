import { useState, useCallback, useEffect } from 'react';
import LocationPrompt from './components/LocationPrompt';
import RestaurantList from './components/RestaurantList';
import LoadingSpinner from './components/LoadingSpinner';
import { getNearbyRestaurants } from './services/overpassService.js';

// Backend is used for: Google Places restaurants (if key set), discounts, menu scraping.
// VITE_API_URL must be set on Vercel to your Render URL e.g. https://restufinder.onrender.com/api
export const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function App() {
  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(2000);
  const [backendConfig, setBackendConfig] = useState(null); // { hasGooglePlaces, hasFacebook }
  const [dataSource, setDataSource] = useState('');

  // Check what the backend supports on first load
  useEffect(() => {
    fetch(`${API_BASE}/config`)
      .then((r) => r.json())
      .then((cfg) => setBackendConfig(cfg))
      .catch(() => setBackendConfig({ hasGooglePlaces: false, hasFacebook: false }));
  }, []);

  const fetchRestaurants = useCallback(
    async (coords, searchRadius = radius) => {
      setLoading(true);
      setError(null);

      try {
        let results;

        if (backendConfig?.hasGooglePlaces) {
          // Use backend → Google Places (rich data: photos, ratings, hours, website)
          const res = await fetch(
            `${API_BASE}/restaurants?lat=${coords.lat}&lng=${coords.lng}&radius=${searchRadius}`
          );
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Server error ${res.status}`);
          }
          const data = await res.json();
          results = data.restaurants || [];
          setDataSource('google');
        } else {
          // Fall back to Overpass directly from browser (no API key needed)
          results = await getNearbyRestaurants(coords.lat, coords.lng, searchRadius);
          setDataSource('openstreetmap');
        }

        setRestaurants(results);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [radius, backendConfig]
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
            <span className="text-2xl">🍽️</span>
            <span className="font-bold text-xl text-gray-900 tracking-tight">RestuFinder</span>
          </div>

          {location && !loading && (
            <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
              {location.label && (
                <span className="text-gray-700 font-medium hidden sm:inline">📍 {location.label}</span>
              )}
              {dataSource === 'google' && (
                <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200 hidden sm:inline">
                  Google Places
                </span>
              )}
              {dataSource === 'openstreetmap' && (
                <span className="bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full border border-amber-200 hidden sm:inline">
                  OpenStreetMap
                </span>
              )}
              <button
                onClick={() => { setLocation(null); setRestaurants([]); setError(null); }}
                className="text-xs text-orange-500 hover:text-orange-700 underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {backendConfig === null ? (
          <LoadingSpinner message="Connecting…" />
        ) : !location ? (
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
          <>
            {dataSource === 'openstreetmap' && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <strong>Limited data mode</strong> — Using free OpenStreetMap which has sparse data for Bangladesh (names only, no photos/hours/ratings).
                {' '}<strong>Add a Google Places API key</strong> on Render to unlock full restaurant details, photos, ratings, opening hours, and enable discount + menu detection.
              </div>
            )}
            <RestaurantList
              restaurants={restaurants}
              location={location}
              radius={radius}
              onRadiusChange={handleRadiusChange}
              onRefresh={() => fetchRestaurants(location, radius)}
              dataSource={dataSource}
              backendConfig={backendConfig}
            />
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
        RestuFinder · data via {dataSource === 'google' ? 'Google Places' : 'OpenStreetMap'}
        <span className="ml-2 text-gray-300">v1.4</span>
      </footer>
    </div>
  );
}
