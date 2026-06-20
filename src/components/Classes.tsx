import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Search, 
  SlidersHorizontal, 
  CheckCircle, 
  X, 
  Trash2, 
  FileCheck, 
  Sliders, 
  Clock, 
  User, 
  BookOpen, 
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { Class, Student, Instructor, StudentPackage, Equipment } from '../types';
import { addClass, updateClass, deleteClass, updateStudentPackage, getClasses, getStudents, getInstructors, getStudentPackages, getEquipment } from '../services/db';
import { format, parseISO, isToday, isTomorrow, isAfter, startOfDay } from 'date-fns';
import { getAccessToken, initAuth } from '../services/googleAuth';

interface GoogleSheetClass {
  id: string;
  date: string;
  studentId: string;
  instructorId: string;
  status: string;
}

export default function Classes({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [instructors, setInstructors] = useState<Record<string, Instructor>>({});
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Tab selector between local Classes and Live Sheet History
  const [currentTab, setCurrentTab] = useState<'system' | 'sheets'>('system');
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [sheetsClasses, setSheetsClasses] = useState<GoogleSheetClass[]>([]);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);

  useEffect(() => {
    const targetStudentId = localStorage.getItem('open_schedule_class_for_student_id');
    if (targetStudentId && Object.keys(students).length > 0) {
      setStudentId(targetStudentId);
      setShowAddModal(true);
      setDate(new Date().toISOString().substring(0, 16));
      localStorage.removeItem('open_schedule_class_for_student_id');
    }
  }, [students]);

  // Form state
  const [date, setDate] = useState('');
  const [studentId, setStudentId] = useState('');
  const [instructorId, setInstructorId] = useState('');
  const [formBoardId, setFormBoardId] = useState('');
  const [formWetsuitId, setFormWetsuitId] = useState('');
  const [formLycraId, setFormLycraId] = useState('');
  const [selectedStudentPackage, setSelectedStudentPackage] = useState<StudentPackage | null>(null);

  // Filter state
  const [filterStudent, setFilterStudent] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'agenda'>('list');
  // Sort state
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const fetchData = async () => {
    try {
      const [cData, sData, iData, spData, eqData] = await Promise.all([
        getClasses(),
        getStudents(),
        getInstructors(),
        getStudentPackages(),
        getEquipment()
      ]);
      
      setClasses(cData.sort((a: Class, b: Class) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      setStudentPackages(spData);
      setEquipment(eqData.filter((e: Equipment) => e.status === 'Disponible'));
      
      const studs: Record<string, Student> = {};
      sData.forEach((s: Student) => { studs[s.id] = s; });
      setStudents(studs);
      
      const insts: Record<string, Instructor> = {};
      iData.forEach((i: Instructor) => { insts[i.id] = i; });
      setInstructors(insts);
    } catch (error) {
      console.error("Error fetching classes data:", error);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Auth token sync
    const unsubscribe = initAuth((currentUser, currentToken) => {
      setGoogleToken(currentToken);
    }, () => {
      setGoogleToken(null);
    });
    return () => unsubscribe();
  }, []);

  // Sync Google Sheets class history live
  const fetchLiveSheetsClasses = async () => {
    const token = googleToken || await getAccessToken();
    if (!token) {
      setSheetsError("No autenticado. Por favor, vincula con Google Sheets en la sección 'Sincronizar Sheets' primero.");
      return;
    }

    setLoadingSheets(true);
    setSheetsError(null);
    try {
      const spreadsheetId = localStorage.getItem('spreadsheet_id') || '1OuuRJwIUwqEnfb9d_JMOsItxMDGwRAA231vRTO-diR8';
      const range = 'Clases!A1:Z1000';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error(`Error en respuesta (${res.status}). Verifica el ID de la hoja de cálculo.`);
      }

      const data = await res.json();
      const rows = data.values || [];

      if (rows.length < 2) {
        setSheetsClasses([]);
        return;
      }

      // Headers: ID, Fecha, Alumno ID, Instructor ID, Estado
      const headers = rows[0].map((h: string) => h.trim().toLowerCase());
      const idIdx = headers.indexOf('id');
      const dateIdx = headers.indexOf('fecha');
      const studentIdx = headers.indexOf('alumno id');
      const instIdx = headers.indexOf('instructor id');
      const statusIdx = headers.indexOf('estado');

      const parsed: GoogleSheetClass[] = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[idIdx]) continue;
        parsed.push({
          id: row[idIdx] || '',
          date: row[dateIdx] || '',
          studentId: row[studentIdx] || '',
          instructorId: row[instIdx] || '',
          status: row[statusIdx] || 'scheduled'
        });
      }

      // Sort by date descending
      parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setSheetsClasses(parsed);
    } catch (err: any) {
      console.error(err);
      setSheetsError(`No se pudo leer la tabla de "Clases" en Google Sheets. Error: ${err.message}`);
    } finally {
      setLoadingSheets(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'sheets' && googleToken) {
      fetchLiveSheetsClasses();
    }
  }, [currentTab, googleToken]);

  // Monitor selected student's active package when scheduling
  useEffect(() => {
    if (studentId) {
      const active = studentPackages.find(sp => sp.studentId === studentId && sp.status === 'active');
      setSelectedStudentPackage(active || null);
    } else {
      setSelectedStudentPackage(null);
    }
  }, [studentId, studentPackages]);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addClass({
        date: new Date(date).toISOString(),
        studentId,
        instructorId,
        status: 'scheduled',
        boardId: formBoardId || undefined,
        wetsuitId: formWetsuitId || undefined,
        lycraId: formLycraId || undefined
      });
      await fetchData();
      setShowAddModal(false);
      setDate('');
      setStudentId('');
      setInstructorId('');
      setFormBoardId('');
      setFormWetsuitId('');
      setFormLycraId('');
    } catch (error) {
      console.error("Error adding class:", error);
      alert("Error al agendar clase");
    }
  };

  const handleStatusChange = async (cls: Class, newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    try {
      const oldStatus = cls.status;
      await updateClass(cls.id!, { status: newStatus });

      // Logic to connect with student packages
      if (newStatus === 'completed' && oldStatus !== 'completed') {
        // Increment classes used
        await adjustStudentClasses(cls.studentId, 1);
      } else if (oldStatus === 'completed' && newStatus !== 'completed') {
        // Decrement classes used (revert)
        await adjustStudentClasses(cls.studentId, -1);
      }
      
      await fetchData();
    } catch (error) {
      console.error("Error updating class status:", error);
      alert("Error al actualizar estado");
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!window.confirm('¿Estás seguro de eliminar esta clase?')) return;
    
    try {
      if (cls.status === 'completed') {
        await adjustStudentClasses(cls.studentId, -1);
      }
      await deleteClass(cls.id!);
      await fetchData();
    } catch (error) {
      console.error("Error deleting class:", error);
      alert("Error al eliminar clase");
    }
  };

  const adjustStudentClasses = async (studentId: string, amount: number) => {
    const allSP = await getStudentPackages();
    const activeSP = allSP.find((sp: StudentPackage) => sp.studentId === studentId && sp.status === 'active');
    
    if (activeSP) {
      const newUsed = Math.max(0, activeSP.classesUsed + amount);
      const updateData: Partial<StudentPackage> = { classesUsed: newUsed };
      
      if (newUsed >= activeSP.totalClasses) {
        updateData.status = 'exhausted';
      }
      
      await updateStudentPackage(activeSP.id, updateData);
    }
  };

  // Sort handler
  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline-block opacity-30 group-hover:opacity-100" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 inline-block text-cyan-600" />
      : <ArrowDown className="w-3 h-3 ml-1 inline-block text-cyan-600" />;
  };

  // Filter + Sort rows
  const filteredSystemClasses = classes
    .filter(cls => {
      const studentName = students[cls.studentId]?.name || '';
      const matchesStudent = studentName.toLowerCase().includes(filterStudent.toLowerCase());
      const matchesStatus = filterStatus === 'all' || cls.status === filterStatus;
      return matchesStudent && matchesStatus;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      let cmp = 0;
      if (sortKey === 'date') {
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortKey === 'student') {
        cmp = (students[a.studentId]?.name || '').localeCompare(students[b.studentId]?.name || '');
      } else if (sortKey === 'instructor') {
        cmp = (instructors[a.instructorId]?.name || '').localeCompare(instructors[b.instructorId]?.name || '');
      } else if (sortKey === 'status') {
        cmp = a.status.localeCompare(b.status);
      }
      return cmp * dir;
    });

  const filteredSheetsClasses = sheetsClasses.filter(cls => {
    const studentName = students[cls.studentId]?.name || cls.studentId || '';
    const matchesStudent = studentName.toLowerCase().includes(filterStudent.toLowerCase());
    const matchesStatus = filterStatus === 'all' || cls.status === filterStatus;
    return matchesStudent && matchesStatus;
  });

  // Group classes into Agenda days
  const getGroupedClasses = () => {
    const groups: Record<string, Class[]> = {
      'Hoy': [],
      'Mañana': [],
      'Próximas Clases': []
    };

    filteredSystemClasses.forEach(cls => {
      try {
        const clsDate = parseISO(cls.date);
        if (isToday(clsDate)) {
          groups['Hoy'].push(cls);
        } else if (isTomorrow(clsDate)) {
          groups['Mañana'].push(cls);
        } else if (isAfter(clsDate, startOfDay(new Date()))) {
          groups['Próximas Clases'].push(cls);
        }
      } catch (e) {
        // handle invalid date parse gracefully
      }
    });

    return groups;
  };

  const groupedAgenda = getGroupedClasses();

  return (
    <div className="space-y-6">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col md:flex-row justify-between md:items-center p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 rounded-2xl shadow-md border border-slate-700 gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-1">
            <Calendar className="w-4 h-4 text-cyan-400" /> Agenda de Clases
          </div>
          <h2 className="text-2xl font-extrabold font-display text-white tracking-tight">Control de Sesiones</h2>
          <p className="text-sm text-slate-300">Coordinación en tiempo real de instructores, asistencia de alumnos y sincronización.</p>
        </div>

        {/* Tab switcher tabs */}
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 text-xs select-none self-start relative z-10">
          <button
            onClick={() => setCurrentTab('system')}
            className={`px-4 py-2.5 rounded-lg font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'system' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Clases en Sistema (SQLite)
          </button>
          <button
            onClick={() => setCurrentTab('sheets')}
            className={`px-4 py-2.5 rounded-lg font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'sheets' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            Google Sheets Live
          </button>
        </div>
      </div>

      {/* Action panel & Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-150 space-y-4">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-stretch md:items-end">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">Buscar por Alumno</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-450">
                  <Search className="w-4 h-4" />
                </span>
                <input 
                  type="text" 
                    placeholder="Buscar alumno..."
                  value={filterStudent}
                  onChange={e => setFilterStudent(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 text-slate-800 pl-9 pr-4 py-2 sm:text-xs focus:border-cyan-500 outline-none transition bg-slate-50/50 focus:bg-white"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono mb-1.5">Filtrar por Estado</label>
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-slate-700 bg-white px-3.5 py-2.5 sm:text-xs focus:border-cyan-500 outline-none transition"
              >
                <option value="all">Todos los Estados</option>
                <option value="scheduled">Agendadas / Reservas</option>
                <option value="completed">Completadas (Resta saldo)</option>
                <option value="cancelled">Canceladas (No resta saldo)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end items-center shrink-0">
            {currentTab === 'system' && (
              <>
                <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 text-[11px]">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      viewMode === 'list' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                    }`}
                  >
                    Tabla Lista
                  </button>
                  <button
                    onClick={() => setViewMode('agenda')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      viewMode === 'agenda' ? 'bg-blue-600 text-white shadow' : 'text-slate-400'
                    }`}
                  >
                    Vista Agenda
                  </button>
                </div>
                <button 
                  onClick={() => setShowAddModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md cursor-pointer transition active:scale-98 flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  Reservar Clase
                </button>
              </>
            )}

            {currentTab === 'sheets' && (
              <button 
                onClick={fetchLiveSheetsClasses}
                disabled={loadingSheets}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md cursor-pointer transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <RefreshCw className={`w-4 h-4 ${loadingSheets ? 'animate-spin' : ''}`} />
                Refrescar Sheets
              </button>
            )}
          </div>
        </div>
      </div>

      {currentTab === 'system' ? (
        viewMode === 'list' ? (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-150">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none group" onClick={() => handleSort('date')}>
                    Fecha y Hora <SortIcon col="date" />
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none group" onClick={() => handleSort('student')}>
                    Alumno <SortIcon col="student" />
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none group" onClick={() => handleSort('instructor')}>
                    Instructor Autorizado <SortIcon col="instructor" />
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none group" onClick={() => handleSort('status')}>
                    Estado <SortIcon col="status" />
                  </th>
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Control / Eliminar</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-150">
                {filteredSystemClasses.map(cls => (
                  <tr key={cls.id} className="hover:bg-slate-50/55 transition duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 font-display">
                      {format(parseISO(cls.date), 'dd/MM/yyyy HH:mm')} hrs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-850 font-display">{students[cls.studentId]?.name || 'Pasajero no registrado'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {cls.studentId}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-600 font-medium">{instructors[cls.instructorId]?.name || 'Instructor independiente'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase font-mono border
                        ${cls.status === 'scheduled' ? 'bg-cyan-50 border-cyan-150 text-cyan-800' : 
                          cls.status === 'completed' ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 
                          'bg-rose-50 border-rose-150 text-rose-800'}`}>
                        {cls.status === 'scheduled' ? 'Agendada' : cls.status === 'completed' ? 'Págalo' : 'Canc.'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold flex items-center justify-end gap-3">
                      <select 
                        value={cls.status}
                        onChange={(e) => handleStatusChange(cls, e.target.value as any)}
                        className="rounded-xl border border-slate-205 text-slate-700 bg-white px-2.5 py-1.5 sm:text-[11px] focus:ring-1 focus:ring-cyan-500 outline-none font-medium"
                      >
                        <option value="scheduled">Agendada</option>
                        <option value="completed">Completada</option>
                        <option value="cancelled">Cancelada</option>
                      </select>
                      <button 
                        onClick={() => handleDeleteClass(cls)}
                        className="text-red-400 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 cursor-pointer transition-colors"
                        title="Eliminar clase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredSystemClasses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 bg-slate-50/50 italic">
                      No se encontraron clases agendadas con los criterios definidos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grouped Agenda View */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.keys(groupedAgenda).map(day => (
              <div key={day} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-150 space-y-4 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-extrabold text-slate-900 text-base font-display">{day}</h3>
                    <span className="bg-blue-50 border border-blue-100 text-blue-700 text-[10px] uppercase font-mono px-2 py-0.5 rounded-full font-bold">
                      {groupedAgenda[day].length} clases
                    </span>
                  </div>
                  
                  <div className="space-y-3 max-h-[450px] overflow-y-auto">
                    {groupedAgenda[day].map(cls => (
                      <div key={cls.id} className="p-4 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-100 relative group flex flex-col justify-between transition-all duration-150">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="text-[11px] font-bold font-mono text-blue-600 flex items-center gap-1">
                              <Clock className="w-3 h-3 inline-block" />
                              {format(parseISO(cls.date), 'HH:mm')} hrs
                            </p>
                            <h4 className="text-sm font-bold text-slate-900 mt-1.5 font-display">{students[cls.studentId]?.name || 'Desconocido'}</h4>
                            <p className="text-xs text-slate-450 mt-0.5">Instructor: {instructors[cls.instructorId]?.name || 'Pasajero libre'}</p>
                          </div>
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-wider font-mono ${
                            cls.status === 'scheduled' ? 'bg-cyan-50 border border-cyan-100 text-cyan-850' :
                            cls.status === 'completed' ? 'bg-emerald-50 border border-emerald-100 text-emerald-850' : 
                            'bg-slate-200 text-slate-500'
                          }`}>
                            {cls.status === 'scheduled' ? 'Agend.' : cls.status === 'completed' ? 'Comple.' : 'Canc.'}
                          </span>
                        </div>
                        
                        <div className="mt-3 flex gap-2 justify-end border-t border-slate-100 pt-2">
                          <select 
                            value={cls.status}
                            onChange={(e) => handleStatusChange(cls, e.target.value as any)}
                            className="text-[10px] rounded-lg border border-slate-205 p-1.5 bg-white font-medium"
                          >
                            <option value="scheduled">Agendada</option>
                            <option value="completed">Completar</option>
                            <option value="cancelled">Cancelar</option>
                          </select>
                          <button
                            onClick={() => handleDeleteClass(cls)}
                            className="text-red-500 hover:text-red-700 font-bold text-xs px-3 py-1.5 rounded-lg bg-red-50/50 hover:bg-red-50 border border-red-200"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                    {groupedAgenda[day].length === 0 && (
                      <p className="text-xs text-slate-400 italic text-center py-10 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">No hay reservas para este bloque.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* live Google Sheets Class History view */
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-150 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-600">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg font-display">Sincronizado Directo Google Sheets</h3>
              <p className="text-xs text-slate-450">Listado físico guardado en el archivo remoto de Google Drive.</p>
            </div>
          </div>

          {sheetsError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{sheetsError}</span>
            </div>
          )}

          {loadingSheets ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-emerald-600"></div>
              <p className="text-xs text-slate-500 font-mono">Estableciendo túnel y leyendo spreadsheet...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-150">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">ID de Fila</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Lectura Fecha</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Nombre de Alumno</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Instructor</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-150 text-slate-705">
                  {filteredSheetsClasses.map((cls, idx) => {
                    let fullDate = cls.date;
                    try {
                      fullDate = format(parseISO(cls.date), 'dd/MM/yyyy HH:mm');
                    } catch (e) {}

                    return (
                      <tr key={cls.id || idx} className="hover:bg-emerald-50/20 transition-colors">
                        <td className="px-6 py-3 font-mono text-xs text-slate-400">{cls.id || '-'}</td>
                        <td className="px-6 py-3 text-sm">{fullDate}</td>
                        <td className="px-6 py-3 font-bold text-slate-900 font-display">
                          {students[cls.studentId]?.name || cls.studentId || 'Desconocido'}
                        </td>
                        <td className="px-6 py-3 text-sm">
                          {instructors[cls.instructorId]?.name || cls.instructorId || '-'}
                        </td>
                        <td className="px-6 py-3 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] uppercase tracking-wide font-mono font-bold ${
                            cls.status === 'scheduled' ? 'bg-cyan-50 border border-cyan-100 text-cyan-805' :
                            cls.status === 'completed' ? 'bg-emerald-50 border border-emerald-100 text-emerald-805' : 
                            'bg-rose-50 border border-rose-100 text-rose-805'
                          }`}>
                            {cls.status === 'scheduled' ? 'Agendada' : cls.status === 'completed' ? 'Págalo' : cls.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSheetsClasses.length === 0 && !sheetsError && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-400 bg-slate-50/50 italic">No hay clases registradas en Sheets.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">Agendar Reserva de Surf</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddClass} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha y Hora *</label>
                <input 
                  required 
                  type="datetime-local" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Alumno *</label>
                <select 
                  required 
                  value={studentId} 
                  onChange={e => setStudentId(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="">-- Seleccionar Alumno --</option>
                  {Object.values(students).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone || 'sin telf'})</option>
                  ))}
                </select>
              </div>

              {/* ACTIVE PACKAGE SUPERPOWER STATUS GUIDE */}
              {studentId && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`p-3.5 rounded-xl border text-[11px] leading-relaxed transition ${
                    selectedStudentPackage ? 'bg-emerald-50 border-emerald-150 text-emerald-900' : 'bg-amber-50 border-amber-150 text-amber-900'
                  }`}
                >
                  <h4 className="font-bold mb-1 font-display flex items-center gap-1">
                    {selectedStudentPackage ? <CheckCircle className="w-3.5 h-3.5 text-emerald-600 inline" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline" />}
                    Crédito Escolar:
                  </h4>
                  {selectedStudentPackage ? (
                    <div className="space-y-0.5">
                      <p>Tiene paquete activo: <strong>{selectedStudentPackage.packageName}</strong></p>
                      <p>Consumidas: <strong>{selectedStudentPackage.classesUsed} de {selectedStudentPackage.totalClasses} clases</strong> ({selectedStudentPackage.totalClasses - selectedStudentPackage.classesUsed} disponibles).</p>
                      {selectedStudentPackage.amountPaid < selectedStudentPackage.totalPrice && (
                        <p className="text-amber-805 font-bold mt-1 inline-block">⚠️ Ojo: Cuenta con saldo deudor de S/. {selectedStudentPackage.totalPrice - selectedStudentPackage.amountPaid}.</p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold text-amber-850">El alumno no tiene matrículas activas registradas.</p>
                      <p className="mt-0.5 text-[10px]">Las asistencia se puede anotar, pero no descontará clases. Por favor, asígnale un saldo en el panel de Cobranza.</p>
                    </div>
                  )}
                </motion.div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Instructor Asignado *</label>
                <select 
                  required 
                  value={instructorId} 
                  onChange={e => setInstructorId(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="">-- Seleccionar Instructor --</option>
                  {Object.values(instructors).map((i: any) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </select>
              </div>
              
              {equipment.length > 0 && (
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Equipo Opcional</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Tabla</label>
                      <select value={formBoardId} onChange={e => setFormBoardId(e.target.value)}
                        className="block w-full rounded-lg border border-slate-200 text-slate-800 bg-white px-2.5 py-2 text-xs focus:border-cyan-500 outline-none transition"
                      >
                        <option value="">Sin asignar</option>
                        {equipment.filter(e => e.type === 'Tabla').map(e => (
                          <option key={e.id} value={e.id}>{e.size} {e.brand ? `(${e.brand})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Wetsuit</label>
                      <select value={formWetsuitId} onChange={e => setFormWetsuitId(e.target.value)}
                        className="block w-full rounded-lg border border-slate-200 text-slate-800 bg-white px-2.5 py-2 text-xs focus:border-cyan-500 outline-none transition"
                      >
                        <option value="">Sin asignar</option>
                        {equipment.filter(e => e.type === 'Wetsuit').map(e => (
                          <option key={e.id} value={e.id}>{e.size} {e.brand ? `(${e.brand})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Lycra</label>
                      <select value={formLycraId} onChange={e => setFormLycraId(e.target.value)}
                        className="block w-full rounded-lg border border-slate-200 text-slate-800 bg-white px-2.5 py-2 text-xs focus:border-cyan-500 outline-none transition"
                      >
                        <option value="">Sin asignar</option>
                        {equipment.filter(e => e.type === 'Lycra').map(e => (
                          <option key={e.id} value={e.id}>{e.size} {e.brand ? `(${e.brand})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer transition active:scale-98 w-full sm:w-auto"
                >
                  Agendar Reserva
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
