import jwt from "jsonwebtoken"
import mongoose from "mongoose"

export const protect = (req, res, next) => {

  const token = req.headers.authorization

  if (!token) {
    return res.status(401).json({ error: "Not authorized" })
  }

  const parts = token.split(" ")
  if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
    return res.status(401).json({ error: "Not authorized" })
  }

  const decoded = jwt.verify(parts[1], process.env.JWT_SECRET)

  if (!decoded?.id || !mongoose.isValidObjectId(decoded.id)) {
    return res.status(401).json({ error: "Invalid session. Please login again." })
  }

  req.user = decoded

  next()

}