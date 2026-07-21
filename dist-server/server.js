// server.ts
import express from "express";
import path from "node:path";
import crypto4 from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv3 from "dotenv";
import cors from "cors";

// server/routes/authRoutes.ts
import { Router } from "express";

// server/controllers/authController.ts
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";

// server/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();
var supabaseUrl = process.env.SUPABASE_URL || "";
var supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!supabaseUrl || !supabaseServiceKey) {
  console.warn("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment.");
}
var supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

// server/lib/runtimeConfig.ts
import dotenv2 from "dotenv";
dotenv2.config();
var DEFAULT_HOTEL_UPI_ID = "8792629439@okaxis";
var DEFAULT_HOTEL_UPI_NAME = "Ashok Inn";
var DEFAULT_HOTEL_CONTACT_EMAIL = "info@ashokinn.com";
var DEFAULT_HOTEL_SUPPORT_PHONE = "+91 91642 30250";
var DEFAULT_HOTEL_WHATSAPP_NUMBER = "919164230250";
function getTrimmedEnv(key) {
  return process.env[key]?.trim() || "";
}
function normalizeUrl(url) {
  return url.replace(/\/+$/, "");
}
function isTruthy(value) {
  return value.trim().length > 0;
}
function validateEnv(isProduction) {
  const missing = [];
  const warnings = [];
  const supabaseUrl2 = getTrimmedEnv("SUPABASE_URL");
  const supabaseKey = getTrimmedEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl2 || !supabaseKey) {
    if (isProduction) {
      if (!supabaseUrl2) missing.push("SUPABASE_URL");
      if (!supabaseKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    } else {
      if (!supabaseUrl2) warnings.push("SUPABASE_URL");
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
  const emailUser2 = getTrimmedEnv("EMAIL_USER");
  const emailPass2 = getTrimmedEnv("EMAIL_PASS");
  if (!emailUser2 || !emailPass2) {
    if (isProduction) {
      missing.push("EMAIL_USER", "EMAIL_PASS");
    } else {
      warnings.push("EMAIL_USER", "EMAIL_PASS");
    }
  }
  const razorpayKeyId = getTrimmedEnv("RAZORPAY_KEY_ID");
  const razorpayKeySecret = getTrimmedEnv("RAZORPAY_KEY_SECRET");
  if (isTruthy(razorpayKeyId) && !isTruthy(razorpayKeySecret) || !isTruthy(razorpayKeyId) && isTruthy(razorpayKeySecret)) {
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
function getJwtSecret() {
  return getTrimmedEnv("JWT_SECRET") || "hotel-sai-development-secret";
}
function getFrontendUrl() {
  return normalizeUrl(getTrimmedEnv("FRONTEND_URL") || "http://localhost:5173");
}
function getAllowedCorsOrigins() {
  const configuredOrigins = [getTrimmedEnv("FRONTEND_URL"), getTrimmedEnv("FRONTEND_URLS")].flatMap((value) => value.split(",")).map((origin) => normalizeUrl(origin.trim())).filter(Boolean);
  return Array.from(
    /* @__PURE__ */ new Set([
      "https://ashokinn.com",
      "http://localhost:3000",
      "http://localhost:5173",
      ...configuredOrigins
    ])
  );
}
function getHotelUpiDetails() {
  return {
    upiId: getTrimmedEnv("HOTEL_UPI_ID") || getTrimmedEnv("UPI_ID") || DEFAULT_HOTEL_UPI_ID,
    upiName: getTrimmedEnv("HOTEL_UPI_NAME") || getTrimmedEnv("UPI_NAME") || DEFAULT_HOTEL_UPI_NAME
  };
}
function getHotelContactDetails() {
  const supportPhone = getTrimmedEnv("HOTEL_SUPPORT_PHONE") || getTrimmedEnv("HOTEL_PHONE") || DEFAULT_HOTEL_SUPPORT_PHONE;
  const whatsAppNumber = (getTrimmedEnv("HOTEL_WHATSAPP_NUMBER") || supportPhone || DEFAULT_HOTEL_WHATSAPP_NUMBER).replace(/\D/g, "");
  return {
    supportEmail: getTrimmedEnv("HOTEL_CONTACT_EMAIL") || getTrimmedEnv("EMAIL_USER") || DEFAULT_HOTEL_CONTACT_EMAIL,
    supportPhone,
    whatsAppNumber
  };
}

// server/lib/userEmail.ts
function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

// server/controllers/authController.ts
var JWT_SECRET = getJwtSecret();
var PASSWORD_RESET_TTL_MINUTES = 30;
var GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
var googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;
var emailUser = process.env.EMAIL_USER || "";
var emailPass = process.env.EMAIL_PASS || "";
var emailConfigured = Boolean(emailUser && emailPass);
var emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass
  }
});
if (emailConfigured) {
  emailTransporter.verify((error) => {
    if (error) {
      console.error("Auth email transporter verification failed:", error);
    }
  });
}
function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
function sendPasswordResetEmail(email, resetUrl) {
  if (!emailConfigured) {
    console.warn("Email credentials are not configured. Skipping reset email.");
    return;
  }
  emailTransporter.sendMail({
    from: emailUser,
    to: email,
    subject: "Reset your password - Ashok Inn",
    html: `
      <p>Hello,</p>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">Reset your password</a></p>
      <p>This link will expire in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
    `,
    text: `Reset your password using this link: ${resetUrl}`
  }, (error) => {
    if (error) {
      console.error("Failed to send reset email:", error);
    }
  });
}
async function findUserByEmailAndPassword(email, password) {
  const normalizedEmail = normalizeEmail(email);
  const { data: candidates, error } = await supabase.from("users").select("*").eq("email", normalizedEmail).order("created_at", { ascending: false });
  if (error || !candidates || candidates.length === 0) {
    return null;
  }
  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(password, candidate.password);
    if (isMatch) {
      return candidate;
    }
  }
  return null;
}
function issueUserToken(user) {
  return jwt.sign(
    { role: "user", userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}
function issueAdminToken(username) {
  return jwt.sign(
    { role: "admin", username },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}
var registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Please fill all fields" });
    }
    const normalizedName = String(name).trim();
    const normalizedEmail = normalizeEmail(String(email));
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", normalizedEmail).maybeSingle();
    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase.from("users").insert({ name: normalizedName, email: normalizedEmail, password: hashedPassword }).select().single();
    if (error || !user) {
      throw new Error(error?.message || "Failed to create user record");
    }
    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Server error during registration" });
  }
};
var loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    const user = await findUserByEmailAndPassword(String(email), String(password));
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password" });
    }
    return res.json({
      success: true,
      token: issueUserToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Server error during login" });
  }
};
var loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    if (username === adminUsername && password === adminPassword) {
      return res.json({
        success: true,
        token: issueAdminToken(adminUsername)
      });
    }
    return res.status(401).json({ success: false, error: "Invalid credentials" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
var loginWithGoogle = async (req, res) => {
  try {
    const idToken = String(req.body?.idToken || "").trim();
    if (!idToken) {
      return res.status(400).json({ success: false, error: "Google token is required" });
    }
    if (!googleClient || !GOOGLE_CLIENT_ID) {
      return res.status(500).json({ success: false, error: "Google login is not configured" });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload?.email ? normalizeEmail(payload.email) : "";
    if (!email) {
      return res.status(400).json({ success: false, error: "Unable to read Google account email" });
    }
    let { data: user } = await supabase.from("users").select("*").eq("email", email).maybeSingle();
    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const displayName = payload?.name?.trim() || "Guest";
      const { data: newUser, error } = await supabase.from("users").insert({ name: displayName, email, password: hashedPassword }).select().single();
      if (error || !newUser) {
        throw new Error(error?.message || "Failed to create Google user");
      }
      user = newUser;
    }
    return res.json({
      success: true,
      token: issueUserToken(user),
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Google login error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Google login failed" });
  }
};
var forgotPassword = async (req, res) => {
  try {
    const rawEmail = String(req.body?.email || "").trim();
    if (!rawEmail) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }
    const normalizedEmail = normalizeEmail(rawEmail);
    const { data: user } = await supabase.from("users").select("*").eq("email", normalizedEmail).maybeSingle();
    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = hashResetToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1e3);
      const { error } = await supabase.from("users").update({
        password_reset_token_hash: resetTokenHash,
        password_reset_expires_at: expiresAt.toISOString()
      }).eq("id", user.id);
      if (error) throw error;
      const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
      sendPasswordResetEmail(user.email, resetUrl);
      if (process.env.NODE_ENV !== "production") {
        return res.json({
          success: true,
          message: "Password reset link generated.",
          resetUrl
        });
      }
    }
    return res.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent."
    });
  } catch (error) {
    console.error("Forgot password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Unable to process your request right now." });
  }
};
var resetPassword = async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const password = String(req.body?.password || "");
    if (!token || !password) {
      return res.status(400).json({ success: false, error: "Token and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters long" });
    }
    const resetTokenHash = hashResetToken(token);
    const { data: user } = await supabase.from("users").select("*").eq("password_reset_token_hash", resetTokenHash).gt("password_reset_expires_at", (/* @__PURE__ */ new Date()).toISOString()).maybeSingle();
    if (!user) {
      return res.status(400).json({ success: false, error: "This reset link is invalid or has expired." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const { error } = await supabase.from("users").update({
      password: hashedPassword,
      password_reset_token_hash: null,
      password_reset_expires_at: null
    }).eq("id", user.id);
    if (error) throw error;
    return res.json({ success: true, message: "Password reset successful." });
  } catch (error) {
    console.error("Reset password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Unable to reset password right now." });
  }
};
var getCurrentUser = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }
    const { data: user, error } = await supabase.from("users").select("id, name, email").eq("id", userId).maybeSingle();
    if (error || !user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: "user" }
    });
  } catch (error) {
    console.error("Get profile error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to load profile" });
  }
};
var updateProfile = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }
    const { name, email } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Name and email are required" });
    }
    const normalizedName = String(name).trim();
    const normalizedEmail = normalizeEmail(String(email));
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", normalizedEmail).neq("id", userId).maybeSingle();
    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email is already in use" });
    }
    const { data: updatedUser, error: updateError } = await supabase.from("users").update({ name: normalizedName, email: normalizedEmail }).eq("id", userId).select("id, name, email").single();
    if (updateError || !updatedUser) {
      throw updateError || new Error("Failed to update profile");
    }
    return res.json({
      success: true,
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: "user" }
    });
  } catch (error) {
    console.error("Update profile error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
};
var changePassword = async (req, res) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Please provide both passwords" });
    }
    const { data: user } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase.from("users").update({ password: hashedPassword }).eq("id", userId);
    if (error) throw error;
    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to change password" });
  }
};

