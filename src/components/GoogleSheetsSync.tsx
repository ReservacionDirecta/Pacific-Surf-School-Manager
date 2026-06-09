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
import { getStudents, getInstructors, getClasses, getStudentPackages, addStudent, addStudentPackage, getPackages, getPayments } from '../services/db';
import { User } from 'firebase/auth';

const DEFAULT_SPREADSHEET_ID = '1OuuRJwIUwqEnfb9d_JMOsItxMDGwRAA231vRTO-diR8';

export default function GoogleSheetsSync() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
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
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        addLog('Conectado a Google con éxito.');
      }
    } catch (err) {
      console.error('Login failed:', err);
      addLog('Error al iniciar sesión con Google.');
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
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${targetId}/values/${range}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ values })
    });
    if (!res.ok) {
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
      const sheetNames = ['Alumnos', 'Instructores', 'Clases', 'Paquetes de Alumnos'];
      await ensureSheetsExist(activeToken, spreadsheetId, sheetNames);

      const [alumnos, instructores, clases, studentPkgs] = await Promise.all([
        getStudents(),
        getInstructors(),
        getClasses(),
        getStudentPackages()
      ]);

      // 1. Export Alumnos
      addLog(`Exportando ${alumnos.length} Alumnos...`);
      const alumnosValues = [
        ['ID', 'Nombre', 'Email', 'Telefono', 'Fecha Registro', 'Nivel'],
        ...alumnos.map(a => [a.id, a.name, a.email || '', a.phone || '', a.createdAt || '', a.level || 'principiante'])
      ];
      await writeSheetData(activeToken, spreadsheetId, 'Alumnos!A1:F2000', alumnosValues);

      // 2. Export Instructores
      addLog(`Exportando ${instructores.length} Instructores...`);
      const instValues = [
        ['ID', 'Nombre', 'Email', 'Telefono'],
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
      addLog(`Exportando ${studentPkgs.length} Paquetes Comprados...`);
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
    addLog('Iniciando importación desde pestaña "Alumnos" de Google Sheets...');

    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Alumnos!A1:Z1000`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${activeToken}` } });
      
      if (!res.ok) {
        throw new Error('No se pudo acceder a la pestaña "Alumnos" del Sheets.');
      }

      const data = await res.json();
      const rows = data.values || [];

      if (rows.length < 2) {
        addLog('No se encontraron registros de alumnos para importar.');
        setIsSyncing(false);
        return;
      }

      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      const nameIdx = headers.indexOf('nombre');
      const emailIdx = headers.indexOf('email');
      const phoneIdx = headers.indexOf('telefono');
      const levelIdx = headers.indexOf('nivel');

      const existingStudents = await getStudents();
      const existingIds = new Set(existingStudents.map(s => s.id));
      const allPkgs = await getPackages();
      const firstPkg = allPkgs[0];

      let importCount = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rawId = row[idIdx];
        const name = row[nameIdx];
        
        if (!name) continue;

        const id = rawId || `sheet-import-${Date.now()}-${i}`;

        if (!existingIds.has(id)) {
          addLog(`Registrando Alumno: ${name}...`);
          const newStudentRef = await addStudent({
            name,
            email: row[emailIdx] || '',
            phone: row[phoneIdx] || '',
            enrollmentDate: new Date().toISOString()
          });

          if (newStudentRef && firstPkg && firstPkg.id) {
            const createdStudentId = newStudentRef.id || id;
            await addStudentPackage({
              studentId: createdStudentId,
              packageId: firstPkg.id,
              packageName: firstPkg.name,
              classesUsed: 0,
              totalClasses: firstPkg.totalClasses,
              totalPrice: firstPkg.price,
              amountPaid: firstPkg.price, // Consider fully paid or customize
              status: 'active'
            });
          }

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
      const studentsRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Alumnos!A1:F2000`, {
        headers: { Authorization: `Bearer ${activeToken}` }
      });
      const studentsData = studentsRes.ok ? await studentsRes.json() : null;
      const studentsRows = studentsData?.values || [];
      
      const parsedStudents = [];
      if (studentsRows.length >= 2) {
        const headers = studentsRows[0].map((h: string) => h.trim().toLowerCase());
        const idIdx = headers.indexOf('id');
        const nameIdx = headers.indexOf('nombre');
        const emailIdx = headers.indexOf('email');
        const phoneIdx = headers.indexOf('telefono');
        const enrollIdx = headers.indexOf('fecha registro') !== -1 ? headers.indexOf('fecha registro') : headers.indexOf('enrollmentdate');
        
        for (let i = 1; i < studentsRows.length; i++) {
          const row = studentsRows[i];
          const name = row[nameIdx];
          if (!name) continue;
          parsedStudents.push({
            id: row[idIdx] || `student-${Date.now()}-${i}`,
            name,
            email: row[emailIdx] || '',
            phone: row[phoneIdx] || '',
            enrollmentDate: row[enrollIdx] || new Date().toISOString()
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
        const phoneIdx = headers.indexOf('telefono');
        
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
            packageName: row[packageNameIdx] || 'Paquete',
            totalClasses: Number(row[totalClassesIdx]) || 1,
            classesUsed: Number(row[classesUsedIdx]) || 0,
            totalPrice: Number(row[totalPriceIdx]) || 0,
            amountPaid: Number(row[amountPaidIdx]) || 0,
            paymentDueDate: row[paymentDueDateIdx] || '',
            status: row[statusIdx] || 'active'
          });
        }
      }
      addLog(`Se leyeron ${parsedStudentPackages.length} paquetes de alumnos.`);

      // 5. Gather current local packages and payments to avoid dropping them
      addLog('Consultando paquetes y pagos locales...');
      const [currentPkgs, currentPayments] = await Promise.all([
        getPackages(),
        getPayments().catch(() => [])
      ]);

      // 6. Overwrite the database
      addLog('Enviando datos combinados a SQLite para sobrescribir base de datos local...');
      const syncRes = await fetch('/api/sync/overwrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students: parsedStudents,
          instructors: parsedInstructors,
          packages: currentPkgs,
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
          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-650 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer text-xs transition active:scale-98 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            Vincular Cuenta Google
          </button>
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
                  Borra todos los alumnos, clases, paquetes de alumnos e instructores locales e importa todo lo que tengas cargado en Google Sheets. Ideal para el arranque inicial en una máquina nueva.
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
