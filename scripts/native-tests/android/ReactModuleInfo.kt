package com.facebook.react.module.model

data class ReactModuleInfo(val name: String, val className: String, val canOverrideExistingModule: Boolean, val needsEagerInit: Boolean, val isCxxModule: Boolean, val isTurboModule: Boolean)
fun interface ReactModuleInfoProvider { fun getReactModuleInfos(): Map<String, ReactModuleInfo> }