// server/middleware/authMiddleware.ts
import jwt2 from "jsonwebtoken";
var JWT_SECRET2 = getJwtSecret();
function requireAuth(role) {
  return (request, response, next) => {
    const authorizationHeader = request.headers.authorization;
    if (!authorizationHeader?.startsWith("Bearer ")) {
      return response.status(401).json({ success: false, error: "Authentication required" });
    }
    const token = authorizationHeader.slice("Bearer ".length).trim();
    try {
      const payload = jwt2.verify(token, JWT_SECRET2);
      if (payload.role !== role) {
        return response.status(403).json({ success: false, error: "You do not have access to this resource" });
      }
      request.auth = payload;
      next();
    } catch (error) {
      return response.status(401).json({ success: false, error: "Your session has expired. Please sign in again." });
    }
  };
}

// server/routes/authRoutes.ts
var router = Router();
router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/admin/login", loginAdmin);
router.post("/google", loginWithGoogle);
router.get("/me", requireAuth("user"), getCurrentUser);
router.put("/me", requireAuth("user"), updateProfile);
router.post("/change-password", requireAuth("user"), changePassword);
var authRoutes_default = router;

// server/routes/roomRoutes.ts
import { Router as Router2 } from "express";

// server/data/defaultRooms.ts
var defaultRooms = [
  {
    title: "Deluxe Ocean View Room",
    description: "Experience the ultimate relaxation in our Deluxe Ocean View Room. Featuring pristine modern design, a king-size bed, and a private balcony overseeing the magnificent coastline.",
    price: 3500,
    images: [
      "https://assets.anantara.com/image/upload/q_auto,f_auto,c_limit,w_1045/media/minor/anantara/images/anantara-peace-haven-tangalle-resort/accommodation/details-page/deluxe-ocean-view-room/anantara_peace_haven_tangalle_premier_ocean_view_room_bath_intro_944x510.jpg",
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c0d13c90?auto=format&fit=crop&q=80"
    ],
    roomType: "Deluxe Room",
    capacity: 2,
    amenities: ["Free WiFi", "Ocean View", "King Bed", "Mini Bar", "Air Conditioning"],
    availableRooms: 5
  },
  {
    title: "Executive City Suite",
    description: "Perfect for business and leisure travelers alike, the Executive Suite offers a spacious living area, ergonomic workspace, and premium services.",
    price: 5500,
    images: [
      "https://www.fourseasons.com/alt/img-opt/~65.1701.0,0000-215,0231-3000,0000-1687,5000/publish/content/dam/fourseasons/images/web/BNG/BNG_768_original.jpg",
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&q=80"
    ],
    roomType: "Executive Room",
    capacity: 2,
    amenities: ["Free WiFi", "City View", "Workspace", "Lounge Access", "Coffee Maker", "Television"],
    availableRooms: 4
  },
  {
    title: "Premium Family Suite",
    description: "Designed for family getaways, our Family Suite provides two interconnecting rooms, panoramic views, and tailored comfort for up to four guests.",
    price: 8500,
    images: [
      "https://www.royaltuskersuites.com/images/uploads/54/1663224403RT-EDR-3.png?59723793?0.21859776048476365",
      "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c0d13c90?auto=format&fit=crop&q=80"
    ],
    roomType: "Family Suite",
    capacity: 4,
    amenities: ["Free WiFi", "2 Bedrooms", "Kitchenette", "Living Area", "Bathtub", "Smart TV"],
    availableRooms: 3
  },
  {
    title: "Presidential Royal Suite",
    description: "Indulge in pure luxury with our Presidential Suite. Features a private kitchen, master living room, stunning panoramic city views, and dedicated butler service.",
    price: 15e3,
    images: [
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&q=80"
    ],
    roomType: "Presidential Suite",
    capacity: 6,
    amenities: ["Free WiFi", "Private Kitchen", "Panoramic Views", "Dedicated Butler", "King Bed", "Living Room", "Jacuzzi"],
    availableRooms: 1
  },
  {
    title: "Classic Single Cozy Room",
    description: "Cozy and convenient, our Classic Single Room is ideal for solo travelers. Equipped with a comfortable queen bed, workspaces, and essential amenities for a pleasant stay.",
    price: 1800,
    images: [
      "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&q=80"
    ],
    roomType: "Single Room",
    capacity: 1,
    amenities: ["Free WiFi", "Queen Bed", "Desk Workspace", "Mini Fridge", "Air Conditioning"],
    availableRooms: 8
  },
  {
    title: "Standard Twin Double Room",
    description: "Comfortable room featuring two twin beds, perfect for friends or business colleagues sharing a stay.",
    price: 2500,
    images: [
      "https://images.unsplash.com/photo-1568495248636-6432b97bd949?auto=format&fit=crop&q=80",
      "https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&q=80"
    ],
    roomType: "Double Room",
    capacity: 2,
    amenities: ["Free WiFi", "Twin Beds", "Desk Workspace", "Air Conditioning", "Coffee Maker"],
    availableRooms: 6
  }
];

