import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: required("MONGODB_URI"),
  accessSecret: required("JWT_ACCESS_SECRET"),
  refreshSecret: required("JWT_REFRESH_SECRET"),
  accessTtl: "1h",
  refreshTtl: "7d",
  clientUrls: (process.env.CLIENT_URL || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
