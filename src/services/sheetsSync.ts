import { getAccessToken } from './googleAuth';
import { Student, Instructor, Package, StudentPackage, Class, Payment } from '../types';

export interface SyncResult {
  success: boolean;
  message: string;
  count?: {
    students: number;
    packages: number;
    classes: number;
    instructors: number;
    payments: number;
  };
}

// Generate unique identifier based on name, or a random fallback
export const getDeterministicId = (name: string, fallbackPhone = ''): string => {
  if (!name) return 'rand_' + Math.random().toString(36).substr(2, 9);
  const clean = name.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
  const cleanPhone = fallbackPhone.trim().replace(/[^0-9]/g, '');
  return `${clean}${cleanPhone ? '_' + cleanPhone.substring(0, 4) : ''}`;
};

// Map packages catalog dynamically
export const DEFAULT_PACKAGES: Package[] = [
  { id: 'g1', name: 'Grupal x 1', price: 40, totalClasses: 1 },
  { id: 'g4', name: 'Grupal x 4', price: 150, totalClasses: 4 },
  { id: 'g8', name: 'Grupal x 8', price: 280, totalClasses: 8 },
  { id: 'p1', name: 'Personalizada x 1', price: 70, totalClasses: 1 },
  { id: 'p4', name: 'Personalizada x 4', price: 240, totalClasses: 4 },
  { id: 'p8', name: 'Personalizada x 8', price: 450, totalClasses: 8 },
  { id: 'p12', name: 'Personalizada x 12', price: 650, totalClasses: 12 }
];

