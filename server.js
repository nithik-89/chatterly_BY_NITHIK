const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const app = express();
const PORT = 8085;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const USERS_FILE = path.join(__dirname, "users.json");
const MESSAGES_FILE = path.join(__dirname, "messages.json");

// Ensure files exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, "[]");

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "public", "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// Helper functions
const readJSON = (file) => JSON.parse(fs.readFileSync(file, "utf-8"));
const writeJSON = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));

// Register
app.post("/register", upload.single("profilePic"), (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "Missing fields" });

  let users = readJSON(USERS_FILE);
  if (users.find((u) => u.email === email))
    return res.status(400).json({ message: "User already exists" });

  const profilePic = req.file ? `/uploads/${req.file.filename}` : null;
  const newUser = { id: Date.now(), username, email, password, profilePic };
  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.json({ message: "Registered successfully", user: newUser });
});

// Login
app.post("/login", (req, res) => {
  const { email, password } = req.body;
  let users = readJSON(USERS_FILE);
  const user = users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ message: "Invalid credentials" });
  res.json({ message: "Login success", user });
});

// Get all users
app.get("/users", (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users);
});

// Get messages between users
app.get("/messages/:user1/:user2", (req, res) => {
  const { user1, user2 } = req.params;
  const all = readJSON(MESSAGES_FILE);
  const msgs = all.filter(
    (m) =>
      (m.sender === user1 && m.receiver === user2) ||
      (m.sender === user2 && m.receiver === user1)
  );
  res.json(msgs);
});

// Send message
app.post("/send", upload.single("file"), (req, res) => {
  const { sender, receiver, text } = req.body;
  const file = req.file ? `/uploads/${req.file.filename}` : null;
  const all = readJSON(MESSAGES_FILE);
  const newMsg = {
    id: Date.now(),
    sender,
    receiver,
    text,
    file,
    time: new Date().toLocaleTimeString(),
  };
  all.push(newMsg);
  writeJSON(MESSAGES_FILE, all);
  res.json({ message: "Sent", msg: newMsg });
});

app.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
