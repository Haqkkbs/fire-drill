import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Send Telegram Notification
  app.post("/api/notify-telegram", async (req, res) => {
    const { alarmActive, appUrl } = req.body;

    if (!alarmActive) {
      return res.json({ success: true, message: "Alarm disabled, no notification sent." });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatIds = [
      process.env.TELEGRAM_CHAT_ID,   // Generic version
      process.env.TELEGRAM_CHAT_ID_1,
      process.env.TELEGRAM_CHAT_ID_2
    ].filter(id => !!id);

    if (!token) {
      console.error("Telegram Token Missing");
      return res.status(500).json({ success: false, message: "TELEGRAM_BOT_TOKEN is missing in Secrets." });
    }

    if (chatIds.length === 0) {
      console.error("Telegram Chat ID Missing");
      return res.status(500).json({ success: false, message: "TELEGRAM_CHAT_ID is missing in Secrets." });
    }

    const message = `🚨 *EMERGENCY: FIRE DRILL CHECK-IN* 🚨\n\nAttention ALL students and staff! A fire drill has been triggered.\n\nPlease evacuate immediately to the Assembly Point and mark yourself as SAFE here:\n\n🔗 ${appUrl}\n\nStay calm and follow instructions.`;

    try {
      const results = await Promise.all(chatIds.map(async (chatId) => {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: "Markdown"
          })
        });
        
        const data = await response.json();
        if (!data.ok) {
          throw new Error(`Telegram Error (ID: ${chatId}): ${data.description || 'Unknown error'}`);
        }
        return data;
      }));

      console.log("Telegram API success:", results);
      res.json({ success: true, results });
    } catch (error) {
      console.error("Error sending Telegram notification:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Failed to notify Telegram" 
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