// server/lib/ensureDefaultRooms.ts
async function ensureDefaultRooms() {
  try {
    const { count, error } = await supabase.from("rooms").select("id", { count: "exact", head: true });
    if (error) {
      console.error("ensureDefaultRooms count query failed:", error.message);
      return false;
    }
    const roomCount = count || 0;
    if (roomCount > 0) {
      return false;
    }
    const rows = defaultRooms.map((room) => ({
      title: room.title,
      description: room.description,
      price: room.price,
      images: room.images,
      room_type: room.roomType,
      capacity: room.capacity,
      amenities: room.amenities,
      available_rooms: room.availableRooms
    }));
    const { error: insertError } = await supabase.from("rooms").insert(rows);
    if (insertError) {
      console.error("ensureDefaultRooms insert query failed:", insertError.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("ensureDefaultRooms error:", error);
    return false;
  }
}

// server/lib/adapters.ts
function adaptRoom(room) {
  if (!room) return null;
  return {
    ...room,
    roomType: room.room_type,
    availableRooms: room.available_rooms
  };
}
function adaptBooking(booking) {
  if (!booking) return null;
  let adaptedRoom = booking.roomId;
  if (adaptedRoom && typeof adaptedRoom === "object") {
    adaptedRoom = adaptRoom(adaptedRoom);
  }
  let adaptedUser = booking.userId;
  if (adaptedUser && typeof adaptedUser === "object") {
    adaptedUser = {
      ...adaptedUser
    };
  }
  return {
    ...booking,
    userId: adaptedUser || booking.user_id,
    roomId: adaptedRoom || booking.room_id,
    bookingRef: booking.booking_ref,
    checkInDate: booking.check_in_date,
    checkOutDate: booking.check_out_date,
    totalPrice: Number(booking.total_price),
    transactionId: booking.transaction_id,
    paymentStatus: booking.payment_status,
    bookingStatus: booking.booking_status,
    paymentMethod: booking.payment_method,
    paymentId: booking.payment_id,
    orderId: booking.order_id,
    signature: booking.signature,
    paymentSubmittedAt: booking.payment_submitted_at,
    paymentVerifiedAt: booking.payment_verified_at,
    bookingConfirmedAt: booking.booking_confirmed_at,
    checkedInAt: booking.checked_in_at,
    checkedOutAt: booking.checked_out_at,
    cancelledAt: booking.cancelled_at,
    createdAt: booking.created_at
  };
}

// server/controllers/roomController.ts
var getRooms = async (req, res) => {
  try {
    let { data: rooms, error } = await supabase.from("rooms").select("*");
    if (error) throw error;
    if (!rooms || rooms.length === 0) {
      await ensureDefaultRooms();
      const { data: seededRooms, error: seededError } = await supabase.from("rooms").select("*");
      if (seededError) throw seededError;
      rooms = seededRooms;
    }
    const adaptedRooms = (rooms || []).map(adaptRoom);
    return res.json({ success: true, rooms: adaptedRooms });
  } catch (error) {
    console.error("Fetch rooms error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch rooms" });
  }
};
var getRoomById = async (req, res) => {
  try {
    const { data: room, error } = await supabase.from("rooms").select("*").eq("id", req.params.id).maybeSingle();
    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room: adaptRoom(room) });
  } catch (error) {
    console.error("Fetch room by id error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to fetch room" });
  }
};
var createRoom = async (req, res) => {
  try {
    const { data: room, error } = await supabase.from("rooms").insert(req.body).select().single();
    if (error) throw error;
    return res.status(201).json({ success: true, room: adaptRoom(room) });
  } catch (error) {
    console.error("Create room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to create room" });
  }
};
var updateRoom = async (req, res) => {
  try {
    const { data: room, error } = await supabase.from("rooms").update(req.body).eq("id", req.params.id).select().single();
    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, room: adaptRoom(room) });
  } catch (error) {
    console.error("Update room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to update room" });
  }
};
var deleteRoom = async (req, res) => {
  try {
    const { data: room, error } = await supabase.from("rooms").delete().eq("id", req.params.id).select().maybeSingle();
    if (error) throw error;
    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    return res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    console.error("Delete room error:", error.message);
    return res.status(500).json({ success: false, error: "Failed to delete room" });
  }
};

// server/routes/roomRoutes.ts
var router2 = Router2();
router2.get("/", getRooms);
router2.get("/:id", getRoomById);
router2.post("/", requireAuth("admin"), createRoom);
router2.put("/:id", requireAuth("admin"), updateRoom);
router2.delete("/:id", requireAuth("admin"), deleteRoom);
var roomRoutes_default = router2;

// server/routes/bookingRoutes.ts
import { Router as Router3 } from "express";

// server/controllers/bookingController.ts
import Razorpay from "razorpay";
import crypto2 from "crypto";
import nodemailer2 from "nodemailer";

// server/lib/bookingLifecycle.ts
var ACTIVE_BOOKING_STATUSES = ["pending", "pending_payment", "confirmed", "checked_in"];

// server/lib/bookingValidation.ts
var BookingValidationError = class extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "BookingValidationError";
    this.status = status;
  }
};
function parseDate(value, label) {
  if (!value) {
    throw new BookingValidationError(`${label} is required`);
  }
  const parsed = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BookingValidationError(`${label} is invalid`);
  }
  return parsed;
}
function getStartOfDay(value) {
  const normalized = new Date(value);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}
