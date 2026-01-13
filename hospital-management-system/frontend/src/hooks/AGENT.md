# AGENT.md - Frontend Hooks Directory

## Purpose

This directory contains custom React hooks that encapsulate reusable logic for authentication, AI services, voice recognition, booking data, and other cross-cutting concerns. Hooks provide a clean API for components to access complex functionality.

## Directory Structure

```
hooks/
├── useAuth.ts              # Authentication state and actions
├── useAI.ts                # AI service integration (diagnosis, risk, imaging)
├── useAIScribe.ts          # Voice transcription and note generation
├── useAudioRecorder.ts     # Audio recording utility
├── useBookingData.ts       # Real-time booking ticket data with polling
├── useEarlyWarning.ts      # NEWS2 scoring and alerts
├── useSymptomChecker.ts    # Symptom assessment flow
├── useHybridVoice.ts       # Voice command processing
├── useVoiceRecognition.ts  # Speech-to-text (browser API)
└── useTheme.ts             # Theme switching (dark/light)
```

## Hook Details

### useAuth
Authentication state and logout action.

```typescript
const { user, isAuthenticated, logout } = useAuth();
```

**Returns:**
- `user` - Current user object or null
- `isAuthenticated` - Boolean auth state
- `logout` - Function to clear auth state

**Usage:**
```typescript
function MyComponent() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return <div>Welcome, {user.firstName}</div>;
}
```

---

### useAI
Core AI service integration for diagnosis, risk prediction, and image analysis.

```typescript
const {
  diagnose,
  predictRisk,
  analyzeImage,
  submitFeedback,
  isLoading,
  error,
} = useAI();
```

**Methods:**
- `diagnose(symptoms, patientId)` - Get differential diagnosis
- `predictRisk(patientId, type)` - Get risk prediction
- `analyzeImage(imageUrl, modalityType)` - Analyze medical image
- `submitFeedback(analysisId, feedback)` - Submit AI feedback

**Usage:**
```typescript
function DiagnosticComponent({ patientId }) {
  const { diagnose, isLoading } = useAI();
  const [symptoms, setSymptoms] = useState([]);

  const handleAnalyze = async () => {
    const result = await diagnose(symptoms, patientId);
    // Handle diagnosis result
  };

  return (
    <button onClick={handleAnalyze} disabled={isLoading}>
      Analyze Symptoms
    </button>
  );
}
```

---

### useAIScribe
Voice transcription and clinical note generation using Whisper.

```typescript
const {
  isRecording,
  transcript,
  notes,
  startRecording,
  stopRecording,
  generateNotes,
  icdSuggestions,
  cptSuggestions,
} = useAIScribe();
```

**Features:**
- Audio recording via MediaRecorder API
- Whisper transcription via AI service
- SOAP note generation
- ICD-10 and CPT code suggestions

**Usage:**
```typescript
function ConsultationNotes() {
  const { isRecording, startRecording, stopRecording, transcript, generateNotes, notes } = useAIScribe();

  return (
    <div>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Start'} Recording
      </button>
      <p>Transcript: {transcript}</p>
      <button onClick={() => generateNotes(transcript)}>Generate Notes</button>
      {notes && <div>{notes.soap}</div>}
    </div>
  );
}
```

---

### useAudioRecorder
Low-level audio recording utility using MediaRecorder API.

```typescript
const {
  isRecording,
  audioBlob,
  startRecording,
  stopRecording,
  clearRecording,
} = useAudioRecorder();
```

**Returns:**
- `isRecording` - Boolean recording state
- `audioBlob` - Recorded audio as Blob
- `startRecording()` - Start recording
- `stopRecording()` - Stop and get blob
- `clearRecording()` - Clear recorded audio

---

### useBookingData
Real-time booking ticket data with automatic polling.

```typescript
const {
  appointment,
  patient,
  vitals,
  consultation,
  labOrders,
  timeline,
  riskPrediction,
  isLoading,
  refetch,
} = useBookingData(appointmentId);
```

**Features:**
- Polls every 15-30 seconds
- Returns unified booking ticket data
- Includes patient history
- Real-time sync across roles

**Usage:**
```typescript
function BookingTicketView({ appointmentId }) {
  const { appointment, patient, vitals, labOrders, isLoading } = useBookingData(appointmentId);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PatientInfo patient={patient} />
      <VitalsSummary vitals={vitals} />
      <LabOrdersList orders={labOrders} />
    </div>
  );
}
```

