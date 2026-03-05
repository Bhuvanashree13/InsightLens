import mongoose from "mongoose"

const analysisSchema = new mongoose.Schema({

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  brand: String,

  posts: [String],

  overall_sentiment: String,

  sentiment_breakdown: {
    positive: Number,
    neutral: Number,
    negative: Number
  },

  key_themes: [String],

  insights: [String],

  pr_recommendations: [String]

}, { timestamps: true })

export default mongoose.model("Analysis", analysisSchema)