function calculateNights(checkInDate, checkOutDate) {
  const diff = checkOutDate.getTime() - checkInDate.getTime();
  return Math.ceil(diff / (1e3 * 60 * 60 * 24));
}
async function validateBookingInput(room, bookingData) {
  if (!bookingData) {
    throw new BookingValidationError("Booking details are required");
  }
  const name = bookingData.name?.trim();
  const email = bookingData.email?.trim().toLowerCase();
  const phone = bookingData.phone?.trim();
  const guests = Number(bookingData.guests);
  if (!name || !email || !phone) {
    throw new BookingValidationError("Name, email, and phone are required");
  }
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new BookingValidationError("Please provide a valid email address");
  }
  if (!Number.isInteger(guests) || guests <= 0) {
    throw new BookingValidationError("Guest count must be at least 1");
  }
  if (guests > room.capacity) {
    throw new BookingValidationError(`This room allows up to ${room.capacity} guest(s)`);
  }
  if (room.available_rooms <= 0) {
    throw new BookingValidationError("This room is currently unavailable", 409);
  }
  const checkInDate = getStartOfDay(parseDate(bookingData.checkInDate, "Check-in date"));
  const checkOutDate = getStartOfDay(parseDate(bookingData.checkOutDate, "Check-out date"));
  const today = getStartOfDay(/* @__PURE__ */ new Date());
  if (checkInDate < today) {
    throw new BookingValidationError("Check-in date cannot be in the past");
  }
  if (checkOutDate <= checkInDate) {
    throw new BookingValidationError("Check-out date must be after check-in date");
  }
  const nights = calculateNights(checkInDate, checkOutDate);
  if (nights <= 0) {
    throw new BookingValidationError("Please select valid booking dates");
  }
  return {
    name,
    email,
    phone,
    guests,
    checkInDate,
    checkOutDate,
    nights,
    totalPrice: nights * room.price
  };
}
async function ensureRoomAvailability(roomId, checkInDate, checkOutDate, availableRooms, excludeBookingId) {
  let query = supabase.from("bookings").select("id", { count: "exact", head: true }).eq("room_id", roomId).in("booking_status", ACTIVE_BOOKING_STATUSES).lt("check_in_date", checkOutDate.toISOString()).gt("check_out_date", checkInDate.toISOString());
  if (excludeBookingId) {
    query = query.neq("id", excludeBookingId);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  const overlappingBookings = count || 0;
  if (overlappingBookings >= availableRooms) {
    throw new BookingValidationError("Selected dates are no longer available for this room", 409);
  }
}

// server/controllers/bookingController.ts
var razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "test_key",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "test_secret"
});
var transporter = nodemailer2.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
transporter.verify((error) => {
  if (error) {
    console.error("Email transporter verification failed:", error);
  }
});
function getBookingFrontendUrl() {
  return getFrontendUrl();
}
function getUpiId() {
  return getHotelUpiDetails().upiId || "your-upi-id@phonepe";
}
function getSupportContactSummary() {
  const contactDetails = getHotelContactDetails();
  const parts = [
    contactDetails.whatsAppNumber ? `WhatsApp: ${contactDetails.supportPhone || contactDetails.whatsAppNumber}` : "",
    contactDetails.supportEmail ? `Email: ${contactDetails.supportEmail}` : ""
  ].filter(Boolean);
  return parts.join(" | ");
}
function handleBookingError(error, response, fallbackMessage) {
  if (error instanceof BookingValidationError) {
    return response.status(error.status).json({ success: false, error: error.message });
  }
  return response.status(500).json({ success: false, error: fallbackMessage });
}
function formatDate(date) {
  return new Date(date).toLocaleDateString(void 0, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}
function buildBookingEmailHTML({
  name,
  bookingRef,
  roomTitle,
  checkInDate,
  checkOutDate,
  guests,
  totalPrice,
  headline,
  message,
  actionLabel,
  actionUrl,
  secondaryActionLabel,
  secondaryActionUrl,
  extraInfo
}) {
  const checkIn = formatDate(checkInDate);
  const checkOut = formatDate(checkOutDate);
  const amount = `Rs. ${totalPrice.toFixed(2)}`;
  return `
    <html>
      <body style="margin:0;padding:0;font-family:system-ui, -apple-system, 'Segoe UI', sans-serif; background:#f4f6f9;">
        <center style="width:100%;background:#f4f6f9;padding:40px 0;">
          <table width="600" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,0.08);">
            <tr>
              <td style="background:#0b1b3d;padding:24px 32px;color:#ffffff;text-align:center;">
                <h1 style="margin:0;font-size:24px;letter-spacing:0.5px;">Ashok Inn</h1>
                <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Booking Confirmation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 32px 24px;">
                <h2 style="margin:0 0 12px;font-size:20px;color:#0b1b3d;">${headline}</h2>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155;">Hi ${name},</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${message}</p>

                <table width="100%" style="border-collapse:collapse;margin-bottom:24px;">
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Booking ref</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${bookingRef}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Room</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${roomTitle}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Dates</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${checkIn} to ${checkOut}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Guests</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${guests}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:12px 14px;background:#f1f5f9;border-radius:12px;margin-top:8px;">
                      <strong style="font-size:13px;color:#0b1b3d;">Amount</strong><br />
                      <span style="font-size:15px;color:#0b1b3d;">${amount}</span>
                    </td>
                  </tr>
                </table>

                ${actionUrl || secondaryActionUrl ? `
                  <div style="text-align:center;margin-bottom:24px;">
                    ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;padding:12px 24px;background:#0b1b3d;color:#ffffff;border-radius:999px;text-decoration:none;font-weight:600;margin:0 6px 12px;">${actionLabel || "View details"}</a>` : ""}
                    ${secondaryActionUrl ? `<a href="${secondaryActionUrl}" style="display:inline-block;padding:12px 24px;background:#ffffff;color:#0b1b3d;border:1px solid #cbd5e1;border-radius:999px;text-decoration:none;font-weight:600;margin:0 6px 12px;">${secondaryActionLabel || "Open booking"}</a>` : ""}
                  </div>
                ` : ""}

                ${extraInfo ? `<div style="font-size:13px;line-height:1.6;color:#475569;padding:14px 16px;background:#f8fafc;border-radius:12px;">${extraInfo}</div>` : ""}

                <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">If you have any questions, reply to this email and we'll help you right away.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#0b1b3d;padding:18px 32px;text-align:center;color:#cbd5e1;font-size:12px;">
                (c) ${(/* @__PURE__ */ new Date()).getFullYear()} Ashok Inn. All rights reserved.
              </td>
            </tr>
          </table>
        </center>
      </body>
    </html>
  `;
}
function sendEmail({ to, subject, html, text }) {
  transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
    text
  }, (err, info) => {
    if (err) {
      console.error("Email error:", err);
    } else {
      console.log("Email sent:", info?.response);
    }
  });
}
var createRazorpayOrder = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: "A valid amount is required" });
    }
    const options = {
      amount: amount * 100,
      // Razorpay works in paise
      currency: "INR",
      receipt: `receipt_${Date.now()}`
    };
    const order = await razorpay.orders.create(options);
    return res.json({ success: true, order });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to create order" });
  }
};
var searchBooking = async (req, res) => {
  try {
    const bookingRef = String(req.body?.bookingRef || "").trim();
    const email = normalizeEmail(String(req.body?.email || ""));
    if (!bookingRef || !email) {
      return res.status(400).json({ success: false, error: "Booking reference and email are required" });
    }
    const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").ilike("booking_ref", bookingRef).ilike("email", email).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }
    const roomTitle = booking.roomId?.title || "Room";
    return res.json({
      success: true,
      booking: {
        bookingRef: booking.booking_ref,
        roomType: roomTitle,
        checkIn: booking.check_in_date,
        checkOut: booking.check_out_date,
        guests: booking.guests,
        status: booking.booking_status
      }
    });
  } catch (error) {
    console.error("Search booking error:", error);
    return res.status(500).json({ success: false, error: "Failed to search booking" });
  }
};
var createPayAtHotelBooking = async (req, res) => {
  try {
    const { bookingData } = req.body;
    const { roomId } = bookingData || {};
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    const validatedBooking = await validateBookingInput(room, bookingData);
    await ensureRoomAvailability(
      room.id,
      validatedBooking.checkInDate,
      validatedBooking.checkOutDate,
      room.available_rooms
    );
    const bookingRef = `AIH-${Date.now()}`;
    const { data: booking, error: insertError } = await supabase.from("bookings").insert({
      booking_ref: bookingRef,
      user_id: req.auth?.userId,
      room_id: roomId,
      name: validatedBooking.name,
      email: validatedBooking.email,
      phone: validatedBooking.phone,
      check_in_date: validatedBooking.checkInDate.toISOString(),
      check_out_date: validatedBooking.checkOutDate.toISOString(),
      guests: validatedBooking.guests,
      total_price: validatedBooking.totalPrice,
      payment_status: "pending",
      booking_status: "confirmed",
      payment_method: "pay_at_hotel"
    }).select().single();
    if (insertError || !booking) {
      throw insertError || new Error("Failed to insert booking record");
    }
    const bookingUrl = `${getBookingFrontendUrl()}/my-bookings`;
    const payNowUrl = `${getBookingFrontendUrl()}/payment/${booking.id}`;
    const html = buildBookingEmailHTML({
      name: validatedBooking.name,
      bookingRef,
      roomTitle: room.title,
      checkInDate: validatedBooking.checkInDate,
      checkOutDate: validatedBooking.checkOutDate,
      guests: validatedBooking.guests,
      totalPrice: validatedBooking.totalPrice,
      headline: "Your booking is confirmed!",
      message: "Thanks for booking with Ashok Inn. Your reservation is confirmed and you can pay at the hotel upon arrival. If you want a faster check-in experience, you can also pay online before you arrive.",
      actionLabel: "Pay now to save time",
      actionUrl: payNowUrl,
      secondaryActionLabel: "View my bookings",
      secondaryActionUrl: bookingUrl,
      extraInfo: "Paying now is optional. Your room is already confirmed, and you can still choose to pay at the hotel."
    });
    sendEmail({
      to: validatedBooking.email,
      subject: "Booking Confirmed - Ashok Inn",
      html,
      text: `Hello ${validatedBooking.name}, your booking for room ${room.title} is confirmed. Booking Ref: ${bookingRef}. Total Amount: Rs. ${validatedBooking.totalPrice}. You can pay at the hotel upon arrival or pay now to save time here: ${payNowUrl}`
    });
    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Booking creation failed");
  }
};
var createManualBooking = async (req, res) => {
  try {
    const { bookingData } = req.body;
    const { roomId } = bookingData || {};
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    const validatedBooking = await validateBookingInput(room, bookingData);
    await ensureRoomAvailability(
      room.id,
      validatedBooking.checkInDate,
      validatedBooking.checkOutDate,
      room.available_rooms
    );
    const bookingRef = `AIH-${Date.now()}`;
    const { data: booking, error: insertError } = await supabase.from("bookings").insert({
      booking_ref: bookingRef,
      user_id: req.auth?.userId,
      room_id: roomId,
      name: validatedBooking.name,
      email: validatedBooking.email,
      phone: validatedBooking.phone,
      check_in_date: validatedBooking.checkInDate.toISOString(),
      check_out_date: validatedBooking.checkOutDate.toISOString(),
      guests: validatedBooking.guests,
      total_price: validatedBooking.totalPrice,
      payment_status: "pending",
      booking_status: "pending_payment",
      payment_method: "manual_upi"
    }).select().single();
    if (insertError || !booking) {
      throw insertError || new Error("Failed to insert booking record");
    }
    const paymentUrl = `${getBookingFrontendUrl()}/payment/${booking.id}`;
    const supportContactSummary = getSupportContactSummary();
    const html = buildBookingEmailHTML({
      name: validatedBooking.name,
      bookingRef,
      roomTitle: room.title,
      checkInDate: validatedBooking.checkInDate,
      checkOutDate: validatedBooking.checkOutDate,
      guests: validatedBooking.guests,
      totalPrice: validatedBooking.totalPrice,
      headline: "Your booking is almost complete",
      message: `Please complete payment via UPI to continue your reservation. Your UPI ID is <strong>${getUpiId()}</strong>. After payment, use the confirmation options on your payment page to message the hotel on WhatsApp or email with your booking reference and payment proof.`,
      actionLabel: "View payment instructions",
      actionUrl: paymentUrl,
      extraInfo: supportContactSummary ? `Manual UPI payments are verified by hotel staff before the booking is marked as paid. Contact options: ${supportContactSummary}.` : "Manual UPI payments are verified by hotel staff before the booking is marked as paid."
    });
    sendEmail({
      to: validatedBooking.email,
      subject: "Complete your payment - Ashok Inn",
      html,
      text: `Hello ${validatedBooking.name}, please complete payment of Rs. ${validatedBooking.totalPrice} to UPI ID ${getUpiId()}. Booking Ref: ${bookingRef}. After payment, use the payment page to confirm with the hotel on WhatsApp or email so staff can verify it.`
    });
    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Booking creation failed");
  }
};
var getBooking = async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("id", req.params.id).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }
    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    const adapted = adaptBooking(booking);
    return res.json({
      success: true,
      booking: {
        ...adapted,
        ...getHotelUpiDetails(),
        ...getHotelContactDetails()
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to load booking" });
  }
};
var confirmPayment = async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("id", req.params.id).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }
    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }
    if (booking.payment_method === "manual_upi") {
      if (["cancelled", "completed"].includes(booking.booking_status)) {
        return res.status(400).json({
          success: false,
          error: "This booking can no longer accept payment submissions."
        });
      }
      if (booking.payment_status === "paid") {
        return res.status(400).json({
          success: false,
          error: "This payment has already been verified by hotel staff."
        });
      }
      let updatedBooking = booking;
      if (booking.payment_status !== "submitted") {
        const { data: updated, error: updateError } = await supabase.from("bookings").update({
          payment_status: "submitted",
          booking_status: "pending_payment"
        }).eq("id", booking.id).select("*, roomId:rooms(*)").single();
        if (updateError) throw updateError;
        updatedBooking = updated;
      }
      return res.json({
        success: true,
        message: "Payment submitted successfully. Hotel staff will verify it shortly.",
        booking: adaptBooking(updatedBooking)
      });
    }
    return res.status(400).json({
      success: false,
      error: "This booking does not support manual payment confirmation."
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to confirm payment" });
  }
};
var verifyPaymentAndBook = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      paymentMethod = "card",
      bookingData
    } = req.body;
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto2.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "test_secret").update(body.toString()).digest("hex");
    const isAuthentic = expectedSignature === razorpay_signature;
    if (!isAuthentic) {
      return res.status(400).json({ success: false, error: "Invalid API signature" });
    }
    const { roomId } = bookingData || {};
    const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
    if (roomError || !room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    const validatedBooking = await validateBookingInput(room, bookingData);
    await ensureRoomAvailability(
      room.id,
      validatedBooking.checkInDate,
      validatedBooking.checkOutDate,
      room.available_rooms
    );
    const bookingRef = `AIH-${Date.now()}`;
    const { data: booking, error: insertError } = await supabase.from("bookings").insert({
      booking_ref: bookingRef,
      user_id: req.auth?.userId,
      room_id: roomId,
      name: validatedBooking.name,
      email: validatedBooking.email,
      phone: validatedBooking.phone,
      check_in_date: validatedBooking.checkInDate.toISOString(),
      check_out_date: validatedBooking.checkOutDate.toISOString(),
      guests: validatedBooking.guests,
      total_price: validatedBooking.totalPrice,
      payment_status: "paid",
      booking_status: "confirmed",
      payment_method: paymentMethod || "card",
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      signature: razorpay_signature
    }).select().single();
    if (insertError || !booking) {
      throw insertError || new Error("Failed to create booking");
    }
    transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: validatedBooking.email,
      subject: "Booking Confirmation - Ashok Inn",
      text: `Hello ${validatedBooking.name}, your booking for room ${room.title} is confirmed. Booking Ref: ${bookingRef}. Total Paid: Rs. ${validatedBooking.totalPrice}.`
    }, (err, info) => {
      if (err) {
        console.error("Email error:", err);
      } else {
        console.log("Email sent:", info?.response);
      }
    });
    return res.status(201).json({ success: true, booking: adaptBooking(booking) });
  } catch (error) {
    return handleBookingError(error, res, "Payment verification failed");
  }
};
var getMyBookings = async (req, res) => {
  try {
    const { data: bookings, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("user_id", req.auth?.userId).order("created_at", { ascending: false });
    if (error) throw error;
    const adapted = (bookings || []).map(adaptBooking);
    return res.json({ success: true, bookings: adapted });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
};
var getAllBookings = async (req, res) => {
  try {
    const { data: bookings, error } = await supabase.from("bookings").select("*, roomId:rooms(*), userId:users(*)").order("created_at", { ascending: false });
    if (error) throw error;
    const adapted = (bookings || []).map(adaptBooking);
    return res.json({ success: true, bookings: adapted });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
};
var deleteBooking = async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from("bookings").delete().eq("id", req.params.id).select().maybeSingle();
    if (error || !booking) return res.status(404).json({ success: false, error: "Not found" });
    return res.json({ success: true, message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to delete" });
  }
};
var verifyManualUpiPayment = async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("id", req.params.id).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }
    if (booking.payment_method !== "manual_upi") {
      return res.status(400).json({
        success: false,
        error: "Only manual UPI bookings can be verified from this action."
      });
    }
    if (["cancelled", "completed"].includes(booking.booking_status)) {
      return res.status(400).json({
        success: false,
        error: "This booking can no longer be verified."
      });
    }
    if (booking.payment_status === "paid") {
      return res.status(400).json({
        success: false,
        error: "This manual UPI payment has already been verified."
      });
    }
    const { data: updated, error: updateError } = await supabase.from("bookings").update({
      payment_status: "paid",
      booking_status: "confirmed",
      payment_id: booking.payment_id || `manual-upi-${Date.now()}`
    }).eq("id", booking.id).select("*, roomId:rooms(*)").single();
    if (updateError || !updated) {
      throw updateError || new Error("Failed to update status");
    }
    const roomTitle = updated.roomId?.title || "Room";
    const bookingUrl = `${getBookingFrontendUrl()}/booking-confirmation/${updated.id}`;
    const html = buildBookingEmailHTML({
      name: updated.name,
      bookingRef: updated.booking_ref,
      roomTitle,
      checkInDate: new Date(updated.check_in_date),
      checkOutDate: new Date(updated.check_out_date),
      guests: updated.guests,
      totalPrice: Number(updated.total_price),
      headline: "Your manual UPI payment has been verified",
      message: "Our team has verified your UPI transfer. Your booking is now fully confirmed and ready for your stay.",
      actionLabel: "View booking confirmation",
      actionUrl: bookingUrl,
      extraInfo: "Please keep your booking reference handy when you arrive at the hotel."
    });
    sendEmail({
      to: updated.email,
      subject: "Manual UPI payment verified - Ashok Inn",
      html,
      text: `Hello ${updated.name}, your manual UPI payment for booking ${updated.booking_ref} has been verified. Your booking is now confirmed.`
    });
    return res.json({
      success: true,
      message: "Manual UPI payment verified successfully.",
      booking: adaptBooking(updated)
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to verify manual UPI payment" });
  }
};
var updateBookingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = /* @__PURE__ */ new Set(["pending", "pending_payment", "confirmed", "checked_in", "cancelled", "completed"]);
    if (!allowedStatuses.has(status)) {
      return res.status(400).json({ success: false, error: "Invalid booking status" });
    }
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", req.params.id).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    if (booking.booking_status === status) {
      return res.json({ success: true, booking: adaptBooking(booking) });
    }
    const allowedTransitions = {
      pending: /* @__PURE__ */ new Set(["pending_payment", "confirmed", "cancelled"]),
      pending_payment: /* @__PURE__ */ new Set(["confirmed", "cancelled"]),
      confirmed: /* @__PURE__ */ new Set(["checked_in", "cancelled"]),
      checked_in: /* @__PURE__ */ new Set(["completed"]),
      cancelled: /* @__PURE__ */ new Set(),
      completed: /* @__PURE__ */ new Set()
    };
    const nextStatuses = allowedTransitions[booking.booking_status];
    if (!nextStatuses || !nextStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        error: "This booking cannot move to that status."
      });
    }
    const canConfirmWithoutPaidStatus = booking.payment_method === "pay_at_hotel";
    if (status === "confirmed" && booking.payment_status !== "paid" && !canConfirmWithoutPaidStatus) {
      return res.status(400).json({
        success: false,
        error: "This booking cannot be confirmed until the payment is verified."
      });
    }
    if (status === "checked_in" && booking.booking_status !== "confirmed") {
      return res.status(400).json({
        success: false,
        error: "Only confirmed bookings can be checked in."
      });
    }
    const updates = {
      booking_status: status
    };
    if (status === "checked_in" && booking.payment_method === "pay_at_hotel" && booking.payment_status !== "paid") {
      updates.payment_status = "paid";
      updates.payment_id = booking.payment_id || `hotel-desk-${Date.now()}`;
    }
    const { data: updated, error: updateError } = await supabase.from("bookings").update(updates).eq("id", booking.id).select().single();
    if (updateError) throw updateError;
    return res.json({ success: true, booking: adaptBooking(updated) });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Failed to update" });
  }
};
var cancelBooking = async (req, res) => {
  try {
    const { data: booking, error } = await supabase.from("bookings").select("*").eq("id", req.params.id).maybeSingle();
    if (error || !booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }
    if (booking.user_id !== req.auth?.userId) {
      return res.status(403).json({ success: false, error: "You can only cancel your own bookings" });
    }
    if (booking.booking_status !== "confirmed" && booking.booking_status !== "pending_payment") {
      return res.status(400).json({ success: false, error: "This booking cannot be cancelled" });
    }
    const { data: updated, error: updateError } = await supabase.from("bookings").update({
      booking_status: "cancelled"
    }).eq("id", booking.id).select().single();
    if (updateError || !updated) {
      throw updateError || new Error("Failed to cancel");
    }
    const { data: room } = await supabase.from("rooms").select("title").eq("id", updated.room_id).maybeSingle();
    const html = buildBookingEmailHTML({
      name: updated.name,
      bookingRef: updated.booking_ref,
      roomTitle: room?.title || "Room",
      checkInDate: new Date(updated.check_in_date),
      checkOutDate: new Date(updated.check_out_date),
      guests: updated.guests,
      totalPrice: Number(updated.total_price),
      headline: "Booking cancelled",
      message: "Your booking has been successfully cancelled. If you have any questions, please contact us.",
      extraInfo: "We hope to see you at Ashok Inn soon!"
    });
    sendEmail({
      to: updated.email,
      subject: "Booking Cancelled - Ashok Inn",
      html,
      text: `Your booking ${updated.booking_ref} has been cancelled.`
    });
    return res.json({ success: true, booking: adaptBooking(updated) });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Failed to cancel booking" });
  }
};

