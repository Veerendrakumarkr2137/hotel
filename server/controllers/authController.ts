import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../lib/supabaseClient";
import { getFrontendUrl, getJwtSecret } from "../lib/runtimeConfig";
import { normalizeEmail } from "../lib/userEmail";
import { UserRecord } from "../types/database";

const JWT_SECRET = getJwtSecret();
const PASSWORD_RESET_TTL_MINUTES = 30;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

const emailUser = process.env.EMAIL_USER || "";
const emailPass = process.env.EMAIL_PASS || "";
const emailConfigured = Boolean(emailUser && emailPass);

const emailTransporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: emailUser,
    pass: emailPass,
  },
});

if (emailConfigured) {
  emailTransporter.verify((error) => {
    if (error) {
      console.error("Auth email transporter verification failed:", error);
    }
  });
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sendPasswordResetEmail(email: string, resetUrl: string) {
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
    text: `Reset your password using this link: ${resetUrl}`,
  }, (error) => {
    if (error) {
      console.error("Failed to send reset email:", error);
    }
  });
}

async function findUserByEmailAndPassword(email: string, password: string): Promise<UserRecord | null> {
  const normalizedEmail = normalizeEmail(email);
  
  const { data: candidates, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .order("created_at", { ascending: false });

  if (error || !candidates || candidates.length === 0) {
    return null;
  }

  for (const candidate of candidates) {
    const isMatch = await bcrypt.compare(password, candidate.password);
    if (isMatch) {
      return candidate as UserRecord;
    }
  }

  return null;
}

function issueUserToken(user: UserRecord) {
  return jwt.sign(
    { role: "user", userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function issueAdminToken(username: string) {
  return jwt.sign(
    { role: "admin", username },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

export const registerUser = async (req: Request, res: Response): Promise<any> => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: "Please fill all fields" });
    }

    const normalizedName = String(name).trim();
    const normalizedEmail = normalizeEmail(String(email));

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: user, error } = await supabase
      .from("users")
      .insert({ name: normalizedName, email: normalizedEmail, password: hashedPassword })
      .select()
      .single();

    if (error || !user) {
      throw new Error(error?.message || "Failed to create user record");
    }

    return res.status(201).json({
      success: true,
      message: "Registered successfully",
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error("Registration error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Server error during registration" });
  }
};

export const loginUser = async (req: Request, res: Response): Promise<any> => {
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
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error("Login error:", error.message);
    return res.status(500).json({ success: false, error: error.message || "Server error during login" });
  }
};

export const loginAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (username === adminUsername && password === adminPassword) {
      return res.json({
        success: true,
        token: issueAdminToken(adminUsername),
      });
    }

    return res.status(401).json({ success: false, error: "Invalid credentials" });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Server error" });
  }
};

export const loginWithGoogle = async (req: Request, res: Response): Promise<any> => {
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
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload?.email ? normalizeEmail(payload.email) : "";

    if (!email) {
      return res.status(400).json({ success: false, error: "Unable to read Google account email" });
    }

    let { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      const displayName = payload?.name?.trim() || "Guest";
      
      const { data: newUser, error } = await supabase
        .from("users")
        .insert({ name: displayName, email, password: hashedPassword })
        .select()
        .single();

      if (error || !newUser) {
        throw new Error(error?.message || "Failed to create Google user");
      }
      user = newUser;
    }

    return res.json({
      success: true,
      token: issueUserToken(user as UserRecord),
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error("Google login error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Google login failed" });
  }
};

export const forgotPassword = async (req: Request, res: Response): Promise<any> => {
  try {
    const rawEmail = String(req.body?.email || "").trim();
    if (!rawEmail) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(rawEmail);
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (user) {
      const resetToken = crypto.randomBytes(32).toString("hex");
      const resetTokenHash = hashResetToken(resetToken);
      const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

      const { error } = await supabase
        .from("users")
        .update({
          password_reset_token_hash: resetTokenHash,
          password_reset_expires_at: expiresAt.toISOString(),
        })
        .eq("id", user.id);

      if (error) throw error;

      const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
      sendPasswordResetEmail(user.email, resetUrl);

      if (process.env.NODE_ENV !== "production") {
        return res.json({
          success: true,
          message: "Password reset link generated.",
          resetUrl,
        });
      }
    }

    return res.json({
      success: true,
      message: "If an account exists for that email, a reset link has been sent.",
    });
  } catch (error: any) {
    console.error("Forgot password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Unable to process your request right now." });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<any> => {
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
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("password_reset_token_hash", resetTokenHash)
      .gt("password_reset_expires_at", new Date().toISOString())
      .maybeSingle();

    if (!user) {
      return res.status(400).json({ success: false, error: "This reset link is invalid or has expired." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const { error } = await supabase
      .from("users")
      .update({
        password: hashedPassword,
        password_reset_token_hash: null,
        password_reset_expires_at: null,
      })
      .eq("id", user.id);

    if (error) throw error;

    return res.json({ success: true, message: "Password reset successful." });
  } catch (error: any) {
    console.error("Reset password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Unable to reset password right now." });
  }
};

export const getCurrentUser = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("id", userId)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: "user" },
    });
  } catch (error: any) {
    console.error("Get profile error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to load profile" });
  }
};

export const updateProfile = async (req: any, res: Response): Promise<any> => {
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

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalizedEmail)
      .neq("id", userId)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ success: false, error: "Email is already in use" });
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ name: normalizedName, email: normalizedEmail })
      .eq("id", userId)
      .select("id, name, email")
      .single();

    if (updateError || !updatedUser) {
      throw updateError || new Error("Failed to update profile");
    }

    return res.json({
      success: true,
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: "user" },
    });
  } catch (error: any) {
    console.error("Update profile error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
};

export const changePassword = async (req: any, res: Response): Promise<any> => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Invalid session" });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "Please provide both passwords" });
    }

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: "Current password is incorrect" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const { error } = await supabase
      .from("users")
      .update({ password: hashedPassword })
      .eq("id", userId);

    if (error) throw error;

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error: any) {
    console.error("Change password error:", error?.message || error);
    return res.status(500).json({ success: false, error: "Failed to change password" });
  }
};
