import { pickText } from "../../lib/api";
import { CorpusDiagram, EquationStrip, HeroGraphic, HierarchyDiagram } from "../diagrams";
import type { Bundle, Language, Route, UiCopy } from "../types";
import { formatNumber } from "../utils";
import { ExternalLink, RouteLaunchCard, StatTile, SurfaceCard } from "../ui";

export function LandingPage({
  bundle,
  language,
  copy,
  onRouteChange
}: {
  bundle: Bundle;
  language: Language;
  copy: UiCopy;
  onRouteChange: (route: Route) => void;
}) {
  const { overview, data_families, datasets } = bundle.appData;
  const externalLinks = overview.citations.slice(0, 6);
  const launchRoutes = [
    {
      eyebrow: "01",
      title: copy.routeOverview,
      detail: "Theory, corpus definitions, family taxonomy, and validation gates.",
      actionLabel: copy.openOverview,
      route: "overview" as Route
    },
    {
      eyebrow: "02",
      title: copy.routeWorkspace,
      detail: "Enter by family and subset, then inspect evidence, methods, topics, and inference separately.",
      actionLabel: copy.routeWorkspace,
      route: "workspace" as Route
    },
    {
      eyebrow: "03",
      title: copy.routeBenchmarks,
      detail: "Review stability, measured-target runs, and what the compact web contract can legitimately claim.",
      actionLabel: copy.routeBenchmarks,
      route: "benchmarks" as Route
    }
  ];

  return (
    <div className="page-stack">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="eyebrow">spectral populations as corpora</p>
          <h2>{pickText(overview.hypothesis, language)}</h2>
          <p>{copy.landingIntro}</p>
          <div className="hero-actions">
            <button type="button" className="primary-button" onClick={() => onRouteChange("workspace")}>
              {copy.routeWorkspace}
            </button>
            <button type="button" className="secondary-button" onClick={() => onRouteChange("overview")}>
              {copy.openOverview}
            </button>
            <ExternalLink href={overview.repo.url}>{copy.openRepo}</ExternalLink>
          </div>
        </div>
        <div className="landing-hero-graphic">
          <HeroGraphic />
        </div>
      </section>

      <div className="landing-command-grid">
        <SurfaceCard eyebrow="entry routes" title="navigate by task, not by scroll" subtitle="Each route opens a dedicated analytical surface.">
          <div className="route-launch-grid">
            {launchRoutes.map((entry) => (
              <RouteLaunchCard
                key={entry.route}
                eyebrow={entry.eyebrow}
                title={entry.title}
                detail={entry.detail}
                actionLabel={entry.actionLabel}
                onAction={() => onRouteChange(entry.route)}
              />
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard eyebrow="scientific contract" title={copy.evidenceContract} subtitle={pickText(bundle.localValidation.thesis, language)}>
          <EquationStrip />
        </SurfaceCard>
      </div>

      <div className="two-column-grid">
        <SurfaceCard eyebrow="coverage" title={copy.summary} subtitle={pickText(overview.tagline, language)}>
          <div className="stat-grid">
            {overview.hero_stats.map((stat) => (
              <StatTile key={stat.label.en} label={pickText(stat.label, language)} value={stat.value} detail={pickText(stat.detail, language)} />
            ))}
            <StatTile label={copy.allDatasets} value={formatNumber(datasets.datasets.length)} detail={`${formatNumber(data_families.families.length)} families`} />
          </div>
          <div className="principle-list">
            {overview.principles.slice(0, 3).map((principle) => (
              <article key={principle.id} className="principle-card">
                <span>{principle.emphasis}</span>
                <strong>{pickText(principle.title, language)}</strong>
                <p>{pickText(principle.body, language)}</p>
              </article>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard eyebrow="reference anchors" title={copy.paperLinks} subtitle="ORCID, papers, dataset hubs, and primary context">
          <div className="link-grid">
            {externalLinks.map((citation) => (
              <a key={citation.id} className="reference-card" href={citation.url} target="_blank" rel="noreferrer">
                <strong>{citation.title}</strong>
                <span>{citation.source}</span>
                <p>{pickText(citation.note, language)}</p>
              </a>
            ))}
          </div>
        </SurfaceCard>
      </div>

      <div className="two-column-grid">
        <SurfaceCard eyebrow="spectral corpus" title="from support to document">
          <CorpusDiagram />
        </SurfaceCard>
        <SurfaceCard eyebrow="hierarchy" title="sample-aware support hierarchy">
          <HierarchyDiagram />
        </SurfaceCard>
      </div>
    </div>
  );
}
