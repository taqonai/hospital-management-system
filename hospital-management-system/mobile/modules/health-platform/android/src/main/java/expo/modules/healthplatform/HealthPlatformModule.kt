package expo.modules.healthplatform

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset
import kotlin.reflect.KClass

/**
 * Health Platform Module for A'mad Precision Health
 *
 * Provides native integration with Google Health Connect on Android.
 * Supports reading health metrics, workouts, and sleep data.
 *
 * Requirements:
 * - Android API level 28+ (Android 9+)
 * - Health Connect app installed
 * - User consent for data access
 */
class HealthPlatformModule : Module() {
    private var healthConnectClient: HealthConnectClient? = null
    private val coroutineScope = CoroutineScope(Dispatchers.Main)

    override fun definition() = ModuleDefinition {
        Name("HealthPlatformModule")

        OnCreate {
            initializeClient()
        }

        // ==================== AVAILABILITY & STATUS ====================

        /**
         * Check if Health Connect is available on this device
         */
        AsyncFunction("isAvailable") { promise: Promise ->
            try {
                val status = HealthConnectClient.getSdkStatus(context)
                val isAvailable = status == HealthConnectClient.SDK_AVAILABLE
                promise.resolve(isAvailable)
            } catch (e: Exception) {
                promise.resolve(false)
            }
        }

        /**
         * Get Health Connect SDK status
         * Returns: "available", "unavailable", "not_installed", "not_supported"
         */
        AsyncFunction("getSdkStatus") { promise: Promise ->
            try {
                val status = when (HealthConnectClient.getSdkStatus(context)) {
                    HealthConnectClient.SDK_AVAILABLE -> "available"
                    HealthConnectClient.SDK_UNAVAILABLE -> "unavailable"
                    HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "not_installed"
                    else -> "not_supported"
                }
                promise.resolve(status)
            } catch (e: Exception) {
                promise.resolve("not_supported")
            }
        }

        /**
         * Open Health Connect app to manage permissions
         */
        AsyncFunction("openHealthConnectSettings") { promise: Promise ->
            try {
                // Try to open Health Connect app directly
                val intent = Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS")
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try {
                    context.startActivity(intent)
                    promise.resolve(true)
                } catch (e: Exception) {
                    // If Health Connect is not installed, open Play Store
                    val playStoreIntent = Intent(Intent.ACTION_VIEW).apply {
                        data = Uri.parse("market://details?id=com.google.android.apps.healthdata")
                        setPackage("com.android.vending")
                    }
                    playStoreIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    context.startActivity(playStoreIntent)
                    promise.resolve(true)
                }
            } catch (e: Exception) {
                promise.reject(CodedException("OPEN_FAILED", e.message, e))
            }
        }

        /**
         * Open Play Store to install Health Connect
         */
        AsyncFunction("openHealthConnectPlayStore") { promise: Promise ->
            try {
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    data = Uri.parse("market://details?id=com.google.android.apps.healthdata")
                    setPackage("com.android.vending")
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject(CodedException("OPEN_FAILED", e.message, e))
            }
        }

        /**
         * Launch the Health Connect permissions request activity
         * This uses the proper Activity Result API to register with Health Connect
         */
        AsyncFunction("requestPermissionsActivity") { promise: Promise ->
            try {
                val intent = Intent(context, HealthPermissionsActivity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject(CodedException("LAUNCH_FAILED", e.message, e))
            }
        }

        // ==================== AUTHORIZATION ====================

        /**
         * Request authorization for specified health data types
         * @param dataTypes Array of data type strings (e.g., ["STEPS", "HEART_RATE"])
         */
        AsyncFunction("requestAuthorization") { dataTypes: List<String>, promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(mapOf(
                            "granted" to false,
                            "error" to "Health Connect not available. Please install Health Connect from the Play Store."
                        ))
                        return@launch
                    }

                    // Map data types to permissions
                    val permissions = dataTypes.mapNotNull { dataType ->
                        mapToReadPermission(dataType)
                    }.toSet()

                    if (permissions.isEmpty()) {
                        promise.resolve(mapOf(
                            "granted" to false,
                            "error" to "No valid data types specified"
                        ))
                        return@launch
                    }

                    // Check current permissions
                    val grantedPermissions = client.permissionController.getGrantedPermissions()
                    val allGranted = permissions.all { it in grantedPermissions }

                    if (allGranted) {
                        promise.resolve(mapOf(
                            "granted" to true,
                            "permissions" to dataTypes.map { mapOf("dataType" to it, "read" to true, "write" to false) }
                        ))
                    } else {
                        // Launch the permissions activity to request permissions
                        try {
                            val intent = Intent(context, HealthPermissionsActivity::class.java)
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            context.startActivity(intent)
                        } catch (e: Exception) {
                            // Fallback to opening Health Connect settings
                            try {
                                val settingsIntent = Intent("androidx.health.ACTION_HEALTH_CONNECT_SETTINGS")
                                settingsIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                context.startActivity(settingsIntent)
                            } catch (e2: Exception) {
                                // Ignore if can't open
                            }
                        }

                        // Return that permissions are needed
                        promise.resolve(mapOf(
                            "granted" to false,
                            "needsPermission" to true,
                            "error" to "Please grant permissions in the dialog that appeared, then try syncing again."
                        ))
                    }
                } catch (e: Exception) {
                    promise.resolve(mapOf(
                        "granted" to false,
                        "error" to (e.message ?: "Unknown error")
                    ))
                }
            }
        }

        /**
         * Get currently granted permissions
         */
        AsyncFunction("getGrantedPermissions") { promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(emptyList<Map<String, Any>>())
                        return@launch
                    }

                    val grantedPermissions = client.permissionController.getGrantedPermissions()
                    val result = grantedPermissions.map { permission ->
                        val dataType = mapPermissionToDataType(permission)
                        mapOf(
                            "permission" to permission.toString(),
                            "dataType" to (dataType ?: "UNKNOWN"),
                            "read" to permission.toString().contains("READ"),
                            "write" to permission.toString().contains("WRITE")
                        )
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.resolve(emptyList<Map<String, Any>>())
                }
            }
        }

        // ==================== READ HEALTH DATA ====================

        /**
         * Read health records for a specific data type
         * @param dataType Type of data (e.g., "STEPS", "HEART_RATE")
         * @param startTime ISO 8601 start time
         * @param endTime ISO 8601 end time
         */
        AsyncFunction("readRecords") { dataType: String, startTime: String, endTime: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(emptyList<Map<String, Any>>())
                        return@launch
                    }

                    val start = Instant.parse(startTime)
                    val end = Instant.parse(endTime)
                    val timeRange = TimeRangeFilter.between(start, end)

                    val records = when (dataType) {
                        "STEPS" -> readStepsRecords(client, timeRange)
                        "HEART_RATE" -> readHeartRateRecords(client, timeRange)
                        "HEART_RATE_RESTING" -> readRestingHeartRateRecords(client, timeRange)
                        "BLOOD_OXYGEN" -> readBloodOxygenRecords(client, timeRange)
                        "BLOOD_PRESSURE" -> readBloodPressureRecords(client, timeRange)
                        "BLOOD_GLUCOSE" -> readBloodGlucoseRecords(client, timeRange)
                        "WEIGHT" -> readWeightRecords(client, timeRange)
                        "BODY_TEMPERATURE" -> readBodyTemperatureRecords(client, timeRange)
                        "CALORIES_BURNED" -> readCaloriesRecords(client, timeRange)
                        "DISTANCE" -> readDistanceRecords(client, timeRange)
                        "RESPIRATORY_RATE" -> readRespiratoryRateRecords(client, timeRange)
                        "HRV" -> readHrvRecords(client, timeRange)
                        else -> emptyList()
                    }

                    promise.resolve(records)
                } catch (e: Exception) {
                    promise.reject(CodedException("READ_ERROR", e.message, e))
                }
            }
        }

        /**
         * Read exercise/workout sessions
         */
        AsyncFunction("readExerciseSessions") { startTime: String, endTime: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(emptyList<Map<String, Any>>())
                        return@launch
                    }

                    val start = Instant.parse(startTime)
                    val end = Instant.parse(endTime)
                    val timeRange = TimeRangeFilter.between(start, end)

                    val request = ReadRecordsRequest(
                        recordType = ExerciseSessionRecord::class,
                        timeRangeFilter = timeRange
                    )
                    val response = client.readRecords(request)

                    val sessions = response.records.map { session ->
                        mapOf(
                            "id" to session.metadata.id,
                            "workoutType" to mapExerciseType(session.exerciseType),
                            "startTime" to session.startTime.toString(),
                            "endTime" to session.endTime.toString(),
                            "duration" to ((session.endTime.epochSecond - session.startTime.epochSecond) / 60),
                            "title" to (session.title ?: ""),
                            "notes" to (session.notes ?: "")
                        )
                    }
                    promise.resolve(sessions)
                } catch (e: Exception) {
                    promise.reject(CodedException("READ_ERROR", e.message, e))
                }
            }
        }

        /**
         * Read sleep sessions
         */
        AsyncFunction("readSleepSessions") { startTime: String, endTime: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(emptyList<Map<String, Any>>())
                        return@launch
                    }

                    val start = Instant.parse(startTime)
                    val end = Instant.parse(endTime)
                    val timeRange = TimeRangeFilter.between(start, end)

                    val request = ReadRecordsRequest(
                        recordType = SleepSessionRecord::class,
                        timeRangeFilter = timeRange
                    )
                    val response = client.readRecords(request)

                    val sessions = response.records.map { session ->
                        val stages = session.stages.map { stage ->
                            mapOf(
                                "stage" to mapSleepStage(stage.stage),
                                "startTime" to stage.startTime.toString(),
                                "endTime" to stage.endTime.toString()
                            )
                        }
                        mapOf(
                            "id" to session.metadata.id,
                            "startTime" to session.startTime.toString(),
                            "endTime" to session.endTime.toString(),
                            "duration" to ((session.endTime.epochSecond - session.startTime.epochSecond) / 60),
                            "stages" to stages,
                            "title" to (session.title ?: ""),
                            "notes" to (session.notes ?: "")
                        )
                    }
                    promise.resolve(sessions)
                } catch (e: Exception) {
                    promise.reject(CodedException("READ_ERROR", e.message, e))
                }
            }
        }

        /**
         * Aggregate data for a time range (e.g., total steps per day)
         */
        AsyncFunction("aggregateData") { dataType: String, startTime: String, endTime: String, promise: Promise ->
            coroutineScope.launch {
                try {
                    val client = healthConnectClient
                    if (client == null) {
                        promise.resolve(mapOf("total" to 0, "average" to 0, "min" to 0, "max" to 0))
                        return@launch
                    }

                    // For now, read all records and aggregate manually
                    val start = Instant.parse(startTime)
                    val end = Instant.parse(endTime)
                    val timeRange = TimeRangeFilter.between(start, end)

                    val records = when (dataType) {
                        "STEPS" -> readStepsRecords(client, timeRange)
                        "HEART_RATE" -> readHeartRateRecords(client, timeRange)
                        "CALORIES_BURNED" -> readCaloriesRecords(client, timeRange)
                        else -> emptyList()
                    }

                    val values = records.mapNotNull { (it["value"] as? Number)?.toDouble() }
                    val result = if (values.isNotEmpty()) {
                        mapOf(
                            "total" to values.sum(),
                            "average" to values.average(),
                            "min" to values.minOrNull(),
                            "max" to values.maxOrNull(),
                            "count" to values.size
                        )
                    } else {
                        mapOf("total" to 0, "average" to 0, "min" to 0, "max" to 0, "count" to 0)
                    }
                    promise.resolve(result)
                } catch (e: Exception) {
                    promise.reject(CodedException("AGGREGATE_ERROR", e.message, e))
                }
            }
        }
    }

    private val context: Context
        get() = requireNotNull(appContext.reactContext)

    private fun initializeClient() {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            if (status == HealthConnectClient.SDK_AVAILABLE) {
                healthConnectClient = HealthConnectClient.getOrCreate(context)
            }
        } catch (e: Exception) {
            // Health Connect not available
        }
    }

    // ==================== RECORD READERS ====================

    private suspend fun readStepsRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(StepsRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "STEPS",
                "value" to record.count,
                "unit" to "count",
                "timestamp" to record.startTime.toString(),
                "endTime" to record.endTime.toString()
            )
        }
    }

    private suspend fun readHeartRateRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(HeartRateRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.flatMap { record ->
            record.samples.map { sample ->
                mapOf(
                    "dataType" to "HEART_RATE",
                    "value" to sample.beatsPerMinute,
                    "unit" to "bpm",
                    "timestamp" to sample.time.toString()
                )
            }
        }
    }

    private suspend fun readRestingHeartRateRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(RestingHeartRateRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "HEART_RATE_RESTING",
                "value" to record.beatsPerMinute,
                "unit" to "bpm",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readBloodOxygenRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(OxygenSaturationRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "BLOOD_OXYGEN",
                "value" to record.percentage.value,
                "unit" to "%",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readBloodPressureRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(BloodPressureRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.flatMap { record ->
            listOf(
                mapOf(
                    "dataType" to "BLOOD_PRESSURE_SYSTOLIC",
                    "value" to record.systolic.inMillimetersOfMercury,
                    "unit" to "mmHg",
                    "timestamp" to record.time.toString()
                ),
                mapOf(
                    "dataType" to "BLOOD_PRESSURE_DIASTOLIC",
                    "value" to record.diastolic.inMillimetersOfMercury,
                    "unit" to "mmHg",
                    "timestamp" to record.time.toString()
                )
            )
        }
    }

    private suspend fun readBloodGlucoseRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(BloodGlucoseRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "BLOOD_GLUCOSE",
                "value" to record.level.inMilligramsPerDeciliter,
                "unit" to "mg/dL",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readWeightRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(WeightRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "WEIGHT",
                "value" to record.weight.inKilograms,
                "unit" to "kg",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readBodyTemperatureRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(BodyTemperatureRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "BODY_TEMPERATURE",
                "value" to record.temperature.inCelsius,
                "unit" to "°C",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readCaloriesRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(ActiveCaloriesBurnedRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "CALORIES_BURNED",
                "value" to record.energy.inKilocalories,
                "unit" to "kcal",
                "timestamp" to record.startTime.toString(),
                "endTime" to record.endTime.toString()
            )
        }
    }

    private suspend fun readDistanceRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(DistanceRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "DISTANCE",
                "value" to record.distance.inMeters,
                "unit" to "m",
                "timestamp" to record.startTime.toString(),
                "endTime" to record.endTime.toString()
            )
        }
    }

    private suspend fun readRespiratoryRateRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(RespiratoryRateRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "RESPIRATORY_RATE",
                "value" to record.rate,
                "unit" to "breaths/min",
                "timestamp" to record.time.toString()
            )
        }
    }

    private suspend fun readHrvRecords(client: HealthConnectClient, timeRange: TimeRangeFilter): List<Map<String, Any>> {
        val request = ReadRecordsRequest(HeartRateVariabilityRmssdRecord::class, timeRangeFilter = timeRange)
        val response = client.readRecords(request)
        return response.records.map { record ->
            mapOf(
                "dataType" to "HRV",
                "value" to record.heartRateVariabilityMillis,
                "unit" to "ms",
                "timestamp" to record.time.toString()
            )
        }
    }

    // ==================== HELPER METHODS ====================

    private fun mapToReadPermission(dataType: String): String? {
        return when (dataType) {
            "STEPS" -> HealthPermission.getReadPermission(StepsRecord::class)
            "HEART_RATE" -> HealthPermission.getReadPermission(HeartRateRecord::class)
            "HEART_RATE_RESTING" -> HealthPermission.getReadPermission(RestingHeartRateRecord::class)
            "BLOOD_OXYGEN" -> HealthPermission.getReadPermission(OxygenSaturationRecord::class)
            "BLOOD_PRESSURE" -> HealthPermission.getReadPermission(BloodPressureRecord::class)
            "BLOOD_GLUCOSE" -> HealthPermission.getReadPermission(BloodGlucoseRecord::class)
            "WEIGHT" -> HealthPermission.getReadPermission(WeightRecord::class)
            "BODY_TEMPERATURE" -> HealthPermission.getReadPermission(BodyTemperatureRecord::class)
            "CALORIES_BURNED" -> HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class)
            "DISTANCE" -> HealthPermission.getReadPermission(DistanceRecord::class)
            "RESPIRATORY_RATE" -> HealthPermission.getReadPermission(RespiratoryRateRecord::class)
            "HRV" -> HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class)
            "SLEEP_DURATION", "SLEEP_STAGE" -> HealthPermission.getReadPermission(SleepSessionRecord::class)
            "WORKOUT" -> HealthPermission.getReadPermission(ExerciseSessionRecord::class)
            else -> null
        }
    }

    private fun mapPermissionToDataType(permission: String): String? {
        return when {
            permission.contains("StepsRecord") -> "STEPS"
            permission.contains("HeartRateRecord") && !permission.contains("Resting") && !permission.contains("Variability") -> "HEART_RATE"
            permission.contains("RestingHeartRateRecord") -> "HEART_RATE_RESTING"
            permission.contains("OxygenSaturation") -> "BLOOD_OXYGEN"
            permission.contains("BloodPressure") -> "BLOOD_PRESSURE"
            permission.contains("BloodGlucose") -> "BLOOD_GLUCOSE"
            permission.contains("WeightRecord") -> "WEIGHT"
            permission.contains("BodyTemperature") -> "BODY_TEMPERATURE"
            permission.contains("ActiveCalories") -> "CALORIES_BURNED"
            permission.contains("DistanceRecord") -> "DISTANCE"
            permission.contains("RespiratoryRate") -> "RESPIRATORY_RATE"
            permission.contains("HeartRateVariability") -> "HRV"
            permission.contains("SleepSession") -> "SLEEP_DURATION"
            permission.contains("ExerciseSession") -> "WORKOUT"
            else -> null
        }
    }

    private fun mapExerciseType(type: Int): String {
        return when (type) {
            ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "WALKING"
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING -> "RUNNING"
            ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "RUNNING"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING -> "CYCLING"
            ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "CYCLING"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "SWIMMING"
            ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL -> "SWIMMING"
            ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIIT"
            ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING -> "STRENGTH_TRAINING"
            ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "STRENGTH_TRAINING"
            ExerciseSessionRecord.EXERCISE_TYPE_YOGA -> "YOGA"
            else -> "OTHER"
        }
    }

    private fun mapSleepStage(stage: Int): String {
        return when (stage) {
            SleepSessionRecord.STAGE_TYPE_AWAKE -> "AWAKE"
            SleepSessionRecord.STAGE_TYPE_LIGHT -> "LIGHT"
            SleepSessionRecord.STAGE_TYPE_DEEP -> "DEEP"
            SleepSessionRecord.STAGE_TYPE_REM -> "REM"
            else -> "UNKNOWN"
        }
    }
}
