import type { Config } from "@/types/config/config"
import type { ProviderConfig } from "@/types/config/provider"
import { Sha256Hex } from "@/utils/hash"
import { prepareTranslationText } from "@/utils/host/translate/text-preparation"
import { sendMessage } from "@/utils/message"

export async function translatePdfText(
  text: string,
  langConfig: Config["language"],
  providerConfig: ProviderConfig,
): Promise<string> {
  const prepared = prepareTranslationText(text)
  if (!prepared)
    return ""
  return await sendMessage("enqueuePdfTranslateRequest", {
    text: prepared,
    langConfig,
    providerConfig,
    scheduleAt: Date.now(),
    hash: Sha256Hex("pdf-v1", prepared, JSON.stringify(providerConfig), langConfig.sourceCode, langConfig.targetCode),
  })
}
