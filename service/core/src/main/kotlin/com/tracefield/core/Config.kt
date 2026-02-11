package com.tracefield.core

import com.tracefield.core.config.Config as CoreConfig

object Config {
    val settings = CoreConfig.settings

    fun initialize() {
        CoreConfig.initialize()
    }
}
