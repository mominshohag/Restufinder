import { useState } from 'react';

export default function LocationPrompt({ onLocationGranted }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | denied | error
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [showManual, setShowManual] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatus('error');
      return;
    }
    setStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onLocationGranted({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        console.error('Geolocation error:', err);
        setStatus(err.code === 1 ? 'denied' : 'error');
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const submitManual = (e) => {
    e.preventDefault();
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Please enter valid coordinates.');
      return;
    }
    onLocationGranted({ lat, lng });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4">
      {/* Hero */}
      <div className="mb-8">
        <div className="text-7xl mb-4">🍜</div>
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
          Find top-rated restaurants near you
        </h2>
        <p className="text-gray-500 text-lg max-w-md mx-auto">
          Discover the best places to eat and check live deals from their websites, Facebook, and
          Instagram — all in one place.
        </p>
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        {status === 'requesting' ? (
          <div className="flex items-center gap-2 text-gray-500 animate-pulse">
            <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Getting your location…
          </div>
        ) : (
          <button
            onClick={requestLocation}
            className="w-full px-6 py-3.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-lg font-semibold rounded-xl shadow-md transition-colors flex items-center justify-center gap-2"
          >
            <span>📍</span> Share My Location
          </button>
        )}

        {status === 'denied' && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full">
            Location access was denied. Please enable it in browser settings, or enter coordinates
            manually below.
          </p>
        )}

        {status === 'error' && (
          <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full">
            Could not get your location. Try entering coordinates manually.
          </p>
        )}

        <button
          onClick={() => setShowManual((v) => !v)}
          className="text-sm text-gray-400 hover:text-gray-600 underline"
        >
          {showManual ? 'Hide' : 'Enter coordinates manually'}
        </button>

        {showManual && (
          <form onSubmit={submitManual} className="w-full flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="number"
                step="any"
                placeholder="Latitude (e.g. 51.5074)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />
              <input
                type="number"
                step="any"
                placeholder="Longitude (e.g. -0.1278)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                required
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 text-sm font-medium transition-colors"
            >
              Search this location
            </button>
          </form>
        )}
      </div>

      {/* Features */}
      <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full text-left">
        {[
          { icon: '⭐', title: 'Top Rated', desc: 'Sorted by real customer ratings' },
          { icon: '🏷️', title: 'Live Deals', desc: 'Discounts scraped from websites & Facebook' },
          { icon: '📍', title: 'Nearby', desc: 'Filter by distance — 500m to 10km' },
        ].map((f) => (
          <div key={f.title} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
            <div className="text-2xl mb-1">{f.icon}</div>
            <div className="font-semibold text-gray-800 text-sm">{f.title}</div>
            <div className="text-gray-500 text-xs mt-0.5">{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
