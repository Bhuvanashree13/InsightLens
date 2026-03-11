import crypto from "node:crypto";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks
const analysisCache = new Map();

const MAX_POSTS = 25;
const MAX_POST_LENGTH = 280;
const MAX_TOTAL_CHARS = 4500;
const MAX_ATTEMPTS = Math.max(1, Number(process.env.OPENAI_MAX_ATTEMPTS || 2));
const MAX_RETRY_DELAY_MS = Math.max(1000, Number(process.env.OPENAI_MAX_RETRY_DELAY_MS || 8000));
const LOCAL_FALLBACK_ENABLED = process.env.OPENAI_LOCAL_FALLBACK !== "false";

const POSITIVE_WORDS = new Set([
  "good", "great", "love", "awesome", "excellent", "fast", "smooth", "easy", "helpful", "recommend",
  "amazing", "best", "happy", "satisfied", "improved", "reliable", "quality", "supportive", "clean",
]);

const NEGATIVE_WORDS = new Set([
  "bad", "worst", "hate", "slow", "bug", "broken", "issue", "problem", "delay", "crash","not",
  "confusing", "expensive", "angry", "frustrated", "disappointed", "poor", "spam", "scam", "refund",
]);

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "is", "it",
  "its", "of", "on", "or", "that", "the", "their", "this", "to", "was", "were", "will", "with", "you",
  "your", "they", "them", "our", "we", "i", "me", "my",
]);

const normalizeBrand = (b) => String(b ?? "").trim().slice(0, 80);

const normalizePosts = (p) => {
  const arr = Array.isArray(p) ? p : [];
  const cleaned = arr
    .map((x) => String(x ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_POSTS)
    .map((x) => x.slice(0, MAX_POST_LENGTH));

  // Cap total payload size
  let total = 0;
  const limited = [];
  for (const post of cleaned) {
    if (total >= MAX_TOTAL_CHARS) break;
    const remaining = MAX_TOTAL_CHARS - total;
    const chunk = post.slice(0, remaining);
    if (!chunk) break;
    limited.push(chunk);
    total += chunk.length;
  }

  return limited;
};

const buildCacheKey = (brand, posts) => {
  const payload = JSON.stringify({ v: 2, brand, posts });
  return crypto.createHash("sha256").update(payload).digest("hex");
};

const createError = (message, statusCode) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const logApiKey = (key, label) => {
  const masked = key.length <= 10
    ? `${key.slice(0, 3)}...${key.slice(-2)}`
    : `${key.slice(0, 6)}...${key.slice(-4)}`;
  console.log(`[InsightLens] ${label} token loaded: ${masked}`);
};

const validateProvider = (provider) => {
  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw createError("OPENAI_API_KEY is missing. Ensure insightLens_backend/.env is loaded and restart the server.", 500);
    if (!globalThis.__insightlensOpenAIKeyLogged) {
      globalThis.__insightlensOpenAIKeyLogged = true;
      logApiKey(key, "OpenAI");
    }
  } else {
    throw createError(`Unknown LLM_PROVIDER \`${provider}\`. Supported: openai`, 500);
  }
};

const getCachedResult = (cacheKey) => {
  const cached = analysisCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    if (process.env.HF_DEBUG === "1") console.log("[InsightLens] Cache hit");
    return cached.value;
  }
  return null;
};

const setCachedResult = (cacheKey, value) => {
  if (analysisCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const firstKey = analysisCache.keys().next().value;
    analysisCache.delete(firstKey);
  }
  analysisCache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const buildPrompt = (brand, posts) => `
You are a brand analyst.

Task:
Analyze ONLY the provided posts about the brand and derive insights grounded in the post text.
Do not use external knowledge about the brand. If information is not present in the posts, do not assume it.

Brand: ${brand}

Posts (one per line):
${posts.join("\n")}

Rules:
- First classify each post tone as positive / neutral / negative.
- Compute sentiment_breakdown counts based on those classifications.
- overall_sentiment must be one of: "Positive", "Negative", "Mixed".
- keyInsights must be 3-6 insights inferred from repeated ideas/complaints/praise in the posts.
  Each keyInsight must be a short sentence (1-2 sentences max), not a single word.
- recommendations must be 3-6 actionable PR/product recommendations that respond to the keyInsights and sentiment.
- Every insight/recommendation MUST be supported by the posts. Keep them specific.

Output format:
- Return STRICT JSON only.
- Use double quotes for all strings.
- No markdown, no explanation, no trailing commas.

Return JSON exactly in this structure:
{
  "overall_sentiment": "",
  "keyInsights": [],
  "recommendations": [],
  "sentiment_breakdown": {
    "positive": 0,
    "neutral": 0,
    "negative": 0
  }
}
`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value) => {
  if (!value) return undefined;

  const asSeconds = Number(value);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000;
  }

  const asDate = Date.parse(value);
  if (!Number.isNaN(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }

  return undefined;
};

const safeReadErrorText = async (res) => {
  try {
    const body = await res.json();
    const message = body?.error?.message;
    return typeof message === "string" ? message : "";
  } catch {
    return "";
  }
};

const tokenize = (text) =>
  String(text ?? "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];

const getSentimentScore = (tokens) => {
  let score = 0;
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) score += 1;
    if (NEGATIVE_WORDS.has(token)) score -= 1;
  }
  return score;
};

