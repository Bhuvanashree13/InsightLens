import express from "express";
import { analyzeSentiment } from "../controllers/sentimentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/analyze", protect, analyzeSentiment);

export default router;