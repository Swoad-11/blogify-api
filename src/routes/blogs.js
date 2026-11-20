import { Router } from "express";
import { Blog, User, blogPopulate } from "../models.js";
import {
  HttpError,
  requireAuth,
  optionalAuth,
  upload,
  saveImage,
  deleteImage,
} from "../middleware.js";

const router = Router();

async function findBlog(id) {
  const blog = await Blog.findById(id).populate(blogPopulate);
  if (!blog) throw new HttpError(404, "Blog not found");
  return blog;
}

async function findOwnBlog(id, userId) {
  const blog = await Blog.findById(id);
  if (!blog) throw new HttpError(404, "Blog not found");
  if (blog.author.toString() !== userId) throw new HttpError(403, "You can only change your own blogs");
  return blog;
}

// GET /blogs?page=1&limit=10
router.get("/", async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const [blogs, total] = await Promise.all([
    Blog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(blogPopulate),
    Blog.countDocuments(),
  ]);
  res.json({ blogs, total, page, limit });
});

// GET /blogs/popular — top 5 by number of likes
router.get("/popular", async (_req, res) => {
  const top = await Blog.aggregate([
    { $project: { likeCount: { $size: "$likes" }, createdAt: 1 } },
    { $sort: { likeCount: -1, createdAt: -1 } },
    { $limit: 5 },
  ]);
  const ids = top.map((b) => b._id.toString());
  const blogs = await Blog.find({ _id: { $in: ids } }).populate(blogPopulate);
  blogs.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  res.json({ blogs });
});

// GET /blogs/favourites — logged-in user's favourite blogs
router.get("/favourites", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(404, "User not found");
  const blogs = await Blog.find({ _id: { $in: user.favourites } })
    .sort({ createdAt: -1 })
    .populate(blogPopulate);
  res.json({ blogs });
});

// GET /blogs/:id
router.get("/:id", optionalAuth, async (req, res) => {
  const blog = await findBlog(req.params.id);
  let isFavourite = false;
  if (req.userId) {
    isFavourite = Boolean(await User.exists({ _id: req.userId, favourites: blog._id }));
  }
  res.json({ ...blog.toJSON(), isFavourite });
});

// POST /blogs (multipart: thumbnail, title, tags, content)
router.post("/", requireAuth, upload.single("thumbnail"), async (req, res) => {
  const { title, content, tags = "" } = req.body ?? {};
  if (!title || !content) throw new HttpError(400, "Title and content are required");

  const thumbnail = req.file ? await saveImage(req.file) : null;
  const created = await Blog.create({ title, content, tags, thumbnail, author: req.userId });
  const blog = await findBlog(created._id);
  res.status(201).json({ message: "Blog created successfully", blog });
});

// PATCH /blogs/:id (multipart, all fields optional)
router.patch("/:id", requireAuth, upload.single("thumbnail"), async (req, res) => {
  const blog = await findOwnBlog(req.params.id, req.userId);
  const { title, content, tags } = req.body ?? {};
  if (title !== undefined) blog.title = title;
  if (content !== undefined) blog.content = content;
  if (tags !== undefined) blog.tags = tags;
  if (req.file) {
    const old = blog.thumbnail;
    blog.thumbnail = await saveImage(req.file);
    await deleteImage(old);
  }
  await blog.save();
  res.json(await findBlog(blog._id));
});

// DELETE /blogs/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const blog = await findOwnBlog(req.params.id, req.userId);
  await Promise.all([
    blog.deleteOne(),
    deleteImage(blog.thumbnail),
    User.updateMany({ favourites: blog._id }, { $pull: { favourites: blog._id } }),
  ]);
  res.json({ message: "Blog deleted successfully" });
});

// POST /blogs/:id/like — toggles like
router.post("/:id/like", requireAuth, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) throw new HttpError(404, "Blog not found");
  const alreadyLiked = blog.likes.some((id) => id.toString() === req.userId);
  await Blog.updateOne(
    { _id: blog._id },
    alreadyLiked ? { $pull: { likes: req.userId } } : { $addToSet: { likes: req.userId } }
  );
  const updated = await findBlog(blog._id);
  res.json({ isLiked: !alreadyLiked, likes: updated.toJSON().likes });
});

// PATCH /blogs/:id/favourite — toggles favourite
router.patch("/:id/favourite", requireAuth, async (req, res) => {
  if (!(await Blog.exists({ _id: req.params.id }))) throw new HttpError(404, "Blog not found");
  const isFavourite = Boolean(await User.exists({ _id: req.userId, favourites: req.params.id }));
  await User.updateOne(
    { _id: req.userId },
    isFavourite ? { $pull: { favourites: req.params.id } } : { $addToSet: { favourites: req.params.id } }
  );
  res.json({
    isFavourite: !isFavourite,
    message: isFavourite ? "Removed from favourites" : "Added to favourites",
  });
});

// POST /blogs/:id/comment { content } — returns the whole blog with comments
router.post("/:id/comment", requireAuth, async (req, res) => {
  const content = String(req.body?.content ?? "").trim();
  if (!content) throw new HttpError(400, "Comment cannot be empty");
  const result = await Blog.updateOne(
    { _id: req.params.id },
    { $push: { comments: { content, author: req.userId } } }
  );
  if (result.matchedCount === 0) throw new HttpError(404, "Blog not found");
  res.json(await findBlog(req.params.id));
});

// DELETE /blogs/:id/comment/:commentId
router.delete("/:id/comment/:commentId", requireAuth, async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) throw new HttpError(404, "Blog not found");
  const comment = blog.comments.id(req.params.commentId);
  if (!comment) throw new HttpError(404, "Comment not found");
  if (comment.author.toString() !== req.userId) {
    throw new HttpError(403, "You can only delete your own comments");
  }
  comment.deleteOne();
  await blog.save();
  res.json({ message: "Comment deleted successfully" });
});

export default router;
