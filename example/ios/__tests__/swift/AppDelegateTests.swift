import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

private func require(_ value: @autoclosure () -> Bool, _ message: String) {
  guard value() else { fatalError(message) }
}

@_cdecl("camera_native_tests")
public func runTests() {
  let app = AppDelegate()
  require(app.application(UIApplication()), "launch with default options succeeds")
  require(app.application(UIApplication(), didFinishLaunchingWithOptions: [UIApplication.LaunchOptionsKey(): "value"]), "launch with options succeeds")
  let subject = SceneDelegate()
  let options = UIScene.ConnectionOptions()
  let session = UISceneSession()
  subject.scene(UIScene(), willConnectTo: session, options: options)
  require(subject.window == nil && subject.reactNativeFactory == nil && subject.dependencyProvider == nil,
          "non-window scenes do not initialize React Native")
  let scene = UIWindowScene()
  subject.scene(scene, willConnectTo: session, options: options)
  require(subject.window?.windowScene === scene, "window belongs to supplied scene")
  require(subject.dependencyProvider is RCTAppDependencyProvider, "RN dependency provider is installed")
  require(subject.reactNativeFactory?.delegate === subject, "factory retains actual scene delegate")
  let starts = Boundary.events.filter { $0.0 == "react.start" }
  require(starts.count == 1, "only the window scene starts RN")
  require(starts[0].1["name"] as? String == "ReactNativeCameraExample", "JS module name is retained")
  require(starts[0].1["window"] as? UIWindow === subject.window, "RN starts in the actual window")
  require(starts[0].1["options"] as? UIScene.ConnectionOptions === options, "connection options retain identity")
  #if DEBUG
  require(subject.reactNativeFactory?.devMenuConfiguration?.devMenuEnabled == true, "debug dev menu is enabled")
  require(subject.reactNativeFactory?.devMenuConfiguration?.shakeGestureEnabled == true, "debug shake is enabled")
  require(subject.reactNativeFactory?.devMenuConfiguration?.keyboardShortcutsEnabled == true, "debug shortcuts are enabled")
  require(subject.bundleURL() == Boundary.bundle, "debug bundle uses Metro URL")
  Boundary.bundle = nil
  require(subject.bundleURL() == nil, "missing Metro URL is forwarded")
  require(Boundary.events.filter { $0.0 == "metro.bundle" }.allSatisfy { $0.1["root"] as? String == "index" }, "Metro uses index entry")
  #else
  require(subject.reactNativeFactory?.devMenuConfiguration == nil, "release leaves debug menu unset")
  require(subject.bundleURL() == Bundle.main.url(forResource: "main", withExtension: "jsbundle"), "release reads actual bundle resource")
  #endif
  for contexts in [Set<UIOpenURLContext>(), Set([UIOpenURLContext(url: URL(string: "camera://example")!)])] {
    subject.scene(scene, openURLContexts: contexts)
    let last = Boundary.events.last!
    require(last.0 == "react.urls", "URL event is delivered")
    require(last.1["scene"] as? UIScene === scene, "URL scene identity is retained")
    require(last.1["contexts"] as? Set<UIOpenURLContext> == contexts, "all URL contexts are retained")
  }
  let activity = NSUserActivity(activityType: "NSUserActivityTypeBrowsingWeb")
  subject.scene(scene, continue: activity)
  require(Boundary.events.last!.0 == "react.activity", "universal link is delivered")
  require(Boundary.events.last!.1["activity"] as? NSUserActivity === activity, "activity identity is retained")
  require(Boundary.events.last!.1["scene"] as? UIScene === scene, "activity scene identity is retained")
  print("Camera iOS host assertions passed")
}
