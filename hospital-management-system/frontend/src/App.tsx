import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from './store';

// Layout
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import PatientForm from './pages/PatientForm';
import Appointments from './pages/Appointments';
import AppointmentForm from './pages/AppointmentForm';
import Doctors from './pages/Doctors';
import DoctorForm from './pages/DoctorForm';
import AIAssistant from './pages/AIAssistant';

// HIS Module Pages
import Laboratory from './pages/Laboratory';
import Pharmacy from './pages/Pharmacy';
import IPD from './pages/IPD';
import OPD from './pages/OPD';
import Emergency from './pages/Emergency';
import Radiology from './pages/Radiology';
import Surgery from './pages/Surgery';
import Billing from './pages/Billing';
import HR from './pages/HR';
import Housekeeping from './pages/Housekeeping';

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

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { isAuthenticated, user } = useSelector((state: RootState) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  return (
    <Routes>
      {/* Public Routes */}
      <Route element={<AuthLayout />}>
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />
          }
        />
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
        <Route path="/doctors/:id/edit" element={<DoctorForm />} />

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
        <Route path="/ipd" element={<IPD />} />
        <Route path="/emergency" element={<Emergency />} />
        <Route path="/laboratory" element={<Laboratory />} />
        <Route path="/radiology" element={<Radiology />} />
        <Route path="/pharmacy" element={<Pharmacy />} />
        <Route path="/surgery" element={<Surgery />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/hr" element={<HR />} />
        <Route path="/housekeeping" element={<Housekeeping />} />

        {/* New Enterprise Modules */}
        <Route path="/blood-bank" element={<BloodBank />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/telemedicine" element={<Telemedicine />} />
        <Route path="/queue" element={<Queue />} />

        <Route
          path="/ai-assistant"
          element={
            <ProtectedRoute allowedRoles={['DOCTOR', 'NURSE', 'HOSPITAL_ADMIN']}>
              <AIAssistant />
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

      {/* Redirects */}
      <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/"} replace />} />
    </Routes>
  );
}

export default App;
