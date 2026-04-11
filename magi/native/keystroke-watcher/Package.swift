// swift-tools-version:5.7
import PackageDescription

let package = Package(
    name: "keystroke-watcher",
    platforms: [.macOS(.v12)],
    targets: [
        .executableTarget(
            name: "keystroke-watcher",
            path: "Sources"
        )
    ]
)
