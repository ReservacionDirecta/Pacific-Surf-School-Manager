import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Package,
  Plus,
  Trash2,
  Edit,
  X,
  Search,
  LayoutGrid,
  Users,
  UserCheck,
  ClipboardList,
  Tablet,
  Shirt
} from 'lucide-react';
import { Equipment, Student, Instructor } from '../types';
import { getEquipment, addEquipment, updateEquipment, deleteEquipment, getStudents, getInstructors } from '../services/db';

const EQUIPMENT_TYPES = ['Tabla', 'Wetsuit', 'Lycra'] as const;
const CONDITIONS = ['Nuevo', 'Bueno', 'Regular', 'Mal estado'] as const;
const STATUSES = ['Disponible', 'En uso', 'En mantenimiento', 'Perdido'] as const;

export default function EquipmentManager() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [activeTab, setActiveTab] = useState<'inventario' | 'alumnos' | 'guias'>('inventario');
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Equipment | null>(null);
  const [filter, setFilter] = useState('');
  const [filterType, setFilterType] = useState('Todos');

  const [formType, setFormType] = useState<Equipment['type']>('Tabla');
  const [formSize, setFormSize] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formCondition, setFormCondition] = useState<Equipment['condition']>('Nuevo');
  const [formStatus, setFormStatus] = useState<Equipment['status']>('Disponible');
  const [formNotes, setFormNotes] = useState('');
  const [formAssignType, setFormAssignType] = useState<Equipment['assignedToType']>('');
  const [formAssignId, setFormAssignId] = useState('');

  const fetchData = async () => {
    try {
      const [eData, sData, iData] = await Promise.all([getEquipment(), getStudents(), getInstructors()]);
      setItems(eData);
      setStudents(sData);
      setInstructors(iData);
    } catch (err) {
      console.error('Error fetching equipment data:', err);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const resetForm = () => {
    setFormType('Tabla');
    setFormSize('');
    setFormBrand('');
    setFormCondition('Nuevo');
    setFormStatus('Disponible');
    setFormNotes('');
    setFormAssignType('');
    setFormAssignId('');
  };

  const handleEdit = (item: Equipment) => {
    setEditingItem(item);
    setFormType(item.type);
    setFormSize(item.size);
    setFormBrand(item.brand || '');
    setFormCondition(item.condition);
    setFormStatus(item.status);
    setFormNotes(item.notes || '');
    setFormAssignType(item.assignedToType || '');
    setFormAssignId(item.assignedToId || '');
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingItem(null);
    resetForm();
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        type: formType,
        size: formSize,
        brand: formBrand,
        condition: formCondition,
        status: formStatus,
        notes: formNotes,
        assignedToType: formAssignType,
        assignedToId: formAssignId,
        assignedToName: formAssignType === 'student'
          ? students.find(s => s.id === formAssignId)?.name || ''
          : formAssignType === 'instructor'
            ? instructors.find(i => i.id === formAssignId)?.name || ''
            : ''
      };

      if (editingItem?.id) {
        await updateEquipment(editingItem.id, payload);
      } else {
        await addEquipment(payload);
      }
      await fetchData();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Error saving equipment:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar este equipo?')) return;
    try {
      await deleteEquipment(id);
      await fetchData();
    } catch (err) {
      console.error('Error deleting equipment:', err);
    }
  };

  // Filtered inventory
  const filteredInventory = items.filter(item => {
    if (filterType !== 'Todos' && item.type !== filterType) return false;
    if (filter) {
      const q = filter.toLowerCase();
      return item.type.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        (item.brand && item.brand.toLowerCase().includes(q)) ||
        (item.notes && item.notes.toLowerCase().includes(q));
    }
    return true;
  });

  // Students with own board
  const studentsWithBoard = students.filter(s => s.hasBoard === 'Si');

  // Equipment assigned to instructors
  const guideEquipment = items.filter(item => item.assignedToType === 'instructor');

  const typeIcon = (t: string) => {
    switch (t) {
      case 'Tabla': return <Tablet className="w-4 h-4" />;
      case 'Wetsuit': return <Shirt className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const typeColor = (t: string) => {
    switch (t) {
      case 'Tabla': return 'bg-cyan-50 border-cyan-200 text-cyan-700';
      case 'Wetsuit': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'Lycra': return 'bg-pink-50 border-pink-200 text-pink-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Disponible': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'En uso': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'En mantenimiento': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Perdido': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 rounded-2xl shadow-md border border-slate-700 gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-1">
            <ClipboardList className="w-4 h-4" /> Gestión de Equipamiento
          </div>
          <h2 className="text-2xl font-extrabold font-display text-white tracking-tight">Inventario de Equipo</h2>
          <p className="text-sm text-slate-300">Tablas, wetsuits y lycras de la escuela, alumnos y guías.</p>
        </div>
        <div className="flex bg-slate-800/80 p-1.5 rounded-xl border border-slate-700 text-xs select-none self-start relative z-10">
          <button onClick={() => setActiveTab('inventario')}
            className={`px-4 py-2.5 rounded-lg font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'inventario' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Inventario Escuela
          </button>
          <button onClick={() => setActiveTab('alumnos')}
            className={`px-4 py-2.5 rounded-lg font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'alumnos' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Tablas de Alumnos
          </button>
          <button onClick={() => setActiveTab('guias')}
            className={`px-4 py-2.5 rounded-lg font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'guias' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Equipo de Guías
          </button>
        </div>
      </div>

      {activeTab === 'inventario' && (
        <>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-150 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
            <div className="flex-1 md:max-w-md relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </span>
              <input type="text" placeholder="Buscar por tipo, talla, marca..."
                value={filter} onChange={e => setFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-400 outline-none transition"
              />
            </div>
            <div className="flex items-center gap-3">
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                className="rounded-xl border border-slate-200 text-slate-800 bg-white px-3 py-2 text-xs font-semibold focus:border-cyan-500 outline-none transition"
              >
                <option value="Todos">Todos los tipos</option>
                {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={handleAdd}
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md cursor-pointer transition active:scale-98 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Agregar Equipo
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-150">
                <thead className="bg-slate-50/70">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Tipo</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Talla</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Marca</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Estado</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Condición</th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Asignado A</th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredInventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${typeColor(item.type)}`}>
                          {typeIcon(item.type)} {item.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{item.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.brand || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">{item.condition}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {item.assignedToName ? (
                          <span className="font-semibold text-slate-700">{item.assignedToName}</span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEdit(item)}
                            className="text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                          >
                            <Edit className="w-3.5 h-3.5" /> Editar
                          </button>
                          <button onClick={() => handleDelete(item.id!)}
                            className="text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-400 bg-slate-50/45 italic">
                        <Package className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        No hay equipos registrados. Agrega tablas, wetsuits y lycras.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'alumnos' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-150 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg font-display">Alumnos con Tabla Propia</h3>
              <p className="text-xs text-slate-450">{studentsWithBoard.length} alumnos traen su propia tabla</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Alumno</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Teléfono</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Edad</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">¿Tiene Tabla?</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {studentsWithBoard.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{s.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{s.phone || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{s.age || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide uppercase font-mono bg-emerald-50 border border-emerald-150 text-emerald-800">
                        Sí (propia)
                      </span>
                    </td>
                  </tr>
                ))}
                {studentsWithBoard.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-400 bg-slate-50/45 italic">
                      Ningún alumno tiene tabla propia registrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'guias' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-150 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-amber-600">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg font-display">Equipo Asignado a Guías</h3>
              <p className="text-xs text-slate-450">{guideEquipment.length} equipos en uso por instructores</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-150">
              <thead className="bg-slate-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Equipo</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Talla</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Marca</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Guía Asignado</th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Condición</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {guideEquipment.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${typeColor(item.type)}`}>
                        {typeIcon(item.type)} {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{item.size}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">{item.brand || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">{item.assignedToName || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">{item.condition}</td>
                  </tr>
                ))}
                {guideEquipment.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400 bg-slate-50/45 italic">
                      No hay equipos asignados a guías. Asigna equipo desde el inventario.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">{editingItem ? 'Editar Equipo' : 'Agregar Equipo'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition" type="button">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo *</label>
                <select required value={formType} onChange={e => setFormType(e.target.value as Equipment['type'])}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                >
                  {EQUIPMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Talla *</label>
                <input required type="text" value={formSize} onChange={e => setFormSize(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition"
                  placeholder="Ej: 6'0&apos;&apos;, M, S"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Marca</label>
                <input type="text" value={formBrand} onChange={e => setFormBrand(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition"
                  placeholder="Ej: Torq, Rip Curl, O&apos;Neill"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Condición *</label>
                  <select required value={formCondition} onChange={e => setFormCondition(e.target.value as Equipment['condition'])}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                  >
                    {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Estado *</label>
                  <select required value={formStatus} onChange={e => setFormStatus(e.target.value as Equipment['status'])}
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition"
                  placeholder="Ej: Tiene un parche"
                />
              </div>
              <div className="border-t border-slate-100 pt-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Asignar a</label>
                <select value={formAssignType} onChange={e => setFormAssignType(e.target.value as Equipment['assignedToType'])}
                  className="block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                >
                  <option value="">-- Sin asignar --</option>
                  <option value="student">Alumno</option>
                  <option value="instructor">Guía / Instructor</option>
                </select>
                {formAssignType === 'student' && (
                  <select value={formAssignId} onChange={e => setFormAssignId(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                  >
                    <option value="">-- Seleccionar Alumno --</option>
                    {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}
                {formAssignType === 'instructor' && (
                  <select value={formAssignId} onChange={e => setFormAssignId(e.target.value)}
                    className="mt-2 block w-full rounded-xl border border-slate-200 text-slate-800 bg-white px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                  >
                    <option value="">-- Seleccionar Guía --</option>
                    {instructors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition w-full sm:w-auto"
                >Cancelar</button>
                <button type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer transition active:scale-98 w-full sm:w-auto"
                >{editingItem ? 'Guardar Cambios' : 'Agregar'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}