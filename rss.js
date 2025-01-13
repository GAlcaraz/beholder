import { XMLParser } from "fast-xml-parser";

/**
 * Modern RSS feed analyzer using ES modules and current JavaScript features
 */
export class RSSAnalyzer {
  #feeds = new Map();
  #parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });

  async fetchFeed(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const text = await response.text();
      return this.#parseFeed(text);
    } catch (error) {
      console.error(`Error fetching feed ${url}:`, error);
      return null;
    }
  }

  #parseFeed(xmlText) {
    try {
      const parsed = this.#parser.parse(xmlText);
      const channel = parsed.rss?.channel || parsed.feed;
      if (!channel) throw new Error("Invalid RSS/Atom feed format");

      const items = channel.item || channel.entry || [];
      return (Array.isArray(items) ? items : [items]).map((item) => ({
        title: item.title || "",
        description: item.description || item.summary || "",
        pubDate: new Date(item.pubDate || item.published || item.updated || ""),
        link: typeof item.link === "string" ? item.link : item.link?.href || "",
        categories: this.#extractCategories(item),
        author: this.#extractAuthor(item),
      }));
    } catch (error) {
      console.error("Error parsing feed:", error);
      return [];
    }
  }

  #extractCategories(item) {
    if (!item.category) return [];
    const categories = Array.isArray(item.category)
      ? item.category
      : [item.category];
    return categories.map((cat) =>
      typeof cat === "string" ? cat : cat["#text"] || "",
    );
  }

  #extractAuthor(item) {
    if (typeof item.author === "string") return item.author;
    return item.author?.name || item.author?.email || "";
  }

  async analyzeFeed(url) {
    const entries = await this.fetchFeed(url);
    if (!entries) return null;

    const analysis = {
      totalEntries: entries.length,
      dateRange: this.#getDateRange(entries),
      topCategories: this.#getTopCategories(entries),
      postFrequency: this.#calculatePostFrequency(entries),
      contentAnalysis: this.#analyzeContent(entries),
      businessMetrics: this.#analyzeBusinessMetrics(entries),
    };

    this.#feeds.set(url, analysis);
    return analysis;
  }

  #getDateRange(entries) {
    const dates = entries.map((entry) => entry.pubDate);
    return {
      earliest: new Date(Math.min(...dates)),
      latest: new Date(Math.max(...dates)),
    };
  }

  #getTopCategories(entries) {
    const categories = entries.flatMap((entry) => entry.categories);
    return this.#getTopOccurrences(categories, 10);
  }

  #calculatePostFrequency(entries) {
    const postsPerDay = entries.reduce((acc, entry) => {
      const date = entry.pubDate.toISOString().split("T")[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    const days = Object.entries(postsPerDay);
    const avgPosts = entries.length / days.length;
    const mostActiveDay = days.reduce((max, curr) =>
      curr[1] > max[1] ? curr : max,
    );

    return {
      averagePostsPerDay: avgPosts,
      mostActiveDay: mostActiveDay[0],
      postsPerDay,
    };
  }

  #analyzeContent(entries) {
    // Clean and prepare text
    const cleanText = entries
      .map((entry) => {
        // Combine title and description
        let text = `${entry.title} ${entry.description}`;

        // Remove HTML tags
        text = text.replace(/<[^>]*>/g, " ");

        // Convert HTML entities to characters
        text = text.replace(/&\w+;/g, " ");

        // Clean up whitespace
        text = text.replace(/\s+/g, " ").trim();

        return text;
      })
      .join(" ");

    // Common words to filter out
    const stopWords = new Set([
      "that",
      "this",
      "with",
      "from",
      "their",
      "what",
      "about",
      "which",
      "when",
      "will",
      "there",
      "have",
      "more",
      "also",
      "where",
      "who",
      "been",
      "were",
      "they",
      "than",
      "them",
      "then",
      "some",
      "these",
      "would",
      "other",
      "into",
      "could",
      "your",
      "said",
      "each",
      "just",
      "year",
      "most",
      "only",
      "first",
      "over",
      "last",
      "such",
      "need",
      "even",
      "much",
      "many",
      "well",
      "through",
    ]);

    // Extract meaningful words
    const words = cleanText
      .toLowerCase()
      .split(/\W+/)
      .filter(
        (word) =>
          word.length > 3 &&
          !stopWords.has(word) &&
          !/^\d+$/.test(word) && // Remove pure numbers
          !/^[0-9a-f]{4,}$/.test(word), // Remove likely hex codes
      );

    return {
      wordFrequency: this.#getTopOccurrences(words, 20),
      averageWordCount: Math.round(
        entries.reduce(
          (sum, entry) =>
            sum + entry.description.split(/\W+/).filter(Boolean).length,
          0,
        ) / entries.length,
      ),
      totalWords: words.length,
      sentiment: this.#analyzeSentiment(cleanText),
    };
  }

  #getTopOccurrences(items, limit) {
    const frequency = items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([item, count]) => ({ item, count }));
  }

  #analyzeBusinessMetrics(entries) {
    const patterns = {
      funding: /funding|raises|series [abc]|investment/i,
      product: /launch|release|announce|new product|introducing/i,
      partnership: /partner|collaboration|alliance|teams up/i,
      expansion: /expand|growth|new market|international|global/i,
      hiring: /hiring|careers|job|position|role/i,
      technology: /tech stack|framework|platform|infrastructure/i,
    };

    return Object.entries(patterns).reduce((metrics, [key, pattern]) => {
      const matchingPosts = entries.filter((entry) =>
        pattern.test(`${entry.title} ${entry.description}`),
      );

      metrics[`${key}Activity`] = {
        count: matchingPosts.length,
        posts: matchingPosts.map(({ title, pubDate }) => ({
          title,
          date: pubDate,
        })),
      };

      return metrics;
    }, {});
  }

  #analyzeSentiment(text) {
    const positiveWords = new Set([
      "good",
      "great",
      "awesome",
      "excellent",
      "happy",
      "positive",
      "growth",
      "success",
      "innovative",
      "leading",
    ]);
    const negativeWords = new Set([
      "bad",
      "poor",
      "terrible",
      "negative",
      "sad",
      "angry",
      "decline",
      "fail",
      "loss",
      "difficult",
    ]);

    const words = text.toLowerCase().split(/\W+/);
    const positive = words.filter((word) => positiveWords.has(word)).length;
    const negative = words.filter((word) => negativeWords.has(word)).length;

    return {
      score: (positive - negative) / words.length,
      positive,
      negative,
    };
  }
}

