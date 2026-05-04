import { useEffect, useState, useCallback } from 'react';
import { getCuisineStyle } from '../services/cuisineStyle.js';
import { getOpenStatus } from '../services/openingHoursParser.js';
import { API_BASE } from '../config.js';

const PRICE = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };
const SOURCE_META = {
  website:  { label: 'Website',   icon: '🌐', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  facebook: { label: 'Facebook',  icon: '👤', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  instagram:{ label: 'Instagram', icon: '📸', color: 'bg-pink-50 text-pink-700 border-pink-200' },
};

function Stars({ rating }) {
  if (!rating) return null;
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-sm ${i < full ? 'text-amber-400' : i === full && half ? 'text-amber-300' : 'text-gray-200'}`}>★</span>
      ))}
      <span className="text-sm text-gray-600 ml-1 font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}

function Skeleton({ lines = 3 }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-gray-100 rounded ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
    </div>
  );
}

export default function RestaurantModal({ restaurant: r, onClose }) {
  const [tab, setTab] = useState('overview');
  const [discounts, setDiscounts] = useState(null);
  const [menuItems, setMenuItems] = useState(null);
  const [enriched, setEnriched] = useState(null);

  const style = getCuisineStyle(r.cuisineTypes || []);

  // If restaurant already came from Google Places, use its data directly
  const isAlreadyRich = r.source === 'google';
  const photo = r.photoUrl || enriched?.photoUrl;
  const rating = r.rating || enriched?.rating;
  const reviewCount = r.reviewCount || enriched?.reviewCount;
  const website = r.website || enriched?.website;
  const phone = r.phone || enriched?.phone;
  const facebookPage = r.facebookPage || enriched?.facebookPage;
  const instagramPage = r.instagramPage || enriched?.instagramPage;

  const openingHours = r.openingHours || enriched?.openingHours || null;
  const isOpen = r.isOpen ?? enriched?.isOpen ?? null;
  const openStatus = Array.isArray(openingHours)
    ? null  // weekday_text from Google — shown as list, not parsed
    : getOpenStatus(openingHours);  // OSM string format

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  // Load discounts (uses website + facebookPage once resolved)
  useEffect(() => {
    const resolvedWebsite = website;
    const resolvedFb = facebookPage;
    const params = new URLSearchParams({ restaurantName: r.name });
    if (resolvedWebsite) params.set('website', resolvedWebsite);
    if (resolvedFb) params.set('facebookPage', resolvedFb);
    fetch(`${API_BASE}/restaurants/${encodeURIComponent(r.id)}/discounts?${params}`)
      .then((res) => res.json())
      .then((data) => setDiscounts(data.discounts || []))
      .catch(() => setDiscounts([]));
  }, [r, enriched]);

  // Load menu (uses website once resolved)
  useEffect(() => {
    const resolvedWebsite = website;
    if (!resolvedWebsite) { setMenuItems([]); return; }
    fetch(`${API_BASE}/restaurants/${encodeURIComponent(r.id)}/menu?website=${encodeURIComponent(resolvedWebsite)}`)
      .then((res) => res.json())
      .then((data) => setMenuItems(data.items || []))
      .catch(() => setMenuItems([]));
  }, [r, enriched]);

  // Enrich with Google Places only if data source is OSM (sparse)
  useEffect(() => {
    if (isAlreadyRich || !r.location) return;
    fetch(`${API_BASE}/restaurants/enrich?name=${encodeURIComponent(r.name)}&lat=${r.location.lat}&lng=${r.location.lng}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data) setEnriched(data); })
      .catch(() => {});
  }, [r, isAlreadyRich]);

  const discountCount = discounts?.length ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* Banner photo */}
        <div className="relative h-48 shrink-0">
          {photo ? (
            <img src={photo} alt={r.name} className="w-full h-full object-cover" />
          ) : (
            <div className={`w-full h-full bg-gradient-to-br ${style.gradient} flex items-center justify-center`}>
              <span className="text-8xl opacity-60">{style.emoji}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

          {/* Close button */}
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center transition-colors backdrop-blur-sm">
            ✕
          </button>

          {/* Name overlay */}
          <div className="absolute bottom-3 left-4 right-12">
            <h2 className="text-white font-bold text-xl leading-tight drop-shadow">{r.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {rating && <Stars rating={rating} />}
              {reviewCount && <span className="text-white/70 text-xs">({reviewCount.toLocaleString()} reviews)</span>}
              {r.priceLevel && <span className="text-white/80 text-xs font-medium">{PRICE[r.priceLevel]}</span>}
              {(isOpen !== null || openStatus) && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${(isOpen ?? openStatus?.isOpen) ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {(isOpen ?? openStatus?.isOpen) ? 'Open' : 'Closed'}
                </span>
              )}
              {discountCount > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  🏷️ {discountCount} Deal{discountCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick links bar */}
        <div className="flex gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100 overflow-x-auto text-sm shrink-0">
          {phone && <a href={`tel:${phone}`} className="flex items-center gap-1 text-gray-600 hover:text-orange-600 whitespace-nowrap">📞 {phone}</a>}
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-gray-600 hover:text-blue-600 whitespace-nowrap">🌐 Website</a>}
          {facebookPage && <a href={facebookPage.startsWith('http') ? facebookPage : `https://${facebookPage}`} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-indigo-600 whitespace-nowrap">👤 Facebook</a>}
          {instagramPage && <a href={instagramPage.startsWith('http') ? instagramPage : `https://${instagramPage}`} target="_blank" rel="noopener noreferrer" className="text-gray-600 hover:text-pink-600 whitespace-nowrap">📸 Instagram</a>}
          {r.address && <span className="text-gray-400 text-xs whitespace-nowrap">📍 {r.address}</span>}
          {!phone && !website && !facebookPage && !r.address && !isAlreadyRich && (
            <span className="text-gray-400 text-xs italic">Fetching details…</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 shrink-0 bg-white">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'menu',     label: menuItems === null ? 'Menu…' : menuItems.length > 0 ? `Menu (${menuItems.length})` : 'Menu' },
            { id: 'deals',    label: discounts === null ? 'Deals…' : discountCount > 0 ? `🏷️ Deals (${discountCount})` : 'Deals' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="p-5 space-y-5">
              {/* Open status */}
              {openStatus && (
                <div className={`flex items-center gap-2 text-sm font-medium ${openStatus.isOpen ? 'text-green-700' : 'text-gray-600'}`}>
                  <span>{openStatus.isOpen ? '🟢' : '🔴'}</span>
                  <span>{openStatus.label}</span>
                </div>
              )}

              {/* Opening hours grid from Google Places */}
              {Array.isArray(openingHours) && openingHours.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Opening Hours</h4>
                  <div className="space-y-1">
                    {openingHours.map((h) => (
                      <div key={h} className="flex justify-between text-sm">
                        <span className="text-gray-600 font-medium">{h.split(': ')[0]}</span>
                        <span className="text-gray-500">{h.split(': ').slice(1).join(': ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* OSM opening_hours fallback */}
              {!Array.isArray(openingHours) && r.openingHours && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Opening Hours</h4>
                  <p className="text-sm text-gray-600">{r.openingHours}</p>
                </div>
              )}

              {/* Cuisine */}
              {(r.cuisineTypes || []).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Cuisine</h4>
                  <div className="flex gap-2 flex-wrap">
                    {r.cuisineTypes.map((c) => (
                      <span key={c} className="bg-orange-50 text-orange-700 text-sm px-3 py-1 rounded-full border border-orange-100 capitalize">
                        {c.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Enrichment loading state for OSM restaurants */}
              {!isAlreadyRich && enriched === null && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                  🔍 Looking up additional details via Google Places…
                  <div className="mt-2"><Skeleton lines={2} /></div>
                </div>
              )}

              {/* No data state */}
              {!phone && !website && !openingHours && enriched !== null && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                  <strong>Limited information available.</strong> This restaurant has minimal public data on OpenStreetMap and wasn't found on Google Places.
                  {!isAlreadyRich && <span> Adding a <strong>Google Places API key</strong> on Render improves coverage significantly.</span>}
                </div>
              )}
            </div>
          )}

          {/* ── Menu ── */}
          {tab === 'menu' && (
            <div className="p-5">
              {menuItems === null && <Skeleton lines={5} />}

              {menuItems !== null && menuItems.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">📋</p>
                  <p className="text-gray-600 font-medium mb-1">Menu not available</p>
                  <p className="text-gray-400 text-sm mb-4 max-w-xs mx-auto">
                    {!website
                      ? 'No website found for this restaurant. Menu scraping requires a website link, which Google Places can provide.'
                      : "We couldn't extract a structured menu from their website. The menu may be image-based or in a format we can't read."}
                  </p>
                  {website && (
                    <a href={website} target="_blank" rel="noopener noreferrer"
                       className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors">
                      View their website →
                    </a>
                  )}
                </div>
              )}

              {menuItems !== null && menuItems.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-gray-400 mb-3">Scraped from restaurant website — may not be fully up to date.</p>
                  {menuItems.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover shrink-0" loading="lazy" />
                        ) : (
                          <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${style.gradient} flex items-center justify-center shrink-0`}>
                            <span className="text-2xl opacity-70">{style.emoji}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm leading-tight">{item.name}</p>
                          {item.category && <p className="text-xs text-orange-500 mt-0.5">{item.category}</p>}
                          {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                        </div>
                      </div>
                      {item.price && (
                        <span className="text-sm font-bold text-gray-800 shrink-0 whitespace-nowrap">{item.price}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Deals ── */}
          {tab === 'deals' && (
            <div className="p-5">
              {discounts === null && <Skeleton lines={4} />}

              {discounts !== null && discounts.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-3xl mb-3">🔍</p>
                  <p className="text-gray-600 font-medium mb-1">No active deals found</p>
                  <p className="text-gray-400 text-sm max-w-xs mx-auto">
                    We checked their website{r.facebookPage ? ' and Facebook page' : ''} but found no current promotions.
                  </p>
                  <div className="flex gap-3 justify-center mt-4 flex-wrap">
                    {r.website && <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 underline">Check website</a>}
                    {r.facebookPage && <a href={r.facebookPage.startsWith('http') ? r.facebookPage : `https://${r.facebookPage}`} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-500 underline">Check Facebook</a>}
                  </div>
                </div>
              )}

              {discounts !== null && discounts.length > 0 && (
                <div className="space-y-3">
                  {discounts.map((d, i) => {
                    const meta = SOURCE_META[d.source] || SOURCE_META.website;
                    return (
                      <div key={i} className="border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                          {d.confidence === 'high' && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">confirmed</span>
                          )}
                          {d.postedAt && (
                            <span className="text-xs text-gray-400 ml-auto">
                              {new Date(d.postedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {d.imageUrl && <img src={d.imageUrl} alt="Deal" className="w-full h-32 object-cover rounded-lg mb-2" loading="lazy" />}
                        <p className="text-sm text-gray-700 line-clamp-3">{d.description}</p>
                        {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 hover:text-orange-700 mt-2 inline-block underline">View source →</a>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
