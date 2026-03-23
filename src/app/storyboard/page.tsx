'use client';

import { GenerateButton } from '@/components/GenerateButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Toast } from '@/components/Toast';
import { ParsedInfo } from './ParsedInfo';
import { SafeModeDialog } from './SafeModeDialog';
import { ScriptInput } from './ScriptInput';
import { StoryboardViewer } from './StoryboardViewer';
import { StyleConfig } from './StyleConfig';
import { useStoryboardPageState } from './useStoryboardPageState';

export default function StoryboardPage() {
  const state = useStoryboardPageState();

  return (
    <main className="app-container">
      <div className="main-grid">
        <aside className="sidebar">
          <ScriptInput
            scriptText={state.scriptText}
            wordCount={state.wordCount}
            isTextDragActive={state.textUpload.isTextDragActive}
            textFileInputRef={state.textUpload.textFileInputRef}
            accept={state.accept}
            onScriptTextChange={state.setScriptText}
            onFileSelect={state.textUpload.handleFileSelect}
            onDrop={state.textUpload.handleDrop}
            onDragOver={state.textUpload.handleDragOver}
            onDragLeave={state.textUpload.handleDragLeave}
            onOpenFilePicker={state.textUpload.openFilePicker}
            onLoadSample={state.loadSample}
          />
          <StyleConfig
            visualStyle={state.visualStyle}
            colorTone={state.colorTone}
            genreType={state.genreType}
            onVisualStyleChange={state.setVisualStyle}
            onColorToneChange={state.setColorTone}
            onGenreTypeChange={state.setGenreType}
          />
          <ParsedInfo characters={state.characters} scenes={state.scenes} />
          <GenerateButton
            isGenerating={state.isGenerating}
            disabled={!state.scriptText.trim()}
            onGenerate={() => { void state.handleGenerate(); }}
            onStop={state.handleStop}
            idleLabel="🎥 生成分镜提示词"
            loadingLabel="⏹ 停止生成"
          />
          {state.isGenerating && <ProgressBar progress={state.progress} currentStep={state.currentStep} />}
        </aside>

        <StoryboardViewer
          storyboardResult={state.storyboardResult}
          isGenerating={state.isGenerating}
          currentStep={state.currentStep}
          resultRef={state.resultRef}
          onCopy={() => { void state.handleCopy(); }}
          onExport={state.handleExport}
        />
      </div>

      <Toast toast={state.toast} />
      <SafeModeDialog
        open={Boolean(state.safeModePrompt)}
        message={state.safeModePrompt?.message ?? ''}
        retryPrompt={state.safeModePrompt?.retryPrompt ?? ''}
        onCancel={state.dismissSafeModePrompt}
        onConfirm={() => { void state.handleGenerate(true); }}
      />
    </main>
  );
}
