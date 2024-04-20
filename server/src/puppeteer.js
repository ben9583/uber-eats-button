const p = require("puppeteer");
const fs = require("fs");

/** @type {typeof p} */
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

const { selectItems } = require("./openai");
const { risk_distribution, weighted_random } = require("./utils");
const { sendSMSMessage } = require("./pinpoint");

/** @typedef {{ enteringEmail: boolean, gettingTwoFactor: boolean, enteringTwoFactor: boolean }} CredentialsStatus */
/** @typedef {{ name: string, image: string }} Category */
/** @typedef {{ name: string, image: string }} Restaurant */
/** @typedef {{ name: string, image: string, price: string, description: string}} MenuItem */
/** @typedef {{ credentials: boolean | CredentialsStatus, category: Category | undefined, restaurant: Restaurant | undefined, menuItems: MenuItem[] | undefined, addingItems: boolean, ordered: boolean }} StatusData */
/** @typedef {{ status: number, message: string, data: StatusData, start: string, end: string | undefined }} Status */
/** @type {Map<string, Status>} */
const statuses = new Map();

const num_restaurants = 16; // Number of restaurants to consider
const safety = 3.0; // Safety factor for the risk distribution (see risk_distribution)

const randomCategories = [
  { name: "Pizza", weight: 100 },
  { name: "Sushi", weight: 40 },
  { name: "Chinese", weight: 60 },
  { name: "Sandwich", weight: 60 },
  { name: "Soup", weight: 40 },
  { name: "Mexican", weight: 100 },
  { name: "Thai", weight: 50 },
  { name: "Korean", weight: 40 },
  { name: "Poke", weight: 30 },
  { name: "Indian", weight: 60 },
  { name: "BBQ", weight: 30 },
  { name: "Italian", weight: 100 },
  { name: "Japanese", weight: 40 },
  { name: "Vietnamese", weight: 30 },
  { name: "Halal", weight: 30 },
  { name: "Greek", weight: 40 },
  { name: "American", weight: 100 },
  { name: "Caribbean", weight: 30 },
];

// const randomCategories = [{ name: "Pizza", weight: 100 }];

/**
 * Scrolls to the bottom of the page
 * @param {p.Page} page The puppeteer page
 */
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 100;
      var timer = setInterval(() => {
        var scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });
}

/**
 * Creates an Uber eats session by loading in the saved credentials at creds/ubereats.com.json and creds/auth.uber.com.json if present, otherwise going through the 2fa login process.
 * @param {p.Browser} browser The puppeteer browser instance
 * @param {string} orderId The ID of the order
 */
