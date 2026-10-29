import type { RecognizeResponse } from '@/lib/types';

/** 识别结果暂存（内存态），用于「识别页 → 确认页」之间传递数据。 */

export interface RecognitionDraft {
  imageUri: string;
  response: RecognizeResponse;
}

let draft: RecognitionDraft | null = null;

export function setDraft(d: RecognitionDraft | null): void {
  draft = d;
}

export function getDraft(): RecognitionDraft | null {
  return draft;
}

export function clearDraft(): void {
  draft = null;
}
