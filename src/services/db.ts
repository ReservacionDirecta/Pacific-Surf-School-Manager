import { Student, Instructor, Package, StudentPackage, Class, Payment } from '../types';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`API Error (${operationType} on ${path}):`, error);
  throw error;
}

// LocalStorage Keys
export const LS_KEYS = {
  students: 'pacific_surf_students_ls',
  instructors: 'pacific_surf_instructors_ls',
  packages: 'pacific_surf_packages_ls',
  studentPackages: 'pacific_surf_student_packages_ls',
  classes: 'pacific_surf_classes_ls',
  payments: 'pacific_surf_payments_ls'
};

// Check if we should use LocalStorage Mode (Static deployment like GitHub Pages)
export const isLocalStorageMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return (
    h.includes('github.io') ||
    h.includes('localhost') === false && h.includes('127.0.0.1') === false && !h.match(/^\d+\.\d+\.\d+\.\d+$/) && !h.endsWith('.run.app') ||
    localStorage.getItem('force_offline_ls') === 'true'
  );
};

// Initialize localStorage with dummy interactive data if empty
const initDefaultLocalStorageData = () => {
  if (typeof window === 'undefined') return;

  // 1. Packages
  if (!localStorage.getItem(LS_KEYS.packages)) {
    const defaultPackages: Package[] = [
      { id: 'pkg-1', name: 'Bautizo de Surf (1 Clase)', price: 60, totalClasses: 1 },
      { id: 'pkg-2', name: 'Aventura Surfer (4 Clases)', price: 220, totalClasses: 4 },
      { id: 'pkg-3', name: 'Instructor Premium (12 Clases)', price: 600, totalClasses: 12 }
    ];
    localStorage.setItem(LS_KEYS.packages, JSON.stringify(defaultPackages));
  }

  // 2. Instructors
  if (!localStorage.getItem(LS_KEYS.instructors)) {
    const defaultInstructors: Instructor[] = [
      { id: 'inst-1', name: 'Carlos Peralta', phone: '948215647', email: 'carlos@pacificsurf.com' },
      { id: 'inst-2', name: 'Sofia Vento', phone: '984512304', email: 'sofia.vento@gmail.com' }
    ];
    localStorage.setItem(LS_KEYS.instructors, JSON.stringify(defaultInstructors));
  }

  // 3. Students
  if (!localStorage.getItem(LS_KEYS.students)) {
    const defaultStudents: Student[] = [
      { id: 'stud-1', name: 'Franco Delgado', email: 'franco@outlook.com', phone: '987654321', age: 24, hasBoard: 'Sí', parentsName: '', birthDate: '2002-05-12', enrollmentDate: '2026-06-05T10:00:00.000Z' },
      { id: 'stud-2', name: 'Lucia Mar', email: 'lucia.m@gmail.com', phone: '912345678', age: 19, hasBoard: 'No', parentsName: 'Elena Mar', birthDate: '2007-11-20', enrollmentDate: '2026-06-08T15:30:00.000Z' }
    ];
    localStorage.setItem(LS_KEYS.students, JSON.stringify(defaultStudents));
  }

  // 4. Student Packages
  if (!localStorage.getItem(LS_KEYS.studentPackages)) {
    const defaultStudentPackages: StudentPackage[] = [
      { id: 'sp-1', studentId: 'stud-1', packageId: 'pkg-1', packageName: 'Bautizo de Surf (1 Clase)', amountPaid: 60, totalPrice: 60, classesUsed: 1, totalClasses: 1, paymentDueDate: '', status: 'exhausted' },
      { id: 'sp-2', studentId: 'stud-2', packageId: 'pkg-2', packageName: 'Aventura Surfer (4 Clases)', amountPaid: 150, totalPrice: 220, classesUsed: 1, totalClasses: 4, paymentDueDate: '2026-06-15', status: 'active' }
    ];
    localStorage.setItem(LS_KEYS.studentPackages, JSON.stringify(defaultStudentPackages));
  }

  // 5. Classes
  if (!localStorage.getItem(LS_KEYS.classes)) {
    const defaultClasses: Class[] = [
      { id: 'cls-1', date: '2026-06-06T09:00', studentId: 'stud-1', instructorId: 'inst-1', status: 'completed' },
      { id: 'cls-2', date: '2026-06-08T10:30', studentId: 'stud-2', instructorId: 'inst-2', status: 'completed' },
      { id: 'cls-3', date: '2026-06-11T16:00', studentId: 'stud-2', instructorId: 'inst-2', status: 'scheduled' }
    ];
    localStorage.setItem(LS_KEYS.classes, JSON.stringify(defaultClasses));
  }

  // 6. Payments
  if (!localStorage.getItem(LS_KEYS.payments)) {
    const defaultPayments: Payment[] = [
      { id: 'pay-1', studentPackageId: 'sp-1', amount: 60, date: '2026-06-05T10:05:00.000Z', method: 'Efectivo', notes: 'Cancelado al matricular' },
      { id: 'pay-2', studentPackageId: 'sp-2', amount: 150, date: '2026-06-08T15:35:00.000Z', method: 'Yape', notes: 'Pago a cuenta' }
    ];
    localStorage.setItem(LS_KEYS.payments, JSON.stringify(defaultPayments));
  }
};

