import express from "express";

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});

// Echo test endpoint
app.post("/echo", (req, res) => {
    res.json(req.body);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});