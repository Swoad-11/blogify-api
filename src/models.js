import mongoose from "mongoose";

const { Schema, model } = mongoose;

// Every document is sent to the frontend with `id` instead of `_id`.
function toClient(_doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.password;
  return ret;
}
const jsonOptions = { virtuals: false, transform: toClient };

const userSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: "", trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: null },
    bio: { type: String, default: "" },
    favourites: [{ type: Schema.Types.ObjectId, ref: "Blog" }],
  },
  { timestamps: true, toJSON: jsonOptions }
);

const commentSchema = new Schema(
  {
    content: { type: String, required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, toJSON: jsonOptions }
);

const blogSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    tags: { type: String, default: "" },
    thumbnail: { type: String, default: null },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    likes: [{ type: Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
  },
  { timestamps: true, toJSON: jsonOptions }
);
blogSchema.index({ createdAt: -1 });

// Uploaded images live in MongoDB so they survive server restarts
// (free hosts like Render wipe the local disk on every deploy/restart).
const imageSchema = new Schema(
  {
    filename: { type: String, required: true, unique: true },
    contentType: { type: String, required: true },
    data: { type: Buffer, required: true },
  },
  { timestamps: true }
);

export const User = model("User", userSchema);
export const Blog = model("Blog", blogSchema);
export const Image = model("Image", imageSchema);

// Fields of a user that are safe to show next to a blog or comment.
const PUBLIC_USER = "firstName lastName avatar";

export const blogPopulate = [
  { path: "author", select: PUBLIC_USER },
  { path: "likes", select: "firstName lastName" },
  { path: "comments.author", select: PUBLIC_USER },
];
