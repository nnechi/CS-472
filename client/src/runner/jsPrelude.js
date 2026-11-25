(() => {
  const g = globalThis;
  const writeOut = g.__wasm_oj_write_stdout;
  const writeErr = g.__wasm_oj_write_stderr;
  if (typeof writeOut !== "function" || typeof writeErr !== "function" || g.__lpPrelude) return;
  g.__lpPrelude = true;

  const BREAK_LENGTH = 80;
  const COMPACT = 3;
  const MAX_ARRAY = 100;
  const MAX_DEPTH = 2;
  const objToString = Object.prototype.toString;
  const fnToString = Function.prototype.toString;
  const errToString = Error.prototype.toString;

  const META = [];
  for (let i = 0; i < 0x20; i++) META[i] = "\\x" + i.toString(16).toUpperCase().padStart(2, "0");
  META[8] = "\\b"; META[9] = "\\t"; META[10] = "\\n"; META[12] = "\\f"; META[13] = "\\r";
  META[0x27] = "\\'"; META[0x5c] = "\\\\"; META[0x7f] = "\\x7F";

  const quote = (str) => {
    let q = "'";
    if (str.includes("'")) {
      if (!str.includes('"')) q = '"';
      else if (!str.includes("`") && !str.includes("${")) q = "`";
    }
    let out = "";
    for (const ch of str) {
      const code = ch.charCodeAt(0);
      if (ch.length === 1 && (code < 0x20 || code === 0x7f || code === 0x5c || (code === 0x27 && q === "'"))) out += META[code];
      else out += ch;
    }
    return q + out + q;
  };

  const formatNumber = (n) => (Object.is(n, -0) ? "-0" : String(n));
  const formatKey = (key) => {
    if (typeof key === "symbol") return String(key);
    return /^[a-zA-Z_][a-zA-Z_0-9]*$/.test(key) ? key : quote(key);
  };

  const ctorName = (value) => {
    let obj = value;
    while (obj !== null && obj !== undefined) {
      const desc = Object.getOwnPropertyDescriptor(obj, "constructor");
      if (desc && typeof desc.value === "function" && desc.value.name !== "") return desc.value.name;
      obj = Object.getPrototypeOf(obj);
    }
    return null;
  };

  const getPrefix = (constructor, tag, fallback, size) => {
    if (constructor === null) {
      if (tag !== "" && fallback !== tag) return `[${fallback}${size}: null prototype] [${tag}] `;
      return `[${fallback}${size}: null prototype] `;
    }
    if (tag !== "" && constructor !== tag) return `${constructor}${size} [${tag}] `;
    return `${constructor}${size} `;
  };

  const functionBase = (fn, constructor, tag) => {
    const src = fnToString.call(fn);
    if (src.startsWith("class") && /^class\s*[{\s\w$]/.test(src)) {
      let base = `[class ${fn.name || "(anonymous)"}`;
      const superClass = Object.getPrototypeOf(fn);
      if (superClass && superClass.name) base += ` extends ${superClass.name}`;
      return base + "]";
    }
    let type = "Function";
    if (constructor === "AsyncFunction" || constructor === "GeneratorFunction" || constructor === "AsyncGeneratorFunction") type = constructor;
    let base = `[${type}`;
    if (constructor === null) base += " (null prototype)";
    base += fn.name === "" ? " (anonymous)" : `: ${fn.name}`;
    base += "]";
    if (constructor !== type && constructor !== null) base += ` ${constructor}`;
    if (tag !== "" && constructor !== tag) base += ` [${tag}]`;
    return base;
  };

  const isInternalFrame = (line) => /__wasm_oj_|\/project\/bundle\.js|<eval>|__lp\.(js|ts)|\(native\)|<anonymous> \(<input>|at __load/.test(line);

  const formatError = (err, constructor) => {
    let name = err.name != null ? String(err.name) : "Error";
    if (constructor && constructor !== name && name === "Error") name = constructor;
    const message = err.message != null ? String(err.message) : "";
    let header = message ? `${name}: ${message}` : name;
    if (!header) header = errToString.call(err);
    const frames = typeof err.stack === "string"
      ? err.stack.split("\n").filter((l) => /^\s+at /.test(l) && !isInternalFrame(l))
      : [];
    return frames.length ? header + "\n" + frames.join("\n") : (frames.length === 0 && typeof err.stack === "string" && err.stack.trim() !== "" ? header : `[${header}]`);
  };

  const isBelowBreakLength = (ctx, output, start, base) => {
    let total = output.length + start;
    if (total + output.length > BREAK_LENGTH) return false;
    for (const entry of output) {
      total += entry.length;
      if (total > BREAK_LENGTH) return false;
    }
    return base === "" || !base.includes("\n");
  };

  const groupArrayElements = (ctx, output, value) => {
    let totalLength = 0;
    let maxLength = 0;
    let outputLength = output.length;
    if (ctx.extraEntries) outputLength--;
    const separatorSpace = 2;
    const dataLen = new Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const len = output[i].length;
      dataLen[i] = len;
      totalLength += len + separatorSpace;
      if (maxLength < len) maxLength = len;
    }
    const actualMax = maxLength + separatorSpace;
    if (actualMax * 3 + ctx.indentationLvl < BREAK_LENGTH && (totalLength / actualMax > 5 || maxLength <= 6)) {
      const averageBias = Math.sqrt(actualMax - totalLength / output.length);
      const biasedMax = Math.max(actualMax - 3 - averageBias, 1);
      const columns = Math.min(
        Math.round(Math.sqrt(2.5 * biasedMax * outputLength) / biasedMax),
        Math.floor((BREAK_LENGTH - ctx.indentationLvl) / actualMax),
        COMPACT * 4,
        15,
      );
      if (columns <= 1) return output;
      const tmp = [];
      const maxLineLength = [];
      for (let i = 0; i < columns; i++) {
        let lineLength = 0;
        for (let j = i; j < output.length; j += columns) if (dataLen[j] > lineLength) lineLength = dataLen[j];
        maxLineLength.push(lineLength + separatorSpace);
      }
      let padStart = true;
      if (value !== undefined) {
        for (let i = 0; i < output.length; i++) {
          if (typeof value[i] !== "number" && typeof value[i] !== "bigint") { padStart = false; break; }
        }
      }
      for (let i = 0; i < outputLength; i += columns) {
        const max = Math.min(i + columns, outputLength);
        let str = "";
        let j = i;
        for (; j < max - 1; j++) {
          const cell = `${output[j]}, `;
          str += padStart ? cell.padStart(maxLineLength[j - i], " ") : cell.padEnd(maxLineLength[j - i], " ");
        }
        str += padStart ? output[j].padStart(maxLineLength[j - i] - separatorSpace, " ") : output[j];
        tmp.push(str);
      }
      if (ctx.extraEntries) tmp.push(output[outputLength]);
      return tmp;
    }
    return output;
  };

  const reduceToSingleString = (ctx, output, base, braces, isArrayLike, recurseTimes, value) => {
    const entries = output.length;
    if (isArrayLike && entries > 6) output = groupArrayElements(ctx, output, value);
    if (ctx.currentDepth - recurseTimes < COMPACT && entries === output.length) {
      const start = output.length + ctx.indentationLvl + braces[0].length + base.length + 10;
      if (isBelowBreakLength(ctx, output, start, base)) {
        const joined = output.join(", ");
        if (!joined.includes("\n")) return `${base ? `${base} ` : ""}${braces[0]} ${joined} ${braces[1]}`;
      }
    }
    const indentation = `\n${" ".repeat(ctx.indentationLvl)}`;
    return `${base ? `${base} ` : ""}${braces[0]}${indentation}  ${output.join(`,${indentation}  `)}${indentation}${braces[1]}`;
  };

  const formatProperty = (ctx, value, recurseTimes, key, isArrayItem) => {
    const desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key], enumerable: true };
    let str;
    if (desc.value !== undefined || !("get" in desc || "set" in desc)) {
      ctx.indentationLvl += 2;
      str = formatValue(ctx, desc.value, recurseTimes);
      ctx.indentationLvl -= 2;
    } else if (desc.get !== undefined) {
      str = desc.set !== undefined ? "[Getter/Setter]" : "[Getter]";
    } else {
      str = desc.set !== undefined ? "[Setter]" : "undefined";
    }
    if (isArrayItem) return str;
    if (desc.enumerable === false) return `[${typeof key === "symbol" ? String(key) : key}]: ${str}`;
    return `${formatKey(key)}: ${str}`;
  };

  const ownKeys = (value, skipIndices, showHidden) => {
    const keys = [];
    for (const key of showHidden ? Object.getOwnPropertyNames(value) : Object.keys(value)) {
      if (skipIndices && /^(0|[1-9][0-9]*)$/.test(key) && Number(key) < 4294967295) continue;
      keys.push(key);
    }
    for (const sym of Object.getOwnPropertySymbols(value)) {
      const d = Object.getOwnPropertyDescriptor(value, sym);
      if (d && (d.enumerable || showHidden)) keys.push(sym);
    }
    return keys;
  };

  const formatArrayLike = (ctx, value, recurseTimes, length) => {
    const output = [];
    const shown = Math.min(MAX_ARRAY, length);
    let holes = 0;
    let i = 0;
    for (; i < length && output.length < shown; i++) {
      if (!Object.prototype.hasOwnProperty.call(value, i)) { holes++; continue; }
      if (holes > 0) { output.push(`<${holes} empty item${holes > 1 ? "s" : ""}>`); holes = 0; if (output.length >= shown) break; }
      output.push(formatProperty(ctx, value, recurseTimes, i, true));
    }
    if (holes > 0 && output.length < shown) { output.push(`<${holes} empty item${holes > 1 ? "s" : ""}>`); holes = 0; }
    const remaining = length - i;
    if (remaining > 0 && output.length >= shown) {
      output.push(`... ${remaining} more item${remaining > 1 ? "s" : ""}`);
      ctx.extraEntries = true;
    }
    return output;
  };

  const formatValue = (ctx, value, recurseTimes, typedArray) => {
    if (typeof value !== "object" && typeof value !== "function") return formatPrimitive(value);
    if (value === null) return "null";
    if (ctx.seen.includes(value)) {
      let index = ctx.circular.get(value);
      if (index === undefined) { index = ctx.circular.size + 1; ctx.circular.set(value, index); }
      return `[Circular *${index}]`;
    }
    return formatRaw(ctx, value, recurseTimes, typedArray);
  };

  const formatPrimitive = (value) => {
    switch (typeof value) {
      case "string": return quote(value);
      case "number": return formatNumber(value);
      case "bigint": return `${value}n`;
      case "boolean": return String(value);
      case "undefined": return "undefined";
      case "symbol": return String(value);
      default: return String(value);
    }
  };

  const formatRaw = (ctx, value, recurseTimes) => {
    const constructor = ctorName(value);
    let tag = value[Symbol.toStringTag];
    if (typeof tag !== "string" || (tag !== "" && tag === constructor)) tag = "";
    let base = "";
    let braces;
    let formatter = null;
    let isArrayLike = false;
    let keys;
    let noIterator = true;
    const extrasBefore = ctx.extraEntries;
    ctx.extraEntries = false;

    if (Array.isArray(value)) {
      noIterator = false;
      const prefix = constructor !== "Array" || tag !== "" ? getPrefix(constructor, tag, "Array", `(${value.length})`) : "";
      keys = ownKeys(value, true, ctx.showHidden);
      braces = [`${prefix}[`, "]"];
      if (value.length === 0 && keys.length === 0) { ctx.extraEntries = extrasBefore; return `${braces[0]}]`; }
      isArrayLike = true;
      formatter = () => formatArrayLike(ctx, value, recurseTimes, value.length);
    } else if (value instanceof Set) {
      noIterator = false;
      const size = value.size;
      const prefix = getPrefix(constructor, tag, "Set", `(${size})`);
      keys = ownKeys(value, false);
      braces = [`${prefix}{`, "}"];
      if (size === 0 && keys.length === 0) { ctx.extraEntries = extrasBefore; return `${prefix}{}`; }
      formatter = () => {
        ctx.indentationLvl += 2;
        const out = [];
        for (const v of value) out.push(formatValue(ctx, v, recurseTimes));
        ctx.indentationLvl -= 2;
        return out;
      };
    } else if (value instanceof Map) {
      noIterator = false;
      const size = value.size;
      const prefix = getPrefix(constructor, tag, "Map", `(${size})`);
      keys = ownKeys(value, false);
      braces = [`${prefix}{`, "}"];
      if (size === 0 && keys.length === 0) { ctx.extraEntries = extrasBefore; return `${prefix}{}`; }
      formatter = () => {
        ctx.indentationLvl += 2;
        const out = [];
        for (const [k, v] of value) out.push(`${formatValue(ctx, k, recurseTimes)} => ${formatValue(ctx, v, recurseTimes)}`);
        ctx.indentationLvl -= 2;
        return out;
      };
    } else if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
      noIterator = false;
      const fallback = constructor || "TypedArray";
      keys = ownKeys(value, true);
      braces = [`${getPrefix(constructor, tag, fallback, `(${value.length})`)}[`, "]"];
      if (value.length === 0 && keys.length === 0) { ctx.extraEntries = extrasBefore; return `${braces[0]}]`; }
      isArrayLike = true;
      formatter = () => {
        const out = [];
        const shown = Math.min(MAX_ARRAY, value.length);
        for (let i = 0; i < shown; i++) out.push(typeof value[i] === "bigint" ? `${value[i]}n` : formatNumber(value[i]));
        if (value.length > shown) { out.push(`... ${value.length - shown} more item${value.length - shown > 1 ? "s" : ""}`); ctx.extraEntries = true; }
        return out;
      };
    }

    if (noIterator) {
      keys = ownKeys(value, false, ctx.showHidden && typeof value !== "function");
      braces = ["{", "}"];
      if (typeof value === "function") {
        base = functionBase(value, constructor, tag);
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return base; }
      } else if (objToString.call(value) === "[object Arguments]") {
        braces = ["[Arguments] {", "}"];
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return "[Arguments] {}"; }
      } else if (value instanceof RegExp || objToString.call(value) === "[object RegExp]") {
        base = RegExp.prototype.toString.call(value);
        const prefix = getPrefix(constructor, tag, "RegExp", "");
        if (prefix !== "RegExp ") base = `${prefix}${base}`;
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return base; }
      } else if (value instanceof Date || objToString.call(value) === "[object Date]") {
        const time = Date.prototype.getTime.call(value);
        base = Number.isNaN(time) ? "Invalid Date" : Date.prototype.toISOString.call(value);
        const prefix = getPrefix(constructor, tag, "Date", "");
        if (prefix !== "Date ") base = `${prefix}${base}`;
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return base; }
      } else if (value instanceof Error || objToString.call(value) === "[object Error]") {
        base = formatError(value, constructor);
        keys = keys.filter((k) => k !== "stack" && k !== "message");
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return base; }
        if (ctx.indentationLvl !== 0) base = base.split("\n").join(`\n${" ".repeat(ctx.indentationLvl)}`);
      } else if (value instanceof Promise) {
        braces[0] = `${getPrefix(constructor, tag, "Promise", "")}{`;
        formatter = () => ["<pending>"];
      } else if (value instanceof WeakSet || value instanceof WeakMap) {
        braces[0] = `${getPrefix(constructor, tag, value instanceof WeakSet ? "WeakSet" : "WeakMap", "")}{`;
        formatter = () => ["<items unknown>"];
      } else if (value instanceof Number || value instanceof String || value instanceof Boolean || (typeof BigInt === "function" && value instanceof BigInt) || value instanceof Symbol) {
        let type;
        let inner;
        if (value instanceof Number) { type = "Number"; inner = formatNumber(Number.prototype.valueOf.call(value)); }
        else if (value instanceof String) { type = "String"; inner = quote(String.prototype.valueOf.call(value)); keys = keys.filter((k) => !/^(0|[1-9][0-9]*)$/.test(k)); }
        else if (value instanceof Boolean) { type = "Boolean"; inner = String(Boolean.prototype.valueOf.call(value)); }
        else if (value instanceof Symbol) { type = "Symbol"; inner = String(Symbol.prototype.valueOf.call(value)); }
        else { type = "BigInt"; inner = `${BigInt.prototype.valueOf.call(value)}n`; }
        base = `[${type}`;
        if (type !== constructor) base += constructor === null ? " (null prototype)" : ` (${constructor})`;
        base += `: ${inner}]`;
        if (tag !== "" && tag !== constructor) base += ` [${tag}]`;
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return base; }
      } else {
        if (constructor === "Object") {
          if (tag !== "") braces[0] = `${getPrefix(constructor, tag, "Object", "")}{`;
        } else {
          braces[0] = `${getPrefix(constructor, tag, "Object", "")}{`;
        }
        if (keys.length === 0) { ctx.extraEntries = extrasBefore; return `${braces[0]}}`; }
      }
    }

    if (recurseTimes > MAX_DEPTH) {
      ctx.extraEntries = extrasBefore;
      const name = getPrefix(constructor, tag, "Object", "").slice(0, -1);
      return constructor === null ? name : `[${name}]`;
    }

    recurseTimes += 1;
    ctx.seen.push(value);
    ctx.currentDepth = recurseTimes;
    let output = formatter ? formatter() : [];
    for (const key of keys) output.push(formatProperty(ctx, value, recurseTimes, key, false));
    ctx.seen.pop();

    const index = ctx.circular.get(value);
    if (index !== undefined) {
      const reference = `<ref *${index}>`;
      base = base === "" ? reference : `${reference} ${base}`;
    }
    const res = reduceToSingleString(ctx, output, base, braces, isArrayLike, recurseTimes, value);
    ctx.extraEntries = extrasBefore;
    return res;
  };

  const inspect = (value, depth = MAX_DEPTH, showHidden = false) => {
    const ctx = { seen: [], circular: new Map(), indentationLvl: 0, currentDepth: 0, extraEntries: false, showHidden };
    return formatValue(ctx, value, MAX_DEPTH - depth);
  };

  const builtInObjects = new Set(Object.getOwnPropertyNames(g).filter((name) => /^[A-Z][a-zA-Z0-9]+$/.test(name)));
  const hasBuiltInToString = (value) => {
    if (typeof value.toString !== "function") return true;
    if (Object.prototype.hasOwnProperty.call(value, "toString")) return false;
    let pointer = value;
    do { pointer = Object.getPrototypeOf(pointer); } while (pointer !== null && !Object.prototype.hasOwnProperty.call(pointer, "toString"));
    if (pointer === null) return true;
    const desc = Object.getOwnPropertyDescriptor(pointer, "constructor");
    return desc !== undefined && typeof desc.value === "function" && builtInObjects.has(desc.value.name);
  };

  const format = (args) => {
    const first = args[0];
    let a = 0;
    let str = "";
    let join = "";
    if (typeof first === "string") {
      if (args.length === 1) return first;
      let tempStr;
      let lastPos = 0;
      for (let i = 0; i < first.length - 1; i++) {
        if (first.charCodeAt(i) !== 37) continue;
        const nextChar = first.charCodeAt(++i);
        if (a + 1 !== args.length) {
          switch (nextChar) {
            case 115: {
              const arg = args[++a];
              if (typeof arg === "number") tempStr = formatNumber(arg);
              else if (typeof arg === "bigint") tempStr = `${arg}n`;
              else if (typeof arg !== "object" || arg === null || !hasBuiltInToString(arg)) tempStr = String(arg);
              else tempStr = inspect(arg, 0);
              break;
            }
            case 106: {
              try { tempStr = JSON.stringify(args[++a]); } catch { tempStr = "[Circular]"; }
              break;
            }
            case 100: {
              const n = args[++a];
              tempStr = typeof n === "bigint" ? `${n}n` : typeof n === "symbol" ? "NaN" : formatNumber(Number(n));
              break;
            }
            case 79: tempStr = inspect(args[++a]); break;
            case 111: tempStr = inspect(args[++a], 4, true); break;
            case 105: {
              const n = args[++a];
              tempStr = typeof n === "bigint" ? `${n}n` : typeof n === "symbol" ? "NaN" : formatNumber(Number.parseInt(n));
              break;
            }
            case 102: {
              const n = args[++a];
              tempStr = typeof n === "symbol" ? "NaN" : formatNumber(Number.parseFloat(n));
              break;
            }
            case 99: a += 1; tempStr = ""; break;
            case 37: str += first.slice(lastPos, i); lastPos = i + 1; continue;
            default: continue;
          }
          if (lastPos !== i - 1) str += first.slice(lastPos, i - 1);
          str += tempStr;
          lastPos = i + 1;
        } else if (nextChar === 37) {
          str += first.slice(lastPos, i);
          lastPos = i + 1;
        }
      }
      if (lastPos !== 0) {
        a++;
        join = " ";
        if (lastPos < first.length) str += first.slice(lastPos);
      }
    }
    while (a < args.length) {
      const value = args[a];
      str += join;
      str += typeof value !== "string" ? inspect(value) : value;
      join = " ";
      a++;
    }
    return str;
  };

  let groupIndent = "";
  const emit = (write, text) => {
    if (groupIndent !== "") text = groupIndent + text.split("\n").join(`\n${groupIndent}`);
    write(text + "\n");
  };
  const counts = new Map();
  const timers = new Map();
  const c = g.console || (g.console = {});
  c.log = (...args) => emit(writeOut, format(args));
  c.info = c.log;
  c.debug = c.log;
  c.error = (...args) => emit(writeErr, format(args));
  c.warn = c.error;
  c.trace = (...args) => {
    const err = new Error();
    const frames = typeof err.stack === "string" ? err.stack.split("\n").filter((l) => /^\s+at /.test(l) && !isInternalFrame(l)).slice(1) : [];
    emit(writeErr, `Trace${args.length ? ": " + format(args) : ""}${frames.length ? "\n" + frames.join("\n") : ""}`);
  };
  c.dir = (value) => emit(writeOut, inspect(value));
  c.dirxml = c.log;
  c.assert = (condition, ...args) => {
    if (condition) return;
    if (typeof args[0] === "string") args[0] = `Assertion failed: ${args[0]}`;
    else args.unshift("Assertion failed");
    emit(writeErr, format(args));
  };
  c.count = (label = "default") => {
    label = `${label}`;
    const n = (counts.get(label) || 0) + 1;
    counts.set(label, n);
    emit(writeOut, `${label}: ${n}`);
  };
  c.countReset = (label = "default") => { counts.delete(`${label}`); };
  c.group = (...args) => { if (args.length) c.log(...args); groupIndent += "  "; };
  c.groupCollapsed = c.group;
  c.groupEnd = () => { groupIndent = groupIndent.slice(0, groupIndent.length - 2); };
  const now = () => (g.performance && typeof g.performance.now === "function" ? g.performance.now() : Date.now());
  const formatTime = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(3)}s` : `${ms.toFixed(3)}ms`);
  c.time = (label = "default") => { timers.set(`${label}`, now()); };
  c.timeLog = (label = "default", ...args) => {
    const start = timers.get(`${label}`);
    if (start === undefined) return;
    emit(writeOut, `${label}: ${formatTime(now() - start)}${args.length ? " " + format(args) : ""}`);
  };
  c.timeEnd = (label = "default") => { c.timeLog(label); timers.delete(`${label}`); };
  c.table = (data, properties) => {
    if (data === null || typeof data !== "object") return c.log(data);
    const renderRow = (row, widths) => "│" + row.map((cell, i) => " " + cell + " ".repeat(widths[i] - [...cell].length + 1)).join("│") + "│";
    const cell = (v) => (v === undefined ? "" : inspect(v, 1));
    const indexKeys = [];
    const valuesCol = [];
    const columns = [];
    const rows = new Map();
    let hasValues = false;
    const entries = data instanceof Map ? [...data.entries()] : Object.entries(data);
    const isMap = data instanceof Map;
    for (const [k, v] of entries) {
      const key = isMap ? inspect(k) : k;
      indexKeys.push(key);
      const row = {};
      if (!isMap && v !== null && typeof v === "object") {
        for (const col of Object.keys(v)) {
          if (properties && !properties.includes(col)) continue;
          if (!columns.includes(col)) columns.push(col);
          row[col] = cell(v[col]);
        }
        valuesCol.push("");
      } else {
        hasValues = true;
        valuesCol.push(cell(v));
      }
      rows.set(key, row);
    }
    const header = [isMap ? "(iteration index)" : "(index)"];
    if (isMap) header.push("Key");
    header.push(...(properties || columns));
    if (hasValues) header.push("Values");
    const body = indexKeys.map((k, i) => {
      const r = [isMap ? String(i) : k];
      if (isMap) r.push(k);
      for (const col of properties || columns) r.push(rows.get(k)[col] ?? "");
      if (hasValues) r.push(valuesCol[i]);
      return r;
    });
    const widths = header.map((h, i) => Math.max([...h].length, ...body.map((r) => [...r[i]].length)) + 0);
    const line = (l, m, r) => l + widths.map((w) => "─".repeat(w + 2)).join(m) + r;
    const out = [line("┌", "┬", "┐"), renderRow(header, widths), line("├", "┼", "┤"), ...body.map((r) => renderRow(r, widths)), line("└", "┴", "┘")];
    emit(writeOut, out.join("\n"));
  };

  const queue = [];
  let nextId = 1;
  let virtualNow = 0;
  let pumping = false;
  let exited = false;

  class Timeout {
    constructor(id) { this._id = id; }
    ref() { return this; }
    unref() { return this; }
    hasRef() { return true; }
    refresh() { const t = queue.find((x) => x.id === this._id); if (t) t.at = virtualNow + t.delay; return this; }
    close() { clear(this); return this; }
    [Symbol.toPrimitive]() { return this._id; }
  }
  class Immediate {
    constructor(id) { this._id = id; }
    ref() { return this; }
    unref() { return this; }
    hasRef() { return true; }
  }

  const pump = async function __lpRunTimers() {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        for (let i = 0; i < 1000; i++) await null;
        if (exited || queue.length === 0) break;
        queue.sort((x, y) => x.at - y.at || x.kind - y.kind || x.seq - y.seq);
        const timer = queue.shift();
        if (timer.at > virtualNow) virtualNow = timer.at;
        if (timer.repeat) { timer.at = virtualNow + timer.delay; timer.seq = nextId++; queue.push(timer); }
        timer.fn(...timer.args);
      }
    } finally {
      pumping = false;
    }
  };

  const schedule = (fn, delay, args, repeat, immediate) => {
    if (typeof fn !== "function") {
      const err = new TypeError(`The "callback" argument must be of type function. Received ${fn === undefined ? "undefined" : inspect(fn)}`);
      err.code = "ERR_INVALID_ARG_TYPE";
      throw err;
    }
    let ms = immediate ? 1 : Number(delay);
    if (!(ms >= 1 && ms <= 2147483647)) ms = 1;
    const id = nextId++;
    queue.push({ id, seq: id, kind: immediate ? 1 : 0, at: virtualNow + ms, delay: ms, fn, args, repeat });
    void pump();
    return immediate ? new Immediate(id) : new Timeout(id);
  };
  const clear = (handle) => {
    if (handle === null || handle === undefined) return;
    const id = typeof handle === "object" ? handle._id : Number(handle);
    const i = queue.findIndex((t) => t.id === id);
    if (i !== -1) queue.splice(i, 1);
  };

  g.setTimeout = (fn, delay, ...args) => schedule(fn, delay, args, false, false);
  g.setInterval = (fn, delay, ...args) => schedule(fn, delay, args, true, false);
  g.setImmediate = (fn, ...args) => schedule(fn, 0, args, false, true);
  g.clearTimeout = clear;
  g.clearInterval = clear;
  g.clearImmediate = clear;

  const proc = g.process || (g.process = {});
  proc.exit = function __lpExit(code) {
    let status = code === undefined ? proc.exitCode : code;
    status = status === undefined || status === null ? 0 : Number(status) | 0;
    exited = true;
    queue.length = 0;
    throw { toString: () => `__LP_EXIT__:${status}` };
  };
  if (!proc.platform) proc.platform = "linux";
  if (!proc.version) proc.version = "v24.0.0";
  if (!proc.versions) proc.versions = { node: "24.0.0" };
  if (typeof proc.cwd !== "function") proc.cwd = () => "/project";
  if (typeof proc.hrtime !== "function") {
    const hr = (prev) => {
      const t = now() * 1e6;
      let s = Math.floor(t / 1e9);
      let ns = Math.floor(t % 1e9);
      if (prev) { s -= prev[0]; ns -= prev[1]; if (ns < 0) { s -= 1; ns += 1e9; } }
      return [s, ns];
    };
    hr.bigint = () => BigInt(Math.floor(now() * 1e6));
    proc.hrtime = hr;
  }
  g.__lpInspect = inspect;
  g.__lpFormat = format;
})();
