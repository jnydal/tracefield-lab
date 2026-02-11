package com.tracefield.core.config

import com.tracefield.core.loadSettings
import com.tracefield.core.Settings

object Config {
    val settings: Settings = loadSettings()
    
    fun initialize() {
        // Initialize database
        com.tracefield.core.DatabaseManager.initialize(settings.pgDsn)
    }
}
