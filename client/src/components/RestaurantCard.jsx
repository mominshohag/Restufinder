import { useState } from 'react';
import DiscountModal from './DiscountModal';

const PRICE_LABELS = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
const CUISINE_LABELS = {
  fast_food: 'Fast Food', cafe: 'Café', bar: 'Bar', pub: 'Pub',
  bistro: 'Bistro', food_court: 'Food Court',
};

function formatDistance(meters) {
  if (meters == null || !isFinite(meters)) return null;
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function haversine(from, to) {
  if (!from || !to) return null;
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function Stars({ rating }) {
  if (!rating) return <span className="text-gray-300 text-sm">No rating</span>;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-sm ${
            i < full
              ? 'text-amber-400'
              : i === full && half
              ? 'text-amber-300'
              : 'text-gray-200'
          }`}
        >
          ★
        </span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function RestaurantCard({ restaurant: r, userLocation }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [discountCount, setDiscountCount] = useState(null); // null = unchecked

  const distance = haversine(userLocation, r.location);
  const distText = formatDistance(distance);
  const cuisines = (r.cuisineTypes || [])
    .slice(0, 2)
    .map((c) => CUISINE_LABELS[c] || c.replace(/_/g, ' '))
    .filter(Boolean);

  const handleOpenModal = () => setModalOpen(true);

  const handleDiscountsLoaded = (discounts) => {
    setDiscountCount(discounts.length);
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
        {/* Photo */}
        <div className="relative h-44 bg-gradient-to-br from-orange-50 to-amber-100 overflow-hidden">
          {r.photoUrl ? (
            <img
              src={r.photoUrl}
              alt={r.name}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl opacity-30">
              🍽️
            </div>
          )}

          {/* Badges top-right */}
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            {r.isOpen === true && (
              <span className="bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow">
                Open
              </span>
            )}
            {r.isOpen === false && (
              <span className="bg-red-400 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow">
                Closed
              </span>
            )}
            {discountCount > 0 && (
              <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow animate-pulse">
                🏷️ {discountCount} deal{discountCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Distance badge */}
          {distText && (
            <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
              📍 {distText}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col flex-1">
          <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 line-clamp-2">
            {r.name}
          </h3>

          <div className="flex items-center justify-between mb-2">
            <Stars rating={r.rating} />
            {r.reviewCount && (
              <span className="text-xs text-gray-400">({r.reviewCount.toLocaleString()})</span>
            )}
            {r.priceLevel && (
              <span className="text-xs font-medium text-gray-500">{PRICE_LABELS[r.priceLevel]}</span>
            )}
          </div>

          {cuisines.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {cuisines.map((c) => (
                <span
                  key={c}
                  className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full border border-orange-100"
                >
                  {c}
                </span>
              ))}
            </div>
          )}

          {r.address && (
            <p className="text-xs text-gray-400 line-clamp-2 mb-3">{r.address}</p>
          )}

          {/* Actions */}
          <div className="mt-auto flex gap-2">
            <button
              onClick={handleOpenModal}
              className="flex-1 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-colors"
            >
              {discountCount === null
                ? '🏷️ Check Deals'
                : discountCount > 0
                ? `🏷️ View ${discountCount} Deal${discountCount !== 1 ? 's' : ''}`
                : '📋 Details'}
            </button>

            {r.website && (
              <a
                href={r.website}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                title="Visit website"
              >
                🌐
              </a>
            )}
          </div>
        </div>
      </div>

      {modalOpen && (
        <DiscountModal
          restaurant={r}
          onClose={() => setModalOpen(false)}
          onDiscountsLoaded={handleDiscountsLoaded}
        />
      )}
    </>
  );
}
