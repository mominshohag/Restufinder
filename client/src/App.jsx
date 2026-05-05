import { useState, useCallback, useEffect, useRef, Component } from 'react';
import LocationPrompt from './components/LocationPrompt';
import RestaurantList from './components/RestaurantList';
import LoadingSpinner from './components/LoadingSpinner';
import { getNearbyRestaurants } from './services/overpassService.js';
import { API_BASE } from './config.js';

// Catches any render crash and shows a readable message instead of blank screen
class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8 text-center">
          <div>
            <p className="text-4xl mb-4">⚠️</p>
            <p className="text-red-600 font-semibold text-lg mb-2">Something crashed</p>
            <p className="text-gray-500 text-sm mb-4">{this.state.error.message}</p>
            <button onClick={() => window.location.reload()}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RestuFinderApp() {
  const [location, setLocation] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [radius, setRadius] = useState(2000);
  const [dataSource, setDataSource] = useState('');

  // Use a ref so fetchRestaurants always reads the latest config without needing it as a dep
  const configRef = useRef({ hasGooglePlaces: false, hasFacebook: false });

  // Fetch config in background — UI shows immediately without waiting
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    fetch(`${API_BASE}/config`, { signal: controller.signal })
      .then((r) => r.json())
      .then((cfg) => { configRef.current = cfg; })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  }, []);

  const fetchRestaurants = useCallback(
    async (coords, searchRadius) => {
      setLoading(true);
      setError(null);
      setRestaurants([]);

      try {
        const cfg = configRef.current;
        let results = [];

        if (cfg.hasGooglePlaces) {
          const res = await fetch(
            `${API_BASE}/restaurants?lat=${coords.lat}&lng=${coords.lng}&radius=${searchRadius}`
          );
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || `Server error ${res.status}`);
          results = body.restaurants || [];
          setDataSource('google');
        } else {
          results = await getNearbyRestaurants(coords.lat, coords.lng, searchRadius);
          setDataSource('openstreetmap');
        }

        setRestaurants(results);
      } catch (err) {
        setError(err.message || 'Failed to load restaurants. Please retry.');
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

  const handleChangeLocation = useCallback(
    (coords) => {
      setLocation(coords);
      fetchRestaurants(coords, radius);
    },
    [fetchRestaurants, radius]
  );

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <button
            className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
            onClick={() => { setLocation(null); setRestaurants([]); setError(null); setDataSource(''); }}
            title="Go to home"
          >
            <span className="text-2xl">🍽️</span>
            <span className="font-bold text-xl text-gray-900 tracking-tight">RestuFinder</span>
          </button>
          {location && !loading && (
            <div className="flex items-center gap-2 text-sm flex-wrap justify-end">
              {location.label && (
                <span className="text-gray-700 font-medium hidden sm:inline">📍 {location.label}</span>
              )}
              <button
                onClick={() => { setLocation(null); setRestaurants([]); setError(null); setDataSource(''); }}
                className="text-xs text-orange-500 hover:text-orange-700 underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {!location ? (
          <LocationPrompt onLocationGranted={handleLocationGranted} />
        ) : loading ? (
          <LoadingSpinner message="Finding restaurants near you…" />
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-4">😕</p>
            <p className="text-red-600 text-lg font-medium mb-2">Could not load restaurants</p>
            <p className="text-gray-500 mb-2 text-sm">{error}</p>
            <p className="text-gray-400 text-xs mb-6">
              If the server is waking up this can take 30 s — please retry.
            </p>
            <button
              onClick={() => fetchRestaurants(location, radius)}
              className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {dataSource === 'openstreetmap' && (
              <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <strong>Limited data mode</strong> — showing basic restaurant names only. Photos, ratings, menus and deals require an API key configured on the server.
              </div>
            )}
            <RestaurantList
              restaurants={restaurants}
              location={location}
              radius={radius}
              onRadiusChange={handleRadiusChange}
              onRefresh={() => fetchRestaurants(location, radius)}
              onChangeLocation={handleChangeLocation}
              dataSource={dataSource}
            />
          </>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
        RestuFinder
        <span className="ml-2 text-gray-300">v2.2</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RestuFinderApp />
    </ErrorBoundary>
  );
}
