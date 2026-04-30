import { useState, useMemo } from 'react';
import RestaurantCard from './RestaurantCard';

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];

export default function RestaurantList({ restaurants, location, radius, onRadiusChange, onRefresh }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating'); // rating | distance
  const [filterOpen, setFilterOpen] = useState(false);

  const filtered = useMemo(() => {
    let list = restaurants;

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.cuisineTypes || []).some((c) => c.toLowerCase().includes(q)) ||
          (r.address || '').toLowerCase().includes(q)
      );
    }

    if (filterOpen) {
      list = list.filter((r) => r.isOpen === true);
    }

    if (sortBy === 'distance') {
      list = [...list].sort((a, b) => {
        const da = haversine(location, a.location);
        const db = haversine(location, b.location);
        return da - db;
      });
    } else {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [restaurants, query, sortBy, filterOpen, location]);

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-600 text-lg font-medium mb-1">No restaurants found nearby</p>
        <p className="text-gray-400 text-sm mb-5">Try increasing the search radius</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {RADIUS_OPTIONS.filter((o) => o.value > radius).slice(0, 3).map((o) => (
            <button
              key={o.value}
              onClick={() => onRadiusChange(o.value)}
              className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg text-sm hover:bg-orange-50 transition-colors"
            >
              Try {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by name or cuisine…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
          />
        </div>

        {/* Radius */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 shadow-sm overflow-hidden">
          {RADIUS_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => onRadiusChange(o.value)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                radius === o.value
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Sort + Open filter */}
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm"
          >
            <option value="rating">Top Rated</option>
            <option value="distance">Nearest</option>
          </select>

          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors shadow-sm ${
              filterOpen
                ? 'bg-green-500 text-white border-green-500'
                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {filterOpen ? '🟢 Open' : 'Open now'}
          </button>

          <button
            onClick={onRefresh}
            className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 text-sm shadow-sm transition-colors"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Count */}
      <p className="text-sm text-gray-400 mb-4">
        {filtered.length} restaurant{filtered.length !== 1 ? 's' : ''} found
        {query ? ` for "${query}"` : ''} within {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No results match your filters.{' '}
          <button className="underline" onClick={() => { setQuery(''); setFilterOpen(false); }}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((r) => (
            <RestaurantCard key={r.id} restaurant={r} userLocation={location} />
          ))}
        </div>
      )}
    </div>
  );
}

function haversine(from, to) {
  if (!from || !to) return Infinity;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
