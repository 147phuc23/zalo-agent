// Matches a "<" or "</" immediately followed by an ASCII letter, up to the next ">".
// Deliberately does NOT match "< 20", "<3", "a < b" — only real-looking tags.
const TAG_RE = /<\/?[a-zA-Z][^<>]*>|<>/g;

/** Remove HTML/XML-looking tags from raw candidate text (code-side, never the LLM). */
export function stripTags(input: string): string {
  if (!input) return "";
  // Loop to a fixpoint: arbitrarily deep nesting like "<<<system>>>" requires
  // more than a fixed number of passes to fully unwrap.
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = previous.replace(TAG_RE, "");
  } while (current !== previous);
  return current.trim();
}

const WRAP_OPEN = "<candidate_msg>";
const WRAP_CLOSE = "</candidate_msg>";

/** Strip tags, then wrap in the trusted control boundary the system prompt references. */
export function wrapCandidateMessage(input: string): string {
  return `${WRAP_OPEN}\n${stripTags(input)}\n${WRAP_CLOSE}`;
}
