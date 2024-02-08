const p = require('puppeteer');
const fs = require('fs');

/** @type {typeof p} */
const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const { selectItems } = require('./openai');
const { risk_distribution, weighted_random } = require('./utils');


const num_restaurants = 16; // Number of restaurants to consider
const safety = 5.0; // Safety factor for the risk distribution (see risk_distribution)

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
 * Creates an Uber eats session by loading in the saved credentials at creds/ubereats.com.json and creds/auth.uber.com.json if present, otherwise going through the 2fa login process.
 * @param {p.Browser} browser The puppeteer browser instance
 */
const loadUberEatsSession = async (browser) => {
  const ubereatsCreds = fs.existsSync('creds/ubereats.com.json') ? JSON.parse(fs.readFileSync('creds/ubereats.com.json')) : null;
  const authCreds = fs.existsSync('creds/auth.uber.com.json') ? JSON.parse(fs.readFileSync('creds/auth.uber.com.json')) : null;
  if(ubereatsCreds && authCreds) {
    console.info("[A] Loading credentials")
    const page = await browser.newPage();
    await page.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });
    await page.setCookie(...ubereatsCreds);
    await page.goto('https://auth.uber.com', { waitUntil: 'networkidle2' });
    await page.setCookie(...authCreds);

    console.info("[A] Verifying credentials")
    await page.goto('https://ubereats.com/login-redirect', { waitUntil: 'networkidle2' });
    await new Promise(res => setTimeout(res, 3000));
    const success = !((await page.content()).includes("What's your phone number or email?"))
    await page.close();
    if(success) {
      console.info("[A] Loaded credentials")
      return
    }
    console.info("[A] Failed to load credentials")
  } else {
    console.info("[A] No credentials found")
  }

  const page = await browser.newPage();
  console.info("[A] Uber Eats page created")
  const page2fa = await browser.newPage();
  console.info("[B] 2FA page created")

  const mailPromise = new Promise(async res => {
    await page2fa.goto('https://mail.ben9583.com/', { waitUntil: 'networkidle2' });
    console.info("[B] Navigated to mail login page")
    await page2fa.waitForSelector('input#rcmloginuser').then(elem => elem.type(process.env.TWOFACTOR_EMAIL, { delay: 100 }));
    console.info("[B] Typed email input")
    await page2fa.waitForSelector('input#rcmloginpwd').then(elem => elem.type(process.env.TWOFACTOR_PASSWORD, { delay: 100 }));
    console.info("[B] Typed password input")
    await page2fa.waitForSelector('button#rcmloginsubmit').then(elem => elem.click());
    console.info("[B] Clicked login button")
    await page2fa.screenshot({ path: 'out2.png' });
    res();
  })

  await page.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });
  console.info("[A] Navigated to Uber Eats page")
  await page.waitForSelector('a[data-test="header-sign-in"]')
            .then(elem => new Promise(res => setTimeout(() => res(elem), 1000)))
            .then(elem => new Promise(res => page.screenshot({ path: 'out.png' }).then(() => res(elem))))
            .then(elem => elem.click())
            .then(() => page.waitForNavigation({ waitUntil: 'networkidle2' }));
  console.info("[A] Clicked sign in button")
  await page.waitForSelector('input#PHONE_NUMBER_or_EMAIL_ADDRESS').then(elem => elem.type(process.env.UBER_EATS_EMAIL, { delay: 100 }));
  console.info("[A] Typed email")
  await page.waitForSelector('button#forward-button')
            .then(elem => new Promise(res => setTimeout(() => res(elem), 1000)))
            .then(elem => new Promise(res => page.screenshot({ path: 'out.png' }).then(() => res(elem))))
            .then(elem => elem.click());
  console.info("[A] Clicked next button")
  await page.screenshot({ path: 'out.png' });

  await mailPromise;
  console.info("[B] Logged in to mail")
  await new Promise(res => setTimeout(res, 6000));
  await page2fa.reload({ waitUntil: 'networkidle2' });
  console.info("[B] Reloaded mail");
  await page2fa.waitForSelector('span[title="admin@uber.com"]')
               .then(elem => new Promise(res => setTimeout(() => res(elem), 2000)))
               .then(elem => new Promise(res => page2fa.screenshot({ path: 'out2.png' }).then(() => res(elem))))
               .then(elem => elem.click());
  console.info("[B] Clicked email");
  await new Promise(res => setTimeout(res, 4000));
  await page2fa.screenshot({ path: 'out2.png' });
  const frame = await page2fa.waitForSelector('iframe#messagecontframe').then(elem => elem.contentFrame());
  console.info("[B] Found iframe")
  const codeElem = await frame.waitForSelector('td.v1p2b');
  console.info("[B] Found code element");
  const code = await frame.evaluate(codeElem => codeElem.textContent, codeElem);
  console.info("[B] Got code");
  console.log("2FA code: " + code);
  await page2fa.screenshot({ path: 'out2.png' });

  await page.waitForSelector('input#EMAIL_OTP_CODE-0');
  console.info("[A] Found 2FA input");
  await page.type('input#EMAIL_OTP_CODE-0', code.substring(0, 1), { delay: 100 });
  await page.type('input#EMAIL_OTP_CODE-1', code.substring(1, 2), { delay: 120 });
  await page.type('input#EMAIL_OTP_CODE-2', code.substring(2, 3), { delay: 84 });
  await page.type('input#EMAIL_OTP_CODE-3', code.substring(3, 4), { delay: 130 });
  console.info("[A] Typed 2FA code");
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'out3.png' });

  if (!fs.existsSync('creds')) {
    fs.mkdirSync('creds');
  }

  await page.cookies().then(cookies => fs.writeFileSync('creds/ubereats.com.json', JSON.stringify(cookies, null, 2)));
  await page.goto('https://auth.uber.com', { waitUntil: 'networkidle2' });
  await page.cookies().then(cookies => fs.writeFileSync('creds/auth.uber.com.json', JSON.stringify(cookies, null, 2)));
  console.info("[A] Saved credentials");

  await page.close();
  await page2fa.close();
}

