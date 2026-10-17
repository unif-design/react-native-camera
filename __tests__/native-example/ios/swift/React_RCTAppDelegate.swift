import UIKit
import React

open class RCTDefaultReactNativeFactoryDelegate: NSObject {
  public var dependencyProvider: AnyObject?
  open func bundleURL() -> URL? { nil }
}
open class RCTReactNativeFactory: NSObject {
  public let delegate: RCTDefaultReactNativeFactoryDelegate
  public var devMenuConfiguration: RCTDevMenuConfiguration?
  public init(delegate: RCTDefaultReactNativeFactoryDelegate) { self.delegate = delegate }
  public func startReactNative(withModuleName name: String, in window: UIWindow?, connectionOptions: UIScene.ConnectionOptions) {
    Boundary.record("react.start", ["name": name, "window": window as Any, "options": connectionOptions])
  }
}
