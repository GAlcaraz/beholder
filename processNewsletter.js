import "dotenv/config";
import OpenAI from "openai";
import { writeFile } from "fs/promises";
import path from "path";
import { toKebabCase } from "./utils.js";
import { loadStorage, addToStorage } from "./puppet.js";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseNewslettersResponse(aiResponse) {
  try {
    // Remove markdown code block syntax and any extra whitespace
    const jsonString = aiResponse
      .replace(/```json\n/, "") // Remove opening code block
      .replace(/```$/, "") // Remove closing code block
      .trim();

    // Parse the JSON string
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("Error parsing newsletters response:", error);
    throw new Error(`Failed to parse newsletters: ${error.message}`);
  }
}

async function processUrlForNewsletters(content) {
  const prompt = `Your task is to extract a list of newsletters from the provided content, as well as any important data that you find there, like name, especially url, or anything else listed. You will 
return the information in a well structured json format, with the main keys being the newsletters name and then the details inside.
The provided content is ${content}
Please ensure all property names and string values use double quotes, not single quotes. 
For example:
{
  "TechCrunch": {
    "Year Started": 2005,
    "Number of Subscribers": "Unavailable",
    "Send Schedule": "Daily & Weekly"
  }
}
`;
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o-mini",
    response_format: { type: "json_object" }, // This ensures valid JSON output
    temperature: 0,
  });

  return parseNewslettersResponse(completion.choices[0].message.content);
}

async function processNewsletterWithAI(content) {
  const prompt = `Your task is to help populate a directory site about newsletters by formatting newsletter information into structured markdown documents. Before beginning the formatting, analyze the provided information:
- Content categories/topics for accurate tagging
- Pricing details if unclear
- Frequency of publication
- Any missing crucial information
- Additional links or resources
- Target audience specifics

The provided content is:
${content}

The already existing list of tags you can use to categorize is tech, business, finance, startup, freemium, paid, free, daily, weekly, politics, culture, science, news, career, ai, entrepreneurship, personal-development, programming, marketing, lifestyle, design, productivity, general, book, education, investment, health-fitness, writing, product-development, entertainment, arts, media, podcast, social-network, philosophy, sport, data, no-code, psychology, remote-work, social-impact, travel, artificial-intelligence, history, web3, food, game, music, fashion, real-estate, ar-vr, sales, wordpress, photography
If you dont have a certain piece of information (like twitter handle), don't write that field

Format your response in markdown like this:
---
layout: ../../layouts/Card.astro
title: Newsletter Name
description: Brief description
card_image: [newsletter title in kebabcase].png
newsletterUrl: "https://example.com/newsletter"
social:
  twitter: "twitterhandle"
  (other socials if relevant)
language: "English"
pricing: "Free/Premium/etc"
schedule: "Daily/Weekly/Monthly"
platform: "Substack/Beehiiv/Ghost/etc" 
tags:
  - pricing model
  - category
  - frequency
links:
  -
    name: "link name"
    link: "URL"
---
[Introduction paragraph]
![newsletter title](images/[newsletter title in kebabcase.webp])
## Newsletter Features
[Features content]
## Writing Style
[Style content]
## Pricing
[Pricing content]
## Authors and Background
[Author content]
## Additional Resources
[Resources content]
`;

  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4o",
  });

  return completion.choices[0].message.content;
}

async function processNewslettersWithAI() {
  const storage = await loadStorage();
  const newslettersData = storage.newsletters;
  const outputDir = path.join(process.cwd(), "newsletters");

  for (const [name, data] of Object.entries(newslettersData)) {
    if (data.status === "completed" || data.status === "screenshot_generated") {
      console.log(`Skipping ${name} - already processed newsletter with AI`);
      continue;
    }

    const filename = `${toKebabCase(name)}.md`;
    const filePath = path.join(outputDir, filename);

    try {
      // Check if file already exists
      try {
        await access(filePath);
        console.log(`File ${filename} already exists, skipping...`);
        continue;
      } catch {
        // File doesn't exist, proceed with creation
      }

      console.log(`Processing ${name} markdown...`);
      const markdown = await processNewsletterWithAI(
        JSON.stringify(data, null, 2),
      );

      await writeFile(filePath, markdown, "utf-8");

      // Update storage with completed status
      storage.newsletters[name] = {
        ...data,
        status: "completed",
        markdownPath: `newsletters/${filename}`,
        updatedAt: new Date().toISOString(),
      };

      await addToStorage(storage);

      console.log(`Created markdown file for ${name}`);
    } catch (error) {
      console.error(`Error processing ${name}:`, error);
    }
  }
}

export {
  processNewslettersWithAI,
  processNewsletterWithAI,
  processUrlForNewsletters,
};
