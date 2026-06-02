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
    console.log("[" + new Date().toISOString() + "] SparkPost webhook received");
    console.log("Body:", JSON.stringify(req.body, null, 2));

    const messages = req.body;
    const results  = [];

    for (const message of messages) {
      const relay   = message.msys.relay_message;
      const content = relay.content;

      // 1. Get raw MIME email
      let rawEmail    = content.email_rfc822;
      let subject     = content.subject;
      let bodyText    = content.text;
      let bodyHtml    = content.html;
      let attachments = [];

      console.log("email_rfc822 exists:", !!rawEmail);
      console.log("email_rfc822_is_base64:", content.email_rfc822_is_base64);

      // 2. Parse MIME if available (needed for attachments)
      if (rawEmail) {
        if (content.email_rfc822_is_base64) {
          rawEmail = Buffer.from(rawEmail, 'base64').toString('utf8');
        }

        const { simpleParser } = require('mailparser');
        const parsed = await simpleParser(rawEmail);

        subject     = parsed.subject  || subject;
        bodyText    = parsed.text     || bodyText;
        bodyHtml    = parsed.html     || bodyHtml;
        attachments = (parsed.attachments || []).map(att => ({
          name:     att.filename,
          mimeType: att.contentType,
          data:     att.content.toString('base64')
        }));

        console.log("Attachments found:", attachments.length);
        attachments.forEach(a => console.log(" -", a.name, a.mimeType));

      } else {
        console.log("No email_rfc822 — skipping MIME parse, no attachments");
      }

      // 3. Extract Quote ID from rcpt_to
      const rcptTo  = relay.rcpt_to; // quote+12345@reply.muppuris.com
      const quoteId = rcptTo.split('+')[1]?.split('@')[0];

      // 4. Build structured payload for NetSuite
      const netsuitePayload = {
        quoteId,
        subject,
        bodyText,
        bodyHtml,
        fromEmail:   relay.friendly_from,
        rcptTo:      relay.rcpt_to,
        attachments
      };

      console.log("Sending to NetSuite:", JSON.stringify({
        quoteId,
        subject,
        fromEmail:       relay.friendly_from,
        attachmentCount: attachments.length
      }));

      // 5. POST to NetSuite Suitelet
      const netsuiteResponse = await axios.post(SUITELET_URL, netsuitePayload, {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":   "Mozilla/5.0"
        },
        timeout: 30000
      });

      console.log("NetSuite response:", netsuiteResponse.status, netsuiteResponse.data);
      results.push({ quoteId, status: 'sent', attachments: attachments.length });
    }

    res.status(200).json({ success: true, results });

  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(500).json({ error: err.message });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
