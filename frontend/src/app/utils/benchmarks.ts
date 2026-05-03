import {
  FALLBACK_CLASSIFICATION_MODEL_ROLES,
  FALLBACK_PTM_SUPERVISION_PRINCIPLE,
  FALLBACK_REGRESSION_MODEL_ROLES
} from "../constants";
import type {
  ClassificationTaskOutcome,
  GenericRecord,
  HidsagPolicySummary,
  HidsagSubsetSummary,
  LibraryClusterDiagnostic,
  LocalCoreBenchmarksPayload,
  LabeledRunSummary,
  MeasuredRoleMetadataState,
  MeasuredRunSummary,
  MeasuredTargetModelCatalog,
  RegressionTaskOutcome,
  SpectralLibraryBandGroupSummary,
  StabilitySummary,
  TopicWord
} from "../types";
import {
  asArray,
  asNumber,
  asString,
  formatMetric,
  listStringEntries,
  meanFromStats,
  uniqueStrings,
  isRecord
} from "./core";
import { getTopicViewItemsFromTokenEntries } from "./topics";

export function benchmarkModelLabel(modelId: string): string {
  const labels: Record<string, string> = {
    raw_logistic_regression: "raw logistic",
    pca_logistic_regression: "PCA logistic",
    topic_logistic_regression: "flat theta logistic",
    cube_topic_logistic_regression: "cube-topic logistic",
    region_topic_logistic_regression: "region-topic logistic",
    raw_ridge_regression: "raw ridge",
    pls_regression: "PLS regression",
    topic_mixture_linear_regression: "flat theta linear",
    cube_topic_mixture_linear_regression: "cube-topic linear",
    region_topic_mixture_linear_regression: "region-topic linear",
    topic_routed_linear_regression: "topic-routed linear"
  };
  return labels[modelId] ?? modelId.replace(/_/g, " ");
}

export function benchmarkRoleLabel(role: string | null): string {
  switch (role) {
    case "raw-spectral-baseline":
      return "raw baseline";
    case "reduced-feature-baseline":
      return "reduced baseline";
    case "latent-linear-baseline":
      return "latent linear baseline";
    case "flat-topic-control-baseline":
      return "flat topic control";
    case "aggregated-topic-control-baseline":
      return "cube-topic control";
    case "regional-topic-control-baseline":
      return "region-topic control";
    case "topic-routed-primary-ptm-model":
      return "routed PTM primary";
    default:
      return "unclassified";
  }
}

function buildRoleMap(source: GenericRecord, fallback: Record<string, string>, modelIds: string[]): Map<string, string> {
  const ids = uniqueStrings([...modelIds, ...Object.keys(fallback)]);
  return new Map(ids.map((id) => [id, asString(source[id]) ?? fallback[id] ?? "unclassified-model"]));
}

export function getMeasuredTargetModelCatalog(localCore: LocalCoreBenchmarksPayload): MeasuredTargetModelCatalog {
  const methods = isRecord(localCore.methods) ? localCore.methods : {};
  const measured = isRecord(methods.measured_target_models) ? methods.measured_target_models : {};
  const classificationRoleSource = isRecord(measured.classification_roles) ? measured.classification_roles : {};
  const regressionRoleSource = isRecord(measured.regression_roles) ? measured.regression_roles : {};
  const metadataState: MeasuredRoleMetadataState =
    Object.keys(classificationRoleSource).length > 0 || Object.keys(regressionRoleSource).length > 0
      ? "payload-metadata"
      : "fallback-inference";
  const classificationIds = listStringEntries(measured.classification);
  const regressionIds = listStringEntries(measured.regression);
  const classificationRoleMap = buildRoleMap(classificationRoleSource, FALLBACK_CLASSIFICATION_MODEL_ROLES, classificationIds);
  const regressionRoleMap = buildRoleMap(regressionRoleSource, FALLBACK_REGRESSION_MODEL_ROLES, regressionIds);
  const principle = asString(methods.ptm_supervision_principle) ?? FALLBACK_PTM_SUPERVISION_PRINCIPLE;

  return {
    principle,
    metadataState,
    classificationRoleMap,
    regressionRoleMap,
    classification: Array.from(classificationRoleMap.entries()).map(([id, role]) => ({
      id,
      role,
      label: benchmarkModelLabel(id)
    })),
    regression: Array.from(regressionRoleMap.entries()).map(([id, role]) => ({
      id,
      role,
      label: benchmarkModelLabel(id)
    }))
  };
}

