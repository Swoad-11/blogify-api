import { Router } from "express";
import { Blog, User, blogPopulate } from "../models.js";
import { HttpError, requireAuth, optionalAuth, upload, saveImage, deleteImage } from "../middleware.js";

const router = Router();

// GET /profile/:id — user info plus their blogs
router.get("/:id", optionalAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new HttpError(404, "User not found");
  const blogs = await Blog.find({ author: user._id }).sort({ createdAt: -1 }).populate(blogPopulate);
  res.json({ ...user.toJSON(), blogs });
});

// PATCH /profile { bio, firstName, lastName }
router.patch("/", requireAuth, async (req, res) => {
  const updates = {};
  for (const key of ["bio", "firstName", "lastName"]) {
    if (req.body?.[key] !== undefined) updates[key] = String(req.body[key]);
  }
  if (updates.firstName === "") throw new HttpError(400, "First name cannot be empty");
  const user = await User.findByIdAndUpdate(req.userId, updates, { new: true });
  if (!user) throw new HttpError(404, "User not found");
  res.json({ message: "Profile updated successfully", user });
});

// POST /profile/avatar (multipart: avatar)
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  if (!req.file) throw new HttpError(400, "Please choose an image");
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, "User not found");
  const old = user.avatar;
  user.avatar = await saveImage(req.file);
  await user.save();
  await deleteImage(old);
  res.json({ message: "Avatar updated successfully", user });
});

export default router;
