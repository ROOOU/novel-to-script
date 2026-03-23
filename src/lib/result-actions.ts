import { copyTextToClipboard } from './clipboard';
import { downloadTextFile } from './file-text';

export interface ResultActionToast {
  (message: string, type?: 'success' | 'error'): void;
}

export interface CopyResultOptions {
  successMessage?: string;
  errorMessage?: string;
}

export interface ExportResultOptions {
  emptyMessage: string;
  successMessage: string;
}

export async function copyResultText(
  content: string,
  showToast: ResultActionToast,
  {
    successMessage = '已复制到剪贴板',
    errorMessage = '复制失败，请手动选择复制',
  }: CopyResultOptions = {}
): Promise<boolean> {
  if (!content) {
    return false;
  }

  if (await copyTextToClipboard(content)) {
    showToast(successMessage);
    return true;
  }

  showToast(errorMessage, 'error');
  return false;
}

export function exportResultText(
  content: string,
  filename: string,
  showToast: ResultActionToast,
  { emptyMessage, successMessage }: ExportResultOptions
): boolean {
  if (!content) {
    showToast(emptyMessage, 'error');
    return false;
  }

  downloadTextFile(content, filename);
  showToast(successMessage);
  return true;
}
