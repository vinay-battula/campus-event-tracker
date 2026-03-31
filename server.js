require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

/* ════════════════════════════════
   MIDDLEWARE
════════════════════════════════ */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* ════════════════════════════════
   MULTER — FILE UPLOADS
════════════════════════════════ */
const uploadDir = "./public/uploads";
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname.replace(/\s+/g, "-")),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

/* ════════════════════════════════
   DATABASE POOL
════════════════════════════════ */
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "campus_events",
  waitForConnections: true,
  connectionLimit: 10,
});

/* ════════════════════════════════
   NODEMAILER
════════════════════════════════ */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendEmail(to, subject, html) {
  try {
    await transporter.sendMail({
      from: `"CampusEvents 🎓" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log(`📧 Email sent → ${to}`);
  } catch (err) {
    console.error("Email error:", err.message);
  }
}

/* ════════════════════════════════
   AUTH MIDDLEWARE
════════════════════════════════ */
function authMiddleware(req, res, next) {
  const token =
    req.cookies.token ||
    (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Please login first" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired, please login again" });
  }
}

function adminMiddleware(req, res, next) {
  const token =
    req.cookies.adminToken ||
    (req.headers.authorization || "").replace("Bearer ", "");

  if (!token) return res.status(401).json({ error: "Admin login required" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ error: "Access denied" });
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid admin token" });
  }
}

/* ════════════════════════════════════════════════
   ██████   AUTH ROUTES
════════════════════════════════════════════════ */

/* ── REGISTER ── */
app.post("/api/auth/register", async (req, res) => {
  try {
    const { full_name, email, password, college, department, phone } = req.body;

    if (!full_name || !email || !password || !college)
      return res.status(400).json({ error: "Please fill all required fields" });

    if (password.length < 6)
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });

    const [exist] = await pool.query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (exist.length)
      return res.status(400).json({ error: "Email already registered" });

    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (full_name, email, password, college, department, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, email, hash, college, department || "", phone || ""],
    );

    /* Welcome Email */
    await sendEmail(
      email,
      "🎓 Welcome to CampusEvents!",
      `
      <div style="font-family:Segoe UI,sans-serif;max-width:620px;margin:auto;background:#f4f6ff;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a6e,#6a0dad);padding:40px;text-align:center;color:white;">
          <h1 style="margin:0;font-size:2rem;">🎓 Welcome to CampusEvents!</h1>
          <p style="margin:10px 0 0;opacity:.85;">Your gateway to cross-college events</p>
        </div>
        <div style="padding:36px;background:white;">
          <h2 style="color:#1a1a6e;">Hello, ${full_name}! 👋</h2>
          <p style="color:#555;line-height:1.7;">
            You're officially part of <strong>CampusEvents</strong> — the platform connecting
            students across India for hackathons, workshops, ideathons & more!
          </p>
          <div style="background:#f0f4ff;border-radius:14px;padding:18px;margin:20px 0;">
            <p style="margin:0;color:#333;"><strong>📧 Email:</strong> ${email}</p>
            <p style="margin:8px 0 0;color:#333;"><strong>🏫 College:</strong> ${college}</p>
          </div>
          <ul style="color:#555;line-height:2.2;padding-left:20px;">
            <li>🔍 Discover events from colleges across India</li>
            <li>📝 Register for hackathons, workshops & ideathons</li>
            <li>📤 Upload your own college events</li>
            <li>🏆 Win prizes and grow your network</li>
          </ul>
          <div style="text-align:center;margin-top:28px;">
            <a href="${process.env.FRONTEND_URL}/dashboard.html"
               style="background:linear-gradient(135deg,#6a0dad,#1a1a6e);color:white;padding:14px 36px;
                      border-radius:30px;text-decoration:none;font-weight:700;font-size:1rem;">
              🚀 Explore Events Now
            </a>
          </div>
        </div>
        <div style="background:#f4f6ff;padding:16px;text-align:center;">
          <p style="color:#999;font-size:.82rem;margin:0;">© 2025 CampusEvents · All Rights Reserved</p>
        </div>
      </div>
      `,
    );

    res.json({
      success: true,
      message: "Account created! Check your email 📧",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── LOGIN ── */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND is_active = 1",
      [email],
    );
    if (!rows.length)
      return res.status(400).json({ error: "Invalid email or password" });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.full_name,
        college: user.college,
        role: "user",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // 🔥 IMPORTANT for HTTPS (Render)
      sameSite: "none", // 🔥 IMPORTANT
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    /* Login Alert Email */
    const when = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    await sendEmail(
      email,
      "🔐 Login Alert — CampusEvents",
      `
      <div style="font-family:Segoe UI,sans-serif;max-width:500px;margin:auto;background:#f4f6ff;border-radius:18px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a6e,#6a0dad);padding:28px;text-align:center;color:white;">
          <h2 style="margin:0;">🔐 Login Successful</h2>
        </div>
        <div style="padding:28px;background:white;">
          <p style="color:#333;">Hi <strong>${user.full_name}</strong>,</p>
          <p style="color:#555;">A new login was detected on your CampusEvents account.</p>
          <div style="background:#f8f9fa;border-radius:12px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#444;"><strong>🕐 Time:</strong> ${when}</p>
            <p style="margin:8px 0 0;color:#444;"><strong>📧 Email:</strong> ${email}</p>
          </div>
          <p style="color:#e74c3c;font-size:.88rem;">Not you? Please change your password immediately.</p>
        </div>
      </div>
      `,
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        college: user.college,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── LOGOUT ── */
app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ success: true, message: "Logged out successfully" });
});

/* ── GET ME ── */
app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, full_name, email, college, department, phone, role, created_at FROM users WHERE id = ?",
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json({ user: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════
   ██████   ADMIN AUTH ROUTES
════════════════════════════════════════════════ */

/* ── ADMIN LOGIN ── */
app.post("/api/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query("SELECT * FROM admins WHERE email = ?", [
      email,
    ]);
    if (!rows.length)
      return res.status(400).json({ error: "Invalid admin credentials" });

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match)
      return res.status(400).json({ error: "Invalid admin credentials" });

    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        username: admin.username,
        role: "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 24 * 60 * 60 * 1000,
    });

    const when = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    await sendEmail(
      email,
      "⚠️ Admin Login Alert — CampusEvents",
      `<div style="font-family:Segoe UI,sans-serif;padding:24px;background:#fff8e1;border-radius:14px;">
         <h3 style="color:#856404;">⚠️ Admin Login Detected</h3>
         <p>Admin <strong>${admin.username}</strong> logged in at <strong>${when}</strong></p>
       </div>`,
    );

    res.json({
      success: true,
      token,
      admin: { id: admin.id, username: admin.username, email: admin.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN LOGOUT ── */
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("adminToken");
  res.json({ success: true });
});

/* ════════════════════════════════════════════════
   ██████   EVENTS ROUTES
════════════════════════════════════════════════ */

/* ── GET ALL EVENTS (with search/filter/pagination) ── */
app.get("/api/events", async (req, res) => {
  try {
    const {
      search = "",
      category = "",
      college = "",
      page = 1,
      limit = 9,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = "WHERE e.status = 'approved'";
    const params = [];

    if (search) {
      where += " AND (e.title LIKE ? OR e.college LIKE ? OR e.venue LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category && category !== "all") {
      where += " AND e.category = ?";
      params.push(category);
    }
    if (college) {
      where += " AND e.college LIKE ?";
      params.push(`%${college}%`);
    }

    const [events] = await pool.query(
      `SELECT e.*, u.full_name AS organizer_name,
              (e.total_seats - e.filled_seats) AS available_seats
       FROM events e
       LEFT JOIN users u ON e.organizer_id = u.id
       ${where}
       ORDER BY e.featured DESC, e.event_date ASC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM events e ${where}`,
      params,
    );

    res.json({
      events,
      total,
      pages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── GET SINGLE EVENT ── */
app.get("/api/events/:id", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*, u.full_name AS organizer_name, u.email AS organizer_email
       FROM events e
       LEFT JOIN users u ON e.organizer_id = u.id
       WHERE e.id = ?`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    res.json({ event: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── CREATE EVENT ── */
app.post(
  "/api/events",
  authMiddleware,
  upload.single("poster"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        college,
        venue,
        event_date,
        event_time,
        last_date,
        total_seats,
        prize_pool,
        team_size,
        is_free,
        fee,
        registration_link,
      } = req.body;

      if (
        !title ||
        !category ||
        !college ||
        !venue ||
        !event_date ||
        !event_time
      )
        return res
          .status(400)
          .json({ error: "Please fill all required fields" });

      const poster = req.file ? "/uploads/" + req.file.filename : null;

      const [result] = await pool.query(
        `INSERT INTO events
         (title, description, category, college, venue, event_date, event_time,
          last_date, total_seats, prize_pool, team_size, is_free, fee,
          registration_link, poster, organizer_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          title,
          description || "",
          category,
          college,
          venue,
          event_date,
          event_time,
          last_date || null,
          total_seats || 100,
          prize_pool || "",
          team_size || "1",
          is_free ? 1 : 0,
          fee || 0,
          registration_link || "",
          poster,
          req.user.id,
        ],
      );

      res.json({
        success: true,
        id: result.insertId,
        message: "Event uploaded successfully!",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/* ── UPDATE EVENT (owner or admin) ── */
app.put("/api/events/:id", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM events WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    if (rows[0].organizer_id !== req.user.id)
      return res.status(403).json({ error: "Not authorized" });

    const { title, description, venue, event_date, event_time, total_seats } =
      req.body;
    await pool.query(
      `UPDATE events SET title=?,description=?,venue=?,event_date=?,event_time=?,total_seats=? WHERE id=?`,
      [
        title,
        description,
        venue,
        event_date,
        event_time,
        total_seats,
        req.params.id,
      ],
    );
    res.json({ success: true, message: "Event updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── DELETE EVENT (owner) ── */
app.delete("/api/events/:id", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM events WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows.length) return res.status(404).json({ error: "Event not found" });
    if (rows[0].organizer_id !== req.user.id)
      return res.status(403).json({ error: "Not authorized" });

    await pool.query("DELETE FROM events WHERE id = ?", [req.params.id]);
    res.json({ success: true, message: "Event deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── REGISTER FOR EVENT ── */
app.post("/api/events/:id/register", authMiddleware, async (req, res) => {
  try {
    const { team_name, members } = req.body;
    const eventId = req.params.id;

    const [evRows] = await pool.query(
      "SELECT * FROM events WHERE id = ? AND status = 'approved'",
      [eventId],
    );
    if (!evRows.length)
      return res.status(404).json({ error: "Event not found" });

    const ev = evRows[0];

    if (ev.filled_seats >= ev.total_seats)
      return res.status(400).json({ error: "This event is full!" });

    const [existing] = await pool.query(
      "SELECT id FROM registrations WHERE user_id = ? AND event_id = ?",
      [req.user.id, eventId],
    );
    if (existing.length)
      return res.status(400).json({ error: "You are already registered!" });

    await pool.query(
      "INSERT INTO registrations (user_id, event_id, team_name, members) VALUES (?,?,?,?)",
      [req.user.id, eventId, team_name || "", members || ""],
    );

    await pool.query(
      "UPDATE events SET filled_seats = filled_seats + 1 WHERE id = ?",
      [eventId],
    );

    /* Confirmation Email */
    const [userRows] = await pool.query("SELECT * FROM users WHERE id = ?", [
      req.user.id,
    ]);
    const user = userRows[0];
    const dateStr = new Date(ev.event_date).toDateString();

    await sendEmail(
      user.email,
      `✅ Registration Confirmed — ${ev.title}`,
      `
      <div style="font-family:Segoe UI,sans-serif;max-width:620px;margin:auto;background:#f4f6ff;border-radius:20px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#1a1a6e,#6a0dad);padding:36px;text-align:center;color:white;">
          <h1 style="margin:0;font-size:1.8rem;">✅ You're Registered!</h1>
          <p style="margin:8px 0 0;opacity:.85;">${ev.title}</p>
        </div>
        <div style="padding:32px;background:white;">
          <h3 style="color:#1a1a6e;">Hi ${user.full_name}! 🎉</h3>
          <p style="color:#555;">Congratulations! You are officially registered for <strong>${ev.title}</strong>.</p>
          <div style="background:#f0f4ff;border-radius:14px;padding:20px;margin:20px 0;border-left:4px solid #6a0dad;">
            <p style="margin:0;"><strong>📅 Date:</strong> ${dateStr}</p>
            <p style="margin:8px 0 0;"><strong>⏰ Time:</strong> ${ev.event_time}</p>
            <p style="margin:8px 0 0;"><strong>📍 Venue:</strong> ${ev.venue}</p>
            <p style="margin:8px 0 0;"><strong>🏫 College:</strong> ${ev.college}</p>
            ${ev.prize_pool ? `<p style="margin:8px 0 0;"><strong>🏆 Prize:</strong> ${ev.prize_pool}</p>` : ""}
          </div>
          <p style="color:#e74c3c;font-size:.88rem;">📌 Carry your college ID card on event day.</p>
        </div>
      </div>
      `,
    );

    res.json({
      success: true,
      message: "Registered successfully! Check your email 📧",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── MY REGISTRATIONS ── */
app.get("/api/my-registrations", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, e.title, e.event_date, e.event_time, e.venue, e.college,
              e.category, e.poster, e.prize_pool
       FROM registrations r
       JOIN events e ON r.event_id = e.id
       WHERE r.user_id = ?
       ORDER BY r.registered_at DESC`,
      [req.user.id],
    );
    res.json({ registrations: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── MY UPLOADED EVENTS ── */
app.get("/api/my-events", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.*,
              (SELECT COUNT(*) FROM registrations WHERE event_id = e.id) AS reg_count
       FROM events e
       WHERE e.organizer_id = ?
       ORDER BY e.created_at DESC`,
      [req.user.id],
    );
    res.json({ events: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ════════════════════════════════════════════════
   ██████   ADMIN ROUTES
════════════════════════════════════════════════ */

/* ── ADMIN DASHBOARD STATS ── */
app.get("/api/admin/stats", adminMiddleware, async (req, res) => {
  try {
    const [[{ totalUsers }]] = await pool.query(
      "SELECT COUNT(*) AS totalUsers FROM users",
    );
    const [[{ totalEvents }]] = await pool.query(
      "SELECT COUNT(*) AS totalEvents FROM events",
    );
    const [[{ totalRegs }]] = await pool.query(
      "SELECT COUNT(*) AS totalRegs FROM registrations",
    );
    const [[{ pendingEvents }]] = await pool.query(
      "SELECT COUNT(*) AS pendingEvents FROM events WHERE status='pending'",
    );
    const [[{ activeUsers }]] = await pool.query(
      "SELECT COUNT(*) AS activeUsers FROM users WHERE is_active=1",
    );
    const [[{ todayRegs }]] = await pool.query(
      "SELECT COUNT(*) AS todayRegs FROM registrations WHERE DATE(registered_at) = CURDATE()",
    );

    const [recentUsers] = await pool.query(
      "SELECT id,full_name,email,college,role,is_active,created_at FROM users ORDER BY created_at DESC LIMIT 6",
    );
    const [recentEvents] = await pool.query(
      `SELECT e.*, u.full_name AS organizer_name FROM events e
       LEFT JOIN users u ON e.organizer_id=u.id
       ORDER BY e.created_at DESC LIMIT 6`,
    );
    const [catStats] = await pool.query(
      "SELECT category, COUNT(*) AS cnt FROM events GROUP BY category ORDER BY cnt DESC",
    );
    const [collegeStats] = await pool.query(
      "SELECT college, COUNT(*) AS cnt FROM events GROUP BY college ORDER BY cnt DESC LIMIT 8",
    );
    const [monthlyRegs] = await pool.query(
      `SELECT DATE_FORMAT(registered_at,'%b %Y') AS month, COUNT(*) AS cnt
       FROM registrations GROUP BY month ORDER BY registered_at DESC LIMIT 6`,
    );

    res.json({
      stats: {
        totalUsers,
        totalEvents,
        totalRegs,
        pendingEvents,
        activeUsers,
        todayRegs,
      },
      recentUsers,
      recentEvents,
      catStats,
      collegeStats,
      monthlyRegs,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN ALL USERS ── */
app.get("/api/admin/users", adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 15, search = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "WHERE 1=1";
    const params = [];

    if (search) {
      where += " AND (full_name LIKE ? OR email LIKE ? OR college LIKE ?)";
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [users] = await pool.query(
      `SELECT id, full_name, email, college, role, is_active, created_at
       FROM users ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${where}`,
      params,
    );

    res.json({ users, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN UPDATE USER ── */
app.put("/api/admin/users/:id", adminMiddleware, async (req, res) => {
  try {
    const { is_active, role } = req.body;
    await pool.query("UPDATE users SET is_active=?, role=? WHERE id=?", [
      is_active,
      role,
      req.params.id,
    ]);
    res.json({ success: true, message: "User updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN DELETE USER ── */
app.delete("/api/admin/users/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "User deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN ALL EVENTS ── */
app.get("/api/admin/events", adminMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 15, status = "", search = "" } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = "WHERE 1=1";
    const params = [];

    if (status) {
      where += " AND e.status=?";
      params.push(status);
    }
    if (search) {
      where += " AND (e.title LIKE ? OR e.college LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }

    const [events] = await pool.query(
      `SELECT e.*, u.full_name AS organizer_name,
              (SELECT COUNT(*) FROM registrations r WHERE r.event_id=e.id) AS reg_count
       FROM events e LEFT JOIN users u ON e.organizer_id=u.id
       ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset],
    );

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM events e ${where}`,
      params,
    );

    res.json({ events, total, pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN UPDATE EVENT ── */
app.put("/api/admin/events/:id", adminMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      venue,
      event_date,
      event_time,
      total_seats,
      status,
      featured,
    } = req.body;
    await pool.query(
      `UPDATE events SET title=?,description=?,venue=?,event_date=?,event_time=?,
       total_seats=?,status=?,featured=? WHERE id=?`,
      [
        title,
        description,
        venue,
        event_date,
        event_time,
        total_seats,
        status,
        featured ? 1 : 0,
        req.params.id,
      ],
    );
    res.json({ success: true, message: "Event updated!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN DELETE EVENT ── */
app.delete("/api/admin/events/:id", adminMiddleware, async (req, res) => {
  try {
    await pool.query("DELETE FROM events WHERE id=?", [req.params.id]);
    res.json({ success: true, message: "Event deleted!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── ADMIN — REGISTRATIONS FOR EVENT ── */
app.get(
  "/api/admin/events/:id/registrations",
  adminMiddleware,
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT r.*, u.full_name, u.email, u.college
       FROM registrations r
       JOIN users u ON r.user_id = u.id
       WHERE r.event_id = ?
       ORDER BY r.registered_at DESC`,
        [req.params.id],
      );
      res.json({ registrations: rows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/* ── 404 FALLBACK ── */
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "index.html"));
});

/* ════════════════════════════════
   START SERVER
════════════════════════════════ */
app.listen(PORT, () => {
  console.log(`\n🚀 Server  →  http://localhost:${PORT}`);
  console.log(`🛡️  Admin   →  http://localhost:${PORT}/admin.html`);
  console.log(`🎓 Student →  http://localhost:${PORT}/login.html\n`);
});
