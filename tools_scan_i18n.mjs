import fs from 'fs';
import path from 'path';

const ROOT = '/home/ubuntu/encuestas-mne-analysis';
const DIRS = ['client', 'server', 'shared'];
const EXTENSIONS = new Set(['.ts', '.tsx']);
const keywords = [
  'Encuesta','Encuestador','Residentes','Visitantes','Resultados','Estadísticas','Exportar','Configuración',
  'Contraseña','Usuario','Volver','Guardar','Enviar','Mapa','Horarios','Horario','Turno','Cuotas','Inicio',
  'Cerrar sesión','Salir','Buenos días','Buenas tardes','Buenas noches','Obligatorio','Seleccione','Otro',
  'Error','residente','visitante','rechazo','encuesta','conteo','horaria','franja','idioma'
];
const stringRegex = /(["'`])(?:(?=(\\?))\2.)*?\1/gms;

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (EXTENSIONS.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

function matchesSpanishSignal(str) {
  return /[ÁÉÍÓÚáéíóúñ¿¡]/.test(str) || keywords.some(k => str.includes(k));
}

const results = [];
for (const dir of DIRS) {
  for (const file of walk(path.join(ROOT, dir))) {
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, idx) => {
      const matches = line.match(stringRegex) || [];
      for (const raw of matches) {
        const str = raw.slice(1, -1);
        if (str.length >= 3 && matchesSpanishSignal(str)) {
          results.push({ file: file.replace(ROOT + '/', ''), line: idx + 1, text: str });
        }
      }
    });
  }
}

results.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const item of results) {
  console.log(`${item.file}:${item.line}: ${item.text}`);
}
console.error(`\nTotal candidate strings: ${results.length}`);
