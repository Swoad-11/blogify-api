import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

// MONGODB_URI may contain a <db_password> placeholder; it is then filled from
// MONGODB_PASSWORD (URL-encoded, so special characters are safe).
function mongoUri() {
  const uri = required("MONGODB_URI");
  if (!uri.includes("<db_password>")) return uri;
  return uri.replace("<db_password>", encodeURIComponent(required("MONGODB_PASSWORD")));
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  mongoUri: mongoUri(),
  accessSecret: required("JWT_ACCESS_SECRET"),
  refreshSecret: required("JWT_REFRESH_SECRET"),
  accessTtl: "1h",
  refreshTtl: "7d",
  clientUrls: (process.env.CLIENT_URL || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean),
};
