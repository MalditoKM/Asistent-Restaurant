import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the root directory of the project
const projectRoot = path.join(__dirname, '..');

// Name of the output zip file
const outputFileName = 'asistente-restaurante-backup.zip';
const outputPath = path.join(projectRoot, outputFileName);

// Create a file to stream archive data to.
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

// Listen for all archive data to be written
// 'close' event is fired only when a file descriptor is involved
output.on('close', function() {
  console.log(`Copia de seguridad creada: ${outputFileName}`);
  console.log(`Tamaño total: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
});

// This event is fired when the data source is drained no matter what was the data source.
// It is not part of this library but rather from the NodeJS Stream API.
// @see: https://nodejs.org/api/stream.html#stream_event_end
output.on('end', function() {
  console.log('Data has been drained');
});

// Good practice to catch warnings (ie stat failures and other non-blocking errors)
archive.on('warning', function(err) {
  if (err.code === 'ENOENT') {
    // log warning
    console.warn('Warning:', err);
  } else {
    // throw error
    throw err;
  }
});

// Good practice to catch this error explicitly
archive.on('error', function(err) {
  throw err;
});

// Pipe archive data to the file
archive.pipe(output);

// Append files from a glob pattern
// This will add all files in the project root, respecting .gitignore if you use `glob` with ignore patterns.
// For simplicity, we'll manually specify what to include.
archive.glob('**/*', {
  cwd: projectRoot,
  ignore: [
    'node_modules/**',
    '.next/**',
    '*.zip', // ignore the output file itself
    '.DS_Store',
    '*.log'
  ]
});

// Finalize the archive (ie we are done appending files but streams have to finish yet)
// 'close', 'end' or 'finish' may be fired right after calling this method so register to them beforehand
archive.finalize();
