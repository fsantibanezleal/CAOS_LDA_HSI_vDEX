import { startTransition, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { api } from "./lib/api";
import { THEME_KEY, UI } from "./app/constants";
import { HeaderBar } from "./app/ui";
import { BenchmarksWorkbenchPage } from "./app/pages/BenchmarksPage";
import { LandingPage } from "./app/pages/LandingPage";
import { OperationsPage } from "./app/pages/OperationsPage";
import { OverviewPage } from "./app/pages/OverviewPage";
import { ScientificWorkspacePage } from "./app/pages/ScientificWorkspacePage";
import type { Bundle, Language, Route, Theme, WorkspaceView } from "./app/types";
import { findSubsetDataset, getDatasetMap, getRouteFromHash, setRouteHash, statusRank } from "./app/utils";

export function App() {
  const { i18n } = useTranslation();
  const language: Language = i18n.resolvedLanguage?.startsWith("en") ? "en" : "es";
  const copy = UI[language];

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [route, setRoute] = useState<Route>(() => getRouteFromHash());
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
  });
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("dataset");
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [selectedSubsetId, setSelectedSubsetId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const onHashChange = () => setRoute(getRouteFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getAppData(),
      api.getInteractiveSubsets(),
      api.getLocalValidationMatrix(),
      api.getLocalCoreBenchmarks(),
      api.getHidsagSubsetInventory(),
      api.getHidsagRegionDocuments(),
      api.getHidsagBandQuality(),
      api.getHidsagPreprocessingSensitivity()
    ])
      .then(([appData, interactiveSubsets, localValidation, localCore, hidsagSubsetInventory, hidsagRegionDocuments, hidsagBandQuality, hidsagPreprocessingSensitivity]) => {
        if (!active) {
          return;
        }
        setBundle({ appData, interactiveSubsets, localValidation, localCore, hidsagSubsetInventory, hidsagRegionDocuments, hidsagBandQuality, hidsagPreprocessingSensitivity });
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  const sortedSubsets = useMemo(
    () =>
      (bundle?.interactiveSubsets.subsets ?? [])
        .slice()
        .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.title.en.localeCompare(b.title.en)),
    [bundle]
  );

  useEffect(() => {
    if (!bundle || selectedFamilyId || sortedSubsets.length === 0) {
      return;
    }
    const firstReady = sortedSubsets.find((entry) => entry.status === "ready") ?? sortedSubsets[0];
    setSelectedFamilyId(firstReady.family_id);
    setSelectedSubsetId(firstReady.id);
  }, [bundle, selectedFamilyId, sortedSubsets]);

  const families = bundle?.appData.data_families.families ?? [];
  const activeFamily = families.find((entry) => entry.id === selectedFamilyId) ?? families[0] ?? null;
  const familySubsets = useMemo(() => sortedSubsets.filter((entry) => entry.family_id === activeFamily?.id), [activeFamily?.id, sortedSubsets]);
  const activeSubset = familySubsets.find((entry) => entry.id === selectedSubsetId) ?? familySubsets[0] ?? null;
  const datasetMap = useMemo(() => getDatasetMap(bundle?.appData.datasets.datasets ?? []), [bundle]);
  const activeDataset = activeSubset ? findSubsetDataset(datasetMap, activeSubset) : null;

  useEffect(() => {
    if (!activeFamily || familySubsets.length === 0) {
      return;
    }
    if (!activeSubset || activeSubset.family_id !== activeFamily.id) {
      setSelectedSubsetId(familySubsets[0]?.id ?? null);
    }
  }, [activeFamily, activeSubset, familySubsets]);

  useEffect(() => {
    if (!bundle) {
      return;
    }
    const title = bundle.appData.overview.title;
    const pageLabel =
      route === "landing"
        ? copy.routeLanding
        : route === "overview"
          ? copy.routeOverview
          : route === "workspace"
            ? activeSubset
              ? (language === "en" ? activeSubset.title.en : activeSubset.title.es)
              : copy.routeWorkspace
            : route === "usage"
              ? copy.routeUsage
              : copy.routeBenchmarks;
    document.title = `${title} | ${pageLabel}`;
  }, [activeSubset, bundle, copy.routeBenchmarks, copy.routeLanding, copy.routeOverview, copy.routeUsage, copy.routeWorkspace, language, route]);

  const changeRoute = (next: Route) => {
    startTransition(() => setRoute(next));
    setRouteHash(next);
  };

  const changeFamily = (familyId: string) => {
    startTransition(() => {
      setSelectedFamilyId(familyId);
      const firstSubset = sortedSubsets.find((entry) => entry.family_id === familyId);
      setSelectedSubsetId(firstSubset?.id ?? null);
      setWorkspaceView("dataset");
    });
  };

  const changeSubset = (subsetId: string) => {
    startTransition(() => {
      setSelectedSubsetId(subsetId);
      setWorkspaceView("dataset");
    });
  };

  if (error) {
    return (
      <main className="status-screen">
        <div className="status-card">
          <h1>Load error</h1>
          <p>{error}</p>
        </div>
      </main>
    );
  }

  if (!bundle || !activeFamily || !activeSubset) {
    return (
      <main className="status-screen">
        <div className="status-card">
          <h1>{copy.loading}</h1>
          <p>{copy.loadingHint}</p>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <HeaderBar
        overview={bundle.appData.overview}
        route={route}
        onRouteChange={changeRoute}
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        language={language}
        onLanguageChange={(next) => void i18n.changeLanguage(next)}
        copy={copy}
      />

      <main className="app-main">
        {route === "landing" ? <LandingPage bundle={bundle} language={language} copy={copy} onRouteChange={changeRoute} /> : null}
        {route === "overview" ? <OverviewPage bundle={bundle} language={language} copy={copy} /> : null}
        {route === "workspace" ? (
          <ScientificWorkspacePage
            bundle={bundle}
            family={activeFamily}
            subset={activeSubset}
            dataset={activeDataset}
            view={workspaceView}
            onViewChange={setWorkspaceView}
            onRouteChange={changeRoute}
            onFamilyChange={changeFamily}
            onSubsetChange={changeSubset}
            language={language}
            copy={copy}
          />
        ) : null}
        {route === "usage" ? <OperationsPage bundle={bundle} language={language} copy={copy} /> : null}
        {route === "benchmarks" ? <BenchmarksWorkbenchPage bundle={bundle} language={language} copy={copy} /> : null}
      </main>
    </div>
  );
}
