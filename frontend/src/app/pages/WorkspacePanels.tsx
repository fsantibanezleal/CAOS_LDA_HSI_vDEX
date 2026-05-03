import { useEffect, useState } from "react";

import { InteractiveHeatmap, InteractiveLinePlot, InteractiveScatter, RankedBars, type HeatmapColumn, type HeatmapRow, type RankedBarDatum } from "../../components/ScientificPlots";
import { pickText } from "../../lib/api";
import { TopicExplorer } from "../topic-explorer";
import type {
  AppPayload,
  DatasetEntry,
  FieldSceneSnapshot,
  InteractiveSubset,
  Language,
  LibraryClusterDiagnostic,
  MeasuredRunSummary,
  RealSceneSnapshot,
  Route,
  SceneClusterDiagnostic,
  SegmentationSceneBaseline,
  SpectralLibraryBandGroupSummary,
  SpectralLibrarySample,
  UiCopy
} from "../types";
import {
  buildFieldSeries,
  buildLibrarySeries,
  buildRealSeries,
  buildScatterPoints,
  findCorpusPreviews,
  findRecipes,
  formatMetric,
  formatNumber,
  formatPercent,
  formatShape,
  getMeasuredTopicViewItems,
  summarizeLabeledRuns,
  summarizeStabilityRuns,
  toTopicViewItems
} from "../utils";
import { TOPIC_COLORS, SERIES_COLORS } from "../constants";
import { ArtifactRow, ClaimRow, DataPill, ImageCard, MetricCard, StatTile, StatusBadge, SurfaceCard } from "../ui";
import type { DataFamily, GenericRecord } from "../types";

