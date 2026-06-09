import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Package as PackageIcon, 
  Sparkles, 
  Plus, 
  Edit, 
  X, 
  DollarSign, 
  HelpCircle,
  Hash,
  DatabaseZap
} from 'lucide-react';
import { Package } from '../types';
import { addPackage, updatePackage, getPackages } from '../services/db';

export default function Packages() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPackage, setEditingPackage] = useState<Package | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [totalClasses, setTotalClasses] = useState('1');
  const [price, setPrice] = useState('');

  const fetchData = async () => {
    try {
      const data = await getPackages();
      setPackages(data);
    } catch (error) {
      console.error("Error fetching packages:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenEdit = (pkg: Package) => {
    setEditingPackage(pkg);
    setName(pkg.name);
    setTotalClasses(pkg.totalClasses.toString());
    setPrice(pkg.price.toString());
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingPackage(null);
    setName('');
    setTotalClasses('1');
    setPrice('');
  };

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pkgData = { 
        name, 
        totalClasses: Number(totalClasses) || 1, 
        price: Number(price) || 0 
      };

      if (editingPackage?.id) {
        await updatePackage(editingPackage.id, pkgData);
      } else {
        await addPackage(pkgData);
      }
      
      await fetchData();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving package:", error);
      alert("Error al guardar paquete");
    }
  };

  const injectInitialPackages = async () => {
    const initialPackages = [
      { name: 'Grupal - 1 Clase', totalClasses: 1, price: 120 },
      { name: 'Grupal - 4 Clases', totalClasses: 4, price: 400 },
      { name: 'Grupal - 8 Clases', totalClasses: 8, price: 720 },
      { name: 'Grupal - 12 Clases', totalClasses: 12, price: 1020 },
      { name: 'Personalizada - 1 Clase', totalClasses: 1, price: 180 },
      { name: 'Personalizada - 4 Clases', totalClasses: 4, price: 600 },
      { name: 'Personalizada - 8 Clases', totalClasses: 8, price: 1120 },
      { name: 'Personalizada - 12 Clases', totalClasses: 12, price: 1620 },
    ];

    try {
      for (const pkg of initialPackages) {
        const exists = packages.some(p => p.name === pkg.name);
        if (!exists) {
          await addPackage(pkg);
        }
      }
      alert('Paquetes iniciales inyectados correctamente');
      await fetchData();
    } catch (error) {
      console.error("Error injecting packages:", error);
      alert("Error al inyectar paquetes.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 bg-white rounded-2xl shadow-sm border border-slate-150 gap-4">
        <div>
          <h2 className="text-2xl font-extrabold font-display text-slate-100 dark:text-slate-900 tracking-tight">Catálogo de Paquetes</h2>
          <p className="text-sm text-slate-400">Planes oficiales de instrucción grupal y personalizada de Pacific Surf.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <button 
            onClick={injectInitialPackages}
            className="bg-slate-50 border border-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition flex items-center gap-1.5 active:scale-98"
          >
            <DatabaseZap className="w-4 h-4 text-slate-505" />
            Cargar Catálogo Inicial
          </button>
          
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold px-4 py-2.5 rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5 text-xs active:scale-98"
          >
            <Plus className="w-4.5 h-4.5" />
            Nuevo Plan
          </button>
        </div>
      </div>

      {/* Grid displays */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => (
          <motion.div 
            whileHover={{ y: -4, scale: 1.015 }}
            key={pkg.id} 
            className="bg-white rounded-2xl shadow-sm hover:shadow-md p-6 border border-slate-150 relative group transition-all duration-300 overflow-hidden flex flex-col justify-between"
          >
            {/* Top wavy decoration element */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-500 via-cyan-500 to-teal-400"></div>

            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-slate-500 shrink-0">
                  <PackageIcon className="w-5 h-5" />
                </div>
                
                <button 
                  onClick={() => handleOpenEdit(pkg)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-blue-600 transition cursor-pointer"
                  title="Editar paquete"
                >
                  <Edit className="w-4.5 h-4.5" />
                </button>
              </div>

              <div>
                <h3 className="text-base font-extrabold text-slate-900 font-display tracking-tight">{pkg.name}</h3>
                <span className="text-xs text-slate-400 uppercase tracking-wide font-mono mt-0.5 inline-block">Plan Oficial</span>
              </div>
            </div>

            <div className="flex items-baseline justify-between mt-6 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold font-mono tracking-wider text-slate-500 uppercase">
                {pkg.totalClasses} {pkg.totalClasses === 1 ? 'Clase' : 'Clases'}
              </span>
              <span className="text-2xl font-extrabold text-cyan-600 font-display">
                S/. {pkg.price}
              </span>
            </div>
          </motion.div>
        ))}
        {packages.length === 0 && (
          <div className="col-span-full bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-205 py-12 text-center text-slate-400 font-medium italic">
            No se han cargado paquetes todavía. Haz clic arriba en "Cargar Catálogo Inicial" para empezar de inmediato con precios de referencia recomendados.
          </div>
        )}
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
                {editingPackage ? 'Editar Paquete' : 'Crear Nuevo Paquete'}
              </h3>
              <button 
                onClick={handleCloseModal}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddPackage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Nombre del Paquete *</label>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 px-3.5 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder-slate-450 outline-none transition" 
                  placeholder="Ej: Grupal - 8 Clases" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Clases *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </span>
                  <input 
                    required 
                    type="text" 
                    value={totalClasses} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*$/.test(val)) {
                        setTotalClasses(val);
                      }
                    }} 
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition" 
                    placeholder="Ej: 8" 
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Precio en Soles (S/.) *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400 font-bold">
                    S/.
                  </span>
                  <input 
                    required 
                    type="text" 
                    placeholder="0"
                    value={price} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setPrice(val);
                      }
                    }} 
                    className="mt-1 block w-full rounded-xl border border-slate-200 text-slate-850 pl-10 pr-4 py-2.5 sm:text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none transition" 
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={handleCloseModal} 
                  className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 text-sm font-semibold cursor-pointer transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-xl text-sm shadow-md cursor-pointer transition active:scale-98"
                >
                  {editingPackage ? 'Guardar Cambios' : 'Registrar Paquete'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
