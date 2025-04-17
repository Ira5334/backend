const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect(err => {
  if (err) {
    console.error("Помилка підключення до бази:", err);
  } else {
    console.log("Підключено до бази даних");
  }
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

  // SQL запит для перевірки доступності номерів
const query = 
  SELECT * FROM Rooms
  WHERE room_id NOT IN (
    SELECT room_id FROM Reservations
    WHERE NOT (check_out_date <= ? OR check_in_date >= ?)
  );
;

  // Перевірка доступності номерів
  db.query(query, [check_in_date, check_out_date], (err, results) => {
    if (err) {
      console.error("Помилка запиту:", err);
      return res.status(500).json({ error: "Помилка при перевірці доступності номерів." });
    }

    // Якщо немає доступних номерів
    if (results.length === 0) {
      return res.status(200).json({ message: "Немає доступних номерів на ці дати." });
    }

    // Повертаємо доступні номери
    res.status(200).json(results);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(Сервер працює на порту ${PORT});
});