function pickBestClassificationModel(task: GenericRecord): { modelId: string | null; balancedAccuracy: number | null; macroF1: number | null } {
  const bestModel = isRecord(task.best_model) ? task.best_model : {};
  const explicitModelId = asString(bestModel.model_id);
  if (explicitModelId) {
    return {
      modelId: explicitModelId,
      balancedAccuracy: asNumber(bestModel.balanced_accuracy) ?? asNumber(bestModel.accuracy),
      macroF1: asNumber(bestModel.macro_f1)
    };
  }

  const metrics = isRecord(task.metrics) ? task.metrics : {};
  let selectedModelId: string | null = null;
  let selectedBalancedAccuracy: number | null = null;
  let selectedMacroF1: number | null = null;

  for (const [modelId, value] of Object.entries(metrics)) {
    const metric = isRecord(value) ? value : {};
    const balancedAccuracy = asNumber(metric.balanced_accuracy) ?? asNumber(metric.accuracy);
    const macroF1 = asNumber(metric.macro_f1);
    if (
      selectedModelId === null ||
      (balancedAccuracy ?? -Infinity) > (selectedBalancedAccuracy ?? -Infinity) ||
      ((balancedAccuracy ?? -Infinity) === (selectedBalancedAccuracy ?? -Infinity) &&
        (macroF1 ?? -Infinity) > (selectedMacroF1 ?? -Infinity))
    ) {
      selectedModelId = modelId;
      selectedBalancedAccuracy = balancedAccuracy;
      selectedMacroF1 = macroF1;
    }
  }

  return {
    modelId: selectedModelId,
    balancedAccuracy: selectedBalancedAccuracy,
    macroF1: selectedMacroF1
  };
}

export function getBestClassificationOutcome(tasks: unknown[], roleMap: Map<string, string>): ClassificationTaskOutcome {
  let selected: ClassificationTaskOutcome = {
    taskLabel: null,
    modelId: null,
    role: null,
    balancedAccuracy: null
  };
  let selectedMacroF1: number | null = null;

  for (const entry of tasks) {
    const task = isRecord(entry) ? entry : {};
    const best = pickBestClassificationModel(task);
    if (!best.modelId) {
      continue;
    }
    if (
      selected.modelId === null ||
      (best.balancedAccuracy ?? -Infinity) > (selected.balancedAccuracy ?? -Infinity) ||
      ((best.balancedAccuracy ?? -Infinity) === (selected.balancedAccuracy ?? -Infinity) &&
        (best.macroF1 ?? -Infinity) > (selectedMacroF1 ?? -Infinity))
    ) {
      selected = {
        taskLabel: asString(task.label_definition) ?? asString(task.task_id),
        modelId: best.modelId,
        role: roleMap.get(best.modelId) ?? null,
        balancedAccuracy: best.balancedAccuracy
      };
      selectedMacroF1 = best.macroF1;
    }
  }

  return selected;
}

function pickBestRegressionModel(task: GenericRecord): { modelId: string | null; r2: number | null; rmse: number | null } {
  const bestModel = isRecord(task.best_model) ? task.best_model : {};
  const explicitModelId = asString(bestModel.model_id);
  if (explicitModelId) {
    return {
      modelId: explicitModelId,
      r2: asNumber(bestModel.r2),
      rmse: asNumber(bestModel.rmse)
    };
  }

  const metrics = isRecord(task.metrics) ? task.metrics : {};
  let selectedModelId: string | null = null;
  let selectedR2: number | null = null;
  let selectedRmse: number | null = null;

  for (const [modelId, value] of Object.entries(metrics)) {
    const metric = isRecord(value) ? value : {};
    const r2 = asNumber(metric.r2);
    const rmse = asNumber(metric.rmse);
    if (
      selectedModelId === null ||
      (r2 ?? -Infinity) > (selectedR2 ?? -Infinity) ||
      ((r2 ?? -Infinity) === (selectedR2 ?? -Infinity) && (rmse ?? Infinity) < (selectedRmse ?? Infinity))
    ) {
      selectedModelId = modelId;
      selectedR2 = r2;
      selectedRmse = rmse;
    }
  }

  return {
    modelId: selectedModelId,
    r2: selectedR2,
    rmse: selectedRmse
  };
}

