const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 8085;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]");

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const readJSON = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJSON = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
// ---------------- REGISTER ----------------
app.post("/register", upload.single("profilePic"), (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "All fields required" });

  const users = readJSON(USERS_FILE);
  if (users.find((u) => u.email === email))
    return res.status(400).json({ message: "User already exists" });

  const profilePic = req.file ? `/uploads/${req.file.filename}` : null;
  const newUser = {
    id: Date.now().toString(),
    username,
    email,
    password,
    profilePic,
  };
  users.push(newUser);
  writeJSON(USERS_FILE, users);

  res.json({ message: "Registered successfully", user: newUser });
});

// ---------------- LOGIN ----------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  const users = readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  res.json({ message: "Login successful", user });
});

// ---------------- USERS ----------------
app.get("/users", (req, res) => {
  res.json(readJSON(USERS_FILE));
});

// ---------------- MESSAGES ----------------
app.get("/messages/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;
  const msgs = readJSON(MESSAGES_FILE).filter(
    (m) =>
      (m.sender === user1 && m.receiver === user2) ||
      (m.sender === user2 && m.receiver === user1)
  );
  res.json(msgs);
});

// ---------------- SEND MESSAGE ----------------
app.post("/send", upload.single("file"), (req, res) => {
  const { sender, receiver, text } = req.body;
  const file = req.file ? `/uploads/${req.file.filename}` : null;
  const all = readJSON(MESSAGES_FILE);
  const msg = {
    id: Date.now().toString(),
    sender,
    receiver,
    text,
    file,
    time: new Date().toLocaleTimeString(),
  };
  all.push(msg);
  writeJSON(MESSAGES_FILE, all);

  io.emit("newMessage", msg); // notify all clients in real time
  res.json({ message: "Message sent", msg });
});

// ---------------- SOCKET.IO ----------------
io.on("connection", (socket) => {
  console.log("⚡ User connected");
  socket.on("disconnect", () => console.log("❌ User disconnected"));
});

// ---------------- START SERVER ----------------
server.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
