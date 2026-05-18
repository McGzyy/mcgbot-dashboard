/** Partner + ops UI — must not use McGBot Terminal sidebar / MainShell chrome. */
export function isAffiliatePortalPath(pathname: string): boolean {
  return pathname === "/affiliate" || pathname.startsWith("/affiliate/");
}