initDefaultLocalStorageData();

// LocalStorage Helper Get/Set
const getLS = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setLS = <T>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- Students ---
export const getStudents = async (): Promise<Student[]> => {
  if (isLocalStorageMode()) {
    return getLS<Student>(LS_KEYS.students);
  }
  const res = await fetch('/api/students');
  return res.json();
};

export const addStudent = async (student: Omit<Student, 'id'>): Promise<Student> => {
  if (isLocalStorageMode()) {
    const students = getLS<Student>(LS_KEYS.students);
    const newStudent = { ...student, id: 'student-' + Math.random().toString(36).substr(2, 9) };
    students.push(newStudent);
    setLS(LS_KEYS.students, students);
    return newStudent;
  }
  const res = await fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });
  return res.json();
};

export const updateStudent = async (id: string, data: Partial<Student>): Promise<void> => {
  if (isLocalStorageMode()) {
    const students = getLS<Student>(LS_KEYS.students);
    const index = students.findIndex(s => s.id === id);
    if (index !== -1) {
      students[index] = { ...students[index], ...data };
      setLS(LS_KEYS.students, students);
    }
    return;
  }
  await fetch(`/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteStudent = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const students = getLS<Student>(LS_KEYS.students);
    setLS(LS_KEYS.students, students.filter(s => s.id !== id));
    return;
  }
  await fetch(`/api/students/${id}`, { method: 'DELETE' });
};

// --- Instructors ---
export const getInstructors = async (): Promise<Instructor[]> => {
  if (isLocalStorageMode()) {
    return getLS<Instructor>(LS_KEYS.instructors);
  }
  const res = await fetch('/api/instructors');
  return res.json();
};

export const addInstructor = async (instructor: Omit<Instructor, 'id'>): Promise<Instructor> => {
  if (isLocalStorageMode()) {
    const instructors = getLS<Instructor>(LS_KEYS.instructors);
    const newInstructor = { ...instructor, id: 'instructor-' + Math.random().toString(36).substr(2, 9) };
    instructors.push(newInstructor);
    setLS(LS_KEYS.instructors, instructors);
    return newInstructor;
  }
  const res = await fetch('/api/instructors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instructor)
  });
  return res.json();
};

export const updateInstructor = async (id: string, data: Partial<Instructor>): Promise<Instructor> => {
  if (isLocalStorageMode()) {
    const instructors = getLS<Instructor>(LS_KEYS.instructors);
    const index = instructors.findIndex(i => i.id === id);
    let updated = {} as Instructor;
    if (index !== -1) {
      instructors[index] = { ...instructors[index], ...data };
      updated = instructors[index];
      setLS(LS_KEYS.instructors, instructors);
    }
    return updated;
  }
  const res = await fetch(`/api/instructors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteInstructor = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const instructors = getLS<Instructor>(LS_KEYS.instructors);
    setLS(LS_KEYS.instructors, instructors.filter(i => i.id !== id));
    return;
  }
  await fetch(`/api/instructors/${id}`, { method: 'DELETE' });
};

// --- Packages ---
export const getPackages = async (): Promise<Package[]> => {
  if (isLocalStorageMode()) {
    return getLS<Package>(LS_KEYS.packages);
  }
  const res = await fetch('/api/packages');
  return res.json();
};

export const addPackage = async (pkg: Omit<Package, 'id'>): Promise<Package> => {
  if (isLocalStorageMode()) {
    const packages = getLS<Package>(LS_KEYS.packages);
    const newPackage = { ...pkg, id: 'pkg-' + Math.random().toString(36).substr(2, 9) };
    packages.push(newPackage);
    setLS(LS_KEYS.packages, packages);
    return newPackage;
  }
  const res = await fetch('/api/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pkg)
  });
  return res.json();
};

