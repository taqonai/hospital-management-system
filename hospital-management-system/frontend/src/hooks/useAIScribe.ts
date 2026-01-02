import { useState, useCallback, useRef } from 'react';

const AI_SCRIBE_URL = import.meta.env.VITE_AI_SCRIBE_URL || 'http://localhost:8011';

// Types
export interface TranscriptSegment {
  speaker: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

export interface MedicalEntity {
  type: string;
  value: string;
  confidence: number;
  context?: string;
}

export interface IcdCodeSuggestion {
  code: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  supportingText: string;
  selected?: boolean;
}

export interface CptCodeSuggestion {
  code: string;
  description: string;
  confidence: 'high' | 'medium' | 'low';
  category: string;
  selected?: boolean;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface ExtractedEntities {
  symptoms: MedicalEntity[];
  diagnoses: MedicalEntity[];
  medications: MedicalEntity[];
  vitals: MedicalEntity[];
  procedures: MedicalEntity[];
  allergies: MedicalEntity[];
}

export interface TranscriptionResult {
  sessionId: string;
  status: string;
  transcript: TranscriptSegment[];
  fullTranscript: string;
  duration: number;
  processedAt: string;
}

export interface NoteGenerationResult {
  soapNote: SoapNote;
  keyFindings: string[];
  icdCodes: IcdCodeSuggestion[];
  cptCodes: CptCodeSuggestion[];
  modelVersion: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntities;
  confidence: number;
}

export interface SaveNoteResult {
  success: boolean;
  noteId: string;
  savedAt: string;
}

// Hook: useTranscription - Handle audio recording and transcription
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [fullTranscript, setFullTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setIsRecording(false);
        setIsPaused(false);
      };

