import { useEffect, useState } from "react";

import { ComparisonBars, InteractiveHeatmap, RankedBars, type HeatmapColumn, type HeatmapRow, type RankedBarDatum } from "../../components/ScientificPlots";
import { TOPIC_COLORS, SERIES_COLORS } from "../constants";
import { TopicExplorer } from "../topic-explorer";
import type { HidsagSubsetSummary, UiCopy } from "../types";
import { benchmarkRoleSourceLabel, benchmarkRoleSourceNote, formatMetric, formatNumber } from "../utils";
import { BenchmarkWinnerRow, DataPill, ModeSwitch, StatTile, SurfaceCard } from "../ui";

export function HidsagDatasetPanel({
  summaries,
  selectedCode,
  onSelectCode
}: {
  summaries: HidsagSubsetSummary[];
  selectedCode: string | null;
  onSelectCode: (code: string) => void;
}) {
  const selected = summaries.find((entry) => entry.subsetCode === selectedCode) ?? summaries[0] ?? null;
  const columns: HeatmapColumn[] = [
    { id: "samples", label: "samples" },
    { id: "measurements", label: "meas" },
    { id: "region-docs", label: "region docs" },
    { id: "numeric-vars", label: "numeric vars" }
  ];
  const rows: HeatmapRow[] = summaries.map((entry) => ({
    id: entry.subsetCode,
    label: entry.subsetCode,
    values: [entry.sampleCount ?? 0, entry.measurementCount ?? 0, entry.regionDocumentCount ?? 0, entry.numericVariableCount ?? 0]
  }));
  const rankedItems: RankedBarDatum[] = summaries.map((entry, index) => ({
    id: entry.subsetCode,
    label: entry.subsetCode,
    value: entry.measurementCount ?? 0,
    detail: `${formatNumber(entry.sampleCount)} samples | ${formatNumber(entry.regionDocumentCount)} region docs`,
    color: `linear-gradient(90deg, ${TOPIC_COLORS[index % TOPIC_COLORS.length]}, ${SERIES_COLORS[index % SERIES_COLORS.length]})`
  }));

  if (!selected) {
    return null;
  }

  return (
    <div className="panel-stack">
      <div className="two-column-grid">
        <SurfaceCard eyebrow="family d inventory" title="HIDSAG subset publication map" subtitle="Subset burden and public compact coverage">
          <InteractiveHeatmap columns={columns} rows={rows} selectedRowId={selected.subsetCode} onRowSelect={onSelectCode} formatter={(value) => value.toFixed(0)} />
        </SurfaceCard>
        <SurfaceCard eyebrow="measurement burden" title="subset ordering by measurements" subtitle="Select one subset to inspect it across the remaining views">
          <RankedBars items={rankedItems} selectedId={selected.subsetCode} onSelect={onSelectCode} formatter={(value) => value.toFixed(0)} />
        </SurfaceCard>
      </div>

      <SurfaceCard eyebrow="selected subset" title={selected.subsetCode} subtitle={`${formatNumber(selected.numericVariableCount)} numeric targets published`}>
        <div className="stat-grid">
          <StatTile label="samples" value={formatNumber(selected.sampleCount)} />
          <StatTile label="measurements" value={formatNumber(selected.measurementCount)} />
          <StatTile label="region docs" value={formatNumber(selected.regionDocumentCount)} />
          <StatTile label="patch grid" value={`${formatNumber(selected.patchRows)} x ${formatNumber(selected.patchCols)}`} />
        </div>
        <div className="token-row">
          {selected.dominantVariables.map((entry) => (
            <DataPill key={`${selected.subsetCode}-${entry}`}>{entry}</DataPill>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

export function HidsagMethodPanel({ summary }: { summary: HidsagSubsetSummary | null }) {
  if (!summary) {
    return null;
  }

  const bandColumns: HeatmapColumn[] = [
    { id: "bands", label: "bands" },
    { id: "masked-frac", label: "masked frac" },
    { id: "retained-frac", label: "retained frac" }
  ];
  const bandRows: HeatmapRow[] = summary.modalityBandSummaries.map((entry) => ({
    id: entry.modality,
    label: entry.modality,
    values: [entry.bandCount ?? 0, entry.maskedFraction ?? 0, entry.retainedFraction ?? 0]
  }));

  return (
    <div className="panel-stack">
      <div className="two-column-grid">
        <SurfaceCard eyebrow="region documents" title={`${summary.subsetCode} document geometry`} subtitle="Fixed-grid regional support used by Family D compact outputs">
          <div className="stat-grid">
            <StatTile label="docs/meas" value={formatMetric(summary.docsPerMeasurementMean, 1)} />
            <StatTile label="docs/sample" value={formatMetric(summary.docsPerSampleMean, 1)} />
            <StatTile label="cube files" value={formatNumber(summary.cubeFileCount)} />
            <StatTile label="crops" value={formatNumber(summary.cropCount)} />
          </div>
          <div className="compact-list">
            {summary.featureLayouts.map((entry) => (
              <article key={`${summary.subsetCode}-${entry.modality}`} className="compact-row">
                <strong>{entry.modality}</strong>
                <span>{`${formatNumber(entry.bandCount)} bands`}</span>
                <p>{entry.source ?? "source not published"}</p>
              </article>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard eyebrow="band policy" title="heuristic bad-band trimming by modality" subtitle="Current temporary gate before source-aware masks">
          {bandRows.length > 0 ? (
            <InteractiveHeatmap columns={bandColumns} rows={bandRows} formatter={(value) => (value >= 1 ? value.toFixed(0) : value.toFixed(3))} />
          ) : (
            <p className="inline-note">No band-quality publication surface is available for this subset.</p>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}

export function HidsagTopicsPanel({ summary, copy }: { summary: HidsagSubsetSummary | null; copy: UiCopy }) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(summary?.policyRuns[0]?.id ?? null);

  useEffect(() => {
    if (!summary?.policyRuns.some((entry) => entry.id === selectedPolicyId)) {
      setSelectedPolicyId(summary?.policyRuns[0]?.id ?? null);
    }
  }, [selectedPolicyId, summary]);

  if (!summary) {
    return null;
  }

  const selectedPolicy = summary.policyRuns.find((entry) => entry.id === selectedPolicyId) ?? summary.policyRuns[0] ?? null;
  const policyModes = summary.policyRuns.map((entry) => ({
    id: entry.id,
    label: entry.label,
    detail: `${formatMetric(entry.samplePerplexity, 1)} sample ppl`
  }));

  if (!selectedPolicy) {
    return (
      <SurfaceCard eyebrow={copy.topicsView} title={summary.subsetCode}>
        <p className="inline-note">No topic policy runs are currently published for this subset.</p>
      </SurfaceCard>
    );
  }

  return (
    <div className="panel-stack">
      <SurfaceCard eyebrow="policy selection" title={`${summary.subsetCode} topic surfaces`} subtitle="Sample-topic tokens under different preprocessing policies">
        <ModeSwitch label="Family D preprocessing policies" items={policyModes} activeId={selectedPolicy.id} onChange={setSelectedPolicyId} />
      </SurfaceCard>
      {selectedPolicy.topTopics.length > 0 ? (
        <TopicExplorer items={selectedPolicy.topTopics} xValues={[]} title={`${copy.topicsTitle} | ${summary.subsetCode} | ${selectedPolicy.label}`} />
      ) : (
        <SurfaceCard eyebrow={copy.topicsView} title={`${summary.subsetCode} | ${selectedPolicy.label}`} subtitle={selectedPolicy.description}>
          <p className="inline-note">This policy does not publish compact top-token payloads yet.</p>
        </SurfaceCard>
      )}
    </div>
  );
}

export function HidsagInferencePanel({ summary, copy }: { summary: HidsagSubsetSummary | null; copy: UiCopy }) {
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(summary?.policyRuns[0]?.id ?? null);

  useEffect(() => {
    if (!summary?.policyRuns.some((entry) => entry.id === selectedPolicyId)) {
      setSelectedPolicyId(summary?.policyRuns[0]?.id ?? null);
    }
  }, [selectedPolicyId, summary]);

  if (!summary) {
    return null;
  }

  const selectedPolicy = summary.policyRuns.find((entry) => entry.id === selectedPolicyId) ?? summary.policyRuns[0] ?? null;
  const policyColumns: HeatmapColumn[] = [
    { id: "sample", label: "sample" },
    { id: "cube", label: "cube" },
    { id: "region", label: "region" },
    { id: "bal-acc", label: "bal acc" },
    { id: "r2", label: "r2" }
  ];
  const policyRows: HeatmapRow[] = summary.policyRuns.map((entry) => ({
    id: entry.id,
    label: entry.label,
    values: [entry.samplePerplexity ?? 0, entry.cubePerplexity ?? 0, entry.regionalPerplexity ?? 0, entry.bestBalancedAccuracy ?? 0, entry.bestRegressionR2 ?? 0]
  }));
  const regressionItems: RankedBarDatum[] = summary.policyRuns.map((entry) => ({
    id: entry.id,
    label: entry.label,
    value: entry.bestRegressionR2 ?? 0,
    detail: entry.description
  }));
  const classificationItems: RankedBarDatum[] = summary.policyRuns.map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    value: entry.bestBalancedAccuracy ?? 0,
    detail: entry.description,
    color: `linear-gradient(90deg, ${TOPIC_COLORS[index % TOPIC_COLORS.length]}, ${SERIES_COLORS[index % SERIES_COLORS.length]})`
  }));

  return (
    <div className="panel-stack">
      <SurfaceCard eyebrow="ptm stance" title={`${summary.subsetCode} control vs routed reading`} subtitle={benchmarkRoleSourceLabel(summary.roleMetadataState)}>
        <div className="compact-list">
          <BenchmarkWinnerRow
            label="best classification"
            modelId={summary.bestClassificationModelId}
            role={summary.bestClassificationModelRole}
            detail={`${summary.bestClassificationTask ?? "classification task not published"} | bal acc ${formatMetric(summary.bestBalancedAccuracy)}`}
          />
          <BenchmarkWinnerRow
            label="best regression"
            modelId={summary.bestRegressionModelId}
            role={summary.bestRegressionModelRole}
            detail={`${summary.bestRegressionTarget ?? "regression target not published"} | R2 ${formatMetric(summary.bestRegressionR2)}`}
          />
        </div>
        <p className="inline-note">{summary.ptmSupervisionPrinciple}</p>
        <p className="inline-note">{benchmarkRoleSourceNote(summary.roleMetadataState)}</p>
      </SurfaceCard>

      <div className="two-column-grid">
        <SurfaceCard eyebrow="policy comparison" title={`${summary.subsetCode} preprocessing sensitivity`} subtitle="Topic routing quality under alternative preprocessing contracts">
          <InteractiveHeatmap columns={policyColumns} rows={policyRows} selectedRowId={selectedPolicy?.id ?? null} onRowSelect={setSelectedPolicyId} formatter={(value) => value.toFixed(3)} />
        </SurfaceCard>
        <SurfaceCard eyebrow="classification" title="best balanced accuracy by policy" subtitle={summary.bestClassificationTask ?? "classification task not published"}>
          <RankedBars items={classificationItems} selectedId={selectedPolicy?.id ?? null} onSelect={setSelectedPolicyId} formatter={(value) => value.toFixed(3)} />
        </SurfaceCard>
      </div>

      <div className="two-column-grid">
        <SurfaceCard eyebrow="regression" title="best regression R2 by policy" subtitle={summary.bestRegressionTarget ?? "regression target not published"}>
          <ComparisonBars items={regressionItems} selectedId={selectedPolicy?.id ?? null} onSelect={setSelectedPolicyId} formatter={(value) => value.toFixed(3)} />
        </SurfaceCard>
        <SurfaceCard eyebrow={copy.inferenceView} title={`${summary.subsetCode} | ${selectedPolicy?.label ?? "policy"}`} subtitle={summary.groupSplitName ?? "group split"}>
          <div className="stat-grid">
            <StatTile label="sample ppl" value={formatMetric(selectedPolicy?.samplePerplexity ?? null, 1)} />
            <StatTile label="cube ppl" value={formatMetric(selectedPolicy?.cubePerplexity ?? null, 1)} />
            <StatTile label="region ppl" value={formatMetric(selectedPolicy?.regionalPerplexity ?? null, 1)} />
            <StatTile label="active topics" value={formatNumber(selectedPolicy?.activeTopicCount ?? null)} />
          </div>
          {summary.groupSplitReason ? <p className="inline-note">{summary.groupSplitReason}</p> : null}
          {selectedPolicy ? <p className="inline-note">{selectedPolicy.description}</p> : null}
        </SurfaceCard>
      </div>
    </div>
  );
}
