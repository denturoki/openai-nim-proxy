const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const API_KEY = process.env.NIM_API_KEY;
const BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: DEFAULT_MODEL
  });
});

// List available model
app.get("/v1/models", (req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: DEFAULT_MODEL,
        object: "model",
        owned_by: "nvidia"
      }
    ]
  });
});

// Chat completions
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const {
      messages,
      temperature = 0.7,
      max_tokens = 1024,
      stream = false
    } = req.body;

    const response = await axios.post(
      `${BASE_URL}/chat/completions`,
      {
        model: DEFAULT_MODEL,
        messages,
        temperature,
        max_tokens,
        stream
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json"
        },
        responseType: stream ? "stream" : "json"
      }
    );
    // Handle streaming responses
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      response.data.on("data", (chunk) => {
        res.write(chunk);
      });

      response.data.on("end", () => {
        res.end();
      });

      response.data.on("error", (err) => {
        console.error("Stream error:", err);
        res.end();
      });

      return;
    }

    // Non-streaming response
    res.json(response.data);
  } catch (err) {
    console.error(
      "NVIDIA ERROR:",
      err.response?.status,
      err.response?.data || err.message
    );

    res.status(err.response?.status || 500).json({
      error: {
        message:
          err.response?.data?.error?.message ||
          err.message ||
          "Unknown error",
        type: "proxy_error",
        code: err.response?.status || 500
      }
    });
  }
});

// Catch-all route
app.all("*", (req, res) => {
  res.status(404).json({
    error: {
      message: `Endpoint ${req.path} not found`,
      type: "invalid_request_error",
      code: 404
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 NVIDIA NIM Proxy running on port ${PORT}`);
  console.log(`📦 Default model: ${DEFAULT_MODEL}`);
  console.log(`🔗 Base URL: ${BASE_URL}`);
});