export function WorkspaceSidebar({
  family,
  subset,
  dataset,
  language,
  onRouteChange,
  copy
}: {
  family: DataFamily;
  subset: InteractiveSubset;
  dataset: DatasetEntry | null;
  language: Language;
  onRouteChange: (route: Route) => void;
  copy: UiCopy;
}) {
  return (
    <div className="workspace-inspector">
      <SurfaceCard eyebrow="subset contract" title={pickText(subset.title, language)} subtitle={subset.id}>
        <p>{pickText(subset.summary, language)}</p>
        <div className="token-row">
          <DataPill>{family.code}</DataPill>
          <DataPill>{subset.status}</DataPill>
          {dataset ? <DataPill>{dataset.name}</DataPill> : null}
        </div>
        <div className="compact-list">
          <article className="compact-row">
            <strong>Last validated</strong>
            <span>{subset.last_validated}</span>
          </article>
          {dataset ? (
            <article className="compact-row">
              <strong>Dataset modality</strong>
              <span>{dataset.modality}</span>
            </article>
          ) : null}
        </div>
      </SurfaceCard>

      <SurfaceCard eyebrow="claims" title={pickText(subset.public_goal, language)}>
        <div className="compact-list">
          {subset.supported_claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} language={language} tone="supported" />
          ))}
          {subset.blocked_claims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} language={language} tone="blocked" />
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard eyebrow="validation" title="gates and caveats">
        <div className="compact-list">
          {subset.validation_status.map((entry) => (
            <article key={entry.block_id} className="compact-row">
              <div className="dataset-card-head">
                <strong>{entry.block_id}</strong>
                <StatusBadge value={entry.status} />
              </div>
              <p>{pickText(entry.note, language)}</p>
            </article>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard eyebrow="next steps" title="caveats and pending work">
        <div className="compact-list">
          {subset.caveats.slice(0, 3).map((entry, index) => (
            <article key={`caveat-${index}`} className="compact-row">
              <strong>caveat</strong>
              <p>{pickText(entry, language)}</p>
            </article>
          ))}
          {subset.next_steps.slice(0, 3).map((entry, index) => (
            <article key={`next-${index}`} className="compact-row">
              <strong>next</strong>
              <p>{pickText(entry, language)}</p>
            </article>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard eyebrow="artifacts" title="published interfaces">
        <div className="compact-list">
          {subset.artifacts.map((artifact) => (
            <ArtifactRow key={artifact.id} artifact={artifact} language={language} />
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard eyebrow="jump" title="related surfaces">
        <div className="vertical-actions">
          <button type="button" className="secondary-button" onClick={() => onRouteChange("overview")}>
            {copy.routeOverview}
          </button>
          <button type="button" className="secondary-button" onClick={() => onRouteChange("benchmarks")}>
            {copy.routeBenchmarks}
          </button>
        </div>
      </SurfaceCard>
    </div>
  );
}

export function WorkspaceDatasetPanel({
  subset,
  dataset,
  realScene,
  fieldScene,
  librarySamples,
  sceneDiagnostic,
  libraryDiagnostic,
  segmentation,
  measuredSummary,
  measuredSummaries,
  language,
  copy
}: {
  subset: InteractiveSubset;
  dataset: DatasetEntry | null;
  realScene: RealSceneSnapshot | null;
  fieldScene: FieldSceneSnapshot | null;
  librarySamples: SpectralLibrarySample[];
  sceneDiagnostic: SceneClusterDiagnostic | null;
  libraryDiagnostic: LibraryClusterDiagnostic | null;
  segmentation: SegmentationSceneBaseline | null;
  measuredSummary: MeasuredRunSummary | null;
  measuredSummaries: MeasuredRunSummary[];
  language: Language;
  copy: UiCopy;
}) {
  if (realScene) {
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="sensor" value={realScene.sensor} />
          <StatTile label="cube" value={formatShape(realScene.cube_shape)} />
          <StatTile label="labels" value={formatNumber(realScene.labeled_pixels)} />
          <StatTile label="coverage" value={formatPercent(realScene.label_coverage_ratio)} />
        </div>
        <div className="two-column-grid">
          <SurfaceCard eyebrow={copy.datasetView} title={realScene.name} subtitle={realScene.notes}>
            <InteractiveLinePlot xValues={realScene.approximate_wavelengths_nm} series={buildRealSeries(realScene)} xLabel="wavelength (nm)" yLabel="normalized response" />
          </SurfaceCard>
          {sceneDiagnostic ? (
            <SurfaceCard eyebrow="diagnostic embedding" title={sceneDiagnostic.scene_name} subtitle={sceneDiagnostic.feature_space}>
              <InteractiveScatter points={buildScatterPoints(sceneDiagnostic.points)} />
            </SurfaceCard>
          ) : (
            <SurfaceCard eyebrow="class support" title="compact label summaries" subtitle="Class means are already projected in the spectral panel.">
              <div className="compact-list">
                {realScene.class_summaries.slice(0, 5).map((summary) => (
                  <article key={summary.label_id} className="compact-row">
                    <strong>{summary.name}</strong>
                    <span>{`${formatNumber(summary.count)} pixels`}</span>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          )}
        </div>
        {realScene.rgb_preview_path || realScene.label_preview_path || segmentation?.preview_path ? (
          <SurfaceCard eyebrow="reference rasters" title="context overlays" subtitle="Visual rasters stay secondary to the analytical surfaces.">
            <div className="image-grid compact-image-grid">
              {realScene.rgb_preview_path ? <ImageCard title="RGB synthetic" src={realScene.rgb_preview_path} /> : null}
              {realScene.label_preview_path ? <ImageCard title="labels" src={realScene.label_preview_path} /> : null}
              {segmentation?.preview_path ? <ImageCard title="SLIC baseline" src={segmentation.preview_path} /> : null}
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    );
  }

  if (fieldScene) {
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="sensor" value={fieldScene.sensor} />
          <StatTile label="patches" value={formatNumber(fieldScene.patch_count)} />
          <StatTile label="patch size" value={formatNumber(fieldScene.patch_size)} />
          <StatTile label="bands" value={formatNumber(fieldScene.band_names.length)} />
        </div>
        <div className="two-column-grid">
          <SurfaceCard eyebrow={copy.datasetView} title={fieldScene.name} subtitle={fieldScene.notes}>
            <InteractiveLinePlot xValues={fieldScene.band_centers_nm} series={buildFieldSeries(fieldScene)} xLabel="band center (nm)" yLabel="reflectance" />
          </SurfaceCard>
          <SurfaceCard eyebrow="strata support" title="patch-level spectral strata" subtitle="Mean spectra come from compact strata summaries.">
            <div className="compact-list">
              {fieldScene.strata_summaries.slice(0, 5).map((summary) => (
                <article key={summary.label_id} className="compact-row">
                  <strong>{summary.name}</strong>
                  <span>{`${formatNumber(summary.count)} patches`}</span>
                </article>
              ))}
            </div>
          </SurfaceCard>
        </div>
        <SurfaceCard eyebrow="reference rasters" title="orthomosaic and indices" subtitle="Static maps remain secondary support for the spectral view.">
          <div className="image-grid compact-image-grid">
            <ImageCard title="RGB orthomosaic" src={fieldScene.rgb_preview_path} />
            <ImageCard title="NDVI" src={fieldScene.ndvi_preview_path} />
          </div>
        </SurfaceCard>
      </div>
    );
  }

  if (librarySamples.length > 0) {
    const xValues = librarySamples[0]?.wavelengths_nm ?? [];
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="samples" value={formatNumber(librarySamples.length)} />
          <StatTile label="groups" value={formatNumber(new Set(librarySamples.map((sample) => sample.group)).size)} />
          <StatTile label="sensor" value={librarySamples[0]?.sensor ?? "n/a"} />
          <StatTile label="bands" value={formatNumber(librarySamples[0]?.band_count ?? null)} />
        </div>
        <SurfaceCard eyebrow={copy.datasetView} title={dataset?.name ?? "Spectral library"} subtitle={dataset ? pickText(dataset.notes, language) : ""}>
          <InteractiveLinePlot xValues={xValues} series={buildLibrarySeries(librarySamples)} xLabel="wavelength (nm)" yLabel="reflectance" />
        </SurfaceCard>
        {libraryDiagnostic ? (
          <SurfaceCard eyebrow="diagnostic embedding" title={libraryDiagnostic.library_name} subtitle={libraryDiagnostic.feature_space}>
            <InteractiveScatter points={buildScatterPoints(libraryDiagnostic.points)} />
          </SurfaceCard>
        ) : null}
      </div>
    );
  }

  if (measuredSummary) {
    const items: RankedBarDatum[] = [
      { id: "samples", label: "samples", value: measuredSummary.sampleCount ?? 0, color: "linear-gradient(90deg, #47b4ff, #b9e4ff)" },
      { id: "measurements", label: "measurements", value: measuredSummary.measurementCount ?? 0, color: "linear-gradient(90deg, #ff982b, #ffd284)" },
      { id: "cube-docs", label: "cube documents", value: measuredSummary.cubeDocumentCount ?? 0, color: "linear-gradient(90deg, #f2c14f, #ffe38c)" },
      { id: "region-docs", label: "region documents", value: measuredSummary.regionDocumentCount ?? 0, color: "linear-gradient(90deg, #ff5d7b, #ffb0c0)" }
    ];
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="subset" value={measuredSummary.subsetCode} />
          <StatTile label="numeric targets" value={formatNumber(measuredSummary.numericVariableCount)} />
          <StatTile label="categorical targets" value={formatNumber(measuredSummary.categoricalVariableCount)} />
          <StatTile label="topics" value={formatNumber(measuredSummary.topicCount)} />
        </div>
        <SurfaceCard eyebrow={copy.datasetView} title={measuredSummary.datasetName} subtitle={dataset ? pickText(dataset.notes, language) : copy.measuredFamily}>
          <RankedBars items={items} formatter={(value) => value.toFixed(0)} />
        </SurfaceCard>
        <SurfaceCard eyebrow="representations" title="sample, cube, and regional supports" subtitle={measuredSummary.groupSplitName ?? "group split"}>
          <div className="two-column-grid">
            <MetricCard label="sample perplexity" value={formatMetric(measuredSummary.topicPerplexity)} />
            <MetricCard label="cube perplexity" value={formatMetric(measuredSummary.hierarchicalPerplexity)} />
            <MetricCard label="region perplexity" value={formatMetric(measuredSummary.regionalPerplexity)} />
            <MetricCard label="active topics" value={formatNumber(measuredSummary.activeTopicCount)} />
          </div>
          {measuredSummary.groupSplitReason ? <p className="inline-note">{measuredSummary.groupSplitReason}</p> : null}
        </SurfaceCard>
      </div>
    );
  }

  if (measuredSummaries.length > 0) {
    const items: RankedBarDatum[] = measuredSummaries.map((entry, index) => ({
      id: entry.subsetCode,
      label: entry.subsetCode,
      value: entry.measurementCount ?? 0,
      detail: `${formatNumber(entry.sampleCount)} samples | ${formatNumber(entry.numericVariableCount)} numeric targets`,
      color: `linear-gradient(90deg, ${TOPIC_COLORS[index % TOPIC_COLORS.length]}, ${SERIES_COLORS[index % SERIES_COLORS.length]})`
    }));
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="subsets" value={formatNumber(measuredSummaries.length)} />
          <StatTile label="samples" value={formatNumber(measuredSummaries.reduce((sum, entry) => sum + (entry.sampleCount ?? 0), 0))} />
          <StatTile label="measurements" value={formatNumber(measuredSummaries.reduce((sum, entry) => sum + (entry.measurementCount ?? 0), 0))} />
          <StatTile label="family" value="HIDSAG" />
        </div>
        <SurfaceCard eyebrow={copy.datasetView} title={copy.measuredFamily} subtitle={dataset ? pickText(dataset.notes, language) : subset.id}>
          <RankedBars items={items} formatter={(value) => value.toFixed(0)} />
        </SurfaceCard>
      </div>
    );
  }

  return (
    <SurfaceCard eyebrow={copy.datasetView} title={copy.empty} subtitle={subset.id}>
      <p>{copy.emptyWorkspace}</p>
    </SurfaceCard>
  );
}

export function WorkspaceMethodPanel({ appData, subset, language }: { appData: AppPayload; subset: InteractiveSubset; language: Language }) {
  const recipes = findRecipes(appData, subset);
  const corpusPreviews = findCorpusPreviews(appData, subset);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(corpusPreviews[0]?.id ?? null);

  useEffect(() => {
    if (!corpusPreviews.some((preview) => preview.id === selectedPreviewId)) {
      setSelectedPreviewId(corpusPreviews[0]?.id ?? null);
    }
  }, [corpusPreviews, selectedPreviewId]);

  const selectedPreview = corpusPreviews.find((preview) => preview.id === selectedPreviewId) ?? corpusPreviews[0] ?? null;
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedPreview?.recipe_id) ?? recipes[0] ?? null;
  const previewColumns: HeatmapColumn[] = [
    { id: "documents", label: "docs" },
    { id: "vocabulary", label: "vocab" },
    { id: "mean-length", label: "mean len" },
    { id: "zero-docs", label: "zero" }
  ];
  const previewRows: HeatmapRow[] = corpusPreviews.map((preview) => ({
    id: preview.id,
    label: `${preview.recipe_id} / ${preview.dataset_name}`,
    values: [preview.document_count, preview.vocabulary_size, preview.document_length.mean, preview.zero_token_documents]
  }));

  return (
    <div className="panel-stack">
      <SurfaceCard eyebrow="publication matrix" title="corpus preview diagnostics" subtitle={`${corpusPreviews.length} compact preview payloads`}>
        {previewRows.length > 0 ? (
          <InteractiveHeatmap columns={previewColumns} rows={previewRows} selectedRowId={selectedPreview?.id ?? null} onRowSelect={setSelectedPreviewId} formatter={(value) => value.toFixed(value >= 100 ? 0 : 2)} />
        ) : (
          <p className="inline-note">No compact corpus previews are published for this subset yet.</p>
        )}
      </SurfaceCard>

      <div className="two-column-grid">
        <SurfaceCard eyebrow="selected preview" title={selectedPreview ? `${selectedPreview.recipe_id} / ${selectedPreview.dataset_name}` : "preview pending"} subtitle={selectedRecipe ? pickText(selectedRecipe.title, language) : "No recipe selected"}>
          {selectedPreview && selectedRecipe ? (
            <>
              <div className="mini-stat-row">
                <StatTile label="docs" value={formatNumber(selectedPreview.document_count)} />
                <StatTile label="vocab" value={formatNumber(selectedPreview.vocabulary_size)} />
                <StatTile label="mean len" value={formatMetric(selectedPreview.document_length.mean, 1)} />
                <StatTile label="zero docs" value={formatNumber(selectedPreview.zero_token_documents)} />
              </div>
              <dl className="dataset-meta">
                <dt>Alphabet</dt>
                <dd>{pickText(selectedRecipe.alphabet_definition, language)}</dd>
                <dt>Word</dt>
                <dd>{pickText(selectedRecipe.word_definition, language)}</dd>
                <dt>Document</dt>
                <dd>{pickText(selectedRecipe.document_definition, language)}</dd>
              </dl>
              <div className="token-row">
                {selectedPreview.top_tokens.slice(0, 8).map((token) => (
                  <DataPill key={`${selectedPreview.id}-${token.token}`}>{`${token.token} | ${token.count}`}</DataPill>
                ))}
              </div>
              {selectedPreview.example_documents[0] ? <p className="inline-note">{selectedPreview.example_documents[0].tokens.slice(0, 12).join(" ")}</p> : null}
            </>
          ) : (
            <p className="inline-note">This subset still lacks a compact preview contract.</p>
          )}
        </SurfaceCard>
        <SurfaceCard eyebrow="active recipes" title="document and vocabulary definitions" subtitle={`${recipes.length} active recipes`}>
          <div className="compact-list">
            {recipes.map((recipe) => (
              <article key={recipe.id} className={selectedRecipe?.id === recipe.id ? "compact-row is-highlighted" : "compact-row"}>
                <strong>{pickText(recipe.title, language)}</strong>
                <span>{recipe.id}</span>
                <p>{pickText(recipe.summary, language)}</p>
              </article>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard eyebrow="previews" title="static corpus previews" subtitle={`${corpusPreviews.length} published payloads`}>
        <div className="corpus-grid">
          {corpusPreviews.map((preview) => (
            <article key={preview.id} className="corpus-card">
              <div className="dataset-card-head">
                <strong>{preview.recipe_id}</strong>
                <span>{preview.dataset_name}</span>
              </div>
              <div className="mini-stat-row">
                <StatTile label="docs" value={formatNumber(preview.document_count)} />
                <StatTile label="vocab" value={formatNumber(preview.vocabulary_size)} />
                <StatTile label="zero" value={formatNumber(preview.zero_token_documents)} />
              </div>
              <div className="token-row">
                {preview.top_tokens.slice(0, 8).map((token) => (
                  <DataPill key={`${preview.id}-${token.token}`}>{`${token.token} | ${token.count}`}</DataPill>
                ))}
              </div>
              {preview.example_documents[0] ? <p className="inline-note">{preview.example_documents[0].tokens.slice(0, 10).join(" ")}</p> : null}
            </article>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

export function WorkspaceTopicsPanel({
  subset,
  realScene,
  fieldScene,
  spectralSummary,
  measuredRun,
  measuredSummaries,
  language,
  copy
}: {
  subset: InteractiveSubset;
  realScene: RealSceneSnapshot | null;
  fieldScene: FieldSceneSnapshot | null;
  spectralSummary: SpectralLibraryBandGroupSummary | null;
  measuredRun: GenericRecord | null;
  measuredSummaries: MeasuredRunSummary[];
  language: Language;
  copy: UiCopy;
}) {
  if (realScene) {
    return <TopicExplorer items={toTopicViewItems(realScene.topics, language)} xValues={realScene.approximate_wavelengths_nm} title={copy.topicsTitle} />;
  }
  if (fieldScene) {
    return <TopicExplorer items={toTopicViewItems(fieldScene.topics, language)} xValues={fieldScene.band_centers_nm} title={copy.topicsTitle} />;
  }
  if (spectralSummary) {
    return (
      <div className="panel-stack">
        <div className="stat-grid">
          <StatTile label="band group" value={formatNumber(spectralSummary.bandCount)} />
          <StatTile label="topic count" value={formatNumber(spectralSummary.topicCount)} />
          <StatTile label="perplexity" value={formatMetric(spectralSummary.perplexity)} />
          <StatTile label="NMI" value={formatMetric(spectralSummary.nmi)} />
        </div>
        <TopicExplorer items={spectralSummary.topTopics} xValues={[]} title={`${copy.topicsTitle} | ${spectralSummary.datasetName}`} />
      </div>
    );
  }
  if (measuredRun) {
    const items = getMeasuredTopicViewItems(measuredRun);
    return <TopicExplorer items={items} xValues={[]} title={`${copy.topicsTitle} | ${subset.id}`} />;
  }
  if (measuredSummaries.length > 0) {
    return (
      <SurfaceCard eyebrow={copy.topicsView} title={copy.measuredFamily} subtitle="subset-scoped topic models live in the benchmark payloads">
        <div className="token-row">
          {measuredSummaries.map((entry) => (
            <DataPill key={entry.subsetCode}>{entry.subsetCode}</DataPill>
          ))}
        </div>
        <p className="inline-note">Family D currently exposes multiple subset-specific topic models. The aggregate workspace keeps them together at the family level and the benchmark page breaks them apart.</p>
      </SurfaceCard>
    );
  }
  return (
    <SurfaceCard eyebrow={copy.topicsView} title={copy.empty} subtitle={subset.id}>
      <p>{copy.emptyWorkspace}</p>
    </SurfaceCard>
  );
}

export function WorkspaceInferencePanel({
  labeledSummary,
  stabilitySummary,
  measuredSummary,
  measuredSummaries,
  segmentation,
  copy
}: {
  labeledSummary: ReturnType<typeof summarizeLabeledRuns>[number] | null;
  stabilitySummary: ReturnType<typeof summarizeStabilityRuns>[number] | null;
  measuredSummary: MeasuredRunSummary | null;
  measuredSummaries: MeasuredRunSummary[];
  segmentation: SegmentationSceneBaseline | null;
  copy: UiCopy;
}) {
  if (measuredSummary) {
    const items: RankedBarDatum[] = [
      { id: "sample", label: "sample topic model", value: measuredSummary.topicPerplexity ?? 0, detail: `${formatNumber(measuredSummary.activeTopicCount)} active topics`, color: "linear-gradient(90deg, #ff982b, #ffd284)" },
      { id: "cube", label: "cube aggregation", value: measuredSummary.hierarchicalPerplexity ?? 0, detail: `${formatNumber(measuredSummary.classificationTaskCount)} classification tasks`, color: "linear-gradient(90deg, #47b4ff, #b9e4ff)" },
      { id: "region", label: "region aggregation", value: measuredSummary.regionalPerplexity ?? 0, detail: `${formatNumber(measuredSummary.regressionTaskCount)} regression tasks`, color: "linear-gradient(90deg, #ff5d7b, #ffb0c0)" }
    ];
    return (
      <div className="panel-stack">
        <SurfaceCard eyebrow={copy.inferenceView} title={measuredSummary.datasetName} subtitle={measuredSummary.subsetCode}>
          <RankedBars items={items} formatter={(value) => value.toFixed(2)} />
          <div className="compact-list">
            <article className="compact-row">
              <strong>best classification</strong>
              <span>{measuredSummary.bestClassificationModelId ?? "n/a"}</span>
              <p>{`${measuredSummary.bestClassificationTask ?? "classification task not published"} | bal acc ${formatMetric(measuredSummary.bestClassificationBalancedAccuracy)}`}</p>
            </article>
            <article className="compact-row">
              <strong>best regression</strong>
              <span>{measuredSummary.bestRegressionModelId ?? "n/a"}</span>
              <p>{`${measuredSummary.bestRegressionTarget ?? "regression target not published"} | R2 ${formatMetric(measuredSummary.bestRegressionR2)}`}</p>
            </article>
          </div>
          <p className="inline-note">{measuredSummary.ptmSupervisionPrinciple}</p>
          {measuredSummary.groupSplitReason ? <p className="inline-note">{measuredSummary.groupSplitReason}</p> : null}
          {measuredSummary.topicActivityWarning ? <p className="inline-note warning-note">{measuredSummary.topicActivityWarning}</p> : null}
        </SurfaceCard>
      </div>
    );
  }
  if (measuredSummaries.length > 0) {
    const items: RankedBarDatum[] = measuredSummaries.map((entry, index) => ({
      id: entry.subsetCode,
      label: entry.subsetCode,
      value: entry.regionalPerplexity ?? entry.topicPerplexity ?? 0,
      detail: `${formatNumber(entry.classificationTaskCount)} cls | ${formatNumber(entry.regressionTaskCount)} reg`,
      color: `linear-gradient(90deg, ${TOPIC_COLORS[index % TOPIC_COLORS.length]}, ${SERIES_COLORS[index % SERIES_COLORS.length]})`
    }));
    return (
      <SurfaceCard eyebrow={copy.inferenceView} title={copy.measuredFamily} subtitle="regional topic surfaces by subset">
        <RankedBars items={items} formatter={(value) => value.toFixed(2)} />
        <p className="inline-note">Flat topic mixtures are treated as controls here. Use the benchmark route to inspect routed and support-aggregated winners per subset.</p>
      </SurfaceCard>
    );
  }
  if (segmentation) {
    return (
      <div className="panel-stack">
        <SurfaceCard eyebrow={copy.inferenceView} title={copy.noInference}>
          <div className="stat-grid">
            <StatTile label="segments" value={formatNumber(segmentation.segment_count)} />
            <StatTile label="purity" value={formatMetric(segmentation.label_metrics.weighted_label_purity)} />
            <StatTile label="coverage" value={formatPercent(segmentation.label_metrics.label_coverage_ratio)} />
            <StatTile label="method" value={segmentation.method_id} />
          </div>
        </SurfaceCard>
      </div>
    );
  }
  if (labeledSummary || stabilitySummary) {
    return (
      <div className="panel-stack">
        <SurfaceCard eyebrow={copy.inferenceView} title="compact local validation">
          <div className="stat-grid">
            {labeledSummary ? <StatTile label="test perplexity" value={formatMetric(labeledSummary.testPerplexity)} /> : null}
            {labeledSummary ? <StatTile label="topics" value={formatNumber(labeledSummary.topicCount)} /> : null}
            {stabilitySummary ? <StatTile label="cosine mean" value={formatMetric(stabilitySummary.cosineMean)} /> : null}
            {stabilitySummary ? <StatTile label="jaccard mean" value={formatMetric(stabilitySummary.jaccardMean)} /> : null}
          </div>
          <p className="inline-note">These compact labeled-scene runs validate topic quality and stability, not public predictive claims.</p>
        </SurfaceCard>
      </div>
    );
  }
  return (
    <SurfaceCard eyebrow={copy.inferenceView} title={copy.empty} subtitle={copy.noInference}>
      <p>{copy.emptyWorkspace}</p>
    </SurfaceCard>
  );
}