export const updatePackage = async (id: string, data: Partial<Package>): Promise<void> => {
  if (isLocalStorageMode()) {
    const packages = getLS<Package>(LS_KEYS.packages);
    const index = packages.findIndex(p => p.id === id);
    if (index !== -1) {
      packages[index] = { ...packages[index], ...data };
      setLS(LS_KEYS.packages, packages);
    }
    return;
  }
  await fetch(`/api/packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deletePackage = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const packages = getLS<Package>(LS_KEYS.packages);
    setLS(LS_KEYS.packages, packages.filter(p => p.id !== id));
    return;
  }
  await fetch(`/api/packages/${id}`, { method: 'DELETE' });
};

// --- Student Packages ---
export const getStudentPackages = async (): Promise<StudentPackage[]> => {
  if (isLocalStorageMode()) {
    return getLS<StudentPackage>(LS_KEYS.studentPackages);
  }
  const res = await fetch('/api/student-packages');
  return res.json();
};

export const addStudentPackage = async (sp: Omit<StudentPackage, 'id'>): Promise<StudentPackage> => {
  if (isLocalStorageMode()) {
    const spList = getLS<StudentPackage>(LS_KEYS.studentPackages);
    const newSp = { ...sp, id: 'sp-' + Math.random().toString(36).substr(2, 9) };
    spList.push(newSp);
    setLS(LS_KEYS.studentPackages, spList);
    return newSp;
  }
  const res = await fetch('/api/student-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sp)
  });
  return res.json();
};

export const updateStudentPackage = async (id: string, data: Partial<StudentPackage>): Promise<void> => {
  if (isLocalStorageMode()) {
    const spList = getLS<StudentPackage>(LS_KEYS.studentPackages);
    const index = spList.findIndex(sp => sp.id === id);
    if (index !== -1) {
      spList[index] = { ...spList[index], ...data };
      setLS(LS_KEYS.studentPackages, spList);
    }
    return;
  }
  await fetch(`/api/student-packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteStudentPackage = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const spList = getLS<StudentPackage>(LS_KEYS.studentPackages);
    setLS(LS_KEYS.studentPackages, spList.filter(sp => sp.id !== id));
    return;
  }
  await fetch(`/api/student-packages/${id}`, { method: 'DELETE' });
};

// --- Classes ---
export const getClasses = async (): Promise<Class[]> => {
  if (isLocalStorageMode()) {
    return getLS<Class>(LS_KEYS.classes);
  }
  const res = await fetch('/api/classes');
  return res.json();
};

export const addClass = async (cls: Omit<Class, 'id'>): Promise<Class> => {
  if (isLocalStorageMode()) {
    const classes = getLS<Class>(LS_KEYS.classes);
    const newClass = { ...cls, id: 'cls-' + Math.random().toString(36).substr(2, 9) };
    classes.push(newClass);
    setLS(LS_KEYS.classes, classes);
    return newClass;
  }
  const res = await fetch('/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cls)
  });
  return res.json();
};

export const updateClass = async (id: string, data: Partial<Class>): Promise<void> => {
  if (isLocalStorageMode()) {
    const classes = getLS<Class>(LS_KEYS.classes);
    const index = classes.findIndex(c => c.id === id);
    if (index !== -1) {
      classes[index] = { ...classes[index], ...data };
      setLS(LS_KEYS.classes, classes);
    }
    return;
  }
  await fetch(`/api/classes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteClass = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const classes = getLS<Class>(LS_KEYS.classes);
    setLS(LS_KEYS.classes, classes.filter(c => c.id !== id));
    return;
  }
  await fetch(`/api/classes/${id}`, { method: 'DELETE' });
};

// --- Payments ---
export const getPayments = async (): Promise<Payment[]> => {
  if (isLocalStorageMode()) {
    return getLS<Payment>(LS_KEYS.payments);
  }
  const res = await fetch('/api/payments');
  return res.json();
};

export const addPayment = async (payment: Omit<Payment, 'id'>): Promise<Payment> => {
  if (isLocalStorageMode()) {
    const payments = getLS<Payment>(LS_KEYS.payments);
    const newPayment = { ...payment, id: 'pay-' + Math.random().toString(36).substr(2, 9) };
    payments.push(newPayment);
    setLS(LS_KEYS.payments, payments);
    return newPayment;
  }
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment)
  });
  return res.json();
};

export const deletePayment = async (id: string): Promise<void> => {
  if (isLocalStorageMode()) {
    const payments = getLS<Payment>(LS_KEYS.payments);
    setLS(LS_KEYS.payments, payments.filter(p => p.id !== id));
    return;
  }
  await fetch(`/api/payments/${id}`, { method: 'DELETE' });
};
