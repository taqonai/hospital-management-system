"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
        var hospital, payersData, createdPayers, _i, payersData_1, payerData, payer, consultationICD, damanPayer, thiqaPayer;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Seeding UAE Insurance Payers...');
                    return [4 /*yield*/, prisma.hospital.findFirst()];
                case 1:
                    hospital = _a.sent();
                    if (!hospital) {
                        throw new Error('No hospital found. Please run main seed first.');
                    }
                    console.log("Using hospital: ".concat(hospital.name, " (").concat(hospital.id, ")"));
                    payersData = [
                        {
                            name: 'Daman (National Health Insurance Company)',
                            code: 'DAMAN',
                            regulator: 'DOH',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-2-4080800',
                            preAuthEmail: 'preauth@damanhealth.ae',
                            preAuthPortal: 'https://provider.damanhealth.ae',
                            contactPhone: '+971-2-4080800',
                            contactEmail: 'info@damanhealth.ae',
                            paymentTerms: 30,
                            isActive: true,
                            notes: 'Basic plan with standard coverage',
                        },
                        {
                            name: 'Thiqa (Enhanced Plan by Daman)',
                            code: 'THIQA',
                            regulator: 'DOH',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: false,
                            preAuthPhone: '+971-2-4080800',
                            preAuthEmail: 'thiqa@damanhealth.ae',
                            preAuthPortal: 'https://provider.damanhealth.ae',
                            contactPhone: '+971-2-4080800',
                            contactEmail: 'thiqa@damanhealth.ae',
                            paymentTerms: 30,
                            isActive: true,
                            notes: 'Enhanced plan with no copay for most services',
                        },
                        {
                            name: 'NAS (Next Generation Insurance)',
                            code: 'NAS',
                            regulator: 'DHA',
                            claimPlatform: 'SHIFA',
                            claimSubmissionDeadline: 60,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-2222999',
                            preAuthEmail: 'preauth@nas.ae',
                            contactPhone: '+971-4-2222999',
                            contactEmail: 'info@nas.ae',
                            paymentTerms: 45,
                            isActive: true,
                        },
                        {
                            name: 'AXA Gulf',
                            code: 'AXA',
                            regulator: 'DHA',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-4499944',
                            preAuthEmail: 'medicalservices.uae@axa-gulf.com',
                            contactPhone: '+971-4-4499944',
                            contactEmail: 'contact@axa-gulf.com',
                            paymentTerms: 30,
                            isActive: true,
                        },
                        {
                            name: 'Oman Insurance (Sukoon)',
                            code: 'SUKOON',
                            regulator: 'DHA',
                            claimPlatform: 'SHIFA',
                            claimSubmissionDeadline: 60,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-3077800',
                            preAuthEmail: 'claims@omaninsurance.ae',
                            contactPhone: '+971-4-3077800',
                            contactEmail: 'info@omaninsurance.ae',
                            paymentTerms: 45,
                            isActive: true,
                        },
                        {
                            name: 'ADNIC (Abu Dhabi National Insurance)',
                            code: 'ADNIC',
                            regulator: 'DOH',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-2-6444444',
                            preAuthEmail: 'health@adnic.ae',
                            contactPhone: '+971-2-6444444',
                            contactEmail: 'info@adnic.ae',
                            paymentTerms: 30,
                            isActive: true,
                        },
                        {
                            name: 'Orient Insurance',
                            code: 'ORIENT',
                            regulator: 'DHA',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-2955444',
                            preAuthEmail: 'healthclaims@orientinsurance.ae',
                            contactPhone: '+971-4-2955444',
                            contactEmail: 'info@orientinsurance.ae',
                            paymentTerms: 45,
                            isActive: true,
                        },
                        {
                            name: 'MetLife',
                            code: 'METLIFE',
                            regulator: 'DHA',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-2941600',
                            preAuthEmail: 'medicalservices@metlife.ae',
                            contactPhone: '+971-4-2941600',
                            contactEmail: 'customer.service@metlife.ae',
                            paymentTerms: 30,
                            isActive: true,
                        },
                        {
                            name: 'Cigna',
                            code: 'CIGNA',
                            regulator: 'DHA',
                            claimPlatform: 'eClaimLink',
                            claimSubmissionDeadline: 90,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-3644586',
                            preAuthEmail: 'priorauth.uae@cigna.com',
                            contactPhone: '+971-4-3644586',
                            contactEmail: 'uaecontact@cigna.com',
                            paymentTerms: 30,
                            isActive: true,
                        },
                        {
                            name: 'Neuron (MedNet)',
                            code: 'MEDNET',
                            regulator: 'DHA',
                            claimPlatform: 'SHIFA',
                            claimSubmissionDeadline: 60,
                            appealDeadline: 30,
                            preAuthRequired: true,
                            preAuthPhone: '+971-4-4072222',
                            preAuthEmail: 'preauth@neuronme.com',
                            contactPhone: '+971-4-4072222',
                            contactEmail: 'info@neuronme.com',
                            paymentTerms: 45,
                            isActive: true,
                        },
                    ];
                    createdPayers = [];
                    _i = 0, payersData_1 = payersData;
                    _a.label = 2;
                case 2:
                    if (!(_i < payersData_1.length)) return [3 /*break*/, 5];
                    payerData = payersData_1[_i];
                    return [4 /*yield*/, prisma.insurancePayer.upsert({
                            where: {
                                hospitalId_code: {
                                    hospitalId: hospital.id,
                                    code: payerData.code,
                                },
                            },
                            update: {},
                            create: __assign({ hospitalId: hospital.id }, payerData),
                        })];
                case 3:
                    payer = _a.sent();
                    createdPayers.push(payer);
                    console.log("\u2713 Created/Updated payer: ".concat(payer.name, " (").concat(payer.code, ")"));
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5: return [4 /*yield*/, prisma.iCD10Code.findFirst({
                        where: {
                            hospitalId: hospital.id,
                            code: { startsWith: 'Z00' }, // General medical examination
                            isActive: true,
                        },
                    })];
                case 6:
                    consultationICD = _a.sent();
                    if (!consultationICD) return [3 /*break*/, 10];
                    console.log('\nSeeding ICD-10 Payer Rules for consultation copays...');
                    damanPayer = createdPayers.find(function (p) { return p.code === 'DAMAN'; });
                    if (!damanPayer) return [3 /*break*/, 8];
                    return [4 /*yield*/, prisma.iCD10PayerRule.upsert({
                            where: {
                                payerId_icd10CodeId: {
                                    payerId: damanPayer.id,
                                    icd10CodeId: consultationICD.id,
                                },
                            },
                            update: {},
                            create: {
                                payerId: damanPayer.id,
                                icd10CodeId: consultationICD.id,
                                isCovered: true,
                                requiresPreAuth: false,
                                copayAmount: 20,
                                copayPercentage: 20,
                                deductibleApplies: true,
                                isActive: true,
                            },
                        })];
                case 7:
                    _a.sent();
                    console.log('✓ Daman: AED 20 copay + 20% for consultations');
                    _a.label = 8;
                case 8:
                    thiqaPayer = createdPayers.find(function (p) { return p.code === 'THIQA'; });
                    if (!thiqaPayer) return [3 /*break*/, 10];
                    return [4 /*yield*/, prisma.iCD10PayerRule.upsert({
                            where: {
                                payerId_icd10CodeId: {
                                    payerId: thiqaPayer.id,
                                    icd10CodeId: consultationICD.id,
                                },
                            },
                            update: {},
                            create: {
                                payerId: thiqaPayer.id,
                                icd10CodeId: consultationICD.id,
                                isCovered: true,
                                requiresPreAuth: false,
                                copayAmount: 0,
                                copayPercentage: 0,
                                deductibleApplies: false,
                                isActive: true,
                            },
                        })];
                case 9:
                    _a.sent();
                    console.log('✓ Thiqa: No copay for consultations');
                    _a.label = 10;
                case 10:
                    console.log("\n\u2705 Seeded ".concat(createdPayers.length, " UAE insurance payers"));
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('Error seeding UAE insurance payers:', e);
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
