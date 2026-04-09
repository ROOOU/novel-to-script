import { useState, useRef, useCallback, type ChangeEvent, type DragEvent, type RefObject } from 'react';
import { isSupportedTextFile, readTextFile } from '@/lib/file-text';
import type { ToastType } from './useToast';

/**
 * useTextFileUpload 输入参数。
 */
export interface UseTextFileUploadOptions {
  /** 文件读取完成后的回调 */
  onTextLoaded: (content: string) => void;
  /** toast 通知回调 */
  showToast: (message: string, type?: ToastType) => void;
}

/**
 * useTextFileUpload 返回值。
 */
export interface UseTextFileUploadResult<
  TInputElement extends HTMLInputElement = HTMLInputElement,
  TDropElement extends HTMLElement = HTMLDivElement,
> {
  /** 是否处于拖拽激活态 */
  isTextDragActive: boolean;
  /** 直接读取指定文件 */
  loadTextFile: (file: File) => Promise<void>;
  /** 文件输入引用 */
  textFileInputRef: RefObject<TInputElement | null>;
  /** 文件选择回调 */
  handleFileSelect: (event: ChangeEvent<TInputElement>) => Promise<void>;
  /** 拖放回调 */
  handleDrop: (event: DragEvent<TDropElement>) => Promise<void>;
  /** 拖入回调 */
  handleDragOver: (event: DragEvent<TDropElement>) => void;
  /** 拖离回调 */
  handleDragLeave: (event: DragEvent<TDropElement>) => void;
  /** 打开文件选择器 */
  openFilePicker: () => void;
}

/**
 * 共享文本文件上传 Hook。
 * 支持点击上传和拖放，默认适配 `HTMLInputElement` 与 `HTMLDivElement`。
 */
export function useTextFileUpload({
  onTextLoaded,
  showToast,
}: UseTextFileUploadOptions): UseTextFileUploadResult<HTMLInputElement, HTMLDivElement> {
  const [isTextDragActive, setIsTextDragActive] = useState(false);
  const textFileInputRef = useRef<HTMLInputElement>(null);

  const loadTextFile = useCallback(async (file: File) => {
    if (!isSupportedTextFile(file)) {
      showToast('仅支持上传 .txt、.md 或 .docx 文件', 'error');
      return;
    }

    const content = await readTextFile(file);
    onTextLoaded(content);
    showToast(`已载入文件：${file.name}`);
  }, [onTextLoaded, showToast]);

  const handleFileSelect = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      await loadTextFile(file);
    } catch {
      showToast('读取文件失败，请重试', 'error');
    }
  }, [loadTextFile, showToast]);

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    try {
      await loadTextFile(file);
    } catch {
      showToast('读取文件失败，请重试', 'error');
    }
  }, [loadTextFile, showToast]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsTextDragActive(false);
  }, []);

  const openFilePicker = useCallback(() => {
    textFileInputRef.current?.click();
  }, []);

  return {
    isTextDragActive,
    loadTextFile,
    textFileInputRef,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    openFilePicker,
  };
}
