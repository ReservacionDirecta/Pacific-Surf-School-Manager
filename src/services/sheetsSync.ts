import { getAccessToken } from './googleAuth';
import { Student, Instructor, Package, StudentPackage, Class, Payment, Equipment } from '../types';

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
    let parsedEquipment: Equipment[] = [];

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

      // --- FETCH STANDARD 'Equipamiento' TAB ---
      if (sheetTitles.includes('Equipamiento')) {
        const eqRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Equipamiento!A1:Z1000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (eqRes.ok) {
          const eqData = await eqRes.json();
          const rows = eqData.values || [];
          if (rows.length > 1) {
            const headers = rows[0].map((h: string) => h.trim().toLowerCase());
            const idxId = headers.indexOf('id');
            const idxType = headers.indexOf('tipo');
            const idxSize = headers.indexOf('talla');
            const idxBrand = headers.indexOf('marca');
            const idxCondition = headers.indexOf('condición') !== -1 ? headers.indexOf('condición') : headers.indexOf('condicion');
            const idxStatus = headers.indexOf('estado');
            const idxNotes = headers.indexOf('notas');
            const idxAssType = headers.indexOf('asignado a tipo');
            const idxAssId = headers.indexOf('asignado a id');
            const idxAssName = headers.indexOf('asignado a nombre');

            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[idxType]) continue;
              parsedEquipment.push({
                id: idxId !== -1 && r[idxId] ? r[idxId] : 'equip_' + Math.random().toString(36).substr(2, 9),
                type: (r[idxType] || '').trim() as Equipment['type'],
                size: r[idxSize] || '',
                brand: idxBrand !== -1 ? r[idxBrand] || '' : '',
                condition: (r[idxCondition] || 'Bueno').trim() as Equipment['condition'],
                status: (r[idxStatus] || 'Disponible').trim() as Equipment['status'],
                notes: idxNotes !== -1 ? r[idxNotes] || '' : '',
                assignedToType: idxAssType !== -1 ? (r[idxAssType] || '') as Equipment['assignedToType'] : '',
                assignedToId: idxAssId !== -1 ? r[idxAssId] || '' : '',
                assignedToName: idxAssName !== -1 ? r[idxAssName] || '' : ''
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

      // --- FETCH STANDARD 'Pagos registrados' TAB ---
      const hasPagosTab = sheetTitles.includes('Pagos registrados');
      if (hasPagosTab) {
        const payRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Pagos%20registrados!A1:Z5000`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (payRes.ok) {
          const payData = await payRes.json();
          const rows = payData.values || [];
          if (rows.length > 1) {
            for (let i = 1; i < rows.length; i++) {
              const r = rows[i];
              if (!r[0]) continue;
              parsedPayments.push({
                id: r[0],
                studentPackageId: r[1] || '',
                amount: r[2] ? Number(r[2]) : 0,
                date: r[3] || '',
                method: r[4] || 'Efectivo',
                notes: r[5] || ''
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

    // Deduplicate parsedStudents by normalized name before sending to server
    if (parsedStudents.length > 0) {
      const nameMap = new Map<string, Student>();
      const idRemap = new Map<string, string>();
      for (const s of parsedStudents) {
        const key = s.name ? s.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s.id!;
        if (nameMap.has(key)) {
          idRemap.set(s.id!, nameMap.get(key)!.id!);
        } else {
          nameMap.set(key, s);
        }
      }
      if (nameMap.size < parsedStudents.length) {
        parsedStudents = Array.from(nameMap.values());
        for (const sp of parsedStudentPackages) {
          const newId = idRemap.get(sp.studentId);
          if (newId) sp.studentId = newId;
        }
      }
    }

    // Overwrite backend SQLite with our newly parsed contents
    const syncPayload = {
      students: parsedStudents,
      instructors: parsedInstructors,
      packages: DEFAULT_PACKAGES,
      studentPackages: parsedStudentPackages,
      classes: parsedClasses,
      payments: parsedPayments,
      equipment: parsedEquipment
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

export const exportToGoogleSheets = async (spreadsheetId: string): Promise<SyncResult> => {
  const token = await getAccessToken();
  if (!token) {
    return { success: false, message: 'No se detectó sesión activa de Google o expiró.' };
  }

  try {
    const sheetNames = ['Alumnos', 'Instructores', 'Clases', 'Paquetes de Alumnos', 'Pagos registrados', 'Equipamiento'];
    
    // 1. Ensure all sheet tabs exist first
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`No se pudo leer la hoja de cálculo. Asegúrate de tener permisos o re-introduce el ID. Detalles: ${errText}`);
    }

    const metaData = await metaRes.json();
    const existingTitles = (metaData.sheets || []).map((s: any) => s.properties.title);
    const sheetsToCreate = sheetNames.filter(name => !existingTitles.includes(name));

    if (sheetsToCreate.length > 0) {
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: sheetsToCreate.map(title => ({
            addSheet: { properties: { title } }
          }))
        })
      });
      if (!updateRes.ok) {
        throw new Error('Error al crear las pestañas necesarias en Google Sheets.');
      }
    }

    // 2. Fetch all local data using dynamic imports to prevent circular dependencies
    const { getStudents, getInstructors, getClasses, getStudentPackages, getPayments, getEquipment } = await import('./db');
    const [alumnos, instructores, clases, studentPkgs, pagos, equipamiento] = await Promise.all([
      getStudents(),
      getInstructors(),
      getClasses(),
      getStudentPackages(),
      getPayments(),
      getEquipment()
    ]);

    // Helper function to write sheet data
    const writeSheetData = async (range: string, values: any[][]) => {
      // Try clearing the range first so old rows below new data don't persist
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:clear`;
      const clearRes = await fetch(clearUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const clearOk = clearRes.ok;

      // Build final values: if clear failed, pad with empty rows to overwrite stale data (up to 200 rows)
      let finalValues = values;
      if (!clearOk && values.length < 200) {
        const emptyRow = Array(values[0].length).fill('');
        const padded = [...values];
        for (let i = values.length; i < 200; i++) padded.push([...emptyRow]);
        finalValues = padded;
      }

      const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: finalValues })
      });
      if (!writeRes.ok) {
        throw new Error(`Error escribiendo en el rango ${range}`);
      }
    };

    // 3. Sync each tab cleanly
    // A. Alumnos
    const alumnosValues = [
      ['ID', 'Nombre', 'Email', 'Teléfono', 'Edad', '¿Tiene Tabla?', 'Padres', 'Fecha Nacimiento', 'Inscripción'],
      ...alumnos.map(a => [
        a.id, 
        a.name, 
        a.email || '', 
        a.phone || '', 
        a.age ?? 0, 
        a.hasBoard || 'No', 
        a.parentsName || '', 
        a.birthDate || '', 
        a.enrollmentDate || ''
      ])
    ];
    await writeSheetData('Alumnos!A1:I2000', alumnosValues);

    // B. Instructores
    const instructoresValues = [
      ['ID', 'Nombre', 'Email', 'Teléfono'],
      ...instructores.map(i => [i.id, i.name, i.email || '', i.phone || ''])
    ];
    await writeSheetData('Instructores!A1:D500', instructoresValues);

    // C. Clases
    const clasesValues = [
      ['ID', 'Fecha', 'Alumno ID', 'Instructor ID', 'Estado'],
      ...clases.map(c => [c.id || '', c.date, c.studentId, c.instructorId, c.status])
    ];
    await writeSheetData('Clases!A1:E5500', clasesValues);

    // D. Paquetes de Alumnos
    const spValues = [
      ['ID', 'Alumno ID', 'Paquete ID', 'Nombre Paquete', 'Monto Pagado', 'Precio Total', 'Clases Usadas', 'Clases Totales', 'Fecha Límite Pago', 'Estado'],
      ...studentPkgs.map(sp => [
        sp.id || '', 
        sp.studentId, 
        sp.packageId, 
        sp.packageName || '', 
        sp.amountPaid ?? 0, 
        sp.totalPrice ?? 0, 
        sp.classesUsed ?? 0, 
        sp.totalClasses ?? 0, 
        sp.paymentDueDate || '', 
        sp.status || 'active'
      ])
    ];
    await writeSheetData('Paquetes de Alumnos!A1:J2000', spValues);

    // E. Pagos registrados
    const pagosValues = [
      ['ID', 'Paquete Alumno ID', 'Monto', 'Fecha', 'Método', 'Notas'],
      ...pagos.map(p => [
        p.id || '',
        p.studentPackageId,
        p.amount ?? 0,
        p.date || '',
        p.method || 'Efectivo',
        p.notes || ''
      ])
    ];
    await writeSheetData('Pagos registrados!A1:F5000', pagosValues);

    // F. Equipamiento
    const equipValues = [
      ['ID', 'Tipo', 'Talla', 'Marca', 'Condición', 'Estado', 'Notas', 'Asignado A Tipo', 'Asignado A ID', 'Asignado A Nombre'],
      ...equipamiento.map(e => [
        e.id || '',
        e.type,
        e.size,
        e.brand || '',
        e.condition,
        e.status,
        e.notes || '',
        e.assignedToType || '',
        e.assignedToId || '',
        e.assignedToName || ''
      ])
    ];
    await writeSheetData('Equipamiento!A1:J2000', equipValues);

    return {
      success: true,
      message: 'Base de datos en Google Sheets actualizada con éxito en tiempo real.',
      count: {
        students: alumnos.length,
        packages: studentPkgs.length,
        classes: clases.length,
        instructors: instructores.length,
        payments: pagos.length
      }
    };
  } catch (err: any) {
    console.error('Error in exportToGoogleSheets:', err);
    return { success: false, message: err.message };
  }
};

let autoSyncTimeout: any = null;

export const autoSyncToSheets = async () => {
  if (typeof window === 'undefined') return;
  const hId = localStorage.getItem('spreadsheet_id');
  if (!hId) return;

  const token = await getAccessToken();
  if (!token) return; // Silent skip if Google session is unauthorized or not signed in yet.

  if (autoSyncTimeout) clearTimeout(autoSyncTimeout);
  
  autoSyncTimeout = setTimeout(async () => {
    try {
      console.log('🔄 Ejecutando autoguardado en tiempo real en Google Sheets...');
      await exportToGoogleSheets(hId);
    } catch (err) {
      console.error('❌ Error en autoguardado de Google Sheets:', err);
    }
  }, 1200); // 1.2s debounce
};
