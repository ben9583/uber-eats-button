const puppeteer = require('puppeteer');
const { weighted_random } = require('./utils');

const randomCategories = [
  { name: 'Pizza', weight: 100 },
  { name: 'Sushi', weight: 40 },
  { name: 'Chinese', weight: 60 },
  { name: 'Sandwich', weight: 60 },
  { name: 'Soup', weight: 40 },
  { name: 'Mexican', weight: 100 },
  { name: 'Thai', weight: 50 },
  { name: 'Korean', weight: 40 },
  { name: 'Poke', weight: 30 },
  { name: 'Indian', weight: 60 },
  { name: 'BBQ', weight: 30 },
  { name: 'Italian', weight: 100 },
  { name: 'Japanese', weight: 40 },
  { name: 'Vietnamese', weight: 30 },
  { name: 'Halal', weight: 30 },
  { name: 'Greek', weight: 40 },
  { name: 'American', weight: 100 },
  { name: 'Caribbean', weight: 30 },
]

/**
 * Create an Uber Eats order. Code will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @returns {Promise<{code: number, body: string}>} A promise that resolves to an object with a code and a body
 */
const createUberEatsOrder = async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  console.debug("[A] Uber Eats page created")
  const page2fa = await browser.newPage();
  console.debug("[B] 2FA page created")

  const mailPromise = new Promise(async res => {
    await page2fa.goto('https://mail.ben9583.com/', { waitUntil: 'networkidle2' });
    console.debug("[B] Navigated to mail login page")
    await page2fa.waitForSelector('input#rcmloginuser').then(elem => elem.type(process.env.TWOFACTOR_EMAIL));
    console.debug("[B] Typed email input")
    await page2fa.waitForSelector('input#rcmloginpwd').then(elem => elem.type(process.env.TWOFACTOR_PASSWORD));
    console.debug("[B] Typed password input")
    await page2fa.click('button#rcmloginsubmit');
    console.debug("[B] Clicked login button")
    await page2fa.screenshot({ path: 'out2.png' });
    res();
  })

  await page.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });
  console.debug("[A] Navigated to Uber Eats page")
  await page.waitForSelector('a[data-test="header-sign-in"]')
            .then(elem => new Promise(res => setTimeout(() => res(elem), 1000)))
            .then(elem => new Promise(res => page.screenshot({ path: 'out.png' }).then(() => res(elem))))
            .then(elem => elem.click())
            .then(() => page.waitForNavigation({ waitUntil: 'networkidle2' }));
  console.debug("[A] Clicked sign in button")
  await page.waitForSelector('input#PHONE_NUMBER_or_EMAIL_ADDRESS').then(elem => elem.type(process.env.UBER_EATS_EMAIL));
  console.debug("[A] Typed email")
  await page.waitForSelector('button#forward-button')
            .then(elem => new Promise(res => setTimeout(() => res(elem), 1000)))
            .then(elem => new Promise(res => page.screenshot({ path: 'out.png' }).then(() => res(elem))))
            .then(elem => elem.click());
  console.debug("[A] Clicked next button")
  await page.screenshot({ path: 'out.png' });

  await mailPromise;
  console.debug("[B] Logged in to mail")
  await new Promise(res => setTimeout(res, 6000));
  await page2fa.reload({ waitUntil: 'networkidle2' });
  console.debug("[B] Reloaded mail");
  await page2fa.waitForSelector('span[title="admin@uber.com"]')
               .then(elem => new Promise(res => setTimeout(() => res(elem), 2000)))
               .then(elem => new Promise(res => page2fa.screenshot({ path: 'out2.png' }).then(() => res(elem))))
               .then(elem => elem.click());
  console.debug("[B] Clicked email");
  await new Promise(res => setTimeout(res, 4000));
  await page2fa.screenshot({ path: 'out2.png' });
  const frame = await page2fa.waitForSelector('iframe#messagecontframe').then(elem => elem.contentFrame());
  console.debug("[B] Found iframe")
  const codeElem = await frame.waitForSelector('td.v1p2b');
  console.debug("[B] Found code element");
  const code = await frame.evaluate(codeElem => codeElem.textContent, codeElem);
  console.debug("[B] Got code");
  console.log("2FA code: " + code);
  await page2fa.screenshot({ path: 'out2.png' });

  await page.waitForSelector('input#EMAIL_OTP_CODE-0');
  console.debug("[A] Found 2FA input");
  await page.type('input#EMAIL_OTP_CODE-0', code.substring(0, 1));
  await page.type('input#EMAIL_OTP_CODE-1', code.substring(1, 2));
  await page.type('input#EMAIL_OTP_CODE-2', code.substring(2, 3));
  await page.type('input#EMAIL_OTP_CODE-3', code.substring(3, 4));
  console.debug("[A] Typed 2FA code");
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'out3.png' });
  /*
  await page.waitForSelector('button[aria-label="Main navigation menu"]');
  console.debug("[A] Found menu button");
  await page.click('button[aria-label="Main navigation menu"]');
  await new Promise(res => setTimeout(res, 1000));
  await page.screenshot({ path: 'out3.png' });
  console.debug("[A] Clicked menu button");
  */
  await page.waitForSelector('input#location-typeahead-home-input').then(elem => elem.type(process.env.UBER_EATS_ADDRESS));
  console.debug("[A] Typed location");
  await new Promise(res => setTimeout(res, 1000));
  await page.waitForSelector('button[class="du d3 d0 ds cc dv dw al c3 dp af dx dy dz e0 e1 e2 e3 e4 dm e5"]').then(elem => elem.click());
  console.debug("[A] Clicked search button");
  await new Promise(res => setTimeout(res, 3000));
  
  const category = weighted_random(randomCategories.map(cat => cat.name), randomCategories.map(cat => cat.weight));
  console.log("Category: " + category);
  await page.goto(page.url + "&scq=" + encodeURIComponent(category), { waitUntil: 'networkidle2' });
  console.debug("[A] Navigated to category");

  const response = { code: 201, body: 'Order created' };
  await browser.close();
  return response;
}

module.exports = {
  createUberEatsOrder
}
