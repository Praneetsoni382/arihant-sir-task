import fs from 'fs';
import path from 'path';

// Start server from compiled dist if available, otherwise from source
if (fs.existsSync(path.resolve(process.cwd(), 'server/dist/server.js'))) {
  await import('./server/dist/server.js');
} else {
  await import('./server/src/server.js');
}
