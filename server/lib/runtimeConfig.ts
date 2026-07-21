import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const DEFAULT_HOTEL_UPI_ID = "8792629439@okaxis";
const DEFAULT_HOTEL_UPI_NAME = "Ashok Inn";
const DEFAULT_HOTEL_CONTACT_EMAIL = "info@ashokinn.com";
const DEFAULT_HOTEL_SUPPORT_PHONE = "+91 91642 30250";
const DEFAULT_HOTEL_WHATSAPP_NUMBER = "919164230250";

function getTrimmedEnv(key: string) {
  return process.env[key]?.trim() || "";
}

function normalizeUrl(url: string) {
  return url.replace(/\/+$/, "");
}

function isTruthy(value: string) {
  return value.trim().length > 0;
}

type EnvValidationResult = {
  missing: string[];
  warnings: string[];
};

export function validateEnv(isProduction: boolean): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  const supabaseUrl = getTrimmedEnv("SUPABASE_URL");
  const supabaseKey = getTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    if (isProduction) {
      if (!supabaseUrl) missing.push("SUPABASE_URL");
      if (!supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      if (!supabaseUrl) warnings.push("SUPABASE_URL");
      if (!supabaseKey) warnings.push("SUPABASE_SERVICE_ROLE_KEY");
    }
  }

  const jwtSecret = getTrimmedEnv("JWT_SECRET");
  if (!jwtSecret) {
    if (isProduction) {
      missing.push("JWT_SECRET");
    } else {
      warnings.push("JWT_SECRET");
    }
  }

  const adminUsername = getTrimmedEnv("ADMIN_USERNAME");
  const adminPassword = getTrimmedEnv("ADMIN_PASSWORD");
  if (!adminUsername || !adminPassword) {
    if (isProduction) {
      missing.push("ADMIN_USERNAME", "ADMIN_PASSWORD");
    } else {
      warnings.push("ADMIN_USERNAME", "ADMIN_PASSWORD");
    }
  }

  const emailUser = getTrimmedEnv("EMAIL_USER");
  const emailPass = getTrimmedEnv("EMAIL_PASS");
  if (!emailUser || !emailPass) {
    if (isProduction) {
      missing.push("EMAIL_USER", "EMAIL_PASS");
    } else {
      warnings.push("EMAIL_USER", "EMAIL_PASS");
    }
  }

  const razorpayKeyId = getTrimmedEnv("RAZORPAY_KEY_ID");
  const razorpayKeySecret = getTrimmedEnv("RAZORPAY_KEY_SECRET");
  if ((isTruthy(razorpayKeyId) && !isTruthy(razorpayKeySecret)) || (!isTruthy(razorpayKeyId) && isTruthy(razorpayKeySecret))) {
    warnings.push("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
  }

  const merchantId = getTrimmedEnv("MERCHANT_ID");
  const saltKey = getTrimmedEnv("SALT_KEY");
  const saltIndex = getTrimmedEnv("SALT_INDEX");
  const phonePeProvided = [merchantId, saltKey, saltIndex].some(isTruthy);
  if (phonePeProvided && !(isTruthy(merchantId) && isTruthy(saltKey) && isTruthy(saltIndex))) {
    warnings.push("MERCHANT_ID", "SALT_KEY", "SALT_INDEX");
  }

  const frontendUrl = getTrimmedEnv("FRONTEND_URL");
  if (isProduction && !frontendUrl) {
    warnings.push("FRONTEND_URL");
  }

  const googleClientId = getTrimmedEnv("GOOGLE_CLIENT_ID");
  if (googleClientId && googleClientId.length < 10) {
    warnings.push("GOOGLE_CLIENT_ID");
  }

  return { missing, warnings };
}

export function getJwtSecret() {
  return getTrimmedEnv("JWT_SECRET") || "hotel-sai-development-secret";
}

export function getFrontendUrl() {
  return normalizeUrl(getTrimmedEnv("FRONTEND_URL") || "http://localhost:5173");
}

export function getAllowedCorsOrigins() {
  const configuredOrigins = [getTrimmedEnv("FRONTEND_URL"), getTrimmedEnv("FRONTEND_URLS")]
    .flatMap((value) => value.split(","))
    .map((origin) => normalizeUrl(origin.trim()))
    .filter(Boolean);

  return Array.from(
    new Set([
      "https://ashokinn.com",
      "http://localhost:3000",
      "http://localhost:5173",
      ...configuredOrigins,
    ]),
  );
}

export function getHotelUpiDetails() {
  return {
    upiId: getTrimmedEnv("HOTEL_UPI_ID") || getTrimmedEnv("UPI_ID") || DEFAULT_HOTEL_UPI_ID,
    upiName: getTrimmedEnv("HOTEL_UPI_NAME") || getTrimmedEnv("UPI_NAME") || DEFAULT_HOTEL_UPI_NAME,
  };
}

export function getHotelContactDetails() {
  const supportPhone = getTrimmedEnv("HOTEL_SUPPORT_PHONE") || getTrimmedEnv("HOTEL_PHONE") || DEFAULT_HOTEL_SUPPORT_PHONE;
  const whatsAppNumber = (
    getTrimmedEnv("HOTEL_WHATSAPP_NUMBER") ||
    supportPhone ||
    DEFAULT_HOTEL_WHATSAPP_NUMBER
  ).replace(/\D/g, "");

  return {
    supportEmail: getTrimmedEnv("HOTEL_CONTACT_EMAIL") || getTrimmedEnv("EMAIL_USER") || DEFAULT_HOTEL_CONTACT_EMAIL,
    supportPhone,
    whatsAppNumber,
  };
}
