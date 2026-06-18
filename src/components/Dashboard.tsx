import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  UserCheck, 
  Waves, 
  RefreshCw, 
  DollarSign, 
  AlertTriangle, 
  Calendar, 
  ChevronRight, 
  Clock, 
  TrendingUp, 
  Pocket,
  FileCheck
} from 'lucide-react';
import { StudentPackage, Student, Class, Instructor, Payment } from '../types';
import { getStudents, getStudentPackages, getClasses, getInstructors, getPayments } from '../services/db';
import { isBefore, addDays, parseISO, isToday, format } from 'date-fns';
import { getAccessToken, initAuth } from '../services/googleAuth';
import { syncFromGoogleSheets } from '../services/sheetsSync';
import StudentDossierModal from './StudentDossierModal';

export default function Dashboard({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [studentPackages, setStudentPackages] = useState<(StudentPackage & { studentName?: string })[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [classes, setClasses] = useState<Class[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDossierStudent, setSelectedDossierStudent] = useState<Student | null>(null);
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncMessage, setSyncMessage] = useState('');
  const [hasGoogleAuth, setHasGoogleAuth] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState(() => {
    return localStorage.getItem('spreadsheet_id') || '1OuuRJwIUwqEnfb9d_JMOsItxMDGwRAA231vRTO-diR8';
  });

  const fetchData = async () => {
    try {
      const [sData, spData, cData, iData, pData] = await Promise.all([
        getStudents(),
        getStudentPackages(),
        getClasses(),
        getInstructors(),
        getPayments()
      ]);
      
      const studs: Record<string, Student> = {};
      sData.forEach((s: Student) => {
        studs[s.id] = s;
      });
      setStudents(studs);
      
      setStudentPackages(spData);
      setClasses(cData);
      setInstructors(iData);
      setPayments(pData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSheetsSync = async (isAuto = false) => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const targetId = localStorage.getItem('spreadsheet_id') || spreadsheetId;
      const result = await syncFromGoogleSheets(targetId);
      if (result.success) {
        setSyncStatus('success');
        setSyncMessage(result.message);
        await fetchData();
      } else {
        setSyncStatus('error');
        setSyncMessage(result.message);
      }
    } catch (err: any) {
      setSyncStatus('error');
      setSyncMessage(err.message || 'Error de sincronización.');
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Check if we are authenticated and automatically sync sheets
    const unsubscribe = initAuth(
      (currentUser, token) => {
        if (token) {
          setHasGoogleAuth(true);
          setIsSyncing(true);
          syncFromGoogleSheets(spreadsheetId)
            .then(result => {
              if (result.success) {
                setSyncStatus('success');
                setSyncMessage(result.message);
                fetchData();
              } else {
                setSyncStatus('error');
                setSyncMessage(result.message);
              }
            })
            .catch(err => {
              setSyncStatus('error');
              setSyncMessage(err.message || 'Error al conectar.');
            })
            .finally(() => {
              setIsSyncing(false);
            });
        }
      },
      () => {
        setHasGoogleAuth(false);
      }
    );

    return () => unsubscribe();
  }, [spreadsheetId]);

  const today = new Date();
  const nextWeek = addDays(today, 7);

  // Indicators & Stat counters
  const totalStudentsCount = Object.keys(students).length;
  const instructorsCount = instructors.length;
  
  // Board necessity stat tracker (Si vs No own board)
  const studentsWithBoards = (Object.values(students) as Student[]).filter(s => s.hasBoard === 'Si').length;
  const studentsNeedingBoards = (Object.values(students) as Student[]).filter(s => s.hasBoard === 'No' || s.hasBoard === 'En proceso').length;

  // Upcoming alerts
  const lowClasses = studentPackages.filter(sp => sp.status === 'active' && (sp.totalClasses - sp.classesUsed) <= 2);
  const pendingPayments = studentPackages.filter(sp => sp.amountPaid < sp.totalPrice);
  const paymentsDueSoon = pendingPayments.filter(sp => {
    if (!sp.paymentDueDate) return false;
    try {
      const dueDate = parseISO(sp.paymentDueDate);
      return isBefore(dueDate, nextWeek);
    } catch (e) {
      return false;
    }
  });

  // Today's classes schedule
  const todaysClasses = classes.filter(cls => {
    try {
      return isToday(parseISO(cls.date));
    } catch (e) {
      return false;
    }
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Total earnings calculated from payments table
  const totalRecaudado = payments.reduce((sum, p) => sum + p.amount, 0);

  // Time-based greeting helper
  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return '¡Buenos días, Coach!';
    if (hours < 18) return '¡Buenas tardes, Tracker!';
    return '¡Buenas noches, Pacific Admin!';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div>
        <p className="text-xs text-slate-500 font-mono mt-3">Sincronizando base de datos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Header Section */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center p-6 bg-gradient-to-br from-slate-900 via-slate-850 to-blue-950 text-white rounded-2xl shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        <div className="absolute -bottom-10 left-10 w-44 h-44 bg-blue-600/10 rounded-full blur-[50px] pointer-events-none"></div>
        
        <div className="relative z-10 space-y-1">
          <span className="text-[10px] font-bold uppercase font-mono tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2.5 py-1 rounded-md">
            Soporte de Marea Sincronizado
          </span>
          <h2 className="text-2.5xl font-extrabold font-display tracking-tight text-white mt-2">
            {getGreeting()}
          </h2>
          <p className="text-sm text-slate-400 max-w-xl">
            Monitorea el inventario de tablas, finanzas, paquetes y las reservas diarias de Pacific Surf School.
          </p>
        </div>

        {/* Real-time Google Sheets database sync control bar */}
        <div className="mt-4 lg:mt-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl text-sm relative z-10 w-full lg:w-auto">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasGoogleAuth ? 'bg-emerald-400' : 'bg-slate-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${hasGoogleAuth ? 'bg-emerald-500' : 'bg-slate-500'}`}></span>
            </span>
            <div>
              <p className="font-bold text-slate-200 text-xs">
                {hasGoogleAuth ? 'Google Sheets En Línea' : 'SQLite Local Modos'}
              </p>
              <p className="text-slate-500 font-mono text-[9px] truncate max-w-[180px] mt-0.5">
                ID: {spreadsheetId}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0">
            {hasGoogleAuth ? (
              <button
                disabled={isSyncing}
                onClick={() => handleSheetsSync(false)}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/60 text-emerald-400 hover:text-emerald-300 px-3 py-2 rounded-lg text-[11px] font-bold cursor-pointer transition disabled:opacity-50 shadow-sm"
              >
                {isSyncing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                Sincronizar Sheets
              </button>
            ) : (
              <button
                onClick={() => onNavigate?.('sheets')}
                className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-3.5 py-2.5 rounded-xl text-xs cursor-pointer transition shadow-lg shadow-cyan-500/10 hover:translate-y-[-0.5px]"
              >
                Vincular Google Sheets
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sync output message status banner */}
      {syncMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl border text-sm flex items-start gap-3 shadow-md ${
            syncStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className={`p-1.5 rounded-lg ${syncStatus === 'success' ? 'bg-emerald-200/50' : 'bg-rose-200/50'}`}>
            <RefreshCw className={`w-4 h-4 ${syncStatus === 'success' ? 'text-emerald-700' : 'text-rose-700'}`} />
          </div>
          <div className="flex-1">
            <p className="font-bold font-display">{syncStatus === 'success' ? 'Sincronizado Exitosamente' : 'Fallo de Sincronización'}</p>
            <p className="text-xs opacity-90 mt-0.5">{syncMessage}</p>
          </div>
          <button 
            onClick={() => setSyncMessage('')} 
            className="text-xs font-bold uppercase tracking-wider hover:opacity-75 transition-opacity cursor-pointer self-center px-2 py-1 border border-black/10 rounded bg-black/5"
          >
            OK
          </button>
        </motion.div>
      )}
      
      {/* MAIN METRIC SCOREBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <motion.div 
          whileHover={{ y: -4, shadow: "0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -2px rgba(16, 185, 129, 0.05)" }}
          onClick={() => onNavigate?.('payments')}
          className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-emerald-200 cursor-pointer transition-all flex items-center justify-between shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Recaudado Caja</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-display">S/. {totalRecaudado.toFixed(2)}</span>
            <span className="text-[11px] text-emerald-600 hover:text-emerald-700 font-semibold inline-flex items-center gap-0.5">Registros de cobro <ChevronRight className="w-3 h-3" /></span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-base border border-emerald-100 relative z-10 shadow-xs">
            S/.
          </div>
        </motion.div>

        {/* Total Students */}
        <motion.div 
          whileHover={{ y: -4, shadow: "0 10px 15px -3px rgba(59, 130, 246, 0.1), 0 4px 6px -2px rgba(59, 130, 246, 0.05)" }}
          onClick={() => onNavigate?.('students')}
          className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-blue-200 cursor-pointer transition-all flex items-center justify-between shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Alumnos Activos</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-display">{totalStudentsCount} surfers</span>
            <span className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-0.5">Ver directorio <ChevronRight className="w-3 h-3" /></span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 relative z-10 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Board usage distribution stats */}
        <motion.div 
          whileHover={{ y: -4, shadow: "0 10px 15px -3px rgba(6, 182, 212, 0.1), 0 4px 6px -2px rgba(6, 182, 212, 0.05)" }}
          onClick={() => onNavigate?.('students')}
          className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-cyan-200 cursor-pointer transition-all flex items-center justify-between shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Tablas de Escuela</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-display">
              {studentsNeedingBoards} / {totalStudentsCount}
            </span>
            <span className="text-[11px] text-cyan-600 hover:text-cyan-700 font-semibold inline-flex items-center gap-0.5">Precisan tablas <ChevronRight className="w-3 h-3" /></span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center border border-cyan-100 relative z-10 shadow-xs">
            <Waves className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Instructors Staff Count */}
        <motion.div 
          whileHover={{ y: -4, shadow: "0 10px 15px -3px rgba(139, 92, 246, 0.1), 0 4px 6px -2px rgba(139, 92, 246, 0.05)" }}
          onClick={() => onNavigate?.('instructors')}
          className="bg-white p-5 rounded-2xl border border-slate-100 hover:border-violet-200 cursor-pointer transition-all flex items-center justify-between shadow-xs relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="space-y-1 relative z-10">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono">Staff Coaches</span>
            <span className="text-2xl font-black text-slate-900 mt-1 block font-display">{instructorsCount} Coaches</span>
            <span className="text-[11px] text-violet-600 hover:text-violet-700 font-semibold inline-flex items-center gap-0.5">Coordinar staff <ChevronRight className="w-3 h-3" /></span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center border border-violet-100 relative z-10 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* THREE SPECIAL NOTIFICATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Clases por Agotarse Indicator */}
        <div 
          onClick={() => onNavigate?.('classes')}
          className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-orange-500 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Clases por Extinguirse</h3>
            <span className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">{lowClasses.length} Alertas</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3.5xl font-extrabold text-orange-600 font-display">{lowClasses.length}</span>
            <span className="text-xs text-slate-400">surfers</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Alumnos activos con ≤ 2 clases disponibles</p>
        </div>

        {/* Pending Payments Indicator */}
        <div 
          onClick={() => onNavigate?.('payments')}
          className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Saldos de Paquete</h3>
            <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">{pendingPayments.length} Deudores</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3.5xl font-extrabold text-rose-600 font-display">{pendingPayments.length}</span>
            <span className="text-xs text-slate-400">matrículas</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Estudiantes con saldos parciales por cobrar</p>
        </div>

        {/* Payments Due Soon */}
        <div 
          onClick={() => onNavigate?.('payments')}
          className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500 cursor-pointer hover:shadow-md transition-shadow relative overflow-hidden"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Cobranzas Críticas</h3>
            <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider font-mono">{paymentsDueSoon.length} Próximos</span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3.5xl font-extrabold text-amber-600 font-display">{paymentsDueSoon.length}</span>
            <span className="text-xs text-slate-400">vencimientos</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">Límites de deudor vencidos o a expirar en 7 días</p>
        </div>
      </div>

      {/* AGENDA DE HOY Y REPORTES RAPIDOS DE SISTEMA */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Today's Classes Agenda Widget - CRITICAL FOR SURF SCHOOLS */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 col-span-1 lg:col-span-2 flex flex-col justify-between overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row gap-3 justify-between sm:items-center">
            <div>
              <h3 className="text-base font-bold text-slate-800 font-display">Clases del Día / Agenda de Hoy</h3>
              <p className="text-xs text-slate-400">Asistencia y cronograma de instructores para la fecha actual</p>
            </div>
            <button 
              onClick={() => onNavigate?.('classes')} 
              className="text-xs bg-white text-blue-600 border border-slate-200 hover:border-blue-500 hover:bg-blue-50 px-3 py-2 rounded-lg font-bold transition flex items-center gap-1.5 self-start cursor-pointer shadow-xs"
            >
              <Calendar className="w-3.5 h-3.5" />
              Gestión de Agenda
            </button>
          </div>
          
          <div className="p-6 flex-1 max-h-[360px] overflow-y-auto">
            {todaysClasses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="text-4xl">🌊</span>
                <p className="text-sm font-semibold text-slate-500 mt-3 font-display">No hay clases programadas para hoy</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">Aprovecha el tiempo para mantenimiento de tablas o sincronización de planillas.</p>
                <button 
                  onClick={() => onNavigate?.('classes')}
                  className="mt-4 text-xs font-bold text-blue-600 hover:text-blue-500 bg-blue-50 hover:bg-blue-100/80 px-3 py-1.5 rounded-lg transition"
                >
                  + Agendar una Clase
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {todaysClasses.map(cls => {
                  let clsTime = cls.date;
                  try {
                    clsTime = format(parseISO(cls.date), 'HH:mm');
                  } catch (e) {}

                  const needBoard = students[cls.studentId]?.hasBoard !== 'Si';

                  return (
                    <div 
                      key={cls.id} 
                      onClick={() => {
                        const stud = students[cls.studentId];
                        if (stud) setSelectedDossierStudent(stud);
                      }}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 hover:bg-cyan-50/40 hover:border-cyan-200 rounded-xl border border-slate-100 transition duration-150 gap-3 cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-extrabold font-mono text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg shrink-0">
                          {clsTime} hrs
                        </span>
                        <div>
                          <p className="font-bold text-slate-900 text-sm font-display">{students[cls.studentId]?.name || 'Desconocido'}</p>
                          <p className="text-xs text-slate-450 font-medium">Coach: {instructors.find(i => i.id === cls.instructorId)?.name || 'Sin coach asignado'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end shrink-0">
                        {/* Board status banner */}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase font-mono ${
                          !needBoard 
                            ? 'bg-emerald-105 text-emerald-800 border border-emerald-200' 
                            : 'bg-orange-105 text-orange-850 border border-orange-200'
                        }`} title="¿Tiene tabla de surf propia?">
                          {!needBoard ? 'Tabla Propia' : 'Usa Escuela'}
                        </span>
                        
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase font-mono ${
                          cls.status === 'scheduled' ? 'bg-cyan-50 text-cyan-800 border border-cyan-100' :
                          cls.status === 'completed' ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 
                          'bg-slate-200 text-slate-600'
                        }`}>
                          {cls.status === 'scheduled' ? 'Pte' : cls.status === 'completed' ? 'Ok' : 'Canc'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick Staff Contacts and Directory summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 col-span-1 flex flex-col justify-between overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-800 font-display">Coaches Autorizados</h3>
            <p className="text-xs text-slate-400">Coordinación de instructores en la base</p>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto max-h-[300px] divide-y divide-slate-100">
            {instructors.map(coach => (
              <div key={coach.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-blue-200/50">
                    {coach.name[0]}
                  </div>
                  <div className="truncate max-w-[130px]">
                    <h4 className="text-xs font-bold text-slate-900 truncate font-display">{coach.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono tracking-wide">ID: {coach.id}</span>
                  </div>
                </div>
                {coach.phone ? (
                  <a 
                    href={`tel:${coach.phone}`}
                    className="text-xs text-blue-600 bg-blue-50 border border-blue-100/65 px-2.5 py-1 rounded-lg font-bold hover:bg-blue-100 hover:underline flex items-center gap-1 transition"
                  >
                    📞 {coach.phone}
                  </a>
                ) : (
                  <span className="text-[10px] text-slate-400 italic">Sin teléfono</span>
                )}
              </div>
            ))}
            {instructors.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">No hay instructores de surf registrados.</p>
            )}
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50/40 text-center">
            <button 
              onClick={() => onNavigate?.('instructors')}
              className="text-xs text-blue-600 hover:text-blue-500 font-bold hover:underline cursor-pointer"
            >
              Administrar Directorio Instructores →
            </button>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Detailed Alerts List block */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Detalle Alertas: Clases por Agotarse</h3>
            <button onClick={() => onNavigate?.('classes')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">Ver todas</button>
          </div>
          <ul className="divide-y divide-slate-150 max-h-72 overflow-y-auto">
            {lowClasses.length === 0 ? (
              <li className="px-6 py-8 text-slate-400 text-xs italic bg-slate-50/30 text-center">No hay alumnos con pocas clases.</li>
            ) : (
              lowClasses.map(sp => (
                <li 
                  key={sp.id} 
                  className="px-6 py-4 flex justify-between items-center hover:bg-cyan-50/30 cursor-pointer transition"
                  onClick={() => {
                    const stud = students[sp.studentId];
                    if (stud) setSelectedDossierStudent(stud);
                  }}
                >
                  <div className="truncate pr-4">
                    <p className="font-bold text-slate-900 text-sm font-display truncate">{students[sp.studentId]?.name || 'Pasajero no registrado'}</p>
                    <p className="text-xs text-slate-400 truncate">{sp.packageName || 'Plan Estándar'}</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-orange-50 border border-orange-100 text-orange-850 shrink-0 uppercase tracking-wide font-mono text-[10px]">
                    Quedan {sp.totalClasses - sp.classesUsed} clases
                  </span>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Pending Payments detailed list block */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/20 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono">Detalle Alertas: Saldos Pendientes (Cobranza)</h3>
            <button onClick={() => onNavigate?.('payments')} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">Gestionar pagos</button>
          </div>
          <ul className="divide-y divide-slate-150 max-h-72 overflow-y-auto">
            {pendingPayments.length === 0 ? (
              <li className="px-6 py-8 text-slate-400 text-xs italic bg-slate-50/30 text-center">Todos los saldos abonados están al día.</li>
            ) : (
              pendingPayments.map(sp => {
                const isDue = sp.paymentDueDate && isBefore(parseISO(sp.paymentDueDate), today);
                return (
                  <li 
                    key={sp.id} 
                    className="px-6 py-4 flex justify-between items-center hover:bg-cyan-50/30 cursor-pointer transition"
                    onClick={() => {
                      const stud = students[sp.studentId];
                      if (stud) setSelectedDossierStudent(stud);
                    }}
                  >
                    <div className="pr-4 truncate">
                      <p className="font-bold text-slate-900 text-sm font-display truncate">{students[sp.studentId]?.name || 'Alumno pendiente'}</p>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">Deuda: <span className="font-bold text-red-650">S/. {sp.totalPrice - sp.amountPaid}</span></p>
                      {sp.paymentDueDate && (
                        <p className={`text-[10px] mt-0.5 ${isDue ? 'text-red-600 font-bold' : 'text-slate-450'}`}>
                          Límite: {sp.paymentDueDate} {isDue ? '⚠️ ATRASADO' : ''}
                        </p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] uppercase font-bold font-mono tracking-wider shrink-0 ${
                      isDue ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-amber-50 border border-amber-100 text-amber-700'
                    }`}>
                      {isDue ? 'Atrasado' : 'Pendiente'}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </div>

      {selectedDossierStudent && (
        <StudentDossierModal
          student={selectedDossierStudent}
          isOpen={!!selectedDossierStudent}
          onClose={() => setSelectedDossierStudent(null)}
          onDataChanged={fetchData}
        />
      )}
    </div>
  );
}
