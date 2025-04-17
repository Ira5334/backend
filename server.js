const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Пул з'єднань для стабільної роботи
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Проста логіка для запитів 
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
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

  const query = `
    SELECT * FROM Rooms
    WHERE room_id NOT IN (
      SELECT room_id FROM Reservations
      WHERE NOT (check_out_date <= ? OR check_in_date >= ?)
    );
  `;

  db.query(query, [check_in_date, check_out_date], (err, results) => {
    if (err) {
      console.error("Помилка SQL-запиту:", err);
      return res.status(500).json({ error: "Помилка при перевірці доступності номерів." });
    }

    if (results.length === 0) {
      return res.status(200).json({ message: "Немає доступних номерів на ці дати." });
    }

    res.status(200).json(results);
  });
});

//  Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Сервер працює на порту ${PORT}`);
});
