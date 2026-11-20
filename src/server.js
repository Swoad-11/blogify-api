import mongoose from "mongoose";
import { config } from "./config.js";
import app from "./app.js";

try {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");
} catch (err) {
  console.error("Could not connect to MongoDB:", err.message);
  process.exit(1);
}

app.listen(config.port, () => {
  console.log(`Blogify API listening on port ${config.port}`);
});
