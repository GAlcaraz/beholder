import { processUrls } from "./puppet.js"; // assuming we saved the previous code as scraper.js
import { processNewslettersWithAI } from "./processNewsletter.js";
import { generateNewsletterScreenshots } from "./beholder.js";
import { addSocialsToNewsletters } from "./puppet.js";

// Get URLs from command line arguments
const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.log("Please provide at least one URL to process");
  console.log("Usage: node scrape.js URL1 [URL2 URL3 ...]");
  process.exit(1);
}

console.log("Processing URLs:", urls);

processUrls(urls)
  .then(() => {
    console.log("All URLs processed successfully!");
  })
  .catch((error) => {
    console.error("Error during processing:", error);
    process.exit(1);
  });

addSocialsToNewsletters();

// processNewslettersWithAI();

// generateNewsletterScreenshots().catch((error) => {
//   console.error("Fatal error:", error);
//   process.exit(1);
// });
