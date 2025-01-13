import puppeteer from "puppeteer";
import { readFile, writeFile } from "fs/promises";
import { processUrlForNewsletters } from "./processNewsletter.js";

const STORAGE_PATH = "newsletter_data.json";
const UrlStatus = Object.freeze({
  PENDING: "PENDING",
  EXTRACTED: "EXTRACTED",
  INGESTED: "INGESTED",
});

async function loadStorage() {
  try {
    const data = await readFile(STORAGE_PATH, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return {
      processed: {},
      pending: [],
      errors: {},
    };
  }
}

async function addToStorage(data) {
  const storage = await loadStorage();
  const updatedStorage = {
    ...storage,
    ...data,
    lastUpdated: new Date().toISOString(),
  };

  await writeFile(STORAGE_PATH, JSON.stringify(updatedStorage, null, 2));
  return updatedStorage;
}

async function getCleanContent(url) {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: "new",
  });
  try {
    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    await page.setDefaultNavigationTimeout(30000);
    await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));

    await page.goto(url, { waitUntil: "networkidle0" });

    const content = await page.evaluate(() => {
      // Remove unwanted elements but preserve their content
      const elementsToRemove = document.querySelectorAll(
        "nav, header, footer, script, style, .ads, #comments",
      );
      elementsToRemove.forEach((el) => el.remove());

      const mainContent =
        document.querySelector("main, article, .content, .post-content") ||
        document.body;

      // Helper function to get text content while preserving links
      function getTextWithLinks(element) {
        let result = "";
        element.childNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            result += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.tagName === "A") {
              // Preserve link with its href
              result += `[${node.textContent}](${node.href}) `;
            } else {
              // Recursively process other elements
              result += getTextWithLinks(node);
            }
          }
        });
        return result;
      }

      return getTextWithLinks(mainContent);
    });

    return content.trim();
  } finally {
    await browser.close();
  }
}

async function processUrl(url) {
  try {
    const storage = await loadStorage();
    const urlData = storage.urls?.[url] || {}; // Default to empty object if URL doesn't exist

    // Check if URL is already processed
    if (urlData.status === UrlStatus.INGESTED) {
      console.log(`URL ${url} already fully processed, skipping...`);
      return urlData;
    }

    // Process existing raw text
    if (urlData.rawText) {
      console.log("Found raw text, processing with AI...");
      const newsletters = await processUrlForNewsletters(urlData.rawText);

      await addToStorage({
        urls: {
          ...storage.urls,
          [url]: {
            ...urlData, // Use urlData instead of storage.urls[url]
            status: UrlStatus.INGESTED,
          },
        },
        newsletters: {
          ...storage.newsletters,
          ...newsletters,
        },
      });

      return urlData;
    }

    // Extract new content
    const content = await getCleanContent(url);
    console.log("Extracted content:", content.substring(0, 500) + "...");

    // Save raw text
    await addToStorage({
      urls: {
        ...storage.urls,
        [url]: {
          rawText: content,
          status: UrlStatus.EXTRACTED,
          extractedAt: new Date().toISOString(),
        },
      },
    });

    // Process newsletters
    const newsletters = await processUrlForNewsletters(content);

    // Save processed newsletters
    await addToStorage({
      urls: {
        ...storage.urls,
        [url]: {
          ...urlData, // Use urlData instead of storage.urls[url]
          status: UrlStatus.INGESTED,
        },
      },
      newsletters: {
        ...storage.newsletters,
        ...Object.fromEntries(
          Object.entries(newsletters).filter(
            ([name]) => !storage.newsletters[name],
          ),
        ),
      },
    });

    return newsletters;
  } catch (error) {
    const storage = await loadStorage();
    storage.errors[url] = {
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    await writeFile(STORAGE_PATH, JSON.stringify(storage, null, 2));

    console.error(`Error processing ${url}:`, error);
  }
}

async function processUrls(urls) {
  for (const url of urls) {
    console.log(`Processing ${url}...`);
    await processUrl(url);
    await new Promise((resolve) =>
      setTimeout(resolve, 2000 + Math.random() * 1000),
    );
  }
}

async function extractSocialLinks(url, browser) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle0" });

    console.log("Getting socials for ", url);
    const socialLinks = await page.evaluate(() => {
      const socialPatterns = /twitter|facebook|linkedin|instagram|youtube/i;
      const links = document.querySelectorAll("a[href]");

      return Array.from(links)
        .filter((link) => socialPatterns.test(link.href))
        .map((link) => link.href)
        .filter((href) => href) // Remove any undefined/empty
        .filter((href, index, self) => self.indexOf(href) === index); // Remove duplicates
    });

    console.log(socialLinks);
    return socialLinks;
  } finally {
    await page.close();
  }
}

async function addSocialsToNewsletters() {
  console.log("Processing socials");
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/chromium-browser",
    headless: "new",
  });

  try {
    const storage = await loadStorage();
    const newslettersData = storage.newsletters;

    for (const [name, data] of Object.entries(newslettersData)) {
      if (
        data.status === "added_socials" ||
        data.status === "completed" ||
        data.status === "screenshot_generated"
      ) {
        console.log(`Skipping ${name} - already processed socials`);
        continue;
      }

      if (!data.URL || !data.URL.startsWith("http")) {
        console.log(`Skipping ${name} - invalid URL: ${data.URL}`);
        continue;
      }

      try {
        const socialLinks = await extractSocialLinks(data.URL, browser);
        storage.newsletters[name] = {
          ...data,
          socialLinks,
          status: "added_socials",
        };
        console.log(storage.newsletters[name]);
        await addToStorage(storage);
      } catch (error) {
        console.error(`Error processing socials for ${name}:`, error);
      }
    }
  } finally {
    await browser.close();
  }
}

export {
  addSocialsToNewsletters,
  loadStorage,
  addToStorage,
  processUrl,
  processUrls,
  getCleanContent,
};
