import type {
  AppPayload,
  CorpusPreview,
  CorpusRecipe,
  DatasetEntry,
  FieldSceneSnapshot,
  InteractiveSubset,
  LibraryClusterDiagnostic,
  RealSceneSnapshot,
  SceneClusterDiagnostic,
  SegmentationSceneBaseline
} from "../types";

export function getDatasetMap(datasets: DatasetEntry[]): Map<string, DatasetEntry> {
  return new Map(datasets.map((entry) => [entry.id, entry]));
}

export function findSubsetDataset(datasetMap: Map<string, DatasetEntry>, subset: InteractiveSubset): DatasetEntry | null {
  return datasetMap.get(subset.primary_dataset_id) ?? datasetMap.get(subset.dataset_ids[0] ?? "") ?? null;
}

export function findRealScene(appData: AppPayload, subset: InteractiveSubset): RealSceneSnapshot | null {
  return appData.real_scenes.scenes.find((scene) => subset.dataset_ids.includes(scene.id)) ?? null;
}

export function findFieldScene(appData: AppPayload, subset: InteractiveSubset): FieldSceneSnapshot | null {
  return appData.field_samples.scenes.find((scene) => subset.dataset_ids.includes(scene.id)) ?? null;
}

export function findSceneDiagnostic(appData: AppPayload, subset: InteractiveSubset): SceneClusterDiagnostic | null {
  return appData.analysis.scene_diagnostics.find((entry) => subset.dataset_ids.includes(entry.scene_id)) ?? null;
}

export function findLibraryDiagnostic(appData: AppPayload, datasetId: string): LibraryClusterDiagnostic | null {
  return appData.analysis.library_diagnostics.find((entry) => entry.library_id === datasetId) ?? null;
}

export function findSegmentation(appData: AppPayload, subset: InteractiveSubset): SegmentationSceneBaseline | null {
  return appData.segmentation_baselines.scenes.find((entry) => subset.dataset_ids.includes(entry.dataset_id)) ?? null;
}

export function findRecipes(appData: AppPayload, subset: InteractiveSubset): CorpusRecipe[] {
  return appData.corpus_recipes.recipes.filter((recipe) => subset.recipe_ids.includes(recipe.id));
}

export function findCorpusPreviews(appData: AppPayload, subset: InteractiveSubset): CorpusPreview[] {
  return appData.corpus_previews.previews.filter(
    (preview) => subset.dataset_ids.includes(preview.dataset_id) && subset.recipe_ids.includes(preview.recipe_id)
  );
}
