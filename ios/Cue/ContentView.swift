import SwiftUI

let defaultScript = """
Hey! This is Cue, your floating teleprompter.

Paste your own script here, then tap Start floating prompter.

Open Instagram, Snapchat or the Camera, drag me next to your front camera, and just read.
"""

struct ContentView: View {
    @AppStorage("script") private var script = defaultScript
    @AppStorage("speed") private var speed = 140.0
    @AppStorage("size") private var size = 24.0
    @AppStorage("delay") private var delay = 10.0
    @AppStorage("loop") private var loop = true
    @StateObject private var pip = PrompterController()
    @FocusState private var editing: Bool
    @Environment(\.scenePhase) private var phase

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                HStack {
                    Text("Cue").font(.title3.weight(.bold))
                    Spacer()
                    Circle().fill(Palette.rec).frame(width: 7, height: 7)
                    Text("TELEPROMPTER").font(.system(size: 11, design: .monospaced)).foregroundStyle(Palette.muted)
                }
                Text("Read your lines.\nLook at the lens.")
                    .font(.system(size: 34, weight: .bold)).tracking(-1)

                // The floating window starts from this preview.
                PrompterPreview(controller: pip)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                Button {
                    editing = false
                    pip.toggle()
                } label: {
                    HStack(spacing: 9) {
                        Circle().fill(Palette.rec).frame(width: 9, height: 9)
                        Text(pip.floating ? "Close floating prompter" : "Start floating prompter").fontWeight(.semibold)
                    }
                    .frame(maxWidth: .infinity).padding(.vertical, 16)
                    .background(Palette.text).foregroundStyle(Palette.bg)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                if let message = pip.message {
                    Text(message).font(.system(size: 12, design: .monospaced)).foregroundStyle(Palette.muted)
                }
                HStack(spacing: 10) {
                    control(pip.playing ? "Pause" : "Play") { pip.playPause() }
                    control("Restart") { pip.restart() }
                }

                label("SCRIPT")
                TextEditor(text: $script)
                    .focused($editing)
                    .scrollContentBackground(.hidden)
                    .frame(height: 200).padding(10)
                    .background(Palette.surface).clipShape(RoundedRectangle(cornerRadius: 12))

                label("SPEED  ·  \(Int(speed)) WPM")
                Slider(value: $speed, in: 60...260, step: 5).tint(Palette.text)
                label("TEXT SIZE  ·  \(Int(size))")
                Slider(value: $size, in: 16...44, step: 1).tint(Palette.text)
                label("START SCROLLING AFTER  ·  \(Int(delay)) S")
                Slider(value: $delay, in: 3...30, step: 1).tint(Palette.text)
                Toggle("Repeat when finished", isOn: $loop).tint(Palette.rec)

                Text("Press Start, then swipe home and open your camera before the countdown ends. Drag the window under the front camera and pinch to resize.")
                    .font(.footnote).foregroundStyle(Palette.muted)
            }
            .padding(18)
        }
        .background(Palette.bg.ignoresSafeArea())
        .foregroundStyle(Palette.text)
        .scrollDismissesKeyboard(.interactively)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("Done") { editing = false } }
        }
        .onAppear(perform: apply)
        .onChange(of: script) { _ in apply() }
        .onChange(of: speed) { _ in apply() }
        .onChange(of: size) { _ in apply() }
        .onChange(of: delay) { _ in apply() }
        .onChange(of: loop) { _ in apply() }
    }

    private func apply() { pip.update(script: script, wpm: speed, size: size, delay: delay, loop: loop) }

    private func label(_ s: String) -> some View {
        Text(s).font(.system(size: 11, design: .monospaced)).tracking(1.5).foregroundStyle(Palette.muted)
    }

    private func control(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).frame(maxWidth: .infinity).padding(.vertical, 12)
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(Palette.text.opacity(0.16)))
        }
    }
}
