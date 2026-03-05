import User from "../models/user.js"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import crypto from "crypto"

const createToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" })

const localUsers = new Map()
const isDbConnected = () => mongoose.connection.readyState === 1

export const register = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const existingUser = isDbConnected()
      ? await User.findOne({ email: normalizedEmail })
      : localUsers.get(normalizedEmail)

    if (existingUser) {
      return res.status(400).json({ error: "Email is already registered" })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = isDbConnected()
      ? await User.create({
          email: normalizedEmail,
          password: hashedPassword,
        })
      : {
          _id: crypto.randomUUID(),
          email: normalizedEmail,
          password: hashedPassword,
        }

    if (!isDbConnected()) {
      localUsers.set(normalizedEmail, user)
    }

    const token = createToken(user._id)

    res.status(201).json({
      token,
      user: { id: user._id, email: user.email },
    })
  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ error: "Registration failed" })
  }
}

export const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" })
    }

    const normalizedEmail = email.trim().toLowerCase()

    const user = isDbConnected()
      ? await User.findOne({ email: normalizedEmail })
      : localUsers.get(normalizedEmail)

    if (!user) {
      return res.status(400).json({ error: "User not found" })
    }

    const valid = await bcrypt.compare(password, user.password)

    if (!valid) {
      return res.status(400).json({ error: "Invalid password" })
    }

    const token = createToken(user._id)

    res.json({ token, user: { id: user._id, email: user.email } })
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: "Login failed" })
  }
}
