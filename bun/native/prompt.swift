import AppKit

let arguments = CommandLine.arguments
let message = arguments.count > 1 ? arguments[1] : "Enter a value"
let initialValue = arguments.count > 2 ? arguments[2] : ""

NSApplication.shared.setActivationPolicy(.accessory)

let alert = NSAlert()
alert.messageText = message
alert.addButton(withTitle: "OK")
alert.addButton(withTitle: "Cancel")

let field = NSTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
field.stringValue = initialValue
alert.accessoryView = field
alert.window.initialFirstResponder = field

if alert.runModal() != .alertFirstButtonReturn { exit(1) }

print(field.stringValue)
