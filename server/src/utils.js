/**
 * Picks a random entry from items based on the weights provided
 * @param {Array.<T>} items The items array to pick from
 * @param {number[]} weights The weights for the respective items
 * @returns {T} The randomly selected item
 * @template T
 */
const weighted_random = (items, weights) => {
  if (items.length !== weights.length)
    throw new Error(
      `Items and weights must be the same length, but got ${items.length} !== ${weights.length}.`
    );

  let i;
  for (i = 1; i < weights.length; i++) weights[i] += weights[i - 1];

  let random = Math.random() * weights[weights.length - 1];

  for (i = 0; i < weights.length; i++) if (weights[i] > random) break;

  return items[i];
};

/**
 * Creates a discrete probability distribution for a given number of entries and a safety factor.
 * If safety is 0, the distribution will be uniform. Otherwise, earlier entries will be more likely to be picked.
 * Follows an exponential distribution; check function implementation for more details.
 * @param {number} num_entries An positive integer number of entries
 * @param {number} safety A nonnegative number, generally somewhere between 0 and 10
 * @returns An array of length num_entries, where each entry is a number between 0 and 1 and the sum of all entries is 1.
 */
const risk_distribution = (num_entries, safety) => {
  /*
            (e^(s/n) - 1) * e^(s(n - x - 1)/n)
  function: --------------------------------
                        e^s - 1
  */
  if (safety === 0) return Array(num_entries).fill(1 / num_entries);
  const sampler = (x) =>
    ((Math.exp(safety / num_entries) - 1) *
      Math.exp((safety * (num_entries - x - 1)) / num_entries)) /
    (Math.exp(safety) - 1);
  return [...Array(num_entries).keys()].map(sampler);
};

module.exports = {
  risk_distribution,
  weighted_random,
};
