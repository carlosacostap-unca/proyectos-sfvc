import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString('utf-8');

    // Split into lines to handle batching
    // Simple split by newline (handling \r\n and \n)
    // Note: This simple split might break if cells contain newlines, but without a CSV parser lib this is the standard fallback.
    const allLines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    
    if (allLines.length === 0) {
        return NextResponse.json({ projects: [] });
    }

    const header = allLines[0];
    const dataRows = allLines.slice(1);
    
    // Process in batches of 25 rows to ensure the JSON output fits within token limits
    // 25 rows * ~500-800 chars JSON per row = ~12-20k chars. 
    // Max output tokens 16k ~= 64k chars. This gives us a safe margin.
    const BATCH_SIZE = 25;
    const batches = [];
    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        batches.push(dataRows.slice(i, i + BATCH_SIZE));
    }

    console.log(`Processing ${dataRows.length} rows in ${batches.length} batches...`);

    const allProjects: any[] = [];

    // Process batches sequentially (or with limited concurrency) to avoid rate limits
    // We'll use a simple sequential loop for reliability
    for (let i = 0; i < batches.length; i++) {
        const batchRows = batches[i];
        const batchCsv = [header, ...batchRows].join('\n');
        
        console.log(`Processing batch ${i + 1}/${batches.length}...`);

        const prompt = `
          You are a data processing assistant. I will provide a CSV snippet containing project information.
          Your task is to parse this CSV snippet and map it to a JSON object with a key "projects" containing an array of objects.
          
          Structure per project:
          {
            "code": string (Project Code),
            "system_name": string (System Name),
            "year": number (Year, default to current year if missing),
            "requesting_area": string (Name of the area),
            "status": string (Status name),
            "personal": string (Name of the Leader or Responsable e.g. "Juan Perez" or "Perez, Juan". Do NOT use "Product Owner" column),
            "start_date": string (ISO Date YYYY-MM-DD or null. Look for columns like "Fecha Inicio", "Start Date", "Comienzo"),
            "estimated_end_date": string (ISO Date YYYY-MM-DD or null. Look for columns like "Fecha Fin", "End Date", "Estimada Fin", "Cierre"),
            "observations": string (Look for columns like "Observaciones", "Notas", "Detalles", "Descripción"),
            "expected_benefit": string (Look for columns like "Beneficio", "Beneficio esperado", "Impacto"),
            "project_type": string[] (Array of type names. Split comma-separated values. Look for columns like "Tipo", "Type", "Categoría", "Clasificación"),
            "frontend_tech": string[] (Array of tech names),
            "backend_tech": string[] (Array of tech names),
            "database": string[] (Array of database names),
            "shift": string[] (Array of shift names e.g. 'Mañana', 'Tarde'),
            "estimated_duration": number (months, default 0. Look for columns like "Duración", "Duration", "Meses", "Plazo"),
            "security_level": string ("low" | "medium" | "high" | null. Look for columns like "Seguridad", "Security", "Nivel", "Risk". Map values like "Bajo"->"low", "Medio"->"medium", "Alto"->"high". If not found or empty, return null)
          }

          Rules:
          1. If a field is missing or cannot be inferred, use null for scalars or [] for arrays.
          2. Format dates as YYYY-MM-DD.
          3. Remove any BOM or weird characters from strings.
          4. Ensure "projects" key is present in the response.

          CSV Content (Snippet):
          ${batchCsv}
        `;

        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", 
                messages: [
                    { role: "system", content: "You are a helpful assistant that converts CSV data to JSON. Output valid JSON only. Do not truncate the JSON response." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                max_tokens: 16000, 
            });

            const content = completion.choices[0].message.content;
            if (!content) {
                console.warn(`Batch ${i + 1} returned no content.`);
                continue;
            }
            
            const parsed = JSON.parse(content);
            if (parsed.projects && Array.isArray(parsed.projects)) {
                allProjects.push(...parsed.projects);
            }
        } catch (err) {
            console.error(`Error processing batch ${i + 1}:`, err);
            // Continue with other batches instead of failing completely? 
            // Or throw? Let's throw to warn user something is wrong.
            throw err;
        }
    }

    return NextResponse.json({ projects: allProjects });

  } catch (error: any) {
    console.error('Error processing CSV:', error);
    // If the model name was the issue, we might see it here.
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
