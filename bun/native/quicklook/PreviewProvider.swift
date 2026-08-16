import Foundation
import QuickLookUI
import UniformTypeIdentifiers

// apple preview
private let MAX_PREVIEW_BYTES = 512 * 1024

@available(macOS 12.0, *)
final class DsmxPreviewProvider: QLPreviewProvider, QLPreviewingController {
  func providePreview(for request: QLFilePreviewRequest) async throws -> QLPreviewReply {
    let url = request.fileURL
    let title = url.lastPathComponent

    return QLPreviewReply(
      dataOfContentType: .html,
      contentSize: CGSize(width: 800, height: 600)
    ) { _ in
      let handle = try FileHandle(forReadingFrom: url)
      defer { try? handle.close() }

      let data = try handle.read(upToCount: MAX_PREVIEW_BYTES) ?? Data()
      var source = String(data: data, encoding: .utf8)
        ?? String(decoding: data, as: UTF8.self)

      if data.count == MAX_PREVIEW_BYTES {
        source += "\n\n// preview truncated\n"
      }

      return Data(previewHTML(source: source, title: title).utf8)
    }
  }
}
