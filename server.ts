import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./server/routes/authRoutes";
import roomRoutes from "./server/routes/roomRoutes";
import bookingRoutes from "./server/routes/bookingRoutes";
import adminRoutes from "./server/routes/adminRoutes";
import paymentRoutes from "./server/routes/paymentRoutes";
import passwordRoutes from "./server/routes/passwordRoutes";
import { ensureDefaultRooms } from "./server/lib/ensureDefaultRooms";
import { getAllowedCorsOrigins, validateEnv } from "./server/lib/runtimeConfig";
import { rateLimit } from "./server/middleware/rateLimit";
import { monitorRequests } from "./server/middleware/monitoring";
import { searchBooking } from "./server/controllers/bookingController";
import { supabase } from "./server/lib/supabaseClient";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const envValidation = validateEnv(IS_PRODUCTION);
if (envValidation.missing.length > 0) {
  console.error(
    `Missing required environment variables: ${envValidation.missing.join(", ")}`,
  );
  process.exit(1);
}
if (envValidation.warnings.length > 0) {
  console.warn(
    `Environment warnings (check values for): ${Array.from(new Set(envValidation.warnings)).join(", ")}`,
  );
}

// Supabase project configurations verified in validateEnv

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  (req as { requestId?: string }).requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });

  next();
});

app.use(monitorRequests({ slowThresholdMs: 2000 }));

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "geolocation=(), microphone=(), camera=()",
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
    timestamp: new Date().toISOString(),
    supabase: supabaseStatus,
  });
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many authentication requests. Please try again later.",
});
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: "Too many payment requests. Please try again later.",
});
const bookingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 120,
});

import galleryRoutes from "./server/routes/galleryRoutes";

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", authLimiter, passwordRoutes);
app.post("/api/search-booking", searchBooking);
app.use("/api/rooms", roomRoutes);
app.use("/api/gallery", galleryRoutes);
app.use("/api/bookings", bookingLimiter, bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/payment", paymentLimiter, paymentRoutes);

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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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

  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    const requestId = (req as { requestId?: string }).requestId;
    res.status(500).json({ success: false, error: "Internal Server Error", requestId });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