const buildLocalFallbackAnalysis = (brand, posts) => {
  let positive = 0;
  let neutral = 0;
  let negative = 0;

  const brandTokens = new Set(tokenize(brand));
  const keywordCounts = new Map();

  for (const post of posts) {
    const tokens = tokenize(post);
    const score = getSentimentScore(tokens);

    if (score > 0) positive += 1;
    else if (score < 0) negative += 1;
    else neutral += 1;

    for (const token of tokens) {
      if (token.length < 3) continue;
      if (STOP_WORDS.has(token)) continue;
      if (brandTokens.has(token)) continue;
      keywordCounts.set(token, (keywordCounts.get(token) || 0) + 1);
    }
  }

  const total = positive + neutral + negative;
  let overallSentiment = "Mixed";
  if (total > 0) {
    if (positive / total >= 0.45 && positive > negative) overallSentiment = "Positive";
    if (negative / total >= 0.45 && negative > positive) overallSentiment = "Negative";
  }

  const themes = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  const keyInsights = [];
  if (themes.length) {
    keyInsights.push(
      `People most frequently mention ${themes.slice(0, 3).join(", ")}, suggesting these are the main talking points in the posts.`
    );
  }
  if (negative > 0) {
    keyInsights.push(
      `There are noticeable negative signals (${negative} negative post${negative === 1 ? "" : "s"}), indicating recurring friction that may need a public response.`
    );
  }
  if (positive > 0) {
    keyInsights.push(
      `Positive sentiment is present (${positive} positive post${positive === 1 ? "" : "s"}), which can be amplified through testimonials and community engagement.`
    );
  }
  if (!keyInsights.length) {
    keyInsights.push("The posts are mostly neutral and short, so the main insight is that clearer context and more detail is needed to draw strong conclusions.");
  }

  const recommendations = [];
  if (negative > positive) {
    recommendations.push("Acknowledge recurring complaints publicly and share fix timelines.");
    recommendations.push("Escalate top support issues and publish status updates.");
  } else {
    recommendations.push("Amplify positive user posts and testimonials across channels.");
    recommendations.push("Thank engaged users and encourage detailed product feedback.");
  }

  if (neutral >= Math.max(positive, negative)) {
    recommendations.push("Clarify value messaging with concrete outcomes and examples.");
  } else {
    recommendations.push("Track sentiment weekly and react quickly to new issue spikes.");
  }

  return JSON.stringify({
    overall_sentiment: overallSentiment,
    keyInsights: keyInsights.slice(0, 6),
    recommendations,
    sentiment_breakdown: {
      positive,
      neutral,
      negative,
    },
  });
};

const callOpenAI = async (prompt, cacheKey, brand, posts) => {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  let attempts = 0;
  let lastTransientStatus = null;

  while (attempts < MAX_ATTEMPTS) {
    if (process.env.HF_DEBUG === "1") {
      console.log(`[InsightLens] Calling OpenAI model ${model} (attempt ${attempts + 1}/${MAX_ATTEMPTS})`);
    }

    let res;
    try {
      res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          input: prompt,
          temperature: 0.3,
          max_output_tokens: 512
        })
      });
    } catch (err) {
      attempts++;
      const delayMs = Math.min(MAX_RETRY_DELAY_MS, Math.pow(2, attempts) * 1000);
      if (attempts < MAX_ATTEMPTS) {
        await sleep(delayMs);
        continue;
      }

      if (LOCAL_FALLBACK_ENABLED) {
        const fallbackText = buildLocalFallbackAnalysis(brand, posts);
        setCachedResult(cacheKey, fallbackText);
        return fallbackText;
      }

      throw createError(`OpenAI request failed: ${err.message}`, 502);
    }

    if (res.ok) {
      const body = await res.json();
      const text = body.output?.[0]?.content?.[0]?.text;
      if (typeof text !== "string") throw createError("Unexpected response from OpenAI API", 502);

      setCachedResult(cacheKey, text);
      return text;
    }

    if (res.status === 429 || res.status === 503) {
      lastTransientStatus = res.status;
      attempts++;
      const retryAfterMs = parseRetryAfterMs(res.headers.get("retry-after"));

      const exponentialBackoffMs = Math.pow(2, attempts) * 1000;
      const delayMs = Math.min(MAX_RETRY_DELAY_MS, retryAfterMs ?? exponentialBackoffMs);

      if (attempts < MAX_ATTEMPTS) {
        await sleep(delayMs);
        continue;
      }
      break;
    }

    const upstreamMessage = await safeReadErrorText(res);
    const message = upstreamMessage
      ? `OpenAI API error (${res.status}): ${upstreamMessage}`
      : `OpenAI API error: ${res.status}`;
    throw createError(message, res.status);
  }

  if (LOCAL_FALLBACK_ENABLED && (lastTransientStatus === 429 || lastTransientStatus === 503)) {
    const fallbackText = buildLocalFallbackAnalysis(brand, posts);
    setCachedResult(cacheKey, fallbackText);
    return fallbackText;
  }

  const msg = lastTransientStatus === 429
    ? "Rate limited by OpenAI API. Please try again in a moment."
    : "OpenAI is temporarily unavailable. Please try again in a moment.";
  throw createError(msg, lastTransientStatus || 503);
};


export const analyzeBrandSentiment = async (brand, posts) => {
  if (typeof fetch !== "function") {
    throw new Error("Global fetch is not available. Use Node.js v18+ (recommended v22) or add a fetch polyfill.");
  }

  const provider = process.env.LLM_PROVIDER || "openai";
  validateProvider(provider);

  const normalizedBrand = normalizeBrand(brand);
  const normalizedPosts = normalizePosts(posts);

  if (normalizedPosts.length === 0 || !normalizedBrand) {
    throw createError("Brand and at least one post are required.", 400);
  }

  const cacheKey = buildCacheKey(normalizedBrand, normalizedPosts);
  const cachedResult = getCachedResult(cacheKey);
  if (cachedResult) return cachedResult;

  const prompt = buildPrompt(normalizedBrand, normalizedPosts);

  return await callOpenAI(prompt, cacheKey, normalizedBrand, normalizedPosts);
};