const loadUberEatsSession = async (browser, orderId) => {
  const ubereatsCreds = fs.existsSync("creds/ubereats.com.json")
    ? JSON.parse(fs.readFileSync("creds/ubereats.com.json"))
    : null;
  const authCreds = fs.existsSync("creds/auth.uber.com.json")
    ? JSON.parse(fs.readFileSync("creds/auth.uber.com.json"))
    : null;
  if (ubereatsCreds && authCreds) {
    console.info("[A] Loading credentials");
    const page = await browser.newPage();
    await page.goto("https://www.ubereats.com/", { waitUntil: "networkidle2" });
    await page.setCookie(...ubereatsCreds);
    await page.goto("https://auth.uber.com", { waitUntil: "networkidle2" });
    await page.setCookie(...authCreds);

    console.info("[A] Verifying credentials");
    await page.goto("https://ubereats.com/login-redirect", {
      waitUntil: "networkidle2",
    });
    await new Promise((res) => setTimeout(res, 3000));
    const success = !(await page.content()).includes(
      "What's your phone number or email?"
    );
    await page.close();
    if (success) {
      console.info("[A] Loaded credentials");
      statuses.get(orderId).data.credentials = true;
      return;
    }
    console.info("[A] Failed to load credentials");
  } else {
    console.info("[A] No credentials found");
  }

  statuses.get(orderId).data.credentials = {
    enteringEmail: false,
    gettingTwoFactor: false,
    enteringTwoFactor: false,
  };

  const page = await browser.newPage();
  console.info("[A] Uber Eats page created");
  const page2fa = await browser.newPage();
  console.info("[B] 2FA page created");

  const mailPromise = new Promise(async (res) => {
    await page2fa.goto("https://mail.ben9583.com/", {
      waitUntil: "networkidle2",
    });
    console.info("[B] Navigated to mail login page");
    await page2fa
      .waitForSelector("input#rcmloginuser")
      .then((elem) => elem.type(process.env.TWOFACTOR_EMAIL, { delay: 100 }));
    console.info("[B] Typed email input");
    await page2fa
      .waitForSelector("input#rcmloginpwd")
      .then((elem) =>
        elem.type(process.env.TWOFACTOR_PASSWORD, { delay: 100 })
      );
    console.info("[B] Typed password input");
    await page2fa
      .waitForSelector("button#rcmloginsubmit")
      .then((elem) => elem.click());
    console.info("[B] Clicked login button");
    await page2fa.screenshot({ path: "out2.png" });
    res();
  });

  await page.goto("https://www.ubereats.com/", { waitUntil: "networkidle2" });
  console.info("[A] Navigated to Uber Eats page");
  await page
    .waitForSelector('a[data-test="header-sign-in"]')
    .then((elem) => new Promise((res) => setTimeout(() => res(elem), 1000)))
    .then(
      (elem) =>
        new Promise((res) =>
          page.screenshot({ path: "out.png" }).then(() => res(elem))
        )
    )
    .then((elem) => elem.click())
    .then(() => page.waitForNavigation({ waitUntil: "networkidle2" }));
  console.info("[A] Clicked sign in button");
  await page
    .waitForSelector("input#PHONE_NUMBER_or_EMAIL_ADDRESS")
    .then((elem) => elem.type(process.env.UBER_EATS_EMAIL, { delay: 100 }));
  console.info("[A] Typed email");
  await page
    .waitForSelector("button#forward-button")
    .then((elem) => new Promise((res) => setTimeout(() => res(elem), 1000)))
    .then(
      (elem) =>
        new Promise((res) =>
          page.screenshot({ path: "out.png" }).then(() => res(elem))
        )
    )
    .then((elem) => elem.click());
  console.info("[A] Clicked next button");
  await page.screenshot({ path: "out.png" });

  statuses.get(orderId).data.credentials.enteringEmail = true;

  await mailPromise;
  console.info("[B] Logged in to mail");
  await new Promise((res) => setTimeout(res, 6000));
  await page2fa.reload({ waitUntil: "networkidle2" });
  console.info("[B] Reloaded mail");
  await page2fa
    .waitForSelector('span[title="admin@uber.com"]')
    .then((elem) => new Promise((res) => setTimeout(() => res(elem), 2000)))
    .then(
      (elem) =>
        new Promise((res) =>
          page2fa.screenshot({ path: "out2.png" }).then(() => res(elem))
        )
    )
    .then((elem) => elem.click());
  console.info("[B] Clicked email");
  await new Promise((res) => setTimeout(res, 4000));
  await page2fa.screenshot({ path: "out2.png" });
  const frame = await page2fa
    .waitForSelector("iframe#messagecontframe")
    .then((elem) => elem.contentFrame());
  console.info("[B] Found iframe");
  const codeElem = await frame.waitForSelector("td.v1p2b");
  console.info("[B] Found code element");
  const code = await frame.evaluate(
    (codeElem) => codeElem.textContent,
    codeElem
  );
  console.info("[B] Got code");
  console.log("2FA code: " + code);
  await page2fa.screenshot({ path: "out2.png" });

  statuses.get(orderId).data.credentials.gettingTwoFactor = true;

  await page.waitForSelector("input#EMAIL_OTP_CODE-0");
  console.info("[A] Found 2FA input");
  await page.type("input#EMAIL_OTP_CODE-0", code.substring(0, 1), {
    delay: 100,
  });
  await page.type("input#EMAIL_OTP_CODE-1", code.substring(1, 2), {
    delay: 120,
  });
  await page.type("input#EMAIL_OTP_CODE-2", code.substring(2, 3), {
    delay: 84,
  });
  await page.type("input#EMAIL_OTP_CODE-3", code.substring(3, 4), {
    delay: 130,
  });
  console.info("[A] Typed 2FA code");
  await new Promise((res) => setTimeout(res, 3000));
  await page.screenshot({ path: "out3.png" });

  if (!fs.existsSync("creds")) {
    fs.mkdirSync("creds");
  }

  await page
    .cookies()
    .then((cookies) =>
      fs.writeFileSync(
        "creds/ubereats.com.json",
        JSON.stringify(cookies, null, 2)
      )
    );
  await page.goto("https://auth.uber.com", { waitUntil: "networkidle2" });
  await page
    .cookies()
    .then((cookies) =>
      fs.writeFileSync(
        "creds/auth.uber.com.json",
        JSON.stringify(cookies, null, 2)
      )
    );
  console.info("[A] Saved credentials");

  await page.close();
  await page2fa.close();

  statuses.get(orderId).data.credentials.enteringTwoFactor = true;
};

