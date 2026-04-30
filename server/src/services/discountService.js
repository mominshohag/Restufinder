const scraperService = require('./scraperService');
const facebookService = require('./facebookService');

async function getDiscounts({ website, facebookPage, restaurantName }) {
  const tasks = [];

  if (website) {
    tasks.push(
      scraperService
        .findDiscountsOnWebsite(website)
        .then((ds) => ds.map((d) => ({ ...d, source: 'website' })))
        .catch(() => [])
    );
  }

  tasks.push(
    facebookService
      .findDiscounts(facebookPage, restaurantName)
      .then((ds) => ds.map((d) => ({ ...d, source: 'facebook' })))
      .catch(() => [])
  );

  const results = await Promise.all(tasks);
  return results.flat();
}

module.exports = { getDiscounts };
