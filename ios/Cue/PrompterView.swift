import UIKit

/// The scrolling script. Used both for the in-app preview and inside the floating window.
/// It is driven by a clock, so it never "plays a video" that iOS could pause.
final class PrompterView: UIView {
    private let textLabel = UILabel()
    private let marker = UILabel()
    private let countLabel = UILabel()
    private let progress = UIView()
    private let fade = CAGradientLayer()
    private let clip = UIView()

    var state = PrompterState() { didSet { setNeedsLayout() } }
    var onAttach: (() -> Void)?

    override func didMoveToWindow() {
        super.didMoveToWindow()
        guard window != nil, let onAttach else { return }
        DispatchQueue.main.async(execute: onAttach)
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .black
        clipsToBounds = true
        textLabel.numberOfLines = 0
        clip.addSubview(textLabel)
        fade.colors = [UIColor.clear.cgColor, UIColor.black.cgColor, UIColor.black.cgColor, UIColor.clear.cgColor]
        fade.locations = [0, 0.14, 0.72, 1]
        clip.layer.mask = fade
        addSubview(clip)
        marker.text = "▶"
        marker.textColor = UIColor(red: 1, green: 0.31, blue: 0.17, alpha: 1)
        marker.font = .systemFont(ofSize: 11)
        addSubview(marker)
        countLabel.textColor = .white
        countLabel.textAlignment = .center
        countLabel.font = .systemFont(ofSize: 72, weight: .bold)
        addSubview(countLabel)
        progress.backgroundColor = marker.textColor
        addSubview(progress)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func layoutSubviews() {
        super.layoutSubviews()
        clip.frame = bounds
        fade.frame = clip.bounds
        countLabel.frame = bounds
        render()
    }

    /// Called every frame by the controller.
    func render() {
        guard bounds.width > 40, bounds.height > 40 else { return }
        let size = state.fontSize * min(1, bounds.width / 300)
        let style = NSMutableParagraphStyle()
        style.alignment = .center
        style.lineSpacing = size * 0.12
        let key = "\(state.script.hashValue)|\(size)|\(bounds.width)"
        if textLabel.accessibilityIdentifier != key {
            textLabel.accessibilityIdentifier = key
            textLabel.attributedText = NSAttributedString(string: state.script, attributes: [
                .font: UIFont.systemFont(ofSize: size, weight: .semibold),
                .foregroundColor: UIColor.white,
                .paragraphStyle: style,
            ])
        }
        let width = bounds.width - 36
        let textHeight = textLabel.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude)).height
        let readY = bounds.height * 0.34
        let firstLine = size * 0.6
        let travel = max(0, textHeight - firstLine * 2)
        let words = max(1, state.script.split(whereSeparator: { $0.isWhitespace }).count)
        let duration = Double(words) / state.wpm * 60
        let lead = state.delay
        var t = state.elapsed()
        // After the last line, hold 4 s and go again so the next take needs no tapping.
        if state.loop { t = t.truncatingRemainder(dividingBy: lead + duration + 4) }
        let fraction = min(1, max(0, (t - lead) / duration))
        textLabel.frame = CGRect(x: 18, y: readY - firstLine - travel * fraction, width: width, height: textHeight)
        marker.sizeToFit()
        marker.center = CGPoint(x: 9, y: readY)
        let counting = state.playing && t < lead
        countLabel.isHidden = !counting
        countLabel.text = counting ? "\(Int(ceil(lead - t)))" : nil
        textLabel.alpha = counting ? 0.25 : 1
        progress.frame = CGRect(x: 0, y: bounds.height - 3, width: bounds.width * fraction, height: 3)
    }
}

struct PrompterState {
    var script = ""
    var wpm = 140.0
    var fontSize: CGFloat = 24
    var delay = 10.0            // seconds before the text starts to move
    var loop = true
    var playing = false
    var banked = 0.0            // seconds played before the current run
    var startedAt = 0.0         // CACurrentMediaTime of the current run

    func elapsed() -> Double { banked + (playing ? CACurrentMediaTime() - startedAt : 0) }
}
