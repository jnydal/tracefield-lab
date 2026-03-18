package com.tracefield.api.storage

import aws.sdk.kotlin.services.s3.S3Client
import aws.sdk.kotlin.services.s3.model.BucketCannedAcl
import aws.sdk.kotlin.services.s3.model.CreateBucketRequest
import aws.sdk.kotlin.services.s3.model.GetObjectRequest
import aws.sdk.kotlin.services.s3.model.HeadBucketRequest
import aws.sdk.kotlin.services.s3.model.PutObjectRequest
import aws.sdk.kotlin.runtime.auth.credentials.StaticCredentialsProvider
import aws.smithy.kotlin.runtime.auth.awscredentials.Credentials
import aws.smithy.kotlin.runtime.content.ByteStream
import aws.smithy.kotlin.runtime.content.toByteArray
import aws.smithy.kotlin.runtime.net.url.Url
import com.tracefield.core.Config
import kotlinx.coroutines.runBlocking
import org.slf4j.LoggerFactory
import java.security.MessageDigest
import java.time.Instant

private val s3Log = LoggerFactory.getLogger("com.tracefield.api.storage.S3Storage")

class S3Storage(
    private val bucket: String,
    private val endpoint: String?,
    private val accessKey: String?,
    private val secretKey: String?
) {
    private val s3Client = S3Client {
        endpoint?.let {
            endpointUrl = Url.parse(it)
        }
        forcePathStyle = true
        accessKey?.let {
            credentialsProvider = StaticCredentialsProvider(
                Credentials(it, secretKey ?: "")
            )
        }
        region = "us-east-1" // MinIO ignores but SDK requires
    }

    fun ensureBucket() {
        runBlocking {
            try {
                s3Client.headBucket(HeadBucketRequest {
                    bucket = this@S3Storage.bucket
                })
            } catch (e: Exception) {
                s3Client.createBucket(CreateBucketRequest {
                    bucket = this@S3Storage.bucket
                    acl = BucketCannedAcl.Private
                })
            }
        }
    }

    fun putBytes(namespace: String, content: ByteArray, contentType: String = "application/xml"): String {
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(content)
            .take(16)
            .joinToString("") { "%02x".format(it) }
        
        val timestamp = Instant.now().toEpochMilli()
        val key = "$namespace/$hash-$timestamp.xml"
        
        runBlocking {
            s3Client.putObject(PutObjectRequest {
                bucket = this@S3Storage.bucket
                this.key = key
                body = ByteStream.fromBytes(content)
                this.contentType = contentType
            })
        }
        
        return "s3://$bucket/$key"
    }

    fun putFile(
        namespace: String,
        content: ByteArray,
        filename: String?,
        contentType: String?
    ): String {
        val ext = when {
            filename != null && "." in filename -> filename.substringAfterLast('.', "").take(8)
            contentType != null && "csv" in contentType.lowercase() -> "csv"
            contentType != null && "json" in contentType.lowercase() -> "json"
            else -> "bin"
        }.ifEmpty { "bin" }
        val hash = MessageDigest.getInstance("SHA-256")
            .digest(content)
            .take(16)
            .joinToString("") { "%02x".format(it) }
        val timestamp = Instant.now().toEpochMilli()
        val key = "$namespace/$hash-$timestamp.$ext"
        val ct = contentType ?: when (ext) {
            "csv" -> "text/csv"
            "json" -> "application/json"
            else -> "application/octet-stream"
        }
        runBlocking {
            s3Client.putObject(PutObjectRequest {
                bucket = this@S3Storage.bucket
                this.key = key
                body = ByteStream.fromBytes(content)
                this.contentType = ct
            })
        }
        return "s3://$bucket/$key"
    }

    /**
     * Read an object from storage by its URI (e.g. s3://bucket/key).
     * Returns null if the URI does not refer to this bucket or the object does not exist.
     */
    fun getFile(objectUri: String): ByteArray? {
        if (!objectUri.startsWith("s3://")) return null
        val path = objectUri.removePrefix("s3://")
        val slash = path.indexOf('/')
        if (slash <= 0) return null
        val uriBucket = path.substring(0, slash)
        val key = path.substring(slash + 1)
        if (uriBucket != bucket || key.isBlank()) return null
        return runBlocking {
            try {
                s3Client.getObject(GetObjectRequest {
                    bucket = this@S3Storage.bucket
                    this.key = key
                }) { resp ->
                    resp.body?.toByteArray()
                }
            } catch (e: Exception) {
                s3Log.warn("getObject failed bucket={} key_prefix={}… : {}", bucket, key.take(48), e.message)
                null
            }
        }
    }
}

fun createS3Storage(): S3Storage {
    val settings = Config.settings
    return S3Storage(
        bucket = settings.s3Bucket,
        endpoint = settings.s3Endpoint,
        accessKey = settings.s3AccessKey,
        secretKey = settings.s3SecretKey
    )
}
