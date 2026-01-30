rootProject.name = "tracefield"

fun includeIfPresent(projectPath: String, projectDir: String) {
    if (file(projectDir).isDirectory) {
        include(projectPath)
    }
}

includeIfPresent(":service:core", "service/core")
includeIfPresent(":service:api", "service/api")
