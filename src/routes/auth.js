import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { User } from "../models.js";
import { HttpError } from "../middleware.js";

const router = Router();

const signAccess = (id) => jwt.sign({ sub: id }, config.accessSecret, { expiresIn: config.accessTtl });
const signRefresh = (id) => jwt.sign({ sub: id }, config.refreshSecret, { expiresIn: config.refreshTtl });

router.post("/register", async (req, res) => {
  const { firstName, lastName = "", email, password } = req.body ?? {};
  if (!firstName || !email || !password) {
    throw new HttpError(400, "First name, email and password are required");
  }
  if (String(password).length < 8) {
    throw new HttpError(400, "Password must be at least 8 characters");
  }
  const exists = await User.exists({ email: String(email).toLowerCase().trim() });
  if (exists) throw new HttpError(409, "An account with this email already exists");

  const user = await User.create({
    firstName,
    lastName,
    email,
    password: await bcrypt.hash(String(password), 10),
  });
  res.status(201).json({ message: "User registered successfully", user });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) throw new HttpError(400, "Email and password are required");

  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    throw new HttpError(401, "Invalid email or password");
  }
  const id = user.id;
  res.json({
    message: "Login successful",
    user,
    token: { accessToken: signAccess(id), refreshToken: signRefresh(id) },
  });
});

router.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body ?? {};
  let id;
  try {
    id = jwt.verify(refreshToken, config.refreshSecret).sub;
  } catch {
    throw new HttpError(401, "Invalid or expired refresh token");
  }
  if (!(await User.exists({ _id: id }))) throw new HttpError(401, "User no longer exists");
  res.json({ token: signAccess(id) });
});

export default router;
