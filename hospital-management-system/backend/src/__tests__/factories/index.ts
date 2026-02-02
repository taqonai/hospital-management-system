import { faker } from '@faker-js/faker';
import { Invoice, Payment, Patient, User, UserRole, Gender, PatientStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export const createMockUser = (overrides?: Partial<User>): User => ({
  id: faker.string.uuid(),
  hospitalId: faker.string.uuid(),
  email: faker.internet.email(),
  password: faker.internet.password(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  phone: faker.phone.number(),
  avatar: null,
  role: UserRole.DOCTOR,
  isActive: true,
  isEmailVerified: true,
  lastLogin: faker.date.recent(),
  resetToken: null,
  resetTokenExpiry: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

export const createMockPatient = (overrides?: Partial<Patient>): Patient => ({
  id: faker.string.uuid(),
  oderId: null,
  hospitalId: faker.string.uuid(),
  mrn: faker.string.alphanumeric(8).toUpperCase(),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  dateOfBirth: faker.date.birthdate({ min: 1, max: 90, mode: 'age' }),
  gender: Gender.MALE,
  bloodGroup: null,
  phone: faker.phone.number(),
  email: faker.internet.email(),
  address: faker.location.streetAddress(),
  city: faker.location.city(),
  state: faker.location.state(),
  zipCode: faker.location.zipCode(),
  emergencyContact: faker.person.fullName(),
  emergencyPhone: faker.phone.number(),
  occupation: faker.person.jobTitle(),
  maritalStatus: null,
  nationality: faker.location.country(),
  photo: null,
  isActive: true,
  status: PatientStatus.ACTIVE,
  noShowCount: 0,
  lastNoShowAt: null,
  blockedAt: null,
  blockedReason: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});

export const createMockInvoice = (overrides?: Partial<Invoice>): Invoice => {
  const subtotal = faker.number.float({ min: 100, max: 10000, fractionDigits: 2 });
  const discount = faker.number.float({ min: 0, max: subtotal * 0.2, fractionDigits: 2 });
  const tax = faker.number.float({ min: 0, max: subtotal * 0.15, fractionDigits: 2 });
  const totalAmount = subtotal - discount + tax;

  return {
    id: faker.string.uuid(),
    hospitalId: faker.string.uuid(),
    patientId: faker.string.uuid(),
    invoiceNumber: `INV-${faker.string.alphanumeric(10).toUpperCase()}`,
    invoiceDate: faker.date.past(),
    dueDate: faker.date.future(),
    subtotal: new Decimal(subtotal),
    discount: new Decimal(discount),
    tax: new Decimal(tax),
    totalAmount: new Decimal(totalAmount),
    balanceAmount: new Decimal(totalAmount),
    paidAmount: new Decimal(0),
    status: 'PENDING',
    notes: null,
    createdBy: faker.string.uuid(),
    updatedBy: null,
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides,
  };
};

export const createMockPayment = (overrides?: Partial<Payment>): Payment => {
  const amount = faker.number.float({ min: 50, max: 5000, fractionDigits: 2 });

  return {
    id: faker.string.uuid(),
    invoiceId: faker.string.uuid(),
    paymentDate: faker.date.recent(),
    amount: new Decimal(amount),
    paymentMethod: 'CASH',
    referenceNumber: `TXN-${faker.string.alphanumeric(10).toUpperCase()}`,
    notes: null,
    createdBy: faker.string.uuid(),
    createdAt: faker.date.past(),
    ...overrides,
  };
};

export const createMockInvoiceItem = (overrides?: Partial<any>) => {
  const unitPrice = faker.number.float({ min: 10, max: 1000, precision: 0.01 });
  const quantity = faker.number.int({ min: 1, max: 10 });
  const discount = faker.number.float({ min: 0, max: unitPrice * quantity * 0.1, precision: 0.01 });
  const totalPrice = (unitPrice * quantity) - discount;

  return {
    id: faker.string.uuid(),
    invoiceId: faker.string.uuid(),
    description: faker.commerce.productName(),
    category: faker.helpers.arrayElement(['CONSULTATION', 'LAB', 'IMAGING', 'MEDICATION', 'PROCEDURE']),
    quantity: quantity,
    unitPrice: unitPrice,
    discount: discount,
    totalPrice: totalPrice,
    createdAt: faker.date.past(),
    ...overrides,
  };
};

// Factory for insurance claims
export const createMockInsuranceClaim = (overrides?: Partial<any>) => ({
  id: faker.string.uuid(),
  invoiceId: faker.string.uuid(),
  claimNumber: `CLM-${faker.string.alphanumeric(10).toUpperCase()}`,
  insuranceProvider: faker.company.name(),
  insurancePayerId: faker.string.uuid(),
  policyNumber: faker.string.alphanumeric(12).toUpperCase(),
  claimAmount: new Decimal(faker.number.float({ min: 100, max: 10000, fractionDigits: 2 })),
  approvedAmount: null,
  status: 'SUBMITTED',
  submittedAt: faker.date.recent(),
  processedAt: null,
  denialReasonCode: null,
  appealNotes: null,
  appealDate: null,
  appealStatus: null,
  notes: null,
  createdBy: faker.string.uuid(),
  updatedBy: null,
  submittedBy: faker.string.uuid(),
  processedBy: null,
  createdAt: faker.date.past(),
  updatedAt: faker.date.recent(),
  ...overrides,
});
