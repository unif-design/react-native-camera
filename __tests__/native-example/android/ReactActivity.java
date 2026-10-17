package com.facebook.react;
// Java retains the SDK's synthetic mainComponentName Kotlin property.
public abstract class ReactActivity {
  public abstract String getMainComponentName();
  public abstract ReactActivityDelegate createReactActivityDelegate();
}
