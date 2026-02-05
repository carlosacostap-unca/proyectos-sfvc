import PocketBase from 'pocketbase';

// Configuration
const PB_URL = 'https://pocketbase-proyectos-sfvc.acostaparra.com/'; 

const pb = new PocketBase(PB_URL);

// Data to import
const PROJECT_TYPES = ['Interno', 'Externo', 'Opensource'];

const PROJECT_STATUSES = [
  'Planificación', 
  'Análisis', 
  'Diseño', 
  'Desarrollo', 
  'Testing', 
  'Despliegue', 
  'Capacitación', 
  'Producción', 
  'Necesita Informacion', 
  'Finalizado', 
  'Archivado', 
  'Exitoso', 
  'Fracaso', 
  'Muerto', 
  'Suspendido', 
  'Mantenimiento'
];

async function seed() {
  console.log(`🚀 Connecting to PocketBase at ${PB_URL}...`);
  
  // Note: Assuming API rules for create are public as requested.
  // If auth is needed, uncomment the following lines and provide credentials:
  // await pb.admins.authWithPassword('admin@example.com', 'password123');

  // 1. Seed Project Types
  console.log('\n📦 Seeding Project Types...');
  for (const name of PROJECT_TYPES) {
    try {
      // Check if exists
      const existing = await pb.collection('project_types').getList(1, 1, {
        filter: `name = "${name}"`
      });
      
      if (existing.totalItems === 0) {
        await pb.collection('project_types').create({ name, active: true });
        console.log(`  ✅ Created: ${name}`);
      } else {
        console.log(`  ℹ️  Exists: ${name}`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${name}:`, err.message);
      if (err.status === 404) {
        console.error('     👉 HINT: The collection "project_types" probably does not exist. Please create it first.');
        return; // Stop if collection is missing
      }
      if (err.data) console.error('     Details:', JSON.stringify(err.data, null, 2));
    }
  }

  // 2. Seed Project Statuses
  console.log('\n📊 Seeding Project Statuses...');
  for (const name of PROJECT_STATUSES) {
    try {
      const existing = await pb.collection('project_statuses').getList(1, 1, {
        filter: `name = "${name}"`
      });
      
      if (existing.totalItems === 0) {
        await pb.collection('project_statuses').create({ name, active: true });
        console.log(`  ✅ Created: ${name}`);
      } else {
        console.log(`  ℹ️  Exists: ${name}`);
      }
    } catch (err) {
      console.error(`  ❌ Error processing ${name}:`, err.message);
      if (err.status === 404) {
        console.error('     👉 HINT: The collection "project_statuses" probably does not exist. Please create it first.');
        return;
      }
      if (err.data) console.error('     Details:', JSON.stringify(err.data, null, 2));
    }
  }
  
  console.log('\n✨ Import completed!');
}

seed().catch(err => {
  console.error('Fatal error:', err);
});
