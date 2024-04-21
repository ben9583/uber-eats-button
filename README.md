# Uber Eats Button

*A physical, big red button that orders a random meal to your house*

![The Uber Eats Button](./.github/images/the-button.jpeg)
*The Button in all its Glory*

## About

The Uber Eats Button is a big red button that uses AI and randomness to pick out some food items on Uber Eats that constitute a meal and orders it to your house without any human intervention. The button sends a request to a server that interfaces with Uber Eats to pick a restaurant randomly and select items from the menu by asking ChatGPT to create a meal. It then places the order to the address and notifies the user with an SMS message.

![Inspiration](./.github/images/idea.png)
*The Moment of Inspiration from Peter Ruette*

## Detailed Explanation

![Architecture](./.github/images/arch.png)
*The Architecture of the Uber Eats Button Project, Divided into Server and Client*

The button itself (pictured above) is Raspberry Pi Pico W running MicroPython, hooked up to a button and an LED inside the button. When the button is plugged into a power source, it tries connecting to a WiFi network using the SSID and password saved to storage. If it fails, it goes into AP mode and appears as a WiFi network to any other device.

![Access Point](./.github/images/access-point.jpg)
*How the Uber Eats Button Access Point Appears upon Connecting*

You can use a phone or computer to connect to the button and visit the button's website (run by a from-scratch, barebones HTTP server). This lets you change the saved SSID and password, and the button will attempt to connect to the network again.

![WiFi Login Prompt](./.github/images/prompt.png)
*Login Form to Connect the Button to the Internet*

When the button successfully connects to the WiFi network and syncs with the NTP timeserver (necessary for signing JWT requests), the LED will light up for a few seconds, letting the user know the button is ready to use.

Upon pressing the button, the Pico detects the voltage change and makes a PUT request to the configured server at `/order`. The body of the request is empty but the Authorization header is `Bearer` with a JSON Web Token (JWT) of the following form:

```js
{
  "sub": "random-order",
  "iss": process.env.JWT_ISSUER,
  "aud": process.env.JWT_AUDIENCE,
  "jti": [new UUIDv4()],
  "iat": [now - 10 seconds],
  "exp": [now + 60 seconds]
}
```

The `sub` is always `"random-order"` and defines the request type. `iss` and `aud` identify the client and server, respectively. This way if you theoretically had multiple clients/servers, the request is only good for one pair. `jti` serves as an idempotency token that the server checks to prevent replay attacks. `iat` and `exp` define the lifespan for the request. The former is 10 seconds before the request to account for any discrepencies in timekeeping between the client and server.

The request uniquely identifies a client request and ensures that no one can create a fake request. The JWT is signed by a shared secret that only the server and client know.

When the server receives the request, it validates the authenticity and send an SMS message to a preconfigured phone number using Amazon Pinpoint SMS, confirming the button has been pressed. The server then creates a Puppeteer headless Chrome browser instance. It opens a tab and navigates to the Uber Eats website where it attempts to load any saved credentials into the browser cookies. These credentials are the `sid` cookie for `.ubereats.com` and the `sid` and `csid` cookies for `auth.uber.com` and last one month after being created.

If, when navigating back to the Uber Eats website the user is logged in, it moves on. Otherwise, it attempts to log in with a configured email and waits for the two-factor authentication code to be sent. It then opens a new tab to a configured Roundcubemail client, logs in, waits for the email, opens it, reads the code, then navigates to the original tab and enters it.

Next, the page searches for nearby restaurants (using a configured address) and filters by highly rated restaurants. It also only selected approved categories, removing options like grocery stores.

The restaurant is selected using a risk-based random distribution that selected restaurants based on preference. Assume you have a list of restaurants sorted by recommendation (like the Uber Eats website presents). Let *n* be the number of restaurants to choose from and *s* be a *safety* term. The probability distribution is as follows:

![Risk Equation Probability Distribution](./.github/images/risk-equation.png)
*The probability of selecting restaurant x given parameters s, n*

The safety term determines how much preference is given to the first restaurants in the list. If safety is high, the first restaurants will have a much higher probability of being selected than later restaurants, which reflects that the first restaurants are those recommended more. If safety is 0, the above function is undefined but converges to `1/n`, a uniform distribution, reflecting completely random selection. 

This probability density function satisfies the requirement that it sums to 1 over all x:

![Rule of Probability Density Functions](./.github/images/pdf-rule.png)
*The sum of the pdf over all possible values is 1 for any safety value*

Once a restaurant is selected, the browser instance loads the entire menu and parses the items by name, price, and description. It compiles these into a list and makes an OpenAI API request to get a GPT-4 response to the following prompt:

