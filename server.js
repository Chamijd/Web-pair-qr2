const express = require("express");
const path = require("path");
const app = express();
const PORT = 2435;

// In-memory user store
const users = [];

app.use(express.static(path.join(__dirname, "storage")));
app.use(express.json());

// Register
app.post("/register", (req, res) => {
  const { email, username, password } = req.body;

  const exists = users.find(user => user.email === email);
  if (exists) {
    return res.status(400).send("Email already registered!");
  }

  users.push({ email, username, password });
  console.log("Registered users:", users);
  res.send("Registration successful");
});

// Login
app.post("/login", (req, res) => {
  const { identifier, password } = req.body;

  const user = users.find(u =>
    (u.email === identifier || u.username === identifier) && u.password === password
  );

  if (user) {
    res.send("Login successful");
  } else {
    res.status(401).send("Invalid credentials!");
  }
});

// Fallback
app.use((req, res) => {
  res.status(404).send("404 Not Found");
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
