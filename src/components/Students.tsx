import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  UserPlus, 
  Search, 
  SlidersHorizontal, 
  Trash2, 
  Edit, 
  ChevronRight, 
  User, 
  Users,
  Phone, 
  Mail, 
  X, 
  Calendar,
  AlertTriangle,
  Eye,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Award,
  ArrowUpDown,
  ChevronDown,
  Sparkles,
  Compass,
  Waves
} from 'lucide-react';
import StudentDossierModal from './StudentDossierModal';
import { Student, Package, StudentPackage } from '../types';
import { addStudent, addStudentPackage, getStudents, getPackages, deleteStudent, updateStudent, getStudentPackages } from '../services/db';

export default function Students({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [selectedDossierStudent, setSelectedDossierStudent] = useState<Student | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [hasBoard, setHasBoard] = useState('No');
  const [parentsName, setParentsName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDueDate, setPaymentDueDate] = useState('');

  // Filter state
  const [filterName, setFilterName] = useState('');
  const [filterBoard, setFilterBoard] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [sortBy, setSortBy] = useState('name-asc');

  const fetchData = async () => {
    try {
      const [sData, pData, spData] = await Promise.all([
        getStudents(),
        getPackages(),
        getStudentPackages()
      ]);
      setStudents(sData);
      setPackages(pData);
      setStudentPackages(spData);
    } catch (error) {
      console.error("Error fetching students/packages:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeleteStudent = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este alumno? Se eliminarán sus datos pero sus paquetes y clases podrían quedar huérfanos.')) return;
    try {
      await deleteStudent(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting student:", error);
      alert("Error al eliminar alumno");
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    setName(student.name);
    setEmail(student.email || '');
    setPhone(student.phone || '');
    setAge(student.age ? student.age.toString() : '');
    setHasBoard(student.hasBoard || 'No');
    setParentsName(student.parentsName || '');
    setBirthDate(student.birthDate || '');
    
    // Clear package assignments when editing basic info
    setSelectedPackageId('');
    setAmountPaid('');
    setPaymentDueDate('');
    
    setShowAddModal(true);
  };

  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setName('');
    setEmail('');
    setPhone('');
    setAge('');
    setHasBoard('No');
    setParentsName('');
    setBirthDate('');
    setSelectedPackageId('');
    setAmountPaid('');
    setPaymentDueDate('');
    setShowAddModal(true);
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudent && editingStudent.id) {
        // Update existing student
        await updateStudent(editingStudent.id, {
          name,
          email: email || "",
          phone: phone || "",
          age: age ? Number(age) : 0,
          hasBoard: hasBoard || "No",
          parentsName: parentsName || "",
          birthDate: birthDate || ""
        });
      } else {
        // Create new student
        const studentRef = await addStudent({ 
          name, 
          email: email || "", 
          phone: phone || "",
          age: age ? Number(age) : 0,
          hasBoard: hasBoard || "No",
          parentsName: parentsName || "",
          birthDate: birthDate || ""
        });
        
        // Connect package initial load if selected
        if (studentRef && studentRef.id && selectedPackageId) {
          const pkg = packages.find(p => p.id === selectedPackageId);
          if (pkg) {
            await addStudentPackage({
              studentId: studentRef.id,
              packageId: pkg.id!,
              packageName: pkg.name,
              amountPaid: Number(amountPaid) || 0,
              totalPrice: pkg.price,
              classesUsed: 0,
              totalClasses: pkg.totalClasses,
              paymentDueDate: paymentDueDate || "",
              status: 'active'
            });
          }
        }
      }
      
      await fetchData();
      setShowAddModal(false);
      // reset forms
      setName('');
      setEmail('');
      setPhone('');
      setAge('');
      setHasBoard('No');
      setParentsName('');
      setBirthDate('');
      setSelectedPackageId('');
      setAmountPaid('');
      setPaymentDueDate('');
      setEditingStudent(null);
    } catch (error) {
      console.error("Error saving student:", error);
      alert("Error al guardar alumno");
    }
  };

  // WhatsApp Link generator
  const getWhatsAppLink = (studentName: string, phoneString?: string) => {
    if (!phoneString) return '';
    const numeric = phoneString.replace(/\D/g, '');
    const cleanNum = numeric.startsWith('51') ? numeric : '51' + numeric;
    return `https://wa.me/${cleanNum}?text=Hola%20${encodeURIComponent(studentName)},%20te%2520escribimos%2520de%2520Pacific%2520Surf%2520School%2520para%2520coordinar%2520tus%2520lecciones%252520%2525F0%25259F%25258F%252584`;
  };

  const getActivePackageDisplay = (studentId: string) => {
    const active = studentPackages.filter(sp => sp.studentId === studentId && sp.status === 'active');
    if (active.length === 0) {
      const exhausted = studentPackages.filter(sp => sp.studentId === studentId && sp.status === 'exhausted');
      if (exhausted.length > 0) {
        return (
          <div className="space-y-1">
            <span className="inline-flex items-center px-2 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider font-mono bg-slate-100 text-slate-700 border border-slate-200">
              Agotado ({exhausted[0].packageName})
            </span>
            <div>
              <button 
                onClick={() => {
                  localStorage.setItem('open_assign_pkg_for_student_id', studentId);
                  onNavigate?.('payments');
                }}
                className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200 mt-1 cursor-pointer transition active:scale-95 text-center"
              >
                + Renovar Plan
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-1">
          <span className="text-slate-400 text-xs italic block">Sin matrícula activa</span>
          <div>
            <button 
              onClick={() => {
                localStorage.setItem('open_assign_pkg_for_student_id', studentId);
                onNavigate?.('payments');
              }}
              className="inline-flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 font-bold px-2 py-0.5 rounded border border-blue-200 mt-1 cursor-pointer transition active:scale-95 text-center font-sans"
            >
              + Registrar Plan
            </button>
          </div>
        </div>
      );
    }
    
    const pkg = active[0];
    const left = pkg.totalClasses - pkg.classesUsed;
    const isLow = left <= 2;
    const isUnpaid = pkg.amountPaid < pkg.totalPrice;
    const debt = pkg.totalPrice - pkg.amountPaid;
    
    return (
      <div className="text-xs space-y-1.5">
        <p className="font-bold text-slate-800 font-display flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          {pkg.packageName}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase font-mono ${
            isLow ? 'bg-orange-50 border border-orange-150 text-orange-800 shadow-sm' : 'bg-emerald-50 border border-emerald-150 text-emerald-800 shadow-sm'
          }`}>
            {left} / {pkg.totalClasses} clases
          </span>
          {isUnpaid && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase font-mono bg-rose-50 border border-rose-150 text-rose-800 shadow-sm" title="Saldo pendiente">
              Debe S/. {debt}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          {left > 0 && (
            <button
              onClick={() => {
                localStorage.setItem('open_schedule_class_for_student_id', studentId);
                onNavigate?.('classes');
              }}
              className="inline-flex items-center text-[10px] text-cyan-700 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 px-2 py-0.5 rounded-md font-bold transition cursor-pointer active:scale-95"
            >
              📅 Agendar Clase
            </button>
          )}
          {isUnpaid && (
            <button
              onClick={() => {
                localStorage.setItem('open_payment_for_package_id', pkg.id!);
                onNavigate?.('payments');
              }}
              className="inline-flex items-center text-[10px] text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md font-bold transition cursor-pointer active:scale-95 animate-pulse"
            >
              💵 Cobrar Saldo
            </button>
          )}
        </div>
      </div>
    );
  };

  // KPI Calculations
  const totalRegistered = students.length;
  
  const activeStudentsCount = students.filter(s => {
    return studentPackages.some(sp => sp.studentId === s.id && sp.status === 'active' && (sp.totalClasses - sp.classesUsed) > 0);
  }).length;

  const renewalNeededCount = students.filter(s => {
    const active = studentPackages.find(sp => sp.studentId === s.id && sp.status === 'active');
    const spent = studentPackages.some(sp => sp.studentId === s.id && sp.status === 'exhausted') && !active;
    return (active && (active.totalClasses - active.classesUsed) <= 2) || spent || (!active && studentPackages.filter(sp => sp.studentId === s.id).length === 0);
  }).length;

  const ownBoardCount = students.filter(s => s.hasBoard === 'Si').length;

  // Search, Filter, Sort pipeline
  const filteredStudents = students
    .filter(s => {
      const query = filterName.toLowerCase().trim();
      const matchName = s.name.toLowerCase().includes(query) || 
                        (s.email && s.email.toLowerCase().includes(query)) ||
                        (s.phone && s.phone.includes(query)) ||
                        (s.parentsName && s.parentsName.toLowerCase().includes(query));
      
      const matchBoard = filterBoard === 'Todos' || s.hasBoard === filterBoard;
      
      let matchStatus = true;
      const activePkgs = studentPackages.filter(sp => sp.studentId === s.id && sp.status === 'active');
      const hasActive = activePkgs.length > 0;
      const leftClasses = hasActive ? activePkgs[0].totalClasses - activePkgs[0].classesUsed : 0;
      
      if (filterStatus === 'Activos') {
        matchStatus = hasActive && leftClasses > 0;
      } else if (filterStatus === 'Renovar') {
        const exhausted = studentPackages.filter(sp => sp.studentId === s.id && sp.status === 'exhausted');
        matchStatus = (hasActive && leftClasses <= 2) || (!hasActive && exhausted.length > 0);
      } else if (filterStatus === 'SinMatricula') {
        matchStatus = !hasActive && studentPackages.filter(sp => sp.studentId === s.id).length === 0;
      }
      
      return matchName && matchBoard && matchStatus;
    });

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (sortBy === 'name-asc') {
      return a.name.localeCompare(b.name);
    } else if (sortBy === 'name-desc') {
      return b.name.localeCompare(a.name);
    } else if (sortBy === 'recent') {
      const dateA = a.enrollmentDate ? new Date(a.enrollmentDate).getTime() : 0;
      const dateB = b.enrollmentDate ? new Date(b.enrollmentDate).getTime() : 0;
      return dateB - dateA;
    } else if (sortBy === 'age-desc') {
      return (b.age || 0) - (a.age || 0);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-md border border-slate-700 gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-1">
            <Waves className="w-4 h-4" /> Escuela de Surf
          </div>
          <h2 className="text-2xl font-extrabold font-display text-white tracking-tight">Directorio de Alumnos</h2>
          <p className="text-sm text-slate-300">Fichas técnicas, control de asistencia y renovación de planes académicos para tus alumnos.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg shadow-cyan-500/10 cursor-pointer transition flex items-center gap-2 text-sm z-10 hover:translate-y-[-1px]"
        >
          <UserPlus className="w-5 h-5" />
          Registrar Alumno
        </button>
      </div>

      {/* KPI METRICS BLOCK */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <motion.div 
          onClick={() => { setFilterStatus('Todos'); }}
          whileHover={{ y: -2 }}
          className={`p-4 bg-white rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'Todos' ? 'border-cyan-500 shadow-md ring-1 ring-cyan-500/50' : 'border-slate-150 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Alumnos Totales</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-display">{totalRegistered}</p>
          <p className="text-[10px] text-slate-450 mt-1 font-sans">Alumnos matriculados históricos</p>
        </motion.div>

        {/* KPI 2 */}
        <motion.div 
          onClick={() => { setFilterStatus('Activos'); }}
          whileHover={{ y: -2 }}
          className={`p-4 bg-white rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'Activos' ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/50' : 'border-slate-150 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Con Clases Activas</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-display">{activeStudentsCount}</p>
          <p className="text-[10px] text-slate-450 mt-1 font-sans">Tiene saldo de créditos de surf</p>
        </motion.div>

        {/* KPI 3 */}
        <motion.div 
          onClick={() => { setFilterStatus('Renovar'); }}
          whileHover={{ y: -2 }}
          className={`p-4 bg-white rounded-2xl border cursor-pointer transition-all ${
            filterStatus === 'Renovar' ? 'border-amber-500 shadow-md ring-1 ring-amber-500/50' : 'border-slate-150 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Requieren Atención</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 animate-pulse">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-display">{renewalNeededCount}</p>
          <p className="text-[10px] text-slate-450 mt-1 font-sans">Clases bajas, agotadas o sin plan</p>
        </motion.div>

        {/* KPI 4 */}
        <motion.div 
          onClick={() => { setFilterBoard('Si'); }}
          whileHover={{ y: -2 }}
          className={`p-4 bg-white rounded-2xl border cursor-pointer transition-all ${
            filterBoard === 'Si' ? 'border-cyan-500 shadow-md ring-1 ring-cyan-500/50' : 'border-slate-150 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">Con Tabla Propia</span>
            <div className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600">
              <Compass className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 font-display">{ownBoardCount}</p>
          <p className="text-[10px] text-slate-450 mt-1 font-sans">No requieren préstamo de tabla</p>
        </motion.div>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm space-y-4 md:space-y-0 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border border-slate-150">
        <div className="flex-1 md:max-w-md relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nombre, correo, teléfono, apoderado..." 
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-400 outline-none transition"
          />
          {filterName && (
            <button 
              onClick={() => setFilterName('')} 
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter selection pill/dropdown */}
          <div className="relative flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="rounded-xl border border-slate-200 text-slate-800 bg-white px-3 py-2 sm:text-xs font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Activos">Matrícula Activa</option>
              <option value="Renovar">Renovación Pendiente</option>
              <option value="SinMatricula">Sin Planes Activos</option>
            </select>
          </div>

          {/* Board ownership dropdown */}
          <select
            value={filterBoard}
            onChange={e => setFilterBoard(e.target.value)}
            className="rounded-xl border border-slate-200 text-slate-800 bg-white px-3 py-2 sm:text-xs font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
          >
            <option value="Todos">Tablas: Todas</option>
            <option value="Si">Tabla Propia (Sí)</option>
            <option value="No">Usa de Escuela (No)</option>
            <option value="En proceso">Tabla En proceso</option>
          </select>

          {/* Sort selection dropwdown */}
          <div className="relative flex items-center gap-1">
            <ArrowUpDown className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-200 text-slate-800 bg-white px-3 py-2 sm:text-xs font-semibold focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
            >
              <option value="name-asc">A-Z Alfabético</option>
              <option value="name-desc">Z-A Alfabético</option>
              <option value="recent">Inscritos Recientemente</option>
              <option value="age-desc">Edad: Mayor a menor</option>
            </select>
          </div>
        </div>
      </div>

      {/* Active filter display helpers */}
      {(filterStatus !== 'Todos' || filterBoard !== 'Todos' || filterName !== '') && (
        <div className="flex items-center gap-2 flex-wrap text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-150">
          <span className="text-slate-450 font-bold font-mono text-[10px] uppercase">Filtros Activos:</span>
          {filterName && (
            <span className="bg-slate-200 text-slate-700 pl-2 pr-1 py-0.5 rounded-md flex items-center gap-1 font-medium">
              Alineación: "{filterName}" <X className="w-4 h-4 cursor-pointer p-0.5 box-content" onClick={() => setFilterName('')} />
            </span>
          )}
          {filterStatus !== 'Todos' && (
            <span className="bg-slate-200 text-slate-700 pl-2 pr-1 py-0.5 rounded-md flex items-center gap-1 font-medium">
              Matrícula: {filterStatus} <X className="w-4 h-4 cursor-pointer p-0.5 box-content" onClick={() => setFilterStatus('Todos')} />
            </span>
          )}
          {filterBoard !== 'Todos' && (
            <span className="bg-slate-200 text-slate-700 pl-2 pr-1 py-0.5 rounded-md flex items-center gap-1 font-medium">
              Tabla: {filterBoard} <X className="w-4 h-4 cursor-pointer p-0.5 box-content" onClick={() => setFilterBoard('Todos')} />
            </span>
          )}
          <button 
            onClick={() => {
              setFilterName('');
              setFilterStatus('Todos');
              setFilterBoard('Todos');
            }} 
            className="text-cyan-600 hover:text-cyan-700 font-bold hover:underline text-[11px] ml-auto"
          >
            Limpiar todo
          </button>
        </div>
      )}

      {/* Data display container */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-150">
            <thead className="bg-slate-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Nombre del Alumno</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Contacto / Apoderado</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Edad</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Tabla Propia</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Plan / Estado</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {sortedStudents.map((student, index) => (
                <motion.tr 
                  key={student.id} 
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(0.12, index * 0.03) }}
                  className="hover:bg-slate-50/50 transition duration-150"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {/* Stylized initial banner with sea/wave coloring */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-500/15 text-cyan-700 flex items-center justify-center font-extrabold text-sm shrink-0 border border-cyan-100 shadow-xs relative">
                        {student.name[0]?.toUpperCase()}
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white bg-cyan-400"></span>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 font-display hover:text-cyan-600 transition cursor-pointer" onClick={() => setSelectedDossierStudent(student)}>
                          {student.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                          ID: <span className="text-slate-500 select-all font-semibold">{student.id}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {student.phone && (
                        <div className="text-xs text-slate-700 font-medium flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400 inline-block shrink-0" />
                          <span>{student.phone}</span>
                          
                          {/* Direct Quick WhatsApp click icon */}
                          <a 
                            href={getWhatsAppLink(student.name, student.phone)}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 flex items-center justify-center text-emerald-600 transition title-click shrink-0 hover:scale-105 active:scale-95"
                            title="Chat por WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      
                      {student.email && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[180px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400 inline-block shrink-0" />
                          <span className="truncate" title={student.email}>{student.email}</span>
                        </div>
                      )}
                      
                      {student.parentsName && (
                        <div className="text-[11px] text-blue-600 font-medium pt-0.5 flex items-center gap-1">
                          <span className="text-slate-400 font-normal">Apoderado:</span> 
                          <span className="font-semibold text-slate-700">{student.parentsName}</span>
                        </div>
                      )}
                      
                      {!student.phone && !student.email && (
                        <span className="text-slate-400 text-xs italic">Sin datos de contacto</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-semibold font-mono">
                    {student.age ? (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                        {student.age} años
                      </span>
                    ) : (
                      <span className="text-slate-400 italic font-normal">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide uppercase font-mono ${
                      student.hasBoard === 'Si' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800' :
                      student.hasBoard === 'No' ? 'bg-rose-50 border border-rose-150 text-rose-800' : 'bg-amber-50 border border-amber-150 text-amber-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        student.hasBoard === 'Si' ? 'bg-emerald-500' :
                        student.hasBoard === 'No' ? 'bg-rose-505' : 'bg-amber-500'
                      }`} />
                      {student.hasBoard === 'Si' ? 'Sí (propia)' : student.hasBoard === 'No' ? 'No (escuela)' : 'En proceso'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getActivePackageDisplay(student.id || '')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-2">
                      <button 
                        onClick={() => setSelectedDossierStudent(student)}
                        className="text-emerald-600 hover:text-emerald-700 bg-emerald-50/70 hover:bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 hover:scale-102 active:scale-98 w-full sm:w-auto justify-center"
                      >
                        <Eye className="w-4 h-4" />
                        Ficha
                      </button>
                      <button 
                        onClick={() => handleEditClick(student)}
                        className="text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-50 border border-blue-200 px-3 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 hover:scale-102 active:scale-98 w-full sm:w-auto justify-center"
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(student.id!)}
                        className="text-red-500 hover:text-red-650 bg-red-50/50 hover:bg-red-50 border border-red-200 px-3 py-2 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5 hover:scale-102 active:scale-98 w-full sm:w-auto justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
              {sortedStudents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-400 bg-slate-50/45 italic">
                    <AlertTriangle className="w-7 h-7 text-amber-500 mx-auto opacity-75 mb-2" />
                    No se encontraron alumnos que coincidan con los filtros de búsqueda especificados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">
                {editingStudent ? 'Editar Alumno' : 'Registrar Nuevo Alumno'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre Completo *</label>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: Jonathan Montoya" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: alumno@pacificsurf.com" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono / WhatsApp</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: 981292384" 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Edad</label>
                  <input 
                    type="number" 
                    value={age} 
                    onChange={e => setAge(e.target.value)} 
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                    placeholder="Ej: 21" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">¿Tiene Tabla? *</label>
                  <select 
                    value={hasBoard} 
                    onChange={e => setHasBoard(e.target.value)} 
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
                  >
                    <option value="Si">Sí, propia</option>
                    <option value="No">No, usa de escuela</option>
                    <option value="En proceso">En proceso</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Padres / Apoderados (Si es menor de edad)</label>
                <input 
                  type="text" 
                  value={parentsName} 
                  onChange={e => setParentsName(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: María Montoya" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de Nacimiento</label>
                <input 
                  type="text" 
                  placeholder="Ej: DD/MM/YYYY o 03/09/2005" 
                  value={birthDate} 
                  onChange={e => setBirthDate(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                />
              </div>
              
              {!editingStudent ? (
                <div className="pt-4 border-t border-slate-100">
                  <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase tracking-wider">Asignar Plan Inicial (Opcional)</h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">Plan de Clase</label>
                    <select 
                      value={selectedPackageId} 
                      onChange={e => setSelectedPackageId(e.target.value)} 
                      className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                    >
                      <option value="">-- Sin paquete inicial --</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (S/. {p.price})</option>
                      ))}
                    </select>
                  </div>
                  {selectedPackageId && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 p-3 bg-blue-50/40 rounded-xl space-y-3 border border-blue-100/50"
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-blue-800 uppercase">Monto Inicial Aportado (S/.)</label>
                        <input 
                          type="text" 
                          placeholder="Monto pagado"
                          value={amountPaid} 
                          onChange={e => {
                            const val = e.target.value;
                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                              setAmountPaid(val);
                            }
                          }} 
                          className="mt-1 block w-full rounded-lg border border-blue-200 text-slate-800 px-3.5 py-2 sm:text-xs focus:border-blue-500 outline-none transition bg-white" 
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-blue-800 uppercase">Fecha Límite para Cancelar Saldo</label>
                        <input 
                          type="date" 
                          value={paymentDueDate} 
                          onChange={e => setPaymentDueDate(e.target.value)} 
                          className="mt-1 block w-full rounded-lg border border-blue-200 text-slate-800 px-3.5 py-2 sm:text-xs focus:border-blue-500 outline-none transition bg-white" 
                        />
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-800 leading-normal">
                    Los paquetes activos, cobranzas y liquidación de saldos de este alumno se controlan en las pantallas de <strong>Cobranza</strong> y <strong>Clases</strong>.
                  </p>
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
                  {editingStudent ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

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
