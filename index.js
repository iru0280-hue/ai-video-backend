const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ─────────────────────────────────────────────
// ENV VARIABLES (set these in Railway dashboard)
// ─────────────────────────────────────────────
// OPENAI_API_KEY       - OpenAI / script generation
// RUNWAY_API_KEY       - Video generation (RunwayML, Pika, etc.)
// ELEVENLABS_API_KEY   - Audio / voiceover
// YOUTUBE_CLIENT_ID    - YouTube OAuth
// YOUTUBE_CLIENT_SECRET
// TELEGRAM_BOT_TOKEN   - Optional notifications

// ─────────────────────────────────────────────
// HEALTH CHECK
// ─────────────────────────────────────────────
app.get("/health", (req, res) => {
    res.json({
        status: "ok",
        service: "YT Auto Publisher",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || "production",
    });
});

// ─────────────────────────────────────────────
// POST /create-video
// Body: { prompt, title, description, tags[], privacy, scheduled_at? }
// ─────────────────────────────────────────────
app.post("/create-video", async (req, res) => {
    const { prompt, title, description = "", tags = [], privacy = "private", scheduled_at = null } = req.body;

    if (!prompt || !title) {
        return res.status(400).json({ error: "prompt and title are required." });
    }

    try {
        // ── STEP 1: Generate script via OpenAI ──────────────────
        const scriptResponse = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a YouTube Shorts scriptwriter. Write a punchy, engaging 60-second script based on the given prompt. Format: hook, body, CTA.",
                    },
                    { role: "user", content: `Title: ${title}\nPrompt: ${prompt}` },
                ],
                max_tokens: 600,
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const script = scriptResponse.data.choices[0].message.content.trim();

        // ── STEP 2: Queue job (placeholder — plug in your DB here) ──
        const job = {
            id: `job_${Date.now()}`,
            title,
            description,
            tags,
            privacy,
            scheduled_at,
            script,
            status: "queued",
            created_at: new Date().toISOString(),
        };

        // TODO: Persist `job` to your database (Postgres, MongoDB, Supabase, etc.)
        // Example: await db.collection("jobs").insertOne(job);

        console.log(`[CREATE-VIDEO] Job created: ${job.id} — "${title}"`);

        return res.status(202).json({
            message: "Video job queued successfully.",
            job_id: job.id,
            status: job.status,
        });
    } catch (err) {
        console.error("[CREATE-VIDEO] Error:", err?.response?.data || err.message);

        const statusCode = err?.response?.status || 500;
        const detail =
            err?.response?.data?.error?.message ||
            err.message ||
            "Internal server error";

        return res.status(statusCode).json({ error: detail });
    }
});

// ─────────────────────────────────────────────
// GET /jobs  (stub — wire to your DB)
// ─────────────────────────────────────────────
app.get("/jobs", async (req, res) => {
    // TODO: Fetch jobs from your DB filtered by req.query.status
    res.json({ jobs: [], message: "Connect your database to list jobs." });
});

// ─────────────────────────────────────────────
// POST /jobs/:id/retry  (stub)
// ─────────────────────────────────────────────
app.post("/jobs/:id/retry", async (req, res) => {
    const { id } = req.params;
    console.log(`[RETRY] Retrying job: ${id}`);
    // TODO: Fetch job, reset status to "queued", trigger pipeline
    res.json({ message: `Job ${id} queued for retry.` });
});

// ─────────────────────────────────────────────
// 404 catch-all
// ─────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: "Route not found." });
});

// ─────────────────────────────────────────────
// Global error handler
// ─────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("[UNHANDLED]", err.message);
    res.status(500).json({ error: "Internal server error." });
});

// ─────────────────────────────────────────────
// START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`✅ YT Auto Publisher backend running on port ${PORT}`);
});
