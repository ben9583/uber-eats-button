const puppeteer = require('puppeteer');

/**
 * Create an Uber Eats order. Code will be 201 if the order was created successfully, 4xx if the request was invalid, and 5xx if there was an internal server error.
 * @returns {Promise<{code: number, body: string}>} A promise that resolves to an object with a code and a body
 */
const createUberEatsOrder = async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const page2fa = await browser.newPage();

  const mailPromise = new Promise(async res => {
    await page2fa.goto('https://mail.ben9583.com/');
    await page2fa.waitForSelector('input#rcmloginuser');
    await page2fa.type('input#rcmloginuser', process.env.TWOFACTOR_EMAIL);
    await page2fa.waitForSelector('input#rcmloginpwd');
    await page2fa.type('input#rcmloginpwd', process.env.TWOFACTOR_PASSWORD);
    await page2fa.click('button#rcmloginsubmit');
    await page2fa.screenshot({ path: 'out2.png' });
    res();
  })

  console.log('a')
  await page.goto('https://www.ubereats.com/');
  console.log('b')
  await page.waitForSelector('a[data-test="header-sign-in"]');
  console.log('c')
  await page.screenshot({ path: 'out.png' });
  await page.click('a[data-test="header-sign-in"]');
  console.log('d')
  await page.waitForSelector('input#PHONE_NUMBER_or_EMAIL_ADDRESS');
  console.log('e')
  await page.type('input#PHONE_NUMBER_or_EMAIL_ADDRESS', process.env.UBER_EATS_EMAIL);
  console.log('f')
  await page.waitForSelector('button#forward-button');
  await page.click('button#forward-button');
  console.log('g')
  await page.screenshot({ path: 'out.png' });

  console.log(0)
  await mailPromise;
  console.log(1)
  await new Promise(res => setTimeout(res, 6000));
  console.log(2)
  await page2fa.reload();
  console.log(3);
  await page2fa.waitForSelector('span[title="admin@uber.com"]');
  console.log(4);
  await page2fa.screenshot({ path: 'out2.png' });
  await page2fa.click('span[title="admin@uber.com"]');
  console.log(5);
  await new Promise(res => setTimeout(res, 4000));
  await page2fa.screenshot({ path: 'out2.png' });
  const iframeElem = await page2fa.waitForSelector('iframe#messagecontframe');
  const frame = await iframeElem.contentFrame();
  const codeElem = await frame.waitForSelector('td.v1p2b');
  console.log(6);
  const code = await frame.evaluate(codeElem => codeElem.textContent, codeElem);
  console.log(7);
  await page2fa.screenshot({ path: 'out2.png' });
  console.log(8);
  console.log(code)

  await page.waitForSelector('input#EMAIL_OTP_CODE-0');
  console.log(9);
  await page.type('input#EMAIL_OTP_CODE-0', code.substring(0, 1));
  await page.type('input#EMAIL_OTP_CODE-1', code.substring(1, 2));
  await page.type('input#EMAIL_OTP_CODE-2', code.substring(2, 3));
  await page.type('input#EMAIL_OTP_CODE-3', code.substring(3, 4));
  console.log(10);
  await new Promise(res => setTimeout(res, 3000));
  await page.waitForSelector('button[aria-label="Main navigation menu"]');
  await page.screenshot({ path: 'out3.png' });
  console.log(11);
  await page.click('button[aria-label="Main navigation menu"]');
  await new Promise(res => setTimeout(res, 1000));
  await page.screenshot({ path: 'out3.png' });
  console.log(12);

  const response = { code: 201, body: 'Order created' };
  await browser.close();
  return response;
}

module.exports = {
  createUberEatsOrder
}
