import { useState } from "react";

import { pickText } from "../../lib/api";
import type { Bundle, Language, UiCopy, UsageMode } from "../types";
import { CodeBlock, FolderCard, ModeSwitch, StatTile, SurfaceCard } from "../ui";

export function OperationsPage({
  bundle,
  language,
  copy
}: {
  bundle: Bundle;
  language: Language;
  copy: UiCopy;
}) {
  const [mode, setMode] = useState<UsageMode>("bootstrap");
  const repoBase = bundle.appData.overview.repo.url;
  const wikiBase = `${repoBase}/blob/main/wiki`;
  const localBase = `${repoBase}/blob/main/scripts/local`;
  const modes: Array<{ id: UsageMode; label: string; detail: string }> = [
    { id: "bootstrap", label: "Bootstrap", detail: "Setup, ports, preview, and smoke flow" },
    { id: "pipeline", label: "Pipeline", detail: "Fetch, derive, benchmark, and compact publication" },
    { id: "repo", label: "Repo", detail: "Operational folders and deep markdown documentation" }
  ];

  return (
    <div className="section-shell">
      <aside className="section-rail">
        <div className="section-rail-intro">
          <p className="eyebrow">{copy.routeUsage}</p>
          <h2>{copy.codeOffline}</h2>
          <p>{copy.usageIntro}</p>
        </div>
        <ModeSwitch label="Usage modules" items={modes} activeId={mode} onChange={setMode} />
        <div className="section-rail-stats">
          <StatTile label="frontend dev" value="5437" detail="Vite dev port" />
          <StatTile label="backend" value="8437" detail="FastAPI preview port" />
          <StatTile label="wip" value="in-repo" detail="Persistent work memory" />
        </div>
      </aside>

      <div className="section-stage">
        {mode === "bootstrap" ? (
          <div className="page-stack">
            <div className="two-column-grid">
              <SurfaceCard eyebrow="bootstrap" title={copy.setupCommands}>
                <CodeBlock
                  lines={[
                    ".\\scripts\\local.ps1 setup-web",
                    ".\\scripts\\local.ps1 setup-pipeline",
                    ".\\scripts\\local.ps1 setup-all",
                    ".\\scripts\\local.ps1 dev",
                    ".\\scripts\\local.ps1 preview"
                  ]}
                />
              </SurfaceCard>
              <SurfaceCard eyebrow="validation" title="local smoke contract">
                <CodeBlock lines={[".\\scripts\\local.ps1 build", ".\\scripts\\local.ps1 smoke", ".\\scripts\\local.ps1 smoke-dev"]} />
              </SurfaceCard>
            </div>
          </div>
        ) : null}

        {mode === "pipeline" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="pipeline" title={copy.flowTitle}>
              <CodeBlock
                lines={[
                  ".\\scripts\\local.ps1 fetch-all",
                  ".\\scripts\\local.ps1 build-real",
                  ".\\scripts\\local.ps1 build-field",
                  ".\\scripts\\local.ps1 build-spectral",
                  ".\\scripts\\local.ps1 build-corpus",
                  ".\\scripts\\local.ps1 build-baselines",
                  ".\\scripts\\local.ps1 build-local-core"
                ]}
              />
            </SurfaceCard>
            <SurfaceCard eyebrow="published workflow" title="offline stages projected into the app">
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

        {mode === "repo" ? (
          <div className="page-stack">
            <SurfaceCard eyebrow="repo map" title="folders that matter">
              <div className="dataset-grid">
                <FolderCard title="data-pipeline/" body="Acquisition, derivation, compact exports, and benchmark generation." />
                <FolderCard title="research_core/" body="Reusable validation and modelling utilities behind the local benchmark outputs." />
                <FolderCard title="data/" body="Manifests, compact derived assets, baseline previews, and raw staging." />
                <FolderCard title="app/ + frontend/" body="FastAPI plus the interactive surface that projects validated local artifacts." />
                <FolderCard title="wip/" body="Persistent session memory: session-start, pending, state, and decisions inside the repo." />
                <FolderCard title="wiki/" body="Deep markdown documentation, theory, dataset notes, and legacy audit." />
              </div>
            </SurfaceCard>

            <SurfaceCard eyebrow="deep docs" title="repo-linked documentation">
              <div className="link-grid">
                <a className="reference-card" href={`${wikiBase}/theory.md`} target="_blank" rel="noreferrer">
                  <strong>wiki/theory.md</strong>
                  <span>spectral PTM/LDA rationale</span>
                  <p>Equations, document definitions, and explicit caveats around spectral corpora.</p>
                </a>
                <a className="reference-card" href={`${wikiBase}/datasets.md`} target="_blank" rel="noreferrer">
                  <strong>wiki/datasets.md</strong>
                  <span>dataset landscape</span>
                  <p>Local anchors, cataloged candidates, and operational constraints by family.</p>
                </a>
                <a className="reference-card" href={`${wikiBase}/legacy-audit.md`} target="_blank" rel="noreferrer">
                  <strong>wiki/legacy-audit.md</strong>
                  <span>legacy reviewed directly</span>
                  <p>Notebook and paper audit based on actual inspection, not on stale extracts.</p>
                </a>
                <a className="reference-card" href={`${localBase}/README.md`} target="_blank" rel="noreferrer">
                  <strong>scripts/local/README.md</strong>
                  <span>local setup</span>
                  <p>Web and pipeline environment setup, plus the intended local execution flow.</p>
                </a>
              </div>
            </SurfaceCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
