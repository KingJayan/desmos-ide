import AppKit

let arguments = CommandLine.arguments
let prompt = arguments.count > 1 ? arguments[1] : "Save"
let defaultName = arguments.count > 2 ? arguments[2] : "Untitled"

NSApplication.shared.setActivationPolicy(.accessory)

let panel = NSSavePanel()
panel.message = prompt
panel.nameFieldStringValue = defaultName
panel.canCreateDirectories = true

if panel.runModal() == .OK, let url = panel.url {
  print(url.path)
  exit(0)
} else {
  exit(1)
}
