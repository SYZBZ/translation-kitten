import type { TranslatePromptResult } from "./translate"
import { BATCH_SEPARATOR } from "@/utils/constants/prompt"

export interface PdfPromptSegment {
  id: string
  text: string
}

export function buildPdfPrompt(targetLanguage: string, segments: PdfPromptSegment[]): TranslatePromptResult {
  return {
    systemPrompt: `You translate PDF text faithfully into ${targetLanguage}. Do not summarize, explain, omit, merge, or invent content. Preserve terminology and segment boundaries. Return only valid JSON: an array of objects with exactly the keys "id" and "translation". Copy every input id exactly once.`,
    prompt: JSON.stringify(segments.map(segment => ({ id: segment.id, text: segment.text }))),
  }
}

export async function getPdfTranslatePrompt(
  targetLanguage: string,
  input: string,
): Promise<TranslatePromptResult> {
  return {
    systemPrompt: `You are a precise document translator working into ${targetLanguage}. Translate every sentence faithfully. Do not summarize, explain, omit, merge, or invent content. Preserve numbers, citations, formulas, proper nouns, and paragraph boundaries. Output only the translation. If the input contains a standalone ${BATCH_SEPARATOR} separator line, reproduce each separator on its own line in exactly the same positions.`,
    prompt: `Translate this PDF text into ${targetLanguage}:\n\n${input}`,
  }
}

export function parsePdfTranslation(raw: string, expectedIds: string[]) {
  const parsed = JSON.parse(raw) as Array<{ id?: unknown, translation?: unknown }>
  const expected = new Set(expectedIds)
  const translations = new Map<string, string>()

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (typeof item.id === "string" && expected.has(item.id) && typeof item.translation === "string" && item.translation.trim()) {
        translations.set(item.id, item.translation.trim())
      }
    }
  }

  return {
    translations,
    missingIds: expectedIds.filter(id => !translations.has(id)),
  }
}
