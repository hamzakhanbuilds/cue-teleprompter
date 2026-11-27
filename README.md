<p align="center">
  <img src="icons/icon-512.png" width="96" alt="Cue">
</p>

<h1 align="center">Cue</h1>
<p align="center">A floating teleprompter for iPhone.</p>

---

Cue comes in two versions.

| | Use it for | Keeps scrolling while you record on the same iPhone |
|---|---|---|
| **[iPhone app](#iphone-app)** | Recording | Yes (see the tested setup below) |
| **[Web version](https://khanhamzahk771-collab.github.io/cue-teleprompter/)** | Practice, or reading while another device records | No, iOS can stop it when recording starts |

## iPhone app

The app draws your script live in a call-style Picture-in-Picture window, so there is no video file for iOS to pause.

Tested on an iPhone 15 with iOS 27.0.1. Camera apps behave differently, so record a short test in the one you use.

### What you need

- A Mac with [Impactor](https://github.com/claration/impactor) installed
- An Apple ID (a free one works; a spare one is safer for any third-party tool)

### Install

1. Download **[Cue.ipa](https://github.com/khanhamzahk771-collab/cue-teleprompter/releases/latest/download/Cue.ipa)** from the [latest release](https://github.com/khanhamzahk771-collab/cue-teleprompter/releases/latest).
2. Connect your iPhone, open Impactor, add your Apple ID, then drag in `Cue.ipa` and install.
3. On the iPhone, trust your Apple ID under **Settings → General → VPN & Device Management**.
4. Turn on **Settings → Privacy & Security → Developer Mode** and restart.

With a free Apple ID the app stops opening after 7 days. Install it again to renew it.

The download is unsigned and comes with no warranty.

### Build it yourself

With Xcode installed:

```sh
cd ios
./build-ipa.sh
```

The app file appears at `ios/build/Cue.ipa`.

### Record with it

1. Paste your script. Set speed, text size and the start delay.
2. Tap **Start floating prompter**.
3. Swipe home, open your camera, drag the window near the front camera and press record.

Set everything before you start: the floating window has no speed or text controls. End any video call first, because iOS shows one floating window at a time.

## Web version

1. Open [the site](https://khanhamzahk771-collab.github.io/cue-teleprompter/) in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Paste a script, then use **Practice full-screen** or **Make floating prompter**.

## Privacy

Your script stays on your device. Neither version uploads it.