export function getBestRegressionOutcome(tasks: unknown[], roleMap: Map<string, string>): RegressionTaskOutcome {
  let selected: RegressionTaskOutcome = {
    target: null,
    modelId: null,
    role: null,
    r2: null
  };
  let selectedRmse: number | null = null;

  for (const entry of tasks) {
    const task = isRecord(entry) ? entry : {};
    const best = pickBestRegressionModel(task);
    if (!best.modelId) {
      continue;
    }
    if (
      selected.modelId === null ||
      (best.r2 ?? -Infinity) > (selected.r2 ?? -Infinity) ||
      ((best.r2 ?? -Infinity) === (selected.r2 ?? -Infinity) && (best.rmse ?? Infinity) < (selectedRmse ?? Infinity))
    ) {
      selected = {
        target: asString(task.target),
        modelId: best.modelId,
        role: roleMap.get(best.modelId) ?? null,
        r2: best.r2
      };
      selectedRmse = best.rmse;
    }
  }

  return selected;
}

export function summarizeLabeledRuns(localCore: LocalCoreBenchmarksPayload): LabeledRunSummary[] {
  return localCore.labeled_scene_runs
    .map((run) => {
      const record = isRecord(run) ? run : {};
      const topicModel = isRecord(record.topic_model) ? record.topic_model : {};
      return {
        datasetId: asString(record.dataset_id) ?? "unknown",
        datasetName: asString(record.dataset_name) ?? "unknown dataset",
        classCount: asNumber(record.class_count),
        trainSize: asNumber(record.train_size),
        testSize: asNumber(record.test_size),
        topicCount: asNumber(topicModel.topic_count),
        trainPerplexity: asNumber(topicModel.train_perplexity),
        testPerplexity: asNumber(topicModel.test_perplexity)
      };
    })
    .sort((a, b) => a.datasetName.localeCompare(b.datasetName));
}

export function summarizeStabilityRuns(localCore: LocalCoreBenchmarksPayload): StabilitySummary[] {
  return localCore.topic_stability_runs
    .map((run) => {
      const record = isRecord(run) ? run : {};
      return {
        datasetId: asString(record.dataset_id) ?? "unknown",
        datasetName: asString(record.dataset_name) ?? "unknown dataset",
        topicCount: asNumber(record.topic_count),
        documentCount: asNumber(record.document_count),
        perplexityMean: asNumber(record.perplexity_mean),
        cosineMean: asNumber(record.matched_topic_cosine_mean),
        cosineMin: asNumber(record.matched_topic_cosine_min),
        jaccardMean: asNumber(record.matched_top_token_jaccard_mean)
      };
    })
    .sort((a, b) => (b.cosineMean ?? -Infinity) - (a.cosineMean ?? -Infinity));
}

