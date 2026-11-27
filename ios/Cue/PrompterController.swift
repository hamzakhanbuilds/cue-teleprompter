import AVKit
import SwiftUI
import UIKit

/// Owns the floating window. Uses the call-style Picture-in-Picture (iOS 15+), whose content is a
/// live view we draw ourselves, instead of a video file.
final class PrompterController: NSObject, ObservableObject, AVPictureInPictureControllerDelegate {
    @Published var floating = false
    @Published var playing = false
    @Published var message: String?

    let preview = PrompterView()
    private let floatingView = PrompterView()
    private var state = PrompterState()
    private var pip: AVPictureInPictureController?
    private let content = AVPictureInPictureVideoCallViewController()
    // A dispatch timer, not a display link: display links stop while the app is in the background.
    private var timer: DispatchSourceTimer?
    private var silence: AVAudioPlayer?

    override init() {
        super.init()
        content.preferredContentSize = CGSize(width: 1080, height: 720)
        content.view.backgroundColor = .black
        floatingView.frame = content.view.bounds
        floatingView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        content.view.addSubview(floatingView)
        content.view.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped)))
        preview.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped)))
        preview.onAttach = { [weak self] in self?.attach() }
        let timer = DispatchSource.makeTimerSource(queue: .main)
        timer.schedule(deadline: .now(), repeating: .milliseconds(16), leeway: .milliseconds(2))
        timer.setEventHandler { [weak self] in self?.tick() }
        timer.resume()
        self.timer = timer
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted(_:)),
                                               name: AVAudioSession.interruptionNotification, object: nil)
    }

    /// Mixes with other apps so the camera keeps the microphone. A silent loop keeps Cue running
    /// in the background while the floating window is up.
    private func keepAwake() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .moviePlayback, options: [.mixWithOthers])
        try? session.setActive(true)
        if silence == nil {
            silence = try? AVAudioPlayer(data: Self.silentWav())
            silence?.numberOfLoops = -1
        }
        silence?.play()
    }

    @objc private func interrupted(_ note: Notification) {
        guard floating else { return }
        // A camera starting to record can interrupt us; take the (mixable) session straight back.
        for delay in [0.1, 0.8, 2.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self, self.floating else { return }
                self.keepAwake()
            }
        }
    }

    private static func silentWav() -> Data {
        let samples = 8000, bytes = samples * 2
        var d = Data()
        func str(_ s: String) { d.append(contentsOf: s.utf8) }
        func u32(_ v: Int) { withUnsafeBytes(of: UInt32(v).littleEndian) { d.append(contentsOf: $0) } }
        func u16(_ v: Int) { withUnsafeBytes(of: UInt16(v).littleEndian) { d.append(contentsOf: $0) } }
        str("RIFF"); u32(36 + bytes); str("WAVE"); str("fmt "); u32(16); u16(1); u16(1)
        u32(8000); u32(16000); u16(2); u16(16); str("data"); u32(bytes)
        d.append(Data(count: bytes))
        return d
    }

    func attach() {
        guard pip == nil, preview.window != nil else { return }
        guard AVPictureInPictureController.isPictureInPictureSupported() else {
            message = "This iPhone doesn't allow Picture-in-Picture."
            return
        }
        keepAwake()
        let source = AVPictureInPictureController.ContentSource(activeVideoCallSourceView: preview, contentViewController: content)
        let controller = AVPictureInPictureController(contentSource: source)
        controller.delegate = self
        controller.canStartPictureInPictureAutomaticallyFromInline = true
        pip = controller
    }

    func update(script: String, wpm: Double, size: Double, delay: Double, loop: Bool) {
        if script != state.script { state.banked = 0; if state.playing { state.startedAt = CACurrentMediaTime() } }
        state.script = script
        state.wpm = wpm
        state.fontSize = CGFloat(size)
        state.delay = delay
        state.loop = loop
        push()
    }

    func toggle() {
        attach()
        guard let pip else { return }
        if pip.isPictureInPictureActive {
            pip.stopPictureInPicture()
        } else {
            keepAwake()
            restart()
            start(pip, attempts: 10)
        }
    }

    /// Right after setup iOS can need a moment before the window is allowed to float.
    private func start(_ pip: AVPictureInPictureController, attempts: Int) {
        if pip.isPictureInPicturePossible { pip.startPictureInPicture(); return }
        guard attempts > 0 else { message = "iOS isn't ready to float yet. Tap Start again."; return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.start(pip, attempts: attempts - 1)
        }
    }

    func playPause() {
        if state.playing { state.banked = state.elapsed(); state.playing = false }
        else { state.startedAt = CACurrentMediaTime(); state.playing = true }
        playing = state.playing
        push()
    }

    func restart() {
        state.banked = 0
        state.startedAt = CACurrentMediaTime()
        state.playing = true
        playing = true
        push()
    }

    @objc private func tapped() { playPause() }

    private func push() {
        preview.state = state
        floatingView.state = state
    }

    private func tick() {
        guard state.playing else { return }
        preview.render()
        floatingView.render()
    }

    // MARK: delegate
    func pictureInPictureControllerDidStartPictureInPicture(_ c: AVPictureInPictureController) {
        floating = true
        message = "Floating. Open your camera app now."
    }
    func pictureInPictureControllerDidStopPictureInPicture(_ c: AVPictureInPictureController) {
        floating = false
        message = nil
        silence?.pause()
    }
    func pictureInPictureController(_ c: AVPictureInPictureController, failedToStartPictureInPictureWithError error: Error) {
        message = "Couldn't float: \(error.localizedDescription)"
    }
}

struct PrompterPreview: UIViewRepresentable {
    let controller: PrompterController
    func makeUIView(context: Context) -> PrompterView { controller.preview }
    func updateUIView(_ view: PrompterView, context: Context) {
        DispatchQueue.main.async { controller.attach() }
    }
}