// High quality background sync engine with Google Sheets
export const syncFromGoogleSheets = async (spreadsheetId: string): Promise<SyncResult> => {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, message: 'No se detectó sesión activa de Google.' };
  }

  try {
    // 1. Get Spreadsheet sheets metadata
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!metaRes.ok) {
      throw new Error('No se pudo acceder a la hoja de cálculo. Por favor verifica los permisos o que el enlace sea correcto.');
    }

    const metaData = await metaRes.json();
    const sheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);

    // Lists of records parsed
    let parsedStudents: Student[] = [];
    let parsedStudentPackages: StudentPackage[] = [];
    let parsedInstructors: Instructor[] = [];
    let parsedClasses: Class[] = [];
    let parsedPayments: Payment[] = [];

    // Let's check which sheets are present.
    // Case A: The spreadsheet has our structured multi-tab format ('Alumnos', 'Instructores', etc.)
    const hasStructuredTabs = sheetTitles.includes('Alumnos');

    if (hasStructuredTabs) {
      // --- FETCH STANDARD 'Alumnos' TAB ---
      const uRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Alumnos!A1:Z1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (uRes.ok) {
        const urlData = await uRes.json();
        const rows = urlData.values || [];
        if (rows.length > 1) {
          const headers = rows[0].map((h: string) => h.trim().toLowerCase());
          // Columns in structured sync: 'ID', 'Nombre', 'Email', 'Teléfono', 'Edad', '¿Tiene Tabla?', 'Padres', 'Fecha Nacimiento', 'Inscripción'
          const idxId = headers.indexOf('id');
          const idxName = headers.indexOf('nombre');
          const idxEmail = headers.indexOf('email');
          const idxPhone = headers.indexOf('teléfono') !== -1 ? headers.indexOf('teléfono') : headers.indexOf('telefono');
          const idxAge = headers.indexOf('edad');
          const idxBoard = headers.indexOf('¿tiene tabla?') !== -1 ? headers.indexOf('¿tiene tabla?') : headers.indexOf('tiene tabla');
          const idxParents = headers.indexOf('padres') !== -1 ? headers.indexOf('padres') : headers.indexOf('nombre padres');
          const idxBirth = headers.indexOf('fecha nacimiento') !== -1 ? headers.indexOf('fecha nacimiento') : headers.indexOf('fecha de nacimiento');
          const idxEnroll = headers.indexOf('inscripción') !== -1 ? headers.indexOf('inscripción') : (headers.indexOf('inscripcion') !== -1 ? headers.indexOf('inscripcion') : headers.indexOf('fecha de inscripción'));

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row[idxName]) continue;
            const sName = row[idxName].trim();
            const sId = idxId !== -1 && row[idxId] ? row[idxId] : getDeterministicId(sName, row[idxPhone] || '');
            parsedStudents.push({
              id: sId,
              name: sName,
              email: idxEmail !== -1 ? row[idxEmail] || '' : '',
              phone: idxPhone !== -1 ? row[idxPhone] || '' : '',
              age: idxAge !== -1 && row[idxAge] ? Number(row[idxAge]) : 0,
              hasBoard: idxBoard !== -1 ? row[idxBoard] || 'No' : 'No',
              parentsName: idxParents !== -1 ? row[idxParents] || '' : '',
              birthDate: idxBirth !== -1 ? row[idxBirth] || '' : '',
              enrollmentDate: idxEnroll !== -1 ? row[idxEnroll] || '' : ''
            });
          }
        }
      }

      // --- FETCH STANDARD 'Instructores' TAB ---
      if (sheetTitles.includes('Instructores')) {
        const iRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Instructores!A1:Z100`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (iRes.ok) {
          const idData = await iRes.json();
          const rows = idData.values || [];
          if (rows.length > 1) {
            // Columns: ID, Nombre, Email, Teléfono
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[1]) continue;
              parsedInstructors.push({
                id: r[0],
                name: r[1],
                email: r[2] || '',
                phone: r[3] || ''
              });
            }
          }
        }
      }

      // --- FETCH STANDARD 'Clases' TAB ---
      if (sheetTitles.includes('Clases')) {
        const cRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Clases!A1:Z1000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cRes.ok) {
          const cdData = await cRes.json();
          const rows = cdData.values || [];
          if (rows.length > 1) {
            // Columns: ID, Fecha, Alumno ID, Instructor ID, Estado
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[0]) continue;
              parsedClasses.push({
                id: r[0],
                date: r[1] || '',
                studentId: r[2] || '',
                instructorId: r[3] || '',
                status: r[4] as any || 'scheduled'
              });
            }
          }
        }
      }

      // --- FETCH STANDARD 'Paquetes de Alumnos' TAB ---
      const hasSpTab = sheetTitles.includes('Paquetes de Alumnos');
      if (hasSpTab) {
        const pRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Paquetes%20de%20Alumnos!A1:Z1000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (pRes.ok) {
          const pdData = await pRes.json();
          const rows = pdData.values || [];
          if (rows.length > 1) {
            // Columns: ID, Alumno ID, Paquete Nombre, Monto Pagado, Precio Total, Clases Usadas, Clases Totales, Fecha Límite Pago, Estado
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[0]) continue;
              const spName = r[2] || '';
              const spPkgId = spName ? getDeterministicId(spName) : 'g4';
              parsedStudentPackages.push({
                id: r[0],
                studentId: r[1] || '',
                packageId: spPkgId,
                packageName: spName,
                amountPaid: r[3] ? Number(r[3]) : 0,
                totalPrice: r[4] ? Number(r[4]) : 0,
                classesUsed: r[5] ? Number(r[5]) : 0,
                totalClasses: r[6] ? Number(r[6]) : 4,
                paymentDueDate: r[7] || '',
                status: r[8] as any || 'active'
              });
            }
          }
        }
      }
    } else {
      // Case B: Spreadsheet is the RAW student roster list provided directly in user message
      // We read the first sheet in the spreadsheet
      const firstSheetTitle = sheetTitles[0];
      const rRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetTitle)}!A1:Z1200`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!rRes.ok) {
        throw new Error(`Error al leer los datos de la pestaña "${firstSheetTitle}"`);
      }

      const rawData = await rRes.json();
      const rows = rawData.values || [];

      if (rows.length > 0) {
        // Find indices dynamically based on lowercased trimmed headers
        const headers = rows[0].map((h: string) => h.trim().toLowerCase());
        
        const idxNombre = headers.findIndex(h => h.includes('nombre') && !h.includes('padres'));
        const idxApellido = headers.findIndex(h => h.includes('apellido'));
        const idxTelefono = headers.findIndex(h => h.includes('telefono') || h.includes('teléfono') || h === 'telf');
        const idxEdad = headers.findIndex(h => h.includes('edad'));
        const idxTabla = headers.findIndex(h => h.includes('tabla'));
        const idxGrupo = headers.findIndex(h => h.includes('grupal') || h.includes('personalizada') || h.includes('tipo'));
        const idxTipoPkg = headers.findIndex(h => h.includes('paquete') || h.includes('clases'));
        const idxIncrip = headers.findIndex(h => h.includes('inscrip') || h.includes('fecha'));
        const idxPadres = headers.findIndex(h => h.includes('padre'));
        const idxNacimiento = headers.findIndex(h => h.includes('nacimiento') || h.includes('naci'));

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          // Get name
          const fName = idxNombre !== -1 && row[idxNombre] ? row[idxNombre].trim() : '';
          const lName = idxApellido !== -1 && row[idxApellido] ? row[idxApellido].trim() : '';
          if (!fName) continue; // Skip empty rows

          const fullName = lName ? `${fName} ${lName}` : fName;
          const phoneNum = idxTelefono !== -1 && row[idxTelefono] ? row[idxTelefono].trim() : '';
          const studentId = getDeterministicId(fullName, phoneNum);

          const studentObj: Student = {
            id: studentId,
            name: fullName,
            email: '',
            phone: phoneNum,
            age: idxEdad !== -1 && row[idxEdad] ? Number(row[idxEdad]) : 0,
            hasBoard: idxTabla !== -1 && row[idxTabla] ? row[idxTabla].trim() : 'No',
            parentsName: idxPadres !== -1 && row[idxPadres] ? row[idxPadres].trim() : '',
            birthDate: idxNacimiento !== -1 && row[idxNacimiento] ? row[idxNacimiento].trim() : '',
            enrollmentDate: idxIncrip !== -1 && row[idxIncrip] ? row[idxIncrip].trim() : ''
          };

          parsedStudents.push(studentObj);

          // Build a Student Package for this row if package code exists
          const pkgCountRaw = idxTipoPkg !== -1 && row[idxTipoPkg] ? row[idxTipoPkg].trim() : '';
          const totalClasses = parseInt(pkgCountRaw) || 4; // Defaults to 4
          const isPersonalized = idxGrupo !== -1 && row[idxGrupo] ? row[idxGrupo].trim().toUpperCase().startsWith('P') : false;

          const pkgCode = isPersonalized ? `p${totalClasses}` : `g${totalClasses}`;
          const pkgName = isPersonalized ? `Personalizada x ${totalClasses}` : `Grupal x ${totalClasses}`;
          const matchedPkg = DEFAULT_PACKAGES.find(p => p.id === pkgCode) || { price: totalClasses * 40 };
          const totalPrice = matchedPkg.price;

          parsedStudentPackages.push({
            id: `pkg_${studentId}`,
            studentId: studentId,
            packageId: pkgCode,
            packageName: pkgName,
            amountPaid: totalPrice, // Assuming paid for loaded sheet rows
            totalPrice: totalPrice,
            classesUsed: 0,
            totalClasses: totalClasses,
            paymentDueDate: studentObj.enrollmentDate || '',
            status: 'active'
          });
        }
      }
    }

    // Default instructors to hold the relationships nicely
    if (parsedInstructors.length === 0) {
      parsedInstructors = [
        { id: 'inst_1', name: 'Diego Torres', phone: '948292837', email: 'diego@pacificsurf.com' },
        { id: 'inst_2', name: 'Jose Fernandez', phone: '984719283', email: 'jose@pacificsurf.com' }
      ];
    }

    // Overwrite backend SQLite with our newly parsed contents
    const syncPayload = {
      students: parsedStudents,
      instructors: parsedInstructors,
      packages: DEFAULT_PACKAGES,
      studentPackages: parsedStudentPackages,
      classes: parsedClasses,
      payments: parsedPayments
    };

    const overwriteRes = await fetch('/api/sync/overwrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncPayload)
    });

    if (!overwriteRes.ok) {
      throw new Error('No se pudo actualizar la base de datos local con los datos de Google Sheets.');
    }

    const overwriteResult = await overwriteRes.json();
    return {
      success: true,
      message: `¡Sincronización exitosa! Se cargaron ${parsedStudents.length} alumnos y ${parsedStudentPackages.length} paquetes desde Google Sheets.`,
      count: {
        students: parsedStudents.length,
        packages: parsedStudentPackages.length,
        classes: parsedClasses.length,
        instructors: parsedInstructors.length,
        payments: parsedPayments.length
      }
    };

  } catch (error: any) {
    console.error('Error in Google Sheets sync engine:', error);
    return { success: false, message: error.message };
  }
};
