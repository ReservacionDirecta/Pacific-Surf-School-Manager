import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  UserPlus, 
  Trash2, 
  Edit, 
  X, 
  Phone, 
  Mail, 
  Compass,
  Briefcase 
} from 'lucide-react';
import { Instructor } from '../types';
import { addInstructor, getInstructors, updateInstructor, deleteInstructor } from '../services/db';

export default function Instructors() {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<Instructor | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const fetchData = async () => {
    try {
      const data = await getInstructors();
      setInstructors(data);
    } catch (error) {
      console.error("Error fetching instructors:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEditClick = (instructor: Instructor) => {
    setEditingInstructor(instructor);
    setName(instructor.name);
    setEmail(instructor.email || '');
    setPhone(instructor.phone || '');
    setShowAddModal(true);
  };

  const handleOpenAddModal = () => {
    setEditingInstructor(null);
    setName('');
    setEmail('');
    setPhone('');
    setShowAddModal(true);
  };

  const handleDeleteInstructor = async (id: string) => {
    if (!window.confirm('¿Seguro de que deseas eliminar este instructor de la escuela de surf?')) return;
    try {
      await deleteInstructor(id);
      await fetchData();
    } catch (e) {
      console.error("Error deleting instructor:", e);
      alert("Error al eliminar instructor");
    }
  };

  const handleAddInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingInstructor && editingInstructor.id) {
        await updateInstructor(editingInstructor.id, { name, email, phone });
      } else {
        await addInstructor({ name, email, phone });
      }
      await fetchData();
      setShowAddModal(false);
      setName('');
      setEmail('');
      setPhone('');
      setEditingInstructor(null);
    } catch (error) {
      console.error("Error saving instructor:", error);
      alert("Error al guardar instructor");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-150 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-900 tracking-tight font-display">Staff de Coaches</h2>
          <p className="text-sm text-slate-400">Coordinación de instructores oficiales para clases diarias y control de asistencia.</p>
        </div>
        <button 
          onClick={handleOpenAddModal}
          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-2 text-sm active:scale-98"
        >
          <UserPlus className="w-4.5 h-4.5" />
          Registrar Coach
        </button>
      </div>

      {/* Instructors table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-150 overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-150">
          <thead className="bg-slate-50/70">
            <tr>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Nombre de Instructor</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Correo Electrónico</th>
              <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Celular / WhatsApp</th>
              <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-150">
            {instructors.map(instructor => (
              <tr key={instructor.id} className="hover:bg-slate-50/55 transition duration-150">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm shrink-0 border border-violet-100">
                      {instructor.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 font-display">{instructor.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {instructor.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                  {instructor.email ? (
                    <div className="flex items-center gap-1.5">
                      <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{instructor.email}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                  {instructor.phone ? (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{instructor.phone}</span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-bold space-x-3">
                  <button 
                    onClick={() => handleEditClick(instructor)}
                    className="text-blue-600 hover:text-blue-700 transition cursor-pointer inline-flex items-center gap-1 hover:underline"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    Editar
                  </button>
                  <button 
                    onClick={() => handleDeleteInstructor(instructor.id!)}
                    className="text-red-500 hover:text-red-650 transition cursor-pointer inline-flex items-center gap-1 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {instructors.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-450 bg-slate-50/50 italic">
                  Aún no se han registrado instructores para la escuela.
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
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">
                {editingInstructor ? 'Editar Coach' : 'Registrar Nuevo Coach'}
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddInstructor} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Coach *</label>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: Coach Renato" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="renato@pacificsurf.com" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono / WhatsApp</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: 991283724" 
                />
              </div>

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
                  {editingInstructor ? 'Guardar Cambios' : 'Registrar Coach'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
