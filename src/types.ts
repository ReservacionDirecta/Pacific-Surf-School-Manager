export interface Student {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
  age?: number;
  hasBoard?: string;
  parentsName?: string;
  birthDate?: string;
  enrollmentDate?: string;
}

export interface Instructor {
  id?: string;
  name: string;
  email?: string;
  phone?: string;
}

export interface Package {
  id?: string;
  name: string;
  totalClasses: number;
  price: number;
}

export interface StudentPackage {
  id?: string;
  studentId: string;
  packageId: string;
  packageName?: string;
  amountPaid: number;
  totalPrice: number;
  classesUsed: number;
  totalClasses: number;
  paymentDueDate?: string; // YYYY-MM-DD
  status: 'active' | 'exhausted' | 'expired';
}

export interface Payment {
  id?: string;
  studentPackageId: string;
  amount: number;
  date: string;
  method: 'Efectivo' | 'Transferencia' | 'Yape' | 'Plin';
  notes?: string;
}

export interface Equipment {
  id?: string;
  type: 'Tabla' | 'Wetsuit' | 'Lycra';
  size: string;
  brand?: string;
  condition: 'Nuevo' | 'Bueno' | 'Regular' | 'Mal estado';
  status: 'Disponible' | 'En uso' | 'En mantenimiento' | 'Perdido';
  notes?: string;
  assignedToType?: 'student' | 'instructor' | '';
  assignedToId?: string;
  assignedToName?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Class {
  id?: string;
  date: string; // ISO string
  studentId: string;
  instructorId: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  boardId?: string;
  wetsuitId?: string;
  lycraId?: string;
}
