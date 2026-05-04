const STYLES = {
  burger:      { gradient: 'from-yellow-400 to-orange-500', emoji: '🍔', label: 'Burgers' },
  pizza:       { gradient: 'from-red-400 to-orange-400',    emoji: '🍕', label: 'Pizza' },
  sandwich:    { gradient: 'from-amber-400 to-yellow-400',  emoji: '🥪', label: 'Sandwiches' },
  chinese:     { gradient: 'from-red-500 to-pink-500',      emoji: '🥢', label: 'Chinese' },
  japanese:    { gradient: 'from-pink-400 to-red-400',      emoji: '🍱', label: 'Japanese' },
  sushi:       { gradient: 'from-pink-500 to-red-400',      emoji: '🍣', label: 'Sushi' },
  korean:      { gradient: 'from-rose-400 to-pink-500',     emoji: '🥘', label: 'Korean' },
  thai:        { gradient: 'from-green-400 to-emerald-500', emoji: '🍜', label: 'Thai' },
  vietnamese:  { gradient: 'from-emerald-400 to-green-500', emoji: '🍲', label: 'Vietnamese' },
  indian:      { gradient: 'from-orange-400 to-amber-500',  emoji: '🍛', label: 'Indian' },
  bangladeshi: { gradient: 'from-green-500 to-teal-500',    emoji: '🍛', label: 'Bangladeshi' },
  italian:     { gradient: 'from-green-500 to-red-400',     emoji: '🍝', label: 'Italian' },
  american:    { gradient: 'from-blue-500 to-indigo-500',   emoji: '🍖', label: 'American' },
  seafood:     { gradient: 'from-blue-400 to-cyan-500',     emoji: '🦐', label: 'Seafood' },
  steak:       { gradient: 'from-red-600 to-orange-500',    emoji: '🥩', label: 'Steakhouse' },
  cafe:        { gradient: 'from-amber-300 to-yellow-400',  emoji: '☕', label: 'Café' },
  coffee:      { gradient: 'from-amber-600 to-yellow-500',  emoji: '☕', label: 'Coffee' },
  dessert:     { gradient: 'from-pink-300 to-purple-400',   emoji: '🧁', label: 'Desserts' },
  ice_cream:   { gradient: 'from-sky-200 to-pink-300',      emoji: '🍦', label: 'Ice Cream' },
  bbq:         { gradient: 'from-red-500 to-orange-600',    emoji: '🔥', label: 'BBQ' },
  kebab:       { gradient: 'from-orange-500 to-red-500',    emoji: '🥙', label: 'Kebab' },
  noodles:     { gradient: 'from-yellow-400 to-orange-400', emoji: '🍜', label: 'Noodles' },
  breakfast:   { gradient: 'from-yellow-300 to-orange-300', emoji: '🍳', label: 'Breakfast' },
  default:     { gradient: 'from-orange-400 to-rose-500',   emoji: '🍽️', label: 'Restaurant' },
};

export function getCuisineStyle(cuisineTypes = []) {
  for (const raw of cuisineTypes) {
    const key = raw.toLowerCase().replace(/[\s\-;]/g, '_');
    if (STYLES[key]) return STYLES[key];
    for (const [k, v] of Object.entries(STYLES)) {
      if (key.includes(k) || k.includes(key)) return v;
    }
  }
  return STYLES.default;
}