---

### useEarlyWarning
NEWS2 scoring and early warning system integration.

```typescript
const {
  calculateNEWS2,
  getRiskLevel,
  getEscalationPath,
  patients,
  isLoading,
} = useEarlyWarning();
```

**Features:**
- NEWS2 score calculation from vitals
- Risk level determination
- Escalation pathway suggestions
- High-risk patient monitoring

**NEWS2 Parameters:**
- Respiratory rate
- Oxygen saturation
- Supplemental oxygen
- Temperature
- Systolic BP
- Heart rate
- Level of consciousness

---

### useSymptomChecker
Interactive symptom assessment workflow.

```typescript
const {
  session,
  questions,
  currentQuestion,
  responses,
  result,
  startSession,
  answerQuestion,
  completeAssessment,
  isLoading,
} = useSymptomChecker();
```

**Flow:**
1. `startSession(patientInfo)` - Initialize session
2. Answer questions as they appear
3. `answerQuestion(questionId, answer)` - Submit answer
4. System navigates through symptom tree
5. `completeAssessment()` - Get final triage result

---

### useHybridVoice
Voice command processing and navigation.

```typescript
const {
  isListening,
  transcript,
  command,
  startListening,
  stopListening,
  processCommand,
} = useHybridVoice();
```

**Features:**
- Speech recognition via browser API
- Command extraction and routing
- Navigation commands support

---

### useVoiceRecognition
Browser Speech Recognition API wrapper.

```typescript
const {
  isListening,
  transcript,
  startListening,
  stopListening,
  resetTranscript,
  isSupported,
} = useVoiceRecognition();
```

**Browser Support:**
- Chrome, Edge: Full support
- Safari: Partial support
- Firefox: Not supported

---

### useTheme
Dark/light mode theme switching.

```typescript
const { theme, toggleTheme, setTheme } = useTheme();
```

**Features:**
- Persists preference to localStorage
- Respects system preference
- Applies Tailwind dark mode class

## Common Patterns

### Hook with TanStack Query
```typescript
export function useMyData(id: string) {
  const query = useQuery({
    queryKey: ['myData', id],
    queryFn: () => api.getData(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
```

### Hook with Mutation
```typescript
export function useMyAction() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.performAction,
    onSuccess: () => {
      queryClient.invalidateQueries(['myData']);
      toast.success('Action completed');
    },
    onError: (error) => {
      toast.error('Action failed');
    },
  });

  return {
    performAction: mutation.mutate,
    isLoading: mutation.isPending,
  };
}
```

### Hook with Polling
```typescript
export function useLiveData() {
  const query = useQuery({
    queryKey: ['liveData'],
    queryFn: fetchLiveData,
    refetchInterval: 15000, // Poll every 15s
    refetchIntervalInBackground: false, // Stop when tab not visible
  });

  return query;
}
```

## Dependencies

### Internal
- `@/services/api` - API client
- `@/store` - Redux store

### External
- `@tanstack/react-query` - Data fetching
- `react-redux` - Redux hooks

## Common Operations

### Creating a New Hook

```typescript
// hooks/useMyFeature.ts
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { myApi } from '@/services/api';

export function useMyFeature(id: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['myFeature', id],
    queryFn: () => myApi.get(id),
  });

  const mutation = useMutation({
    mutationFn: myApi.update,
    onSuccess: () => {
      queryClient.invalidateQueries(['myFeature', id]);
    },
  });

  return {
    data,
    isLoading,
    error,
    update: mutation.mutate,
    isUpdating: mutation.isPending,
  };
}
```

## Related Files

- `/src/services/api.ts` - API client used by hooks
- `/src/store/` - Redux store for auth state
- `/src/components/` - Components that consume hooks

## Testing

Hooks are tested with @testing-library/react-hooks:
```bash
npm test -- hooks/
```

## Common Issues

### Issue: Hook returns stale data
- Check query key includes all dependencies
- Verify cache invalidation on mutations
- Use `refetch()` for manual refresh

### Issue: Infinite re-renders
- Ensure callbacks are memoized with `useCallback`
- Check dependency arrays
- Avoid objects/arrays as deps without useMemo

### Issue: Browser API not supported
- Check `isSupported` flag for voice hooks
- Provide fallback UI
- Test in supported browsers (Chrome/Edge for speech)
