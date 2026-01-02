import fs from 'fs';
import path from 'path';

const BASE_DIR = '/var/www/goalgpt';

function fixFile(relPath: string, search: string, replace: string) {
    const fullPath = path.join(BASE_DIR, relPath);
    if (!fs.existsSync(fullPath)) {
        console.log(`File not found: ${fullPath}`);
        return;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (content.includes(search)) {
        const newContent = content.replace(search, replace);
        fs.writeFileSync(fullPath, newContent);
        console.log(`Fixed: ${relPath}`);
    } else {
        console.log(`Search string not found in: ${relPath}`);
    }
}

// Fix route files
fixFile('src/routes/health.routes.ts', 'export async function healthRoutes', 'export default async function healthRoutes');
fixFile('src/routes/prediction.routes.ts', 'export async function predictionRoutes', 'export default async function predictionRoutes');
fixFile('src/routes/dashboard.routes.ts', 'export async function dashboardRoutes', 'export default async function dashboardRoutes');

// Fix server.ts imports
const serverPath = path.join(BASE_DIR, 'src/server.ts');
let serverContent = fs.readFileSync(serverPath, 'utf8');

serverContent = serverContent
    .replace("import { healthRoutes } from './routes/health.routes';", "import healthRoutes from './routes/health.routes';")
    .replace("import { predictionRoutes } from './routes/prediction.routes';", "import predictionRoutes from './routes/prediction.routes';")
    .replace("import { dashboardRoutes } from './routes/dashboard.routes';", "import dashboardRoutes from './routes/dashboard.routes';");

fs.writeFileSync(serverPath, serverContent);
console.log('Fixed: src/server.ts');