export function summarizeMeasuredRuns(localCore: LocalCoreBenchmarksPayload): MeasuredRunSummary[] {
  const catalog = getMeasuredTargetModelCatalog(localCore);
  return localCore.measured_target_runs
    .map((run) => {
      const record = isRecord(run) ? run : {};
      const topicModel = isRecord(record.topic_model) ? record.topic_model : {};
      const hierarchical = isRecord(record.hierarchical_topic_model) ? record.hierarchical_topic_model : {};
      const regional = isRecord(record.regional_topic_model) ? record.regional_topic_model : {};
      const split = isRecord(record.group_split_definition) ? record.group_split_definition : {};
      const classificationTasks = asArray(record.classification_tasks);
      const regressionTasks = asArray(record.regression_tasks);
      const bestClassification = getBestClassificationOutcome(classificationTasks, catalog.classificationRoleMap);
      const bestRegression = getBestRegressionOutcome(regressionTasks, catalog.regressionRoleMap);
      return {
        subsetCode: asString(record.subset_code) ?? "unknown",
        datasetName: asString(record.dataset_name) ?? "unknown dataset",
        sampleCount: asNumber(record.sample_count),
        measurementCount: asNumber(record.measurement_count_total),
        cubeDocumentCount: asNumber(record.cube_document_count),
        regionDocumentCount: asNumber(record.region_document_count),
        numericVariableCount: asNumber(record.numeric_variable_count),
        categoricalVariableCount: asNumber(record.categorical_variable_count),
        topicCount: asNumber(topicModel.topic_count),
        topicPerplexity: asNumber(topicModel.perplexity),
        hierarchicalPerplexity: asNumber(hierarchical.perplexity),
        regionalPerplexity: asNumber(regional.perplexity),
        activeTopicCount: asNumber(topicModel.active_topic_count),
        classificationTaskCount: classificationTasks.length,
        regressionTaskCount: regressionTasks.length,
        groupSplitName: asString(split.group_name),
        groupSplitReason: asString(split.reason),
        topicActivityWarning: asString(topicModel.topic_activity_warning),
        bestClassificationTask: bestClassification.taskLabel,
        bestClassificationModelId: bestClassification.modelId,
        bestClassificationModelRole: bestClassification.role,
        bestClassificationBalancedAccuracy: bestClassification.balancedAccuracy,
        bestRegressionTarget: bestRegression.target,
        bestRegressionModelId: bestRegression.modelId,
        bestRegressionModelRole: bestRegression.role,
        bestRegressionR2: bestRegression.r2,
        ptmSupervisionPrinciple: catalog.principle,
        roleMetadataState: catalog.metadataState
      };
    })
    .sort((a, b) => a.subsetCode.localeCompare(b.subsetCode));
}