// server/routes/bookingRoutes.ts
var router3 = Router3();
router3.post("/create-order", requireAuth("user"), createRazorpayOrder);
router3.post("/verify-payment", requireAuth("user"), verifyPaymentAndBook);
router3.post("/manual-booking", requireAuth("user"), createManualBooking);
router3.post("/pay-at-hotel", requireAuth("user"), createPayAtHotelBooking);
router3.get("/my-bookings", requireAuth("user"), getMyBookings);
router3.get("/:id", requireAuth("user"), getBooking);
router3.post("/:id/confirm-payment", requireAuth("user"), confirmPayment);
router3.put("/:id/cancel", requireAuth("user"), cancelBooking);
router3.get("/admin/all", requireAuth("admin"), getAllBookings);
router3.delete("/admin/:id", requireAuth("admin"), deleteBooking);
router3.put("/admin/:id/status", requireAuth("admin"), updateBookingStatus);
router3.put("/admin/:id/verify-manual-payment", requireAuth("admin"), verifyManualUpiPayment);
var bookingRoutes_default = router3;

// server/routes/adminRoutes.ts
import { Router as Router4 } from "express";

// server/lib/dashboardAnalytics.ts
function getDayRange(baseDate = /* @__PURE__ */ new Date()) {
  const start = new Date(baseDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}
function calculateOccupancyRate(inHouseGuests, totalInventory) {
  if (totalInventory <= 0) {
    return 0;
  }
  return Number((inHouseGuests / totalInventory * 100).toFixed(1));
}
function buildDashboardStats(input) {
  const guestCount = Math.max(input.totalUsers - input.adminCount, 0);
  return {
    ...input,
    guestCount,
    occupancyRate: calculateOccupancyRate(input.inHouseGuests, input.totalInventory)
  };
}

// server/controllers/adminController.ts
var getDashboardStats = async (_request, response) => {
  try {
    const { start, end } = getDayRange();
    const getCount = async (fromTable, configureQuery = (q) => q) => {
      const base = supabase.from(fromTable).select("id", { count: "exact", head: true });
      const { count, error } = await configureQuery(base);
      if (error) throw error;
      return count || 0;
    };
    const [
      totalUsers,
      adminCount,
      totalBookings,
      totalRooms,
      revenueData,
      inventoryData,
      pendingPayments,
      manualReviewBookings,
      todayArrivals,
      todayDepartures,
      overdueArrivals,
      inHouseGuests,
      completedStays,
      recentUsersData
    ] = await Promise.all([
      getCount("users"),
      getCount("users", (q) => q.eq("role", "admin")),
      getCount("bookings"),
      getCount("rooms"),
      supabase.from("bookings").select("total_price").eq("payment_status", "paid"),
      supabase.from("rooms").select("available_rooms"),
      getCount(
        "bookings",
        (q) => q.in("payment_status", ["pending", "submitted"]).neq("booking_status", "cancelled").neq("booking_status", "completed")
      ),
      getCount(
        "bookings",
        (q) => q.eq("payment_method", "manual_upi").eq("payment_status", "submitted").neq("booking_status", "cancelled").neq("booking_status", "completed")
      ),
      getCount(
        "bookings",
        (q) => q.eq("booking_status", "confirmed").gte("check_in_date", start.toISOString()).lt("check_in_date", end.toISOString())
      ),
      getCount(
        "bookings",
        (q) => q.eq("booking_status", "checked_in").gte("check_out_date", start.toISOString()).lt("check_out_date", end.toISOString())
      ),
      getCount(
        "bookings",
        (q) => q.eq("booking_status", "confirmed").lt("check_in_date", start.toISOString())
      ),
      getCount("bookings", (q) => q.eq("booking_status", "checked_in")),
      getCount("bookings", (q) => q.eq("booking_status", "completed")),
      supabase.from("users").select("id, name, email, role, created_at").order("created_at", { ascending: false }).limit(5)
    ]);
    if (revenueData.error) throw revenueData.error;
    if (inventoryData.error) throw inventoryData.error;
    if (recentUsersData.error) throw recentUsersData.error;
    const revenue = revenueData.data ? revenueData.data.reduce((sum, item) => sum + Number(item.total_price), 0) : 0;
    const totalInventory = inventoryData.data ? inventoryData.data.reduce((sum, item) => sum + Number(item.available_rooms), 0) : 0;
    const recentUsers = (recentUsersData.data || []).map((user) => ({
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    }));
    const stats = buildDashboardStats({
      totalUsers,
      adminCount,
      totalBookings,
      totalRooms,
      totalInventory,
      revenue,
      pendingPayments,
      manualReviewBookings,
      todayArrivals,
      todayDepartures,
      overdueArrivals,
      inHouseGuests,
      completedStays
    });
    return response.json({
      success: true,
      stats,
      recentUsers
    });
  } catch (error) {
    console.error("Dashboard stats error:", error.message);
    return response.status(500).json({ success: false, error: "Failed to load dashboard stats" });
  }
};
var getAllUsers = async (_request, response) => {
  try {
    const { data: users, error } = await supabase.from("users").select("id, name, email, role, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    const adaptedUsers = (users || []).map((user) => ({
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.created_at
    }));
    return response.json({ success: true, users: adaptedUsers });
  } catch (error) {
    console.error("Admin users error:", error.message);
    return response.status(500).json({ success: false, error: "Failed to fetch users" });
  }
};

