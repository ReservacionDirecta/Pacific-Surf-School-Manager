import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  Plus, 
  History, 
  BookOpen, 
  Briefcase, 
  Clock, 
  Compass, 
  Trash2, 
  Eye, 
  Activity, 
  MessageSquare,
  Sparkles,
  Award,
  Pencil
} from 'lucide-react';
import { Student, Package, StudentPackage, Class, Instructor, Payment } from '../types';

import { format, parseISO, isBefore, isToday } from 'date-fns';
import { 
  getStudents as dbGetStudents,
  getStudentPackages as dbGetStudentPackages,
  getClasses as dbGetClasses,
  getInstructors as dbGetInstructors,
  getPayments as dbGetPayments,
  getPackages as dbGetPackages,
  addClass as dbAddClass,
  addPayment as dbAddPayment,
  addStudentPackage as dbAddStudentPackage,
  updateClass as dbUpdateClass,
  updateStudentPackage as dbUpdateStudentPackage,
  updatePayment as dbUpdatePayment,
  deleteClass as dbDeleteClass,
  deletePayment as dbDeletePayment
} from '../services/db';

interface StudentDossierModalProps {
  student: Student;
  isOpen: boolean;
  onClose: () => void;
  onDataChanged?: () => void;
}

export default function StudentDossierModal({ student, isOpen, onClose, onDataChanged }: StudentDossierModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'packages' | 'classes' | 'payments'>('summary');
  const [loading, setLoading] = useState(true);
  
  // Database sub-slices
  const [studentPackages, setStudentPackages] = useState<StudentPackage[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

  // Subform states
  const [showAddClass, setShowAddClass] = useState(false);
  const [classDate, setClassDate] = useState('');
  const [classInstructorId, setClassInstructorId] = useState('');
  const [classFormError, setClassFormError] = useState('');

  const [scoringPaymentSpId, setScoringPaymentSpId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Efectivo' | 'Transferencia' | 'Yape' | 'Plin'>('Efectivo');
  const [payNotes, setPayNotes] = useState('');
  const [payFormError, setPayFormError] = useState('');

  const [showAssignPackage, setShowAssignPackage] = useState(false);
  const [newPkgId, setNewPkgId] = useState('');
  const [newPkgPaid, setNewPkgPaid] = useState('');
  const [newPkgDueDate, setNewPkgDueDate] = useState('');
  const [newPkgNotes, setNewPkgNotes] = useState('');
  const [pkgFormError, setPkgFormError] = useState('');

  // Edit states for class, package, payment
  const [editClassId, setEditClassId] = useState<string | null>(null);
  const [editClassDate, setEditClassDate] = useState('');
  const [editClassInstructorId, setEditClassInstructorId] = useState('');

  const [editPkgId, setEditPkgId] = useState<string | null>(null);
  const [editPkgTotalPrice, setEditPkgTotalPrice] = useState('');
  const [editPkgAmountPaid, setEditPkgAmountPaid] = useState('');
  const [editPkgClassesUsed, setEditPkgClassesUsed] = useState('');
  const [editPkgTotalClasses, setEditPkgTotalClasses] = useState('');
  const [editPkgError, setEditPkgError] = useState('');

  const [editPaymentId, setEditPaymentId] = useState<string | null>(null);
  const [editPayAmount, setEditPayAmount] = useState('');
  const [editPayMethod, setEditPayMethod] = useState<'Efectivo' | 'Transferencia' | 'Yape' | 'Plin'>('Efectivo');
  const [editPayDate, setEditPayDate] = useState('');
  const [editPayNotes, setEditPayNotes] = useState('');
  const [editPayError, setEditPayError] = useState('');

  const loadDossierData = async () => {
    if (!student.id) return;
    setLoading(true);
    try {
      const [spData, cData, iData, pData, pkgData] = await Promise.all([
        dbGetStudentPackages(),
        dbGetClasses(),
        dbGetInstructors(),
        dbGetPayments(),
        dbGetPackages()
      ]);

      // Filter local lists for this specific student structure
      setStudentPackages(spData.filter(sp => sp.studentId === student.id));
      setClasses(cData.filter(c => c.studentId === student.id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      setInstructors(iData);
      setPayments(pData);
      setPackages(pkgData);
    } catch (e) {
      console.error("Error loading student dossier data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && student.id) {
      loadDossierData();
      setActiveTab('summary');
      setShowAddClass(false);
      setScoringPaymentSpId(null);
      setShowAssignPackage(false);
    }
  }, [isOpen, student.id]);

  if (!isOpen) return null;

  // Derived Values
  const activePackage = studentPackages.find(sp => sp.status === 'active');
  const totalClassesAttended = classes.filter(c => c.status === 'completed').length;
  const totalClassesScheduled = classes.filter(c => c.status === 'scheduled').length;
  
  // WhatsApp Link generator
  const getWhatsAppLink = (phoneString?: string) => {
    if (!phoneString) return '';
    const numeric = phoneString.replace(/\D/g, '');
    const cleanNum = numeric.startsWith('51') ? numeric : '51' + numeric;
    return `https://wa.me/${cleanNum}?text=Hola%20${encodeURIComponent(student.name)},%20te%20escribimos%20de%20Pacific%20Surf...`;
  };

  // Class Helpers
  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassFormError('');
    if (!classDate || !classInstructorId || !student.id) {
      setClassFormError('Por favor completa todos los campos.');
      return;
    }

    try {
      await dbAddClass({
        date: new Date(classDate).toISOString(),
        studentId: student.id,
        instructorId: classInstructorId,
        status: 'scheduled'
      });
      setShowAddClass(false);
      setClassDate('');
      setClassInstructorId('');
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setClassFormError(err.message || 'Error al agendar clase');
    }
  };

  const handleToggleClassStatus = async (cls: Class, newStatus: 'scheduled' | 'completed' | 'cancelled') => {
    try {
      const oldStatus = cls.status;
      await dbUpdateClass(cls.id!, { status: newStatus });

      // Core package class credits update triggers
      if (newStatus === 'completed' && oldStatus !== 'completed') {
        await adjustStudentClasses(student.id!, 1);
      } else if (oldStatus === 'completed' && newStatus !== 'completed') {
        await adjustStudentClasses(student.id!, -1);
      }

      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar estado de marea');
    }
  };

  const adjustStudentClasses = async (studId: string, amount: number) => {
    // Re-fetch all student packages to check latest structure
    const allSP = await dbGetStudentPackages();
    const active = allSP.find(sp => sp.studentId === studId && sp.status === 'active');
    
    if (active) {
      const newUsed = Math.max(0, active.classesUsed + amount);
      const updateData: Partial<StudentPackage> = { classesUsed: newUsed };
      
      if (newUsed >= active.totalClasses) {
        updateData.status = 'exhausted';
      } else {
        updateData.status = 'active'; // Force reset in case they were exhausted previous
      }
      
      await dbUpdateStudentPackage(active.id!, updateData);
    }
  };

  const handleDeleteClassRecord = async (cls: Class) => {
    if (!window.confirm('¿Deseas eliminar permanentemente esta reserva? Se revertirá del consumo si estaba completada.')) return;
    try {
      if (cls.status === 'completed') {
        await adjustStudentClasses(student.id!, -1);
      }
      await dbDeleteClass(cls.id!);
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
    }
  };

  // Payment Helpers
  const handleRegisterPayment = async (e: React.FormEvent, spId: string) => {
    e.preventDefault();
    setPayFormError('');
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      setPayFormError('Monto de abono inválido.');
      return;
    }

    const sp = studentPackages.find(p => p.id === spId);
    if (!sp) return;

    const remaining = sp.totalPrice - sp.amountPaid;
    if (amt > remaining) {
      if (!window.confirm(`El monto S/. ${amt} supera la deuda pendiente S/. ${remaining}. ¿Deseas aplicar el excedente de todos modos?`)) return;
    }

    try {
      // 1. Add general invoice payment row
      await dbAddPayment({
        studentPackageId: spId,
        amount: amt,
        date: new Date().toISOString(),
        method: payMethod,
        notes: payNotes || 'Abono rápido desde perfil'
      });

      // 2. Adjust collected total on package
      await dbUpdateStudentPackage(spId, {
        amountPaid: sp.amountPaid + amt
      });

      setScoringPaymentSpId(null);
      setPayAmount('');
      setPayNotes('');
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setPayFormError(err.message || 'Error al guardar abono');
    }
  };

  const handleDeletePaymentRow = async (payId: string, spId: string, amt: number) => {
    if (!window.confirm('¿Anular este abono? Se restará del total ingresado de la matrícula correspondida.')) return;
    try {
      const sp = studentPackages.find(p => p.id === spId);
      if (sp) {
        await dbUpdateStudentPackage(spId, {
          amountPaid: Math.max(0, sp.amountPaid - amt)
        });
      }
      await dbDeletePayment(payId);
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
    }
  };

  // Assign package helpers
  const handleAssignPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setPkgFormError('');
    if (!newPkgId || !student.id) {
      setPkgFormError('Por favor selecciona un paquete.');
      return;
    }

    const selectedPkg = packages.find(p => p.id === newPkgId);
    if (!selectedPkg) return;

    try {
      const initialPaid = Number(newPkgPaid) || 0;

      const spRef = await dbAddStudentPackage({
        studentId: student.id,
        packageId: selectedPkg.id!,
        packageName: selectedPkg.name,
        amountPaid: initialPaid,
        totalPrice: selectedPkg.price,
        classesUsed: 0,
        totalClasses: selectedPkg.totalClasses,
        paymentDueDate: newPkgDueDate || '',
        status: 'active'
      });

      if (initialPaid > 0 && spRef && spRef.id) {
        await dbAddPayment({
          studentPackageId: spRef.id,
          amount: initialPaid,
          date: new Date().toISOString(),
          method: 'Efectivo',
          notes: newPkgNotes || 'Venta inicial de plan desde ficha'
        });
      }

      setShowAssignPackage(false);
      setNewPkgId('');
      setNewPkgPaid('');
      setNewPkgDueDate('');
      setNewPkgNotes('');
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setPkgFormError(err.message || 'Error al vender paquete');
    }
  };

  // Edit handlers
  const handleEditClass = (cls: Class) => {
    setEditClassId(cls.id!);
    setEditClassDate(format(parseISO(cls.date), "yyyy-MM-dd'T'HH:mm"));
    setEditClassInstructorId(cls.instructorId);
  };

  const handleSaveClass = async () => {
    if (!editClassId) return;
    try {
      await dbUpdateClass(editClassId, {
        date: new Date(editClassDate).toISOString(),
        instructorId: editClassInstructorId
      });
      setEditClassId(null);
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      alert('Error al guardar clase');
    }
  };

  const handleEditPackage = (sp: StudentPackage) => {
    setEditPkgId(sp.id!);
    setEditPkgTotalPrice(String(sp.totalPrice));
    setEditPkgAmountPaid(String(sp.amountPaid));
    setEditPkgClassesUsed(String(sp.classesUsed));
    setEditPkgTotalClasses(String(sp.totalClasses));
    setEditPkgError('');
  };

  const handleSavePackage = async () => {
    if (!editPkgId) return;
    const totalPrice = Number(editPkgTotalPrice);
    const amountPaid = Number(editPkgAmountPaid);
    const classesUsed = Number(editPkgClassesUsed);
    const totalClasses = Number(editPkgTotalClasses);
    if (!totalPrice || !totalClasses) {
      setEditPkgError('Precio total y total de clases son obligatorios');
      return;
    }
    try {
      const updateData: Partial<StudentPackage> = {
        totalPrice,
        amountPaid,
        classesUsed,
        totalClasses
      };
      if (classesUsed >= totalClasses) {
        updateData.status = 'exhausted';
      } else if (amountPaid >= totalPrice) {
        updateData.status = 'active';
      }
      await dbUpdateStudentPackage(editPkgId, updateData);
      setEditPkgId(null);
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      setEditPkgError('Error al guardar cambios');
    }
  };

  const handleEditPayment = (p: Payment) => {
    setEditPaymentId(p.id!);
    setEditPayAmount(String(p.amount));
    setEditPayMethod(p.method);
    setEditPayDate(format(parseISO(p.date), "yyyy-MM-dd'T'HH:mm"));
    setEditPayNotes(p.notes || '');
    setEditPayError('');
  };

  const handleSavePayment = async () => {
    if (!editPaymentId) return;
    const amount = Number(editPayAmount);
    if (!amount || amount <= 0) {
      setEditPayError('Monto inválido');
      return;
    }
    try {
      await dbUpdatePayment(editPaymentId, {
        amount,
        method: editPayMethod,
        date: new Date(editPayDate).toISOString(),
        notes: editPayNotes
      });
      setEditPaymentId(null);
      await loadDossierData();
      if (onDataChanged) onDataChanged();
    } catch (err) {
      console.error(err);
      setEditPayError('Error al guardar pago');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
      {/* Background click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Slide Panel */}
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'tween', duration: 0.35 }}
        className="relative bg-white w-full max-w-2xl h-screen flex flex-col justify-between shadow-2xl border-l border-slate-200 z-10 overflow-hidden"
      >
        
        {/* PANEL HEADER WITH STUDENT SUMMARY */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500 text-white flex items-center justify-center font-black text-2xl shadow-lg border border-cyan-400">
              {student.name[0]?.toUpperCase()}
            </div>
            
            <div className="space-y-1">
              <h3 className="text-xl font-bold font-display tracking-tight text-white">{student.name}</h3>
              <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono tracking-widest uppercase">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Alumno Pacific Surf ID: {student.id}
              </div>
              
              {/* Profile Shortcut actions */}
              <div className="flex items-center gap-2 pt-2">
                {student.phone && (
                  <a 
                    href={`tel:${student.phone}`}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    title="Llamar"
                  >
                    <Phone className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{student.phone}</span>
                  </a>
                )}
                {student.phone && (
                  <a 
                    href={getWhatsAppLink(student.phone)}
                    target="_blank" 
                    rel="noreferrer"
                    className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    title="Mensaje Whatsapp / Recordatorios"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-100" />
                    <span>WhatsApp</span>
                  </a>
                )}
                {student.email && (
                  <a 
                    href={`mailto:${student.email}`}
                    className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition"
                    title="Enviar Correo"
                  >
                    <Mail className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="truncate max-w-[120px]">{student.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Tab Selection Row */}
          <div className="flex border-b border-white/10 mt-6 text-xs font-bold gap-4 select-none">
            <button 
              onClick={() => setActiveTab('summary')}
              className={`pb-2 outline-none transition cursor-pointer relative ${activeTab === 'summary' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              Ficha Resumen
              {activeTab === 'summary' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('packages')}
              className={`pb-2 outline-none transition cursor-pointer relative flex items-center gap-1 ${activeTab === 'packages' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              Matrículas ({studentPackages.length})
              {activeTab === 'packages' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('classes')}
              className={`pb-2 outline-none transition cursor-pointer relative flex items-center gap-1 ${activeTab === 'classes' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              Historial de Clases ({classes.length})
              {activeTab === 'classes' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full"></span>}
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={`pb-2 outline-none transition cursor-pointer relative flex items-center gap-1 ${activeTab === 'payments' ? 'text-cyan-400' : 'text-slate-400 hover:text-white'}`}
            >
              Caja / Pagos Recibidos
              {activeTab === 'payments' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-cyan-400 rounded-full"></span>}
            </button>
          </div>
        </div>

        {/* LOADING STATE OR TAB VALUE CONTEXT */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600"></div>
              <p className="text-xs text-slate-500 font-mono">Buscando expediente...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: SUMMARY SHEET */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  {/* Active Package Tracker Ring/Progress bar card */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100 p-5 rounded-2xl border border-slate-200">
                    <h4 className="text-xs font-bold tracking-widest text-slate-450 uppercase font-mono mb-3.5">Planes y Créditos de Surf</h4>
                    
                    {activePackage ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm font-bold text-slate-905 flex items-center gap-1">
                              <Award className="w-4 h-4 text-cyan-600" />
                              {activePackage.packageName}
                            </div>
                            <p className="text-slate-400 text-[11px] mt-0.5">Asignado el {student.enrollmentDate ? format(parseISO(student.enrollmentDate), 'dd/MM/yyyy') : 'recientemente'}</p>
                          </div>
                          
                          <span className="bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-150 rounded px-2 py-0.5 uppercase tracking-wide font-mono">
                            Sesión Activa
                          </span>
                        </div>

                        {/* Custom visual progress bar */}
                        <div>
                          <div className="flex justify-between text-xs font-semibold text-slate-600 mb-1.5 font-mono">
                            <span>Clases Consumidas</span>
                            <span>{activePackage.classesUsed} de {activePackage.totalClasses}</span>
                          </div>
                          <div className="w-full bg-slate-200/80 h-3 rounded-full overflow-hidden relative border border-slate-300 shadow-inner">
                            <div 
                              className="bg-gradient-to-r from-blue-505 to-cyan-500 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(105, (activePackage.classesUsed / activePackage.totalClasses) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-slate-450 mt-1.5 font-medium">
                            Tienes <strong>{activePackage.totalClasses - activePackage.classesUsed} clases restantes</strong> en la planilla para programar de inmediato.
                          </p>
                        </div>

                        {/* Balance Due Notification */}
                        {activePackage.amountPaid < activePackage.totalPrice && (
                          <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl flex items-center justify-between text-rose-850 gap-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4.5 h-4.5 text-rose-600 shrink-0" />
                              <div className="text-xs">
                                <p className="font-bold">Saldo deudor: S/. {activePackage.totalPrice - activePackage.amountPaid}</p>
                                {activePackage.paymentDueDate && (
                                  <p className="text-[10px] opacity-90 mt-0.5">Fecha límite del deudor: {activePackage.paymentDueDate}</p>
                                )}
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setScoringPaymentSpId(activePackage.id!);
                                setActiveTab('packages');
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 shrink-0"
                            >
                              💵 Abonar Saldo
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 bg-amber-50/50 border border-amber-150 text-center rounded-xl">
                        <AlertTriangle className="w-7 h-7 text-amber-650 mx-auto opacity-75 mb-2" />
                        <h5 className="text-xs font-bold text-amber-850">Sin Paquetes Activos de Surf</h5>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                          Este surfer no tiene lecciones contratadas disponibles. Es obligatorio asignarle un plan antes de dictarle lección.
                        </p>
                        <button 
                          onClick={() => {
                            setShowAssignPackage(true);
                            setActiveTab('packages');
                          }}
                          className="mt-3 bg-white text-blue-600 hover:bg-blue-50 border border-blue-200 text-xs font-bold px-4 py-1.5 rounded-lg shadow-xs transition"
                        >
                          + Comprar Plan
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Demographic & Base Profile Detail Card */}
                  <div className="bg-white rounded-xl border border-slate-150 p-4 space-y-3.5">
                    <h4 className="text-xs font-bold tracking-widest text-slate-450 uppercase font-mono pb-2 border-b border-slate-100">Información de Matrícula</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="text-slate-400 block font-mono">Edad</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{student.age ? `${student.age} años` : 'No registrado'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-mono">Fecha de Nacimiento</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{student.birthDate || 'No registrado'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-mono">Equipamiento de Marea</span>
                        <span className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-[10px] font-bold tracking-wide uppercase font-mono ${
                          student.hasBoard === 'Si' ? 'bg-emerald-50 border border-emerald-150 text-emerald-800' :
                          student.hasBoard === 'No' ? 'bg-rose-50 border border-rose-150 text-rose-800' : 'bg-amber-50 border border-amber-150 text-amber-805'
                        }`}>
                          {student.hasBoard === 'Si' ? 'Tabla Propia' : student.hasBoard === 'No' ? 'Usa de Escuela' : 'En proceso'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-mono">Apoderado</span>
                        <span className="font-bold text-slate-800 text-sm mt-0.5 block">{student.parentsName || 'Ninguno (Mayor de edad)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Micro dashboard agenda block of today and next lessons */}
                  <div className="bg-white rounded-xl border border-slate-150 overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-150 bg-slate-50/50 flex justify-between items-center">
                      <span className="text-xs font-bold tracking-widest text-slate-450 uppercase font-mono">Próximos Turnos de Agenda</span>
                      <button 
                        onClick={() => setActiveTab('classes')}
                        className="text-blue-600 text-[11px] font-bold hover:underline"
                      >
                        Ver todos
                      </button>
                    </div>
                    
                    <div className="divide-y divide-slate-100 text-xs">
                      {classes.slice(0, 3).map(cls => {
                        const coach = instructors.find(i => i.id === cls.instructorId)?.name || 'Asistente';
                        return (
                          <div key={cls.id} className="p-4 flex justify-between items-center hover:bg-slate-50/60">
                            <div>
                              <p className="font-bold text-slate-900">{format(parseISO(cls.date), 'dd/MM/yyyy HH:mm')} hrs</p>
                              <p className="text-slate-450 mt-0.5">Coach: {coach}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider font-mono ${
                              cls.status === 'scheduled' ? 'bg-cyan-50 border border-cyan-100 text-cyan-800' :
                              cls.status === 'completed' ? 'bg-emerald-50 border border-emerald-100 text-emerald-800' : 
                              'bg-rose-50 border border-rose-100 text-rose-800'
                            }`}>
                              {cls.status === 'scheduled' ? 'Agendada' : cls.status === 'completed' ? 'Completada' : 'Cancelada'}
                            </span>
                          </div>
                        );
                      })}
                      {classes.length === 0 && (
                        <p className="p-6 text-slate-400 text-center italic">No hay clases programadas.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PACKAGES / MATRICULAS EXPEDIENTE */}
              {activeTab === 'packages' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm font-display">Historial de Matrículas</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Controla la vigencia, abonos y deudas contratadas por el estudiante.</p>
                    </div>
                    {!showAssignPackage && (
                      <button 
                        onClick={() => setShowAssignPackage(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition"
                      >
                        + Vender Plan
                      </button>
                    )}
                  </div>

                  {/* Expandable Sell New Package forms */}
                  {showAssignPackage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4"
                    >
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <h5 className="text-xs font-black uppercase text-slate-650 tracking-wider">Registrar Venta de Plan Académico</h5>
                        <button onClick={() => setShowAssignPackage(false)} className="text-slate-400 hover:text-slate-700 text-xs font-bold">Cerrar</button>
                      </div>

                      <form onSubmit={handleAssignPackage} className="space-y-3 mr-1 text-xs">
                        <div>
                          <label className="block text-slate-500 font-bold mb-1">Elegir Paquete de Clases *</label>
                          <select 
                            required 
                            value={newPkgId} 
                            onChange={e => setNewPkgId(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl w-full p-2.5"
                          >
                            <option value="">-- Selecciona --</option>
                            {packages.map(p => (
                              <option key={p.id} value={p.id}>{p.name} (S/. {p.price} - {p.totalClasses} lecciones)</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Monto Inicial Recibido (S/.)</label>
                            <input 
                              type="text" 
                              placeholder="0"
                              value={newPkgPaid} 
                              onChange={e => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) setNewPkgPaid(val);
                              }} 
                              className="bg-white border border-slate-200 rounded-xl w-full p-2.5" 
                            />
                          </div>
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Límite Pago Pendiente</label>
                            <input 
                              type="date" 
                              value={newPkgDueDate} 
                              onChange={e => setNewPkgDueDate(e.target.value)}
                              className="bg-white border border-slate-200 rounded-xl w-full p-2.5" 
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-500 font-bold mb-1">Anotaciones de Cobro</label>
                          <input 
                            type="text" 
                            placeholder="Ej: Código Yape o abono de mamá" 
                            value={newPkgNotes} 
                            onChange={e => setNewPkgNotes(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl w-full p-2.5" 
                          />
                        </div>

                        {pkgFormError && <p className="text-red-500 font-bold text-[10px]">{pkgFormError}</p>}

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button type="button" onClick={() => setShowAssignPackage(false)} className="px-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer">Cancelar</button>
                          <button type="submit" className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/10 cursor-pointer transition">Completar Matrícula</button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* List of packages purchased on record */}
                  <div className="space-y-4">
                    {studentPackages.map(sp => {
                      const balance = sp.totalPrice - sp.amountPaid;
                      const hasRep = sp.amountPaid < sp.totalPrice;
                      
                      return (
                        <div key={sp.id} className="bg-white rounded-2xl border border-slate-150 p-5 space-y-4 relative overflow-hidden shadow-xs">
                          {/* Top row */}
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h5 className="font-bold text-slate-900 border-b border-dashed border-slate-200 pb-0.5 inline-block text-[13px]">{sp.packageName}</h5>
                              <div className="flex items-center gap-2 mt-2 font-mono text-[10px] text-slate-400">
                                <span>TOTAL: S/. {sp.totalPrice}</span>
                                <span>•</span>
                                <span className="font-bold text-emerald-600">PAGADO: S/. {sp.amountPaid}</span>
                              </div>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] rounded-lg font-bold uppercase tracking-wider font-mono
                              ${sp.status === 'active' ? 'bg-cyan-50 text-cyan-800 border border-cyan-100' : 
                                sp.status === 'exhausted' ? 'bg-slate-100 text-slate-650' : 'bg-red-50 text-red-800'}`}>
                              {sp.status === 'active' ? 'Sesión Activa' : sp.status === 'exhausted' ? 'Agotado' : 'Expirado'}
                            </span>
                          </div>

                          {/* Progress classes count */}
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between font-mono text-[10px] text-slate-455 font-bold">
                              <span>Consumidas: {sp.classesUsed} de {sp.totalClasses}</span>
                              <span>{Math.round((sp.classesUsed / sp.totalClasses) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                              <div className="bg-blue-505 h-full rounded-full" style={{ width: `${(sp.classesUsed / sp.totalClasses) * 100}%` }} />
                            </div>
                          </div>

                          {/* Action area inside card */}
                          <div className="flex justify-between items-center pt-3 border-t border-slate-100 text-xs">
                            {hasRep ? (
                              <div className="text-slate-650 font-medium">
                                Deuda: <strong className="text-red-650 font-mono text-sm leading-none">S/. {balance}</strong>
                                {sp.paymentDueDate && <span className="block text-[9px] text-slate-400 font-mono">Vence: {sp.paymentDueDate}</span>}
                              </div>
                            ) : (
                              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" /> Pagado Completo
                              </span>
                            )}

                            <div className="flex items-center gap-2">
                              {editPkgId !== sp.id && (
                                <button 
                                  onClick={() => handleEditPackage(sp)}
                                  className="text-blue-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition"
                                  title="Ajustar precio y clases"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {hasRep && scoringPaymentSpId !== sp.id && (
                                <button 
                                  onClick={() => setScoringPaymentSpId(sp.id!)}
                                  className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-bold px-3 py-1.5 rounded-xl transition"
                                >
                                  💵 Abonar Dinero
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Inline edit form for package price/classes */}
                          {editPkgId === sp.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 bg-amber-50/50 border border-amber-200 p-4 rounded-xl space-y-3 text-xs"
                            >
                              <div className="flex justify-between items-center border-b border-amber-200/50 pb-1.5">
                                <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800">Ajustar Precio y Clases</span>
                                <button onClick={() => setEditPkgId(null)} className="text-slate-400 font-bold hover:text-slate-700">Cerrar</button>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">Precio Total (S/.)</label>
                                  <input
                                    type="text"
                                    value={editPkgTotalPrice}
                                    onChange={e => /^\d*\.?\d*$/.test(e.target.value) && setEditPkgTotalPrice(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg w-full p-2 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">Monto Pagado (S/.)</label>
                                  <input
                                    type="text"
                                    value={editPkgAmountPaid}
                                    onChange={e => /^\d*\.?\d*$/.test(e.target.value) && setEditPkgAmountPaid(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg w-full p-2 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">Clases Usadas</label>
                                  <input
                                    type="text"
                                    value={editPkgClassesUsed}
                                    onChange={e => /^\d*$/.test(e.target.value) && setEditPkgClassesUsed(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg w-full p-2 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1">Total Clases</label>
                                  <input
                                    type="text"
                                    value={editPkgTotalClasses}
                                    onChange={e => /^\d*$/.test(e.target.value) && setEditPkgTotalClasses(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg w-full p-2 font-bold"
                                  />
                                </div>
                              </div>
                              {editPkgError && <p className="text-red-500 font-bold text-[10px]">{editPkgError}</p>}
                              <div className="flex justify-end gap-2 pt-2 border-t border-amber-200/50">
                                <button onClick={() => setEditPkgId(null)} className="px-3 py-1.5 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition cursor-pointer">Cancelar</button>
                                <button onClick={handleSavePackage} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-sm transition cursor-pointer">Guardar Cambios</button>
                              </div>
                            </motion.div>
                          )}

                          {/* Expandable Abono form inside this package card */}
                          {scoringPaymentSpId === sp.id && (
                            <motion.div 
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 bg-slate-50 border border-slate-150 p-4 rounded-xl space-y-3.5 text-xs text-slate-805"
                            >
                              <div className="flex justify-between items-center border-b border-slate-200/50 pb-1.5">
                                <span className="font-bold uppercase tracking-wider text-[10px]">Formulario de Abono Rápido</span>
                                <button onClick={() => setScoringPaymentSpId(null)} className="text-slate-400 font-bold hover:text-slate-700">Ocultar</button>
                              </div>

                              <form onSubmit={(e) => handleRegisterPayment(e, sp.id!)} className="space-y-3 mr-0.5">
                                <div className="grid grid-cols-2 gap-3.5">
                                  <div>
                                    <label className="block text-slate-500 font-semibold mb-1">Monto a Abonar (S/.) *</label>
                                    <input 
                                      required 
                                      type="text" 
                                      placeholder="Monto"
                                      value={payAmount} 
                                      onChange={e => {
                                        const val = e.target.value;
                                        if (val === '' || /^\d*\.?\d*$/.test(val)) setPayAmount(val);
                                      }}
                                      className="bg-white border border-slate-200 rounded-lg w-full p-2.5 font-bold text-slate-900" 
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-slate-500 font-semibold mb-1">Método *</label>
                                    <select 
                                      value={payMethod}
                                      onChange={e => setPayMethod(e.target.value as any)}
                                      className="bg-white border border-slate-200 rounded-lg w-full p-2.5"
                                    >
                                      <option value="Efectivo">Efectivo (Caja)</option>
                                      <option value="Transferencia">Transferencia</option>
                                      <option value="Yape">Yape</option>
                                      <option value="Plin">Plin</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-slate-500 font-semibold mb-1 font-sans">Notas o Código Op.</label>
                                  <input 
                                    type="text" 
                                    placeholder="Operación #..." 
                                    value={payNotes} 
                                    onChange={e => setPayNotes(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-lg w-full p-2.5" 
                                  />
                                </div>

                                {payFormError && <p className="text-red-500 font-bold font-mono text-[10px]">{payFormError}</p>}

                                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                  <button type="button" onClick={() => setScoringPaymentSpId(null)} className="px-3.5 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold hover:bg-slate-50 transition cursor-pointer">Cancelar</button>
                                  <button type="submit" className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-md shadow-emerald-500/10 cursor-pointer transition">Registrar</button>
                                </div>
                              </form>
                            </motion.div>
                          )}
                        </div>
                      );
                    })}
                    {studentPackages.length === 0 && (
                      <p className="p-6 text-slate-400 text-center italic bg-slate-50 rounded-xl">Ningún plan registrado en la bitácora.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: CLASSES HISTORY / PROGRAMADORA */}
              {activeTab === 'classes' && (
                <div className="space-y-6 text-xs">
                  <div className="flex justify-between items-center bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm font-display">Clases del Surfer</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Control de asistencia, reservas y coaches vinculados.</p>
                    </div>
                    {!showAddClass && (
                      <button 
                        onClick={() => setShowAddClass(true)}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-xs transition"
                      >
                        + Agendar Turno
                      </button>
                    )}
                  </div>

                  {/* Inline Quick scheduled class forms */}
                  {showAddClass && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 text-xs"
                    >
                      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                        <span className="font-bold uppercase tracking-wider text-[10px] text-slate-650">Reservar Clase de Surf</span>
                        <button onClick={() => setShowAddClass(false)} className="text-slate-400 hover:text-slate-700 font-bold">Cerrar</button>
                      </div>

                      <form onSubmit={handleCreateClass} className="space-y-3 mr-0.5">
                        <div className="grid grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Fecha y Hora *</label>
                            <input 
                              required 
                              type="datetime-local" 
                              value={classDate} 
                              onChange={e => setClassDate(e.target.value)}
                              className="bg-white border border-slate-200 rounded-xl w-full p-2.5 text-slate-805" 
                            />
                          </div>
                          
                          <div>
                            <label className="block text-slate-500 font-bold mb-1">Coach Autorizado *</label>
                            <select 
                              required 
                              value={classInstructorId} 
                              onChange={e => setClassInstructorId(e.target.value)}
                              className="bg-white border border-slate-200 rounded-xl w-full p-2.5 text-slate-805"
                            >
                              <option value="">-- Elige Coach --</option>
                              {instructors.map(i => (
                                <option key={i.id} value={i.id}>{i.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {classFormError && <p className="text-red-500 font-mono font-bold text-[10px]">{classFormError}</p>}

                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                          <button type="button" onClick={() => setShowAddClass(false)} className="px-3 py-1.5 border border-slate-200 rounded-xl font-medium">Cancelar</button>
                          <button type="submit" className="px-4 py-1.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500">Agendar Reserva</button>
                        </div>
                      </form>
                    </motion.div>
                  )}

                  {/* List of classes for this surfer */}
                  <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-150">
                      <thead className="bg-slate-50 text-slate-450 font-bold uppercase tracking-widest text-[9px] font-mono">
                        <tr>
                          <th className="px-5 py-2.5 text-left">Horario / Fecha</th>
                          <th className="px-5 py-2.5 text-left">Instructor</th>
                          <th className="px-5 py-2.5 text-left">Asistencia</th>
                          <th className="px-5 py-2.5 text-center">Editar</th>
                          <th className="px-5 py-2.5 text-right">Anular</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-705">
                        {classes.map(cls => {
                          const coachName = instructors.find(i => i.id === cls.instructorId)?.name || 'Sin asignar';
                          const isEditing = editClassId === cls.id;
                          
                          if (isEditing) {
                            return (
                              <tr key={cls.id} className="bg-cyan-50/30">
                                <td className="px-5 py-3 whitespace-nowrap">
                                  <input
                                    type="datetime-local"
                                    value={editClassDate}
                                    onChange={e => setEditClassDate(e.target.value)}
                                    className="border border-slate-200 rounded-lg p-1.5 text-xs w-full"
                                  />
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap">
                                  <select
                                    value={editClassInstructorId}
                                    onChange={e => setEditClassInstructorId(e.target.value)}
                                    className="border border-slate-200 rounded-lg p-1.5 text-xs w-full"
                                  >
                                    <option value="">-- Elige Coach --</option>
                                    {instructors.map(i => (
                                      <option key={i.id} value={i.id}>{i.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-slate-400 text-[10px]">
                                  {cls.status === 'scheduled' ? 'Agendada' : cls.status === 'completed' ? 'Completada' : 'Cancelada'}
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-center">
                                  <button
                                    onClick={handleSaveClass}
                                    className="text-emerald-600 hover:text-emerald-800 font-bold text-[10px] px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                                  >
                                    Guardar
                                  </button>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-right">
                                  <button
                                    onClick={() => setEditClassId(null)}
                                    className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          }
                          
                          return (
                            <tr key={cls.id} className="hover:bg-slate-50/50">
                              <td className="px-5 py-3 whitespace-nowrap font-bold text-slate-900 font-display">
                                {format(parseISO(cls.date), 'dd/MM/yyyy HH:mm')} hrs
                              </td>
                              <td className="px-5 py-3 whitespace-nowrap text-slate-600">
                                {coachName}
                              </td>
                              <td className="px-5 py-3 whitespace-nowrap">
                                <select 
                                  value={cls.status}
                                  onChange={(e) => handleToggleClassStatus(cls, e.target.value as any)}
                                  className="text-[10px] rounded-lg border border-slate-205 p-1 bg-white font-medium focus:ring-1 focus:ring-cyan-500 outline-none"
                                >
                                  <option value="scheduled">Agendada</option>
                                  <option value="completed">Completada (Asiste)</option>
                                  <option value="cancelled">Cancelada</option>
                                </select>
                              </td>
                              <td className="px-5 py-3 whitespace-nowrap text-center">
                                <button 
                                  onClick={() => handleEditClass(cls)}
                                  className="text-blue-400 hover:text-blue-600 p-1 rounded-md"
                                  title="Editar fecha y instructor"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </td>
                              <td className="px-5 py-3 whitespace-nowrap text-right">
                                <button 
                                  onClick={() => handleDeleteClassRecord(cls)}
                                  className="text-red-400 hover:text-red-600 p-1 rounded-md"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                        {classes.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-slate-400 italic">No hay registros de lecciones pasadas ni programadas.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: CASE REGISTER / PAYMENTS LEDGER */}
              {activeTab === 'payments' && (
                <div className="space-y-6 text-xs">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm font-display">Bitácora de Recibo</h4>
                      <p className="text-slate-400 text-xs mt-0.5">Lista de todas las cuotas y aportes depositados por el alumno.</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1 text-emerald-800 font-mono text-[11px] font-bold">
                      Aportado Total: S/. {payments.filter(p => studentPackages.some(sp => sp.id === p.studentPackageId)).reduce((sum, current) => sum + current.amount, 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden shadow-xs">
                    <table className="min-w-full divide-y divide-slate-150">
                      <thead className="bg-slate-50 text-slate-450 font-bold uppercase tracking-widest text-[9px] font-mono">
                        <tr>
                          <th className="px-5 py-2.5 text-left">Fecha Registro</th>
                          <th className="px-5 py-2.5 text-left">Concepto / Plan</th>
                          <th className="px-5 py-2.5 text-left">Método</th>
                          <th className="px-5 py-2.5 text-left">Monto Recibido</th>
                          <th className="px-5 py-2.5 text-center">Editar</th>
                          <th className="px-5 py-2.5 text-right">Anular</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150 text-slate-705">
                        {payments
                          .filter(p => studentPackages.some(sp => sp.id === p.studentPackageId))
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(p => {
                            const refSpName = studentPackages.find(sp => sp.id === p.studentPackageId)?.packageName || 'Surf Plan';
                            const isEditing = editPaymentId === p.id;
                            
                            if (isEditing) {
                              return (
                                <tr key={p.id} className="bg-amber-50/40">
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <input
                                      type="datetime-local"
                                      value={editPayDate}
                                      onChange={e => setEditPayDate(e.target.value)}
                                      className="border border-slate-200 rounded-lg p-1 text-[10px] w-full"
                                    />
                                  </td>
                                  <td className="px-5 py-3">
                                    <input
                                      type="text"
                                      value={editPayNotes}
                                      onChange={e => setEditPayNotes(e.target.value)}
                                      placeholder="Notas u operación"
                                      className="border border-slate-200 rounded-lg p-1 text-[10px] w-full"
                                    />
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <select
                                      value={editPayMethod}
                                      onChange={e => setEditPayMethod(e.target.value as any)}
                                      className="border border-slate-200 rounded-lg p-1 text-[10px]"
                                    >
                                      <option value="Efectivo">Efectivo</option>
                                      <option value="Transferencia">Transferencia</option>
                                      <option value="Yape">Yape</option>
                                      <option value="Plin">Plin</option>
                                    </select>
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap">
                                    <input
                                      type="text"
                                      value={editPayAmount}
                                      onChange={e => /^\d*\.?\d*$/.test(e.target.value) && setEditPayAmount(e.target.value)}
                                      className="border border-slate-200 rounded-lg p-1 text-[10px] w-20 font-bold"
                                    />
                                    {editPayError && <span className="block text-red-500 text-[8px] font-bold">{editPayError}</span>}
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap text-center">
                                    <button
                                      onClick={handleSavePayment}
                                      className="text-emerald-600 hover:text-emerald-800 font-bold text-[10px] px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
                                    >
                                      Guardar
                                    </button>
                                  </td>
                                  <td className="px-5 py-3 whitespace-nowrap text-right">
                                    <button
                                      onClick={() => setEditPaymentId(null)}
                                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            }
                            
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/55">
                                <td className="px-5 py-3 whitespace-nowrap font-mono text-[10px]">
                                  {format(parseISO(p.date), 'dd/MM/yyyy HH:mm')}
                                </td>
                                <td className="px-5 py-3 text-slate-900 font-bold truncate max-w-[130px]" title={refSpName}>
                                  {refSpName}
                                  {p.notes && <span className="block font-normal text-[9px] text-slate-400 italic font-sans">{p.notes}</span>}
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-0.5 mt-1 rounded text-[9px] font-bold uppercase font-mono tracking-wide
                                    ${p.method === 'Efectivo' ? 'bg-emerald-55/60 text-emerald-800' : 
                                      p.method === 'Yape' ? 'bg-purple-100 text-purple-800' : 
                                      p.method === 'Plin' ? 'bg-cyan-100 text-cyan-800' : 
                                      'bg-slate-105 text-slate-700'}`}>
                                    {p.method}
                                  </span>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap font-bold text-slate-905 font-mono">
                                  S/. {p.amount}
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-center">
                                  <button 
                                    onClick={() => handleEditPayment(p)}
                                    className="text-blue-400 hover:text-blue-600 p-1 rounded-md"
                                    title="Editar pago"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-right">
                                  <button 
                                    onClick={() => handleDeletePaymentRow(p.id!, p.studentPackageId, p.amount)}
                                    className="text-red-400 hover:text-red-650 p-1 rounded-md"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        {payments.filter(p => studentPackages.some(sp => sp.id === p.studentPackageId)).length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-5 py-8 text-center text-slate-400 italic">No hay historial de cuotas registradas para este alumno.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* PROFILE CARD MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-205 flex justify-end">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm active:scale-98 transition"
          >
            Cerrar Expediente
          </button>
        </div>

      </motion.div>
    </div>
  );
}
