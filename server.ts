import express from 'express';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

let Database: any = null;

// Safeguards process-wide against unhandled rejections & crashes
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 [Proceso] Rechazo de promesa no manejado en:', promise, 'razón:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔥 [Proceso] Excepción no atrapada en servidor:', err);
});

const camelKeys: Record<string, string> = {
  hasboard: 'hasBoard',
  parentsname: 'parentsName',
  birthdate: 'birthDate',
  enrollmentdate: 'enrollmentDate',
  totalclasses: 'totalClasses',
  studentid: 'studentId',
  packageid: 'packageId',
  packagename: 'packageName',
  amountpaid: 'amountPaid',
  totalprice: 'totalPrice',
  classesused: 'classesUsed',
  paymentduedate: 'paymentDueDate',
  instructorid: 'instructorId',
  studentpackageid: 'studentPackageId'
};

function normalizeRow(row: any) {
  if (!row) return row;
  const normalized: any = {};
  for (const [key, val] of Object.entries(row)) {
    const camel = camelKeys[key.toLowerCase()] || key;
    normalized[camel] = val;
  }
  return normalized;
}

function quoteKeyIfNeeded(key: string) {
  const lower = key.toLowerCase();
  const camelcaseList = [
    'hasboard', 'parentsname', 'birthdate', 'enrollmentdate', 'totalclasses', 
    'studentid', 'packageid', 'packagename', 'amountpaid', 'totalprice', 
    'classesused', 'paymentduedate', 'instructorid', 'studentpackageid'
  ];
  if (key !== lower || camelcaseList.includes(lower)) {
    return `"${key}"`;
  }
  return key;
}

class DatabaseService {
  isPostgres: boolean = false;
  pgPool: pg.Pool | null = null;
  sqliteDb: any = null;

  async init(DATABASE_URL: string | undefined, dbPath: string) {
    if (DATABASE_URL) {
      try {
        console.log('🔌 Conectando a PostgreSQL de Railway...');
        this.pgPool = new pg.Pool({
          connectionString: DATABASE_URL,
          ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
          connectionTimeoutMillis: 3500 // 3.5 seconds connection timeout
        });
        
        // Evitar que errores de conexión inesperados en el pool tiren el servidor Express
        this.pgPool.on('error', (err) => {
          console.error('⚠️ [PostgreSQL Pool Error]:', err);
        });
        
        // Test connection with a promise race to prevent any stalling
        const queryPromise = this.pgPool.query('SELECT NOW()');
        
        // Evitar que si expira el timeout, el fallo tardío de la consulta de red quede no atrapado y tire Node
        queryPromise.catch((err) => {
          console.log('🛰️ [PostgreSQL Lazy Init Check]: Consulta de verificación de canal completada o abortada:', err.message || err);
        });
        
        const connectTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('El intento de conexión a PostgreSQL superó el límite de 3.5 segundos')), 3500)
        );
        
        await Promise.race([
          queryPromise,
          connectTimeout
        ]);

        this.isPostgres = true;
        console.log('✅ Conexión exitosa a PostgreSQL Railway.');
        
