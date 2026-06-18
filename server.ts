import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Initialize SQLite
  const db = new Database('./database.sqlite');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT,
      phone TEXT,
      age INTEGER,
      hasBoard TEXT,
      parentsName TEXT,
      birthDate TEXT,
      enrollmentDate TEXT
    );

    CREATE TABLE IF NOT EXISTS instructors (
      id TEXT PRIMARY KEY,
      name TEXT,
      specialty TEXT,
      phone TEXT,
      email TEXT
    );

    CREATE TABLE IF NOT EXISTS packages (
      id TEXT PRIMARY KEY,
      name TEXT,
      price REAL,
      totalClasses INTEGER,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS student_packages (
      id TEXT PRIMARY KEY,
      studentId TEXT,
      packageId TEXT,
      packageName TEXT,
      amountPaid REAL,
      totalPrice REAL,
      classesUsed INTEGER,
      totalClasses INTEGER,
      paymentDueDate TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      date TEXT,
      studentId TEXT,
      instructorId TEXT,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      studentPackageId TEXT,
      amount REAL,
      date TEXT,
      method TEXT,
      notes TEXT
    );
  `);

  // Seed default admin if not exists
  const adminEmail = 'admin@pacificsurf.com';
  const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('PacificSurf2026!', 10);
    db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(adminEmail, hashedPassword, 'Super Admin');
  }

  // API Routes
  
  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (user && await bcrypt.compare(password, user.password)) {
      res.json({ id: user.id, email: user.email, name: user.name });
    } else {
      res.status(401).json({ error: 'Credenciales inválidas' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    const { email, password, name } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name || 'Usuario');
      res.json({ id: result.lastInsertRowid, email, name: name || 'Usuario' });
    } catch (error: any) {
      res.status(400).json({ error: 'El correo ya está en uso' });
    }
  });

  // Students
  app.get('/api/students', async (req, res) => {
    const students = db.prepare('SELECT * FROM students').all();
    res.json(students);
  });

  app.post('/api/students', async (req, res) => {
    const s = req.body;
    const id = s.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO students (id, name, email, phone, age, hasBoard, parentsName, birthDate, enrollmentDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, s.name, s.email, s.phone, s.age, s.hasBoard, s.parentsName, s.birthDate, s.enrollmentDate);
    res.json({ id, ...s });
  });

  app.put('/api/students/:id', async (req, res) => {
    const { id } = req.params;
    const s = req.body;
    db.prepare(
      'UPDATE students SET name = ?, email = ?, phone = ?, age = ?, hasBoard = ?, parentsName = ?, birthDate = ? WHERE id = ?'
    ).run(s.name, s.email, s.phone, s.age, s.hasBoard, s.parentsName, s.birthDate, id);
    res.json({ id, ...s });
  });

  // Instructors
  app.get('/api/instructors', async (req, res) => {
    const instructors = db.prepare('SELECT * FROM instructors').all();
    res.json(instructors);
  });

  app.post('/api/instructors', async (req, res) => {
    const i = req.body;
    const id = i.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO instructors (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)'
    ).run(id, i.name, i.specialty, i.phone, i.email);
    res.json({ id, ...i });
  });

  // Packages
  app.get('/api/packages', async (req, res) => {
    const packages = db.prepare('SELECT * FROM packages').all();
    res.json(packages);
  });

  app.post('/api/packages', async (req, res) => {
    const p = req.body;
    const id = p.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO packages (id, name, price, totalClasses, description) VALUES (?, ?, ?, ?, ?)'
    ).run(id, p.name, p.price, p.totalClasses, p.description);
    res.json({ id, ...p });
  });

  app.put('/api/packages/:id', async (req, res) => {
    const { id } = req.params;
    const p = req.body;
    db.prepare(
      'UPDATE packages SET name = ?, price = ?, totalClasses = ?, description = ? WHERE id = ?'
    ).run(p.name, p.price, p.totalClasses, p.description, id);
    res.json({ id, ...p });
  });

  // Student Packages
  app.get('/api/student-packages', async (req, res) => {
    const sp = db.prepare('SELECT * FROM student_packages').all();
    res.json(sp);
  });

  app.post('/api/student-packages', async (req, res) => {
    const sp = req.body;
    const id = sp.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO student_packages (id, studentId, packageId, packageName, amountPaid, totalPrice, classesUsed, totalClasses, paymentDueDate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sp.studentId, sp.packageId, sp.packageName, sp.amountPaid, sp.totalPrice, sp.classesUsed, sp.totalClasses, sp.paymentDueDate, sp.status);
    res.json({ id, ...sp });
  });

  app.put('/api/student-packages/:id', async (req, res) => {
    const { id } = req.params;
    const sp = req.body;
    const keys = Object.keys(sp);
    const values = Object.values(sp);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE student_packages SET ${setClause} WHERE id = ?`).run([...values, id]);
    res.json({ id, ...sp });
  });

  // Classes
  app.get('/api/classes', async (req, res) => {
    const classes = db.prepare('SELECT * FROM classes').all();
    res.json(classes);
  });

  app.post('/api/classes', async (req, res) => {
    const c = req.body;
    const id = c.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO classes (id, date, studentId, instructorId, status) VALUES (?, ?, ?, ?, ?)'
    ).run(id, c.date, c.studentId, c.instructorId, c.status);
    res.json({ id, ...c });
  });

  app.put('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    const c = req.body;
    const keys = Object.keys(c);
    const values = Object.values(c);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    db.prepare(`UPDATE classes SET ${setClause} WHERE id = ?`).run([...values, id]);
    res.json({ id, ...c });
  });

  app.put('/api/instructors/:id', async (req, res) => {
    const { id } = req.params;
    const i = req.body;
    db.prepare(
      'UPDATE instructors SET name = ?, phone = ?, email = ? WHERE id = ?'
    ).run(i.name, i.phone, i.email, id);
    res.json({ id, ...i });
  });

  app.delete('/api/students/:id', (req, res) => {
    db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/instructors/:id', (req, res) => {
    db.prepare('DELETE FROM instructors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/packages/:id', (req, res) => {
    db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/student-packages/:id', (req, res) => {
    db.prepare('DELETE FROM student_packages WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/classes/:id', (req, res) => {
    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Payments
  app.get('/api/payments', (req, res) => {
    const payments = db.prepare('SELECT * FROM payments').all();
    res.json(payments);
  });

  app.post('/api/payments', (req, res) => {
    const p = req.body;
    const id = p.id || Math.random().toString(36).substr(2, 9);
    db.prepare(
      'INSERT INTO payments (id, studentPackageId, amount, date, method, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, p.studentPackageId, p.amount, p.date, p.method, p.notes);
    res.json({ id, ...p });
  });

  app.delete('/api/payments/:id', (req, res) => {
    db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Overwrite Sync Database state at once
  app.post('/api/sync/overwrite', (req, res) => {
    const { students = [], instructors = [], packages = [], studentPackages = [], classes = [], payments = [] } = req.body;
    
    const runTx = db.transaction(() => {
      // Clear tables
      db.prepare('DELETE FROM students').run();
      db.prepare('DELETE FROM instructors').run();
      db.prepare('DELETE FROM packages').run();
      db.prepare('DELETE FROM student_packages').run();
      db.prepare('DELETE FROM classes').run();
      db.prepare('DELETE FROM payments').run();

      // Insert students
      const insertStudent = db.prepare('INSERT INTO students (id, name, email, phone, age, hasBoard, parentsName, birthDate, enrollmentDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const s of students) {
        insertStudent.run(s.id, s.name, s.email || '', s.phone || '', s.age ?? 0, s.hasBoard || 'No', s.parentsName || '', s.birthDate || '', s.enrollmentDate || '');
      }

      // Insert instructors
      const insertInstructor = db.prepare('INSERT INTO instructors (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)');
      for (const i of instructors) {
        insertInstructor.run(i.id, i.name, i.specialty || '', i.phone || '', i.email || '');
      }

      // Insert packages
      const insertPackage = db.prepare('INSERT INTO packages (id, name, price, totalClasses, description) VALUES (?, ?, ?, ?, ?)');
      for (const p of packages) {
        insertPackage.run(p.id, p.name, p.price, p.totalClasses, p.description || '');
      }

      // Insert student packages
      const insertStudentPackage = db.prepare('INSERT INTO student_packages (id, studentId, packageId, packageName, amountPaid, totalPrice, classesUsed, totalClasses, paymentDueDate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const sp of studentPackages) {
        insertStudentPackage.run(sp.id, sp.studentId, sp.packageId, sp.packageName || '', sp.amountPaid ?? 0, sp.totalPrice ?? 0, sp.classesUsed ?? 0, sp.totalClasses ?? 0, sp.paymentDueDate || '', sp.status || 'active');
      }

      // Insert classes
      const insertClass = db.prepare('INSERT INTO classes (id, date, studentId, instructorId, status) VALUES (?, ?, ?, ?, ?)');
      for (const c of classes) {
        insertClass.run(c.id, c.date, c.studentId, c.instructorId, c.status || 'scheduled');
      }

      // Insert payments
      const insertPayment = db.prepare('INSERT INTO payments (id, studentPackageId, amount, date, method, notes) VALUES (?, ?, ?, ?, ?, ?)');
      for (const p of payments) {
        insertPayment.run(p.id, p.studentPackageId, p.amount ?? 0, p.date || '', p.method || 'Efectivo', p.notes || '');
      }
    });

    try {
      runTx();
      res.json({ success: true, message: 'La base de datos local ha sido sincronizada con Google Sheets con éxito.' });
    } catch (err: any) {
      console.error('Error overwriting database in sync:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
