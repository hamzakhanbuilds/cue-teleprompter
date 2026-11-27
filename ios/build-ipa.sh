#!/bin/sh
# Builds an unsigned Cue.ipa for sideloading (no Xcode iOS platform component needed).
set -e
cd "$(dirname "$0")"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
ICON=Cue/Assets.xcassets/AppIcon.appiconset/icon.png
rm -rf build; APP=build/Payload/Cue.app; mkdir -p "$APP"
xcrun -sdk iphoneos swiftc -O -swift-version 5 -target arm64-apple-ios16.0 -parse-as-library -module-name Cue Cue/*.swift -o "$APP/Cue"
sips -z 120 120 "$ICON" --out "$APP/AppIcon60x60@2x.png" >/dev/null
sips -z 180 180 "$ICON" --out "$APP/AppIcon60x60@3x.png" >/dev/null
python3 - <<'PY'
import plistlib
d={"CFBundleDevelopmentRegion":"en","CFBundleExecutable":"Cue","CFBundleIdentifier":"app.cue.teleprompter.ios",
"CFBundleInfoDictionaryVersion":"6.0","CFBundleName":"Cue","CFBundleDisplayName":"Cue","CFBundlePackageType":"APPL",
"CFBundleShortVersionString":"1.0","CFBundleVersion":"2","LSRequiresIPhoneOS":True,"MinimumOSVersion":"16.0","UIDeviceFamily":[1],
"CFBundleSupportedPlatforms":["iPhoneOS"],"DTPlatformName":"iphoneos","UILaunchScreen":{},"UIUserInterfaceStyle":"Dark",
"UIBackgroundModes":["audio"],"UIApplicationSceneManifest":{"UIApplicationSupportsMultipleScenes":False},
"UISupportedInterfaceOrientations":["UIInterfaceOrientationPortrait"],"UIRequiredDeviceCapabilities":["arm64"],
"CFBundleIcons":{"CFBundlePrimaryIcon":{"CFBundleIconFiles":["AppIcon60x60"],"CFBundleIconName":"AppIcon"}}}
plistlib.dump(d,open("build/Payload/Cue.app/Info.plist","wb"))
PY
(cd build && zip -qr Cue.ipa Payload)
echo "Built $(pwd)/build/Cue.ipa"
if [ -d "$HOME/Desktop/Cue" ]; then cp build/Cue.ipa "$HOME/Desktop/Cue/Cue-iPhone.ipa"; fi
