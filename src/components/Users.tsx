import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Users as UsersIcon, Plus, X, Save, Trash2, RotateCw, Pencil, ShieldAlert } from 'lucide-react';
import { AppUser } from '../types';
import { getUsers, addUser, updateUser, deleteUser } from '../services/db';

export default function Users() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormName('');
    setFormPassword('');
    setError('');
    setShowModal(true);
  };

  const openEdit = (u: AppUser) => {
    setEditingUser(u);
    setFormEmail(u.email);
    setFormName(u.name || '');
    setFormPassword('');
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingUser) {
        const payload: Partial<AppUser> = { email: formEmail, name: formName };
        if (formPassword) payload.password = formPassword;
        await updateUser(editingUser.id!, payload);
      } else {
        if (!formPassword) { setError('La contraseña es obligatoria'); return; }
        await addUser({ email: formEmail, name: formName, password: formPassword });
      }
      setShowModal(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Error al guardar usuario');
    }
  };

  const handleDelete = async (u: AppUser) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.email}"?`)) return;
    try {
      await deleteUser(u.id!);
      await fetchUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl shadow-md border border-slate-700 gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-bold tracking-widest uppercase mb-1">
            <ShieldAlert className="w-4 h-4 text-cyan-400" /> Administración
          </div>
          <h2 className="text-2xl font-extrabold font-display text-white tracking-tight">Gestión de Usuarios</h2>
          <p className="text-sm text-slate-300">Crear, editar y eliminar cuentas de acceso al sistema.</p>
        </div>
        <button onClick={openCreate}
          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl shadow-lg cursor-pointer transition flex items-center gap-1.5 text-xs active:scale-98"
        >
          <Plus className="w-4 h-4" />
          Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-150">
        <div className="px-6 py-4 border-b border-slate-150 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-650 uppercase tracking-widest font-mono">Usuarios del Sistema</h3>
          <button onClick={fetchUsers} className="p-2 rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition cursor-pointer" title="Refrescar">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-150">
            <thead className="bg-slate-50/10">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Email</th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Nombre</th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-slate-400 uppercase tracking-widest font-mono">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-150">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-slate-900 font-bold">{u.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-650">{u.name || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold transition cursor-pointer border border-amber-200"
                      >
                        <Pencil className="w-3 h-3" /> Editar
                      </button>
                      {u.email !== 'admin@pacificsurf.com' && (
                        <button onClick={() => handleDelete(u)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-[10px] font-bold transition cursor-pointer border border-red-200"
                        >
                          <Trash2 className="w-3 h-3" /> Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-sm text-slate-400 bg-slate-50/55 italic">No hay usuarios registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm border border-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3.5 mb-4">
              <h3 className="text-lg font-bold text-slate-900 font-display">{editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Email *</label>
                <input required type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition"
                  placeholder={editingUser ? 'Dejar vacío para mantener actual' : 'Nombre del usuario'} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {editingUser ? 'Nueva Contraseña (dejar vacío para mantener)' : 'Contraseña *'}
                </label>
                <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 text-sm focus:border-cyan-500 outline-none transition" />
              </div>
              {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition w-full sm:w-auto">
                  Cancelar
                </button>
                <button type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/10 cursor-pointer transition active:scale-98 w-full sm:w-auto">
                  <Save className="w-4 h-4" />
                  {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