export function summarizeHidsagSubsets(
  bundle: {
    hidsagSubsetInventory: { subsets: unknown[] };
    hidsagRegionDocuments: { subsets: unknown[] };
    hidsagBandQuality: { subsets: unknown[] };
    hidsagPreprocessingSensitivity: { subsets: unknown[] };
  },
  measuredSummaries: MeasuredRunSummary[]
): HidsagSubsetSummary[] {
  const inventoryMap = new Map(
    bundle.hidsagSubsetInventory.subsets.map((entry) => (isRecord(entry) ? entry : {})).map((entry) => [asString(entry.subset_code) ?? "", entry] as const)
  );
  const regionMap = new Map(
    bundle.hidsagRegionDocuments.subsets.map((entry) => (isRecord(entry) ? entry : {})).map((entry) => [asString(entry.subset_code) ?? "", entry] as const)
  );
  const bandQualityMap = new Map(
    bundle.hidsagBandQuality.subsets.map((entry) => (isRecord(entry) ? entry : {})).map((entry) => [asString(entry.subset_code) ?? "", entry] as const)
  );
  const preprocessingMap = new Map(
    bundle.hidsagPreprocessingSensitivity.subsets.map((entry) => (isRecord(entry) ? entry : {})).map((entry) => [asString(entry.subset_code) ?? "", entry] as const)
  );
  const subsetCodes = Array.from(
    new Set([
      ...Array.from(inventoryMap.keys()),
      ...Array.from(regionMap.keys()),
      ...Array.from(bandQualityMap.keys()),
      ...Array.from(preprocessingMap.keys()),
      ...measuredSummaries.map((entry) => entry.subsetCode)
    ])
  )
    .filter((entry) => entry.length > 0)
    .sort((a, b) => a.localeCompare(b));

  return subsetCodes.map((subsetCode) => {
    const inventory = inventoryMap.get(subsetCode) ?? {};
    const region = regionMap.get(subsetCode) ?? {};
    const bandQuality = bandQualityMap.get(subsetCode) ?? {};
    const preprocessing = preprocessingMap.get(subsetCode) ?? {};
    const measured = measuredSummaries.find((entry) => entry.subsetCode === subsetCode) ?? null;
    const patchGrid = isRecord(region.patch_grid) ? region.patch_grid : {};
    const featureLayouts = asArray(region.feature_layout).map((entry) => {
      const record = isRecord(entry) ? entry : {};
      return {
        modality: asString(record.modality) ?? "unknown",
        bandCount: asNumber(record.band_count),
        source: asString(record.source)
      };
    });
    const modalityBandSummaries = asArray(bandQuality.modalities).map((entry) => {
      const record = isRecord(entry) ? entry : {};
      const heuristic = isRecord(record.heuristic_policy) ? record.heuristic_policy : {};
      return {
        modality: asString(record.modality) ?? "unknown",
        bandCount: asNumber(record.band_count),
        maskedFraction: asNumber(heuristic.masked_fraction),
        retainedFraction: asNumber(heuristic.retained_fraction),
        maskedBandCount: asNumber(heuristic.masked_band_count)
      };
    });
    const policyRuns = asArray(preprocessing.policy_runs).map((entry) => {
      const record = isRecord(entry) ? entry : {};
      const sampleTopicModel = isRecord(record.sample_topic_model) ? record.sample_topic_model : {};
      const cubeTopicModel = isRecord(record.cube_topic_model) ? record.cube_topic_model : {};
      const regionalTopicModel = isRecord(record.regional_topic_model) ? record.regional_topic_model : {};
      const classificationTask = isRecord(record.classification_task) ? record.classification_task : {};
      const regressionTask = isRecord(record.regression_task) ? record.regression_task : {};
      return {
        id: asString(record.policy_id) ?? "policy",
        label: asString(record.policy_name) ?? asString(record.policy_id) ?? "policy",
        detail: `${formatMetric(asNumber(sampleTopicModel.perplexity), 1)} sample ppl`,
        description: asString(record.description) ?? "No description",
        samplePerplexity: asNumber(sampleTopicModel.perplexity),
        cubePerplexity: asNumber(cubeTopicModel.perplexity),
        regionalPerplexity: asNumber(regionalTopicModel.perplexity),
        activeTopicCount: asNumber(sampleTopicModel.active_topic_count),
        bestBalancedAccuracy: asNumber(classificationTask.best_balanced_accuracy),
        bestRegressionR2: asNumber(regressionTask.best_r2),
        topTopics: getTopicViewItemsFromTokenEntries(
          asArray(sampleTopicModel.top_tokens),
          `${subsetCode.toLowerCase()}-${asString(record.policy_id) ?? "policy"}`,
          "Topic"
        )
      } satisfies HidsagPolicySummary;
    });
    const selectedReferenceTasks = isRecord(preprocessing.selected_reference_tasks) ? preprocessing.selected_reference_tasks : {};
    const selectedClassification = isRecord(selectedReferenceTasks.classification) ? selectedReferenceTasks.classification : {};
    const selectedClassificationMetric = isRecord(selectedClassification.reference_metric) ? selectedClassification.reference_metric : {};
    const selectedRegression = isRecord(selectedReferenceTasks.regression) ? selectedReferenceTasks.regression : {};
    const selectedRegressionMetric = isRecord(selectedRegression.reference_metric) ? selectedRegression.reference_metric : {};
    const groupSplit = isRecord(preprocessing.group_split_definition) ? preprocessing.group_split_definition : {};
    return {
      subsetCode,
      sampleCount: asNumber(inventory.sample_count) ?? measured?.sampleCount ?? asNumber(region.sample_count) ?? null,
      measurementCount: measured?.measurementCount ?? asNumber(region.measurement_count_total) ?? null,
      cropCount: asNumber(inventory.crop_count),
      cubeFileCount: asNumber(inventory.cube_file_count),
      numericVariableCount: asNumber(inventory.numeric_variable_count) ?? measured?.numericVariableCount ?? null,
      variableNames: asArray(inventory.numeric_variable_names).map((entry) => String(entry)),
      dominantVariables: asArray(inventory.dominant_variables_by_mean)
        .slice(0, 5)
        .map((entry) => {
          const record = isRecord(entry) ? entry : {};
          return asString(record.name);
        })
        .filter((entry): entry is string => entry !== null),
      regionDocumentCount: asNumber(region.region_document_count) ?? measured?.regionDocumentCount ?? null,
      docsPerMeasurementMean: meanFromStats(region.documents_per_measurement_stats),
      docsPerSampleMean: meanFromStats(region.documents_per_sample_stats),
      patchRows: asNumber(patchGrid.rows),
      patchCols: asNumber(patchGrid.cols),
      featureLayouts,
      modalityBandSummaries,
      topicPerplexity: measured?.topicPerplexity ?? null,
      cubePerplexity: measured?.hierarchicalPerplexity ?? null,
      regionalPerplexity: measured?.regionalPerplexity ?? null,
      activeTopicCount: measured?.activeTopicCount ?? null,
      bestClassificationTask: measured?.bestClassificationTask ?? asString(selectedClassification.task_id),
      bestClassificationModelId: measured?.bestClassificationModelId ?? null,
      bestClassificationModelRole: measured?.bestClassificationModelRole ?? null,
      bestBalancedAccuracy: measured?.bestClassificationBalancedAccuracy ?? asNumber(selectedClassificationMetric.balanced_accuracy),
      bestRegressionTarget: measured?.bestRegressionTarget ?? asString(selectedRegression.target),
      bestRegressionModelId: measured?.bestRegressionModelId ?? null,
      bestRegressionModelRole: measured?.bestRegressionModelRole ?? null,
      bestRegressionR2: measured?.bestRegressionR2 ?? asNumber(selectedRegressionMetric.r2),
      groupSplitName: measured?.groupSplitName ?? asString(groupSplit.group_name),
      groupSplitReason: measured?.groupSplitReason ?? asString(groupSplit.reason),
      ptmSupervisionPrinciple: measured?.ptmSupervisionPrinciple ?? FALLBACK_PTM_SUPERVISION_PRINCIPLE,
      roleMetadataState: measured?.roleMetadataState ?? "fallback-inference",
      policyRuns
    } satisfies HidsagSubsetSummary;
  });
}

