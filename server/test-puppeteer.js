const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch();
    console.log("Launched!");
    await browser.close();
  } catch(e) {
    console.error(e);
  }
})();
