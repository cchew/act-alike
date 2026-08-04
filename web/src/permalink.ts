// src/permalink.ts
const TERM_PATH_RE = /^\/term\/(.+)$/;

export function termToPath(term: string): string {
  return `/term/${encodeURIComponent(term)}`;
}

export function termFromPath(pathname: string): string | null {
  const match = pathname.match(TERM_PATH_RE);
  return match ? decodeURIComponent(match[1]!) : null;
}
