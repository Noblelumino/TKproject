require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const useragent = require("useragent");
const cors = require("cors");
const UAParser = require("ua-parser-js");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

const VisitSchema = new mongoose.Schema({
  ip: {
    type: String,
    required: true,
  },
  location: {
    country: {
      type: String,
      default: "Unknown",
    },
    region: {
      type: String,
      default: "Unknown",
    },
    city: {
      type: String,
      default: "Unknown",
    },
  },
  browser: {
    type: String,
    default: "Unknown",
  },
  os: {
    type: String,
    default: "Unknown",
  },
  device: {
    type: String, // ✅ Stores device model/type
    default: "Unknown Device",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// (Optional) Add index for time-based querying
VisitSchema.index({ timestamp: -1 });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.set("trust proxy", true);

const Visit = mongoose.model("Visit", VisitSchema);

// ✅ Default Route
app.get("/", (req, res) => {
  res.render("index");
});

// ✅ Admin Page Route
app.get("/admin", (req, res) => {
  res.render("admin");
});

// 📌 Track visitors
app.get("/track", async (req, res) => {
  try {
    // Step 1: Get real or fallback IP
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const ip =
      rawIp.includes("::1") || rawIp === "127.0.0.1" ? "8.8.8.8" : rawIp;
    console.log("Detected IP:", rawIp);

    // Step 2: Use ipapi.co for accurate geolocation
    let location;
    try {
      const locationRes = await axios.get(`https://ipapi.co/${ip}/json`);
      location = {
        country: locationRes.data.country_name || "Unknown",
        region: locationRes.data.region || "Unknown",
        city: locationRes.data.city || "Unknown",
      };
    } catch (err) {
      console.error("Geo lookup failed:", err.message);
      location = { country: "Unknown", region: "Unknown", city: "Unknown" };
    }

    // Step 3: Parse user agent
    const userAgentString = req.headers["user-agent"] || "";
    const agent = useragent.parse(userAgentString);
    const parser = new UAParser(userAgentString);

    // Step 4: Extract device details
    const browser =
      `${parser.getBrowser().name} ${parser.getBrowser().version}` ||
      agent.family;
    const os =
      `${parser.getOS().name} ${parser.getOS().version}` || agent.os.toString();

    const device = parser.getDevice();
    const deviceType = device.type || "Desktop";

    let deviceName = "Unknown Device";
    if (deviceType === "mobile" || deviceType === "tablet") {
      deviceName = `${device.vendor || "Mobile"} ${device.model || ""}`.trim();
    } else {
      const ua = parser.getUA();
      if (ua.includes("Macintosh")) deviceName = "Mac";
      else if (ua.includes("Windows")) deviceName = "Windows PC";
      else if (ua.includes("Linux")) deviceName = "Linux PC";
      else deviceName = "Desktop";
    }

    // Step 5: Save to DB
    const visit = new Visit({
      ip: rawIp, // Original IP
      location,
      browser,
      os,
      device: deviceName,
    });

    await visit.save();

    res.json({ message: "Tracking data saved successfully.", visit });
  } catch (error) {
    console.error("Error tracking visit:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 📌 Retrieve Logs (Admin)
app.get("/logs", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"];

    if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
      console.log("Unauthorized attempt with key:", adminKey);
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const visits = await Visit.find().sort({ timestamp: -1 });
    res.json(visits);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
