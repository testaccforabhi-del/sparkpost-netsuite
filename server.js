const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(cors());

// ============== NETSUITE SUITELET URL ==============
const SUITELET_URL = "https://7355544-sb1.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2621&deploy=1&compid=7355544_SB1&ns-at=AAEJ7tMQkG7P9KlfzZ14ed8tNPEpMDVtWVT3rk3qRYRiBctMv1k";

// ============== HOME ==============
app.get("/", (req, res) => {
  res.status(200).json({
    status: "Running",
    message: "SparkPost to NetSuite Proxy Active",
    timestamp: new Date().toISOString(),
    webhookURL: "POST /webhook"
  });
});

// ============== MAIN WEBHOOK ==============
app.post("/webhook", async (req, res) => {
  try {
    console.log("📨 [" + new Date().toISOString() + "] SparkPost webhook received");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    // NetSuite ko forward karo
    const netsuitResponse = await axios.post(SUITELET_URL, req.body, {
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SparkPost-Webhook-Proxy/1.0"
      },
      timeout: 30000
    });

    console.log("[" + new Date().toISOString() + "] NetSuite response received");
    console.log("Status:", netsuitResponse.status);

    res.status(200).json({
      success: true,
      message: "Webhook successfully forwarded to NetSuite",
      netsuitStatus: netsuitResponse.status
    });

  } catch (error) {
    console.error("❌ [" + new Date().toISOString() + "] Error occurred");
    console.error("Error message:", error.message);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ============== TEST ENDPOINT ==============
app.post("/test", (req, res) => {
  res.json({
    message: "Test successful",
    received: req.body,
    timestamp: new Date().toISOString()
  });
});

// ============== 404 ==============
app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    availableRoutes: ["GET /", "POST /webhook", "POST /test"]
  });
});

// ============== START SERVER ==============
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`App URL: https://YOUR-APP-NAME.onrender.com`);
});
