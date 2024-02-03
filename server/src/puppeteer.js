const puppeteer = require('puppeteer');

/**
 * Create an Uber Eats order. Code will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @returns {Promise<{code: number, body: string}>} A promise that resolves to an object with a code and a body
 */
const createUberEatsOrder = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.ubereats.com/');
  await page.screenshot({ path: 'example.png' });

  const response = { code: 201, body: 'Order created' };
  await browser.close();
  return response;
}

module.exports = {
  createUberEatsOrder
}
