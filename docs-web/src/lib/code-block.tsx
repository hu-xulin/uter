'use client';

import { useCallback, useState, type ReactNode } from 'react';

/**
 * The code block a Markdown chapter's fenced block is drawn as.
 *
 * Authored as plain Markdown (```` ```bash ````), which on its own renders
 * as an unnumbered, single-colour block. This reproduces the three things a
 * Markdown code block is expected to have — and which this site was missing:
 *
 * - **line numbers**, in a gutter that is *not* part of the copied text;
 * - **syntax colouring**, done here rather than by a highlighter dependency
 *   (the site ships none) — `bash` and `json` are the two languages the
 *   guide's examples are written in, so they are the two that are coloured,
 *   and anything else falls back to plain text rather than being mis-coloured;
 * - **a copy button**, so an example can be pasted into a terminal as-is.
 *
 * Highlighting is intentionally a small hand-rolled tokeniser rather than a
 * library: it runs at render time in the browser, must never throw on
 * malformed input, and has to survive `next build`'s static export without a
 * WASM/async highlighter. Every branch therefore degrades to plain text.
 */

/** One highlighted run. `className` is a key into {@link TOKEN_CLASS}. */
type Token = { text: string; kind: keyof typeof TOKEN_CLASS };

/**
 * Colour roles, mapped to CSS custom properties in `global.css` so the same
 * markup reads correctly in both light and dark mode.
 */
const TOKEN_CLASS = {
  comment: 'text-doc-code-comment',
  string: 'text-doc-code-string',
  number: 'text-doc-code-number',
  keyword: 'text-doc-code-keyword',
  variable: 'text-doc-code-variable',
  property: 'text-doc-code-property',
  plain: 'text-doc-code-plain',
} as const;

/** Copy-button label per locale, filled in by the caller. */
export type CodeCopyLabels = { copy: string; copied: string };

/* ------------------------------------------------------------------ *
 * Tokenising
 * ------------------------------------------------------------------ */

/**
 * Split one line of shell into coloured runs.
 *
 * Ordered so that the construct which starts earliest in the line wins, and
 * a line-leading `#` comment swallows the rest of the line. Quoted strings
 * are matched before variables so `"$BASE/models"` colours as a string with a
 * variable inside it, which is how a shell script actually reads.
 */
function tokenizeBash(line: string): Token[] {
  if (line.trimStart().startsWith('#')) {
    return [{ text: line, kind: 'comment' }];
  }

  const pattern =
    /("(?:[^"\\]|\\.)*"|'[^']*')|(\$\{[^}]*\}|\$[A-Za-z_]\w*)|(\b\d+(?:\.\d+)?\b)|((?:[A-Za-z_][\w-]*)=)(\S+)|(^\s*|[;&|]\s*)([A-Za-z_][\w-]*)|(--?[A-Za-z][\w-]*)/g;

  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) {
      tokens.push({ text: line.slice(last, match.index), kind: 'plain' });
    }

    if (match[1] !== undefined) tokens.push({ text: match[1], kind: 'string' });
    else if (match[2] !== undefined) tokens.push({ text: match[2], kind: 'variable' });
    else if (match[3] !== undefined) tokens.push({ text: match[3], kind: 'number' });
    else if (match[4] !== undefined) {
      // `NAME=value`: the name is the thing being assigned to and the value
      // is almost always a URL or a token, so the value reads as a string.
      tokens.push({ text: match[4], kind: 'variable' });
      tokens.push({ text: match[5], kind: 'string' });
    } else if (match[6] !== undefined) {
      // Keep the leading `;`/`&&`/indent out of the coloured run so the
      // command word is coloured but the punctuation around it is not.
      tokens.push({ text: match[6], kind: 'plain' });
      tokens.push({ text: match[7], kind: 'keyword' });
    } else if (match[8] !== undefined) tokens.push({ text: match[8], kind: 'property' });

    last = pattern.lastIndex;
  }

  if (last < line.length) tokens.push({ text: line.slice(last), kind: 'plain' });
  return tokens;
}

/**
 * Split one line of JSON into coloured runs: keys, string values, numbers
 * and the `true` / `false` / `null` literals. Structural punctuation is left
 * plain, which is what makes a JSON block scannable rather than a wall.
 */
function tokenizeJson(line: string): Token[] {
  const pattern = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g;

  const tokens: Token[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > last) {
      tokens.push({ text: line.slice(last, match.index), kind: 'plain' });
    }

    if (match[1] !== undefined) {
      // A string followed by a colon is a key; otherwise a value.
      tokens.push({ text: match[1], kind: match[2] !== undefined ? 'property' : 'string' });
      if (match[2] !== undefined) tokens.push({ text: match[2], kind: 'plain' });
    } else if (match[3] !== undefined) {
      tokens.push({ text: match[3], kind: 'keyword' });
    } else if (match[4] !== undefined) {
      tokens.push({ text: match[4], kind: 'number' });
    }

    last = pattern.lastIndex;
  }

  if (last < line.length) tokens.push({ text: line.slice(last), kind: 'plain' });
  return tokens;
}

