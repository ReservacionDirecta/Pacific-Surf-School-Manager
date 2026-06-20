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

const INSTRUCTORS = [
  { id: 'inst_1', name: 'Diego Torres', specialty: 'Surf', phone: '948292837', email: 'diego@pacificsurf.com' },
  { id: 'inst_2', name: 'Jose Fernandez', specialty: 'Surf', phone: '984719283', email: 'jose@pacificsurf.com' }
];

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const csvPath = path.join(__dirname, 'Base de dato Pacific  - Sheet1.csv');
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCSV(csvText);

  console.log(`📄 CSV leído: ${rows.length} registros`);

  const students = [];
  const studentPackages = [];
  const classes = [];
  const payments = [];
  let classIdx = 0;

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

      const spId = `pkg_${sid}`;
      studentPackages.push({
        id: spId,
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

      const enrollDate = buildEnrollmentDate(row);
      const baseDate = enrollDate ? new Date(enrollDate) : new Date('2026-06-01');

      for (let c = 0; c < Math.min(totalClasses, 3); c++) {
        const classDate = new Date(baseDate);
        classDate.setDate(classDate.getDate() + c * 7);
        const instIdx = classIdx % INSTRUCTORS.length;
        const isPast = classDate < new Date();
        classes.push({
          id: `cls_${sid}_${c}`,
          date: classDate.toISOString(),
          studentId: sid,
          instructorId: INSTRUCTORS[instIdx].id,
          status: isPast ? 'completed' : 'scheduled'
        });
        classIdx++;
      }

      payments.push({
        id: `pay_${sid}`,
        studentPackageId: spId,
        amount: totalPrice,
        date: enrollDate ? new Date(enrollDate).toISOString() : new Date().toISOString(),
        method: 'Efectivo',
        notes: 'Pago completo al matricular'
      });
    }
  }

  const equipment = [
    { id: 'eq_tabla_1', type: 'Tabla', size: "6'0\"", brand: 'Torq', condition: 'Bueno', status: 'Disponible', notes: 'Tabla de inicio', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_tabla_2', type: 'Tabla', size: "6'4\"", brand: 'NSP', condition: 'Nuevo', status: 'Disponible', notes: '', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_tabla_3', type: 'Tabla', size: "5'8\"", brand: 'Firewire', condition: 'Bueno', status: 'Disponible', notes: '', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_tabla_4', type: 'Tabla', size: "6'2\"", brand: 'Torq', condition: 'Regular', status: 'En mantenimiento', notes: 'Parche en el bottom', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_tabla_5', type: 'Tabla', size: "7'0\"", brand: 'Bic Sport', condition: 'Bueno', status: 'Disponible', notes: 'Tabla de aprendizaje', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_ws_1', type: 'Wetsuit', size: 'M', brand: 'Rip Curl', condition: 'Bueno', status: 'Disponible', notes: '3/2mm', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_ws_2', type: 'Wetsuit', size: 'L', brand: "O'Neill", condition: 'Nuevo', status: 'Disponible', notes: '4/3mm', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_ws_3', type: 'Wetsuit', size: 'S', brand: 'Quiksilver', condition: 'Bueno', status: 'En uso', assignedToType: 'instructor', assignedToId: 'inst_1', assignedToName: 'Diego Torres' },
    { id: 'eq_lycra_1', type: 'Lycra', size: 'M', brand: 'Rip Curl', condition: 'Nuevo', status: 'Disponible', notes: '', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_lycra_2', type: 'Lycra', size: 'L', brand: 'Rip Curl', condition: 'Bueno', status: 'Disponible', notes: '', assignedToType: '', assignedToId: '', assignedToName: '' },
    { id: 'eq_lycra_3', type: 'Lycra', size: 'S', brand: 'Billabong', condition: 'Bueno', status: 'En uso', assignedToType: 'instructor', assignedToId: 'inst_2', assignedToName: 'Jose Fernandez' },
  ];

  const payload = {
    students,
    instructors: INSTRUCTORS,
    packages: DEFAULT_PACKAGES,
    studentPackages,
    classes,
    payments,
    equipment
  };

  console.log(`📦 Payload: ${students.length} alumnos, ${studentPackages.length} paquetes, ${classes.length} clases, ${payments.length} pagos`);
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
