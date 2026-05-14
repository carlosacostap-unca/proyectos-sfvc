
import PocketBase from 'pocketbase';
import fs from 'fs';
import path from 'path';

// Initialize PocketBase
const pb = new PocketBase('https://pocketbase-proyectos-sfvc.acostaparra.com/');
// Note: Ensure PocketBase is running!

const DATA_FILE = path.join(process.cwd(), 'data', 'proyectos_backend_adaptado.json');

type ProjectImportRecord = Record<string, unknown> & {
  code?: string;
  system_name?: string;
  year?: number;
  estimated_duration?: number;
  requesting_area_name?: string;
  product_owner_name?: string;
  project_type?: string;
  status?: string;
  shift?: string[];
  backend_tech?: string[];
  observations?: string;
  drive_folder?: string;
  server?: string;
  frontend_tech?: string[];
  database?: string[];
  start_date?: string;
  estimated_end_date?: string;
};

type ProjectPayload = Record<string, string | number | string[] | null | undefined>;

type ValidationDetail = {
  code?: string;
  message?: string;
  params?: {
    value?: string;
  };
};

type PocketBaseError = {
  message?: string;
  data?: {
    data?: Record<string, ValidationDetail>;
  } | Record<string, ValidationDetail>;
};

async function main() {
  console.log('🚀 Starting project import...');

  // 1. Read and parse JSON
  if (!fs.existsSync(DATA_FILE)) {
    console.error(`❌ File not found: ${DATA_FILE}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(DATA_FILE, 'utf-8');
  // Replace NaN with null to ensure valid JSON parsing if needed
  const cleanedContent = rawContent.replace(/:\s*NaN/g, ': null');
  
  let projects: ProjectImportRecord[];
  try {
    projects = JSON.parse(cleanedContent) as ProjectImportRecord[];
    console.log(`📦 Found ${projects.length} projects to process.`);
  } catch (err) {
    console.error('❌ Error parsing JSON:', err);
    process.exit(1);
  }

  // 2. Load dependencies (Areas, Personal)
  console.log('🔄 Loading metadata (Areas, Personal)...');
  
  // Helper to normalize strings for matching
  const normalizeKey = (str: string) => str.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const areasMap = new Map<string, string>(); // Name -> ID
  try {
    const areas = await pb.collection('requesting_areas').getFullList();
    areas.forEach(a => areasMap.set(normalizeKey(a.name), a.id));
    console.log(`✅ Loaded ${areas.length} Requesting Areas.`);
  } catch {
    console.warn('⚠️ Could not load Requesting Areas. Ensure the collection exists.');
  }

  const personalMap = new Map<string, string>(); // Name -> ID
  try {
    const personnel = await pb.collection('personal').getFullList();
    personnel.forEach(p => {
        // Try to cover variations in naming convention
        personalMap.set(normalizeKey(p.name), p.id);
        personalMap.set(normalizeKey(`${p.name} ${p.surname}`), p.id);
        personalMap.set(normalizeKey(`${p.surname} ${p.name}`), p.id);
    });
    console.log(`✅ Loaded ${personnel.length} Personal records.`);
  } catch {
    console.warn('⚠️ Could not load Personal. Ensure the collection exists.');
  }

  // 3. Process Projects
  let createdCount = 0;
  let updatedCount = 0;
  let errorCount = 0;

  for (const p of projects) {
    try {
      // Resolve Relations
      let areaId = '';
      if (p.requesting_area_name) {
        const normName = normalizeKey(String(p.requesting_area_name));
        if (areasMap.has(normName)) {
          areaId = areasMap.get(normName)!;
        } else {
            // Optional: Create area if missing? For now, just warn.
            console.warn(`⚠️ Area not found: "${p.requesting_area_name}" for project ${p.code}`);
        }
      }

      let poId = '';
      if (p.product_owner_name) {
        const normName = normalizeKey(String(p.product_owner_name));
        if (personalMap.has(normName)) {
          poId = personalMap.get(normName)!;
        } else {
           // Create PO if missing? 
           // console.warn(`⚠️ PO not found: "${p.product_owner_name}"`);
        }
      }

      // Fix project_type
      let pType = p.project_type ? String(p.project_type).trim() : 'Interno';
      if (pType === 'Open source') pType = 'Opensource';

      // Fix status
      let pStatus = p.status ? String(p.status).trim() : 'Planificación';
      const statusMap: Record<string, string> = {
        'Necesita Informacion': 'Necesita Información',
        'Fracaso': 'Suspendido', // Fallback as Fracaso seems invalid in PB
      };
      if (statusMap[pStatus]) {
        pStatus = statusMap[pStatus];
      }

      // Fix shift
      let pShift = Array.isArray(p.shift) ? p.shift : [];
      // Handle "Ambos" in shift (sometimes it might be a string in JSON? No, error said Invalid value Ambos inside the array likely, or passed as single string?)
      // If p.shift is ["Ambos"] or just "Ambos"
      if (pShift.includes('Ambos')) {
        pShift = pShift.filter((s: string) => s !== 'Ambos');
        pShift.push('Mañana', 'Tarde');
      }

      // Fix backend_tech
      const pBackend = Array.isArray(p.backend_tech) ? p.backend_tech : [];
      // Removed incorrect mapping
      
      // Fix project_type "Ambos"
      if (pType === 'Ambos') pType = 'Interno';

      // Prepare payload
      const payload: ProjectPayload = {
        code: p.code,
        system_name: p.system_name,
        year: p.year || new Date().getFullYear(),
        project_type: pType,
        status: pStatus,
        estimated_duration: p.estimated_duration || 0,
        requesting_area: areaId,
        personal: poId,
        observations: p.observations || '',
        drive_folder: p.drive_folder || '',
        server: p.server || '',
        frontend_tech: Array.isArray(p.frontend_tech) ? p.frontend_tech : [],
        backend_tech: pBackend,
        database: Array.isArray(p.database) ? p.database : [],
        shift: pShift,
      };

      // Handle Dates
      if (p.start_date) payload.start_date = new Date(p.start_date).toISOString();
      if (p.estimated_end_date) payload.estimated_end_date = new Date(p.estimated_end_date).toISOString();

      // Check existence by code
      let existingId = '';
      try {
        const existing = await pb.collection('projects').getFirstListItem(`code="${p.code}"`);
        existingId = existing.id;
      } catch {
        // Not found, proceed to create
      }

      const createOrUpdate = async (data: ProjectPayload) => {
          if (existingId) {
            await pb.collection('projects').update(existingId, data);
            updatedCount++;
            process.stdout.write('U');
          } else {
            await pb.collection('projects').create(data);
            createdCount++;
            process.stdout.write('C');
          }
      };

      try {
        await createOrUpdate(payload);
      } catch (err: unknown) {
        const pbError = err as PocketBaseError;
         // Retry logic for invalid values
        let retried = false;
        
        // Determine where validation errors are stored
        // Based on logs, err.data seems to be the full response object containing a .data property
        const validationErrors = (('data' in (pbError.data || {}) ? pbError.data?.data : pbError.data) || {}) as Record<string, ValidationDetail>;

        if (validationErrors) {
          let changed = false;
          // Check for invalid value errors in known select/relation fields
          const fieldsToCheck = ['backend_tech', 'frontend_tech', 'database', 'shift', 'status', 'project_type'];
          
          for (const field of fieldsToCheck) {
            if (validationErrors[field]?.code === 'validation_invalid_value') {
              const badValue = validationErrors[field].params?.value;
              
              if (badValue) {
                 console.warn(`⚠️  Warning: Invalid value "${badValue}" for field "${field}" in project ${p.code}. Removing/Fixing it.`);
                 
                 // If array, remove the bad value
                 if (Array.isArray(payload[field])) {
                   payload[field] = (payload[field] as string[]).filter((v) => v !== badValue);
                   changed = true;
                 } 
                 // If string (single select), try to fallback or clear
                 else if (typeof payload[field] === 'string') {
                    // For status, maybe fallback to 'Planificación'
                    if (field === 'status') {
                       payload[field] = 'Planificación';
                       changed = true;
                    } else if (field === 'project_type') {
                       payload[field] = 'Interno';
                       changed = true;
                    }
                 }
              }
            }
          }
  
          if (changed) {
             try {
                await createOrUpdate(payload);
                retried = true;
             } catch (retryErr: unknown) {
                const retryError = retryErr as PocketBaseError;
                console.error(`\n❌ Retry failed for ${p.code}:`, retryError.message);
             }
          }
        }
  
        if (!retried) {
          console.error(`\n❌ Error processing ${p.code}:`, pbError.message);
          if (pbError.data) {
            console.error('   Details:', JSON.stringify(pbError.data, null, 2));
          }
          errorCount++;
        }
      }

    } catch (err: unknown) {
      const error = err as PocketBaseError;
      // Catch errors outside the createOrUpdate block (should not happen often)
      console.error(`\n❌ Error processing ${p.code}:`, error.message);
      errorCount++;
    }
  }

  console.log('\n\n🏁 Import finished!');
  console.log(`   Created: ${createdCount}`);
  console.log(`   Updated: ${updatedCount}`);
  console.log(`   Errors:  ${errorCount}`);
}

main().catch(console.error);
