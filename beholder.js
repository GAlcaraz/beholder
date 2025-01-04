import puppeteer from "puppeteer";
import path from "path";
import { loadStorage, addToStorage } from "./puppet.js";
import { toKebabCase } from "./utils.js";

async function captureNewsletterScreenshot(url, browser, newsletterName) {
  try {
    const filename = `${toKebabCase(newsletterName)}.png`;
    const outputDir = path.join(process.cwd(), "images");

    const outputPath = path.join(outputDir, filename);

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    console.log(`Capturing screenshot of ${url} for ${newsletterName}`);
    await page.goto(url, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

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

export async function generateNewsletterScreenshots() {
  const storage = await loadStorage();
  const newslettersToProcess = Object.entries(storage.newsletters).filter(
    ([_, data]) =>
      data.status !== "screenshot_generated" &&
      data.URL &&
      data.URL !== "Unavailable",
  );

  if (newslettersToProcess.length === 0) {
    console.log("No newsletters need screenshots");
    return;
  }

  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: "new",
  });

  try {
    for (const [name, data] of newslettersToProcess) {
      console.log(`Processing screenshot for ${name}`);
      const url = data.URL.startsWith("http")
        ? data.URL
        : `https://${data.URL}`;

      const result = await captureNewsletterScreenshot(url, browser, name);

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
