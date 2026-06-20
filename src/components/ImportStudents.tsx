import React, { useState, useEffect } from 'react';
import { Package, Student } from '../types';
import { addStudent, addStudentPackage, getPackages, getStudents } from '../services/db';

const csvData = `Nombre ,Apellido,Telefono ,Edad,Tienen Tabla,Grupal / personalizada,Tipo de paquete,Fecha de Inscripción ,Nombre padres,Fecha de Nacimiento 
Jonathan ,Montoya ,934709897,55,Si,G,4,01/03/2022,Lita,03/09/1970
Yomira,,965139180,35,Si,G,8,,,
 Manger ,,959765661,,Si,G,4,,Carla,
Eduardo,Solis,997580729,,No,P,4,,,
Kataleya,,,,,,,,,
Gabriela,,,,,,,,Nanyu,
Sol,,991884239,,No,G,4,,,
Nora,Loredo ,997975097,68,Si,P,1,11/01/2024,,22/12/1957
Fernando,Luna,981998169,50,Si,G,4,01/03/2022,,11/08/1974
Constanza ,Christow,960654899 / 936852124,15,En proceso,G,4,11/10/2024,Tino y Pierina ,
Tino,Christow,,,Si,P,8,,,
Mathous ,Custodio,932097971 / 954935788,14,Si,G,8,,Marcus y Paty,
Diego,Torres,987889083 / 955314055,14,si,G,4,13/10/2024,Diego y Gabriela,
Makarena ,Sotelo,998193380 / 997597376,14,,G,1,09/11/2024,Adolfo y Ceci,
Nori,Tamashiro,952515469,14,No,G,4,17/12/2024,Diana,
Ingrid,Sanchez,987142250 / 961733300,,No,P,8,18/01/2025,William,
Valentina,Sanchez,987142251 / 961733300,11,No,P,12,19/01/2025,William,
Casandra,Sanchez,987142252 / 961733300,4,No,P,8,20/01/2025,William,
Micaela,De Cordova,959027257,12,En proceso ,G,4,01/02/2023,Jesuine,
Jean,Gines,986974327,34,En proceso ,P,4,20/01/2025,,
Valentina,Cuadros,999000859,10,No,P,4,14/2/2024,Erick,
Emilia,Malaga,980713770,8,No,P,4,15/2/2024,Jose ,
Alexi,Arias ,981957573,,No,G,4,,,
Paty,Custodio,954935788,,No,P,8,,,
Gabriela,,955314055,,No,P,4,,,
Diana,Tamashiro,952515469,,No,P,4,,,
Kenzo,Maruy,981108582,14,No,G,,,,
Nobu,Maruy,981108582,12,No,G,,,,
Memo,Maruy,981108582,,No,G,,,,
Josue,,,,,,,,,
Kike,Efio,,,,,,,,
Adolfo,Sotelo,,,,,,,,
Daira,,,,,,,,,
Jose,Fernández ,,,,,,,,
Carlos,Bart,,,,,,,,
Armando,,,,,,,,,
Bryan,Diaz,,,,,,,,
Crislandor,,,,,,,,,
Doddy,,,,,,,,,
Eduard,,,,,,,,,
Edy,,,,,,,,,
Evelyn,,,,,,,,,
Joseth,,,,,,,,,
Jose Luis,,,,,,,,,
Lou,,,,,,,,,
Marcelo,,,,,,,,,
Michelle,,,,,,,,,
Oscar,,,,,,,,,
Piero,,,,,,,,,`;

export default function ImportStudents() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const handleImport = async () => {
    if (packages.length === 0) {
      alert("Por favor, inyecta primero los planes en la sección de Planes.");
      return;
    }

    setImporting(true);
    const lines = csvData.trim().split('\n');
    const rows = lines.slice(1); // Skip header
    let count = 0;

    try {
      // Fetch existing students to avoid duplicates
      const existingStudents = await getStudents();

      for (const row of rows) {
        const cols = row.split(',').map(c => c.trim());
        if (cols.length < 1 || !cols[0]) continue;

        const [nombre, apellido, telefono, edad, tienenTabla, tipoClase, numClases, fechaInsc, padres, fechaNac] = cols;
        
        const fullName = `${nombre}${apellido ? ' ' + apellido : ''}`;
        
        // Check if student already exists
        const alreadyExists = existingStudents.some((s: Student) => 
          s.name === fullName && (telefono ? s.phone === telefono : true)
        );

        if (alreadyExists) {
          count++;
          continue;
        }
        
        // Create Student
        const studentRef = await addStudent({
          name: fullName,
          phone: telefono || "",
          age: edad ? Number(edad) : 0,
          hasBoard: tienenTabla || "",
          parentsName: padres || "",
          birthDate: fechaNac || "",
          enrollmentDate: fechaInsc || ""
        });

        if (studentRef && studentRef.id && tipoClase && numClases) {
          const typeLabel = tipoClase.toUpperCase() === 'G' ? 'Grupal' : 'Personalizada';
          const classesLabel = numClases === '1' ? '1 Clase' : `${numClases} Clases`;
          const targetPackageName = `${typeLabel} - ${classesLabel}`;
          
          const pkg = packages.find(p => p.name === targetPackageName);
          if (pkg) {
            await addStudentPackage({
              studentId: studentRef.id,
              packageId: pkg.id!,
              packageName: pkg.name,
              amountPaid: pkg.price, // Assume paid for existing students
              totalPrice: pkg.price,
              classesUsed: 0,
              totalClasses: pkg.totalClasses,
              status: 'active'
            });
          }
        }
        
        count++;
        setProgress(Math.round((count / rows.length) * 100));
      }
      alert(`Importación completada: ${count} alumnos agregados.`);
    } catch (error) {
      console.error("Error importing students:", error);
      alert("Error durante la importación.");
    } finally {
      setImporting(false);
      setProgress(0);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow space-y-4">
      <h2 className="text-xl font-bold text-gray-800">Importar Alumnos desde CSV</h2>
      <p className="text-gray-600">
        Esta herramienta inyectará los alumnos existentes del documento proporcionado.
        Asegúrate de haber inyectado los paquetes primero.
      </p>
      
      {importing ? (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="text-sm text-gray-500 text-center">Importando... {progress}%</p>
        </div>
      ) : (
        <button
          onClick={handleImport}
          className="bg-green-600 text-white px-6 py-2 rounded shadow hover:bg-green-700 transition-colors"
        >
          Iniciar Importación de Alumnos
        </button>
      )}
    </div>
  );
}
