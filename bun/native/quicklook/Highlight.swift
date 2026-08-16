import Foundation

// turns a dsl file into the html quick look shows

private let PALETTE_DARK = Palette(
  base: "#1e1e2e", gutter: "#6c7086", text: "#cdd6f4",
  comment: "#7f849c", string: "#a6e3a1", number: "#fab387",
  keyword: "#cba6f7", builtin: "#89b4fa", ident: "#cdd6f4", op: "#9399b2"
)

private let PALETTE_LIGHT = Palette(
  base: "#eff1f5", gutter: "#9ca0b0", text: "#4c4f69",
  comment: "#8c8fa1", string: "#40a02b", number: "#fe640b",
  keyword: "#8839ef", builtin: "#1e66f5", ident: "#4c4f69", op: "#7c7f93"
)

private struct Palette {
  let base, gutter, text, comment, string, number, keyword, builtin, ident, op: String
}

private func cssClass(_ kind: TokenKind) -> String? {
  switch kind {
  case .comment: return "c"
  case .string:  return "s"
  case .number:  return "n"
  case .keyword: return "k"
  case .builtin: return "b"
  case .op:      return "o"
  case .ident, .plain: return nil
  }
}

private func escapeHTML(_ text: String) -> String {
  var out = ""
  out.reserveCapacity(text.count)
  for c in text {
    switch c {
    case "&": out += "&amp;"
    case "<": out += "&lt;"
    case ">": out += "&gt;"
    default:  out.append(c)
    }
  }
  return out
}

private func variables(_ p: Palette) -> String {
  """
  --ql-base: \(p.base); --ql-gutter: \(p.gutter); --ql-text: \(p.text);
  --ql-comment: \(p.comment); --ql-string: \(p.string); --ql-number: \(p.number);
  --ql-keyword: \(p.keyword); --ql-builtin: \(p.builtin); --ql-op: \(p.op);
  """
}

func previewHTML(source: String, title: String) -> String {
  let body = tokenize(source)
    .map { token -> String in
      let escaped = escapeHTML(token.text)
      guard let name = cssClass(token.kind) else { return escaped }
      return "<span class=\"\(name)\">\(escaped)</span>"
    }
    .joined()

  let lineCount = max(1, source.split(separator: "\n", omittingEmptySubsequences: false).count)
  let gutter = (1...lineCount).map(String.init).joined(separator: "\n")

  return """
  <!doctype html>
  <html><head><meta charset="utf-8"><title>\(escapeHTML(title))</title><style>
  :root { \(variables(PALETTE_DARK)) }
  @media (prefers-color-scheme: light) { :root { \(variables(PALETTE_LIGHT)) } }
  html, body { margin: 0; padding: 0; background: var(--ql-base); color: var(--ql-text); }
  .wrap {
    display: flex;
    font: 12px/1.5 'JetBrains Mono', 'SF Mono', Menlo, monospace;
    padding: 12px 0;
  }
  .gutter {
    flex: none;
    padding: 0 10px 0 14px;
    text-align: right;
    color: var(--ql-gutter);
    user-select: none;
    white-space: pre;
  }
  .code { flex: 1; padding-right: 14px; white-space: pre; overflow-x: auto; }
  .c { color: var(--ql-comment); font-style: italic; }
  .s { color: var(--ql-string); }
  .n { color: var(--ql-number); }
  .k { color: var(--ql-keyword); }
  .b { color: var(--ql-builtin); }
  .o { color: var(--ql-op); }
  </style></head>
  <body><div class="wrap"><div class="gutter">\(gutter)</div><div class="code">\(body)</div></div></body></html>
  """
}
