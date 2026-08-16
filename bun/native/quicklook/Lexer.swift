import Foundation

// a scanner for the dsl

enum TokenKind {
  case comment, string, number, keyword, builtin, ident, op, plain
}

struct Token {
  let kind: TokenKind
  let text: String
}

func tokenize(_ source: String) -> [Token] {
  var tokens: [Token] = []
  let chars = Array(source)
  var i = 0

  func isIdentStart(_ c: Character) -> Bool { c.isLetter || c == "_" }
  func isIdentPart(_ c: Character) -> Bool { c.isLetter || c.isNumber || c == "_" }

  func append(_ kind: TokenKind, _ text: String) {
    if let last = tokens.last, last.kind == kind {
      tokens[tokens.count - 1] = Token(kind: kind, text: last.text + text)
    } else {
      tokens.append(Token(kind: kind, text: text))
    }
  }

  while i < chars.count {
    let c = chars[i]

    // line comment
    if c == "/" && i + 1 < chars.count && chars[i + 1] == "/" {
      var j = i
      while j < chars.count && chars[j] != "\n" { j += 1 }
      append(.comment, String(chars[i..<j]))
      i = j
      continue
    }

    // string, unterminated at end of line so a half typed line still previews
    if c == "\"" {
      var j = i + 1
      while j < chars.count && chars[j] != "\"" && chars[j] != "\n" {
        if chars[j] == "\\" && j + 1 < chars.count { j += 1 }
        j += 1
      }
      if j < chars.count && chars[j] == "\"" { j += 1 }
      append(.string, String(chars[i..<j]))
      i = j
      continue
    }

    // number, with a decimal part and scientific notation
    if c.isNumber || (c == "." && i + 1 < chars.count && chars[i + 1].isNumber) {
      var j = i
      while j < chars.count && (chars[j].isNumber || chars[j] == ".") { j += 1 }
      if j < chars.count && (chars[j] == "e" || chars[j] == "E") {
        var k = j + 1
        if k < chars.count && (chars[k] == "+" || chars[k] == "-") { k += 1 }
        if k < chars.count && chars[k].isNumber {
          while k < chars.count && chars[k].isNumber { k += 1 }
          j = k
        }
      }
      append(.number, String(chars[i..<j]))
      i = j
      continue
    }

    // identifier, keyword or builtin call
    if isIdentStart(c) {
      var j = i
      while j < chars.count && isIdentPart(chars[j]) { j += 1 }
      let word = String(chars[i..<j])
      let kind: TokenKind
      if KEYWORDS.contains(word) {
        kind = .keyword
      } else if BUILTINS.contains(word) {
        kind = .builtin
      } else {
        kind = .ident
      }
      append(kind, word)
      i = j
      continue
    }

    if OPERATOR_CHARS.contains(c) {
      append(.op, String(c))
      i += 1
      continue
    }

    append(.plain, String(c))
    i += 1
  }

  return tokens
}

private let OPERATOR_CHARS: Set<Character> = [
  "+", "-", "*", "/", "^", "=", "<", ">", "!", "&", "|", ":", ",", ".",
  "(", ")", "[", "]", "{", "}",
]
