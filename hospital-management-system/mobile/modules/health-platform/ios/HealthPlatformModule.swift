import ExpoModulesCore
import HealthKit

/**
 * Health Platform Module for A'mad Precision Health
 *
 * Provides native integration with Apple HealthKit on iOS.
 * Supports reading health metrics, workouts, and sleep data.
 *
 * Requirements:
 * - iOS 13.0+
 * - HealthKit capability enabled
 * - NSHealthShareUsageDescription in Info.plist
 * - NSHealthUpdateUsageDescription in Info.plist (for writing)
 */
public class HealthPlatformModule: Module {
    private let healthStore = HKHealthStore()
    private let dateFormatter = ISO8601DateFormatter()

    public func definition() -> ModuleDefinition {
        Name("HealthPlatformModule")

        // ==================== AVAILABILITY & STATUS ====================

        /**
         * Check if HealthKit is available on this device
         */
        AsyncFunction("isAvailable") { () -> Bool in
            return HKHealthStore.isHealthDataAvailable()
        }

        /**
         * Get HealthKit SDK status
         */
        AsyncFunction("getSdkStatus") { () -> String in
            if HKHealthStore.isHealthDataAvailable() {
                return "available"
            } else {
                return "not_supported"
            }
        }

        /**
         * Open Health app settings
         */
        AsyncFunction("openHealthConnectSettings") { () -> Bool in
            if let url = URL(string: "x-apple-health://") {
                DispatchQueue.main.async {
                    UIApplication.shared.open(url)
                }
                return true
            }
            return false
        }

        // ==================== AUTHORIZATION ====================

        /**
         * Request authorization for specified health data types
         */
        AsyncFunction("requestAuthorization") { (dataTypes: [String]) -> [String: Any] in
            guard HKHealthStore.isHealthDataAvailable() else {
                return [
                    "granted": false,
                    "error": "HealthKit not available on this device"
                ]
            }

            let readTypes = dataTypes.compactMap { self.mapToHKSampleType($0) }

            guard !readTypes.isEmpty else {
                return [
                    "granted": false,
                    "error": "No valid data types specified"
                ]
            }

            return await withCheckedContinuation { continuation in
                healthStore.requestAuthorization(toShare: nil, read: Set(readTypes)) { success, error in
                    if let error = error {
                        continuation.resume(returning: [
                            "granted": false,
                            "error": error.localizedDescription
                        ])
                    } else {
                        // Check actual authorization status
                        let permissions = dataTypes.map { dataType -> [String: Any] in
                            if let sampleType = self.mapToHKSampleType(dataType) {
                                let status = self.healthStore.authorizationStatus(for: sampleType)
                                return [
                                    "dataType": dataType,
                                    "read": status == .sharingAuthorized,
                                    "write": false
                                ]
                            }
                            return [
                                "dataType": dataType,
                                "read": false,
                                "write": false
                            ]
                        }
                        continuation.resume(returning: [
                            "granted": success,
                            "permissions": permissions
                        ])
                    }
                }
            }
        }

        /**
         * Get currently granted permissions
         */
        AsyncFunction("getGrantedPermissions") { () -> [[String: Any]] in
            let allDataTypes = [
                "STEPS", "HEART_RATE", "HEART_RATE_RESTING", "BLOOD_OXYGEN",
                "BLOOD_PRESSURE", "BLOOD_GLUCOSE", "WEIGHT", "BODY_TEMPERATURE",
                "CALORIES_BURNED", "DISTANCE", "RESPIRATORY_RATE", "HRV",
                "SLEEP_DURATION", "WORKOUT"
            ]

            return allDataTypes.compactMap { dataType -> [String: Any]? in
                guard let sampleType = self.mapToHKSampleType(dataType) else { return nil }
                let status = healthStore.authorizationStatus(for: sampleType)
                if status == .sharingAuthorized {
                    return [
                        "dataType": dataType,
                        "read": true,
                        "write": false
                    ]
                }
                return nil
            }
        }

        // ==================== READ HEALTH DATA ====================

        /**
         * Read health records for a specific data type
         */
        AsyncFunction("readRecords") { (dataType: String, startTime: String, endTime: String) -> [[String: Any]] in
            guard let sampleType = self.mapToHKSampleType(dataType),
                  let start = self.dateFormatter.date(from: startTime),
                  let end = self.dateFormatter.date(from: endTime) else {
                return []
            }

            return await self.queryHealthSamples(
                sampleType: sampleType,
                dataType: dataType,
                startDate: start,
                endDate: end
            )
        }

        /**
         * Read exercise/workout sessions
         */
        AsyncFunction("readExerciseSessions") { (startTime: String, endTime: String) -> [[String: Any]] in
            guard let start = self.dateFormatter.date(from: startTime),
                  let end = self.dateFormatter.date(from: endTime) else {
                return []
            }

            return await self.queryWorkouts(startDate: start, endDate: end)
        }

        /**
         * Read sleep sessions
         */
        AsyncFunction("readSleepSessions") { (startTime: String, endTime: String) -> [[String: Any]] in
            guard let start = self.dateFormatter.date(from: startTime),
                  let end = self.dateFormatter.date(from: endTime) else {
                return []
            }

            return await self.querySleepAnalysis(startDate: start, endDate: end)
        }

        /**
         * Aggregate data for a time range
         */
        AsyncFunction("aggregateData") { (dataType: String, startTime: String, endTime: String) -> [String: Any] in
            guard let sampleType = self.mapToHKQuantityType(dataType),
                  let start = self.dateFormatter.date(from: startTime),
                  let end = self.dateFormatter.date(from: endTime) else {
                return ["total": 0, "average": 0, "min": 0, "max": 0, "count": 0]
            }

            return await self.aggregateQuantityData(
                quantityType: sampleType,
                dataType: dataType,
                startDate: start,
                endDate: end
            )
        }
    }

