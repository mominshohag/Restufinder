import { useState } from 'react';
import LOCATIONS from '../data/locations.js';

const CITIES = Object.keys(LOCATIONS);

export default function LocationPrompt({ onLocationGranted }) {
  const [mode, setMode] = useState('area'); // 'area' | 'gps'
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle | requesting | denied | error

  const areas = city ? Object.keys(LOCATIONS[city]) : [];

  const handleAreaSubmit = (e) => {
    e.preventDefault();
    if (!city || !area) return;
    onLocationGranted({ lat: LOCATIONS[city][area].lat, lng: LOCATIONS[city][area].lng, label: `${area}, ${city}` });
  };

  const handleCityChange = (e) => {
    setCity(e.target.value);
    setArea('');
  };

  const requestGps = () => {
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    setGpsStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      (pos) => onLocationGranted({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Current location' }),
      (err) => setGpsStatus(err.code === 1 ? 'denied' : 'error'),
      { timeout: 10000, maximumAge: 60000 }
    );
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
          Discover the best places to eat and check live deals from their websites and Facebook — all in one place.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-6 gap-1">
        <button
          onClick={() => setMode('area')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'area' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          📍 Select Area
        </button>
        <button
          onClick={() => setMode('gps')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'gps' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          🛰️ Use GPS
        </button>
      </div>

      {/* Area selection */}
      {mode === 'area' && (
        <form onSubmit={handleAreaSubmit} className="w-full max-w-sm flex flex-col gap-3">
          {/* City / District */}
          <div className="text-left">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              City / District
            </label>
            <select
              value={city}
              onChange={handleCityChange}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm appearance-none"
              required
            >
              <option value="">Select a city…</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Area */}
          <div className="text-left">
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
              Area / Neighbourhood
            </label>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              disabled={!city}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-white text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
              required
            >
              <option value="">{city ? 'Select an area…' : 'Select a city first'}</option>
              {areas.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={!city || !area}
            className="w-full px-6 py-3.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-xl shadow-md transition-colors"
          >
            Find Restaurants →
          </button>
        </form>
      )}

      {/* GPS */}
      {mode === 'gps' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-3">
          {gpsStatus === 'requesting' ? (
            <div className="flex items-center gap-2 text-gray-500 animate-pulse py-3">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Getting your location…
            </div>
          ) : (
            <button
              onClick={requestGps}
              className="w-full px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-lg font-semibold rounded-xl shadow-md transition-colors"
            >
              🛰️ Use My GPS Location
            </button>
          )}

          {gpsStatus === 'denied' && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full text-center">
              Location access denied. Please enable it in browser settings, or use the area selector.
            </p>
          )}
          {gpsStatus === 'error' && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-full text-center">
              Could not get your location. Try the area selector instead.
            </p>
          )}
        </div>
      )}

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