      mediaRecorder.start(100);
      startTimeRef.current = Date.now();
      setIsRecording(true);
      setDuration(0);

      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access microphone');
    }
  }, [getSupportedMimeType]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      const pausedDuration = duration;
      startTimeRef.current = Date.now() - pausedDuration;
      durationIntervalRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 100);
    }
  }, [duration]);

  const clearRecording = useCallback(() => {
    setAudioBlob(null);
    setTranscript([]);
    setFullTranscript('');
    setDuration(0);
    setError(null);
    chunksRef.current = [];
  }, []);

  const transcribeAudio = useCallback(async (sessionId: string, blob: Blob): Promise<TranscriptionResult | null> => {
    setIsTranscribing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('audio', blob, 'recording.webm');

      const response = await fetch(`${AI_SCRIBE_URL}/api/scribe/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Transcription failed');
      }

      const result: TranscriptionResult = await response.json();
      setTranscript(result.transcript);
      setFullTranscript(result.fullTranscript);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  return {
    isRecording,
    isPaused,
    isTranscribing,
    transcript,
    fullTranscript,
    error,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    clearRecording,
    transcribeAudio,
    setTranscript,
    setFullTranscript,
  };
}

// Hook: useNoteGeneration - Generate clinical notes from transcription
export function useNoteGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [soapNote, setSoapNote] = useState<SoapNote | null>(null);
  const [keyFindings, setKeyFindings] = useState<string[]>([]);
  const [icdCodes, setIcdCodes] = useState<IcdCodeSuggestion[]>([]);
  const [cptCodes, setCptCodes] = useState<CptCodeSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateNote = useCallback(async (
    sessionId: string,
    noteType: string,
    transcript: string,
    patientContext?: {
      patientId?: string;
      patientName?: string;
      chiefComplaint?: string;
    }
  ): Promise<NoteGenerationResult | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${AI_SCRIBE_URL}/api/scribe/generate-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          noteType,
          transcript,
          patientContext,
          generateSoapNote: true,
          suggestIcdCodes: true,
          suggestCptCodes: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Note generation failed');
      }

      const result: NoteGenerationResult = await response.json();
      setSoapNote(result.soapNote);
      setKeyFindings(result.keyFindings || []);
      setIcdCodes(result.icdCodes || []);
      setCptCodes(result.cptCodes || []);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Note generation failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const updateSoapNote = useCallback((updates: Partial<SoapNote>) => {
    setSoapNote((prev) => prev ? { ...prev, ...updates } : null);
  }, []);

  const toggleIcdCode = useCallback((code: string) => {
    setIcdCodes((prev) =>
      prev.map((icd) =>
        icd.code === code ? { ...icd, selected: !icd.selected } : icd
      )
    );
  }, []);

  const toggleCptCode = useCallback((code: string) => {
    setCptCodes((prev) =>
      prev.map((cpt) =>
        cpt.code === code ? { ...cpt, selected: !cpt.selected } : cpt
      )
    );
  }, []);

  const clearNote = useCallback(() => {
    setSoapNote(null);
    setKeyFindings([]);
    setIcdCodes([]);
    setCptCodes([]);
    setError(null);
  }, []);

  return {
    isGenerating,
    soapNote,
    keyFindings,
    icdCodes,
    cptCodes,
    error,
    generateNote,
    updateSoapNote,
    toggleIcdCode,
    toggleCptCode,
    clearNote,
    setSoapNote,
    setIcdCodes,
    setCptCodes,
  };
}

// Hook: useEntityExtraction - Extract clinical entities from text
export function useEntityExtraction() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [entities, setEntities] = useState<ExtractedEntities | null>(null);
  const [error, setError] = useState<string | null>(null);

  const extractEntities = useCallback(async (
    text: string,
    sessionId?: string
  ): Promise<EntityExtractionResult | null> => {
    setIsExtracting(true);
    setError(null);

    try {
      const response = await fetch(`${AI_SCRIBE_URL}/api/scribe/extract-entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          sessionId,
          extractSymptoms: true,
          extractDiagnoses: true,
          extractMedications: true,
          extractVitals: true,
          extractProcedures: true,
          extractAllergies: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Entity extraction failed');
      }

      const result: EntityExtractionResult = await response.json();
      setEntities(result.entities);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Entity extraction failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const clearEntities = useCallback(() => {
    setEntities(null);
    setError(null);
  }, []);

  return {
    isExtracting,
    entities,
    error,
    extractEntities,
    clearEntities,
    setEntities,
  };
}

// Hook: useSaveNote - Save generated note to patient record
export function useSaveNote() {
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const saveNote = useCallback(async (
    patientId: string,
    noteData: {
      sessionId: string;
      soapNote: SoapNote;
      noteType: string;
      icdCodes?: string[];
      cptCodes?: string[];
      entities?: ExtractedEntities;
      transcript?: string;
    }
  ): Promise<SaveNoteResult | null> => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch(`${AI_SCRIBE_URL}/api/scribe/save-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          ...noteData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to save note');
      }

      const result: SaveNoteResult = await response.json();
      setSaveSuccess(true);
      setSavedNoteId(result.noteId);

      // Auto-reset success state after 5 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 5000);

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save note';
      setError(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const resetSaveState = useCallback(() => {
    setSaveSuccess(false);
    setSavedNoteId(null);
    setError(null);
  }, []);

  return {
    isSaving,
    saveSuccess,
    savedNoteId,
    error,
    saveNote,
    resetSaveState,
  };
}

// Combined hook for full AI Scribe workflow
export function useAIScribe() {
  const transcription = useTranscription();
  const noteGeneration = useNoteGeneration();
  const entityExtraction = useEntityExtraction();
  const saveNote = useSaveNote();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const checkServiceStatus = useCallback(async () => {
    setServiceStatus('checking');
    try {
      const response = await fetch(`${AI_SCRIBE_URL}/health`);
      if (response.ok) {
        const data = await response.json();
        setServiceStatus(data.openai_available ? 'online' : 'offline');
      } else {
        setServiceStatus('offline');
      }
    } catch {
      setServiceStatus('offline');
    }
  }, []);

  const startSession = useCallback(async (
    patientId?: string,
    patientName?: string,
    sessionType?: string
  ): Promise<string | null> => {
    try {
      const response = await fetch(`${AI_SCRIBE_URL}/api/scribe/start-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          patientName,
          sessionType,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start session');
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      return data.sessionId;
    } catch {
      return null;
    }
  }, []);

  const processRecording = useCallback(async (
    audioBlob: Blob,
    noteType: string,
    patientContext?: {
      patientId?: string;
      patientName?: string;
    }
  ) => {
    // Start session if not already started
    let currentSessionId = sessionId;
    if (!currentSessionId) {
      currentSessionId = await startSession(
        patientContext?.patientId,
        patientContext?.patientName,
        `consultation-${noteType}`
      );
    }

    if (!currentSessionId) {
      throw new Error('Failed to start session');
    }

    // Transcribe audio
    const transcriptionResult = await transcription.transcribeAudio(currentSessionId, audioBlob);
    if (!transcriptionResult) {
      throw new Error('Transcription failed');
    }

    // Generate note
    const noteResult = await noteGeneration.generateNote(
      currentSessionId,
      noteType,
      transcriptionResult.fullTranscript,
      patientContext
    );
    if (!noteResult) {
      throw new Error('Note generation failed');
    }

    // Extract entities
    await entityExtraction.extractEntities(transcriptionResult.fullTranscript, currentSessionId);

    return {
      sessionId: currentSessionId,
      transcription: transcriptionResult,
      note: noteResult,
    };
  }, [sessionId, startSession, transcription, noteGeneration, entityExtraction]);

  const resetAll = useCallback(() => {
    transcription.clearRecording();
    noteGeneration.clearNote();
    entityExtraction.clearEntities();
    saveNote.resetSaveState();
    setSessionId(null);
  }, [transcription, noteGeneration, entityExtraction, saveNote]);

  return {
    // Session
    sessionId,
    serviceStatus,
    checkServiceStatus,
    startSession,
    processRecording,
    resetAll,

    // Transcription
    ...transcription,

    // Note Generation
    isGenerating: noteGeneration.isGenerating,
    soapNote: noteGeneration.soapNote,
    keyFindings: noteGeneration.keyFindings,
    icdCodes: noteGeneration.icdCodes,
    cptCodes: noteGeneration.cptCodes,
    generateNote: noteGeneration.generateNote,
    updateSoapNote: noteGeneration.updateSoapNote,
    toggleIcdCode: noteGeneration.toggleIcdCode,
    toggleCptCode: noteGeneration.toggleCptCode,
    setSoapNote: noteGeneration.setSoapNote,
    setIcdCodes: noteGeneration.setIcdCodes,
    setCptCodes: noteGeneration.setCptCodes,

    // Entity Extraction
    isExtracting: entityExtraction.isExtracting,
    entities: entityExtraction.entities,
    extractEntities: entityExtraction.extractEntities,
    setEntities: entityExtraction.setEntities,

    // Save Note
    isSaving: saveNote.isSaving,
    saveSuccess: saveNote.saveSuccess,
    savedNoteId: saveNote.savedNoteId,
    saveNoteToRecord: saveNote.saveNote,
  };
}

export default useAIScribe;
