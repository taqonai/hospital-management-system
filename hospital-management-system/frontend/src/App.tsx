import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';
import { PermissionProvider, usePermissions } from './contexts/PermissionContext';

// Layout
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import PatientForm from './pages/PatientForm';
import Appointments from './pages/Appointments';
import AppointmentForm from './pages/AppointmentForm';
import Doctors from './pages/Doctors';
import DoctorForm from './pages/DoctorForm';
import DoctorDetail from './pages/DoctorDetail';
import Departments from './pages/Departments';
import DepartmentForm from './pages/Departments/DepartmentForm';
import AIAssistant from './pages/AIAssistant';

// HIS Module Pages
import Laboratory from './pages/Laboratory';
import Pharmacy from './pages/Pharmacy';
import IPD from './pages/IPD';
import AdmissionDetail from './pages/IPD/AdmissionDetail';
import OPD from './pages/OPD';
import Emergency from './pages/Emergency';
import NurseStation from './pages/NurseStation';
import Radiology from './pages/Radiology';
import Surgery from './pages/Surgery';
import Billing from './pages/Billing';
import FinancialReports from './pages/FinancialReports';
import Accounting from './pages/Accounting';
import HR from './pages/HR';
import EmployeeLeave from './pages/EmployeeLeave';
import Housekeeping from './pages/Housekeeping';
import Dietary from './pages/Dietary';

// New Enterprise Modules
import BloodBank from './pages/BloodBank';
import Reports from './pages/Reports';
import Telemedicine from './pages/Telemedicine';

// Queue Management
import Queue from './pages/Queue';
import QueueDisplayBoard from './pages/Queue/DisplayBoard';
import PatientQueueStatus from './pages/Queue/PatientStatus';

// Self Check-in Kiosk
import SelfCheckInKiosk from './pages/Kiosk';

// Consultation
import Consultation from './pages/Consultation';

// Risk Analytics
import RiskAnalytics from './pages/RiskAnalytics';

// Medical Imaging AI
import MedicalImaging from './pages/MedicalImaging';

// Drug Interactions
import DrugInteractions from './pages/DrugInteractions';

// Clinical Notes AI
import ClinicalNotes from './pages/ClinicalNotes';

// Patient Risk Prediction
import PatientRisk from './pages/PatientRisk';

// AI Diagnostic Assistant
import DiagnosticAssistantPage from './pages/DiagnosticAssistant';

// AI Symptom Checker (Patient-facing)
import SymptomChecker from './pages/SymptomChecker';

// AI Scribe for Doctors
import AIScribe from './pages/AIScribe';

// Early Warning System (NEWS2)
import EarlyWarning from './pages/EarlyWarning';

// Medication Safety (5 Rights)
import MedicationSafety from './pages/MedicationSafety';

// Smart Orders (AI-powered order recommendations)
import SmartOrders from './pages/SmartOrders';

// PDF Document Analysis
import PDFAnalysis from './pages/PDFAnalysis';

// Quality Management
import Quality from './pages/Quality';

// Patient Portal (Separate public section with own auth)
import PatientPortalLogin from './pages/PatientPortal/Login';
import PatientForgotPassword from './pages/PatientPortal/ForgotPassword';
import PatientResetPassword from './pages/PatientPortal/ResetPassword';
import PatientPortalDashboard from './pages/PatientPortal/Dashboard';
import PatientPortalAppointments from './pages/PatientPortal/Appointments';
import PatientPortalMedicalRecords from './pages/PatientPortal/MedicalRecords';
import PatientPortalPrescriptions from './pages/PatientPortal/Prescriptions';
import PatientPortalLabResults from './pages/PatientPortal/LabResults';
import PatientPortalBilling from './pages/PatientPortal/Billing';
import PatientPortalSettings from './pages/PatientPortal/Settings';
import PatientPortalSymptomChecker from './pages/PatientPortal/SymptomChecker';
import PatientPortalHealthAssistant from './pages/PatientPortal/HealthAssistant';
import PatientPortalHealthInsights from './pages/PatientPortal/HealthInsights';
import PatientPortalHealthSync from './pages/PatientPortal/HealthSync';
import PatientPortalFitnessTracker from './pages/PatientPortal/FitnessTracker';
import PatientPortalNutritionPlan from './pages/PatientPortal/NutritionPlan';
import PatientPortalWellnessHub from './pages/PatientPortal/WellnessHub';
import PatientPortalMessages from './pages/PatientPortal/components/Messages';
import PatientPortalFullHistory from './pages/PatientPortal/PatientFullHistory';
import PatientPortalInsurance from './pages/PatientPortal/Insurance';
import PatientPortalLayout from './components/layout/PatientPortalLayout';

// Asset Management
import Assets from './pages/Assets';

