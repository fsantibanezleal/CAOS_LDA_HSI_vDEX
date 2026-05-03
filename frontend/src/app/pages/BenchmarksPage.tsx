import { useEffect, useState } from "react";

import { InteractiveHeatmap, RankedBars, type HeatmapColumn, type HeatmapRow, type RankedBarDatum } from "../../components/ScientificPlots";
import { pickText } from "../../lib/api";
import type { BenchmarksMode, Bundle, Language, UiCopy } from "../types";
import { asArray, formatMetric, formatNumber, getMeasuredTargetModelCatalog, summarizeLabeledRuns, summarizeMeasuredRuns, summarizeStabilityRuns } from "../utils";
import { BenchmarkModelCatalogList, BenchmarkWinnerRow, ModeSwitch, StatTile, SurfaceCard } from "../ui";
import { benchmarkRoleSourceLabel, benchmarkRoleSourceNote } from "../utils";

export function BenchmarksWorkbenchPage({
  bundle,
  language,
  copy
}: {
  bundle: Bundle;
  language: Language;
  copy: UiCopy;
}) {
  const [mode, setMode] = useState<BenchmarksMode>("stability");
  const stability = summarizeStabilityRuns(bundle.localCore);
  const labeled = summarizeLabeledRuns(bundle.localCore);
  const measured = summarizeMeasuredRuns(bundle.localCore);
  const [selectedStabilityId, setSelectedStabilityId] = useState<string | null>(stability[0]?.datasetId ?? null);
  const [selectedLabeledId, setSelectedLabeledId] = useState<string | null>(labeled[0]?.datasetId ?? null);
  const [selectedMeasuredId, setSelectedMeasuredId] = useState<string | null>(measured[0]?.subsetCode ?? null);
  const modes: Array<{ id: BenchmarksMode; label: string; detail: string }> = [
    { id: "stability", label: "Stability", detail: "Seed alignment and compact repetition" },
    { id: "labeled", label: "Labeled", detail: "Held-out perplexity on labeled scenes" },
    { id: "measured", label: "Measured", detail: "Family D topic, routing, and support variants" },
    { id: "contract", label: "Contract", detail: "Workflow stages and web projection rules" }
  ];

  useEffect(() => {
    if (!stability.some((entry) => entry.datasetId === selectedStabilityId)) {
      setSelectedStabilityId(stability[0]?.datasetId ?? null);
    }
  }, [selectedStabilityId, stability]);

  useEffect(() => {
    if (!labeled.some((entry) => entry.datasetId === selectedLabeledId)) {
      setSelectedLabeledId(labeled[0]?.datasetId ?? null);
    }
  }, [labeled, selectedLabeledId]);

  useEffect(() => {
    if (!measured.some((entry) => entry.subsetCode === selectedMeasuredId)) {
      setSelectedMeasuredId(measured[0]?.subsetCode ?? null);
    }
  }, [measured, selectedMeasuredId]);

  const stabilitySelected = stability.find((entry) => entry.datasetId === selectedStabilityId) ?? stability[0] ?? null;
  const labeledSelected = labeled.find((entry) => entry.datasetId === selectedLabeledId) ?? labeled[0] ?? null;
  const measuredSelected = measured.find((entry) => entry.subsetCode === selectedMeasuredId) ?? measured[0] ?? null;
  const measuredCatalog = getMeasuredTargetModelCatalog(bundle.localCore);
  const stabilityItems: RankedBarDatum[] = stability.map((entry) => ({
    id: entry.datasetId,
    label: entry.datasetName,
    value: entry.cosineMean ?? 0,
    detail: `min ${formatMetric(entry.cosineMin)} | jaccard ${formatMetric(entry.jaccardMean)}`,
    color: "linear-gradient(90deg, #47b4ff, #b9e4ff)"
  }));
  const labeledItems: RankedBarDatum[] = labeled.map((entry) => ({
    id: entry.datasetId,
    label: entry.datasetName,
    value: entry.testPerplexity ?? 0,
    detail: `${formatNumber(entry.classCount)} classes | ${formatNumber(entry.testSize)} test`,
    color: "linear-gradient(90deg, #ff982b, #ffd284)"
  }));
  const measuredItems: RankedBarDatum[] = measured.map((entry) => ({
    id: entry.subsetCode,
    label: entry.subsetCode,
    value: entry.measurementCount ?? 0,
    detail: `${formatNumber(entry.sampleCount)} samples | ${formatNumber(entry.numericVariableCount)} numeric targets`,
    color: "linear-gradient(90deg, #ff5d7b, #ffb0c0)"
  }));
  const stabilityColumns: HeatmapColumn[] = [
    { id: "cosine-mean", label: "cos mean" },
    { id: "cosine-min", label: "cos min" },
    { id: "jaccard", label: "jaccard" }
  ];
  const stabilityRows: HeatmapRow[] = stability.map((entry) => ({
    id: entry.datasetId,
    label: entry.datasetName,
    values: [entry.cosineMean ?? 0, entry.cosineMin ?? 0, entry.jaccardMean ?? 0]
  }));
  const labeledColumns: HeatmapColumn[] = [
    { id: "train", label: "train" },
    { id: "test", label: "test" }
  ];
  const labeledRows: HeatmapRow[] = labeled.map((entry) => ({
    id: entry.datasetId,
    label: entry.datasetName,
    values: [entry.trainPerplexity ?? 0, entry.testPerplexity ?? 0]
  }));
  const measuredColumns: HeatmapColumn[] = [
    { id: "sample", label: "sample" },
    { id: "cube", label: "cube" },
    { id: "region", label: "region" }
  ];
  const measuredRows: HeatmapRow[] = measured.map((entry) => ({
    id: entry.subsetCode,
    label: entry.subsetCode,
    values: [entry.topicPerplexity ?? 0, entry.hierarchicalPerplexity ?? 0, entry.regionalPerplexity ?? 0]
  }));

  return (
    <div className="section-shell">
      <aside className="section-rail">
        <div className="section-rail-intro">
          <p className="eyebrow">{copy.routeBenchmarks}</p>
          <h2>{copy.benchmarksTitle}</h2>
          <p>{pickText(bundle.localValidation.thesis, language)}</p>
        </div>
        <ModeSwitch label="Benchmark modules" items={modes} activeId={mode} onChange={setMode} />
        <div className="section-rail-stats">
          <StatTile label="labeled scenes" value={formatNumber(labeled.length)} />
          <StatTile label="stability runs" value={formatNumber(stability.length)} />
          <StatTile label="measured subsets" value={formatNumber(measured.length)} />
        </div>
      </aside>

      <div className="section-stage">
        {mode === "stability" ? (
          <div className="page-stack">
            <div className="two-column-grid">
              <SurfaceCard eyebrow="topic stability" title="seed alignment on compact runs" subtitle="Similarity metrics across repeated topic fits">
                <InteractiveHeatmap columns={stabilityColumns} rows={stabilityRows} selectedRowId={stabilitySelected?.datasetId ?? null} onRowSelect={setSelectedStabilityId} />
              </SurfaceCard>
              <SurfaceCard eyebrow="ranking" title="cosine alignment order" subtitle="Higher is better">
                <RankedBars items={stabilityItems} selectedId={stabilitySelected?.datasetId ?? null} onSelect={setSelectedStabilityId} formatter={(value) => value.toFixed(3)} />
              </SurfaceCard>
            </div>
            {stabilitySelected ? (
              <div className="stat-grid">
                <StatTile label="dataset" value={stabilitySelected.datasetName} />
                <StatTile label="topics" value={formatNumber(stabilitySelected.topicCount)} />
                <StatTile label="documents" value={formatNumber(stabilitySelected.documentCount)} />
                <StatTile label="perplexity" value={formatMetric(stabilitySelected.perplexityMean)} />
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "labeled" ? (
          <div className="page-stack">
            <div className="two-column-grid">
              <SurfaceCard eyebrow="held-out runs" title="train vs test perplexity" subtitle="Compact labeled-scene validation surface">
                <InteractiveHeatmap columns={labeledColumns} rows={labeledRows} selectedRowId={labeledSelected?.datasetId ?? null} onRowSelect={setSelectedLabeledId} formatter={(value) => value.toFixed(2)} />
              </SurfaceCard>
              <SurfaceCard eyebrow="ranking" title="test perplexity order" subtitle="Lower is better">
                <RankedBars items={labeledItems} selectedId={labeledSelected?.datasetId ?? null} onSelect={setSelectedLabeledId} formatter={(value) => value.toFixed(2)} />
              </SurfaceCard>
            </div>
            {labeledSelected ? (
              <div className="stat-grid">
                <StatTile label="dataset" value={labeledSelected.datasetName} />
                <StatTile label="classes" value={formatNumber(labeledSelected.classCount)} />
                <StatTile label="train" value={formatNumber(labeledSelected.trainSize)} />
                <StatTile label="test" value={formatNumber(labeledSelected.testSize)} />
              </div>
            ) : null}
          </div>
        ) : null}

        {mode === "measured" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="ptm supervision" title="control baselines versus routed PTM" subtitle={benchmarkRoleSourceLabel(measuredCatalog.metadataState)}>
              <p className="inline-note">{measuredCatalog.principle}</p>
              <p className="inline-note">{benchmarkRoleSourceNote(measuredCatalog.metadataState)}</p>
              <div className="two-column-grid">
                <BenchmarkModelCatalogList title="classification models" models={measuredCatalog.classification} formatCount={formatNumber} />
                <BenchmarkModelCatalogList title="regression models" models={measuredCatalog.regression} formatCount={formatNumber} />
              </div>
            </SurfaceCard>
            <div className="two-column-grid">
              <SurfaceCard eyebrow="subset routes" title={copy.measuredFamily} subtitle="Sample, cube, and region topic models per subset">
                <InteractiveHeatmap columns={measuredColumns} rows={measuredRows} selectedRowId={measuredSelected?.subsetCode ?? null} onRowSelect={setSelectedMeasuredId} formatter={(value) => value.toFixed(2)} />
              </SurfaceCard>
              <SurfaceCard eyebrow="coverage" title="measurement burden by subset" subtitle="Compact publication candidates">
                <RankedBars items={measuredItems} selectedId={measuredSelected?.subsetCode ?? null} onSelect={setSelectedMeasuredId} formatter={(value) => value.toFixed(0)} />
              </SurfaceCard>
            </div>
            {measuredSelected ? (
              <SurfaceCard eyebrow="selected subset" title={`${measuredSelected.subsetCode} / ${measuredSelected.datasetName}`} subtitle={measuredSelected.groupSplitName ?? "group split"}>
                <div className="stat-grid">
                  <StatTile label="samples" value={formatNumber(measuredSelected.sampleCount)} />
                  <StatTile label="measurements" value={formatNumber(measuredSelected.measurementCount)} />
                  <StatTile label="active topics" value={formatNumber(measuredSelected.activeTopicCount)} />
                  <StatTile label="cls/reg" value={`${formatNumber(measuredSelected.classificationTaskCount)}/${formatNumber(measuredSelected.regressionTaskCount)}`} />
                </div>
                <div className="compact-list">
                  <BenchmarkWinnerRow
                    label="best classification"
                    modelId={measuredSelected.bestClassificationModelId}
                    role={measuredSelected.bestClassificationModelRole}
                    detail={`${measuredSelected.bestClassificationTask ?? "classification task not published"} | bal acc ${formatMetric(measuredSelected.bestClassificationBalancedAccuracy)}`}
                  />
                  <BenchmarkWinnerRow
                    label="best regression"
                    modelId={measuredSelected.bestRegressionModelId}
                    role={measuredSelected.bestRegressionModelRole}
                    detail={`${measuredSelected.bestRegressionTarget ?? "regression target not published"} | R2 ${formatMetric(measuredSelected.bestRegressionR2)}`}
                  />
                </div>
                <p className="inline-note">{measuredSelected.ptmSupervisionPrinciple}</p>
                {measuredSelected.groupSplitReason ? <p className="inline-note">{measuredSelected.groupSplitReason}</p> : null}
                <p className="inline-note">{benchmarkRoleSourceNote(measuredSelected.roleMetadataState)}</p>
                {measuredSelected.topicActivityWarning ? <p className="inline-note warning-note">{measuredSelected.topicActivityWarning}</p> : null}
              </SurfaceCard>
            ) : null}
          </div>
        ) : null}

        {mode === "contract" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="workflow contract" title={copy.validationTitle}>
              <div className="step-grid">
                {bundle.localValidation.workflow_stages.map((stage, index) => (
                  <article key={stage.id} className="step-card">
                    <span>{index + 1}</span>
                    <strong>{stage.title}</strong>
                    <p>{stage.id}</p>
                  </article>
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard eyebrow="projection rules" title={copy.evidenceContract}>
              <div className="compact-list">
                {asArray(bundle.localValidation.web_projection_rules.requirements).map((requirement, index) => (
                  <article key={`projection-${index}`} className="compact-row">
                    <strong>{String(requirement)}</strong>
                    <span>required</span>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
