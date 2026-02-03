import PocketBase from 'pocketbase';
// import 'dotenv/config'; // To load .env.local if needed, but we might just hardcode for script

// Raw list provided by user
const rawData = `
General 
 Obras 
 Hacienda 
 Hacienda 
 Obras 
 Obras 
 Obras 
 Servicios Publicos 
 General 
 General 
 Obras 
 Obras 
 Hacienda 
 Hacienda 
 General 
 General 
 General 
 Educacion 
 General 
 Juzgado 
 Turismo y Desarrollo Economico 
 salud, desarrollo humano y políticas sociales 
 Ambiente y espacios verdes 
 Modernizacion 
 Proteccion Ciudadana 
 Gobierno y Coordinacion 
 Gobierno y Coordinacion 
 Modernizacion 
 Modernizacion 
 Salud 
 Hacienda 
 Gobierno y Coordinacion 
 Gobierno y Coordinacion 
 Modernizacion 
 urbanismo e infraestructura 
 Proteccion Ciudadana 
 General 
 Educacion y Cultura 
 Turismo y Desarrollo economico 
 Modernizacion 
 General 
 Proteccion ciudadana 
 Hacienda 
 Modernizacion 
 Modernizacion 
 Caja Credito 
 General 
 Ambiente y espacios verdes 
 Salud 
 Gobierno y Coordinacion 
 Gobierno y Coordinacion 
 Modernizacion 
 Ambiente 
 Proteccion ciudadana 
 Ambiente 
 Obras 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Secretaría de salúd, desarrollo humano y políticas sociales 
 General 
 Ambiente y espacios verdes 
 Proteccion Ciudadana 
 Modernizacion 
 salud, desarrollo humano y políticas sociales 
 Modernizacion 
 Juzgado 
 Ambiente 
 Gobierno y Coordinacion 
 Gobierno y Coordinacion 
 Gobierno y Coordinacion 
 salud, desarrollo humano y políticas sociales 
 salud, desarrollo humano y políticas sociales 
 Urbanismo e Infraestructura 
 Proteccion ciudadana 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Rentas 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Urbanismo e Infraestructura 
 Modernizacion + Rentas 
 Turismo y desarrollo económico 
 Turismo y desarrollo económico 
 Turismo y desarrollo económico 
 salud, desarrollo humano y políticas sociales 
 General 
 Modernizacion 
 instituto municipal de emprendedores 
 Secretaría de salúd, desarrollo humano y políticas sociales 
 Modernizacion 
 Educación y Cultura 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Proteccion Ciudadana 
 Modernizacion 
 Gobierno y Coordinacion 
 Modernizacion 
 Cultura y Educacion 
 salud, desarrollo humano y políticas sociales 
 Gobierno y Coordinacion 
 Cultura y Educacion 
 General 
 Modernizacion 
 urbanismo e infraestructura 
 Proteccion ciudadana 
 Gabinete y Modernizacion 
 ambiente y espacios públicos 
 Proteccion ciudadana 
 Turismo y desarrollo economico 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Modernizacion 
 Proteccion ciudadana (Transporte publico) 
 gobierno y Coordinacion, Hacienda, Ambiente
`;

const pb = new PocketBase('https://pocketbase-proyectos-sfvc.acostaparra.com/');

// Helper to normalize strings to Title Case for better display and comparison
function toTitleCase(str: string) {
  return str.replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

// Helper to remove accents for comparison
function normalizeForComparison(str: string) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

async function main() {
  console.log('Starting import...');

  // 1. Process and Deduplicate Data
  const lines = rawData.split('\n');
  const uniqueAreasMap = new Map<string, string>(); // key (normalized) -> Display Name

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const normalizedKey = normalizeForComparison(trimmed);
    
    // Logic to pick the "best" display name
    // If we already have it, we might want to keep the one with accents/better casing if the new one is worse?
    // For simplicity, let's just take the first one, but maybe force Title Case if it looks all lowercase
    
    let displayName = trimmed;
    // Simple heuristic: if it starts with lowercase, convert to Title Case
    if (trimmed.charAt(0) === trimmed.charAt(0).toLowerCase()) {
        displayName = toTitleCase(trimmed);
    }

    if (!uniqueAreasMap.has(normalizedKey)) {
        uniqueAreasMap.set(normalizedKey, displayName);
    } else {
        // If we have a stored value that is shorter or looks "worse" (heuristic), maybe replace it?
        // E.g. "turismo" vs "Turismo". We want "Turismo".
        // With the heuristic above, we already fixed "turismo" -> "Turismo".
        
        // Check if current displayName has accents and stored doesn't?
        // "Turismo y Desarrollo economico" vs "Turismo y desarrollo económico"
        // The one with accents is usually better.
        const currentStored = uniqueAreasMap.get(normalizedKey)!;
        if (trimmed.length > currentStored.length || (/[áéíóúñ]/.test(trimmed) && !/[áéíóúñ]/.test(currentStored))) {
             // Prefer the one with accents or longer (usually more descriptive)
             uniqueAreasMap.set(normalizedKey, trimmed);
        }
    }
  });

  const areasToImport = Array.from(uniqueAreasMap.values()).sort();
  console.log(`Found ${areasToImport.length} unique areas to process.`);

  // 2. Fetch existing areas to avoid duplicates in DB
  let existingAreas: any[] = [];
  try {
    existingAreas = await pb.collection('requesting_areas').getFullList();
    console.log(`Fetched ${existingAreas.length} existing areas from DB.`);
  } catch (e: any) {
    if (e.status === 404) {
        console.log('Collection requesting_areas not found. It will be created implicitly if auto-create is on, or script will fail.');
    } else {
        console.error('Error fetching existing areas:', e);
    }
  }

  const existingNamesNormalized = new Set(existingAreas.map(a => normalizeForComparison(a.name)));

  // 3. Insert new areas
  let addedCount = 0;
  let skippedCount = 0;

  for (const areaName of areasToImport) {
    const normalized = normalizeForComparison(areaName);
    
    if (existingNamesNormalized.has(normalized)) {
        console.log(`Skipping "${areaName}" (already exists)`);
        skippedCount++;
        continue;
    }

    try {
        console.log(`Creating "${areaName}"...`);
        await pb.collection('requesting_areas').create({
            name: areaName
        });
        addedCount++;
    } catch (err: any) {
        console.error(`Failed to create "${areaName}":`, err.message);
    }
  }

  console.log('Import finished.');
  console.log(`Added: ${addedCount}`);
  console.log(`Skipped: ${skippedCount}`);
}

main().catch(console.error);
