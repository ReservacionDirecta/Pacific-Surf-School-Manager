import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  FileSpreadsheet, 
  LogIn, 
  LogOut, 
  Settings, 
  Download, 
  Upload, 
  Terminal, 
  ExternalLink,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { getAccessToken, googleSignIn, logoutGoogle, initAuth } from '../services/googleAuth';
import { getStudents, getInstructors, getClasses, getStudentPackages, addStudent, addStudentPackage, getPackages, getPayments, isLocalStorageMode, LS_KEYS } from '../services/db';
import { User } from 'firebase/auth';

const DEFAULT_SPREADSHEET_ID = '1OuuRJwIUwqEnfb9d_JMOsItxMDGwRAA231vRTO-diR8';

export default function GoogleSheetsSync() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    return localStorage.getItem('spreadsheet_id') || DEFAULT_SPREADSHEET_ID;
  });
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    localStorage.setItem('spreadsheet_id', spreadsheetId);
  }, [spreadsheetId]);

  useEffect(() => {
    // Initialize google auth listener
    const unsubscribe = initAuth(
      (currentUser, currentToken) => {
        setUser(currentUser);
        setToken(currentToken);
        setNeedsAuth(false);
        setLoginError(null);
        addLog('Autenticación de Google exitosa.');
      },
      () => {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const addLog = (msg: string) => {
    setSyncLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        addLog('Conectado a Google con éxito.');
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      let errorMsg = 'Error al iniciar sesión con Google.';
      if (err?.code === 'auth/unauthorized-domain' || err?.message?.includes('unauthorized-domain')) {
        errorMsg = 'auth/unauthorized-domain';
        addLog('❌ Error: auth/unauthorized-domain (Dominio no autorizado en la consola de Firebase).');
      } else {
        addLog(`❌ Error al iniciar sesión: ${err?.message || err}`);
      }
      setLoginError(errorMsg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutGoogle();
      addLog('Desconectado de Google.');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Helper to extract spreadsheet ID from full URL
  const handleSpreadsheetIdChange = (val: string) => {
    const matches = val.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (matches && matches[1]) {
      setSpreadsheetId(matches[1]);
      addLog(`Spreadsheet ID detectado de la URL: ${matches[1]}`);
    } else {
      setSpreadsheetId(val);
    }
  };

  // Fetch or create sheets
  const ensureSheetsExist = async (accessToken: string, targetId: string, sheetNames: string[]) => {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}?fields=sheets.properties.title`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      throw new Error(`No se pudo leer la hoja de cálculo. Asegúrate de tener permisos. Detalles: ${errText}`);
    }

    const metaData = await metaRes.json();
    const existingTitles = (metaData.sheets || []).map((s: any) => s.properties.title);

    const sheetsToCreate = sheetNames.filter(name => !existingTitles.includes(name));

    if (sheetsToCreate.length > 0) {
      addLog(`Creando pestañas faltantes en la hoja de cálculo: ${sheetsToCreate.join(', ')}...`);
      const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: sheetsToCreate.map(title => ({
            addSheet: { properties: { title } }
          }))
        })
      });
      if (!updateRes.ok) {
        throw new Error('Error al crear las pestañas en Google Sheets.');
      }
      addLog('Pestañas creadas con éxito.');
    }
  };

  // Write sheet values
  const writeSheetData = async (accessToken: string, targetId: string, range: string, values: any[][]) => {
    // Try clearing the range first so old rows below new data don't persist
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/${encodeURIComponent(range)}:clear`;
    const clearRes = await fetch(clearUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` }
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

    const writeRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: finalValues })
    });
    if (!writeRes.ok) {
      throw new Error(`Error escribiendo en el rango ${range}`);
    }
  };

  // Export local database to user's Google Sheet
  const handleExportToSheets = async () => {
    const activeToken = token || await getAccessToken();
    if (!activeToken) {
      addLog('Error: No estás autenticado con Google.');
      alert('Inicia sesión con Google primero.');
      return;
    }

    setIsSyncing(true);
    addLog('Iniciando exportación de datos a Google Sheets...');

    try {
      const sheetNames = ['Alumnos', 'Instructores', 'Clases', 'Paquetes', 'Paquetes de Alumnos', 'Pagos registrados'];
      await ensureSheetsExist(activeToken, spreadsheetId, sheetNames);

      const [alumnos, instructores, clases, studentPkgs, pagos, paquetesCatalogo] = await Promise.all([
        getStudents(),
        getInstructors(),
        getClasses(),
        getStudentPackages(),
        getPayments(),
        getPackages()
      ]);

      // 1. Export Alumnos
      addLog(`Exportando ${alumnos.length} Alumnos...`);
      const alumnosValues = [
        ['ID', 'Nombre', 'Email', 'Teléfono', 'Edad', '¿Tiene Tabla?', 'Padres', 'Fecha Nacimiento', 'Inscripción'],
        ...alumnos.map(a => [
          a.id, a.name, a.email || '', a.phone || '', a.age ?? 0,
          a.hasBoard || 'No', a.parentsName || '', a.birthDate || '', a.enrollmentDate || ''
        ])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Alumnos!A1:I2000', alumnosValues);

      // 2. Export Instructores
      addLog(`Exportando ${instructores.length} Instructores...`);
      const instValues = [
        ['ID', 'Nombre', 'Email', 'Teléfono'],
        ...instructores.map(i => [i.id, i.name, i.email || '', i.phone || ''])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Instructores!A1:D500', instValues);

      // 3. Export Clases
      addLog(`Exportando ${clases.length} Clases...`);
      const clasesValues = [
        ['ID', 'Fecha', 'Alumno ID', 'Instructor ID', 'Estado'],
        ...clases.map(c => [c.id || '', c.date, c.studentId, c.instructorId, c.status])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Clases!A1:E5000', clasesValues);

      // 4. Export Student Packages
      addLog(`Exportando ${studentPkgs.length} Planes...`);
      const spValues = [
        ['ID', 'Alumno ID', 'Paquete ID', 'Nombre Paquete', 'Total Clases', 'Clases Usadas', 'Precio Total', 'Monto Pagado', 'Fecha Limite Pago', 'Estado'],
        ...studentPkgs.map(sp => [
          sp.id || '', 
          sp.studentId, 
          sp.packageId, 
          sp.packageName, 
          sp.totalClasses, 
          sp.classesUsed, 
          sp.totalPrice, 
          sp.amountPaid, 
          sp.paymentDueDate || '', 
          sp.status
        ])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Paquetes de Alumnos!A1:J2000', spValues);

      // 5. Export Pagos
      addLog(`Exportando ${pagos.length} Pagos registrados...`);
      const pagosValues = [
        ['ID', 'Paquete Alumno ID', 'Monto', 'Fecha', 'Método', 'Notas'],
        ...pagos.map(p => [p.id || '', p.studentPackageId, p.amount ?? 0, p.date || '', p.method || '', p.notes || ''])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Pagos registrados!A1:F5000', pagosValues);

      // 6. Export Paquetes (catalog)
      addLog(`Exportando ${paquetesCatalogo.length} Planes del catálogo...`);
      const pkgValues = [
        ['ID', 'Nombre', 'Precio', 'Clases Totales'],
        ...paquetesCatalogo.map(p => [p.id || '', p.name, p.price ?? 0, p.totalClasses ?? 1])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Paquetes!A1:D500', pkgValues);

      addLog('✅ ¡Exportación completada exitosamente en todas las pestañas!');
      alert('Sincronización de exportación finalizada correctamente.');
    } catch (error: any) {
      console.error(error);
      addLog(`❌ Error en exportación: ${error.message}`);
      alert(`Error en sincronización: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Import missing students from Sheets
  const handleImportFromSheets = async () => {
    const activeToken = token || await getAccessToken();
    if (!activeToken) {
      addLog('Error: No estás autenticado con Google.');
      alert('Inicia sesión con Google primero.');
      return;
    }

    setIsSyncing(true);
    addLog('Iniciando importación desde Google Sheets...');

    try {
      // 1. Fetch metadata first to dynamically list sheets and find a valid tab
      addLog('Leyendo estructura de la hoja de cálculo...');
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      
      if (!metaRes.ok) {
        const errorDetail = await metaRes.text();
        throw new Error(`No se pudo leer la hoja de cálculo. Por favor, verifica que el enlace o ID sea correcto y que tu cuenta tenga acceso. Detalles: ${errorDetail}`);
      }

      const metaData = await metaRes.json();
      const sheetTitles: string[] = (metaData.sheets || []).map((s: any) => s.properties.title);
      addLog(`Pestañas encontradas en el documento: ${sheetTitles.join(', ')}`);

      if (sheetTitles.length === 0) {
        throw new Error('La hoja de cálculo no contiene ninguna pestaña.');
      }

      // Check if "Alumnos" is present, otherwise fallback to the first tab
      let targetTab = 'Alumnos';
      if (!sheetTitles.includes('Alumnos')) {
        targetTab = sheetTitles[0];
        addLog(`⚠️ Pestaña "Alumnos" no encontrada de forma exacta.`);
        addLog(`Intentando importar desde la primera pestaña disponible: "${targetTab}"`);
      } else {
        addLog(`Pestaña "Alumnos" encontrada con éxito. Cargando datos...`);
      }

      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(targetTab)}!A1:Z1000`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${activeToken}` } });
      
      if (!res.ok) {
        throw new Error(`No se pudo acceder a la pestaña "${targetTab}".`);
      }

      const data = await res.json();
      const rows = data.values || [];

      if (rows.length < 2) {
        addLog(`No se encontraron suficientes registros de datos en la pestaña "${targetTab}" (Se necesita una fila de cabecera y al menos un alumno).`);
        setIsSyncing(false);
        return;
      }

      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      
      // Smart fuzzy matching for columns
      const nameIdx = headers.findIndex((h: string) => h.includes('nombre') || h.includes('name') || h === 'alumno' || h === 'estudiante');
      const emailIdx = headers.findIndex((h: string) => h.includes('email') || h.includes('correo') || h.includes('mail') || h.includes('e-mail'));
      const phoneIdx = headers.findIndex((h: string) => h.includes('telefono') || h.includes('teléfono') || h.includes('celular') || h.includes('phone') || h.includes('telf') || h.includes('contacto'));

      const finalNameIdx = nameIdx !== -1 ? nameIdx : (rows[0].length > 1 ? 1 : 0);
      addLog(`Mapeo de columnas: Nombre en col ${finalNameIdx + 1}, Email en col ${emailIdx !== -1 ? emailIdx + 1 : 'no detectado'}, Teléfono en col ${phoneIdx !== -1 ? phoneIdx + 1 : 'no detectado'}`);

      const existingStudents = await getStudents();
      const existingNames = new Set(existingStudents.map(s => s.name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')));
      const allPkgs = await getPackages();
      const firstPkg = allPkgs[0];

      let importCount = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = row[finalNameIdx];
        
        if (!name || name.trim() === '') continue;

        const normalizedName = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

        if (!existingNames.has(normalizedName)) {
          addLog(`Registrando Alumno: ${name.trim()}...`);
          const newStudentRef = await addStudent({
            name: name.trim(),
            email: emailIdx !== -1 ? row[emailIdx] || '' : '',
            phone: phoneIdx !== -1 ? row[phoneIdx] || '' : '',
            enrollmentDate: new Date().toISOString()
          });

          if (newStudentRef && !(newStudentRef as any).duplicate && firstPkg && firstPkg.id) {
            const createdStudentId = newStudentRef.id;
            await addStudentPackage({
              studentId: createdStudentId,
              packageId: firstPkg.id,
              packageName: firstPkg.name,
              classesUsed: 0,
              totalClasses: firstPkg.totalClasses,
              totalPrice: firstPkg.price,
              amountPaid: firstPkg.price,
              status: 'active'
            });
          }

          existingNames.add(normalizedName);
          importCount++;
        }
      }

      addLog(`✅ ¡Proceso terminado! Se importaron ${importCount} alumnos nuevos.`);
      alert(`Importación finalizada correctamente. ${importCount} alumnos añadidos.`);
    } catch (error: any) {
      console.error(error);
      addLog(`❌ Error en importación: ${error.message}`);
      alert(`Error en importación: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Full Database Overwrite Restore from Google Sheets
  const handleRestoreFullDatabase = async () => {
    const activeToken = token || await getAccessToken();
    if (!activeToken) {
      addLog('Error: No estás autenticado con Google.');
      alert('Inicia sesión con Google primero.');
      return;
    }

    if (!window.confirm('🚨 ADVERTENCIA: Esta acción es destructiva. Reemplazará TODOS los datos locales actuales (Alumnos, Instructores, Paquetes de Alumnos y Clases) con la información que se encuentra en tu Google Sheet. ¿Deseas continuar?')) {
      return;
    }

    setIsSyncing(true);
    addLog('Iniciando restauración de base de datos completa de Google Sheets...');

    try {
      // 1. Fetch Students sheet
      addLog('Leyendo datos de Alumnos desde Sheets...');
      const studentsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Alumnos!A1:I2000`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      if (!studentsRes.ok) {
        throw new Error('No se pudo acceder a la pestaña "Alumnos". Si estás usando una hoja de cálculo nueva o vacía, por favor haz clic en "Exportar a Sheets" primero para inicializar la estructura y crear todas las pestañas automáticamente.');
      }
      const studentsData = await studentsRes.json();
      const studentsRows = studentsData?.values || [];
      
      const parsedStudents = [];
      if (studentsRows.length >= 2) {
        const headers = studentsRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('nombre');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.findIndex((h: string) => h.includes('teléfono') || h.includes('telefono'));
        const ageIdx = headers.indexOf('edad');
        const boardIdx = headers.findIndex((h: string) => h.includes('tabla'));
        const parentsIdx = headers.findIndex((h: string) => h.includes('padre'));
        const birthIdx = headers.findIndex((h: string) => h.includes('nacimiento'));
        const enrollIdx = headers.findIndex((h: string) => h.includes('inscrip') || h.includes('fecha'));
        
        for (let i = 1; i < studentsRows.length; i++) {
          const row = studentsRows[i];
          const name = row[nameIdx];
          if (!name) continue;
          parsedStudents.push({
            id: row[idIdx] || `student-${Date.now()}-${i}`,
            name,
            email: row[emailIdx] || '',
            phone: row[phoneIdx] || '',
            age: ageIdx !== -1 && row[ageIdx] ? Number(row[ageIdx]) : 0,
            hasBoard: boardIdx !== -1 && row[boardIdx] ? row[boardIdx].trim() : 'No',
            parentsName: parentsIdx !== -1 && row[parentsIdx] ? row[parentsIdx].trim() : '',
            birthDate: birthIdx !== -1 && row[birthIdx] ? row[birthIdx] : '',
            enrollmentDate: enrollIdx !== -1 && row[enrollIdx] ? row[enrollIdx] : ''
          });
        }
      }
      addLog(`Se leyeron ${parsedStudents.length} alumnos.`);

      // 2. Fetch Instructors sheet
      addLog('Leyendo datos de Instructores desde Sheets...');
      const instRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Instructores!A1:D500`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const instData = instRes.ok ? await instRes.json() : null;
      const instRows = instData?.values || [];
      
      const parsedInstructors = [];
      if (instRows.length >= 2) {
        const headers = instRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('nombre');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.findIndex((h: string) => h.includes('teléfono') || h.includes('telefono'));
        
        for (let i = 1; i < instRows.length; i++) {
          const row = instRows[i];
          const name = row[nameIdx];
          if (!name) continue;
          parsedInstructors.push({
            id: row[idIdx] || `instructor-${Date.now()}-${i}`,
            name,
            email: row[emailIdx] || '',
            phone: row[phoneIdx] || '',
            specialty: 'Surf'
          });
        }
      }
      addLog(`Se leyeron ${parsedInstructors.length} instructores.`);

      // 3. Fetch Classes sheet
      addLog('Leyendo datos de Clases desde Sheets...');
      const classesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Clases!A1:E5000`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const classesData = classesRes.ok ? await classesRes.json() : null;
      const classesRows = classesData?.values || [];
      
      const parsedClasses = [];
      if (classesRows.length >= 2) {
        const headers = classesRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const dateIdx = headers.indexOf('fecha');
        const studentIdIdx = headers.indexOf('alumno id') !== -1 ? headers.indexOf('alumno id') : headers.indexOf('studentid');
        const instIdIdx = headers.indexOf('instructor id') !== -1 ? headers.indexOf('instructor id') : headers.indexOf('instructorid');
        const statusIdx = headers.indexOf('estado') !== -1 ? headers.indexOf('estado') : headers.indexOf('status');
        
        for (let i = 1; i < classesRows.length; i++) {
          const row = classesRows[i];
          const date = row[dateIdx];
          const studentId = row[studentIdIdx];
          if (!date || !studentId) continue;
          parsedClasses.push({
            id: row[idIdx] || `class-${Date.now()}-${i}`,
            date,
            studentId,
            instructorId: row[instIdIdx] || '',
            status: row[statusIdx] || 'scheduled'
          });
        }
      }
      addLog(`Se leyeron ${parsedClasses.length} clases.`);

      // 4. Fetch Student Packages sheet
      addLog('Leyendo datos de Paquetes de Alumnos desde Sheets...');
      const spRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Paquetes de Alumnos!A1:J2000`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const spData = spRes.ok ? await spRes.json() : null;
      const spRows = spData?.values || [];
      
      const parsedStudentPackages = [];
      if (spRows.length >= 2) {
        const headers = spRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const studentIdIdx = headers.indexOf('alumno id') !== -1 ? headers.indexOf('alumno id') : headers.indexOf('studentid');
        const packageIdIdx = headers.indexOf('paquete id') !== -1 ? headers.indexOf('paquete id') : headers.indexOf('packageid');
        const packageNameIdx = headers.indexOf('nombre paquete') !== -1 ? headers.indexOf('nombre paquete') : headers.indexOf('packagename');
        const totalClassesIdx = headers.indexOf('total clases') !== -1 ? headers.indexOf('total clases') : headers.indexOf('totalclasses');
        const classesUsedIdx = headers.indexOf('clases usadas') !== -1 ? headers.indexOf('clases usadas') : headers.indexOf('classesused');
        const totalPriceIdx = headers.indexOf('precio total') !== -1 ? headers.indexOf('precio total') : headers.indexOf('totalprice');
        const amountPaidIdx = headers.indexOf('monto pagado') !== -1 ? headers.indexOf('monto pagado') : headers.indexOf('amountpaid');
        const paymentDueDateIdx = headers.indexOf('fecha limite pago') !== -1 ? headers.indexOf('fecha limite pago') : headers.indexOf('paymentduedate');
        const statusIdx = headers.indexOf('estado') !== -1 ? headers.indexOf('estado') : headers.indexOf('status');
        
        for (let i = 1; i < spRows.length; i++) {
          const row = spRows[i];
          const studentId = row[studentIdIdx];
          const packageId = row[packageIdIdx];
          if (!studentId || !packageId) continue;
          parsedStudentPackages.push({
            id: row[idIdx] || `sp-${Date.now()}-${i}`,
            studentId,
            packageId,
            packageName: row[packageNameIdx] || 'Plan',
            totalClasses: Number(row[totalClassesIdx]) || 1,
            classesUsed: Number(row[classesUsedIdx]) || 0,
            totalPrice: Number(row[totalPriceIdx]) || 0,
            amountPaid: Number(row[amountPaidIdx]) || 0,
            paymentDueDate: row[paymentDueDateIdx] || '',
            status: row[statusIdx] || 'active'
          });
        }
      }
      addLog(`Se leyeron ${parsedStudentPackages.length} planes de alumnos.`);

      // 5. Fetch Paquetes catalog from Sheets
      addLog('Leyendo catálogo de Planes desde Sheets...');
      const pkgCatRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Paquetes!A1:D500`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const pkgCatData = pkgCatRes.ok ? await pkgCatRes.json() : null;
      const pkgCatRows = pkgCatData?.values || [];
      const parsedPkgCatalog: any[] = [];
      if (pkgCatRows.length >= 2) {
        const headers = pkgCatRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('nombre');
        const priceIdx = headers.indexOf('precio');
        const classesIdx = headers.indexOf('clases totales');
        for (let i = 1; i < pkgCatRows.length; i++) {
          const row = pkgCatRows[i];
          const name = row[nameIdx];
          if (!name) continue;
          const pkey = name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          if (parsedPkgCatalog.some((p: any) => p.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === pkey)) continue;
          parsedPkgCatalog.push({
            id: row[idIdx] || `pkg-${Date.now()}-${i}`,
            name: name.trim(),
            price: Number(row[priceIdx]) || 0,
            totalClasses: Number(row[classesIdx]) || 1
          });
        }
      }
      addLog(`Se leyeron ${parsedPkgCatalog.length} planes del catálogo.`);

      // 6. Gather current local payments to avoid dropping them
      addLog('Consultando planes y pagos locales...');
      const [currentPkgs, currentPayments] = await Promise.all([
        getPackages(),
        getPayments().catch(() => [])
      ]);

      // 6. Overwrite the database
      if (isLocalStorageMode()) {
        addLog('Modo estático detectado. Sobrescribiendo datos directamente en LocalStorage...');
        localStorage.setItem(LS_KEYS.students, JSON.stringify(parsedStudents));
        localStorage.setItem(LS_KEYS.instructors, JSON.stringify(parsedInstructors));
        localStorage.setItem(LS_KEYS.packages, JSON.stringify(parsedPkgCatalog.length > 0 ? parsedPkgCatalog : currentPkgs));
        localStorage.setItem(LS_KEYS.studentPackages, JSON.stringify(parsedStudentPackages));
        localStorage.setItem(LS_KEYS.classes, JSON.stringify(parsedClasses));
        localStorage.setItem(LS_KEYS.payments, JSON.stringify(currentPayments));

        addLog('✅ ¡Base de datos local (LocalStorage) restaurada y actualizada con éxito!');
        alert('¡Base de datos local completamente restaurada en tu navegador desde Google Sheets!');
        setIsSyncing(false);
        return;
      }

      addLog('Enviando datos combinados a SQLite para sobrescribir base de datos local...');
      const syncRes = await fetch('/api/sync/overwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: parsedStudents,
          instructors: parsedInstructors,
          packages: parsedPkgCatalog.length > 0 ? parsedPkgCatalog : currentPkgs,
          studentPackages: parsedStudentPackages,
          classes: parsedClasses,
          payments: currentPayments
        })
      });
      
      if (!syncRes.ok) {
        throw new Error('No se pudo reescribir la base de datos desde el endpoint del servidor.');
      }
      
      addLog('✅ ¡Base de datos local restaurada y actualizada con éxito!');
      alert('¡Base de datos local completamente restaurada desde Google Sheets!');
    } catch (error: any) {
      console.error(error);
      addLog(`❌ Error en restauración: ${error.message}`);
      alert(`Error en restauración: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and top auth */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-150 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-105 dark:text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6.5 h-6.5 text-emerald-600" />
            Sincronización Google Sheets
          </h2>
          <p className="text-sm text-slate-400">
            Enlace en la nube para usar la hoja de cálculo como base de datos o realizar respaldos del colegio.
          </p>
        </div>

        {/* Google Authentication Control */}
        {needsAuth ? (
          <div className="flex flex-col items-end gap-1.5">
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-650 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer text-xs transition active:scale-98 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              Vincular Cuenta Google
            </button>
            <p className="text-[10px] text-slate-400 text-right max-w-[200px] leading-snug">
              Al vincularte aceptas nuestra <a href="/privacy-policy" target="_blank" className="underline font-semibold text-cyan-600 hover:text-cyan-700">Política de Privacidad</a> y los <a href="/terms-of-service" target="_blank" className="underline font-semibold text-cyan-600 hover:text-cyan-700">Términos de Servicio</a>.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-emerald-50/70 py-2 px-3 border border-emerald-100 rounded-xl">
            <div className="text-left shrink-0">
              <p className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wide">Vinculado</p>
              <p className="text-xs font-semibold text-emerald-950">{user?.email}</p>
            </div>
            <button
               onClick={handleLogout}
              className="p-1 px-2.5 bg-white border border-rose-200 text-rose-600 rounded-lg text-[10px] font-bold hover:bg-rose-50 cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          </div>
        )}
      </div>

      {/* Firebase Domain Authorization Instructions */}
      {loginError === 'auth/unauthorized-domain' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-3 shadow-xs"
        >
          <div className="flex items-center gap-2 font-extrabold text-amber-950 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            Dominio de Vista Previa No Autorizado en Firebase (auth/unauthorized-domain)
          </div>
          <div className="space-y-2 leading-relaxed">
            <p>
              Debido a las políticas de seguridad de Firebase Authentication, el dominio temporal de este contenedor de desarrollo debe agregarse manualmente a la lista de <strong>Dominios Autorizados</strong> de tu proyecto Firebase. De lo contrario, Google bloqueará el inicio de sesión emergente.
            </p>
            <p className="font-bold text-amber-950">
              Por favor, agrega los siguientes dominios a tu proyecto en la Consola de Firebase:
            </p>
            <div className="bg-white/80 p-3 rounded-xl border border-amber-200 font-mono text-[11px] text-slate-800 space-y-1 select-all shadow-inner">
              <div>{window.location.hostname}</div>
              <div>ais-dev-x7rub6qrgttl73kmnhy2wz-292657699751.us-west2.run.app</div>
              <div>ais-pre-x7rub6qrgttl73kmnhy2wz-292657699751.us-west2.run.app</div>
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="font-bold text-amber-950">Pasos para autorizarlos:</p>
              <ol className="list-decimal pl-4.5 space-y-1">
                <li>Ve a tu <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold text-amber-700 hover:text-amber-800">Consola de Firebase</a> y entra a tu proyecto escolar.</li>
                <li>En el menú de la izquierda, entra a <strong>Authentication</strong>.</li>
                <li>Selecciona la pestaña superior <strong>Settings</strong> (Configuración) y baja hasta la sección <strong>Authorized domains</strong> (Dominios autorizados).</li>
                <li>Haz clic en <strong>Add domain</strong> (Agregar dominio) y copia cada una de las direcciones de arriba.</li>
                <li>¡Listo! Regresa a esta pestaña y haz clic de nuevo en <strong>Vincular Cuenta Google</strong>.</li>
              </ol>
            </div>
          </div>
        </motion.div>
      )}

      {/* Google hasn't verified this app Bypass Instructions */}
      <motion.div 
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-5 bg-cyan-950/40 border border-cyan-800/60 rounded-2xl text-xs text-cyan-200 space-y-3 shadow-xs relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center gap-2 font-extrabold text-cyan-300 text-sm relative z-10">
          <AlertCircle className="w-5 h-5 text-cyan-400 shrink-0" />
          ¿Cómo solucionar la pantalla "Google hasn't verified this app"? (100% Seguro)
        </div>
        <div className="space-y-2 leading-relaxed text-slate-300 relative z-10 font-sans">
          <p>
            Al ser este un software de administración <strong>privado e interno</strong> desarrollado exclusivamente para Pacific Surf School, es completamente normal que Google muestre una pantalla de advertencia preventiva (ya que la escuela no requiere someter el software a una verificación pública masiva y costosa ante Google).
          </p>
          <p className="font-bold text-cyan-300">
            Sigue estos sencillos pasos para vincular tu cuenta con total seguridad:
          </p>
          <ol className="list-decimal pl-5 space-y-1 mt-1 text-slate-350">
            <li>En la ventana emergente de Google, haz clic en el enlace gris inferior que dice <strong className="text-white">"Advanced"</strong> (o <strong className="text-white font-semibold">"Configuración avanzada"</strong>).</li>
            <li>Se desplegará una sección adicional abajo. Haz clic en el enlace que dice <strong className="text-cyan-300 hover:underline">"Go to Pacific Surf School Manager (unsafe)"</strong> (o <strong className="text-cyan-300 hover:underline">"Ir a Pacific Surf School Manager (no seguro)"</strong>).</li>
            <li>Finalmente, presiona <strong className="text-white">"Continue"</strong> (o <strong className="text-white font-semibold">"Permitir"</strong>) para conceder los permisos de lectura y escritura en tus Hojas de Cálculo.</li>
          </ol>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sync Settings */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-150 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="font-extrabold text-slate-905 text-base font-display flex items-center gap-1.5">
              <Settings className="w-4.5 h-4.5 text-slate-400" />
              Configuración de Archivo Remoto
            </h3>
            
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Espacio de Almacenamiento (Spreadsheet ID o URL)</label>
              <input
                type="text"
                value={spreadsheetId}
                onChange={e => handleSpreadsheetIdChange(e.target.value)}
                placeholder="ID de la hoja de cálculo o URL..."
                className="w-full text-xs font-mono p-3 border border-slate-200 rounded-xl bg-slate-50/50 focus:bg-white outline-none focus:ring-1 focus:ring-emerald-500 transition-all text-slate-800"
              />
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                El sistema lee y escribe de forma remota este documento de Google Sheet para verificar instructores, agendas y egresos de caja escolar.
              </p>
            </div>

            <div className="pt-2">
              <a
                href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-emerald-600 font-bold hover:underline"
              >
                Ver documento en Sheets
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          <div className="border-t border-slate-150 pt-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Export and Import Actions */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-150 flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm font-display flex items-center gap-1.5">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    Sincronizar hacia Nube
                  </h4>
                  <p className="text-xs text-slate-405 mt-1 leading-relaxed">
                    Exporta toda la base actual del Pacific Surf School (alumnos, agendas reales, instructores registrados, deudas) directo al documento de Google Drive.
                  </p>
                </div>
                <button
                  disabled={needsAuth || isSyncing}
                  onClick={handleExportToSheets}
                  className="w-full bg-emerald-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-emerald-500 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 py-2.5 active:scale-98"
                >
                  {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Exportar a Sheets
                </button>
              </div>

              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-150 flex flex-col justify-between gap-4">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm font-display flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-blue-600" />
                    Traer Alumnos Registrados
                  </h4>
                  <p className="text-xs text-slate-405 mt-1 leading-relaxed">
                    Busca la lista física en la pestaña "Alumnos" del Sheets e importa nuevos matriculados que no existan localmente.
                  </p>
                </div>
                <button
                  disabled={needsAuth || isSyncing}
                  onClick={handleImportFromSheets}
                  className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-xl hover:bg-blue-500 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 py-2.5 active:scale-98"
                >
                  {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Importar de Sheets
                </button>
              </div>
            </div>

            {/* High Impact Full Restoration */}
            <div className="bg-orange-50/40 p-4 border border-orange-100 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h4 className="font-bold text-orange-950 text-sm font-display flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-orange-600" />
                  Restaurar Base de Datos Completa (Importación Destructiva)
                </h4>
                <p className="text-[11px] text-slate-500 max-w-xl leading-relaxed">
                  Borra todos los alumnos, clases, planes de alumnos e instructores locales e importa todo lo que tengas cargado en Google Sheets. Ideal para el arranque inicial en una máquina nueva.
                </p>
              </div>
              <button
                disabled={needsAuth || isSyncing}
                onClick={handleRestoreFullDatabase}
                className="shrink-0 font-bold text-xs bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white py-2.5 px-4 rounded-xl shadow-xs transition cursor-pointer active:scale-98 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Sobrescribir y Restaurar Todo
              </button>
            </div>
          </div>
        </div>

        {/* Sync logs console */}
        <div className="bg-white p-5 rounded-2xl border border-slate-150 flex flex-col justify-between gap-3 shadow-xs">
          <h3 className="font-extrabold text-slate-900 text-base font-display flex items-center gap-1.5 border-b border-slate-100 pb-2">
            <Terminal className="w-4.5 h-4.5 text-slate-400" />
            Consola de Sincronización
          </h3>
          
          <div className="flex-1 bg-slate-950 text-emerald-400 font-mono text-[10px] p-4 rounded-xl overflow-y-auto max-h-[300px] space-y-1.5 border border-slate-900 shadow-inner">
            {syncLogs.length === 0 ? (
              <span className="text-slate-600 italic">Esperando inicio de operación de red...</span>
            ) : (
              syncLogs.map((log, idx) => (
                <div key={idx} className="whitespace-pre-wrap leading-relaxed">{log}</div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