// RBAC (Role-Based Access Control)
import RBAC from './pages/RBAC';

// AI Settings (Admin only)
import AISettings from './pages/AISettings';

// Insurance Coding (Admin only)
import InsuranceCoding from './pages/InsuranceCoding';
import InsuranceAuditLog from './pages/InsuranceCoding/AuditLog';

// Insurance Pre-Authorization
import InsurancePreAuth from './pages/Insurance/PreAuth';
import InsurancePendingVerifications from './pages/Insurance/PendingVerifications';

// Insurance Provider Master
import InsuranceProviders from './pages/InsuranceProviders';

// Copay Refunds (GAP 9)
import CopayRefunds from './pages/Billing/CopayRefunds';

// Copay Verification Dashboard (Issue #4)
import CopayVerification from './pages/Billing/CopayVerification';
import CopayReconciliation from './pages/Billing/CopayReconciliation';

// CRM Module
import CRM from './pages/CRM';

// Procurement Module
import Procurement from './pages/Procurement';

// Clinician Dashboard (A'mad Precision Health Platform)
import ClinicianDashboard from './pages/Clinician';
import ClinicianPatientSummary from './pages/Clinician/PatientSummary';
import ClinicianAlerts from './pages/Clinician/Alerts';

// Notifications
import Notifications from './pages/Notifications';
import NotificationSettingsPage from './pages/Settings/Notifications';
import TeamContacts from './pages/Settings/Notifications/TeamContacts';
import DeliveryLogs from './pages/Settings/Notifications/DeliveryLogs';
import HospitalSettings from './pages/Settings';

// Protected Route Component with RBAC permission support
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
  permission?: string; // RBAC permission code for dynamic access control
}

