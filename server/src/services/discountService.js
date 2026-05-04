const scraperService = require('./scraperService');
const facebookService = require('./facebookService');

async function getDiscounts({ website, facebookPage, restaurantName }) {
  // If we have a website but no known Facebook page, scrape the site for social links first
  let resolvedFbPage = facebookPage;
  if (website && !facebookPage) {
    try {
      const links = await scraperService.extractSocialMediaLinks(website);
      resolvedFbPage = links.facebookPage || null;
    } catch {
      // carry on without it
    }
  }

  const tasks = [];

  if (website) {
    tasks.push(
      scraperService
        .findDiscountsOnWebsite(website)
        .catch(() => [])
    );
  }

  tasks.push(
    facebookService
      .findDiscounts(resolvedFbPage, restaurantName)
      .catch(() => [])
  );

  const results = await Promise.all(tasks);
  const all = results.flat();

  // Deduplicate across sources by first 80 chars of description
  const seen = new Set();
  return all.filter((d) => {
    const key = (d.description || '').substring(0, 80).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

module.exports = { getDiscounts };
