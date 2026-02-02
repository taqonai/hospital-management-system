"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var patientId, patient, damanPayer, existingInsurance, insurance;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Adding test insurance for patient Md Kamil...');
                    patientId = '8d86603e-04ea-4c9e-a841-bfaf645ecfd4';
                    return [4 /*yield*/, prisma.patient.findUnique({
                            where: { id: patientId },
                        })];
                case 1:
                    patient = _a.sent();
                    if (!patient) {
                        console.error('Patient Md Kamil not found with id:', patientId);
                        process.exit(1);
                    }
                    console.log("Found patient: ".concat(patient.firstName, " ").concat(patient.lastName, " (").concat(patient.mrn, ")"));
                    return [4 /*yield*/, prisma.insurancePayer.findFirst({
                            where: {
                                code: 'DAMAN',
                                hospitalId: patient.hospitalId,
                            },
                        })];
                case 2:
                    damanPayer = _a.sent();
                    if (!damanPayer) {
                        console.error('Daman payer not found. Please run seed-uae-insurance first.');
                        process.exit(1);
                    }
                    console.log("Found Daman payer: ".concat(damanPayer.name));
                    return [4 /*yield*/, prisma.patientInsurance.findFirst({
                            where: {
                                patientId: patientId,
                                policyNumber: 'TEST-POL-001',
                            },
                        })];
                case 3:
                    existingInsurance = _a.sent();
                    if (!existingInsurance) return [3 /*break*/, 5];
                    console.log('Test insurance already exists. Updating...');
                    return [4 /*yield*/, prisma.patientInsurance.update({
                            where: { id: existingInsurance.id },
                            data: {
                                providerName: damanPayer.name,
                                coverageType: 'Enhanced',
                                copay: 20,
                                effectiveDate: new Date('2026-01-01'),
                                expiryDate: new Date('2026-12-31'),
                                isPrimary: true,
                                isActive: true,
                            },
                        })];
                case 4:
                    _a.sent();
                    console.log('✓ Updated existing test insurance');
                    return [3 /*break*/, 7];
                case 5: return [4 /*yield*/, prisma.patientInsurance.create({
                        data: {
                            patientId: patientId,
                            providerName: damanPayer.name,
                            policyNumber: 'TEST-POL-001',
                            groupNumber: 'GRP-TEST-001',
                            subscriberName: 'Md Kamil',
                            subscriberId: 'SUB-KAMIL-001',
                            relationship: 'Self',
                            effectiveDate: new Date('2026-01-01'),
                            expiryDate: new Date('2026-12-31'),
                            coverageType: 'Enhanced',
                            copay: 20,
                            deductible: 500,
                            isPrimary: true,
                            isActive: true,
                        },
                    })];
                case 6:
                    insurance = _a.sent();
                    console.log('✓ Created test insurance:');
                    console.log("  Provider: ".concat(insurance.providerName));
                    console.log("  Policy: ".concat(insurance.policyNumber));
                    console.log("  Coverage: ".concat(insurance.coverageType));
                    console.log("  Copay: AED ".concat(insurance.copay));
                    _a.label = 7;
                case 7:
                    console.log('\n✅ Test insurance data added successfully!');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('Error seeding test insurance:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
