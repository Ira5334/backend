require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Підключення до бази даних
const db = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
connectionLimit: 10,
  connectTimeout: 20000,
});

// ====== МАРШРУТИ ======

// Отримати всі номери
app.get("/rooms", (req, res) => {
  db.query("SELECT * FROM Rooms", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Перевірити доступність
app.post("/check-availability", (req, res) => {
  const { check_in_date, check_out_date } = req.body;

  if (!check_in_date || !check_out_date) {
    return res.status(400).json({ error: "Необхідно вказати дати заїзду та виїзду." });
  }

  const query = `
    SELECT * FROM Rooms
    WHERE room_id NOT IN (
      SELECT room_id FROM Reservations
      WHERE NOT (check_out_date <= ? OR check_in_date >= ?)
    )
  `;

  db.query(query, [check_in_date, check_out_date], (err, results) => {
    if (err) return res.status(500).json({ error: "Помилка при перевірці доступності." });
    res.status(200).json(results);
  });
});

// Створити бронювання
app.post("/api/book", (req, res) => {
  const {
    room_type,
    price,
    name,
    email,
    check_in,
    check_out,
    total_price
  } = req.body;

  if (!room_type || !name || !email || !check_in || !check_out) {
    return res.status(400).json({ success: false, error: "Будь ласка, заповніть всі обов'язкові поля." });
  }

  const query = `
    INSERT INTO Reservations (room_type, price, name, email, check_in_date, check_out_date, total_price)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    query,
    [room_type, price, name, email, check_in, check_out, total_price],
    (err, result) => {
      if (err) {
        console.error("Помилка при бронюванні:", err);
        return res.status(500).json({ success: false, error: "Помилка під час збереження бронювання." });
      }

      res.status(200).json({ success: true, id: result.insertId });
    }
  );
});

// Запуск сервера
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Сервер працює на порту ${PORT}`);
});
