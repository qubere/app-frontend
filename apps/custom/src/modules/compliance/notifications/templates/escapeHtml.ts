const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes every dynamic value inserted into an email HTML template -- used unconditionally, never skipped for "trusted" values (a party name is untrusted input). */
export function escapeHtml(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}
