import puppeteer from 'puppeteer';

export default async function handler(req, res) {
  const { Body } = req.body;
  console.log("🔍 Method:", req.method);
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  console.log("📩 Incoming message body:", Body);

  const urlMatch = Body.match(/https?:\/\/\S+/);
  const url = urlMatch ? urlMatch[0] : null;

  if (!url) {
    console.log("❌ No URL found in the message.");
    return res.status(400).json({ error: 'No URL found in message body' });
  }

  console.log("🔗 Extracted URL:", url);

  const browser = await puppeteer.launch({
    headless: true,  // Ensure headless mode for faster execution
    args: ['--no-sandbox', '--disable-setuid-sandbox'],  // Necessary flags for cloud environments
  });
  const page = await browser.newPage();

  // Disable images and other unnecessary resources
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.resourceType() === 'image' || req.resourceType() === 'stylesheet' || req.resourceType() === 'font') {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    console.log("🌐 Navigating to the page...");
    await page.goto(url, { waitUntil: 'load' });  // Wait until the page is fully loaded

    console.log("⏱️ Checking for the 'Opportunity Claimed!' message...");
    const claimedMessage = await page.evaluate(() => {
      return document.body.innerText.includes('Opportunity Claimed!');
    });

    if (claimedMessage) {
      console.log("⚠️ Opportunity has already been claimed.");
      await browser.close();
      return res.status(200).json({ message: 'Opportunity already claimed.' });
    }

    console.log("⏱️ Searching for the Claim Opportunity button...");
    const button = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.find(button => button.textContent.includes('Claim Opportunity')) || null;
    });

    if (button) {
      console.log("✅ Button found! Clicking...");
      await button.click();
      await browser.close();
      console.log("🚀 Button clicked. Browser closed.");
      return res.status(200).json({ message: 'Claim Opportunity button clicked!' });
    } else {
      console.log("⚠️ Button not found — maybe already claimed.");
      await browser.close();
      return res.status(200).json({ message: 'Button not found — maybe opportunity already claimed.' });
    }
  } catch (err) {
    console.log("💥 Error occurred:", err.message);
    await browser.close();
    return res.status(500).json({ error: 'Something went wrong.', details: err.message });
  }
}
