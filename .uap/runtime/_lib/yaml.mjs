/**
 * Zero-dependency YAML subset parser for UAP machine configs.
 *
 * Supported: block mappings, block sequences, nested sequences of mappings,
 * flow sequences `[a, b]`, flow maps `{a: b}`, single/double quoted scalars,
 * booleans, null, integers/floats, plain scalars, and comments.
 *
 * Deliberately unsupported (throws instead of silently mis-parsing):
 * anchors/aliases, multi-line block scalars, multi-document streams beyond `---`,
 * tags, and complex keys. UAP configs must stay inside this subset so that the
 * runtime never needs a third-party YAML dependency.
 */

class YAMLError extends Error {
  constructor(message, lineNo) {
    super(`YAML parse error at line ${lineNo}: ${message}`);
    this.name = 'YAMLError';
    this.lineNo = lineNo;
  }
}

function stripComment(input) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) {
        if (quote === '"' && input[i - 1] === '\\') continue;
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    if (ch === ']' || ch === '}') depth -= 1;
    if (ch === '#' && depth === 0 && (i === 0 || /\s/.test(input[i - 1]))) {
      return input.slice(0, i).trimEnd();
    }
  }
  return input.trimEnd();
}

function splitFlow(input, separator = ',') {
  const parts = [];
  let current = '';
  let quote = null;
  let depth = 0;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        if (quote === '"' && input[i - 1] === '\\') continue;
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    if (ch === ']' || ch === '}') depth -= 1;
    if (ch === separator && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseScalar(raw, lineNo) {
  const value = raw.trim();
  if (value === '' || value === '~' || value === 'null' || value === 'Null' || value === 'NULL') return null;
  if (value === 'true' || value === 'True' || value === 'TRUE') return true;
  if (value === 'false' || value === 'False' || value === 'FALSE') return false;
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      throw new YAMLError(`invalid double-quoted scalar: ${value}`, lineNo);
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.startsWith('[')) {
    if (!value.endsWith(']')) throw new YAMLError('unterminated flow sequence', lineNo);
    const inner = value.slice(1, -1).trim();
    if (!inner) return [];
    return splitFlow(inner).map((item) => parseScalar(item, lineNo));
  }
  if (value.startsWith('{')) {
    if (!value.endsWith('}')) throw new YAMLError('unterminated flow mapping', lineNo);
    const inner = value.slice(1, -1).trim();
    if (!inner) return {};
    const out = {};
    for (const pair of splitFlow(inner)) {
      const idx = pair.indexOf(':');
      if (idx < 0) throw new YAMLError(`invalid flow mapping entry: ${pair}`, lineNo);
      out[parseScalar(pair.slice(0, idx), lineNo)] = parseScalar(pair.slice(idx + 1), lineNo);
    }
    return out;
  }
  if (/^-?\d+$/.test(value)) return Number.parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return Number.parseFloat(value);
  if (value.startsWith('|') || value.startsWith('>')) {
    throw new YAMLError('multi-line block scalars are not supported by the UAP config subset', lineNo);
  }
  if (value.startsWith('&') || value.startsWith('*') || value.startsWith('!')) {
    throw new YAMLError('anchors, aliases and tags are not supported by the UAP config subset', lineNo);
  }
  return value;
}

function tokenize(text) {
  const lines = [];
  const rawLines = text.split(/\r?\n/);
  for (let n = 0; n < rawLines.length; n += 1) {
    const raw = rawLines[n];
    if (/^\s*---\s*$/.test(raw) || /^\s*\.\.\.\s*$/.test(raw)) continue;
    const stripped = stripComment(raw);
    if (!stripped.trim()) continue;
    const indentMatch = stripped.match(/^(\s*)/);
    const indent = indentMatch[1].replace(/\t/g, '  ').length;
    if (/\t/.test(indentMatch[1])) {
      throw new YAMLError('tabs are not allowed for indentation', n + 1);
    }
    lines.push({ indent, content: stripped.trim(), lineNo: n + 1 });
  }
  return lines;
}

function findKeyValue(content, lineNo) {
  let quote = null;
  let depth = 0;
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i];
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '[' || ch === '{') depth += 1;
    if (ch === ']' || ch === '}') depth -= 1;
    if (ch === ':' && depth === 0 && (i + 1 === content.length || /\s/.test(content[i + 1]))) {
      return { key: parseScalar(content.slice(0, i), lineNo), value: content.slice(i + 1).trim() };
    }
  }
  return null;
}