// server/routes/adminRoutes.ts
var router4 = Router4();
router4.get("/stats", requireAuth("admin"), getDashboardStats);
router4.get("/users", requireAuth("admin"), getAllUsers);
var adminRoutes_default = router4;

// server/routes/paymentRoutes.ts
import { Router as Router5 } from "express";

// server/controllers/paymentController.ts
import axios from "axios";
import crypto3 from "crypto";
var PHONEPE_BASE_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
var PHONEPE_PAY_PATH = "/pg/v1/pay";
function getMissingPhonePeConfigKeys() {
  const requiredKeys = ["MERCHANT_ID", "SALT_KEY", "SALT_INDEX"];
  return requiredKeys.filter((key) => !process.env[key]?.trim());
}
function getPhonePeConfig() {
  const merchantId = process.env.MERCHANT_ID?.trim();
  const saltKey = process.env.SALT_KEY?.trim();
  const saltIndex = process.env.SALT_INDEX?.trim();
  if (!merchantId || !saltKey || !saltIndex) {
    return null;
  }
  return {
    merchantId,
    saltKey,
    saltIndex
  };
}
function buildChecksum(value, saltKey, saltIndex) {
  const checksum = crypto3.createHash("sha256").update(value + saltKey).digest("hex");
  return `${checksum}###${saltIndex}`;
}
function getServerBaseUrl(request) {
  const forwardedProtoHeader = request.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoHeader) ? forwardedProtoHeader[0] : forwardedProtoHeader;
  const protocol = forwardedProto?.split(",")[0]?.trim() || request.protocol || "http";
  const host = request.get("host");
  return host ? `${protocol}://${host}` : getFrontendUrl();
}
function getPhonePeStatusPath(merchantId, transactionId) {
  return `/pg/v1/status/${encodeURIComponent(merchantId)}/${encodeURIComponent(transactionId)}`;
}
function isValidBookingData(bookingData) {
  if (!bookingData) {
    return false;
  }
  return Boolean(
    bookingData.roomId && bookingData.name && bookingData.email && bookingData.phone && bookingData.checkInDate && bookingData.checkOutDate && Number(bookingData.guests) > 0
  );
}
function getRedirectUrl(paymentResponse) {
  return paymentResponse?.data?.instrumentResponse?.redirectInfo?.url || paymentResponse?.data?.instrumentResponse?.intentUrl || paymentResponse?.data?.redirectInfo?.url || paymentResponse?.data?.intentUrl || "";
}
function getGatewayTransactionId(statusResponse) {
  return statusResponse?.data?.transactionId || statusResponse?.data?.paymentInstrument?.transactionId || statusResponse?.paymentDetails?.[0]?.transactionId || statusResponse?.transactionId || "";
}
function evaluateStatus(statusResponse, expectedAmount, expectedTransactionId) {
  const responseData = statusResponse?.data || statusResponse || {};
  const rawState = String(
    responseData?.state || responseData?.responseCode || statusResponse?.code || statusResponse?.state || ""
  ).toUpperCase();
  const rawCode = String(
    statusResponse?.code || responseData?.responseCode || responseData?.state || ""
  ).toUpperCase();
  const amount = Number(responseData?.amount ?? statusResponse?.amount ?? 0);
  const responseTransactionId = String(
    responseData?.merchantTransactionId || responseData?.transactionId || statusResponse?.merchantTransactionId || ""
  ).trim();
  const isAmountValid = amount > 0 ? amount === expectedAmount : true;
  const isTransactionValid = responseTransactionId ? responseTransactionId === expectedTransactionId : true;
  const successStates = /* @__PURE__ */ new Set(["COMPLETED", "PAYMENT_SUCCESS", "SUCCESS"]);
  const failureStates = /* @__PURE__ */ new Set(["FAILED", "FAILURE", "PAYMENT_ERROR", "BAD_REQUEST", "DECLINED", "EXPIRED", "CANCELLED"]);
  if (!isAmountValid || !isTransactionValid) {
    return "failed";
  }
  const isSuccess = statusResponse?.success === true && (successStates.has(rawState) || successStates.has(rawCode) || rawCode === "SUCCESS");
  const isFailure = statusResponse?.success === false || failureStates.has(rawState) || failureStates.has(rawCode);
  if (isSuccess) {
    return "paid";
  }
  if (isFailure) {
    return "failed";
  }
  return "pending";
}
async function prepareBookingForPayment(request, transactionId, bookingData, bookingId) {
  const userId = request.auth?.userId;
  if (!userId) {
    return { error: "Authentication required", status: 401 };
  }
  if (bookingId) {
    const { data: existingBooking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("id", bookingId).eq("user_id", userId).maybeSingle();
    if (error || !existingBooking) {
      return { error: "Booking not found", status: 404 };
    }
    if (["cancelled", "completed"].includes(existingBooking.booking_status)) {
      return { error: "This booking can no longer be paid online", status: 400 };
    }
    if (existingBooking.payment_status === "paid") {
      return { error: "This booking is already paid", status: 400 };
    }
    const { data: updatedBooking, error: updateError } = await supabase.from("bookings").update({
      transaction_id: transactionId,
      order_id: transactionId,
      payment_id: null,
      signature: null,
      payment_status: "pending",
      booking_status: "pending_payment",
      payment_method: "PhonePe"
    }).eq("id", existingBooking.id).select("*, roomId:rooms(*)").single();
    if (updateError || !updatedBooking) {
      return { error: "Failed to update transaction state on booking", status: 500 };
    }
    return { booking: updatedBooking };
  }
  if (!isValidBookingData(bookingData)) {
    return { error: "Invalid booking details", status: 400 };
  }
  const { data: room, error: roomError } = await supabase.from("rooms").select("*").eq("id", bookingData.roomId).maybeSingle();
  if (roomError || !room) {
    return { error: "Room not found", status: 404 };
  }
  const validatedBooking = await validateBookingInput(room, bookingData);
  await ensureRoomAvailability(
    room.id,
    validatedBooking.checkInDate,
    validatedBooking.checkOutDate,
    room.available_rooms
  );
  const bookingRef = `AIH-${Date.now()}`;
  const { data: booking, error: insertError } = await supabase.from("bookings").insert({
    booking_ref: bookingRef,
    user_id: userId,
    room_id: bookingData.roomId,
    name: validatedBooking.name,
    email: validatedBooking.email,
    phone: validatedBooking.phone,
    check_in_date: validatedBooking.checkInDate.toISOString(),
    check_out_date: validatedBooking.checkOutDate.toISOString(),
    guests: validatedBooking.guests,
    total_price: validatedBooking.totalPrice,
    payment_status: "pending",
    booking_status: "pending_payment",
    payment_method: "PhonePe",
    transaction_id: transactionId,
    order_id: transactionId
  }).select().single();
  if (insertError || !booking) {
    return { error: insertError?.message || "Failed to create booking", status: 500 };
  }
  const { data: populatedBooking } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("id", booking.id).maybeSingle();
  return { booking: populatedBooking || booking };
}
async function fetchPhonePeStatus(transactionId, config) {
  const statusPath = getPhonePeStatusPath(config.merchantId, transactionId);
  const checksum = buildChecksum(statusPath, config.saltKey, config.saltIndex);
  const url = `${PHONEPE_BASE_URL}${statusPath}`;
  const response = await axios.get(url, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": config.merchantId
    }
  });
  return response.data;
}
async function syncPhonePeBooking(transactionId) {
  const config = getPhonePeConfig();
  if (!config) {
    throw new Error(`PhonePe configuration is missing: ${getMissingPhonePeConfigKeys().join(", ")}`);
  }
  const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("transaction_id", transactionId).maybeSingle();
  if (error || !booking) {
    throw new Error("Booking not found");
  }
  const statusResponse = await fetchPhonePeStatus(transactionId, config);
  const paymentStatus = evaluateStatus(statusResponse, Math.round(Number(booking.total_price) * 100), transactionId);
  const updates = {
    payment_method: "PhonePe"
  };
  if (paymentStatus === "paid") {
    updates.payment_status = "paid";
    updates.booking_status = "confirmed";
    updates.payment_id = getGatewayTransactionId(statusResponse) || booking.payment_id;
  } else if (paymentStatus === "failed") {
    updates.payment_status = "failed";
    updates.booking_status = "pending_payment";
  } else {
    updates.payment_status = "pending";
    updates.booking_status = "pending_payment";
  }
  const { data: updatedBooking, error: updateError } = await supabase.from("bookings").update(updates).eq("id", booking.id).select("*, roomId:rooms(*)").single();
  if (updateError || !updatedBooking) {
    throw updateError || new Error("Failed to update payment status");
  }
  return {
    booking: updatedBooking,
    statusResponse,
    paymentStatus
  };
}
async function createPhonePePayment(request, response) {
  let activeBooking = null;
  try {
    const config = getPhonePeConfig();
    if (!config) {
      return response.status(500).json({
        success: false,
        error: `PhonePe configuration is missing: ${getMissingPhonePeConfigKeys().join(", ")}`
      });
    }
    const { bookingData, bookingId } = request.body;
    const transactionId = `TXN${Date.now()}`;
    const preparedBooking = await prepareBookingForPayment(request, transactionId, bookingData, bookingId);
    if ("error" in preparedBooking) {
      return response.status(preparedBooking.status).json({ success: false, error: preparedBooking.error });
    }
    activeBooking = preparedBooking.booking;
    const serverBaseUrl = getServerBaseUrl(request);
    const redirectUrl = `${getFrontendUrl()}/booking-confirmation/${activeBooking.id}?transactionId=${transactionId}`;
    const callbackUrl = `${serverBaseUrl}/api/payment/phonepe/callback/${transactionId}`;
    const payload = {
      merchantId: config.merchantId,
      merchantTransactionId: transactionId,
      merchantUserId: request.auth?.userId,
      amount: Math.round(Number(activeBooking.total_price) * 100),
      redirectUrl,
      redirectMode: "REDIRECT",
      callbackUrl,
      mobileNumber: activeBooking.phone,
      paymentInstrument: {
        type: "UPI_INTENT"
      }
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const checksum = buildChecksum(encodedPayload + PHONEPE_PAY_PATH, config.saltKey, config.saltIndex);
    const paymentResponse = await axios.post(
      `${PHONEPE_BASE_URL}${PHONEPE_PAY_PATH}`,
      { request: encodedPayload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": checksum,
          "X-MERCHANT-ID": config.merchantId
        }
      }
    );
    const phonePeRedirectUrl = getRedirectUrl(paymentResponse.data);
    if (!phonePeRedirectUrl) {
      await supabase.from("bookings").update({ payment_status: "failed" }).eq("id", activeBooking.id);
      return response.status(502).json({
        success: false,
        error: "PhonePe did not return a redirect URL",
        bookingId: activeBooking.id
      });
    }
    return response.json({
      success: true,
      bookingId: activeBooking.id,
      transactionId,
      redirectUrl: phonePeRedirectUrl
    });
  } catch (error) {
    if (activeBooking) {
      await supabase.from("bookings").update({ payment_status: "failed" }).eq("id", activeBooking.id);
    }
    if (error instanceof BookingValidationError) {
      return response.status(error.status).json({
        success: false,
        error: error.message,
        bookingId: activeBooking?.id
      });
    }
    const bookingId = error?.response?.data?.bookingId || activeBooking?.id;
    const errorMessage = error?.response?.data?.message || error?.response?.data?.error || "Failed to initiate PhonePe payment";
    return response.status(500).json({
      success: false,
      error: errorMessage,
      bookingId
    });
  }
}
async function getPaymentConfig(_request, response) {
  const hotelUpiDetails = getHotelUpiDetails();
  const hotelContactDetails = getHotelContactDetails();
  return response.json({
    success: true,
    payment: {
      phonePeEnabled: Boolean(getPhonePeConfig()),
      manualUpiEnabled: Boolean(hotelUpiDetails.upiId),
      payAtHotelEnabled: true,
      ...hotelUpiDetails,
      ...hotelContactDetails
    }
  });
}
async function getPhonePePaymentStatus(request, response) {
  try {
    const transactionId = request.params.transactionId;
    const { data: booking, error } = await supabase.from("bookings").select("*, roomId:rooms(*)").eq("transaction_id", transactionId).maybeSingle();
    if (error || !booking) {
      return response.status(404).json({ success: false, error: "Booking not found" });
    }
    if (booking.user_id !== request.auth?.userId) {
      return response.status(403).json({ success: false, error: "Access denied" });
    }
    const syncedBooking = await syncPhonePeBooking(transactionId);
    return response.json({
      success: true,
      paymentStatus: syncedBooking.paymentStatus,
      booking: adaptBooking(syncedBooking.booking),
      phonePe: syncedBooking.statusResponse
    });
  } catch (error) {
    const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to fetch payment status";
    return response.status(500).json({ success: false, error: message });
  }
}
async function handlePhonePeCallback(request, response) {
  try {
    await syncPhonePeBooking(request.params.transactionId);
  } catch (error) {
    console.error("PhonePe callback sync failed:", error);
  }
  return response.json({ success: true });
}

