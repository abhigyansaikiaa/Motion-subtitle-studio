const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: 'new'});
  const page = await browser.newPage();
  await page.setContent('<div style="width:1080px;height:1920px;background:rgba(255,0,0,0.5)">TEST</div>');
  
  const client = await page.target().createCDPSession();
  
  const N = 100;
  
  const t1 = performance.now();
  for(let i=0; i<N; i++) {
    await page.screenshot({type: 'png', omitBackground: true});
  }
  const t2 = performance.now();
  console.log('Puppeteer screenshot:', (t2-t1)/N, 'ms/frame');
  
  const t3 = performance.now();
  for(let i=0; i<N; i++) {
    const { data } = await client.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
    Buffer.from(data, 'base64');
  }
  const t4 = performance.now();
  console.log('CDP captureScreenshot:', (t4-t3)/N, 'ms/frame');
  
  await browser.close();
})();
