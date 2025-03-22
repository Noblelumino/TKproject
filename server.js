require("dotenv").config();
const path = require("path");
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
  device: String, // ✅ Storing device model
  timestamp: { type: Date, default: Date.now },
});

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
        const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
        console.log("Detected IP:", ip);

        const location = geoip.lookup(ip);
        console.log("Location Data (Client IP):", location);

        const testLocation = geoip.lookup("8.8.8.8"); 
        console.log("Location Data (Google 8.8.8.8):", testLocation);

        const userAgentString = req.headers["user-agent"] || "";
        const agent = useragent.parse(userAgentString);

                // ✅ Extract device model more accurately
        let deviceModel = "Unknown Device";

        if (/Windows|Mac OS|Linux/i.test(userAgentString)) {
            deviceModel = "Desktop";
        } else if (/Android/i.test(userAgentString)) {
            const match = userAgentString.match(/Android\s+([\d.]+);\s+([^;]+)/);
            deviceModel = match ? match[2].trim() : "Android Device";
        } else if (/iPhone|iPad|iPod/i.test(userAgentString)) {
            const match = userAgentString.match(/\((iPhone|iPad|iPod).*?;\s([^)]+)\)/);
            deviceModel = match ? match[1] + " " + match[2].trim() : "iOS Device";
        }

            
 

        console.log("Extracted Device Model:", deviceModel); // ✅ Log extracted device model

        const visit = new Visit({
            ip,
            location: location || {},
            browser: agent.family,
            os: agent.os.toString(),
            device: deviceModel,
        });

        await visit.save();
        res.json({ message: "Tracking data saved successfully." });
    } catch (error) {
        console.error("Error tracking visit:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// 📌 Retrieve Logs (Admin)
app.get("/logs", async (req, res) => {
    try {
        console.log("Received headers:", req.headers);
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
