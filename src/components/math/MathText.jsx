import katex from "katex";
import "katex/dist/katex.min.css";
const HTML_TAG_PATTERN = /(<\/?(p|br|div|span|strong|em|b|i|u|ul|ol|li|h[1-6]|table|tr|td|th|thead|tbody|a|img|pre|code|blockquote|hr|sup|sub|small|mark|del|ins)[\s/>])/i;
function stripHtml(text) {
  if (!text || !text.includes("<")) return text;
  if (!HTML_TAG_PATTERN.test(text)) return text;
  try {
    const doc = new DOMParser().parseFromString(text, "text/html");
    return doc.body.textContent || "";
  } catch {
    return text.replace(/<[^>]*>/g, "");
  }
}
function stripFormatMarkers(text) {
  return text.replace(/\*\*(.+?)\*\*/gs, "$1").replace(/\*(.+?)\*/gs, "$1").replace(/__(.+?)__/gs, "$1");
}
function hasFormatting(text) {
  if (!text) return false;
  return /\$[^$]+\$|\[color=[^\]]+\]|\*\*|\*|__/.test(text);
}
function parseContent(text) {
  if (!text) return [];
  const pattern = /\$([^$]+)\$|\[color=([^\]]+)\](.*?)\[\/color\]/gs;
  const matches = Array.from(text.matchAll(pattern));
  if (matches.length === 0) {
    return [{ type: "text", content: text }];
  }
  const parts = [];
  let lastIndex = 0;
  matches.forEach((match) => {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: text.substring(lastIndex, match.index) });
    }
    if (match[1] !== void 0) {
      parts.push({ type: "formula", content: match[1] });
    } else if (match[2] !== void 0) {
      parts.push({ type: "color", color: match[2], content: match[3] });
    }
    lastIndex = match.index + match[0].length;
  });
  if (lastIndex < text.length) {
    parts.push({ type: "text", content: text.substring(lastIndex) });
  }
  return parts;
}
function FormulaSpan({ formula }) {
  let html = "";
  try {
    html = katex.renderToString(formula, {
      throwOnError: false,
      displayMode: false,
      output: "html"
    });
  } catch {
    const s = document.createElement("span");
    s.textContent = formula;
    html = s.outerHTML;
  }
  return <span
    className="math-formula-inline"
    style={{
      display: "inline-block",
      margin: "0 2px",
      padding: "2px 4px",
      backgroundColor: "rgba(102, 126, 234, 0.08)",
      borderRadius: "4px",
      verticalAlign: "middle"
    }}
    dangerouslySetInnerHTML={{ __html: html }}
  />;
}
function MathText({
  content = "",
  as = "span",
  className = "",
  style = {}
}) {
  const Element = as === "div" ? "div" : "span";
  const stripped = stripFormatMarkers(stripHtml(content));
  if (!hasFormatting(stripped)) {
    return <Element className={className} style={style}>
        {stripped}
      </Element>;
  }
  const parts = parseContent(stripped);
  return <Element
    className={className}
    style={{
      display: as === "div" ? "block" : "inline",
      wordBreak: "break-word",
      lineHeight: 1.6,
      ...style
    }}
  >
      {parts.map((part, i) => {
    if (part.type === "formula") {
      return <FormulaSpan key={i} formula={part.content} />;
    }
    if (part.type === "color") {
      const innerParts = parseContent(part.content);
      return <span key={i} style={{ color: part.color }}>
              {innerParts.map((child, j) => {
        if (child.type === "formula") return <FormulaSpan key={j} formula={child.content} />;
        return <span key={j}>{child.content}</span>;
      })}
            </span>;
    }
    return <span key={i}>{part.content}</span>;
  })}
    </Element>;
}
export {
  MathText
};
