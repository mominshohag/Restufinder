import { useState, useMemo, useEffect, useCallback } from 'react';
import RestaurantCard from './RestaurantCard';
import LOCATIONS from '../data/locations.js';
import { API_BASE } from '../config.js';

const RADIUS_OPTIONS = [
  { label: '500m', value: 500 },
  { label: '1 km', value: 1000 },
  { label: '2 km', value: 2000 },
  { label: '5 km', value: 5000 },
  { label: '10 km', value: 10000 },
];
const PER_PAGE_OPTIONS = [10, 25, 50];
const CITIES = Object.keys(LOCATIONS);

export default function RestaurantList({
  restaurants, location, radius, onRadiusChange, onRefresh, onChangeLocation, dataSource,
}) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDeals, setFilterDeals] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // Shared deal status: restaurantId → 'checking' | 'found' | 'none'
  const [dealStatuses, setDealStatuses] = useState({});

  // Location changer state
  const [showLocationChanger, setShowLocationChanger] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [newArea, setNewArea] = useState('');

  // Reset to page 1 whenever filters/search change
  useEffect(() => setPage(1), [query, sortBy, filterOpen, filterDeals, radius]);

  // Fetch deal status for one restaurant after a staggered delay
  const checkDeal = useCallback(async (r, delay) => {
    if (!r.website && !r.facebookPage) {
      setDealStatuses((prev) => ({ ...prev, [r.id]: 'none' }));
      return;
    }
    await new Promise((res) => setTimeout(res, delay));
    setDealStatuses((prev) => ({ ...prev, [r.id]: 'checking' }));
    try {
      const params = new URLSearchParams({ restaurantName: r.name });
      if (r.website) params.set('website', r.website);
      if (r.facebookPage) params.set('facebookPage', r.facebookPage);
      const res = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(r.id)}/discounts?${params}`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setDealStatuses((prev) => ({ ...prev, [r.id]: (data.discounts || []).length > 0 ? 'found' : 'none' }));
    } catch {
      setDealStatuses((prev) => ({ ...prev, [r.id]: 'none' }));
    }
  }, []);

  // Kick off deal checks for all restaurants whenever the list changes
  useEffect(() => {
    if (restaurants.length === 0) return;
    setDealStatuses({});
    restaurants.forEach((r, i) => checkDeal(r, i * 600));
  }, [restaurants]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    let list = restaurants;

    // Only show restaurants with 500+ reviews; pass through if no review data (OSM)
    list = list.filter((r) => r.reviewCount == null || r.reviewCount >= 500);

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

    if (filterDeals) {
      list = list.filter((r) => dealStatuses[r.id] === 'found');
    }

    if (sortBy === 'distance') {
      list = [...list].sort((a, b) => haversine(location, a.location) - haversine(location, b.location));
    } else {
      list = [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }

    return list;
  }, [restaurants, query, sortBy, filterOpen, filterDeals, dealStatuses, location]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const dealsFoundCount = Object.values(dealStatuses).filter((s) => s === 'found').length;
  const dealsCheckingCount = Object.values(dealStatuses).filter((s) => s === 'checking').length;

  const handleLocationSubmit = (e) => {
    e.preventDefault();
    if (!newCity || !newArea) return;
    const coords = LOCATIONS[newCity][newArea];
    onChangeLocation({ lat: coords.lat, lng: coords.lng, label: `${newArea}, ${newCity}` });
    setShowLocationChanger(false);
    setNewCity(''); setNewArea('');
  };

  if (restaurants.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-4xl mb-3">🔍</p>
        <p className="text-gray-600 text-lg font-medium mb-1">No restaurants found nearby</p>
        <p className="text-gray-400 text-sm mb-5">Try increasing the search radius</p>
        <div className="flex gap-2 justify-center flex-wrap">
          {RADIUS_OPTIONS.filter((o) => o.value > radius).slice(0, 3).map((o) => (
            <button key={o.value} onClick={() => onRadiusChange(o.value)}
              className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg text-sm hover:bg-orange-50">
              Try {o.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Location changer banner */}
      <div className="mb-4 flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-sm">
        <span className="text-sm text-gray-600">📍 <strong>{location.label || 'Current area'}</strong></span>
        <button onClick={() => setShowLocationChanger((v) => !v)}
          className="text-xs text-orange-500 hover:text-orange-700 font-medium underline">
          Change area
        </button>
      </div>

      {showLocationChanger && (
        <form onSubmit={handleLocationSubmit} className="mb-4 bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col sm:flex-row gap-2">
          <select value={newCity} onChange={(e) => { setNewCity(e.target.value); setNewArea(''); }}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400" required>
            <option value="">Select city…</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={newArea} onChange={(e) => setNewArea(e.target.value)} disabled={!newCity}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-40" required>
            <option value="">{newCity ? 'Select area…' : 'City first'}</option>
            {newCity && Object.keys(LOCATIONS[newCity]).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button type="submit" disabled={!newCity || !newArea}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-40">
            Go →
          </button>
          <button type="button" onClick={() => setShowLocationChanger(false)}
            className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
        </form>
      )}

      {/* Active Deals filter banner */}
      <button
        onClick={() => setFilterDeals((v) => !v)}
        className={`w-full mb-4 flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all shadow-sm ${
          filterDeals
            ? 'bg-orange-500 text-white border-orange-500'
            : 'bg-white text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600'
        }`}
      >
        <span className="flex items-center gap-2">
          <span className="text-base">🏷️</span>
          <span>{filterDeals ? 'Showing restaurants with active deals' : 'Filter: Active Deals'}</span>
          {dealsFoundCount > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${filterDeals ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-600'}`}>
              {dealsFoundCount} found
            </span>
          )}
        </span>
        {dealsCheckingCount > 0 && !filterDeals && (
          <span className="text-xs text-gray-400">checking {dealsCheckingCount}…</span>
        )}
        {filterDeals && (
          <span className="text-xs opacity-75">Tap to clear ✕</span>
        )}
      </button>

      {/* Search + controls */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input type="text" placeholder="Search by name or cuisine…" value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm" />
        </div>

        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 shadow-sm overflow-hidden shrink-0">
          {RADIUS_OPTIONS.map((o) => (
            <button key={o.value} onClick={() => onRadiusChange(o.value)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${radius === o.value ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort + filters row */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 shadow-sm">
          <option value="rating">Top Rated</option>
          <option value="distance">Nearest</option>
        </select>

        <button onClick={() => setFilterOpen((v) => !v)}
          title={dataSource === 'openstreetmap' ? 'Requires Google Places API key' : ''}
          className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors shadow-sm ${filterOpen ? 'bg-green-500 text-white border-green-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'} ${dataSource === 'openstreetmap' ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {filterOpen ? '🟢 Open Now' : 'Open Now'}
        </button>

        {/* Per page */}
        <div className="flex items-center gap-1 ml-auto bg-white border border-gray-200 rounded-xl px-2 shadow-sm">
          <span className="text-xs text-gray-400">Show:</span>
          {PER_PAGE_OPTIONS.map((n) => (
            <button key={n} onClick={() => { setPerPage(n); setPage(1); }}
              className={`px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${perPage === n ? 'bg-orange-500 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
              {n}
            </button>
          ))}
        </div>

        <button onClick={onRefresh} className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 text-sm shadow-sm" title="Refresh">↻</button>
      </div>

      {/* Count */}
      <p className="text-xs text-gray-400 mb-4">
        Showing {Math.min((page - 1) * perPage + 1, filtered.length)}–{Math.min(page * perPage, filtered.length)} of {filtered.length} restaurants
        {query ? ` for "${query}"` : ''}
        {filterDeals ? ' with active deals' : ''}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          {filterDeals && dealsCheckingCount > 0 ? (
            <p>Still scanning {dealsCheckingCount} restaurants for deals…</p>
          ) : filterDeals ? (
            <>
              <p className="mb-2">No active deals found in the current area.</p>
              <button className="underline text-orange-500" onClick={() => setFilterDeals(false)}>Show all restaurants</button>
            </>
          ) : (
            <>
              No results match your filters.{' '}
              <button className="underline text-orange-500" onClick={() => { setQuery(''); setFilterOpen(false); setFilterDeals(false); }}>Clear filters</button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-6">
            {paginated.map((r, i) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                userLocation={location}
                index={(page - 1) * perPage + i}
                discountStatus={dealStatuses[r.id] ?? null}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pb-4">
              <button onClick={() => setPage(1)} disabled={page === 1}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">«</button>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">‹ Prev</button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const p = start + i;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${p === page ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                    {p}
                  </button>
                );
              })}

              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">Next ›</button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-30 hover:bg-gray-50">»</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function haversine(from, to) {
  if (!from || !to) return Infinity;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