// server/routes/paymentRoutes.ts
var router5 = Router5();
router5.get("/config", getPaymentConfig);
router5.post("/phonepe", requireAuth("user"), createPhonePePayment);
router5.get("/status/:transactionId", requireAuth("user"), getPhonePePaymentStatus);
router5.post("/phonepe/callback/:transactionId", handlePhonePeCallback);
var paymentRoutes_default = router5;

// server/routes/passwordRoutes.ts
import { Router as Router6 } from "express";
var router6 = Router6();
router6.post("/forgot-password", forgotPassword);
router6.post("/reset-password", resetPassword);
var passwordRoutes_default = router6;

// server/routes/galleryRoutes.ts
import { Router as Router7 } from "express";

// server/controllers/galleryController.ts
var getGallery = async (_req, res) => {
  try {
    const { data: images, error } = await supabase.from("gallery").select("*").order("created_at", { ascending: false });
    if (error) {
      console.error("Supabase gallery fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to load gallery images" });
    }
    return res.json({ success: true, images });
  } catch (error) {
    console.error("Gallery get error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
var addGalleryImage = async (req, res) => {
  try {
    const { url, caption } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "Image URL is required" });
    }
    const { data: image, error } = await supabase.from("gallery").insert([{ url, caption: caption || "" }]).select().single();
    if (error) {
      console.error("Supabase gallery insert error:", error);
      return res.status(500).json({ success: false, error: "Failed to add gallery image" });
    }
    return res.status(201).json({ success: true, image });
  } catch (error) {
    console.error("Gallery add error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};
var deleteGalleryImage = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Image ID is required" });
    }
    const { error } = await supabase.from("gallery").delete().eq("id", id);
    if (error) {
      console.error("Supabase gallery delete error:", error);
      return res.status(500).json({ success: false, error: "Failed to delete gallery image" });
    }
    return res.json({ success: true, message: "Image deleted successfully" });
  } catch (error) {
    console.error("Gallery delete error:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

// server/routes/galleryRoutes.ts
var router7 = Router7();
router7.get("/", getGallery);
router7.post("/", requireAuth("admin"), addGalleryImage);
router7.delete("/:id", requireAuth("admin"), deleteGalleryImage);
var galleryRoutes_default = router7;

// server/middleware/rateLimit.ts
function rateLimit(options) {
  const hits = /* @__PURE__ */ new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = options.keyGenerator ? options.keyGenerator(req) : req.ip;
    const windowMs = options.windowMs;
    let entry = hits.get(key);
    if (!entry || entry.resetTime <= now) {
      entry = { count: 0, resetTime: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    const remaining = Math.max(options.max - entry.count, 0);
    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetTime / 1e3)));
    if (entry.count > options.max) {
      return res.status(429).json({
        success: false,
        error: options.message || "Too many requests. Please try again later."
      });
    }
    if (hits.size > 1e4) {
      for (const [storedKey, storedEntry] of hits.entries()) {
        if (storedEntry.resetTime <= now) {
          hits.delete(storedKey);
        }
      }
    }
    return next();
  };
}

