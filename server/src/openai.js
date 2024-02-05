const openai = require('openai');

const systemPrompt = "You are a helpful AI who assists people in ordering food by picking the best options from a menu."
const prompt = "Here are a list of food items with their prices from the restaurant \"{0}\". Please create a tasty meal for one out of the following menu items. I've included the prices in parentheses and some of the items have a description. Provide the items I should get using just the names I gave you, separated by newlines, with no other formatting or text.\n\n{1}"
/**
 * Uses OpenAI's GPT to select items out of the list that form a meal
 * @param {string} restaurant The name of the restaurant
 * @param {{name: string, price: string, element: HTMLElement | null, information: string | undefined}} items Items to be selected from
 * @returns {{name: string, price: string, element: HTMLElement | null, information: string | undefined}} The selected items
 */
const selectItems = async (restaurant, items) => {
  const OpenAIAPI = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY, organization: process.env.OPENAI_ORGANIZATION });

  const formattedItems = items.map(item => `${item.name} (${item.price})${item.information ? ` - ${item.information}` : ''}`).join("\n");
  const thisPrompt = prompt.replace("{0}", restaurant).replace("{1}", formattedItems);
  const responseObject = await OpenAIAPI.chat.completions.create({
    model: "gpt-4-0125-preview",
    messages: [{ role: "system", content: systemPrompt }, { role: "user", content: thisPrompt }],
  })

  const response = responseObject.choices[0].message.content;
  console.log(response);
  if(!response) throw new Error("No response from OpenAI");

  const selectedItems = response.split("\n").map(item => item.trim());
  const uniqueItems = [];
  const seenItems = new Set();
  for(const item of items) {
    if(selectedItems.includes(item.name) && !seenItems.has(item.name)) {
      seenItems.add(item.name);
      uniqueItems.push(item);
    }
  }

  console.log(uniqueItems);

  return uniqueItems;
}

module.exports = {
  selectItems
}
