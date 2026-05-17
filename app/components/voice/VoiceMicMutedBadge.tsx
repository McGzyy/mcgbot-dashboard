/** Small mic-off indicator for voice participant chips. */
export function VoiceMicMutedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center text-amber-300/95 ${className}`.trim()}
      title="Muted"
      aria-label="Muted"
    >
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 19v4M8 23h8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2 2l20 20" strokeLinecap="round" />
      </svg>
    </span>
  );
}
