import crypto from "node:crypto";
import path from "node:path";
import jwt from "jsonwebtoken";
import multer from "multer";
import { config } from "./config.js";
import { Image } from "./models.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

function verify(token) {
  try {
    return jwt.verify(token, config.accessSecret).sub;
  } catch {
    // 401 makes the frontend refresh its token and retry.
    throw new HttpError(401, "Invalid or expired token");
  }
}

// Route needs a logged-in user.
export function requireAuth(req, _res, next) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, "Authentication required");
  req.userId = verify(token);
  next();
}

// Route works for guests, but knows who you are if you send a token.
export function optionalAuth(req, _res, next) {
  const token = readToken(req);
  if (token) req.userId = verify(token);
  next();
}

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Only JPG, PNG, GIF, WEBP or AVIF images are allowed"));
  },
});

// Stores an uploaded file in MongoDB and returns its filename.
export async function saveImage(file) {
  const ext = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, "") || ".img";
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  await Image.create({ filename, contentType: file.mimetype, data: file.buffer });
  return filename;
}

export async function deleteImage(filename) {
  if (filename) await Image.deleteOne({ filename });
}
