import { useEffect, useState } from "react";

import { InteractiveLinePlot, RankedBars } from "../components/ScientificPlots";
import { TOPIC_COLORS } from "./constants";
import type { TopicViewItem } from "./types";
import { toTopicWords } from "./utils";
import { SurfaceCard } from "./ui";

export function TopicExplorer({
  items,
  xValues,
  title
}: {
  items: TopicViewItem[];
  xValues: number[];
  title: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(items[0]?.id ?? null);
  const selected = items.find((item) => item.id === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    setSelectedId(items[0]?.id ?? null);
  }, [items]);

  if (!selected) {
    return null;
  }

  return (
    <div className="topic-layout">
      <div className="topic-selector">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={selected.id === item.id ? "topic-choice is-active" : "topic-choice"}
            onClick={() => setSelectedId(item.id)}
          >
            <i style={{ background: TOPIC_COLORS[index % TOPIC_COLORS.length] }} />
            <strong>{item.label}</strong>
            <span>{item.note}</span>
          </button>
        ))}
      </div>
      <div className="topic-detail">
        <SurfaceCard eyebrow={title} title={selected.label} subtitle={selected.note}>
          <RankedBars items={toTopicWords(selected.words)} formatter={(value) => value.toFixed(4)} />
          {selected.profile && xValues.length === selected.profile.length ? (
            <div className="topic-plot-pad">
              <InteractiveLinePlot
                xValues={xValues}
                series={[
                  {
                    id: selected.id,
                    label: selected.label,
                    values: selected.profile,
                    color: "#ff982b"
                  }
                ]}
                xLabel="wavelength (nm)"
                yLabel="topic profile"
              />
            </div>
          ) : null}
        </SurfaceCard>
      </div>
    </div>
  );
}
