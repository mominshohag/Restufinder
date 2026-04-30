import { useEffect, useState, useCallback } from 'react';

const SOURCE_META = {
  website: { label: 'Website', icon: '🌐', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  facebook: { label: 'Facebook', icon: '👤', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  instagram: { label: 'Instagram', icon: '📸', color: 'bg-pink-50 text-pink-700 border-pink-200' },
};

const CONFIDENCE_BADGE = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
};

function formatDate(isoString) {
  if (!isoString) return null;
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return null;
  }
}

export default function DiscountModal({ restaurant: r, onClose, onDiscountsLoaded }) {
  const [status, setStatus] = useState('loading'); // loading | done | error
  const [discounts, setDiscounts] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchDiscounts = useCallback(async () => {
    setStatus('loading');
    setDiscounts([]);

    const params = new URLSearchParams();
    if (r.website) params.set('website', r.website);
    if (r.facebookPage) params.set('facebookPage', r.facebookPage);
    params.set('restaurantName', r.name);

    try {
      const res = await fetch(`/api/restaurants/${encodeURIComponent(r.id)}/discounts?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      const data = await res.json();
      const found = data.discounts || [];
      setDiscounts(found);
      onDiscountsLoaded(found);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.message);
      setStatus('error');
    }
  }, [r, onDiscountsLoaded]);

  useEffect(() => {
    fetchDiscounts();
    // Close on Escape
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fetchDiscounts, onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-900 text-lg leading-tight truncate">{r.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {r.rating && (
                <span className="text-amber-500 text-sm font-medium">★ {r.rating}</span>
              )}
              {r.address && (
                <span className="text-xs text-gray-400 truncate max-w-xs">{r.address}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Info row */}
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex gap-4 text-sm text-gray-600 flex-wrap">
          {r.phone && <a href={`tel:${r.phone}`} className="hover:text-orange-500">📞 {r.phone}</a>}
          {r.website && (
            <a href={r.website} target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 truncate max-w-[200px]">
              🌐 Website
            </a>
          )}
          {r.facebookPage && (
            <a href={r.facebookPage.startsWith('http') ? r.facebookPage : `https://${r.facebookPage}`}
               target="_blank" rel="noopener noreferrer" className="hover:text-indigo-500">
              👤 Facebook
            </a>
          )}
          {r.instagramPage && (
            <a href={r.instagramPage.startsWith('http') ? r.instagramPage : `https://${r.instagramPage}`}
               target="_blank" rel="noopener noreferrer" className="hover:text-pink-500">
              📸 Instagram
            </a>
          )}
          {r.openingHours && (
            <details className="w-full">
              <summary className="cursor-pointer text-xs text-gray-400 select-none">🕐 Opening hours</summary>
              <ul className="mt-1 text-xs text-gray-500 space-y-0.5 pl-2">
                {r.openingHours.map((h) => <li key={h}>{h}</li>)}
              </ul>
            </details>
          )}
        </div>

        {/* Discounts body */}
        <div className="flex-1 overflow-y-auto p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            🏷️ Current Deals & Discounts
            {status === 'done' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${discounts.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {discounts.length > 0 ? `${discounts.length} found` : 'None found'}
              </span>
            )}
          </h3>

          {status === 'loading' && (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
              <p className="text-xs text-gray-400 mt-4 text-center">
                Checking website{r.facebookPage ? ', Facebook' : ''}…
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6">
              <p className="text-red-500 text-sm mb-3">{errorMsg}</p>
              <button
                onClick={fetchDiscounts}
                className="text-sm text-orange-500 hover:text-orange-700 underline"
              >
                Retry
              </button>
            </div>
          )}

          {status === 'done' && discounts.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-3">🔍</p>
              <p className="text-sm font-medium text-gray-500 mb-1">No active deals found</p>
              <p className="text-xs max-w-xs mx-auto">
                We checked their website{r.facebookPage ? ' and Facebook page' : ''}, but found no
                current promotions. Check back later or visit their page directly.
              </p>
              <div className="mt-4 flex gap-2 justify-center flex-wrap">
                {r.website && (
                  <a href={r.website} target="_blank" rel="noopener noreferrer"
                     className="text-xs text-blue-500 underline">Visit website</a>
                )}
                {r.facebookPage && (
                  <a href={r.facebookPage.startsWith('http') ? r.facebookPage : `https://${r.facebookPage}`}
                     target="_blank" rel="noopener noreferrer"
                     className="text-xs text-indigo-500 underline">Check Facebook</a>
                )}
              </div>
            </div>
          )}

          {status === 'done' && discounts.length > 0 && (
            <div className="space-y-3">
              {discounts.map((d, i) => {
                const meta = SOURCE_META[d.source] || SOURCE_META.website;
                return (
                  <div
                    key={i}
                    className="border border-gray-100 rounded-xl p-4 hover:border-orange-200 hover:bg-orange-50/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      {d.confidence && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${CONFIDENCE_BADGE[d.confidence] || CONFIDENCE_BADGE.medium}`}>
                          {d.confidence} match
                        </span>
                      )}
                      {d.postedAt && (
                        <span className="text-xs text-gray-400 ml-auto">{formatDate(d.postedAt)}</span>
                      )}
                    </div>

                    {d.imageUrl && (
                      <img
                        src={d.imageUrl}
                        alt="Deal"
                        className="w-full h-32 object-cover rounded-lg mb-2"
                        loading="lazy"
                      />
                    )}

                    <p className="text-sm text-gray-700 line-clamp-3">{d.description}</p>

                    {d.url && (
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-orange-500 hover:text-orange-700 mt-2 inline-block underline"
                      >
                        View source →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-3 flex justify-between items-center">
          <p className="text-xs text-gray-400">Deals sourced from public pages & websites</p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