/** Shell aliases that read as commands but are not in the pattern above. */
const BASH_KEYWORDS = new Set([
  'curl', 'echo', 'cat', 'for', 'do', 'done', 'if', 'then', 'else', 'fi',
  'while', 'export', 'set', 'cd', 'exit', 'return', 'printf', 'jq', 'grep',
  'sed', 'awk', 'cut', 'sort', 'uniq', 'head', 'tail', 'wc', 'python', 'pip',
  'npm', 'node', 'go', 'docker', 'ssh', 'scp', 'mkdir', 'rm', 'cp', 'mv',
]);

/**
 * Colour a line for `lang`, or return it untouched when the language is one
 * we do not colour. Never throws: an unrecognised tokenisation simply leaves
 * the line as plain text.
 */
function tokenizeLine(line: string, lang: string | undefined): Token[] {
  switch ((lang ?? '').toLowerCase()) {
    case 'bash':
    case 'sh':
    case 'shell':
    case 'console': {
      const tokens = tokenizeBash(line);
      // Promote bare leading words we know are commands (the regex only
      // colours a word when something structural precedes it).
      if (tokens.length > 0 && tokens[0].kind === 'plain') {
        const trimmed = tokens[0].text;
        const command = trimmed.trim();
        if (BASH_KEYWORDS.has(command) && trimmed === command) {
          return [{ text: command, kind: 'keyword' }, ...tokens.slice(1)];
        }
      }
      return tokens;
    }
    case 'json':
      return tokenizeJson(line);
    default:
      return [{ text: line, kind: 'plain' }];
  }
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

export function CodeBlock({
  code,
  lang,
  labels,
}: {
  code: string;
  lang?: string;
  labels: CodeCopyLabels;
}) {
  const [copied, setCopied] = useState(false);

  /**
   * Copy the source *without* line numbers. The gutter is rendered as
   * sibling DOM, so `code` is already the plain source and can go to the
   * clipboard verbatim.
   */
  const copy = useCallback(() => {
    const done = () => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(done, () => fallbackCopy(code, done));
      return;
    }
    fallbackCopy(code, done);
  }, [code]);

  // A trailing newline in the source would render a phantom empty last line.
  const lines = code.replace(/\n$/, '').split('\n');

  return (
    <div className='not-prose group my-4 overflow-hidden rounded-lg border border-fd-border bg-fd-card/40'>
      <div className='flex items-center justify-between border-b border-fd-border px-3 py-1.5'>
        <span className='font-mono text-xs font-medium text-fd-muted-foreground'>
          {lang ?? 'text'}
        </span>
        <button
          type='button'
          onClick={copy}
          aria-label={labels.copy}
          className='rounded px-2 py-0.5 text-xs font-medium text-fd-muted-foreground transition-colors hover:bg-fd-muted hover:text-fd-foreground'
        >
          {copied ? labels.copied : labels.copy}
        </button>
      </div>

      <div className='flex overflow-x-auto'>
        {/*
         * The gutter is a sibling of the <pre>, not part of it, so the code
         * text stays a clean copyable string while the numbers still line up
         * row-for-row (both are laid out one line per source line).
         */}
        <div
          aria-hidden='true'
          className='shrink-0 select-none border-r border-fd-border/60 px-3 py-3 text-right font-mono text-doc-code text-doc-code-line'
        >
          {lines.map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>

        <pre className='min-w-0 flex-1 overflow-x-auto px-3 py-3 font-mono text-doc-code leading-relaxed'>
          <code>
            {lines.map((line, i) => {
              const tokens = tokenizeLine(line, lang);
              return (
                <div key={i} className='whitespace-pre'>
                  {tokens.map((token, j) => (
                    <span key={j} className={TOKEN_CLASS[token.kind]}>
                      {token.text}
                    </span>
                  ))}
                  {/* A blank source line still needs one row of height. */}
                  {line === '' ? '' : null}
                </div>
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}

/**
 * Copy through a detached textarea, for browsers (or insecure origins) where
 * the async Clipboard API is unavailable. `execCommand` is deprecated but is
 * the only synchronous path left, and a failed copy must not break the page.
 */
function fallbackCopy(text: string, done: () => void): void {
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    document.body.removeChild(area);
    done();
  } catch {
    /* Copying is a convenience; failing silently keeps the block usable. */
  }
}