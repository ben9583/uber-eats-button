/**
 * Picks a random entry from items based on the weights provided
 * @param {Array.<T>} items The items array to pick from
 * @param {number[]} weights The weights for the respective items
 * @returns {T} The randomly selected item
 * @template T
 */
const weighted_random = (items, weights) => {
  if(items.length !== weights.length) throw new Error(`Items and weights must be the same length, but got ${items.length} !== ${weights.length}.`);

  let i;
  for (i = 1; i < weights.length; i++)
    weights[i] += weights[i - 1];
  
  let random = Math.random() * weights[weights.length - 1];
  
  for (i = 0; i < weights.length; i++)
    if (weights[i] > random)
      break;
  
  return items[i];
}

module.exports = {
  weighted_random
};
