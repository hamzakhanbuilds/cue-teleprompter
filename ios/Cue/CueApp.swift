import SwiftUI

@main
struct CueApp: App {
    var body: some Scene {
        WindowGroup { ContentView().preferredColorScheme(.dark) }
    }
}

enum Palette {
    static let bg = Color(red: 0.047, green: 0.047, blue: 0.043)
    static let surface = Color(red: 0.078, green: 0.078, blue: 0.075)
    static let text = Color(red: 0.949, green: 0.937, blue: 0.910)
    static let muted = Color(red: 0.553, green: 0.537, blue: 0.498)
    static let rec = Color(red: 1.0, green: 0.31, blue: 0.17)
}
