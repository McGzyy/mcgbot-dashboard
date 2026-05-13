"use client";

import { ModerationQueueFeed } from "@/app/components/ModerationQueueFeed";

type ModQueueHomePanelProps = {
  /** `preview` = dashboard widget. `full` = dedicated /moderation page. */
  mode?: "preview" | "full";
  /** Dashboard only: do not render the card until the queue has pending items (or an error to show). */
  hideWhenEmpty?: boolean;
};

export function ModQueueHomePanel({ mode = "preview", hideWhenEmpty }: ModQueueHomePanelProps) {
  return <ModerationQueueFeed mode={mode} hideWhenEmpty={hideWhenEmpty} />;
}
