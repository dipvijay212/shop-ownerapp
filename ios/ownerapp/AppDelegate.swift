import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBootSplash
// Guarded so the project still compiles before `pod install` has pulled
// the Firebase pods in — the JS packages were in package.json long before
// the iOS side had any native Firebase at all.
#if canImport(FirebaseCore)
import FirebaseCore
#endif

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Firebase has to be configured before any JS runs, or
    // @react-native-firebase/messaging has no app to get a token from — which
    // is why iOS never registered a device token and never received a push,
    // while Android (wired through google-services.json + the Gradle plugin)
    // always did.
    //
    // Guarded on the plist: configure() traps if GoogleService-Info.plist is
    // missing, and that file carries real project credentials, so it is added
    // per checkout rather than committed. Without it the app launches exactly
    // as it does today and only push is unavailable — it does not crash.
    #if canImport(FirebaseCore)
    if FirebaseApp.app() == nil,
       Bundle.main.url(forResource: "GoogleService-Info", withExtension: "plist") != nil {
      FirebaseApp.configure()
    }
    #endif

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)

    factory.startReactNative(
      withModuleName: "ownerapp",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }

  override func customize(_ rootView: RCTRootView) {
    super.customize(rootView)
    RNBootSplash.initWithStoryboard("BootSplash", rootView: rootView)
  }
}
