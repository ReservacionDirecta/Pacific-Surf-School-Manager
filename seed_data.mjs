import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_URL = 'https://pacificsurfschoolmanager.up.railway.app/api/sync/overwrite';

const DEFAULT_PACKAGES = [
  { id: 'g1', name: 'Grupal x 1', price: 40, totalClasses: 1 },
  { id: 'g4', name: 'Grupal x 4', price: 150, totalClasses: 4 },
  { id: 'g8', name: 'Grupal x 8', price: 280, totalClasses: 8 },
  { id: 'p1', name: 'Personalizada x 1', price: 70, totalClasses: 1 },
  { id: 'p4', name: 'Personalizada x 4', price: 240, totalClasses: 4 },
  { id: 'p8', name: 'Personalizada x 8', price: 450, totalClasses: 8 },
  { id: 'p12', name: 'Personalizada x 12', price: 650, totalClasses: 12 }
];

function getDeterministicId(name, fallbackPhone = '') {
  if (!name) return 'rand_' + Math.random().toString(36).substr(2, 9);
  const clean = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  const cleanPhone = (fallbackPhone || '').trim().replace(/[^0-9]/g, '');
  return `${clean}${cleanPhone ? '_' + cleanPhone.substring(0, 4) : ''}`;
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    const row = {};
    headers.forEach((h, idx) => { row[h] = (vals[idx] || '').trim(); });
    rows.push(row);
  }
  return rows;
}

function buildName(row) {
  const fn = row['nombre'] || '';
  const ln = row['apellido'] || '';
  return ln ? `${fn} ${ln}`.trim() : fn.trim();
}

function buildPhone(row) {
  const raw = row['telefono'] || row['telefono '] || '';
  return raw.split('/')[0].trim();
}

function buildEnrollmentDate(row) {
  const d = row['fecha de inscripción'] || row['fecha de inscripción '] || '';
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return d;
}

function buildBirthDate(row) {
  const d = row['fecha de nacimiento'] || row['fecha de nacimiento '] || '';
  if (!d) return '';
  const parts = d.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return d;
}

async function main() {
  const csvPath = path.join(__dirname, 'Base de dato Pacific  - Sheet1.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvText);

  console.log(`📄 CSV leído: ${rows.length} registros`);

  const students = [];
  const studentPackages = [];

  for (const row of rows) {
    const name = buildName(row);
    if (!name) continue;
    const phone = buildPhone(row);
    const sid = getDeterministicId(name, phone);

    students.push({
      id: sid,
      name,
      email: '',
      phone,
      age: row['edad'] ? Number(row['edad']) : 0,
      hasBoard: (row['tienen tabla'] || row['tienen tabla '] || 'No').trim(),
      parentsName: (row['nombre padres'] || row['nombre padres '] || '').trim(),
      birthDate: buildBirthDate(row),
      enrollmentDate: buildEnrollmentDate(row)
    });

    const pkgType = (row['tipo de paquete'] || '').trim();
    const groupType = (row['grupal / personalizada'] || row['grupal / personalizada '] || '').trim().toUpperCase();
    const totalClasses = parseInt(pkgType) || 0;

    if (totalClasses > 0) {
      const isPersonalized = groupType.startsWith('P');
      const pkgCode = isPersonalized ? `p${totalClasses}` : `g${totalClasses}`;
      const pkgName = isPersonalized ? `Personalizada x ${totalClasses}` : `Grupal x ${totalClasses}`;
      const matchedPkg = DEFAULT_PACKAGES.find(p => p.id === pkgCode);
      const totalPrice = matchedPkg ? matchedPkg.price : totalClasses * 40;

      studentPackages.push({
        id: `pkg_${sid}`,
        studentId: sid,
        packageId: pkgCode,
        packageName: pkgName,
        amountPaid: totalPrice,
        totalPrice,
        classesUsed: 0,
        totalClasses,
        paymentDueDate: '',
        status: 'active'
      });
    }
  }

  const payload = {
    students,
    instructors: [
      { id: 'inst_1', name: 'Diego Torres', specialty: 'Surf', phone: '948292837', email: 'diego@pacificsurf.com' },
      { id: 'inst_2', name: 'Jose Fernandez', specialty: 'Surf', phone: '984719283', email: 'jose@pacificsurf.com' }
    ],
    packages: DEFAULT_PACKAGES,
    studentPackages,
    classes: [],
    payments: []
  };

  console.log(`📦 Payload: ${students.length} alumnos, ${studentPackages.length} paquetes de alumnos`);
  console.log(`🔗 Enviando a ${API_URL}...`);

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`❌ Error HTTP ${res.status}: ${err}`);
    process.exit(1);
  }

  const result = await res.json();
  console.log(`✅ ${result.message || 'Importación exitosa'}`);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
