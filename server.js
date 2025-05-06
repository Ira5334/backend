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
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  connectionLimit: 10,
  connectTimeout: 20000,
});

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

  const query = `
    SELECT DISTINCT room_type FROM Rooms
    WHERE room_id NOT IN (
      SELECT room_id FROM Reservations
      WHERE NOT (
        check_out_date <= ? OR check_in_date >= ?
      )
    );
  `;

  db.query(query, [check_in_date, check_out_date], (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Помилка сервера" });
    }

    if (results.length === 0) {
      return res.json({ message: "На жаль, немає доступних номерів у вибраний період." });
    }

    res.json(results);
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

  const today = new Date().toISOString().split("T")[0];

  if (check_in < today || check_out <= check_in) {
    return res.status(400).json({ success: false, error: "Некоректні дати: не можна забронювати на минулі дні або зробити виїзд раніше за заїзд." });
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

// === Блок особистого кабінету користувача ===

// Авторизація користувача
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Будь ласка, введіть email та пароль." });
  }

  const query = "SELECT * FROM Customer WHERE email = ? AND password = ?";

  db.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Помилка авторизації:", err);
      return res.status(500).json({ success: false, message: "Помилка сервера." });
    }

    if (results.length === 0) {
      return res.status(401).json({ success: false, message: "Невірний email або пароль." });
    }

    const user = results[0];
    res.status(200).json({ success: true, message: "Успішний вхід", userEmail: user.email });
  });
});

// Отримати дані користувача
app.get("/api/user/email/:email", (req, res) => {
  const email = req.params.email;

  const query = `
    SELECT first_name, last_name, email, phone_number
    FROM Customer
    WHERE email = ?
  `;

  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Помилка при отриманні даних користувача" });
    if (results.length === 0) return res.status(404).json({ error: "Користувача не знайдено" });
    res.json(results[0]);
  });
});

// Оновлення даних користувача 
app.put("/api/user/email/:email", (req, res) => {
  const email = req.params.email;
  const { first_name, last_name, phone_number } = req.body;

  const query = `
    UPDATE Customer 
    SET first_name = ?, last_name = ?, phone_number = ?
    WHERE email = ?
  `;
  db.query(query, [first_name, last_name, phone_number, email], (err, results) => {
    if (err) return res.status(500).json({ error: "Помилка оновлення" });
    res.json({ message: "Успішно оновлено" });
  });
});


// Історія бронювань користувача
app.get("/api/reservations/email/:email", (req, res) => {
  const email = req.params.email;

  const query = `
    SELECT room_type, check_in_date, check_out_date, status
    FROM Reservations
    WHERE email = ?
  `;

  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ error: "Помилка при отриманні бронювань" });
    res.json(results);
  });
});

// Зберегти відгук користувача
app.post("/api/review", (req, res) => {
  const { email, review } = req.body;

  if (!email || !review) {
    return res.status(400).json({ success: false, message: "Email та відгук є обов’язковими." });
  }

  const query = `
    UPDATE Customer
    SET review = ?
    WHERE email = ?
  `;

  db.query(query, [review, email], (err, result) => {
    if (err) {
      console.error("Помилка при збереженні відгуку:", err);
      return res.status(500).json({ success: false, message: "Помилка сервера." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Користувача з таким email не знайдено." });
    }

    res.json({ success: true, message: "Ваш відгук успішно записаний." });
  });
});

// Запуск сервера
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Сервер працює на порту ${PORT}`);
});
