import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });
dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;

// Initialize the Gemini API client correctly using the server key
// and specifying the 'aistudio-build' User-Agent for telemetry
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
}) : null;

// Mock database for community trusted services in memory
let trustedServices = [
  {
    id: "s1",
    name: "Juan Rollers & Decoraciones",
    category: "Instalación de Rollers",
    description: "Instala rollers, persianas y cortinas a domicilio. Muy puntual, pulcro y cobra precios justos. Trabaja en todo Lima.",
    phone: "+51 987 654 321",
    rating: 5,
    recommendedBy: "Carlos dpto 402"
  },
  {
    id: "s2",
    name: "Don Lucho Gas y Sanitarios",
    category: "Gasfitero / Plomero",
    description: "Excelente gasfitero de confianza. Solucionó una filtración de agua compleja en la lavadora en solo 1 hora.",
    phone: "+51 912 345 678",
    rating: 4.8,
    recommendedBy: "Marta dpto 201"
  },
  {
    id: "s3",
    name: "Sandro Luces y Cableado",
    category: "Electricista",
    description: "Instaló todas las luminarias LED dimerizables de nuestra sala. Súper profesional, trae sus propias herramientas.",
    phone: "+51 933 445 566",
    rating: 4.9,
    recommendedBy: "Esteban dpto 503"
  },
  {
    id: "s4",
    name: "Doña Elena - Limpieza Profunda",
    category: "Limpieza",
    description: "Servicio de limpieza impecable para mudanzas o mantenimiento semanal. Recomendada al 100% por toda la comunidad.",
    phone: "+51 955 667 788",
    rating: 5,
    recommendedBy: "Sofía dpto 104"
  }
];

// API Endpoints for Trusted Services
app.get("/api/trusted-services", (req, res) => {
  res.json(trustedServices);
});

app.post("/api/trusted-services", (req, res) => {
  const { name, category, description, phone, rating, recommendedBy } = req.body;
  if (!name || !category || !description || !phone) {
    return res.status(400).json({ error: "Faltan campos obligatorios" });
  }
  const newService = {
    id: `s-${Date.now()}`,
    name,
    category,
    description,
    phone,
    rating: Number(rating) || 5,
    recommendedBy: recommendedBy || "Roommate Anónimo"
  };
  trustedServices.push(newService);
  res.status(201).json(newService);
});

