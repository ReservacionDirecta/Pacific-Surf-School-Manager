import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DollarSign, 
  Plus, 
  RotateCw, 
  Search, 
  X, 
  History,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  CreditCard,
  Pencil,
  Save
} from 'lucide-react';
import { StudentPackage, Student, Payment, Package } from '../types';
import { getStudents, getStudentPackages, updateStudentPackage, addPayment, getPayments, deletePayment, addStudentPackage, getPackages } from '../services/db';
import { format, parseISO, isBefore } from 'date-fns';

export default function Payments({ onNavigate }: { onNavigate?: (view: string) => void }) {
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [payments, setPayments] = useState<Payment[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filter
  const [filterStudentName, setFilterStudentName] = useState('');
  // Sort state
  const [sortKey, setSortKey] = useState('student');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Payment register modal states
  const [editingPayment, setEditingPayment] = useState<StudentPackage | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Yape' | 'Plin'>('Efectivo');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [showHistory, setShowHistory] = useState<string | null>(null); // studentPackageId

  // Assign package modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignPackageId, setAssignPackageId] = useState('');
  const [assignAmountPaid, setAssignAmountPaid] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  // Edit cobranza details modal
  const [editingDetails, setEditingDetails] = useState<StudentPackage | null>(null);
  const [editPackageName, setEditPackageName] = useState('');
  const [editTotalPrice, setEditTotalPrice] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editTotalClasses, setEditTotalClasses] = useState('');
  const [editClassesUsed, setEditClassesUsed] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editStatus, setEditStatus] = useState<'active' | 'exhausted' | 'expired'>('active');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [sData, spData, pData, pkgData] = await Promise.all([
        getStudents(),
        getStudentPackages(),
        getPayments(),
        getPackages()
      ]);
      
      const studs: Record<string, Student> = {};
      sData.forEach((s: Student) => { studs[s.id] = s; });
      setStudents(studs);
      
      setStudentPackages(spData);
      setPayments(pData);
      setPackages(pkgData);
    } catch (error) {
      console.error("Error fetching payments data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!loading && studentPackages.length > 0) {
      const targetPkgId = localStorage.getItem('open_payment_for_package_id');
      if (targetPkgId) {
        const found = studentPackages.find(sp => sp.id === targetPkgId);
        if (found) {
          setEditingPayment(found);
        }
        localStorage.removeItem('open_payment_for_package_id');
      }

      const assignStudentIdValue = localStorage.getItem('open_assign_pkg_for_student_id');
      if (assignStudentIdValue) {
        setAssignStudentId(assignStudentIdValue);
        setShowAssignModal(true);
        localStorage.removeItem('open_assign_pkg_for_student_id');
      }
    }
  }, [loading, studentPackages]);

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;

    try {
      const addedAmount = Number(newAmount) || 0;
      const updatedAmount = editingPayment.amountPaid + addedAmount;
      
      // 1. Add to payment history record
      await addPayment({
        studentPackageId: editingPayment.id!,
        amount: addedAmount,
        date: new Date().toISOString(),
        method: paymentMethod,
        notes: paymentNotes
      });

      // 2. Update student package
      await updateStudentPackage(editingPayment.id!, { 
        amountPaid: updatedAmount
      });
      
      setEditingPayment(null);
      setNewAmount('');
      setPaymentNotes('');
      await fetchData();
    } catch (error) {
      console.error("Error updating payment:", error);
      alert("Error al actualizar el pago");
    }
  };

  const handleDeleteHistoryItem = async (id: string, spId: string, amount: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro de pago? Se restará del total pagado del plan.')) return;
    
    try {
      const sp = studentPackages.find(p => p.id === spId);
      if (sp) {
        await updateStudentPackage(spId, { amountPaid: sp.amountPaid - amount });
      }
      await deletePayment(id);
      await fetchData();
    } catch (error) {
      console.error("Error deleting payment record:", error);
    }
  };

  // Renew / Assign new package to existing student handler
  const handleAssignPackageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentId || !assignPackageId) {
      alert("Selecciona un alumno y un plan.");
      return;
    }

    try {
      const selectedPkg = packages.find(p => p.id === assignPackageId);
      if (!selectedPkg) return;

      const initialPaid = Number(assignAmountPaid) || 0;

      // 1. Create a new student package entry
      const spRef = await addStudentPackage({
        studentId: assignStudentId,
        packageId: selectedPkg.id!,
        packageName: selectedPkg.name,
        amountPaid: initialPaid,
        totalPrice: selectedPkg.price,
        classesUsed: 0,
        totalClasses: selectedPkg.totalClasses,
        paymentDueDate: assignDueDate || "",
        status: 'active'
      });

      // 2. If they paid any initial amount, record the payment history row!
      if (initialPaid > 0 && spRef && spRef.id) {
        await addPayment({
          studentPackageId: spRef.id,
          amount: initialPaid,
          date: new Date().toISOString(),
          method: 'Efectivo',
          notes: assignNotes || "Pago inicial por renovación de plan"
        });
      }

      setShowAssignModal(false);
      setAssignStudentId('');
      setAssignPackageId('');
      setAssignAmountPaid('');
      setAssignNotes('');
      setAssignDueDate('');
      await fetchData();
      alert("¡Plan asignado exitosamente al alumno!");
    } catch (error) {
      console.error("Error creating student package:", error);
      alert("Error al asignar plan");
    }
  };

  const totalCollected = payments.reduce((sum, p) => sum + p.amount, 0);
  
  const totalReceivables = studentPackages.reduce((sum, sp) => {
    if (sp.amountPaid < sp.totalPrice && sp.status === 'active') {
      return sum + (sp.totalPrice - sp.amountPaid);
    }
    return sum;
  }, 0);

  const collectedByMethod = payments.reduce((acc, p) => {
    const m = p.method || 'Efectivo';
    acc[m] = (acc[m] || 0) + p.amount;
    return acc;
  }, { 'Efectivo': 0, 'Transferencia': 0, 'Yape': 0, 'Plin': 0 } as Record<string, number>);

  const today = new Date();
  
  // Filter pending packages by name
  const filteredPending = studentPackages
    .filter(sp => {
      const student = students[sp.studentId];
      if (!student) return false;
      const matchesName = student.name.toLowerCase().includes(filterStudentName.toLowerCase());
      const isPending = sp.amountPaid < sp.totalPrice;
      return matchesName && isPending;
    })
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      const aStudent = students[a.studentId]?.name || '';
      const bStudent = students[b.studentId]?.name || '';
      let cmp = 0;
      if (sortKey === 'student') {
        cmp = aStudent.localeCompare(bStudent);
      } else if (sortKey === 'package') {
        cmp = (a.packageName || '').localeCompare(b.packageName || '');
      } else if (sortKey === 'total') {
        cmp = a.totalPrice - b.totalPrice;
      } else if (sortKey === 'paid') {
        cmp = a.amountPaid - b.amountPaid;
      } else if (sortKey === 'debt') {
        cmp = (a.totalPrice - a.amountPaid) - (b.totalPrice - b.amountPaid);
      } else if (sortKey === 'due') {
        cmp = (a.paymentDueDate || '').localeCompare(b.paymentDueDate || '');
      }
      return cmp * dir;
    });

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleOpenEditDetails = (sp: StudentPackage) => {
    setEditingDetails(sp);
    setEditPackageName(sp.packageName || '');
    setEditTotalPrice(String(sp.totalPrice));
    setEditAmountPaid(String(sp.amountPaid));
    setEditTotalClasses(String(sp.totalClasses));
    setEditClassesUsed(String(sp.classesUsed));
    setEditDueDate(sp.paymentDueDate || '');
    setEditStatus(sp.status);
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDetails?.id) return;

    try {
      await updateStudentPackage(editingDetails.id, {
        packageName: editPackageName,
        totalPrice: Number(editTotalPrice),
        amountPaid: Number(editAmountPaid),
        totalClasses: Number(editTotalClasses),
        classesUsed: Number(editClassesUsed),
        paymentDueDate: editDueDate,
        status: editStatus,
      });
      setEditingDetails(null);
      await fetchData();
    } catch (error) {
      console.error("Error saving cobranza details:", error);
      alert("Error al guardar los cambios");
    }
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 inline-block opacity-30" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 inline-block text-cyan-600" />
      : <ArrowDown className="w-3 h-3 ml-1 inline-block text-cyan-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header and top buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-md border border-slate-700 gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-1">
            <DollarSign className="w-4 h-4 text-cyan-400" /> Control Financiero
          </div>
          <h2 className="text-2xl font-extrabold font-display text-white tracking-tight">Finanzas y Cobranzas</h2>
          <p className="text-sm text-slate-300">Arqueo de caja escolar, saldos adeudados, cuotas mensuales y asignación de planes.</p>
        </div>
        
        <div className="flex items-center gap-2.5 w-full sm:w-auto relative z-10">
          <button 
            onClick={() => setShowAssignModal(true)}
            className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg cursor-pointer transition flex items-center gap-1.5 text-xs active:scale-98"
          >
            <Plus className="w-4 h-4" />
            Asignar / Renovar Plan
          </button>
          
          <button 
            onClick={fetchData}
            className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white rounded-xl transition cursor-pointer"
            title="Refrescar caja"
          >
            <RotateCw className="w-4 h-4 shrink-0" />
          </button>
        </div>
      </div>

      {/* SUMMARY DASHBOARD WIDGETS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-5 rounded-2xl border border-emerald-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest block font-mono">Total Recaudado</span>
            <span className="text-2xl font-black text-emerald-990 tracking-tight mt-1 block font-display">S/. {totalCollected.toFixed(2)}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            S/.
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-50 to-rose-100/30 p-5 rounded-2xl border border-rose-100 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest block font-mono">Por Cobrar (Saldos)</span>
            <span className="text-2xl font-black text-rose-990 tracking-tight mt-1 block font-display text-rose-600">S/. {totalReceivables.toFixed(2)}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold">
            Cobro
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-150 col-span-1 md:col-span-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-mono mb-2.5">Recaudación por Método</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100">
              <span className="text-[10px] text-emerald-800 font-bold block uppercase tracking-wide">Efectivo</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block font-mono">S/. {collectedByMethod['Efectivo'] || 0}</span>
            </div>
            <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
              <span className="text-[10px] text-blue-805 font-bold block uppercase tracking-wide">Banco</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block font-mono">S/. {collectedByMethod['Transferencia'] || 0}</span>
            </div>
            <div className="bg-purple-50/50 p-2.5 rounded-xl border border-purple-100">
              <span className="text-[10px] text-purple-800 font-bold block uppercase tracking-wide">Yape</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block font-mono">S/. {collectedByMethod['Yape'] || 0}</span>
            </div>
            <div className="bg-cyan-50/50 p-2.5 rounded-xl border border-cyan-100">
              <span className="text-[10px] text-cyan-800 font-bold block uppercase tracking-wide">Plin</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 block font-mono">S/. {collectedByMethod['Plin'] || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN SALDOS table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150 overflow-x-auto">
        <div className="px-6 py-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-bold text-slate-650 uppercase tracking-widest font-mono whitespace-nowrap">Cobros Pendientes</h3>
            <span className="bg-rose-50 border border-rose-150 text-rose-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider font-mono">
              {filteredPending.length}
            </span>
          </div>
          <div className="relative flex-1 max-w-xs">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input 
              type="text" 
              placeholder="Buscar alumno..." 
              value={filterStudentName}
              onChange={e => setFilterStudentName(e.target.value)}
              className="w-full rounded-lg border border-slate-200 text-slate-800 pl-8 pr-3 py-1.5 text-xs focus:border-cyan-500 outline-none transition bg-white"
            />
          </div>
        </div>
        
        <table className="min-w-full divide-y divide-slate-150">
          <thead className="bg-slate-50/10">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('student')}>
                Alumno <SortIcon col="student" />
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('package')}>
                Plan de Surf <SortIcon col="package" />
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('total')}>
                Precio Total <SortIcon col="total" />
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('paid')}>
                Abonado <SortIcon col="paid" />
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('debt')}>
                Saldo Deuda <SortIcon col="debt" />
              </th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono cursor-pointer hover:text-slate-700 select-none" onClick={() => handleSort('due')}>
                Límite Pago <SortIcon col="due" />
              </th>
              <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-150">
            {filteredPending.map(sp => {
              const student = students[sp.studentId];
              const pending = sp.totalPrice - sp.amountPaid;
              const isDue = sp.paymentDueDate && isBefore(parseISO(sp.paymentDueDate), today);

              return (
                <tr key={sp.id} className={`transition ${isDue ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-slate-900 font-display">{student?.name || 'Pasajero no registrado'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{student?.phone || 'Sin cel'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-650">
                    {sp.packageName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-bold font-mono">
                    S/. {sp.totalPrice}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-semibold font-mono">
                    S/. {sp.amountPaid}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-rose-600 font-extrabold bg-rose-50/20 font-mono">
                    S/. {pending}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {sp.paymentDueDate ? (
                      <span className={isDue ? 'text-rose-600 font-extrabold inline-flex items-center gap-1 font-mono text-[11px]' : 'text-slate-500 font-mono text-[11px]'}>
                        {isDue && <span className="w-1.5 h-1.5 rounded-full bg-red-650 animate-pulse"></span>}
                        {sp.paymentDueDate}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold">
                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-1.5">
                      <button 
                        onClick={() => handleOpenEditDetails(sp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold transition cursor-pointer border border-amber-200"
                      >
                        <Pencil className="w-3 h-3" />
                        Ajustes
                      </button>
                      <button 
                        onClick={() => setEditingPayment(sp)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-bold transition cursor-pointer border border-emerald-200"
                      >
                        <CreditCard className="w-3 h-3" />
                        Abonar
                      </button>
                      <button 
                        onClick={() => setShowHistory(sp.id!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[10px] font-bold transition cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        Historial
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredPending.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-sm text-slate-400 bg-slate-50/55 italic">No hay saldos deudores registrados. ¡Todo está al día!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* RECORD INDIVIDUAL TRANSACTION MODAL */}
      {editingPayment && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">Abonar Dinero</h3>
              <button 
                onClick={() => setEditingPayment(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-slate-705 mb-4 bg-slate-50 border border-slate-150 p-3.5 rounded-xl space-y-1 leading-relaxed">
              <p>Alumno: <span className="font-bold text-slate-900 font-display">{students[editingPayment.studentId]?.name}</span></p>
              <p>Plan: <span className="font-bold text-slate-900 font-display">{editingPayment.packageName}</span></p>
              <p>Saldo Pendiente: <span className="font-black text-rose-600 font-mono">S/. {editingPayment.totalPrice - editingPayment.amountPaid}</span></p>
            </div>
            
            <form onSubmit={handleUpdatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Monto a Abonar (S/.) *</label>
                <input 
                  required 
                  type="text" 
                  value={newAmount} 
                  onChange={e => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setNewAmount(val);
                    }
                  }} 
                  className="mt-1 block w-full rounded-xl border border-slate-205 text-slate-850 px-3.5 py-2.5 font-bold focus:border-cyan-500 outline-none transition bg-slate-50 focus:bg-white text-lg" 
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Método de Cobro *</label>
                <select 
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as any)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="Efectivo">💵 Efectivo</option>
                  <option value="Transferencia">🏦 Transferencia Bancaria</option>
                  <option value="Yape">📱 Yape</option>
                  <option value="Plin">📱 Plin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Notas de Referencia</label>
                <input 
                  type="text" 
                  value={paymentNotes} 
                  onChange={e => setPaymentNotes(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition" 
                  placeholder="Ej: Código de Operación o Yape"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setEditingPayment(null)} 
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-emerald-500/10 cursor-pointer transition active:scale-98"
                >
                  Registrar Abono
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* RENEW / ASSIGN PACKAGE TO EXISTING STUDENT MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">Asignar Plan Académico</h3>
              <button 
                onClick={() => setShowAssignModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAssignPackageSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Seleccionar Alumno *</label>
                <select 
                  required 
                  value={assignStudentId} 
                  onChange={e => setAssignStudentId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="">-- Elige un Alumno --</option>
                  {Object.values(students).map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone || 'sin telf'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Seleccionar Plan de Clases *</label>
                <select 
                  required 
                  value={assignPackageId} 
                  onChange={e => setAssignPackageId(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 bg-white px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="">-- Elige un Plan --</option>
                  {packages.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (S/. {p.price} - {p.totalClasses} clases)</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Pago Inicial (S/.)</label>
                  <input 
                    type="text" 
                    placeholder="0"
                    value={assignAmountPaid} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setAssignAmountPaid(val);
                      }
                    }} 
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 px-3.5 py-2.5 sm:text-xs focus:border-cyan-500 outline-none transition" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Límite Pago Deuda</label>
                  <input 
                    type="date" 
                    value={assignDueDate} 
                    onChange={e => setAssignDueDate(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-805 px-3.5 py-2.5 sm:text-xs focus:border-cyan-500 outline-none transition" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Comentarios Venta</label>
                <input 
                  type="text" 
                  value={assignNotes} 
                  onChange={e => setAssignNotes(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 outline-none transition" 
                  placeholder="Ej: Pago anticipado en efectivo"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/10 cursor-pointer transition active:scale-98"
                >
                  Matricular Alumno
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* VIEW PAYMENT INSTALMENTS HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg border border-slate-100"
          >
            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 font-display flex items-center gap-1.5">
                <History className="w-5 h-5 text-indigo-500" />
                Historial de Registro de Pagos
              </h3>
              <button 
                onClick={() => setShowHistory(null)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-x-auto min-h-40 max-h-80 overflow-y-auto">
              <table className="min-w-full divide-y divide-slate-150">
                <thead className="bg-slate-50/80 text-slate-400 font-bold uppercase text-[10px] tracking-widest font-mono">
                  <tr>
                    <th className="px-4 py-2 text-left">Fecha Registro</th>
                    <th className="px-4 py-2 text-left">Monto Recibido</th>
                    <th className="px-4 py-2 text-left">Método</th>
                    <th className="px-4 py-2 text-left">Detalles Op.</th>
                    <th className="px-4 py-2 text-right">Anular</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-slate-700 text-xs">
                  {payments
                    .filter(p => p.studentPackageId === showHistory)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono text-[11px]">{format(parseISO(p.date), 'dd/MM/yyyy HH:mm')}</td>
                        <td className="px-4 py-3 font-bold text-slate-900 font-mono">S/. {p.amount}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase font-mono tracking-wide
                            ${p.method === 'Efectivo' ? 'bg-emerald-55/60 text-emerald-800' : 
                              p.method === 'Yape' ? 'bg-purple-100 text-purple-800' : 
                              p.method === 'Plin' ? 'bg-cyan-100 text-cyan-800' : 
                              'bg-slate-100 text-slate-800'}`}>
                            {p.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-405 italic">{p.notes || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <button 
                            onClick={() => handleDeleteHistoryItem(p.id!, p.studentPackageId, p.amount)} 
                            className="text-red-500 hover:text-red-700 p-1 rounded-lg hover:bg-red-50 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {payments.filter(p => p.studentPackageId === showHistory).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No se han registrado pagos parciales para este plan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-5 flex justify-end">
              <button 
                onClick={() => setShowHistory(null)} 
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs cursor-pointer transition"
              >
                Cerrar Libreta
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* EDIT COBRANZA DETAILS MODAL */}
      {editingDetails && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">Ajustar Detalles de Cobranza</h3>
              <button 
                onClick={() => setEditingDetails(null)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 mb-4 bg-slate-50 border border-slate-150 p-3 rounded-xl">
              Alumno: <span className="font-bold text-slate-900">{students[editingDetails.studentId]?.name}</span>
            </div>

            <form onSubmit={handleSaveDetails} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Plan</label>
                <input 
                  type="text"
                  value={editPackageName}
                  onChange={e => setEditPackageName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Precio Total (S/.)</label>
                  <input 
                    type="text"
                    value={editTotalPrice}
                    onChange={e => /^\d*\.?\d*$/.test(e.target.value) && setEditTotalPrice(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm font-bold focus:border-cyan-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Abonado (S/.)</label>
                  <input 
                    type="text"
                    value={editAmountPaid}
                    onChange={e => /^\d*\.?\d*$/.test(e.target.value) && setEditAmountPaid(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm font-bold focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              {Number(editTotalPrice) - Number(editAmountPaid) > 0 && (
                <div className="bg-rose-50 border border-rose-150 rounded-xl px-3.5 py-2 text-xs text-rose-700 font-bold">
                  Saldo Deuda: S/. {(Number(editTotalPrice) - Number(editAmountPaid)).toFixed(2)}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Clases Total</label>
                  <input 
                    type="number" min="0"
                    value={editTotalClasses}
                    onChange={e => setEditTotalClasses(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm font-bold focus:border-cyan-500 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Clases Usadas</label>
                  <input 
                    type="number" min="0"
                    value={editClassesUsed}
                    onChange={e => setEditClassesUsed(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm font-bold focus:border-cyan-500 outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Límite de Pago</label>
                <input 
                  type="date"
                  value={editDueDate}
                  onChange={e => setEditDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as any)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="active">Activo</option>
                  <option value="exhausted">Agotado</option>
                  <option value="expired">Expirado</option>
                </select>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setEditingDetails(null)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-amber-500/10 cursor-pointer transition active:scale-98 w-full sm:w-auto"
                >
                  <Save className="w-4 h-4" />
                  Guardar Cambios
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
