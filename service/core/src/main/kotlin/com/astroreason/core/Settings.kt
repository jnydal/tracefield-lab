package com.tracefield.core

import kotlinx.serialization.Serializable

@Serializable
data class Settings(
    val appName: String = "tracefield",
    val appEnv: String = System.getenv("APP_ENV") ?: "dev",
    val logLevel: String = System.getenv("LOG_LEVEL") ?: "INFO",
    
    // Postgres
    val pgDsn: String = System.getenv("PG_DSN") 
        ?: System.getenv("DATABASE_URL")
        ?: throw IllegalArgumentException("PG_DSN or DATABASE_URL must be set"),
    
    // Kafka
    val kafkaBootstrapServers: String = System.getenv("KAFKA_BOOTSTRAP_SERVERS") ?: "kafka:9092",
    
    // MinIO / S3
    val s3Endpoint: String? = System.getenv("MINIO_ENDPOINT") ?: System.getenv("S3_ENDPOINT"),
    val s3AccessKey: String? = System.getenv("MINIO_ACCESS_KEY") ?: System.getenv("S3_ACCESS_KEY"),
    val s3SecretKey: String? = System.getenv("MINIO_SECRET_KEY") ?: System.getenv("S3_SECRET_KEY"),
    val s3Bucket: String = System.getenv("MINIO_BUCKET_RAW") ?: System.getenv("S3_BUCKET") ?: "tracefield",
    val s3UseSsl: Boolean = System.getenv("S3_USE_SSL")?.toBoolean() ?: false,
    
    // LLM / Embeddings
    val ollamaUrl: String? = System.getenv("OLLAMA_URL"),
    val llmModel: String = System.getenv("LLM_MODEL") ?: "qwen2.5:7b-instruct-q4_K_M",
    val embeddingsModel: String = System.getenv("EMBEDDINGS_MODEL") ?: "BAAI/bge-large-en-v1.5",
    
    // Wikipedia
    val wikiLangDefault: String = System.getenv("WIKI_LANG_DEFAULT") ?: "en",
    
    // Auth / OAuth
    val googleClientId: String = System.getenv("GOOGLE_CLIENT_ID") ?: "placeholder-client-id",
    val googleClientSecret: String = System.getenv("GOOGLE_CLIENT_SECRET") ?: "placeholder-client-secret",
    val googleRedirectUri: String = System.getenv("GOOGLE_REDIRECT_URI") ?: "http://localhost:8000/auth/google/callback",
    val authStateSecret: String = System.getenv("AUTH_STATE_SECRET") ?: "dev-state-secret",
    val authSessionTtlHours: Long = System.getenv("AUTH_SESSION_TTL_HOURS")?.toLongOrNull() ?: 24,
    val authCookieName: String = System.getenv("AUTH_COOKIE_NAME") ?: "tracefield_session",
    val authCookieSecure: Boolean = System.getenv("AUTH_COOKIE_SECURE")?.toBoolean() ?: false,
    val authCookieDomain: String? = System.getenv("AUTH_COOKIE_DOMAIN"),
    val authCookieSameSite: String = System.getenv("AUTH_COOKIE_SAMESITE") ?: "lax"
)

fun loadSettings(): Settings = Settings()
