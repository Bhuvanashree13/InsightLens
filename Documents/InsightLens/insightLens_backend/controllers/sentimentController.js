import Analysis from "../models/Analysis.js"
import { analyzeBrandSentiment } from "../services/openaiService.js"
export const analyzeSentiment = async (req, res) => {

  try {
    const { brand, posts } = req.body

    const insights = await analyzeBrandSentiment(brand, posts);

    let parsed;
    try {
      parsed = JSON.parse(insights);
    } catch (e) {
      // Try to extract JSON from response
      const match = insights.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error("Invalid JSON response from OpenAI");
      }
    }

    // ensure breakdown numbers
    const rawBreakdown = parsed.sentiment_breakdown || {};
    const sentiment_breakdown = {
      positive: Number(rawBreakdown.positive) || 0,
      neutral: Number(rawBreakdown.neutral) || 0,
      negative: Number(rawBreakdown.negative) || 0,
    };

    const keyInsights = Array.isArray(parsed.keyInsights)
      ? parsed.keyInsights
      : (Array.isArray(parsed.themes) ? parsed.themes : []);

    const analysis = await Analysis.create({

      userId: req.user.id,

      brand,

      posts,

      overall_sentiment: parsed.overall_sentiment,

      sentiment_breakdown,

      insights: keyInsights,

      key_themes: parsed.themes,

      pr_recommendations: parsed.recommendations

    })

    res.json(analysis)
  } catch (err) {
    console.error("Sentiment analysis error:", err);
    const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const message = err?.message || "Analysis failed";
    res.status(statusCode).json({ error: message });
  }

}