/**
 * Create an Uber Eats order. Code will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @returns {Promise<{code: number, body: string}>} A promise that resolves to an object with a code and a body
 */
const createUberEatsOrder = async () => {
  const browser = await puppeteer.launch({ headless: false, executablePath: p.executablePath() });

  await loadUberEatsSession(browser);

  const page = await browser.newPage();
  await page.goto('https://www.ubereats.com/', { waitUntil: 'networkidle2' });
  await new Promise(res => setTimeout(res, 3000));
  
  const category = weighted_random(randomCategories.map(cat => cat.name), randomCategories.map(cat => cat.weight));
  console.log("Category: " + category);
  await page.goto(page.url() + "&scq=" + encodeURIComponent(category), { waitUntil: 'networkidle2' });
  console.info("[A] Navigated to category");
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'out3.png' });

  console.info("[A] Finding restaurant");
  const restaurant = weighted_random([...Array(num_restaurants).keys()], risk_distribution(num_restaurants, safety));
  const restaurantLink = await page.$$eval('a[data-testid="store-card"]', (elems, restaurant) => elems[restaurant].href, restaurant);
  await page.goto(restaurantLink, { waitUntil: 'networkidle2' });
  console.info("[A] Navigated to restaurant");
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'out3.png' });

  const restaurantName = (await page.title()).split(" Menu ")[0].substring(6);
  console.log("Restaurant: " + restaurantName);

  const items = await page.$$eval('button[data-testid="quick-add-button"]', elems => elems.map(elem => {
    const correctElem = elem.parentElement.parentElement.parentElement.parentElement;
    const text = correctElem.innerText;
    let textItems = text.split("\n");
    const elemUuid = correctElem.parentElement.getAttribute("data-test");
    if(elemUuid === null) return;
    if(textItems.length === 2) {
      return {
        name: textItems[0].trim(),
        price: textItems[1],
        elementId: elemUuid,
      };
    } else if(textItems.length >= 3) {
      console.log(textItems[textItems.length - 1])
      console.log(textItems[textItems.length - 1].charAt(textItems[textItems.length - 1].length - 1))
      if(textItems[textItems.length - 1].charAt(textItems[textItems.length - 1].length - 1) == ')') textItems = textItems.slice(0, textItems.length - 1);
      return textItems.length > 2 ? {
        name: textItems[0].trim(),
        price: textItems[1],
        information: textItems.slice(2).join(" | "),
        elementId: elemUuid,
      } : {
        name: textItems[0].trim(),
        price: textItems[1],
        elementId: elemUuid,
      };
    }
  }));

  console.log(items)
  const uniqueItems = [];
  const seenItems = new Set();
  for(const item of items) {
    if(item && !seenItems.has(item.name)) {
      seenItems.add(item.name);
      uniqueItems.push(item);
    }
  }

  console.log(`Found ${uniqueItems.length} items`);
  console.info("[A] Querying OpenAI");
  const selectedItems = await selectItems(restaurantName, uniqueItems);

  for(const item of selectedItems) {
    console.info(`[A] Adding ${item.name} to cart`)
    await page.waitForSelector(`li[data-test="${item.elementId}"] a`).then(elem => elem.click());
    await new Promise(res => setTimeout(res, 1000));
    await page.$$eval("div[data-testid='customization-pick-one'], div[data-testid='customization-pick-many']", elems => elems.forEach(elem => {
      if(!elem.textContent.includes("Required")) return;
      const options = elem.querySelectorAll("input");
      const randomOption = options[Math.floor(Math.random() * options.length)];
      randomOption.click();
    }));
    await new Promise(res => setTimeout(res, 1000));
    await page.waitForSelector('button[aria-label="Add 1 to order"]').then(elem => elem.click());
    await new Promise(res => setTimeout(res, 7000));
    await page.reload({ waitUntil: 'networkidle2' });
    await new Promise(res => setTimeout(res, 3000));
  }

  await page.goto('https://www.ubereats.com/checkout', { waitUntil: 'networkidle2' });
  console.info("[A] Navigated to checkout");
  await new Promise(res => setTimeout(res, 3000));
  await page.screenshot({ path: 'out3.png' });

  const response = { code: 201, body: 'Order created' };
  await browser.close();
  return response;
}

module.exports = {
  createUberEatsOrder
}
