// Parses OSM opening_hours strings like "Mo-Fr 09:00-22:00; Sa-Su 10:00-23:00"
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function getOpenStatus(str) {
  if (!str || typeof str !== 'string') return null;  // guard against arrays / null
  const s = str.trim();
  if (s === '24/7') return { isOpen: true, label: 'Open 24/7' };

  const now = new Date();
  const dayIdx = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();

  try {
    for (const rule of s.split(';').map((r) => r.trim()).filter(Boolean)) {
      const spaceIdx = rule.search(/\d{1,2}:\d{2}/);
      if (spaceIdx === -1) continue;
      const dayPart = rule.slice(0, spaceIdx).trim();
      const timePart = rule.slice(spaceIdx).trim();

      if (!matchesDay(dayPart, dayIdx)) continue;

      const timeMatch = timePart.match(/(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/);
      if (!timeMatch) continue;

      const openMin = toMins(timeMatch[1]);
      const closeMin = toMins(timeMatch[2]);
      const isOpen = mins >= openMin && mins < closeMin;

      return {
        isOpen,
        closesAt: timeMatch[2],
        opensAt: timeMatch[1],
        label: isOpen
          ? `Open · Closes ${fmt(timeMatch[2])}`
          : `Closed · Opens ${fmt(timeMatch[1])}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

function matchesDay(part, cur) {
  if (part.includes(',')) return part.split(',').some((d) => DAYS.indexOf(d.trim()) === cur);
  const m = part.match(/([A-Za-z]{2})(?:-([A-Za-z]{2}))?/);
  if (!m) return false;
  const s = DAYS.indexOf(m[1]);
  const e = m[2] ? DAYS.indexOf(m[2]) : s;
  if (s <= e) return cur >= s && cur <= e;
  return cur >= s || cur <= e; // wraps (e.g. Fr-Su)
}

function toMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function fmt(t) {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
}
