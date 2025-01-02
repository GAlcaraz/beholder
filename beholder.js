import puppeteer from "puppeteer";
import { URL } from "url";

async function captureWebsite(url, browser) {
  try {
    const domain = new URL(url).hostname;
    const outputPath = `${domain}.png`;

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`Capturing screenshot of ${url}`);
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    console.log(`Saving screenshot to ${outputPath}`);
    await page.screenshot({ path: outputPath });
    await page.close();
    console.log(`Done with ${domain}`);
  } catch (error) {
    console.error(`Error processing ${url}:`, error);
  }
}

async function processUrls(urls) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: "new",
  });

  try {
    // Process all URLs concurrently
    await Promise.all(
      urls.map((url) => {
        const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
        return captureWebsite(formattedUrl, browser);
      }),
    );
  } finally {
    await browser.close();
    console.log("All done!");
  }
}

// Get URLs from command line arguments (skip first two args which are node and script name)
const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error("Please provide at least one URL as an argument");
  console.error(
    "Usage: node beholder.js https://example1.com https://example2.com",
  );
  process.exit(1);
}

processUrls(urls).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
