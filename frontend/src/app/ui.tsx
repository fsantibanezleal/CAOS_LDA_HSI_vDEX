import type { ReactNode } from "react";

import { pickText } from "../lib/api";
import { ROUTES } from "./constants";
import type {
  BenchmarkModelRoleDescriptor,
  InteractiveSubsetArtifact,
  InteractiveSubsetClaim,
  Language,
  ProjectOverview,
  Route,
  Theme,
  UiCopy
} from "./types";
import { benchmarkModelLabel, benchmarkRoleLabel } from "./utils";

export function SurfaceCard({
  eyebrow,
  title,
  subtitle,
  children,
  actions
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="surface-card">
      <header className="surface-card-head">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {subtitle ? <p className="surface-subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="surface-actions">{actions}</div> : null}
      </header>
      <div className="surface-card-body">{children}</div>
    </section>
  );
}

export function StatTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

export function DataPill({ children }: { children: ReactNode }) {
  return <span className="data-pill">{children}</span>;
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="link-chip" href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function StatusBadge({ value }: { value: string }) {
  return <span className={`status-badge status-${value}`}>{value}</span>;
}

export function BenchmarkWinnerRow({
  label,
  modelId,
  role,
  detail
}: {
  label: string;
  modelId: string | null;
  role: string | null;
  detail: string;
}) {
  const summary = role ? `${benchmarkRoleLabel(role)} | ${detail}` : detail;
  return (
    <article className="compact-row">
      <strong>{label}</strong>
      <span>{modelId ? benchmarkModelLabel(modelId) : "n/a"}</span>
      <p>{summary}</p>
    </article>
  );
}

export function BenchmarkModelCatalogList({
  title,
  models,
  formatCount
}: {
  title: string;
  models: BenchmarkModelRoleDescriptor[];
  formatCount: (value: number | null, digits?: number) => string;
}) {
  return (
    <div className="compact-list">
      <article className="compact-row">
        <strong>{title}</strong>
        <span>{formatCount(models.length)} models</span>
      </article>
      {models.map((entry) => (
        <article key={`${title}-${entry.id}`} className="compact-row">
          <strong>{entry.label}</strong>
          <span>{entry.id}</span>
          <p>{benchmarkRoleLabel(entry.role)}</p>
        </article>
      ))}
    </div>
  );
}

export function ModeSwitch<T extends string>({
  label,
  items,
  activeId,
  onChange
}: {
  label: string;
  items: Array<{ id: T; label: string; detail: string }>;
  activeId: T;
  onChange: (id: T) => void;
}) {
  return (
    <nav className="mode-switch" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={item.id === activeId ? "mode-switch-button is-active" : "mode-switch-button"}
          onClick={() => onChange(item.id)}
        >
          <strong>{item.label}</strong>
          <span>{item.detail}</span>
        </button>
      ))}
    </nav>
  );
}

