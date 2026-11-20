import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import multer from "multer";
import { config } from "./config.js";
import { Blog, Image, blogPopulate } from "./models.js";
import { HttpError } from "./middleware.js";
import authRoutes from "./routes/auth.js";
import blogRoutes from "./routes/blogs.js";
import profileRoutes from "./routes/profile.js";

const app = express();

app.use(
  cors({
    // No CLIENT_URL set → allow any site. Auth uses Bearer tokens, not cookies.
    origin: config.clientUrls.length ? config.clientUrls : true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => res.json({ status: "ok", name: "blogify-api" }));

app.use("/auth", authRoutes);
app.use("/blogs", blogRoutes);
app.use("/profile", profileRoutes);

// GET /search?q=term → { data: [...blogs] }
app.get("/search", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ data: [] });
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const data = await Blog.find({ $or: [{ title: pattern }, { content: pattern }, { tags: pattern }] })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate(blogPopulate);
  res.json({ data });
});

// GET /uploads/blog/:filename and /uploads/avatar/:filename
app.get("/uploads/:kind/:filename", async (req, res) => {
  const image = await Image.findOne({ filename: req.params.filename });
  if (!image) return res.status(404).end();
  res.set("Content-Type", image.contentType);
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(image.data);
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, message: err.message });
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 5 MB or smaller" : err.message;
    return res.status(400).json({ error: message, message });
  }
  if (err instanceof mongoose.Error.CastError) return res.status(404).json({ error: "Not found", message: "Not found" });
  if (err instanceof mongoose.Error.ValidationError) return res.status(400).json({ error: err.message, message: err.message });
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid JSON", message: "Invalid JSON" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong", message: "Something went wrong" });
});

export default app;
