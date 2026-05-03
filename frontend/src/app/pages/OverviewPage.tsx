import { useDeferredValue, useMemo, useState } from "react";

import { pickText } from "../../lib/api";
import { CorpusDiagram, EquationStrip, HierarchyDiagram } from "../diagrams";
import type { Bundle, Language, OverviewMode, UiCopy } from "../types";
import { asArray, formatNumber } from "../utils";
import { DataPill, ModeSwitch, StatTile, StatusBadge, SurfaceCard } from "../ui";

export function OverviewPage({
  bundle,
  language,
  copy
}: {
  bundle: Bundle;
  language: Language;
  copy: UiCopy;
}) {
  const [mode, setMode] = useState<OverviewMode>("thesis");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const normalized = deferredSearch.trim().toLowerCase();
  const modes: Array<{ id: OverviewMode; label: string; detail: string }> = [
    { id: "thesis", label: "Thesis", detail: "Problem framing and symbolic bridge" },
    { id: "representations", label: "Representations", detail: "Alphabet, word, document, and inference" },
    { id: "families", label: "Families", detail: "Data supports and subset registry" },
    { id: "catalog", label: "Catalog", detail: "Dataset access, status, and scope" },
    { id: "validation", label: "Validation", detail: "Projection rules and workflow gates" }
  ];
  const filteredDatasets = useMemo(() => {
    if (!normalized) {
      return bundle.appData.datasets.datasets;
    }
    return bundle.appData.datasets.datasets.filter((dataset) => {
      const haystack = [dataset.name, dataset.modality, dataset.source, dataset.acquisition.status, ...dataset.domains].join(" ").toLowerCase();
      return haystack.includes(normalized);
    });
  }, [bundle.appData.datasets.datasets, normalized]);

  const readySubsets = bundle.interactiveSubsets.subsets.filter((entry) => entry.status === "ready");

  return (
    <div className="section-shell">
      <aside className="section-rail">
        <div className="section-rail-intro">
          <p className="eyebrow">{copy.routeOverview}</p>
          <h2>{copy.methodsTitle}</h2>
          <p>{copy.overviewIntro}</p>
        </div>
        <ModeSwitch label="Overview modules" items={modes} activeId={mode} onChange={setMode} />
        <div className="section-rail-stats">
          <StatTile label="families" value={formatNumber(bundle.appData.data_families.families.length)} />
          <StatTile label="ready subsets" value={formatNumber(readySubsets.length)} />
          <StatTile label="datasets" value={formatNumber(bundle.appData.datasets.datasets.length)} />
        </div>
      </aside>

      <div className="section-stage">
        {mode === "thesis" ? (
          <div className="page-stack">
            <EquationStrip />
            <div className="two-column-grid">
              <SurfaceCard eyebrow="corpus design" title="spectral corpus pipeline" subtitle="from support to latent structure">
                <CorpusDiagram />
              </SurfaceCard>
              <SurfaceCard eyebrow="hierarchy" title="sample-aware document design" subtitle={copy.measuredFamily}>
                <HierarchyDiagram />
              </SurfaceCard>
            </div>
            <SurfaceCard eyebrow="workflow" title={copy.flowTitle}>
              <div className="step-grid">
                {bundle.appData.methodology.workflow.map((step) => (
                  <article key={step.order} className="step-card">
                    <span>{step.order}</span>
                    <strong>{pickText(step.title, language)}</strong>
                    <p>{pickText(step.body, language)}</p>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {mode === "representations" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="representations" title={copy.methodsTitle} subtitle="alphabets, words, and documents">
              <div className="representation-grid">
                {bundle.appData.methodology.representations.map((representation) => (
                  <article key={representation.id} className="representation-card">
                    <span>{representation.id.toUpperCase()}</span>
                    <strong>{pickText(representation.name, language)}</strong>
                    <p>{pickText(representation.summary, language)}</p>
                    <dl>
                      <dt>Word</dt>
                      <dd>{pickText(representation.word_definition, language)}</dd>
                      <dt>Document</dt>
                      <dd>{pickText(representation.document_definition, language)}</dd>
                      <dt>Strength</dt>
                      <dd>{pickText(representation.strength, language)}</dd>
                      <dt>Caution</dt>
                      <dd>{pickText(representation.caution, language)}</dd>
                    </dl>
                    <div className="token-row">
                      {representation.token_example.map((token) => (
                        <DataPill key={token}>{token}</DataPill>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard eyebrow="inference" title="topic-aware inference routes" subtitle={`${bundle.appData.methodology.inference_modes.length} published modes`}>
              <div className="dataset-grid">
                {bundle.appData.methodology.inference_modes.map((modeEntry) => (
                  <article key={modeEntry.id} className="dataset-card">
                    <div className="dataset-card-head">
                      <strong>{pickText(modeEntry.title, language)}</strong>
                    </div>
                    <p>{pickText(modeEntry.description, language)}</p>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {mode === "families" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="families" title={copy.subsetRegistry} subtitle={copy.workspaceIntro}>
              <div className="family-grid">
                {bundle.appData.data_families.families.map((family) => (
                  <article key={family.id} className="family-overview-card">
                    <span>{family.code}</span>
                    <strong>{pickText(family.title, language)}</strong>
                    <p>{pickText(family.definition, language)}</p>
                    <div className="mini-stat-row">
                      <StatTile label="current" value={formatNumber(family.current_dataset_ids.length)} />
                      <StatTile label="candidate" value={formatNumber(family.candidate_dataset_ids.length)} />
                      <StatTile label="recipes" value={formatNumber(family.valid_recipe_ids.length)} />
                    </div>
                  </article>
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard eyebrow="ready subsets" title="interactive publication surface" subtitle={`${formatNumber(readySubsets.length)} ready slices`}>
              <div className="dataset-grid">
                {readySubsets.map((entry) => (
                  <article key={entry.id} className="dataset-card">
                    <div className="dataset-card-head">
                      <strong>{pickText(entry.title, language)}</strong>
                      <StatusBadge value={entry.status} />
                    </div>
                    <p>{pickText(entry.summary, language)}</p>
                    <div className="token-row">
                      <DataPill>{entry.family_id}</DataPill>
                      {entry.dataset_ids.slice(0, 3).map((datasetId) => (
                        <DataPill key={datasetId}>{datasetId}</DataPill>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </SurfaceCard>
          </div>
        ) : null}

        {mode === "catalog" ? (
          <SurfaceCard
            eyebrow="dataset catalog"
            title={copy.allDatasets}
            subtitle={`${formatNumber(filteredDatasets.length)} / ${formatNumber(bundle.appData.datasets.datasets.length)}`}
            actions={
              <input className="surface-search" type="search" placeholder={copy.datasetSearch} value={search} onChange={(event) => setSearch(event.target.value)} />
            }
          >
            <div className="dataset-grid">
              {filteredDatasets.slice(0, 18).map((dataset) => (
                <article key={dataset.id} className="dataset-card">
                  <div className="dataset-card-head">
                    <strong>{dataset.name}</strong>
                    <StatusBadge value={dataset.acquisition.status} />
                  </div>
                  <p>{pickText(dataset.notes, language)}</p>
                  <div className="token-row">
                    <DataPill>{dataset.modality}</DataPill>
                    <DataPill>{dataset.supervision.family_id}</DataPill>
                    {dataset.bands !== null ? <DataPill>{`${dataset.bands} bands`}</DataPill> : null}
                  </div>
                  <dl className="dataset-meta">
                    <dt>Source</dt>
                    <dd>
                      <a href={dataset.source_url} target="_blank" rel="noreferrer">
                        {dataset.source}
                      </a>
                    </dd>
                    <dt>Local</dt>
                    <dd>{pickText(dataset.local_status, language)}</dd>
                    <dt>Strategy</dt>
                    <dd>{pickText(dataset.repository_strategy, language)}</dd>
                  </dl>
                </article>
              ))}
            </div>
          </SurfaceCard>
        ) : null}

        {mode === "validation" ? (
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
                  <article key={`requirement-${index}`} className="compact-row">
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
