import { pickText } from "../../lib/api";
import { SERIES_COLORS } from "../constants";
import type {
  FieldSceneSnapshot,
  GenericRecord,
  Language,
  LibraryClusterDiagnostic,
  RealSceneSnapshot,
  RealSceneTopic,
  SceneClusterDiagnostic,
  SpectralLibrarySample,
  TopicProfile,
  TopicViewItem,
  TopicWord
} from "../types";
import { asArray, asNumber, asString, formatNumber, isRecord } from "./core";

export function getTopicViewItemsFromTokenEntries(entries: unknown[], prefix: string, labelPrefix: string): TopicViewItem[] {
  return entries
    .map((entry) => {
      const record = isRecord(entry) ? entry : {};
      const topicId = asNumber(record.topic_id) ?? 0;
      const words = asArray(record.tokens)
        .map((tokenEntry) => {
          const tokenRecord = isRecord(tokenEntry) ? tokenEntry : {};
          const token = asString(tokenRecord.token);
          const weight = asNumber(tokenRecord.weight);
          return token && weight !== null ? { token, weight } : null;
        })
        .filter((token): token is TopicWord => token !== null);
      return {
        id: `${prefix}-${topicId}`,
        label: `${labelPrefix} ${topicId}`,
        note: `${words.length} tokens`,
        words,
        profile: null
      };
    })
    .filter((item) => item.words.length > 0);
}

export function toTopicWords(words: TopicWord[]) {
  return words.map((word) => ({
    id: word.token,
    label: word.token,
    value: word.weight,
    color: "linear-gradient(90deg, #ff982b, #47b4ff)"
  }));
}

export function buildRealSeries(scene: RealSceneSnapshot) {
  return scene.class_summaries
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((summary, index) => ({
      id: `${scene.id}-class-${summary.label_id}`,
      label: `${summary.name} (${formatNumber(summary.count)})`,
      values: summary.mean_spectrum,
      color: SERIES_COLORS[index % SERIES_COLORS.length]
    }));
}

export function buildFieldSeries(scene: FieldSceneSnapshot) {
  return scene.strata_summaries
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((summary, index) => ({
      id: `${scene.id}-strata-${summary.label_id}`,
      label: `${summary.name} (${formatNumber(summary.count)})`,
      values: summary.mean_spectrum,
      color: SERIES_COLORS[index % SERIES_COLORS.length]
    }));
}

export function buildLibrarySeries(samples: SpectralLibrarySample[]) {
  return samples.slice(0, 6).map((sample, index) => ({
    id: sample.id,
    label: sample.name,
    values: sample.spectrum,
    color: SERIES_COLORS[index % SERIES_COLORS.length]
  }));
}

export function buildScatterPoints(points: SceneClusterDiagnostic["points"] | LibraryClusterDiagnostic["points"]) {
  return points.slice(0, 240).map((point) => ({
    id: point.id,
    label: point.label,
    group: point.group,
    x: point.x,
    y: point.y,
    size: point.size,
    cluster: point.cluster
  }));
}

export function toTopicViewItems(topics: TopicProfile[] | RealSceneTopic[], language: Language): TopicViewItem[] {
  return topics.map((topic, index) => ({
    id: topic.id,
    label: typeof topic.name === "string" ? topic.name : pickText(topic.name, language),
    note: "summary" in topic ? pickText(topic.summary, language) : `Topic ${index + 1}`,
    words: topic.top_words,
    profile: topic.band_profile
  }));
}

export function getMeasuredTopicViewItems(run: GenericRecord): TopicViewItem[] {
  const topicModel = isRecord(run.topic_model) ? run.topic_model : {};
  return getTopicViewItemsFromTokenEntries(asArray(topicModel.top_tokens), "measured-topic", "Sample topic");
}
