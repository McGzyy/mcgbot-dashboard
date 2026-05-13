/** X / Instagram handle in a text field: empty, or `@` + handle (no spaces, single leading @). */
export function normalizeSocialSourceHandleInput(raw: string): string {
  const collapsed = raw.replace(/\s+/g, "");
  if (collapsed === "") return "";
  const rest = collapsed.replace(/^@+/, "");
  if (rest === "") return "@";
  return `@${rest}`;
}

/** True when there is at least one character after the optional leading `@`. */
export function socialSourceHandleHasName(handle: string): boolean {
  return Boolean(handle.replace(/^@+/, "").trim());
}