export function summarizeSpectralLibrary(localCore: LocalCoreBenchmarksPayload, datasetId: string): SpectralLibraryBandGroupSummary | null {
  const match = localCore.spectral_library_runs.find((run) => isRecord(run) && asString(run.dataset_id) === datasetId);
  if (!isRecord(match)) {
    return null;
  }
  const groups = asArray(match.band_groups);
  const best = groups
    .map((group) => (isRecord(group) ? group : {}))
    .sort((a, b) => (asNumber(b.band_count) ?? -Infinity) - (asNumber(a.band_count) ?? -Infinity))[0];
  if (!isRecord(best)) {
    return null;
  }
  const clustering = isRecord(best.clustering) ? best.clustering : {};
  const topicKmeans = isRecord(clustering.topic_kmeans) ? clustering.topic_kmeans : {};
  const topTopics = asArray(best.top_band_tokens)
    .map((entry) => {
      const topic = isRecord(entry) ? entry : {};
      const topicId = asNumber(topic.topic_id) ?? 0;
      const tokens = asArray(topic.tokens)
        .map((tokenEntry) => {
          const tokenRecord = isRecord(tokenEntry) ? tokenEntry : {};
          const token = asString(tokenRecord.token);
          const weight = asNumber(tokenRecord.weight);
          return token && weight !== null ? { token, weight } : null;
        })
        .filter((token): token is TopicWord => token !== null);
      return {
        id: `library-topic-${topicId}`,
        label: `Topic ${topicId}`,
        note: `${tokens.length} tokens`,
        words: tokens,
        profile: null
      };
    })
    .filter((entry) => entry.words.length > 0);
  return {
    datasetId,
    datasetName: asString(match.dataset_name) ?? "Spectral library",
    bandCount: asNumber(best.band_count),
    sampleCount: asNumber(best.sample_count),
    groupCount: asNumber(best.group_count),
    topicCount: asNumber(best.topic_count),
    perplexity: asNumber(best.perplexity),
    ari: asNumber(topicKmeans.ari),
    nmi: asNumber(topicKmeans.nmi),
    topTopics
  };
}