export function RouteLaunchCard({
  eyebrow,
  title,
  detail,
  actionLabel,
  onAction
}: {
  eyebrow: string;
  title: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <article className="route-launch-card">
      <p className="eyebrow">{eyebrow}</p>
      <strong>{title}</strong>
      <p>{detail}</p>
      <button type="button" className="secondary-button" onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
}

export function SignalCard({ label, status, note }: { label: string; status: string; note: string }) {
  return (
    <article className={`signal-card signal-${status}`}>
      <div className="signal-card-head">
        <strong>{label}</strong>
        <StatusBadge value={status} />
      </div>
      <p>{note}</p>
    </article>
  );
}

export function HeaderBar({
  overview,
  route,
  onRouteChange,
  theme,
  onThemeToggle,
  language,
  onLanguageChange,
  copy
}: {
  overview: ProjectOverview;
  route: Route;
  onRouteChange: (route: Route) => void;
  theme: Theme;
  onThemeToggle: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
  copy: UiCopy;
}) {
  const labels: Record<Route, string> = {
    landing: copy.routeLanding,
    overview: copy.routeOverview,
    workspace: copy.routeWorkspace,
    usage: copy.routeUsage,
    benchmarks: copy.routeBenchmarks
  };
  const routeDetail: Record<Route, string> = {
    landing: "Entry surface and scientific orientation",
    overview: "Theory, representations, families, and validation",
    workspace: "Evidence, corpus, topics, and routed inference",
    usage: "Local setup, pipeline flow, and repo map",
    benchmarks: "Stability, labeled, measured, and contract surfaces"
  };
  const orcidLink = overview.citations.find((citation) => citation.id.includes("orcid"));

  return (
    <header className="app-header">
      <div className="app-header-band app-header-core">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div>
            <p className="eyebrow">CAOS LDA HSI</p>
            <h1>{overview.title}</h1>
            <p className="brand-summary">{pickText(overview.tagline, language)}</p>
          </div>
        </div>

        <div className="app-header-context">
          <p className="eyebrow">Research control surface</p>
          <strong>{labels[route]}</strong>
          <span>{routeDetail[route]}</span>
        </div>

        <div className="app-header-actions">
          <div className="toolbar-group">
            <button type="button" className={language === "es" ? "toolbar-button is-active" : "toolbar-button"} onClick={() => onLanguageChange("es")}>
              ES
            </button>
            <button type="button" className={language === "en" ? "toolbar-button is-active" : "toolbar-button"} onClick={() => onLanguageChange("en")}>
              EN
            </button>
          </div>
          <button type="button" className="toolbar-button" onClick={onThemeToggle}>
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <div className="rail-links">
            <ExternalLink href={overview.repo.url}>repo</ExternalLink>
            {orcidLink ? <ExternalLink href={orcidLink.url}>orcid</ExternalLink> : null}
          </div>
        </div>
      </div>

      <div className="app-header-band app-header-nav">
        <nav className="route-rail" aria-label="Primary">
          {ROUTES.map((entry) => (
            <button
              key={entry}
              type="button"
              className={route === entry ? "route-rail-button is-active" : "route-rail-button"}
              onClick={() => onRouteChange(entry)}
            >
              <strong>{labels[entry]}</strong>
              <span>{routeDetail[entry]}</span>
            </button>
          ))}
        </nav>

        <div className="rail-stats">
          {overview.hero_stats.slice(0, 3).map((stat) => (
            <StatTile key={stat.label.en} label={pickText(stat.label, language)} value={stat.value} detail={pickText(stat.detail, language)} />
          ))}
        </div>
      </div>
    </header>
  );
}

export function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export function ImageCard({ title, src }: { title: string; src: string }) {
  return (
    <figure className="image-card">
      <img src={src} alt={title} loading="lazy" />
      <figcaption>{title}</figcaption>
    </figure>
  );
}

export function CodeBlock({ lines }: { lines: string[] }) {
  return (
    <pre className="code-block">
      <code>{lines.join("\n")}</code>
    </pre>
  );
}

export function FolderCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="dataset-card">
      <div className="dataset-card-head">
        <strong>{title}</strong>
      </div>
      <p>{body}</p>
    </article>
  );
}

export function ClaimRow({ claim, language, tone }: { claim: InteractiveSubsetClaim; language: Language; tone: "supported" | "blocked" }) {
  return (
    <article className={`claim-row claim-${tone}`}>
      <strong>{pickText(claim.title, language)}</strong>
      <p>{pickText(claim.detail, language)}</p>
    </article>
  );
}

export function ArtifactRow({ artifact, language }: { artifact: InteractiveSubsetArtifact; language: Language }) {
  return (
    <article className="artifact-row">
      <strong>{pickText(artifact.title, language)}</strong>
      <span>{artifact.path}</span>
      <p>{pickText(artifact.purpose, language)}</p>
    </article>
  );
}
