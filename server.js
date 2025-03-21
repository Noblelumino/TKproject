require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const useragent = require("useragent");
const geoip = require("geoip-lite");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

const VisitSchema = new mongoose.Schema({
  ip: String,
  location: Object,
  browser: String,
  os: String,
  timestamp: { type: Date, default: Date.now },
});

const Visit = mongoose.model("Visit", VisitSchema);

// Track visitors
app.get("/track", async (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const location = geoip.lookup(ip);
  const agent = useragent.parse(req.headers["user-agent"] || "");

  const visit = new Visit({
    ip,
    location,
    browser: agent.family,
    os: agent.os.toString(),
  });

  await visit.save();
  res.send("Tracked!");
});

// View logs (only for you)
app.get("/logs", async (req, res) => {
  if (req.query.key !== process.env.ADMIN_KEY) {
    return res.status(403).send("Forbidden");
  }
  const visits = await Visit.find().sort({ timestamp: -1 });
  res.json(visits);
});

app.listen(5000, () => console.log("Server running on port 5000"));
