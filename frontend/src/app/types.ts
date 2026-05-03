import type {
  AppPayload,
  CorpusPreview,
  CorpusRecipe,
  DataFamily,
  DatasetEntry,
  FieldSceneSnapshot,
  HidsagBandQualityPayload,
  HidsagPreprocessingSensitivityPayload,
  HidsagRegionDocumentsPayload,
  HidsagSubsetInventoryPayload,
  InteractiveSubset,
  InteractiveSubsetArtifact,
  InteractiveSubsetClaim,
  InteractiveSubsetsPayload,
  LibraryClusterDiagnostic,
  LocalCoreBenchmarksPayload,
  LocalValidationMatrixPayload,
  ProjectOverview,
  RealSceneSnapshot,
  RealSceneTopic,
  SceneClusterDiagnostic,
  SegmentationSceneBaseline,
  SpectralLibrarySample,
  TopicProfile,
  TopicWord
} from "../lib/api";

export type {
  AppPayload,
  CorpusPreview,
  CorpusRecipe,
  DataFamily,
  DatasetEntry,
  FieldSceneSnapshot,
  HidsagBandQualityPayload,
  HidsagPreprocessingSensitivityPayload,
  HidsagRegionDocumentsPayload,
  HidsagSubsetInventoryPayload,
  InteractiveSubset,
  InteractiveSubsetArtifact,
  InteractiveSubsetClaim,
  InteractiveSubsetsPayload,
  LibraryClusterDiagnostic,
  LocalCoreBenchmarksPayload,
  LocalValidationMatrixPayload,
  ProjectOverview,
  RealSceneSnapshot,
  RealSceneTopic,
  SceneClusterDiagnostic,
  SegmentationSceneBaseline,
  SpectralLibrarySample,
  TopicProfile,
  TopicWord
};

export type Language = "es" | "en";
export type Route = "landing" | "overview" | "workspace" | "usage" | "benchmarks";
export type WorkspaceView = "dataset" | "method" | "topics" | "inference";
export type OverviewMode = "thesis" | "representations" | "families" | "catalog" | "validation";
export type BenchmarksMode = "stability" | "labeled" | "measured" | "contract";
export type UsageMode = "bootstrap" | "pipeline" | "repo";
export type Theme = "dark" | "light";
export type GenericRecord = Record<string, unknown>;

export interface Bundle {
  appData: AppPayload;
  interactiveSubsets: InteractiveSubsetsPayload;
  localValidation: LocalValidationMatrixPayload;
  localCore: LocalCoreBenchmarksPayload;
  hidsagSubsetInventory: HidsagSubsetInventoryPayload;
  hidsagRegionDocuments: HidsagRegionDocumentsPayload;
  hidsagBandQuality: HidsagBandQualityPayload;
  hidsagPreprocessingSensitivity: HidsagPreprocessingSensitivityPayload;
}

export interface UiCopy {
  allDatasets: string;
  benchmarksTitle: string;
  codeOffline: string;
  datasetSearch: string;
  datasetView: string;
  empty: string;
  emptyWorkspace: string;
  evidenceContract: string;
  evidenceView: string;
  flowTitle: string;
  inferenceView: string;
  landingIntro: string;
  loading: string;
  loadingHint: string;
  measuredFamily: string;
  methodsTitle: string;
  methodView: string;
  noInference: string;
  openOverview: string;
  openRepo: string;
  overviewIntro: string;
  paperLinks: string;
  routeBenchmarks: string;
  routeLanding: string;
  routeOverview: string;
  routeUsage: string;
  routeWorkspace: string;
  setupCommands: string;
  subsetRegistry: string;
  summary: string;
  topicsTitle: string;
  topicsView: string;
  usageIntro: string;
  validationTitle: string;
  workspaceIntro: string;
}

export interface TopicViewItem {
  id: string;
  label: string;
  note: string;
  words: TopicWord[];
  profile: number[] | null;
}

export interface LabeledRunSummary {
  datasetId: string;
  datasetName: string;
  classCount: number | null;
  trainSize: number | null;
  testSize: number | null;
  topicCount: number | null;
  trainPerplexity: number | null;
  testPerplexity: number | null;
}

