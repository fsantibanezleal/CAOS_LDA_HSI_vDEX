import { startTransition } from "react";

import { pickText } from "../../lib/api";
import { HidsagDatasetPanel, HidsagInferencePanel, HidsagMethodPanel, HidsagTopicsPanel } from "./HidsagPanels";
import { WorkspaceDatasetPanel, WorkspaceInferencePanel, WorkspaceMethodPanel, WorkspaceSidebar, WorkspaceTopicsPanel } from "./WorkspacePanels";
import type { Bundle, DataFamily, DatasetEntry, GenericRecord, InteractiveSubset, Language, Route, UiCopy, WorkspaceView } from "../types";
import {
  asString,
  findFieldScene,
  findLibraryDiagnostic,
  findRealScene,
  findSceneDiagnostic,
  findSegmentation,
  getMeasuredTopicViewItems,
  isRecord,
  summarizeHidsagSubsets,
  summarizeLabeledRuns,
  summarizeMeasuredRuns,
  summarizeSpectralLibrary,
  summarizeStabilityRuns,
  toTopicViewItems
} from "../utils";
import { ModeSwitch, StatusBadge, SurfaceCard } from "../ui";

export function ScientificWorkspacePage({
  bundle,
  family,
  subset,
  dataset,
  view,
  onViewChange,
  onRouteChange,
  onFamilyChange,
  onSubsetChange,
  language,
  copy
}: {
  bundle: Bundle;
  family: DataFamily;
  subset: InteractiveSubset;
  dataset: DatasetEntry | null;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onRouteChange: (route: Route) => void;
  onFamilyChange: (familyId: string) => void;
  onSubsetChange: (subsetId: string) => void;
  language: Language;
  copy: UiCopy;
}) {
  const measuredSubsetCode = subset.id.replace("family-d-", "").toUpperCase();
  const familySubsets = bundle.interactiveSubsets.subsets
    .filter((entry) => entry.family_id === family.id)
    .sort((a, b) => a.status.localeCompare(b.status) || a.title.en.localeCompare(b.title.en));

  const realScene = findRealScene(bundle.appData, subset);
  const fieldScene = findFieldScene(bundle.appData, subset);
  const sceneDiagnostic = findSceneDiagnostic(bundle.appData, subset);
  const libraryDiagnostic = dataset ? findLibraryDiagnostic(bundle.appData, dataset.id) : null;
  const segmentation = findSegmentation(bundle.appData, subset);
  const librarySamples = dataset ? bundle.appData.spectral_library.samples.filter((sample) => sample.id.startsWith(dataset.id)) : [];
  const spectralSummary = dataset ? summarizeSpectralLibrary(bundle.localCore, dataset.id) : null;
  const measuredRun =
    bundle.localCore.measured_target_runs.find(
      (entry): entry is GenericRecord => isRecord(entry) && asString(entry.subset_code) === measuredSubsetCode
    ) ?? null;
  const measuredSummaries = summarizeMeasuredRuns(bundle.localCore);
  const measuredSummary = measuredSummaries.find((entry) => entry.subsetCode === measuredSubsetCode) ?? null;
  const hidsagSummaries = summarizeHidsagSubsets(bundle, measuredSummaries);
  const hidsagSummary = hidsagSummaries.find((entry) => entry.subsetCode === measuredSubsetCode) ?? null;
  const stabilitySummary = summarizeStabilityRuns(bundle.localCore).find((entry) => subset.dataset_ids.includes(entry.datasetId)) ?? null;
  const labeledSummary = summarizeLabeledRuns(bundle.localCore).find((entry) => subset.dataset_ids.includes(entry.datasetId)) ?? null;
  const topicItems = realScene
    ? toTopicViewItems(realScene.topics, language)
    : fieldScene
      ? toTopicViewItems(fieldScene.topics, language)
      : spectralSummary
        ? spectralSummary.topTopics
        : measuredRun
          ? getMeasuredTopicViewItems(measuredRun)
          : [];

  const workspaceViews: Array<{ id: WorkspaceView; label: string; detail: string }> = [
    { id: "dataset", label: copy.evidenceView, detail: "Local scene, sample, or library evidence" },
    { id: "method", label: copy.methodView, detail: "Corpus design, compact previews, and method constraints" },
    { id: "topics", label: copy.topicsView, detail: `${topicItems.length} topic surfaces currently published` },
    { id: "inference", label: copy.inferenceView, detail: "Benchmarks, routed tasks, and target signals" }
  ];

  const familyCards = bundle.appData.data_families.families.map((entry) => ({
    id: entry.id,
    title: pickText(entry.title, language),
    detail: `${entry.code} | ${entry.current_dataset_ids.length} current datasets`
  }));

  const changeView = (nextView: WorkspaceView) => {
    startTransition(() => onViewChange(nextView));
  };

  return (
    <div className="workspace-layout">
      <aside className="workspace-rail">
        <div className="workspace-rail-head">
          <p className="eyebrow">{copy.routeWorkspace}</p>
          <h2>{copy.workspaceIntro}</h2>
        </div>

        <SurfaceCard eyebrow="family selector" title="Dataset families" subtitle="Choose the scientific family before the subset.">
          <div className="family-selector-grid">
            {familyCards.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={family.id === entry.id ? "family-selector-card is-active" : "family-selector-card"}
                onClick={() => onFamilyChange(entry.id)}
              >
                <strong>{entry.title}</strong>
                <span>{entry.detail}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard eyebrow="subset selector" title={copy.subsetRegistry} subtitle={copy.workspaceIntro}>
          <div className="subset-selector-list">
            {familySubsets.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={subset.id === entry.id ? "subset-selector-card is-active" : "subset-selector-card"}
                onClick={() => onSubsetChange(entry.id)}
              >
                <div className="dataset-card-head">
                  <strong>{pickText(entry.title, language)}</strong>
                  <StatusBadge value={entry.status} />
                </div>
                <span>{pickText(entry.summary, language)}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <ModeSwitch label="Workspace views" items={workspaceViews} activeId={view} onChange={changeView} />

        <WorkspaceSidebar family={family} subset={subset} dataset={dataset} language={language} onRouteChange={onRouteChange} copy={copy} />
      </aside>

      <div className="workspace-stage">
        {view === "dataset" ? (
          family.id === "regions-with-measurements" ? (
            <HidsagDatasetPanel summaries={hidsagSummaries} selectedCode={hidsagSummary?.subsetCode ?? null} onSelectCode={(code) => onSubsetChange(`family-d-${code.toLowerCase()}`)} />
          ) : (
            <WorkspaceDatasetPanel
              subset={subset}
              dataset={dataset}
              realScene={realScene}
              fieldScene={fieldScene}
              librarySamples={librarySamples}
              sceneDiagnostic={sceneDiagnostic}
              libraryDiagnostic={libraryDiagnostic}
              segmentation={segmentation}
              measuredSummary={measuredSummary}
              measuredSummaries={measuredSummaries}
              language={language}
              copy={copy}
            />
          )
        ) : null}

        {view === "method" ? family.id === "regions-with-measurements" ? <HidsagMethodPanel summary={hidsagSummary} /> : <WorkspaceMethodPanel appData={bundle.appData} subset={subset} language={language} /> : null}

        {view === "topics" ? (
          family.id === "regions-with-measurements" ? (
            <HidsagTopicsPanel summary={hidsagSummary} copy={copy} />
          ) : (
            <WorkspaceTopicsPanel subset={subset} realScene={realScene} fieldScene={fieldScene} spectralSummary={spectralSummary} measuredRun={measuredRun} measuredSummaries={measuredSummaries} language={language} copy={copy} />
          )
        ) : null}

        {view === "inference" ? (
          family.id === "regions-with-measurements" ? (
            <HidsagInferencePanel summary={hidsagSummary} copy={copy} />
          ) : (
            <WorkspaceInferencePanel labeledSummary={labeledSummary} stabilitySummary={stabilitySummary} measuredSummary={measuredSummary} measuredSummaries={measuredSummaries} segmentation={segmentation} copy={copy} />
          )
        ) : null}
      </div>
    </div>
  );
}