function parseBlock(lines, start, indent) {
  if (start >= lines.length || lines[start].indent < indent) return { value: null, next: start };
  const actualIndent = lines[start].indent;
  if (actualIndent !== indent) return { value: null, next: start };
  const isSequence = lines[start].content === '-' || lines[start].content.startsWith('- ');
  return isSequence ? parseSequence(lines, start, indent) : parseMapping(lines, start, indent);
}

function parseMapping(lines, start, indent) {
  const out = {};
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YAMLError('unexpected indentation in mapping', line.lineNo);
    if (line.content === '-' || line.content.startsWith('- ')) break;
    const kv = findKeyValue(line.content, line.lineNo);
    if (!kv) throw new YAMLError(`expected key: value, got: ${line.content}`, line.lineNo);
    if (Object.prototype.hasOwnProperty.call(out, String(kv.key))) {
      throw new YAMLError(`duplicate key: ${kv.key}`, line.lineNo);
    }
    if (kv.value !== '') {
      out[String(kv.key)] = parseScalar(kv.value, line.lineNo);
      i += 1;
      continue;
    }
    if (i + 1 < lines.length && lines[i + 1].indent > indent) {
      const child = parseBlock(lines, i + 1, lines[i + 1].indent);
      out[String(kv.key)] = child.value;
      i = child.next;
    } else {
      out[String(kv.key)] = null;
      i += 1;
    }
  }
  return { value: out, next: i };
}

function parseSequence(lines, start, indent) {
  const out = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.indent < indent) break;
    if (line.indent > indent) throw new YAMLError('unexpected indentation in sequence', line.lineNo);
    if (line.content !== '-' && !line.content.startsWith('- ')) break;
    const rest = line.content === '-' ? '' : line.content.slice(2).trim();
    if (rest === '') {
      if (i + 1 < lines.length && lines[i + 1].indent > indent) {
        const child = parseBlock(lines, i + 1, lines[i + 1].indent);
        out.push(child.value);
        i = child.next;
      } else {
        out.push(null);
        i += 1;
      }
      continue;
    }
    const kv = findKeyValue(rest, line.lineNo);
    if (!kv) {
      out.push(parseScalar(rest, line.lineNo));
      i += 1;
      continue;
    }
    // A mapping that begins on the `- ` line: collect its continuation lines
    // and parse them as one synthetic block at the child indentation.
    const childIndent = indent + 2;
    const synthetic = [{ indent: childIndent, content: rest, lineNo: line.lineNo }];
    let j = i + 1;
    while (j < lines.length && lines[j].indent > indent) {
      synthetic.push(lines[j]);
      j += 1;
    }
    const child = parseMapping(synthetic, 0, childIndent);
    if (child.next !== synthetic.length) {
      throw new YAMLError('inconsistent indentation inside sequence item', line.lineNo);
    }
    out.push(child.value);
    i = j;
  }
  return { value: out, next: i };
}

export function parseYAML(text) {
  const lines = tokenize(text);
  if (lines.length === 0) return null;
  const parsed = parseBlock(lines, 0, lines[0].indent);
  if (parsed.next !== lines.length) {
    throw new YAMLError(`unconsumed input at line ${lines[parsed.next].lineNo}`, lines[parsed.next].lineNo);
  }
  return parsed.value;
}

export { YAMLError };
