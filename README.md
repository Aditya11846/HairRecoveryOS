# HairRecoveryOS

Personal React Native (CLI, RN 0.86) iOS app for tracking a hair-recovery protocol: daily check-ins, progress charts, crown photo comparison, research feed and an Ask Claude tab. Runs on an iPhone 17 Air.

## Setting up on a new Mac

You need a Mac. iOS apps can't be built on Windows or Linux.

1. Install the tools:
   - Xcode (App Store), then open it once and accept the license
   - Homebrew, then `brew install node watchman` (Node 22.11 or newer)
   - Ruby bundler for CocoaPods: `gem install bundler` if it's missing
2. Get the code and dependencies:
   ```sh
   git clone https://github.com/Aditya11846/HairRecoveryOS.git
   cd HairRecoveryOS
   npm install
   bundle install
   cd ios && bundle exec pod install && cd ..
   ```
3. Signing: open `ios/HairRecoveryOS.xcworkspace` (the workspace, not the .xcodeproj) in Xcode. Under the HairRecoveryOS target, Signing & Capabilities, sign in with your Apple ID and pick your team. The bundle id is `com.adityasingh.hairrecoveryos`.
4. Run:
   - Simulator: `npx react-native run-ios --simulator="iPhone 17"`
   - Your iPhone: plug it in, enable Developer Mode on the phone, pick it as the run target in Xcode and press Run. For a build that works without Metro running on the Mac, use Product, Scheme, Edit Scheme, Run, Build Configuration: Release.

With a free Apple ID the app installed on the phone expires after 7 days and has to be re-run from Xcode. A paid Apple Developer account lasts a year and allows TestFlight.

## Keys and data

- The Anthropic API key is not in the repo. It's entered in the app (Claude tab) and stored on the device in AsyncStorage under `api_key`.
- Check-ins are stored on the device (AsyncStorage) and synced to Supabase (`src/lib/supabase.js`), in the tables `checkins`, `insights`, `phase_reports`, `research_cache` and `custom_protocols`. A fresh install on the same phone keeps AsyncStorage only if the app wasn't deleted first.

## More docs

- `docs/DEV_WORKFLOW.md`: simulator commands, screenshot loop, check-in spoofing script
- `docs/DESIGN_GUIDELINES.md`: colours, type, component patterns
