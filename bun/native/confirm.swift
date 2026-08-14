import AppKit

let arguments = CommandLine.arguments
let message = arguments.count > 1 ? arguments[1] : "Are you sure?"

NSApplication.shared.setActivationPolicy(.accessory)

let alert = NSAlert()
alert.messageText = message
alert.addButton(withTitle: "OK")
alert.addButton(withTitle: "Cancel")
alert.alertStyle = .warning

exit(alert.runModal() == .alertFirstButtonReturn ? 0 : 1)