        // Ensure tables exist in Postgres
        await this.initPostgresTables();
        return;
      } catch (err) {
        console.error('❌ Error al conectar a PostgreSQL, se usará SQLite local:', err);
        if (this.pgPool) {
          try {
            await this.pgPool.end();
          } catch (e) {
            // ignore
          }
          this.pgPool = null;
        }
      }
    }

    console.log(`🔌 Inicializando base de datos SQLite en: ${dbPath}`);
    try {
      if (!Database) {
        if (typeof require !== 'undefined') {
          Database = require('better-sqlite3');
        } else {
          const metaUrl = typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : '';
          if (metaUrl) {
            const requireModule = createRequire(metaUrl);
            Database = requireModule('better-sqlite3');
          } else {
            throw new Error('Entorno de ejecución no soporta require ni import.meta.url');
          }
        }
      }
      this.sqliteDb = new Database(dbPath);
      this.isPostgres = false;
    } catch (sqliteErr: any) {
      console.error('❌ Error crítico al cargar la base de datos local SQLite (better-sqlite3):', sqliteErr.message || sqliteErr);
      throw sqliteErr;
    }
  }

  async initPostgresTables() {
    if (!this.pgPool) return;
    await this.pgPool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
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
        "hasBoard" TEXT,
        "parentsName" TEXT,
        "birthDate" TEXT,
        "enrollmentDate" TEXT
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
        price DOUBLE PRECISION,
        "totalClasses" INTEGER,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS student_packages (
        id TEXT PRIMARY KEY,
        "studentId" TEXT,
        "packageId" TEXT,
        "packageName" TEXT,
        "amountPaid" DOUBLE PRECISION,
        "totalPrice" DOUBLE PRECISION,
        "classesUsed" INTEGER,
        "totalClasses" INTEGER,
        "paymentDueDate" TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        date TEXT,
        "studentId" TEXT,
        "instructorId" TEXT,
        status TEXT
      );

      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        "studentPackageId" TEXT,
        amount DOUBLE PRECISION,
        date TEXT,
        method TEXT,
        notes TEXT
      );

      -- Safe schema migration for pre-existing tables to prevent missing column errors
      ALTER TABLE students ADD COLUMN IF NOT EXISTS "hasBoard" TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS "parentsName" TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS "birthDate" TEXT;
      ALTER TABLE students ADD COLUMN IF NOT EXISTS "enrollmentDate" TEXT;

      ALTER TABLE packages ADD COLUMN IF NOT EXISTS "totalClasses" INTEGER;

      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "studentId" TEXT;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "packageId" TEXT;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "packageName" TEXT;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "amountPaid" DOUBLE PRECISION;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "totalPrice" DOUBLE PRECISION;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "classesUsed" INTEGER;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "totalClasses" INTEGER;
      ALTER TABLE student_packages ADD COLUMN IF NOT EXISTS "paymentDueDate" TEXT;

      ALTER TABLE classes ADD COLUMN IF NOT EXISTS "studentId" TEXT;
      ALTER TABLE classes ADD COLUMN IF NOT EXISTS "instructorId" TEXT;

      ALTER TABLE payments ADD COLUMN IF NOT EXISTS "studentPackageId" TEXT;
    `);
  }

  // Unified query helper
  async query(sql: string, params: any[] = []): Promise<any> {
    const flatParams = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
    
    if (this.isPostgres && this.pgPool) {
      // Convert SQLite ? to Postgres $1, $2...
      let index = 1;
      const pgSql = sql.replace(/\?/g, () => `$${index++}`);
      const res = await this.pgPool.query(pgSql, flatParams);
      return {
        rows: res.rows.map(normalizeRow),
        lastInsertId: res.rows[0] ? (res.rows[0].id || null) : null
      };
    } else {
      // SQLite execution
      const stmt = this.sqliteDb.prepare(sql);
      const isSelect = sql.trim().toUpperCase().startsWith('SELECT');
      if (isSelect) {
        const rows = stmt.all(...flatParams);
        return { rows, lastInsertId: null };
      } else {
        const info = stmt.run(...flatParams);
        return { rows: [], lastInsertId: info.lastInsertRowid };
      }
    }
  }

  prepare(sql: string) {
    const self = this;
    return {
      async get(...params: any[]) {
        const res = await self.query(sql, params);
        return res.rows[0] || null;
      },
      async all(...params: any[]) {
        const res = await self.query(sql, params);
        return res.rows;
      },
      async run(...params: any[]) {
        const res = await self.query(sql, params);
        return { lastInsertRowid: res.lastInsertId };
      }
    };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Get database path with auto-detection for mounted persistent volume directories (e.g., /data)
  let dbPath = process.env.DATABASE_PATH;
  if (!dbPath) {
    const commonVolumeDirs = ['/data', '/app/data', '/mnt/volume'];
    for (const dir of commonVolumeDirs) {
      if (fs.existsSync(dir)) {
        try {
          fs.accessSync(dir, fs.constants.W_OK);
          dbPath = path.join(dir, 'database.sqlite');
          console.log(`[Auto-detect] Found active writeable volume at: ${dbPath}`);
          break;
        } catch (e) {
          // not writeable
        }
      }
    }
    if (!dbPath) {
      dbPath = './database.sqlite';
    }
  }
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize DB instance (PG as primary if available, otherwise SQLite)
  const db = new DatabaseService();
  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:pXfkQjTmZvUrInqCBiwTFaPWCoisssQX@thomas.proxy.rlwy.net:38659/railway';
  try {
    await db.init(dbUrl, dbPath);
  } catch (dbErr: any) {
    console.error('⚠️ Error crítico al inicializar la base de datos. El servidor iniciará de todos modos en modo degradado para evitar caídas del contenedor:', dbErr.stack || dbErr);
    db.isPostgres = false;
    db.sqliteDb = {
      prepare: (sql: string) => {
        console.error(`🚨 Consulta SQL en base de datos deshabilitada: ${sql}`);
        return {
          run: () => ({ lastInsertRowid: null }),
          all: () => [],
          get: () => null
        };
      },
      exec: (sql: string) => {
        console.error(`🚨 Script SQL en base de datos deshabilitada: ${sql}`);
      },
      transaction: (fn: Function) => {
        return () => {
          console.error(`🚨 Transacción en base de datos deshabilitada.`);
          try {
            fn();
          } catch (err) {
            console.error('Error ejecutando callback de transacción ficticia:', err);
          }
        };
      }
    };
  }

  // If using local SQLite, make sure tables exist
  if (!db.isPostgres) {
    db.sqliteDb.exec(`
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
  }

  // Seed default admin if not exists
  const adminEmail = 'admin@pacificsurf.com';
  const existingAdmin = await db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('PacificSurf2026!', 10);
    await db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(adminEmail, hashedPassword, 'Super Admin');
  }

  // API Routes
  
  // Auth
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
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
      const result = await db.prepare('INSERT INTO users (email, password, name) VALUES (?, ?, ?)').run(email, hashedPassword, name || 'Usuario');
      res.json({ id: result.lastInsertRowid, email, name: name || 'Usuario' });
    } catch (error: any) {
      res.status(400).json({ error: 'El correo ya está en uso' });
    }
  });

  // Students
  app.get('/api/students', async (req, res) => {
    const students = await db.prepare('SELECT * FROM students').all();
    res.json(students);
  });

  app.post('/api/students', async (req, res) => {
    const s = req.body;
    if (!s.name || !s.name.trim()) {
      return res.status(400).json({ error: 'El nombre del alumno es obligatorio' });
    }
    const nameTrimmed = s.name.trim();
    const existing = await db.prepare('SELECT * FROM students WHERE LOWER(TRIM(name)) = LOWER(?)').get(nameTrimmed) as any;
    if (existing) {
      return res.json({ id: existing.id, name: existing.name, email: existing.email, phone: existing.phone, age: existing.age, hasBoard: existing.hasBoard, parentsName: existing.parentsName, birthDate: existing.birthDate, enrollmentDate: existing.enrollmentDate, duplicate: true });
    }
    const id = s.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO students (id, name, email, phone, age, "hasBoard", "parentsName", "birthDate", "enrollmentDate") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, nameTrimmed, s.email, s.phone, s.age, s.hasBoard, s.parentsName, s.birthDate, s.enrollmentDate);
    res.json({ id, ...s });
  });

  app.put('/api/students/:id', async (req, res) => {
    const { id } = req.params;
    const s = req.body;
    await db.prepare(
      'UPDATE students SET name = ?, email = ?, phone = ?, age = ?, "hasBoard" = ?, "parentsName" = ?, "birthDate" = ? WHERE id = ?'
    ).run(s.name, s.email, s.phone, s.age, s.hasBoard, s.parentsName, s.birthDate, id);
    res.json({ id, ...s });
  });

  // Instructors
  app.get('/api/instructors', async (req, res) => {
    const instructors = await db.prepare('SELECT * FROM instructors').all();
    res.json(instructors);
  });

  app.post('/api/instructors', async (req, res) => {
    const i = req.body;
    const id = i.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO instructors (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)'
    ).run(id, i.name, i.specialty, i.phone, i.email);
    res.json({ id, ...i });
  });

  // Packages
  app.get('/api/packages', async (req, res) => {
    const packages = await db.prepare('SELECT * FROM packages').all();
    res.json(packages);
  });

  app.post('/api/packages', async (req, res) => {
    const p = req.body;
    const id = p.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO packages (id, name, price, "totalClasses", description) VALUES (?, ?, ?, ?, ?)'
    ).run(id, p.name, p.price, p.totalClasses, p.description);
    res.json({ id, ...p });
  });

  app.put('/api/packages/:id', async (req, res) => {
    const { id } = req.params;
    const p = req.body;
    await db.prepare(
      'UPDATE packages SET name = ?, price = ?, "totalClasses" = ?, description = ? WHERE id = ?'
    ).run(p.name, p.price, p.totalClasses, p.description, id);
    res.json({ id, ...p });
  });

  // Student Packages
  app.get('/api/student-packages', async (req, res) => {
    const sp = await db.prepare('SELECT * FROM student_packages').all();
    res.json(sp);
  });

  app.post('/api/student-packages', async (req, res) => {
    const sp = req.body;
    const id = sp.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO student_packages (id, "studentId", "packageId", "packageName", "amountPaid", "totalPrice", "classesUsed", "totalClasses", "paymentDueDate", status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, sp.studentId, sp.packageId, sp.packageName, sp.amountPaid, sp.totalPrice, sp.classesUsed, sp.totalClasses, sp.paymentDueDate, sp.status);
    res.json({ id, ...sp });
  });

  app.put('/api/student-packages/:id', async (req, res) => {
    const { id } = req.params;
    const sp = req.body;
    const keys = Object.keys(sp);
    const values = Object.values(sp);
    const setClause = keys.map(k => `${quoteKeyIfNeeded(k)} = ?`).join(', ');
    await db.prepare(`UPDATE student_packages SET ${setClause} WHERE id = ?`).run([...values, id]);
    res.json({ id, ...sp });
  });

  // Classes
  app.get('/api/classes', async (req, res) => {
    const classes = await db.prepare('SELECT * FROM classes').all();
    res.json(classes);
  });

  app.post('/api/classes', async (req, res) => {
    const c = req.body;
    const id = c.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO classes (id, date, "studentId", "instructorId", status) VALUES (?, ?, ?, ?, ?)'
    ).run(id, c.date, c.studentId, c.instructorId, c.status);
    res.json({ id, ...c });
  });

  app.put('/api/classes/:id', async (req, res) => {
    const { id } = req.params;
    const c = req.body;
    const keys = Object.keys(c);
    const values = Object.values(c);
    const setClause = keys.map(k => `${quoteKeyIfNeeded(k)} = ?`).join(', ');
    await db.prepare(`UPDATE classes SET ${setClause} WHERE id = ?`).run([...values, id]);
    res.json({ id, ...c });
  });

  app.put('/api/instructors/:id', async (req, res) => {
    const { id } = req.params;
    const i = req.body;
    await db.prepare(
      'UPDATE instructors SET name = ?, phone = ?, email = ? WHERE id = ?'
    ).run(i.name, i.phone, i.email, id);
    res.json({ id, ...i });
  });

  app.delete('/api/students/:id', async (req, res) => {
    await db.prepare('DELETE FROM students WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/instructors/:id', async (req, res) => {
    await db.prepare('DELETE FROM instructors WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/packages/:id', async (req, res) => {
    await db.prepare('DELETE FROM packages WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/student-packages/:id', async (req, res) => {
    await db.prepare('DELETE FROM student_packages WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  app.delete('/api/classes/:id', async (req, res) => {
    await db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Payments
  app.get('/api/payments', async (req, res) => {
    const payments = await db.prepare('SELECT * FROM payments').all();
    res.json(payments);
  });

  app.post('/api/payments', async (req, res) => {
    const p = req.body;
    const id = p.id || Math.random().toString(36).substr(2, 9);
    await db.prepare(
      'INSERT INTO payments (id, studentPackageId, amount, date, method, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, p.studentPackageId, p.amount, p.date, p.method, p.notes);
    res.json({ id, ...p });
  });

  app.delete('/api/payments/:id', async (req, res) => {
    await db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  });

  // Overwrite Sync Database state at once
  app.post('/api/sync/overwrite', async (req, res) => {
    const { students = [], instructors = [], packages = [], studentPackages = [], classes = [], payments = [] } = req.body;
    
    try {
      if (db.isPostgres) {
        const client = await db.pgPool!.connect();
        try {
          await client.query('BEGIN');
          await client.query('DELETE FROM students');
          await client.query('DELETE FROM instructors');
          await client.query('DELETE FROM packages');
          await client.query('DELETE FROM student_packages');
          await client.query('DELETE FROM classes');
          await client.query('DELETE FROM payments');

          for (const s of students) {
            await client.query('INSERT INTO students (id, name, email, phone, age, "hasBoard", "parentsName", "birthDate", "enrollmentDate") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [s.id, s.name, s.email || '', s.phone || '', s.age ?? 0, s.hasBoard || 'No', s.parentsName || '', s.birthDate || '', s.enrollmentDate || '']);
          }
          for (const i of instructors) {
            await client.query('INSERT INTO instructors (id, name, specialty, phone, email) VALUES ($1, $2, $3, $4, $5)', [i.id, i.name, i.specialty || '', i.phone || '', i.email || '']);
          }
          for (const p of packages) {
            await client.query('INSERT INTO packages (id, name, price, "totalClasses", description) VALUES ($1, $2, $3, $4, $5)', [p.id, p.name, p.price, p.totalClasses, p.description || '']);
          }
          for (const sp of studentPackages) {
            await client.query('INSERT INTO student_packages (id, "studentId", "packageId", "packageName", "amountPaid", "totalPrice", "classesUsed", "totalClasses", "paymentDueDate", status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)', [sp.id, sp.studentId, sp.packageId, sp.packageName || '', sp.amountPaid ?? 0, sp.totalPrice ?? 0, sp.classesUsed ?? 0, sp.totalClasses ?? 0, sp.paymentDueDate || '', sp.status || 'active']);
          }
          for (const c of classes) {
            await client.query('INSERT INTO classes (id, date, "studentId", "instructorId", status) VALUES ($1, $2, $3, $4, $5)', [c.id, c.date, c.studentId, c.instructorId, c.status || 'scheduled']);
          }
          for (const p of payments) {
            await client.query('INSERT INTO payments (id, "studentPackageId", amount, date, method, notes) VALUES ($1, $2, $3, $4, $5, $6)', [p.id, p.studentPackageId, p.amount ?? 0, p.date || '', p.method || 'Efectivo', p.notes || '']);
          }
          await client.query('COMMIT');
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } else {
        const runTx = db.sqliteDb.transaction(() => {
          db.sqliteDb.prepare('DELETE FROM students').run();
          db.sqliteDb.prepare('DELETE FROM instructors').run();
          db.sqliteDb.prepare('DELETE FROM packages').run();
          db.sqliteDb.prepare('DELETE FROM student_packages').run();
          db.sqliteDb.prepare('DELETE FROM classes').run();
          db.sqliteDb.prepare('DELETE FROM payments').run();

          const insertStudent = db.sqliteDb.prepare('INSERT INTO students (id, name, email, phone, age, "hasBoard", "parentsName", "birthDate", "enrollmentDate") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const s of students) {
            insertStudent.run(s.id, s.name, s.email || '', s.phone || '', s.age ?? 0, s.hasBoard || 'No', s.parentsName || '', s.birthDate || '', s.enrollmentDate || '');
          }

          const insertInstructor = db.sqliteDb.prepare('INSERT INTO instructors (id, name, specialty, phone, email) VALUES (?, ?, ?, ?, ?)');
          for (const i of instructors) {
            insertInstructor.run(i.id, i.name, i.specialty || '', i.phone || '', i.email || '');
          }

          const insertPackage = db.sqliteDb.prepare('INSERT INTO packages (id, name, price, "totalClasses", description) VALUES (?, ?, ?, ?, ?)');
          for (const p of packages) {
            insertPackage.run(p.id, p.name, p.price, p.totalClasses, p.description || '');
          }

          const insertStudentPackage = db.sqliteDb.prepare('INSERT INTO student_packages (id, "studentId", "packageId", "packageName", "amountPaid", "totalPrice", "classesUsed", "totalClasses", "paymentDueDate", status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const sp of studentPackages) {
            insertStudentPackage.run(sp.id, sp.studentId, sp.packageId, sp.packageName || '', sp.amountPaid ?? 0, sp.totalPrice ?? 0, sp.classesUsed ?? 0, sp.totalClasses ?? 0, sp.paymentDueDate || '', sp.status || 'active');
          }

          const insertClass = db.sqliteDb.prepare('INSERT INTO classes (id, date, "studentId", "instructorId", status) VALUES (?, ?, ?, ?, ?)');
          for (const c of classes) {
            insertClass.run(c.id, c.date, c.studentId, c.instructorId, c.status || 'scheduled');
          }

          const insertPayment = db.sqliteDb.prepare('INSERT INTO payments (id, "studentPackageId", amount, date, method, notes) VALUES (?, ?, ?, ?, ?, ?)');
          for (const p of payments) {
            insertPayment.run(p.id, p.studentPackageId, p.amount ?? 0, p.date || '', p.method || 'Efectivo', p.notes || '');
          }
        });
        runTx();
      }

      res.json({ success: true, message: 'La base de datos local ha sido sincronizada con Google Sheets con éxito.' });
    } catch (err: any) {
      console.error('Error overwriting database in sync:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Google OAuth Verification Compliance Routes
  app.get('/privacy-policy', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Política de Privacidad - Pacific Surf School Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;505;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col justify-between">
    <header class="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 border-b border-slate-700 py-6 px-4 shadow-sm">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-3xl">🏄‍♂️</span>
                <div>
                    <h1 class="text-xl font-extrabold text-white tracking-tight">Pacific Surf School</h1>
                    <p class="text-xs text-cyan-400 font-bold tracking-widest uppercase mt-0.5">Plataforma de Gestión Interna</p>
                </div>
            </div>
            <a href="/" class="text-xs font-bold text-slate-350 hover:text-white px-3.5 py-2 border border-slate-700 rounded-xl transition bg-slate-800/50">Regresar al Sistema</a>
        </div>
    </header>

    <main class="flex-grow max-w-4xl w-full mx-auto px-4 py-12 md:py-16">
        <article class="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div class="border-b border-slate-100 pb-5">
                <h2 class="text-3xl font-black text-slate-900 tracking-tight">Política de Privacidad</h2>
                <p class="text-xs font-mono text-slate-450 mt-1 uppercase tracking-wider font-bold">Última actualización: 19 de Junio de 2026</p>
            </div>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">1. Introducción y Propósito</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Esta Política de Privacidad describe cómo se recopilan, utilizan, protegen y manejan sus datos personales cuando interactúa con el software interno de administración de <strong>Pacific Surf School Manager</strong> ("la Aplicación"). Valoramos profundamente la privacidad de nuestros entrenadores, personal académico y alumnos de la escuela.
                </p>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">2. Uso de la API de Google de forma Segura (OAuth Scopes)</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Nuestra aplicación se integra directamente con <strong>Google Sheets (Hojas de cálculo de Google)</strong> para brindar sincronización bidireccional de datos escolares clave. El uso solicitado de las credenciales de Google se fundamenta exclusivamente en la productividad administrativa de la escuela:
                </p>
                <div class="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-2">
                    <p class="text-xs text-slate-700 font-semibold flex items-center gap-2">
                        <span class="text-emerald-600 font-bold">•</span>
                        <strong>Controlador de Ámbito solicitado:</strong> <code>https://www.googleapis.com/auth/spreadsheets</code>
                    </p>
                    <p class="text-xs text-slate-600 leading-relaxed">
                        Este permiso nos permite leer, editar y crear de forma remota las pestañas dedicadas a "Alumnos", "Instructores", "Paquetes", "Clases" y "Pagos de Caja" de tu Hoja de Cálculo seleccionada, evitando duplicidades de datos y permitiéndote conservar un respaldo instantáneo bajo control total de tu escuela.
                    </p>
                </div>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">3. Limitación en la Retención y Transferencia de Información</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    <strong>Absolutamente ninguna información es vendida, compartida ni transferida</strong> a terceras partes externas a Pacific Surf School o Google. La Aplicación sigue rigurosas directrices de seguridad para garantizar que su Workspace se mantenga completamente blindado:
                </p>
                <ul class="list-disc pl-5 text-sm text-slate-650 space-y-1.5">
                    <li>Los tokens de acceso de Google OAuth obtenidos durante la vinculación se conservan <strong>únicamente en la memoria volátil del servidor (in-memory caching)</strong> y jamás se guardan permanentemente en el disco del equipo para evitar vulneración de credenciales.</li>
                    <li>Los datos generados en la administración (Fichas de alumnos, matrículas, cobro de cuotas) se conservan de forma segura localmente en un motor de base de datos SQLite en contenedores en la nube propiedad exclusiva de la institución.</li>
                </ul>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">4. Almacenamiento Local de Credenciales Escolares</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Las contraseñas de instructores y directivos escolares se procesan mediante <strong>criptografía irreversible unidireccional (Bcrypt de alta iteración)</strong> para garantizar la máxima seguridad contra accesos no autorizados a la aplicación.
                </p>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">5. Derechos de los Usuarios y Control de Datos</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Usted puede desvincular o revocar de inmediato todos los permisos concedidos a nuestra Aplicación en cualquier momento accediendo al panel de seguridad de su cuenta de Google en <a href="https://myaccount.google.com/permissions" target="_blank" class="text-cyan-600 underline font-semibold hover:text-cyan-700">Google Client Security</a> o simplemente haciendo clic en "Cerrar Conexión" en el Tablero de Hojas de Cálculo de nuestra aplicación.
                </p>
            </section>

            <section class="space-y-3 border-t border-slate-100 pt-5">
                <h3 class="text-lg font-bold text-slate-900">6. Preguntas y Soporte</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Si tienes dudas sobre nuestras prácticas de privacidad o seguridad técnica, puedes contactar con el equipo de soporte de Pacific Surf School escribiendo directamente a <a href="mailto:info@pacificsurfschool.com" class="text-cyan-600 font-semibold underline">info@pacificsurfschool.com</a>.
                </p>
            </section>
        </article>
    </main>

    <footer class="bg-slate-900 border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-450 mt-12">
        <div class="max-w-4xl mx-auto space-y-2">
            <p>© 2026 Pacific Surf School S.A.C. Todos los derechos reservados.</p>
            <p class="text-slate-500">Este sistema cuenta con integraciones oficiales del ecosistema de Google Cloud Platform y cumple con los requerimientos regulados por el Plan de Verificación de Aplicaciones.</p>
        </div>
    </footer>
</body>
</html>
    `);
  });

  app.get('/terms-of-service', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Términos de Servicio - Pacific Surf School Manager</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;505;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 antialiased min-h-screen flex flex-col justify-between">
    <header class="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 border-b border-slate-700 py-6 px-4 shadow-sm">
        <div class="max-w-4xl mx-auto flex items-center justify-between">
            <div class="flex items-center gap-3">
                <span class="text-3xl">🏄‍♂️</span>
                <div>
                    <h1 class="text-xl font-extrabold text-white tracking-tight">Pacific Surf School</h1>
                    <p class="text-xs text-cyan-400 font-bold tracking-widest uppercase mt-0.5">Plataforma de Gestión Interna</p>
                </div>
            </div>
            <a href="/" class="text-xs font-bold text-slate-355 hover:text-white px-3.5 py-2 border border-slate-700 rounded-xl transition bg-slate-800/50">Regresar al Sistema</a>
        </div>
    </header>

    <main class="flex-grow max-w-4xl w-full mx-auto px-4 py-12 md:py-16">
        <article class="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-100 space-y-6">
            <div class="border-b border-slate-100 pb-5">
                <h2 class="text-3xl font-black text-slate-900 tracking-tight">Términos de Servicio</h2>
                <p class="text-xs font-mono text-slate-450 mt-1 uppercase tracking-wider font-bold">Última actualización: 19 de Junio de 2026</p>
            </div>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">1. Aceptación de los Términos</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Al acceder o utilizar Pacific Surf School Manager (el "Servicio"), un software integral para coordinar calendarios, cuotas escolares y sincronización de Sheets de Pacific Surf School, usted acepta quedar vinculado de inmediato por estos Términos de Servicio. Si no está de acuerdo, por favor absténgase de usar el software.
                </p>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">2. Uso Permitido y de Carácter Privado</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Este software ha sido diseñado con fines estrictamente <strong>internos, administrativos e informativos</strong> de Pacific Surf School. Está prohibido el uso con propósitos comerciales ajenos a la escuela o la reventa del código, interfaces o bases de datos de alumnos sin consentimiento explícito.
                </p>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">3. Responsabilidad sobre la Sincronización Remota</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    La sincronización de fichas de alumnos con Google Sheets se realiza ejecutando llamadas directas autorizadas a la API de Google proporcionadas de forma nativa por su navegador. Usted acepta que:
                </p>
                <ul class="list-disc pl-5 text-sm text-slate-650 space-y-1.5">
                    <li>Es el único responsable de configurar correctamente el identificador (ID) de su Hoja de Cálculo escolar de forma confidencial.</li>
                    <li>Pacific Surf School Manager no asume responsabilidad alguna ante cortes temporales del servicio de Google Workspace, pérdidas de archivos remotos accidentales en su Google Drive o inconsistencias de formato provocadas por ediciones directas manuales no controladas.</li>
                    <li>Las importaciones de modo "restauración completa destructiva" limpian las bases de datos locales reemplazando por lo contenido en Sheets; se debe utilizar esta función previo respaldo.</li>
                </ul>
            </section>

            <section class="space-y-3">
                <h3 class="text-lg font-bold text-slate-900">4. Registro y Seguridad de Cuentas</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Cada directivo o coach con acceso al panel debe resguardar adecuadamente sus credenciales. La cuenta inicial Super Admin fue provista exclusivamente para el control inicial y no debe ser divulgada para evitar comprometer deudas de cuotas mensuales de alumnos o saldos recaudados de caja.
                </p>
            </section>

            <section class="space-y-3 font-bold text-slate-900 border-t border-slate-100 pt-5 text-sm">
                5. Limitación de Responsabilidad General
            </section>
            <p class="text-sm text-slate-650 leading-relaxed">
                El software se proporciona en sus condiciones actuales ("as-is" y "as-available") sin garantías adicionales implícitas sobre la disponibilidad absoluta a perpetuidad o infalibilidad técnica, exceptuando la protección normal de cifrado integrada en nubes seguras de Cloud Run.
            </p>

            <section class="space-y-3 border-t border-slate-100 pt-5">
                <h3 class="text-lg font-bold text-slate-900">6. Cambios o Modificaciones en los Términos</h3>
                <p class="text-sm text-slate-650 leading-relaxed">
                    Pacific Surf School se reserva el derecho de modificar o cambiar estos términos de servicio en cualquier momento para adecuarse a regulaciones tributarias de caja o del plan de privacidad exigido por Google Cloud. Las continuas visitas representarán aceptación conforme de los mismos.
                </p>
            </section>
        </article>
    </main>

    <footer class="bg-slate-900 border-t border-slate-800 py-8 px-4 text-center text-xs text-slate-455 mt-12">
        <div class="max-w-4xl mx-auto space-y-2">
            <p>© 2026 Pacific Surf School S.A.C. Todos los derechos reservados.</p>
            <p class="text-slate-500">Para consultas o sugerencias respecto al funcionamiento de la licencia de uso interno, comunícate con info@pacificsurfschool.com</p>
        </div>
    </footer>
</body>
</html>
    `);
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
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