```
Here are a list of food items with prices [specific prompt details omitted, see server/src/openai.js for full prompt]:

Chicken Caesar Salad ($24.00) - romaine, croutons, walnuts, organic chicken, Parmigiano Reggiano, anchovy dressing
Farro Salad ($20.00) - Italian grain, cucumber, cherry tomatoes, red onions
Tomato Bruschetta ($18.00) - grilled crostino, chopped tomatoes, garlic, basil
[Rest of the menu...]

```

Then GPT responds like so:

```
Chicken Caesar Salad
Penne Rosa
Tiramisu
Arnold Palmer
```

The list is split and matched with the menu items, which are sequentially added to the cart one-by-one. If there are any required options for a given item, it picks randomly from this list for however many items are required. Non-required options are ignored.

The page then navigates to the checkout and the order is placed including tip and applying any available promos. The restaurant, category, order, and total price are saved and appended to a csv. Another SMS message is sent to the same number confirming the order and the expected arrival time from the value displayed on the website.

![Uber Eats Order has Arrived](./.github/images/arrival.jpeg)
*The First Successful Use of the Uber Eats Button*

If any errors occur during the order being placed, or if the order falls outside of the acceptable price range, or if ChatGPT gives items not present on the menu (sometimes happens if the menu is in two languages), the whole process is restarted from the browser being closed and reloaded. If enough errors occur, the program stops and the phone number is texted notifying of the error.

## Status Page

In addition to everything above, the server also hosts a user-friendly status page that lets people view the step-by-step process the server is doing and where it is in that process. The endpoint is available at `/order-status`.

(Example image coming soon)

## Developing

Development is split between the client and the server. These two parts of the project don't see each other as the client is deployed to the button and the server is deployed elsewhere.

### Environment Variables

I use a `.env` file at the root of the project (outside client and server) for development. Although the client can't see the environment variable file, it is still located here out of principle. These are the environment variables used:

```sh
SECRET_KEY='' # Used for shared secret between client and server.
# You can use `head -c 4096 /dev/urandom | sha512sum` to get this value
# Copy this key to client/secret.txt on your project
JWT_ISSUER='uber-eats-client.your-domain.com' # JWT identity for the button. Replace the value in client/main.py
JWT_SUBJECT='random-order' # JWT subject for the random order. Replace the value in client/main.py
JWT_AUDIENCE='uber-eats-server.your-domain.com' # JWT identity for the server. Replace the value in client/main.py
UBER_EATS_EMAIL='' # Uber Eats account login email
UBER_EATS_ADDRESS_ENCODED='' # Uber Eats encoded address
# To get this value, go to ubereats.com, enter your address into the search bar, and copy the value in the url after "&pl="
TWOFACTOR_EMAIL='' # Login email for Roundcubemail
TWOFACTOR_PASSWORD='' # Login password for Roundcubmail
OPENAI_API_KEY='sk-blahblahblah' # OpenAI API Key
OPENAI_ORGANIZATION='org-blahblahblah' # OpenAI Organization
```

### Server

Navigate into the server and do the following installation steps:

```sh
cd server
nvm use 18 # NodeJS v18 required
npm i
```

You can start a development server using `npm run dev` or simply run the server with `npm start`. There are a handful of tests that I bothered to implement for JWT validation and risk-distribution and you can run those with `npm test`.

### Client

The client is a MicroPython codebase which runs on a Raspberry Pi Pico W. This is a very low-spec device with very limited capabilities, especially on memory. Even the CSS file for the WiFi portal (client/pico.min.css, naming unrelated to the device) is too big to fit in memory, so it must be streamed.

MicroPython doesn't use the same builtin libraries as Python; check the [MicroPython docs](https://docs.micropython.org/en/latest) for more details.

## Caveats

The environment variables are not visible to the Raspberry Pi Pico. There may be some way to make this work, but I couldn't figure it out. Necessary constants are either hard-coded in or saved to text files on the Pico itself.

I know the Pico sends the request over HTTP (not HTTPS). This is because I didn't have HTTPS set up on the server until after I no longer had physical access to the button to update its code. In principal though this should be fine, since the requests themselves don't contain sensitive data and the payload is signed by a shared secret that never leaves the client or server. The payload also has an expiration time and replay attacks are defended against on the server with an idempotency token.

You will need a machine with non-trivial processing power and memory to run the server. Puppeteer is basically just Google Chrome after all and even if your system runs it, the Uber Eats website is laggy and might not load in time for everything to work.

The server looks for the two-factor authentication email by looking for a new email to show up on Roundcubemail. This assumes that no other emails arrive between the time of the 2fa request and the 2fa email arriving. This isn't a problem for me but just something to keep in mind.

After using the button a few times, the button will crash due to it being out of memory. I don't know where this memory leak is, but it's not really a problem because MicroPython reboots in just a few seconds and you can just press the button again without doing anything else.

The order status page dynamically updates the website by sending a get request to `/order` every 3 seconds. This is not scalable but is appropriate for my needs.
