import puppeteer from "puppeteer";
import path from "path";
import fs from "fs"; // Add this import
import { loadStorage, addToStorage } from "./puppet.js";
import { toKebabCase } from "./utils.js";

async function captureNewsletterScreenshot(
  url,
  browser,
  newsletterName,
  force = false,
) {
  try {
    const filename = `${toKebabCase(newsletterName)}.png`;
    const outputDir = path.join(process.cwd(), "images");

    const outputPath = path.join(outputDir, filename);

    if (fs.existsSync(outputPath) && !force) {
      console.log(
        `Screenshot already exists for ${newsletterName}, skipping...`,
      );
      return 0;
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1024, height: 768 });

    console.log(`Capturing screenshot of ${url} for ${newsletterName}`);
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });
    await new Promise((r) => setTimeout(r, 5000));

    console.log(`Saving screenshot to ${outputPath}`);
    await page.screenshot({ path: outputPath });
    await page.close();

    return {
      success: true,
      imagePath: `images/newsletters/${filename}`, // Relative path for storage
    };
  } catch (error) {
    console.error(
      `Error capturing screenshot for ${newsletterName} (${url}):`,
      error,
    );
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function generateNewsletterScreenshots(force = false) {
  const storage = await loadStorage();
  const newslettersToProcess = Object.entries(storage.newsletters);

  if (newslettersToProcess.length === 0) {
    console.log("No newsletters need screenshots");
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: false,
  });

  try {
    for (const [name, data] of newslettersToProcess) {
      console.log(`Processing screenshot for ${name}`);
      const url = data.URL.startsWith("http")
        ? data.URL
        : `https://${data.URL}`;

      const result = await captureNewsletterScreenshot(
        url,
        browser,
        name,
        force,
      );

      if (result.success) {
        // Update storage with screenshot status and path
        storage.newsletters[name] = {
          ...data,
          status: "screenshot_generated",
          screenshotPath: result.imagePath,
          updatedAt: new Date().toISOString(),
        };

        await addToStorage(storage);
        console.log(`Successfully generated screenshot for ${name}`);
      }

      // Add a small delay between screenshots to avoid rate limiting
      await new Promise((r) => setTimeout(r, 1000));
    }
  } finally {
    await browser.close();
    console.log("Screenshot generation complete!");
  }
}
