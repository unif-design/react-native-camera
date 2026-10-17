import UIKit

public struct RCTDevMenuConfiguration {
  public let devMenuEnabled: Bool
  public let shakeGestureEnabled: Bool
  public let keyboardShortcutsEnabled: Bool
  public init(devMenuEnabled: Bool, shakeGestureEnabled: Bool, keyboardShortcutsEnabled: Bool) {
    self.devMenuEnabled = devMenuEnabled
    self.shakeGestureEnabled = shakeGestureEnabled
    self.keyboardShortcutsEnabled = keyboardShortcutsEnabled
  }
}
public enum RCTLinkingManager {
  public static func scene(_ scene: UIScene, openURLContexts contexts: Set<UIOpenURLContext>) {
    Boundary.record("react.urls", ["scene": scene, "contexts": contexts])
  }
  public static func scene(_ scene: UIScene, continue activity: NSUserActivity) {
    Boundary.record("react.activity", ["scene": scene, "activity": activity])
  }
}
public final class RCTBundleURLProvider {
  private static let instance = RCTBundleURLProvider()
  public static func sharedSettings() -> RCTBundleURLProvider { instance }
  public func jsBundleURL(forBundleRoot root: String) -> URL? {
    Boundary.record("metro.bundle", ["root": root])
    return Boundary.bundle
  }
}
