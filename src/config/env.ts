import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "5000", 10),
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:3000",

  DATABASE_URL: process.env.DATABASE_URL!,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET!,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:5000",

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID!,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET!,
  REQUIRE_EMAIL_VERIFICATION:
    (process.env.REQUIRE_EMAIL_VERIFICATION ?? "true").toLowerCase() === "true",
  OTP_TTL_MINUTES: parseInt(process.env.OTP_TTL_MINUTES || "10", 10),

  EMAIL_HOST: process.env.EMAIL_HOST || "smtp.gmail.com",
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || "465", 10),

  EMAIL_USER: process.env.EMAIL_USER!,
  EMAIL_PASS: process.env.EMAIL_PASS!,
  EMAIL_FROM:
    process.env.EMAIL_FROM || `"Rahmah Institute" <${process.env.EMAIL_USER}>`,

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME!,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY!,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET!,

  SUPABASE_URL: process.env.SUPABASE_URL?.trim() || "",
  SUPABASE_SERVICE_KEY:
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim() ||
    "",
  SUPABASE_BUCKET: (
    process.env.SUPABASE_BUCKET?.trim() || "rahmah-uploads"
  ).toLowerCase(),

  EPS_MERCHANT_ID: process.env.EPS_MERCHANT_ID || "",
  EPS_STORE_ID: process.env.EPS_STORE_ID || "",
  EPS_USERNAME: process.env.EPS_USERNAME || "",
  EPS_PASSWORD: process.env.EPS_PASSWORD || "",
  EPS_SECRET_KEY: process.env.EPS_SECRET_KEY || "",
  EPS_API_URL: process.env.EPS_API_URL || "https://sandboxpgapi.eps.com.bd",
  EPS_SUCCESS_URL:
    process.env.EPS_SUCCESS_URL || "http://localhost:5000/api/eps/success",
  EPS_FAIL_URL:
    process.env.EPS_FAIL_URL || "http://localhost:5000/api/eps/fail",
  EPS_CANCEL_URL:
    process.env.EPS_CANCEL_URL || "http://localhost:5000/api/eps/cancel",

  ADMIN_NAME: process.env.ADMIN_NAME || "Rahmah Admin",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@rahmah-institute.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "CHANGE_ME_123!",
} as const;

export default env;
