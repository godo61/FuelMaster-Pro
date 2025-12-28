
import { GoogleGenAI, Type } from "@google/genai";
import { CalculatedEntry, SummaryStats } from "../types";

export const getFuelInsights = async (stats: SummaryStats, entries: CalculatedEntry[]): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Datos de muestra para contexto (últimas 5 entradas)
    const recentHistory = entries.slice(-5).map(e => ({
      fecha: e.date,
      consumo: e.consumption.toFixed(2),
      precio: e.pricePerLiter.toFixed(3)
    }));

    // Fix: Updated stats.avgCostPerKm to stats.avgCostPer100Km and adjusted label/unit
    const prompt = `Analiza los siguientes datos de consumo de combustible de mi vehículo:
    Estadísticas Generales:
    - Distancia Total: ${stats.totalDistance} km
    - Combustible Total: ${stats.totalFuel} L
    - Coste Total: ${stats.totalCost} €
    - Consumo Medio: ${stats.avgConsumption.toFixed(2)} L/100km
    - Coste por 100km: ${stats.avgCostPer100Km.toFixed(2)} €

    Historial Reciente:
    ${JSON.stringify(recentHistory, null, 2)}

    Proporciona 3 consejos o análisis breves y profesionales en español sobre la eficiencia de conducción, tendencias de precios o mantenimiento del vehículo basados en estos datos.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "Eres FuelMaster AI, un analista experto en eficiencia automotriz de clase mundial. Hablas español de forma clara y proporcionas consejos basados estrictamente en datos.",
      },
    });

    return response.text || "No hay análisis disponibles en este momento.";
  } catch (error) {
    console.error("Error en Gemini Insights:", error);
    return "No se pudieron generar los análisis de IA. Por favor, comprueba tu conexión o inténtalo más tarde.";
  }
};