export class FeedAggregator {
  #analyzer = new RSSAnalyzer();
  #feeds = new Map();

  async addFeed(url, name) {
    const analysis = await this.#analyzer.analyzeFeed(url);
    if (analysis) {
      this.#feeds.set(name, { url, analysis });
      return true;
    }
    return false;
  }

  async analyzeCompetitors(feedUrls) {
    const analyses = await Promise.all(
      Object.entries(feedUrls).map(async ([name, url]) => {
        const analysis = await this.addFeed(url, name);
        return { name, analysis };
      }),
    );

    return {
      analyses,
      summary: this.#generateCompetitiveSummary(),
    };
  }

  #generateCompetitiveSummary() {
    const allFeeds = [...this.#feeds.entries()];

    return {
      totalPostsPerCompetitor: Object.fromEntries(
        allFeeds.map(([name, { analysis }]) => [name, analysis.totalEntries]),
      ),
      activityTimeline: this.#generateActivityTimeline(),
      commonTopics: this.#findCommonTopics(),
    };
  }

  #generateActivityTimeline() {
    return [...this.#feeds.entries()]
      .flatMap(([name, { analysis }]) => {
        const { businessMetrics } = analysis;

        return Object.entries(businessMetrics).flatMap(([type, { posts }]) =>
          posts.map(({ title, date }) => ({
            company: name,
            type: type.replace("Activity", ""),
            title,
            date,
          })),
        );
      })
      .sort((a, b) => b.date - a.date);
  }

  #findCommonTopics() {
    const allTopics = new Map();

    for (const [name, { analysis }] of this.#feeds) {
      const topics = analysis.contentAnalysis.wordFrequency;

      for (const { item, count } of topics) {
        if (!allTopics.has(item)) {
          allTopics.set(item, { count, companies: new Set() });
        }
        allTopics.get(item).companies.add(name);
      }
    }

    return [...allTopics.entries()]
      .filter(([, { companies }]) => companies.size > 1)
      .map(([topic, { count, companies }]) => ({
        topic,
        count,
        companies: [...companies],
      }))
      .sort((a, b) => b.count - a.count);
  }
}

// Run example analysis
async function main() {
  try {
    console.log("Starting feed analysis...");

    // Single feed analysis
    const analyzer = new RSSAnalyzer();
    console.log("\nAnalyzing TechCrunch feed...");
    const analysis = await analyzer.analyzeFeed(
      "https://www.clubindustry.com/rss.xml",
    );

    if (analysis) {
      console.log("\nFeed Analysis Summary:");
      console.log(`Total entries: ${analysis.totalEntries}`);
      console.log(
        `Date range: ${analysis.dateRange.earliest.toLocaleDateString()} to ${analysis.dateRange.latest.toLocaleDateString()}`,
      );
      console.log("\nTop 5 categories:", analysis.topCategories.slice(0, 5));
      console.log(
        `\nPost frequency: ${analysis.postFrequency.averagePostsPerDay.toFixed(2)} posts per day`,
      );

      console.log("\nBusiness Activity:");
      Object.entries(analysis.businessMetrics).forEach(([type, data]) => {
        console.log(`${type}: ${data.count} posts`);
      });
    }

    // Competitor analysis
    console.log("\nAnalyzing competitor feeds...");
    const aggregator = new FeedAggregator();
    const competitorFeeds = {
      TechCrunch: "https://techcrunch.com/feed/",
      VentureBeat: "https://feeds.feedburner.com/venturebeat/SZYF",
      TechStartups: "https://techstartups.com/feed/",
    };

    const competitiveAnalysis =
      await aggregator.analyzeCompetitors(competitorFeeds);

    if (competitiveAnalysis) {
      console.log("\nCompetitive Analysis Summary:");
      console.log(
        "Posts per competitor:",
        competitiveAnalysis.summary.totalPostsPerCompetitor,
      );
      console.log("\nTop 10 common topics across feeds:");
      competitiveAnalysis.summary.commonTopics
        .slice(0, 10)
        .forEach(({ topic, count, companies }) => {
          // Calculate percentage of total content
          const percentage = (
            (count /
              Object.values(
                competitiveAnalysis.summary.totalPostsPerCompetitor,
              ).reduce((a, b) => a + b, 0)) *
            100
          ).toFixed(1);
          console.log(
            `- "${topic}" (${percentage}% of content, mentioned by ${companies.join(", ")})`,
          );
        });
    }
  } catch (error) {
    console.error("Error in analysis:", error);
  }
}

// Run the analysis
main().catch(console.error);