const MAX_TRIES = 5;

/**
 * Create an Uber Eats order. Code will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @param {string} orderId The ID of the order
 * @param {(success: boolean) => void} callback A callback function to be called when processing is complete, with a boolean indicating success
 * @returns {Promise<{code: number, body: string}>} A promise that resolves to an object with a code and a body
 */
const createUberEatsOrder = async (orderId, callback, fallback = 0) => {
  try {
    statuses.set(orderId, {
      status: 200,
      message: "Processing",
      data: { credentials: false, addingItems: false, ordered: false },
      start: new Date().toISOString(),
    });

    sendSMSMessage(
      "The Uber Eats Button has been pressed and the order is being created. A confirmation message will be sent when the order has been placed."
    ).catch((reason) => console.warn("SMS message failed to send: " + reason));

    const browser = await puppeteer.launch({
      headless: "new",
      executablePath: p.executablePath(),
    });

    await loadUberEatsSession(browser, orderId);

    const page = await browser.newPage();
    await page.goto("https://www.ubereats.com/", { waitUntil: "networkidle2" });
    await new Promise((res) => setTimeout(res, 3000));

    console.log("[A] Clearing any carts");
    await page.$eval("html", (_) => {
      fetch("https://www.ubereats.com/_p/api/getDraftOrdersByEaterUuidV1", {
        credentials: "include",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0",
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.5",
          "Content-Type": "application/json",
          "x-uber-client-gitref": "08f5b0e0cafe4913fbe961d81458c65199daa913",
          "x-csrf-token": "x",
          "Alt-Used": "www.ubereats.com",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          "Sec-GPC": "1",
          Pragma: "no-cache",
          "Cache-Control": "no-cache",
        },
        referrer:
          "https://www.ubereats.com/feed?diningMode=DELIVERY&pl=sensitive-information-redacted",
        body: '{"inNoGetDraftOrdersCookie":true,"currencyCode":"USD"}',
        method: "POST",
        mode: "cors",
      })
        .then((res) => res.json())
        .then((data) => {
          data.data.cartsView.carts.forEach((order) => {
            fetch("https://www.ubereats.com/_p/api/discardDraftOrdersV1", {
              credentials: "include",
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:124.0) Gecko/20100101 Firefox/124.0",
                Accept: "*/*",
                "Accept-Language": "en-US,en;q=0.5",
                "Content-Type": "application/json",
                "x-uber-client-gitref":
                  "08f5b0e0cafe4913fbe961d81458c65199daa913",
                "x-csrf-token": "x",
                "Alt-Used": "www.ubereats.com",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                "Sec-GPC": "1",
                Pragma: "no-cache",
                "Cache-Control": "no-cache",
              },
              referrer:
                "https://www.ubereats.com/feed?diningMode=DELIVERY&pl=sensitive-information-redacted",
              body: `{\"draftOrderUUIDs\":[\"${order.draftOrderUUID}\"]}`,
              method: "POST",
              mode: "cors",
            });
          });
        });
    });
    await new Promise((res) => setTimeout(res, 3000));

    const category = weighted_random(
      randomCategories.map((cat) => cat.name),
      randomCategories.map((cat) => cat.weight)
    );
    console.log("Category: " + category);
    await page.goto(
      page.url() +
        "&sf=JTVCJTdCJTIydXVpZCUyMiUzQSUyMmIxOWM4OTc4LTIwM2MtNGE4OS1hMjNlLWU0ODQyZmViZTRmZiUyMiUyQyUyMm9wdGlvbnMlMjIlM0ElNUIlN0IlMjJ1dWlkJTIyJTNBJTIyMmM3Y2Y3ZWYtNzMwZi00MzFmLTkwNzItMjZiYzM5ZjdjMDQyJTIyJTdEJTVEJTdEJTVE&scq=" +
        encodeURIComponent(category),
      {
        waitUntil: "networkidle2",
      }
    );
    console.info("[A] Navigated to category");
    await new Promise((res) => setTimeout(res, 3000));
    await page.screenshot({ path: "out3.png" });

    statuses.get(orderId).data.category = {
      name: category,
      image: `https://cn-geo1.uber.com/static/mobile-content/eats/cuisine-filters/v1/${category}.png`,
    };

    console.info("[A] Finding restaurant");
    const restaurant = weighted_random(
      [...Array(num_restaurants).keys()],
      risk_distribution(num_restaurants, safety)
    );
    const restaurantLink = await page.$$eval(
      'a[data-testid="store-card"]',
      (elems, restaurant) => elems[restaurant].href,
      restaurant
    );
    await page.goto(restaurantLink, { waitUntil: "networkidle2" });
    console.info("[A] Navigated to restaurant");
    await new Promise((res) => setTimeout(res, 3000));
    await page.screenshot({ path: "out3.png" });

    const restaurantName = (await page.title()).split(" Menu ")[0].substring(6);
    console.log("Restaurant: " + restaurantName);
    const restaurantImage = await page
      .waitForSelector("img[role='presentation']")
      .then((elem) => elem.getProperty("src"))
      .then((src) => src.jsonValue());

    statuses.get(orderId).data.restaurant = {
      name: restaurantName,
      image: restaurantImage,
    };

    // Necessary to load lazy-loaded images
    await autoScroll(page);

    const items = await page.$$eval(
      'button[data-testid="quick-add-button"]',
      (elems) =>
        elems.map((elem) => {
          const correctElem =
            elem.parentElement.parentElement.parentElement.parentElement;
          const text = correctElem.innerText;
          let textItems = text.split("\n");
          const elemUuid = correctElem.parentElement.getAttribute("data-test");
          if (elemUuid === null) return;
          if (textItems.length === 2) {
            return {
              name: textItems[0].trim(),
              price: textItems[1],
              image:
                correctElem.querySelector("source")?.srcset ??
                "https://d3i4yxtzktqr9n.cloudfront.net/web-eats-v2/beb05a8bec7f3b14.png",
              elementId: elemUuid,
            };
          } else if (textItems.length >= 3) {
            if (
              textItems[textItems.length - 1].charAt(
                textItems[textItems.length - 1].length - 1
              ) == ")"
            )
              textItems = textItems.slice(0, textItems.length - 1);
            return textItems.length > 2
              ? {
                  name: textItems[0].trim(),
                  price: textItems[1],
                  image:
                    correctElem.querySelector("source")?.srcset ??
                    "https://d3i4yxtzktqr9n.cloudfront.net/web-eats-v2/beb05a8bec7f3b14.png",
                  information: textItems.slice(2).join(" | "),
                  elementId: elemUuid,
                }
              : {
                  name: textItems[0].trim(),
                  price: textItems[1],
                  image:
                    correctElem.querySelector("source")?.srcset ??
                    "https://d3i4yxtzktqr9n.cloudfront.net/web-eats-v2/beb05a8bec7f3b14.png",
                  elementId: elemUuid,
                };
          }
        })
    );

    const uniqueItems = [];
    const seenItems = new Set();
    for (const item of items) {
      if (item && !seenItems.has(item.name)) {
        seenItems.add(item.name);
        uniqueItems.push(item);
      }
    }

    statuses.get(orderId).data.menuItems = [];

    console.log(`Found ${uniqueItems.length} items`);
    console.info("[A] Querying OpenAI");
    const selectedItems = await selectItems(restaurantName, uniqueItems);

    if (selectedItems.length === 0) {
      console.log("No items selected, retrying");
      createUberEatsOrder(orderId, callback);
      return;
    }

    statuses.get(orderId).data.menuItems = selectedItems.map((item) => ({
      name: item.name,
      image: item.image,
      price: item.price,
      description: item.information,
    }));

    for (const item of selectedItems) {
      console.info(`[A] Adding ${item.name} to cart`);
      await page
        .waitForSelector(`li[data-test="${item.elementId}"] a`)
        .then((elem) => elem.click());
      await new Promise((res) => setTimeout(res, 2000));
      await page.$$eval(
        "div[data-testid='customization-pick-one'], div[data-testid='customization-pick-many']",
        (elems) =>
          elems.forEach((elem) => {
            if (!elem.textContent.includes("Required")) return;
            const options = elem.querySelectorAll("input");
            const randomOption =
              options[Math.floor(Math.random() * options.length)];
            randomOption.click();
          })
      );
      await new Promise((res) => setTimeout(res, 2000));
      await page
        .waitForSelector('div[data-test="add-to-cart-cta"] button')
        .then((elem) => elem.click());
      await new Promise((res) => setTimeout(res, 6000));
      await page.reload({ waitUntil: "networkidle2" });
      await new Promise((res) => setTimeout(res, 3000));
    }

    statuses.get(orderId).data.addingItems = true;

    await page.goto("https://www.ubereats.com/checkout"); // networkidle2 doesn't work here; perpetually loading
    console.info("[A] Navigated to checkout");
    await new Promise((res) => setTimeout(res, 10000));

    await page.mouse.click(10, 100);
    await new Promise((res) => setTimeout(res, 5000));

    const price = await page.$$eval("hr", (elems) => {
      const priceElem = elems[elems.length - 1].nextElementSibling;
      return parseFloat(priceElem.textContent.split("$")[1]);
    });

    if (price < 20 || price > 80) {
      console.log("Price out of range, retrying");
      createUberEatsOrder(orderId, callback);
      return;
    }

    await page
      .waitForSelector('div[data-test="place-order-btn"] button')
      .then((elem) => elem.click());

    await new Promise((res) => setTimeout(res, 30000));
    await page.screenshot({ path: "out3.png" });

    const estimatedArrival = await page
      .waitForSelector('div[data-testid="active-order-sticky-eta"]')
      .then((elem) => elem.evaluate((elem) => elem.textContent));

    const splits = estimatedArrival.split(" ");
    const time = splits[splits.length - 2] + " " + splits[splits.length - 1];

    sendSMSMessage(
      "Your order has been placed and is estimated to arrive at " + time + "."
    ).catch((reason) => console.warn("SMS message failed to send: " + reason));

    await browser.close();

    statuses.get(orderId).data.ordered = true;
    statuses.get(orderId).status = 201;
    statuses.get(orderId).message = "Created";
    statuses.get(orderId).end = new Date().toISOString();

    try {
      fs.mkdirSync("out");
    } catch (e) {}

    if (!fs.existsSync(`out/orders.csv`)) {
      fs.writeFileSync(
        `out/orders.csv`,
        "time,restaurant,category,items,price\n"
      );
    }

    fs.appendFileSync(
      "out/orders.csv",
      `${new Date().toISOString()},${restaurantName},${category},${selectedItems
        .map((item) => item.name)
        .join(";")},${price}\n`
    );
    callback(true);
  } catch (error) {
    console.error(error);

    if (fallback < MAX_TRIES) {
      createUberEatsOrder(orderId, callback, fallback + 1);
      return;
    }

    sendSMSMessage(
      "An order failed to place " +
        fallback +
        " times. Please check the logs for more information."
    ).catch((reason) => console.warn("SMS message failed to send: " + reason));

    statuses.get(orderId).status = 500;
    statuses.get(orderId).message = "Internal server error";
    statuses.get(orderId).end = new Date().toISOString();
    callback(false);
  }
};

const getUberEatsOrderStatus = (orderId) => {
  return statuses.get(orderId);
};

module.exports = {
  createUberEatsOrder,
  getUberEatsOrderStatus,
};
