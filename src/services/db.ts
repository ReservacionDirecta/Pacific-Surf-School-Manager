import { Student, Instructor, Package, StudentPackage, Class, Payment } from '../types';

// Generic error handler
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

// --- Students ---
export const getStudents = async () => {
  const res = await fetch('/api/students');
  return res.json();
};

export const addStudent = async (student: Omit<Student, 'id'>) => {
  const res = await fetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });
  return res.json();
};

export const updateStudent = async (id: string, data: Partial<Student>) => {
  await fetch(`/api/students/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteStudent = async (id: string) => {
  await fetch(`/api/students/${id}`, { method: 'DELETE' });
};

// --- Instructors ---
export const getInstructors = async () => {
  const res = await fetch('/api/instructors');
  return res.json();
};

export const addInstructor = async (instructor: Omit<Instructor, 'id'>) => {
  const res = await fetch('/api/instructors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(instructor)
  });
  return res.json();
};

export const updateInstructor = async (id: string, data: Partial<Instructor>) => {
  const res = await fetch(`/api/instructors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  return res.json();
};

export const deleteInstructor = async (id: string) => {
  await fetch(`/api/instructors/${id}`, { method: 'DELETE' });
};

// --- Packages ---
export const getPackages = async () => {
  const res = await fetch('/api/packages');
  return res.json();
};

export const addPackage = async (pkg: Omit<Package, 'id'>) => {
  const res = await fetch('/api/packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pkg)
  });
  return res.json();
};

export const updatePackage = async (id: string, data: Partial<Package>) => {
  await fetch(`/api/packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deletePackage = async (id: string) => {
  await fetch(`/api/packages/${id}`, { method: 'DELETE' });
};

// --- Student Packages ---
export const getStudentPackages = async () => {
  const res = await fetch('/api/student-packages');
  return res.json();
};

export const addStudentPackage = async (sp: Omit<StudentPackage, 'id'>) => {
  const res = await fetch('/api/student-packages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sp)
  });
  return res.json();
};

export const updateStudentPackage = async (id: string, data: Partial<StudentPackage>) => {
  await fetch(`/api/student-packages/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteStudentPackage = async (id: string) => {
  await fetch(`/api/student-packages/${id}`, { method: 'DELETE' });
};

// --- Classes ---
export const getClasses = async () => {
  const res = await fetch('/api/classes');
  return res.json();
};

export const addClass = async (cls: Omit<Class, 'id'>) => {
  const res = await fetch('/api/classes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cls)
  });
  return res.json();
};

export const updateClass = async (id: string, data: Partial<Class>) => {
  await fetch(`/api/classes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
};

export const deleteClass = async (id: string) => {
  await fetch(`/api/classes/${id}`, { method: 'DELETE' });
};

// --- Payments ---
export const getPayments = async () => {
  const res = await fetch('/api/payments');
  return res.json();
};

export const addPayment = async (payment: Omit<Payment, 'id'>) => {
  const res = await fetch('/api/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment)
  });
  return res.json();
};

export const deletePayment = async (id: string) => {
  await fetch(`/api/payments/${id}`, { method: 'DELETE' });
};