export interface StabilitySummary {
  datasetId: string;
  datasetName: string;
  topicCount: number | null;
  documentCount: number | null;
  perplexityMean: number | null;
  cosineMean: number | null;
  cosineMin: number | null;
  jaccardMean: number | null;
}

export type MeasuredRoleMetadataState = "payload-metadata" | "fallback-inference";

export interface MeasuredRunSummary {
  subsetCode: string;
  datasetName: string;
  sampleCount: number | null;
  measurementCount: number | null;
  cubeDocumentCount: number | null;
  regionDocumentCount: number | null;
  numericVariableCount: number | null;
  categoricalVariableCount: number | null;
  topicCount: number | null;
  topicPerplexity: number | null;
  hierarchicalPerplexity: number | null;
  regionalPerplexity: number | null;
  activeTopicCount: number | null;
  classificationTaskCount: number;
  regressionTaskCount: number;
  groupSplitName: string | null;
  groupSplitReason: string | null;
  topicActivityWarning: string | null;
  bestClassificationTask: string | null;
  bestClassificationModelId: string | null;
  bestClassificationModelRole: string | null;
  bestClassificationBalancedAccuracy: number | null;
  bestRegressionTarget: string | null;
  bestRegressionModelId: string | null;
  bestRegressionModelRole: string | null;
  bestRegressionR2: number | null;
  ptmSupervisionPrinciple: string;
  roleMetadataState: MeasuredRoleMetadataState;
}

export interface SpectralLibraryBandGroupSummary {
  datasetId: string;
  datasetName: string;
  bandCount: number | null;
  sampleCount: number | null;
  groupCount: number | null;
  topicCount: number | null;
  perplexity: number | null;
  ari: number | null;
  nmi: number | null;
  topTopics: TopicViewItem[];
}

export interface HidsagPolicySummary {
  id: string;
  label: string;
  detail: string;
  description: string;
  samplePerplexity: number | null;
  cubePerplexity: number | null;
  regionalPerplexity: number | null;
  activeTopicCount: number | null;
  bestBalancedAccuracy: number | null;
  bestRegressionR2: number | null;
  topTopics: TopicViewItem[];
}

export interface HidsagSubsetSummary {
  subsetCode: string;
  sampleCount: number | null;
  measurementCount: number | null;
  cropCount: number | null;
  cubeFileCount: number | null;
  numericVariableCount: number | null;
  variableNames: string[];
  dominantVariables: string[];
  regionDocumentCount: number | null;
  docsPerMeasurementMean: number | null;
  docsPerSampleMean: number | null;
  patchRows: number | null;
  patchCols: number | null;
  featureLayouts: Array<{ modality: string; bandCount: number | null; source: string | null }>;
  modalityBandSummaries: Array<{
    modality: string;
    bandCount: number | null;
    maskedFraction: number | null;
    retainedFraction: number | null;
    maskedBandCount: number | null;
  }>;
  topicPerplexity: number | null;
  cubePerplexity: number | null;
  regionalPerplexity: number | null;
  activeTopicCount: number | null;
  bestClassificationTask: string | null;
  bestClassificationModelId: string | null;
  bestClassificationModelRole: string | null;
  bestBalancedAccuracy: number | null;
  bestRegressionTarget: string | null;
  bestRegressionModelId: string | null;
  bestRegressionModelRole: string | null;
  bestRegressionR2: number | null;
  groupSplitName: string | null;
  groupSplitReason: string | null;
  ptmSupervisionPrinciple: string;
  roleMetadataState: MeasuredRoleMetadataState;
  policyRuns: HidsagPolicySummary[];
}

export interface BenchmarkModelRoleDescriptor {
  id: string;
  role: string;
  label: string;
}

export interface MeasuredTargetModelCatalog {
  principle: string;
  metadataState: MeasuredRoleMetadataState;
  classification: BenchmarkModelRoleDescriptor[];
  regression: BenchmarkModelRoleDescriptor[];
  classificationRoleMap: Map<string, string>;
  regressionRoleMap: Map<string, string>;
}

export interface ClassificationTaskOutcome {
  taskLabel: string | null;
  modelId: string | null;
  role: string | null;
  balancedAccuracy: number | null;
}

export interface RegressionTaskOutcome {
  target: string | null;
  modelId: string | null;
  role: string | null;
  r2: number | null;
}