const ProtectedRoute = ({ children, allowedRoles, permission }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);
  const { hasPermission, loaded: permissionsLoaded } = usePermissions();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If permission is specified AND permissions are loaded → check permission
  if (permission && permissionsLoaded) {
    if (!hasPermission(permission)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <>{children}</>;
  }

  // Fallback: role-based check (when permissions not loaded or no permission specified)
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <PermissionProvider>
    <Routes>
      {/* Public Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/patients/new" element={<PatientForm />} />
        <Route path="/patients/:id" element={<PatientDetail />} />
        <Route path="/patients/:id/edit" element={<PatientForm />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/new" element={<AppointmentForm />} />
        <Route path="/appointments/:id/edit" element={<AppointmentForm />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/doctors/new" element={<DoctorForm />} />
        <Route path="/doctors/:id" element={<DoctorDetail />} />
        <Route path="/doctors/:id/edit" element={<DoctorForm />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/departments/new" element={<DepartmentForm />} />
        <Route path="/departments/:id/edit" element={<DepartmentForm />} />

        {/* HIS Module Routes */}
        <Route path="/opd" element={<OPD />} />
        <Route path="/consultation/:appointmentId" element={<Consultation />} />
        <Route path="/risk-analytics" element={<RiskAnalytics />} />
        <Route path="/medical-imaging" element={<MedicalImaging />} />
        <Route path="/drug-interactions" element={<DrugInteractions />} />
        <Route path="/clinical-notes" element={<ClinicalNotes />} />
        <Route path="/patient-risk" element={<PatientRisk />} />
        <Route path="/diagnostic-assistant" element={<DiagnosticAssistantPage />} />
        <Route path="/ai-scribe" element={<AIScribe />} />
        <Route path="/early-warning" element={<EarlyWarning />} />
        <Route path="/medication-safety" element={<MedicationSafety />} />
        <Route path="/smart-orders" element={<SmartOrders />} />
        <Route path="/pdf-analysis" element={<PDFAnalysis />} />
        <Route path="/quality" element={<Quality />} />
        <Route path="/ipd" element={<IPD />} />
        <Route path="/ipd/admission/:id" element={
          <ProtectedRoute allowedRoles={['NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN', 'DOCTOR']} permission="ipd:admissions:read">
            <AdmissionDetail />
          </ProtectedRoute>
        } />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="/nurse-station" element={
            <ProtectedRoute allowedRoles={['NURSE', 'HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="nursing:dashboard">
              <NurseStation />
            </ProtectedRoute>
          } />
        <Route path="/laboratory" element={<Laboratory />} />
        <Route path="/radiology" element={<Radiology />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/surgery" element={<Surgery />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/financial-reports" element={<FinancialReports />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/my-leave" element={<EmployeeLeave />} />
        <Route path="/housekeeping" element={<Housekeeping />} />
        <Route path="/dietary" element={<Dietary />} />
        <Route path="/procurement" element={<Procurement />} />

        {/* New Enterprise Modules */}
        <Route path="/blood-bank" element={<BloodBank />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/telemedicine" element={<Telemedicine />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/asset-management" element={<Assets />} />
        <Route
          path="/rbac"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="rbac:manage">
              <RBAC />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ai-settings"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="settings:write">
              <AISettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance-coding"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'ACCOUNTANT']} permission="insurance_coding:read">
              <InsuranceCoding />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance-audit"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT']} permission="insurance_coding:read">
              <InsuranceAuditLog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance/pre-auth"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'DOCTOR', 'NURSE']}>
              <InsurancePreAuth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance/pre-auth/new"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'DOCTOR', 'NURSE']}>
              <InsurancePreAuth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance/verifications"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST']}>
              <InsurancePendingVerifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/insurance-providers"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'RECEPTIONIST', 'ACCOUNTANT']} permission="patients:read">
              <InsuranceProviders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/copay-refunds"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST']} permission="billing:read">
              <CopayRefunds />
            </ProtectedRoute>
          }
        />
        <Route
          path="/copay-verification"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT', 'RECEPTIONIST', 'CASHIER']} permission="billing:read">
              <CopayVerification />
            </ProtectedRoute>
          }
        />
        <Route
          path="/billing/copay-reconciliation"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'ACCOUNTANT']} permission="billing:read">
              <CopayReconciliation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/crm"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN', 'RECEPTIONIST', 'MARKETING']} permission="crm:read">
              <CRM />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']} permission="ai:diagnostic">
              <AIAssistant />
            </ProtectedRoute>
          }
        />

        {/* Clinician Dashboard - A'mad Precision Health Platform */}
        <Route
          path="/clinician"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']} permission="opd:consultations">
              <ClinicianDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician/patients/:patientId"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']} permission="opd:consultations">
              <ClinicianPatientSummary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician/alerts"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']} permission="opd:consultations">
              <ClinicianAlerts />
            </ProtectedRoute>
          }
        />

        {/* Notifications */}
        <Route path="/notifications" element={<Notifications />} />
        
        {/* Hospital Settings (Admin only) */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="settings:write">
              <HospitalSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="settings:write">
              <NotificationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications/team-contacts"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="settings:write">
              <TeamContacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/notifications/delivery-logs"
          element={
            <ProtectedRoute allowedRoles={['HOSPITAL_ADMIN', 'SUPER_ADMIN']} permission="settings:write">
              <DeliveryLogs />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Public Homepage */}
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Home />}
      />

      {/* Public Queue Display Board (for TV screens/kiosks) */}
      <Route path="/queue/display" element={<QueueDisplayBoard />} />

      {/* Public Patient Queue Status Check */}
      <Route path="/queue/status" element={<PatientQueueStatus />} />

      {/* Public Self Check-in Kiosk */}
      <Route path="/kiosk" element={<SelfCheckInKiosk />} />

      {/* Public AI Symptom Checker (Patient-facing) */}
      <Route path="/symptom-checker" element={<SymptomChecker />} />

      {/* Patient Portal - Separate public section with own authentication */}
      <Route path="/patient-portal/login" element={<PatientPortalLogin />} />
      <Route path="/patient-portal/forgot-password" element={<PatientForgotPassword />} />
      <Route path="/patient-portal/reset-password" element={<PatientResetPassword />} />
      <Route path="/patient-portal" element={<PatientPortalLayout />}>
        <Route index element={<PatientPortalDashboard />} />
        <Route path="dashboard" element={<PatientPortalDashboard />} />
        <Route path="appointments" element={<PatientPortalAppointments />} />
        <Route path="records" element={<PatientPortalMedicalRecords />} />
        <Route path="prescriptions" element={<PatientPortalPrescriptions />} />
        <Route path="labs" element={<PatientPortalLabResults />} />
        <Route path="billing" element={<PatientPortalBilling />} />
        <Route path="insurance" element={<PatientPortalInsurance />} />
        <Route path="settings" element={<PatientPortalSettings />} />
        <Route path="profile" element={<Navigate to="/patient-portal/settings" replace />} />
        <Route path="symptom-checker" element={<PatientPortalSymptomChecker />} />
        <Route path="health-assistant" element={<PatientPortalHealthAssistant />} />
        <Route path="health-insights" element={<PatientPortalHealthInsights />} />
        <Route path="medical-history" element={<Navigate to="/patient-portal/records" replace />} />
        <Route path="health-sync" element={<PatientPortalHealthSync />} />
        <Route path="fitness" element={<PatientPortalFitnessTracker />} />
        <Route path="nutrition" element={<PatientPortalNutritionPlan />} />
        <Route path="wellness" element={<PatientPortalWellnessHub />} />
        <Route path="messages" element={<PatientPortalMessages />} />
        <Route path="history" element={<PatientPortalFullHistory />} />
      </Route>

      {/* Redirects */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
    </Routes>
    </PermissionProvider>
  );
}

export default App;
