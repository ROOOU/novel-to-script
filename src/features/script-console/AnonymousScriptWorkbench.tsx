'use client';

import { GenerateButton } from '@/components/GenerateButton';
import { ProgressBar } from '@/components/ProgressBar';
import { Toast } from '@/components/Toast';
import { AnalysisPanel } from '@/app/(script)/AnalysisPanel';
import { ConfigPanel } from '@/app/(script)/ConfigPanel';
import { GENRES } from '@/app/(script)/constants';
import { GenreSelector } from '@/app/(script)/GenreSelector';
import { OutlinePanel } from '@/app/(script)/OutlinePanel';
import { ScriptViewer } from '@/app/(script)/ScriptViewer';
import { TextInputCard } from '@/app/(script)/TextInputCard';
import { useScriptPageState } from '@/app/(script)/useScriptPageState';

export function AnonymousScriptWorkbench() {
  const state = useScriptPageState();

  return (
    <main className="app-container">
      <div className="main-grid">
        <aside className="sidebar">
          <TextInputCard
            value={state.novelText}
            wordCount={state.wordCount}
            isDragActive={state.textUpload.isTextDragActive}
            fileInputRef={state.textUpload.textFileInputRef}
            accept={state.accept}
            onChange={state.setNovelText}
            onDrop={state.textUpload.handleDrop}
            onDragOver={state.textUpload.handleDragOver}
            onDragLeave={state.textUpload.handleDragLeave}
            onFileSelect={state.textUpload.handleFileSelect}
            onOpenFilePicker={state.textUpload.openFilePicker}
            onLoadSample={state.loadSample}
          />
          <GenreSelector
            genres={GENRES}
            selectedGenre={state.selectedGenre}
            onSelect={state.setSelectedGenre}
          />
          <ConfigPanel
            episodeCount={state.episodeCount}
            episodeDuration={state.episodeDuration}
            scriptStyle={state.scriptStyle}
            onEpisodeCountChange={state.setEpisodeCount}
            onEpisodeDurationChange={state.setEpisodeDuration}
            onScriptStyleChange={state.setScriptStyle}
          />
          <GenerateButton
            isGenerating={state.isGenerating}
            disabled={!state.novelText.trim()}
            onGenerate={() => {
              void state.handleGenerate();
            }}
            onStop={state.handleStop}
            idleLabel="✨ 开始生成剧本"
            loadingLabel="⏹ 停止生成"
          />
          {state.isGenerating ? (
            <ProgressBar progress={state.progress} currentStep={state.currentStep} />
          ) : null}
        </aside>

        <div className="result-panel">
          <div className="result-tabs">
            <button
              className={`result-tab ${state.activeTab === 'script' ? 'active' : ''}`}
              onClick={() => state.setActiveTab('script')}
            >
              📜 剧本
            </button>
            <button
              className={`result-tab ${state.activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => state.setActiveTab('analysis')}
            >
              🔍 分析
            </button>
            <button
              className={`result-tab ${state.activeTab === 'outline' ? 'active' : ''}`}
              onClick={() => state.setActiveTab('outline')}
            >
              📋 大纲
            </button>
          </div>

          {state.activeTab === 'script' ? (
            <ScriptViewer
              scripts={state.scripts}
              episodeCount={state.episodeCount}
              activeEpisode={state.activeEpisode}
              isGenerating={state.isGenerating}
              currentStep={state.currentStep}
              viewerRef={state.scriptViewerRef}
              onEpisodeChange={state.setActiveEpisode}
              onCopy={() => {
                void state.handleCopy();
              }}
              onDownloadCurrent={state.handleDownloadCurrent}
              onExportAll={state.handleExport}
            />
          ) : null}
          {state.activeTab === 'analysis' ? (
            <AnalysisPanel
              analysis={state.analysis}
              analysisRaw={state.analysisRaw}
              analysisError={state.analysisError}
              isGenerating={state.isGenerating}
              currentStep={state.currentStep}
              onDownload={state.handleDownloadCurrent}
            />
          ) : null}
          {state.activeTab === 'outline' ? (
            <OutlinePanel
              outline={state.outline}
              onDownload={state.handleDownloadCurrent}
            />
          ) : null}
        </div>
      </div>

      <Toast toast={state.toast} />
    </main>
  );
}
