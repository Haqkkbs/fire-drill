import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let fcmReady = false;
try {
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) 
    : null;
    
  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    fcmReady = true;
    console.log("Firebase Admin Initialized for FCM");
  } else {
    console.warn("FIREBASE_SERVICE_ACCOUNT not found. Push notifications will be disabled.");
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Send Push Notification via FCM
  app.post("/api/notify-push", async (req, res) => {
    const { alarmActive, tokens } = req.body;

    if (!alarmActive) {
      return res.json({ success: true, message: "Alarm disabled." });
    }

    if (!fcmReady) {
      return res.status(503).json({ 
        success: false, 
        message: "Push Notification Server not configured. Please add FIREBASE_SERVICE_ACCOUNT to Secrets." 
      });
    }

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ success: false, message: "No target device tokens provided." });
    }

    const message = {
      notification: {
        title: "🚨 FIRE DRILL ACTIVE",
        body: "A fire drill has been triggered! Please evacuate to the Assembly Point immediately and mark yourself as SAFE."
      },
      android: {
        priority: "high",
        notification: {
          channelId: "fire_drill_channel",
          priority: "max",
          clickAction: "FLUTTER_NOTIFICATION_CLICK"
        }
      },
      tokens: tokens
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message as any);
      console.log(`FCM Broadcast: ${response.successCount} successful, ${response.failureCount} failed.`);
      res.json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });
    } catch (error) {
      console.error("Error sending FCM notification:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to send push notifications" 
      });
    }
  });

  // API Route: Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