// server/middleware/monitoring.ts
function monitorRequests(options = {}) {
  const slowThresholdMs = options.slowThresholdMs ?? 2e3;
  return (req, res, next) => {
    const startTime = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - startTime;
      if (durationMs >= slowThresholdMs) {
        console.warn(`[slow] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
      }
    });
    next();
  };
}

// server.ts
console.log("Starting server process...");
dotenv3.config();
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var PORT = Number(process.env.PORT) || 3e3;
var IS_PRODUCTION = process.env.NODE_ENV === "production";
var envValidation = validateEnv(IS_PRODUCTION);
if (envValidation.missing.length > 0) {
  throw new Error(`Missing required environment variables: ${envValidation.missing.join(", ")}`);
}
if (envValidation.warnings.length > 0) {
  console.warn(
    `Environment warnings (check values for): ${Array.from(new Set(envValidation.warnings)).join(", ")}`
  );
}
var app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((req, res, next) => {
  const requestId = crypto4.randomUUID();
  const startTime = Date.now();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
});
app.use(monitorRequests({ slowThresholdMs: 2e3 }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()"
  );
  if (IS_PRODUCTION) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }
  next();
});
app.use(cors({
  origin: getAllowedCorsOrigins(),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "1mb" }));
var globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 1e3,
  // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later."
});
app.use(globalLimiter);
app.get("/api/health", async (_req, res) => {
  let supabaseStatus = "unknown";
  try {
    const { error } = await supabase.from("rooms").select("id").limit(1);
    supabaseStatus = error ? "error" : "connected";
  } catch (err) {
    supabaseStatus = "disconnected";
  }
  res.json({
    success: true,
    status: "ok",
    uptime: process.uptime(),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    supabase: supabaseStatus
  });
});
var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 100,
  message: "Too many authentication requests. Please try again later."
});
var paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  max: 60,
  message: "Too many payment requests. Please try again later."
});
var bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1e3,
  max: 120
});
app.use("/api/auth", authLimiter, authRoutes_default);
app.use("/api", authLimiter, passwordRoutes_default);
app.post("/api/search-booking", searchBooking);
app.use("/api/rooms", roomRoutes_default);
app.use("/api/gallery", galleryRoutes_default);
app.use("/api/bookings", bookingLimiter, bookingRoutes_default);
app.use("/api/admin", adminRoutes_default);
app.use("/api/payment", paymentLimiter, paymentRoutes_default);
(async () => {
  console.log("Initializing Supabase database...");
  try {
    const seeded = await ensureDefaultRooms();
    if (seeded) {
      console.log("Inserted default rooms because the PostgreSQL table was empty.");
    }
  } catch (seedError) {
    console.error("Failed to seed default rooms in PostgreSQL:", seedError);
  }
  startServer();
})();
async function startServer() {
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get(/^(?!\/api).*/, (_request, response) => {
      response.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }
  app.use((req, res) => {
    res.status(404).json({ success: false, error: "Not Found" });
  });
  app.use((err, req, res, next) => {
    console.error(err.stack);
    const requestId = req.requestId;
    res.status(500).json({ success: false, error: "Internal Server Error", requestId });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
