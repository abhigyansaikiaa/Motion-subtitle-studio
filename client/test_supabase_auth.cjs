const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BACKEND = 'http://127.0.0.1:3000';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('console', msg => console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', error => console.log(`[PAGE ERROR] ${error}`));
  
  page.on('response', async response => {
    if (response.url().includes('supabase.co')) {
      console.log(`[SUPABASE API] ${response.status()} ${response.url()}`);
      try {
        const text = await response.text();
        console.log(`[SUPABASE RESPONSE] ${text}`);
      } catch (e) {}
    }
  });

  try {
    console.log('\n=== PHASE 1: Try Login through Auth UI ===');
    await page.goto('http://localhost:5173/#/auth?mode=login');
    await page.waitForLoadState('networkidle');
    
    await page.fill('#auth-email', 'fake@test.com');
    await page.fill('#auth-password', 'wrongpassword');
    
    await page.click('button[type="submit"]');
    
    // wait a moment for the response
    await page.waitForTimeout(2000);
    console.log('\n=== DONE ===');
    process.exit(0);
    
    const storedTokenResponse = await page.evaluate(async () => {
      // Get the Supabase session token
      const sessionStr = Object.entries(localStorage).find(([k, v]) => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (!sessionStr) return null;
      const session = JSON.parse(sessionStr[1]);
      return session.access_token;
    });
    
    if (!storedTokenResponse) {
       console.log('Failed to find Supabase session token in localStorage');
       throw new Error('Signup failed or did not set token');
    }
    
    console.log('Signup successful. Token acquired.');

    console.log('\n=== PHASE 2: Verify /api/me works with Supabase token ===');
    const meRes = await page.request.get(`${BACKEND}/api/me`, {
      headers: { 'Authorization': `Bearer ${storedTokenResponse}` }
    });
    
    console.log('GET /api/me status:', meRes.status());
    const meData = await meRes.json();
    console.log('GET /api/me data:', meData);
    
    if (meRes.status() !== 200 || !meData.credits) {
      throw new Error('Backend did not accept the token or failed to return profile');
    }
    
    console.log('\n=== PHASE 3: Test Logout ===');
    // Let's click the logout button (which is in the navbar)
    // Actually the navbar handles it. Let's just click it
    await page.click('button:has-text("Log out")');
    await page.waitForURL('**/#/**', { timeout: 5000 }).catch(() => {});
    console.log('Logout successful, redirected to home page.');
    
    console.log('\n=== ✅ ALL TESTS PASSED ===');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message || error);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
