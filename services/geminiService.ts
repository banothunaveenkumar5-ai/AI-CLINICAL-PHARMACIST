import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}
  
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    potentialErrors: {
      type: Type.ARRAY,
      description: "List of potential medication errors with clinical explanations.",
      items: {
        type: Type.OBJECT,
        properties: {
          errorType: { type: Type.STRING, description: "Category of error (e.g., 'Drug-Drug Interaction', 'Incorrect Dose', 'Contraindication')." },
          riskLevel: { type: Type.STRING, enum: ['Low', 'Moderate', 'High'], description: "Clinical risk level of the error." },
          error: { type: Type.STRING, description: "Concise description of the identified medication error." },
          explanation: { type: Type.STRING, description: "Detailed clinical rationale for the error, referencing guidelines (e.g., WHO, KDIGO) and patient data (e.g., lab values) where applicable." },
        },
        required: ["errorType", "riskLevel", "error", "explanation"],
      },
    },
    drugInformation: {
      type: Type.ARRAY,
      description: "Professional explanation for each prescribed drug.",
      items: {
        type: Type.OBJECT,
        properties: {
          drugName: { type: Type.STRING, description: "Generic and (if available) brand name." },
          drugClass: { type: Type.STRING, description: "Pharmacological class of the drug." },
          mechanismOfAction: { type: Type.STRING, description: "Brief explanation of how the drug works." },
          indication: { type: Type.STRING, description: "Primary reason for prescription." },
          prescribedDose: { type: Type.STRING, description: "Dose and frequency found in the document." },
          standardDose: { type: Type.STRING, description: "Typical standard dose for the indication." },
          adverseEffects: { type: Type.STRING, description: "Common and significant adverse effects." },
          monitoring: { type: Type.STRING, description: "Key lab parameters or signs to monitor." },
          precautions: { type: Type.STRING, description: "Important precautions (e.g., pregnancy, renal/hepatic impairment)." },
        },
        required: ["drugName", "drugClass", "mechanismOfAction", "indication", "prescribedDose", "standardDose", "adverseEffects", "monitoring", "precautions"],
      },
    },
    labInterpretation: {
      type: Type.ARRAY,
      description: "Interpretation of lab values found in the document.",
      items: {
        type: Type.OBJECT,
        properties: {
          parameter: { type: Type.STRING, description: "Name of the lab parameter (e.g., 'Creatinine', 'Hemoglobin')." },
          value: { type: Type.STRING, description: "The reported value of the lab parameter." },
          unit: { type: Type.STRING, description: "The unit of measurement (e.g., 'mg/dL', 'g/dL')." },
          status: { type: Type.STRING, enum: ['Normal', 'Low', 'High', 'Abnormal'], description: "Status of the lab value." },
          interpretation: { type: Type.STRING, description: "Clinical significance of the value and its potential impact on drug therapy." },
        },
        required: ["parameter", "value", "unit", "status", "interpretation"],
      },
    },
  },
  required: ["potentialErrors", "drugInformation", "labInterpretation"],
};


const basePrompt = `
  Act as an expert AI Clinical Pharmacist. Your task is to analyze the provided medical information with the highest degree of clinical accuracy.
  Your analysis must be structured according to the provided JSON schema and based on established clinical guidelines (e.g., WHO, NICE, KDIGO).

  1.  **Medication Error Detection:** Scrutinize all prescribed medications. Identify and report any potential errors including, but not limited to:
      -   Incorrect drug, dose, frequency, or duration.
      -   Significant drug-drug interactions.
      -   Contraindications based on diagnosis or lab values (e.g., Metformin with low eGFR).
      -   Duplicate therapy.
      -   Allergy-related errors if information is available.
      For each error, specify the type, assess the clinical risk level (Low, Moderate, High), and provide a clear, concise explanation referencing clinical principles or guidelines.

  2.  **Lab Value Interpretation:** If lab results are present, identify any abnormal values. For each, state the parameter, its value, status (Normal, Low, High), and its clinical significance, especially in relation to the prescribed medications.

  3.  **Drug-wise Professional Explanation:** For EACH drug identified, provide a comprehensive professional summary covering:
      -   Drug Name (Generic/Brand)
      -   Class
      -   Mechanism of Action
      -   Indication (why it's used)
      -   Prescribed Dose vs. Standard Dose
      -   Key Adverse Effects
      -   Essential Lab Monitoring
      -   Special Precautions (e.g., renal/hepatic adjustments).

  If a section is not applicable (e.g., no lab results), return an empty array for that key. Your output must be nothing but a valid JSON object that strictly conforms to the schema.
`;


async function performAnalysis(contents: any): Promise<AnalysisResult> {
  // Fix: Use a more powerful model for complex clinical analysis.
  const model = "gemini-3-pro-preview";
  try {
    const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
        }
    });
    
    if (!response.text) {
        throw new Error("API returned an empty response.");
    }

    const cleanedJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanedJson);

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to analyze the document. The API could not process the request.");
  }
}

export async function analyzeHealthDocument(
  base64ImageData: string,
  mimeType: string
): Promise<AnalysisResult> {
  
  const prompt = `${basePrompt}\n\nThe medical information is in the attached image.`;

  const imagePart = { inlineData: { data: base64ImageData, mimeType } };
  const textPart = { text: prompt };
  
  return performAnalysis({ parts: [imagePart, textPart] });
}


export async function analyzeHealthText(
  text: string
): Promise<AnalysisResult> {
  const prompt = `${basePrompt}\n\nHere is the medical text to analyze:\n\n---\n${text}\n---`;

  const textPart = { text: prompt };

  return performAnalysis({ parts: [textPart] });
}