    // ==================== QUERY METHODS ====================

    private func queryHealthSamples(
        sampleType: HKSampleType,
        dataType: String,
        startDate: Date,
        endDate: Date
    ) async -> [[String: Any]] {
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sampleType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                guard let samples = samples, error == nil else {
                    continuation.resume(returning: [])
                    return
                }

                let results = samples.compactMap { sample -> [String: Any]? in
                    return self.mapSampleToDict(sample, dataType: dataType)
                }
                continuation.resume(returning: results)
            }
            healthStore.execute(query)
        }
    }

    private func queryWorkouts(startDate: Date, endDate: Date) async -> [[String: Any]] {
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: HKWorkoutType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                guard let workouts = samples as? [HKWorkout], error == nil else {
                    continuation.resume(returning: [])
                    return
                }

                let results = workouts.map { workout -> [String: Any] in
                    return [
                        "id": workout.uuid.uuidString,
                        "workoutType": self.mapWorkoutType(workout.workoutActivityType),
                        "startTime": self.dateFormatter.string(from: workout.startDate),
                        "endTime": self.dateFormatter.string(from: workout.endDate),
                        "duration": Int(workout.duration / 60),
                        "calories": workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0,
                        "distance": workout.totalDistance?.doubleValue(for: .meter()) ?? 0
                    ]
                }
                continuation.resume(returning: results)
            }
            healthStore.execute(query)
        }
    }

    private func querySleepAnalysis(startDate: Date, endDate: Date) async -> [[String: Any]] {
        guard let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            return []
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: sleepType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
            ) { _, samples, error in
                guard let sleepSamples = samples as? [HKCategorySample], error == nil else {
                    continuation.resume(returning: [])
                    return
                }

                // Group sleep samples into sessions
                var sessions: [[String: Any]] = []
                var currentSession: [HKCategorySample] = []
                var sessionStart: Date?
                var sessionEnd: Date?

                for sample in sleepSamples.sorted(by: { $0.startDate < $1.startDate }) {
                    if currentSession.isEmpty {
                        sessionStart = sample.startDate
                        sessionEnd = sample.endDate
                        currentSession.append(sample)
                    } else if sample.startDate.timeIntervalSince(sessionEnd!) < 3600 {
                        // Within 1 hour, part of same session
                        sessionEnd = max(sessionEnd!, sample.endDate)
                        currentSession.append(sample)
                    } else {
                        // New session
                        if let start = sessionStart, let end = sessionEnd {
                            sessions.append(self.createSleepSessionDict(
                                samples: currentSession,
                                startDate: start,
                                endDate: end
                            ))
                        }
                        currentSession = [sample]
                        sessionStart = sample.startDate
                        sessionEnd = sample.endDate
                    }
                }

                // Add last session
                if !currentSession.isEmpty, let start = sessionStart, let end = sessionEnd {
                    sessions.append(self.createSleepSessionDict(
                        samples: currentSession,
                        startDate: start,
                        endDate: end
                    ))
                }

                continuation.resume(returning: sessions)
            }
            healthStore.execute(query)
        }
    }

    private func aggregateQuantityData(
        quantityType: HKQuantityType,
        dataType: String,
        startDate: Date,
        endDate: Date
    ) async -> [String: Any] {
        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
        )

        let options: HKStatisticsOptions = dataType == "STEPS" || dataType == "CALORIES_BURNED" || dataType == "DISTANCE"
            ? [.cumulativeSum]
            : [.discreteAverage, .discreteMin, .discreteMax]

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: options
            ) { _, statistics, error in
                guard let stats = statistics, error == nil else {
                    continuation.resume(returning: [
                        "total": 0, "average": 0, "min": 0, "max": 0, "count": 0
                    ])
                    return
                }

                let unit = self.getUnit(for: dataType)
                var result: [String: Any] = [:]

                if let sum = stats.sumQuantity() {
                    result["total"] = sum.doubleValue(for: unit)
                }
                if let avg = stats.averageQuantity() {
                    result["average"] = avg.doubleValue(for: unit)
                }
                if let min = stats.minimumQuantity() {
                    result["min"] = min.doubleValue(for: unit)
                }
                if let max = stats.maximumQuantity() {
                    result["max"] = max.doubleValue(for: unit)
                }

                continuation.resume(returning: result)
            }
            healthStore.execute(query)
        }
    }

    // ==================== HELPER METHODS ====================

    private func mapToHKSampleType(_ dataType: String) -> HKSampleType? {
        switch dataType {
        case "STEPS":
            return HKQuantityType.quantityType(forIdentifier: .stepCount)
        case "HEART_RATE":
            return HKQuantityType.quantityType(forIdentifier: .heartRate)
        case "HEART_RATE_RESTING":
            return HKQuantityType.quantityType(forIdentifier: .restingHeartRate)
        case "BLOOD_OXYGEN":
            return HKQuantityType.quantityType(forIdentifier: .oxygenSaturation)
        case "BLOOD_PRESSURE":
            return HKQuantityType.quantityType(forIdentifier: .bloodPressureSystolic)
        case "BLOOD_GLUCOSE":
            return HKQuantityType.quantityType(forIdentifier: .bloodGlucose)
        case "WEIGHT":
            return HKQuantityType.quantityType(forIdentifier: .bodyMass)
        case "BODY_TEMPERATURE":
            return HKQuantityType.quantityType(forIdentifier: .bodyTemperature)
        case "CALORIES_BURNED":
            return HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned)
        case "DISTANCE":
            return HKQuantityType.quantityType(forIdentifier: .distanceWalkingRunning)
        case "RESPIRATORY_RATE":
            return HKQuantityType.quantityType(forIdentifier: .respiratoryRate)
        case "HRV":
            return HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)
        case "SLEEP_DURATION", "SLEEP_STAGE":
            return HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)
        case "WORKOUT":
            return HKWorkoutType.workoutType()
        default:
            return nil
        }
    }

    private func mapToHKQuantityType(_ dataType: String) -> HKQuantityType? {
        return mapToHKSampleType(dataType) as? HKQuantityType
    }

    private func getUnit(for dataType: String) -> HKUnit {
        switch dataType {
        case "STEPS":
            return .count()
        case "HEART_RATE", "HEART_RATE_RESTING":
            return HKUnit(from: "count/min")
        case "BLOOD_OXYGEN":
            return .percent()
        case "BLOOD_PRESSURE":
            return .millimeterOfMercury()
        case "BLOOD_GLUCOSE":
            return HKUnit(from: "mg/dL")
        case "WEIGHT":
            return .gramUnit(with: .kilo)
        case "BODY_TEMPERATURE":
            return .degreeCelsius()
        case "CALORIES_BURNED":
            return .kilocalorie()
        case "DISTANCE":
            return .meter()
        case "RESPIRATORY_RATE":
            return HKUnit(from: "count/min")
        case "HRV":
            return .secondUnit(with: .milli)
        default:
            return .count()
        }
    }

    private func mapSampleToDict(_ sample: HKSample, dataType: String) -> [String: Any]? {
        if let quantitySample = sample as? HKQuantitySample {
            let unit = getUnit(for: dataType)
            return [
                "dataType": dataType,
                "value": quantitySample.quantity.doubleValue(for: unit),
                "unit": unit.unitString,
                "timestamp": dateFormatter.string(from: quantitySample.startDate),
                "endTime": dateFormatter.string(from: quantitySample.endDate)
            ]
        } else if let categorySample = sample as? HKCategorySample {
            return [
                "dataType": dataType,
                "value": categorySample.value,
                "unit": "category",
                "timestamp": dateFormatter.string(from: categorySample.startDate),
                "endTime": dateFormatter.string(from: categorySample.endDate)
            ]
        }
        return nil
    }

    private func mapWorkoutType(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking:
            return "WALKING"
        case .running:
            return "RUNNING"
        case .cycling:
            return "CYCLING"
        case .swimming:
            return "SWIMMING"
        case .highIntensityIntervalTraining:
            return "HIIT"
        case .traditionalStrengthTraining, .functionalStrengthTraining:
            return "STRENGTH_TRAINING"
        case .yoga:
            return "YOGA"
        default:
            return "OTHER"
        }
    }

    private func mapSleepStage(_ value: Int) -> String {
        if #available(iOS 16.0, *) {
            switch value {
            case HKCategoryValueSleepAnalysis.awake.rawValue:
                return "AWAKE"
            case HKCategoryValueSleepAnalysis.asleepCore.rawValue:
                return "LIGHT"
            case HKCategoryValueSleepAnalysis.asleepDeep.rawValue:
                return "DEEP"
            case HKCategoryValueSleepAnalysis.asleepREM.rawValue:
                return "REM"
            default:
                return "UNKNOWN"
            }
        } else {
            switch value {
            case HKCategoryValueSleepAnalysis.awake.rawValue:
                return "AWAKE"
            case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue:
                return "LIGHT"
            default:
                return "UNKNOWN"
            }
        }
    }

    private func createSleepSessionDict(
        samples: [HKCategorySample],
        startDate: Date,
        endDate: Date
    ) -> [String: Any] {
        let stages = samples.map { sample -> [String: Any] in
            return [
                "stage": mapSleepStage(sample.value),
                "startTime": dateFormatter.string(from: sample.startDate),
                "endTime": dateFormatter.string(from: sample.endDate)
            ]
        }

        return [
            "id": UUID().uuidString,
            "startTime": dateFormatter.string(from: startDate),
            "endTime": dateFormatter.string(from: endDate),
            "duration": Int(endDate.timeIntervalSince(startDate) / 60),
            "stages": stages
        ]
    }
}
