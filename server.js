require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Підключення до бази даних
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Отримання всіх номерів
app.get("/rooms", (req, res) => {
  db.query("SELECT * FROM Rooms", (err, results) => {
    if (err) return res.status(500).json({ error: err });
    res.json(results);
  });
});

// Перевірка доступності номерів
app.post("/check-availability", (req, res) => {
  const { check_in_date, check_out_date } = req.body;

  if (!check_in_date || !check_out_date) {
    return res.status(400).json({ error: "Необхідно вказати дати заїзду та виїзду." });
  }

  // SQL-запит для перевірки доступних номерів
  const query = `
    SELECT * FROM Rooms
    WHERE room_id NOT IN (
      SELECT room_id FROM Reservations
      WHERE NOT (check_out_date <= ? OR check_in_date >= ?)
    )
  `;

  db.query(query, [check_in_date, check_out_date], (err, results) => {
    if (err) {
      console.error("Помилка запиту:", err);
      return res.status(500).json({ error: "Помилка при перевірці доступності номерів." });
    }

    if (results.length === 0) {
      return res.status(200).json({ message: "Немає доступних номерів на ці дати." });
    }

    res.status(200).json(results);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер працює на порту ${PORT}`);
});
