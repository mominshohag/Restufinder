import { useState, useEffect } from 'react';
import { getCuisineStyle } from '../services/cuisineStyle.js';
import { getOpenStatus } from '../services/openingHoursParser.js';
import RestaurantModal from './RestaurantModal.jsx';
import { API_BASE } from '../config.js';

const PRICE = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

function Stars({ rating }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-xs ${i < full ? 'text-amber-400' : i === full && half ? 'text-amber-300' : 'text-gray-200'}`}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-0.5">{rating.toFixed(1)}</span>
    </span>
  );
}

function haversine(from, to) {
  if (!from || !to) return null;
  const R = 6371000;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function RestaurantCard({ restaurant: r, userLocation, index = 0 }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [discountStatus, setDiscountStatus] = useState(null); // null | 'checking' | 'found' | 'none'

  const style = getCuisineStyle(r.cuisineTypes || []);
  // Google Places returns openingHours as a string[] (weekday_text) — use isOpen directly.
  // OSM returns a plain string like "Mo-Fr 09:00-22:00" — parse it.
  const openStatus = Array.isArray(r.openingHours)
    ? (r.isOpen != null ? { isOpen: r.isOpen, label: r.isOpen ? 'Open now' : 'Closed now' } : null)
    : getOpenStatus(r.openingHours);
  const dist = haversine(userLocation, r.location);
  const distText = dist == null ? null : dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;

  // Lazily check for discounts — stagger by card index so we don't hammer the server
  useEffect(() => {
    if (!r.website || discountStatus) return;
    const delay = index * 600;
    const t = setTimeout(async () => {
      setDiscountStatus('checking');
      try {
        const params = new URLSearchParams({ restaurantName: r.name });
        if (r.website) params.set('website', r.website);
        const res = await fetch(`${API_BASE}/restaurants/${encodeURIComponent(r.id)}/discounts?${params}`);
        if (!res.ok) { setDiscountStatus('none'); return; }
        const data = await res.json();
        setDiscountStatus((data.discounts || []).length > 0 ? 'found' : 'none');
      } catch {
        setDiscountStatus('none');
      }
    }, delay);
    return () => clearTimeout(t);
  }, [r.id, r.website, index]);

  return (
    <>
      <div
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200 flex flex-col cursor-pointer group"
        onClick={() => setModalOpen(true)}
      >
        {/* Photo / banner */}
        <div className="relative h-44 overflow-hidden">
          {r.photoUrl ? (
            <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${style.gradient} flex items-center justify-center group-hover:scale-105 transition-transform duration-300`}>
              <span className="text-7xl opacity-70 drop-shadow-md">{style.emoji}</span>
            </div>
          )}

          {/* Top-left: open/closed */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {openStatus && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full shadow ${openStatus.isOpen ? 'bg-green-500 text-white' : 'bg-gray-700 text-white'}`}>
                {openStatus.isOpen ? '🟢 Open' : '🔴 Closed'}
              </span>
            )}
          </div>

          {/* Top-right: discount badge */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {discountStatus === 'found' && (
              <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow animate-bounce">
                🏷️ Offer On!
              </span>
            )}
            {discountStatus === 'checking' && (
              <span className="bg-white/80 text-gray-500 text-xs px-2 py-0.5 rounded-full shadow">
                checking…
              </span>
            )}
          </div>

          {/* Bottom-left: distance */}
          {distText && (
            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
              📍 {distText}
            </span>
          )}

          {/* Bottom-right: price */}
          {r.priceLevel && (
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm font-medium">
              {PRICE[r.priceLevel]}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-1 group-hover:text-orange-600 transition-colors">
            {r.name}
          </h3>

          {/* Rating row */}
          <div className="flex items-center justify-between mb-2">
            {r.rating ? <Stars rating={r.rating} /> : <span className="text-xs text-gray-400">No rating yet</span>}
            {r.reviewCount && <span className="text-xs text-gray-400">({r.reviewCount.toLocaleString()})</span>}
          </div>

          {/* Open status detail */}
          {openStatus && (
            <p className={`text-xs mb-2 font-medium ${openStatus.isOpen ? 'text-green-600' : 'text-gray-500'}`}>
              {openStatus.label}
            </p>
          )}

          {/* Cuisine tags */}
          {(r.cuisineTypes || []).length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {r.cuisineTypes.slice(0, 2).map((c) => (
                <span key={c} className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full border border-orange-100 capitalize">
                  {c.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {r.address && <p className="text-xs text-gray-400 line-clamp-1 mb-3">{r.address}</p>}

          {/* CTA */}
          <div className="mt-auto pt-1">
            <div className="w-full py-2 text-sm font-semibold text-center bg-orange-50 text-orange-600 rounded-xl border border-orange-100 group-hover:bg-orange-500 group-hover:text-white transition-colors">
              View Details & Menu →
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <RestaurantModal restaurant={r} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
