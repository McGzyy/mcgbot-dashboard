"use client";

import { ModerationQueueFeed } from "@/app/components/ModerationQueueFeed";

type ModQueueHomePanelProps = {
  /** `preview` = dashboard widget. `full` = dedicated /moderation page. */
  mode?: "preview" | "full";
};

export function ModQueueHomePanel({ mode = "preview" }: ModQueueHomePanelProps) {
  return (
    <section>
      <ModerationQueueFeed mode={mode} />
    </section>
  );
}
