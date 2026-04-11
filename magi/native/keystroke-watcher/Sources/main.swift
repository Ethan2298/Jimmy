import Cocoa
import CoreGraphics

// MARK: - Global state

var globalEventTap: CFMachPort?
var lastEnterTime: CFAbsoluteTime = 0
let debounceInterval: CFAbsoluteTime = 0.3
var keystrokeBuffer = ""
var currentApp = ""
var currentBundleId = ""
let ownBundleIds: Set<String> = ["com.github.electron", "com.electron.project-magi"]

// MARK: - App tracking

func updateFrontmostApp() {
    guard let app = NSWorkspace.shared.frontmostApplication else { return }
    let newBundleId = app.bundleIdentifier ?? ""

    // If app changed, clear the buffer
    if newBundleId != currentBundleId {
        keystrokeBuffer = ""
    }

    currentApp = app.localizedName ?? "Unknown"
    currentBundleId = newBundleId
}

func isOwnApp() -> Bool {
    return ownBundleIds.contains(currentBundleId)
}

// MARK: - JSON output

func emit(app: String, text: String, bundleId: String) {
    let timestamp = ISO8601DateFormatter().string(from: Date())
    let truncated = text.count > 500 ? String(text.prefix(500)) : text

    let escaped = truncated
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
        .replacingOccurrences(of: "\n", with: "\\n")
        .replacingOccurrences(of: "\r", with: "\\r")
        .replacingOccurrences(of: "\t", with: "\\t")
    let appEscaped = app
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
    let bundleEscaped = bundleId
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")

    let json = "{\"app\":\"\(appEscaped)\",\"text\":\"\(escaped)\",\"bundleId\":\"\(bundleEscaped)\",\"timestamp\":\"\(timestamp)\"}"
    print(json)
    fflush(stdout)
}

// MARK: - Event tap callback

let eventTapCallback: CGEventTapCallBack = { proxy, type, event, userInfo in
    // Re-enable tap if macOS disabled it
    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = globalEventTap {
            CGEvent.tapEnable(tap: tap, enable: true)
        }
        return Unmanaged.passUnretained(event)
    }

    guard type == .keyDown else {
        return Unmanaged.passUnretained(event)
    }

    // Update frontmost app
    updateFrontmostApp()

    // Skip when Project Magi is active
    if isOwnApp() {
        return Unmanaged.passUnretained(event)
    }

    let keyCode = event.getIntegerValueField(.keyboardEventKeycode)
    let flags = event.flags

    // Enter = 36, numpad Enter = 76
    if keyCode == 36 || keyCode == 76 {
        // Skip Shift+Enter (newline)
        if flags.contains(.maskShift) {
            keystrokeBuffer += "\n"
            return Unmanaged.passUnretained(event)
        }

        // Debounce rapid Enter presses
        let now = CFAbsoluteTimeGetCurrent()
        if now - lastEnterTime < debounceInterval {
            return Unmanaged.passUnretained(event)
        }
        lastEnterTime = now

        let text = keystrokeBuffer.trimmingCharacters(in: .whitespacesAndNewlines)
        keystrokeBuffer = ""

        if !text.isEmpty {
            emit(app: currentApp, text: text, bundleId: currentBundleId)
        }

        return Unmanaged.passUnretained(event)
    }

    // Backspace = 51
    if keyCode == 51 {
        if !keystrokeBuffer.isEmpty {
            keystrokeBuffer.removeLast()
        }
        return Unmanaged.passUnretained(event)
    }

    // Skip modifier-only combos (Cmd+C, etc.) — allow Shift for uppercase
    let modifiersWithoutShift = flags.intersection([.maskCommand, .maskControl, .maskAlternate])
    if !modifiersWithoutShift.isEmpty {
        return Unmanaged.passUnretained(event)
    }

    // Tab = 48, Escape = 53 — clear buffer on these
    if keyCode == 48 || keyCode == 53 {
        keystrokeBuffer = ""
        return Unmanaged.passUnretained(event)
    }

    // Extract the character from the event
    var length: Int = 0
    var chars = [UniChar](repeating: 0, count: 4)
    event.keyboardGetUnicodeString(maxStringLength: 4, actualStringLength: &length, unicodeString: &chars)

    if length > 0 {
        let str = String(utf16CodeUnits: chars, count: Int(length))
        // Only buffer printable characters
        for scalar in str.unicodeScalars {
            if scalar.properties.isAlphabetic ||
               scalar.properties.isWhitespace ||
               CharacterSet.punctuationCharacters.contains(scalar) ||
               CharacterSet.symbols.contains(scalar) ||
               CharacterSet.decimalDigits.contains(scalar) {
                keystrokeBuffer.append(Character(scalar))
            }
        }
    }

    return Unmanaged.passUnretained(event)
}

// MARK: - Main

let eventMask: CGEventMask = (1 << CGEventType.keyDown.rawValue)

guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .listenOnly,
    eventsOfInterest: eventMask,
    callback: eventTapCallback,
    userInfo: nil
) else {
    fputs("Error: Could not create event tap. Is Accessibility permission granted?\n", stderr)
    exit(1)
}

globalEventTap = tap

let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

// Health check
Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { _ in
    if let tap = globalEventTap, !CGEvent.tapIsEnabled(tap: tap) {
        CGEvent.tapEnable(tap: tap, enable: true)
    }
}

fputs("keystroke-watcher: listening\n", stderr)
CFRunLoopRun()