// Endpoint to chat and parse a shopping list request using Gemini API with Structured Output
app.post("/api/shopping/chat", async (req, res) => {
  const { message, previousItems } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Mensaje vacío" });
  }

  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY no configurada." });
  }

  try {
    const listDescription = previousItems && previousItems.length > 0 
      ? `La lista actual tiene los siguientes elementos: ${previousItems.map((i: any) => `${i.name} (le quedan ${i.quantity})`).join(", ")}`
      : "La lista de compras actual está vacía.";

    const systemPrompt = `Eres "DepaBot", un asistente inteligente de compras para un departamento compartido. Tu objetivo es procesar mensajes en español de los roomies sobre lo que falta comprar, lo que ya se compró o lo que se quiere quitar de la lista.
Analiza el mensaje y determina la acción adecuada.
Las acciones posibles son:
- "add": Agregar un producto (ejemplo: "falta papel higiénico", "compra 3 manzanas"). Intenta extraer el nombre del elemento y una cantidad aproximada (ej. "1 paquete", "3 unidades", "medio kilo", o por defecto "1 unidad").
- "check": Marcar como comprado u obtenido (ejemplo: "ya compré la sal", "marca plátanos como comprados").
- "remove": Eliminar por completo un artículo de la lista (ejemplo: "quita las naranjas", "borrar jabón").
- "clear": Limpiar toda la lista (ejemplo: "limpia la lista de compras", "borrar toda la lista").

${listDescription}

Responde en formato JSON estricto indicando la respuesta amigable del asistente ('aiResponse') que será leída por el usuario, y una lista de 'actions' a ejecutar sobre la lista física en la app.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: message,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["aiResponse", "actions"],
          properties: {
            aiResponse: {
              type: Type.STRING,
              description: "Una respuesta cordial y breve explicándole al roomie lo que se hizo (ej. '¡Hecho! Agregué papel higiénico a la lista' o 'Perfecto, acabo de tachar la sal como comprada')."
            },
            actions: {
              type: Type.ARRAY,
              description: "Las acciones a realizar en base al comando del usuario.",
              items: {
                type: Type.OBJECT,
                required: ["type", "name"],
                properties: {
                  type: {
                    type: Type.STRING,
                    description: "El tipo de operación: 'add', 'check', 'remove', o 'clear'."
                  },
                  name: {
                    type: Type.STRING,
                    description: "El nombre del producto limpio sin números ni palabras de cantidad (ej. 'leche', 'papel higiénico', 'manzanas')."
                  },
                  quantity: {
                    type: Type.STRING,
                    description: "La cantidad especificada por el usuario (ej. '3 unidades', '1 caja', o por defecto '1 unidad')."
                  }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text || "{}";
    const resultObj = JSON.parse(resultText.trim());
    res.json(resultObj);
  } catch (error: any) {
    console.error("Error calling Gemini API for shopping list:", error);
    res.json({
      aiResponse: `Entendido. Registré tu solicitud: "${message}".`,
      actions: [
        { type: "add", name: message.trim(), quantity: "1 unidad" }
      ]
    });
  }
});

// Endpoint to transcribe audio using Gemini 3.5 Flash AI
app.post("/api/transcribe", async (req, res) => {
  const { audio, mimeType } = req.body;
  if (!audio) {
    return res.status(400).json({ error: "No se proporcionó audio" });
  }

  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY no configurada." });
  }

  try {
    const audioPart = {
      inlineData: {
        mimeType: mimeType || "audio/webm",
        data: audio
      }
    };

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        audioPart,
        "Transcribe este audio en español de manera directa y exacta. El audio contiene una orden de compras para la casa (ej: 'falta leche', 'ya compre las manzanas', 'borra el detergente'). Devuelve ÚNICAMENTE el texto de la transcripción, sin saludos, sin explicaciones ni notas."
      ]
    });

    res.json({ text: (response.text || "").trim() });
  } catch (error: any) {
    console.error("Error transcribing audio via Gemini:", error);
    res.status(500).json({ error: "Fallo en la transcripción por IA" });
  }
});

// Endpoint to analyze expenses and generate report suggestions using Gemini API
app.post("/api/expenses/analyze", async (req, res) => {
  const { expenses, roommates, rentCost, rentCurrency = 'PEN', rentExchangeRate = 3.80 } = req.body;

  if (!ai) {
    return res.json({
      analysis: `### 💡 Tips de Ahorro y Análisis de Costos (Modo Simulación)
      
No se ha detectado el **GEMINI_API_KEY**. Aquí tienes algunos tips generales para compartir departamento:
1. **Negocien servicios recurrentes**: Asegúrense de contratar planes de internet y cable compartidos que utilicen realmente.
2. **Controlen las luces y electrodomésticos**: El agua y electricidad aumentan rápido, apaguen luces innecesarias y desconecten artefactos que no usen.
3. **Planifiquen compras de víveres en pack**: Comprar papel higiénico, detergente y verduras en mercados mayoristas reduce gastos compartidos hasta en 30%.
4. **Fórmula proportional**: Su método proporcional asignado garantiza justicia según lo que gana cada integrante del depa.`
    });
  }

  try {
    const rentTextString = rentCurrency === 'USD'
      ? `$ ${rentCost} dólares (Equivalente a S/. ${(rentCost * rentExchangeRate).toFixed(2)} soles a un T/C de ${rentExchangeRate})`
      : `S/. ${rentCost} soles`;

    const prompt = `Analiza los gastos del departamento, calcula proporciones y brinda recomendaciones de ahorro financieras en español para los roommates.
Datos actuales:
- Integrantes: ${JSON.stringify(roommates)}
- Alquiler Total: ${rentTextString}
- Registro de Gastos de este mes: ${JSON.stringify(expenses)}

Por favor elabora un reporte estructurado y amigable que contenga:
1. **Resumen de la situación**: Quién gastó más y cómo de equilibrado está el depa.
2. **Recomendaciones específicas de ahorro**: En base a las categorías donde reportan mayor consumo (ejemplo: si es comida, recomendar compras mayoristas. Si es membresía, sugerir revisar duplicidad).
3. **Tips de convivencia financiera**: Cómo manejar el split money de manera pacífica basándose en ingresos personales.
4. **Mensaje inspirador**: Un consejo inteligente de finanzas personales.
Evita formalidades corporativas excesivas, háblales como un roommate virtual inteligente, cálido y sabio de 'Mi depa'. Usa Markdown limpio para dar un formato espectacular con viñetas y títulos.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        systemInstruction: "Eres el Gurú Financiero de 'Mi depa'. Escribes reportes muy legibles, prácticos, con excelente ortografía, enfocados en peruanismos y terminología de soles peruano (S/.) o general.",
        temperature: 0.7,
      }
    });

    res.json({ analysis: response.text || "No se pudo generar el análisis de tips." });
  } catch (error: any) {
    console.error("Error in expense analyze endpoint:", error);
    res.status(500).json({ error: "Fallo en la comunicación con la inteligencia artificial" });
  }
});

const isProd = process.env.NODE_ENV === "production";

// Configure Vite middleware in development, and static serve in production
async function setupVite() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server", err);
});
