import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, previousItems } = req.body;
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'Missing Gemini API key' });

  const itemList = previousItems?.map((i: any) => i.name).join(', ') || 'ninguno';

  const prompt = `Eres un asistente de lista de compras en español peruano.
El usuario dijo: "${message}"
Items actuales en la lista: ${itemList}

Responde SOLO con un JSON con este formato exacto:
{
  "actions": [
    { "type": "add", "name": "nombre del item", "quantity": "cantidad como string, ej: '2 kg'" },
    { "type": "check", "name": "nombre del item" },
    { "type": "remove", "name": "nombre del item" },
    { "type": "clear", "name": "" }
  ]
}

Solo incluye las acciones que el usuario pidió. Si pide agregar algo sin cantidad, usa "1 u" como cantidad.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'No response from Gemini' });

    const parsed = JSON.parse(text);
    return res.json(parsed);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to process voice command' });
  }
}
