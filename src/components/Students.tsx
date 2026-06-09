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
  Phone, 
  Mail, 
  X, 
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { Student, Package, StudentPackage } from '../types';
import { addStudent, addStudentPackage, getStudents, getPackages, deleteStudent, updateStudent, getStudentPackages } from '../services/db';

export default function Students() {
  const [students, setStudents] = useState<Student[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

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

  const getActivePackageDisplay = (studentId: string) => {
    const active = studentPackages.filter(sp => sp.studentId === studentId && sp.status === 'active');
    if (active.length === 0) {
      const exhausted = studentPackages.filter(sp => sp.studentId === studentId && sp.status === 'exhausted');
      if (exhausted.length > 0) {
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] uppercase font-bold tracking-wider font-mono bg-slate-100 text-slate-700 border border-slate-200">
            Agotado ({exhausted[0].packageName})
          </span>
        );
      }
      return <span className="text-slate-400 text-xs italic">Sin matrícula activa</span>;
    }
    
    const pkg = active[0];
    const left = pkg.totalClasses - pkg.classesUsed;
    const isLow = left <= 2;
    const isUnpaid = pkg.amountPaid < pkg.totalPrice;
    
    return (
      <div className="text-xs space-y-1">
        <p className="font-bold text-slate-800 font-display">{pkg.packageName}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase font-mono ${
            isLow ? 'bg-orange-50 border border-orange-150 text-orange-850' : 'bg-emerald-50 border border-emerald-150 text-emerald-850'
          }`}>
            {left} / {pkg.totalClasses} clases
          </span>
          {isUnpaid && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase font-mono bg-rose-50 border border-rose-150 text-rose-850" title="Saldo pendiente">
              Debe S/. {pkg.totalPrice - pkg.amountPaid}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-150 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight">Directorio de Alumnos</h2>
          <p className="text-sm text-slate-400">Control total y perfiles de los surfers registrados en Pacific Surf School.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 text-sm active:scale-98"
        >
          <UserPlus className="w-4.5 h-4.5" />
          Nuevo Alumno
        </button>
      </div>

      {/* Filter and search bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between border border-slate-150">
        <div className="flex-1 md:max-w-md relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input 
            type="text" 
            placeholder="Buscar por nombre..." 
            value={filterName}
            onChange={e => setFilterName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition"
          />
        </div>

        <div className="w-full md:w-56 relative flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={filterBoard}
            onChange={e => setFilterBoard(e.target.value)}
            className="w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition"
          >
            <option value="Todos">Todas las tablas</option>
            <option value="Si">Con Tabla (Sí)</option>
            <option value="No">Sin Tabla (No)</option>
            <option value="En proceso">En proceso</option>
          </select>
        </div>
      </div>

      {/* Data display container */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-150">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Nombre del Surfer</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Contacto / Apoderado</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Edad</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Tabla Propia</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Paquete / Estado</th>
              <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-150">
            {students
              .filter(s => s.name.toLowerCase().includes(filterName.toLowerCase()))
              .filter(s => filterBoard === 'Todos' || s.hasBoard === filterBoard)
              .map(student => (
                <tr key={student.id} className="hover:bg-slate-50/55 transition duration-150">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center font-bold text-sm shrink-0 border border-cyan-100">
                        {student.name[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 font-display">{student.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {student.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-0.5">
                      {student.phone && (
                        <div className="text-sm text-slate-700 flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400 inline-block shrink-0" />
                          <span>{student.phone}</span>
                        </div>
                      )}
                      {student.email && (
                        <div className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[200px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400 inline-block shrink-0" />
                          <span className="truncate">{student.email}</span>
                        </div>
                      )}
                      {student.parentsName && (
                        <div className="text-xs text-blue-600 font-medium pt-0.5">
                          Padre/Apod: <span className="font-semibold">{student.parentsName}</span>
                        </div>
                      )}
                      {!student.phone && !student.email && (
                        <span className="text-slate-400 text-xs italic">Sin datos de contacto</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-medium">
                    {student.age ? `${student.age} años` : <span className="text-slate-400 italic font-normal text-xs">-</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase font-mono ${
                      student.hasBoard === 'Si' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800' :
                      student.hasBoard === 'No' ? 'bg-rose-50 border border-rose-150 text-rose-800' : 'bg-amber-50 border border-amber-150 text-amber-805'
                    }`}>
                      {student.hasBoard || 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getActivePackageDisplay(student.id || '')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold space-x-3">
                    <button 
                      onClick={() => handleEditClick(student)}
                      className="text-blue-600 hover:text-blue-700 transition cursor-pointer inline-flex items-center gap-1 hover:underline"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar
                    </button>
                    <button 
                      onClick={() => handleDeleteStudent(student.id!)}
                      className="text-red-500 hover:text-red-650 transition cursor-pointer inline-flex items-center gap-1 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-400 bg-slate-50/50 italic">
                  No se encontraron surfers. Puedes importar o registrarlos manualmente arriba.
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                  placeholder="Ej: surfer@pacificsurf.com" 
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
                  <h4 className="font-bold text-xs text-slate-700 mb-2 uppercase tracking-wider">Asignar Paquete Inicial (Opcional)</h4>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase">Paquete de Clase</label>
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

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer transition active:scale-98"
                >
                  {editingStudent ? 'Guardar Cambios' : 'Registrar'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
