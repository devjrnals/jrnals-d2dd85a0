import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Mic, Monitor, Radio, Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AudioSource = "mic" | "screen" | "both";

type TranscribeNotesProps = {
  open: boolean;
  onClose: () => void;
  onAddToJournal: (transcript: string) => void;
};

export function TranscribeNotes({ open, onClose, onAddToJournal }: TranscribeNotesProps) {
  const [audioSource, setAudioSource] = useState<AudioSource>("screen");
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);

  useEffect(() => {
    console.log("TranscribeNotes open state:", open);
  }, [open]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check for browser support
  const hasSpeechRecognition = typeof window !== "undefined" && 
    (window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  
  const SpeechRecognition = hasSpeechRecognition 
    ? (window.SpeechRecognition || (window as any).webkitSpeechRecognition)
    : null;

  useEffect(() => {
    if (!open) {
      // Cleanup when closing
      stopRecording();
      setTranscript("");
      setIsRecording(false);
      setIsTranscribing(false);
    }
  }, [open]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  };

  const startRecording = async () => {
    try {
      setIsRecording(true);
      setTranscript("");
      setIsTranscribing(true);

      let stream: MediaStream | null = null;

      if (audioSource === "mic") {
        // Request microphone access
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } else if (audioSource === "screen") {
        // Request screen share with audio
        stream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
      } else if (audioSource === "both") {
        // Get both microphone and screen audio
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });
        
        // Combine audio tracks
        const audioContext = new AudioContext();
        const micSource = audioContext.createMediaStreamSource(micStream);
        const screenSource = audioContext.createMediaStreamSource(screenStream);
        const destination = audioContext.createMediaStreamDestination();
        
        micSource.connect(destination);
        screenSource.connect(destination);
        
        stream = destination.stream;
      }

      if (!stream) {
        throw new Error("Failed to get media stream");
      }

      streamRef.current = stream;

      // Use Web Speech API for real-time transcription if available
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        let finalTranscript = "";

        recognition.onresult = (event: any) => {
          let interimTranscript = "";
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }

          setTranscript(finalTranscript + interimTranscript);
        };

        recognition.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error);
          if (event.error === "no-speech" || event.error === "aborted") {
            // These are common and can be ignored
            return;
          }
          setIsTranscribing(false);
        };

        recognition.onend = () => {
          setIsTranscribing(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
      } else {
        // Fallback: Record audio and show message
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          setIsTranscribing(false);
          // Note: In a real implementation, you would send the audio to a transcription service
          // For now, we'll use the Web Speech API which works in real-time
        };

        mediaRecorder.start();
        setTranscript("Recording... (Speech recognition not available in this browser)");
      }

      // Handle stream end (e.g., user stops sharing screen)
      stream.getTracks().forEach(track => {
        track.onended = () => {
          stopRecording();
        };
      });

    } catch (error: any) {
      console.error("Error starting recording:", error);
      setIsRecording(false);
      setIsTranscribing(false);
      setTranscript(`Error: ${error.message || "Failed to start recording"}`);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const handleCopyTranscript = () => {
    if (transcript) {
      navigator.clipboard.writeText(transcript);
    }
  };

  const handleAddToJournal = () => {
    if (transcript.trim()) {
      onAddToJournal(transcript);
      onClose();
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div className="fixed inset-0 z-[100]">
      <button
        aria-label="Close transcription"
        className="absolute inset-0 bg-background/35 backdrop-blur-sm"
        onMouseDown={onClose}
      />

      <div
        className={cn(
          "absolute left-1/2 top-24 w-[min(600px,calc(100%-2rem))] -translate-x-1/2",
          "rounded-2xl border border-border/60 shadow-2xl",
          "bg-background/70 supports-[backdrop-filter]:backdrop-blur-2xl",
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Transcribe Notes"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold">Audio Source</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Audio Source Selection */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => setAudioSource("mic")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                audioSource === "mic"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              <Mic className="w-4 h-4" />
              <span>Mic</span>
            </button>
            <button
              onClick={() => setAudioSource("screen")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                audioSource === "screen"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              <Monitor className="w-4 h-4" />
              <span>Screen</span>
            </button>
            <button
              onClick={() => setAudioSource("both")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors",
                audioSource === "both"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted"
              )}
            >
              <Radio className="w-4 h-4" />
              <span>Both</span>
            </button>
          </div>

          {/* Instructions */}
          <div className="mb-6 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            {audioSource === "screen" || audioSource === "both" ? (
              <p>
                Click "Start Recording" to select a tab or window with audio. Make sure to check "Share tab audio" in the dialog.
              </p>
            ) : (
              <p>
                Click "Start Recording" to begin transcribing from your microphone.
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mb-6">
            {!isRecording ? (
              <Button
                onClick={startRecording}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={handleStopRecording}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                Stop Recording
              </Button>
            )}
            <Button
              onClick={handleAddToJournal}
              disabled={!transcript.trim()}
              variant="outline"
              className="flex-1"
            >
              Add to Journal
            </Button>
          </div>

          {/* Transcript Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">Transcript</h3>
              {transcript && (
                <button
                  onClick={handleCopyTranscript}
                  className="p-1 hover:bg-muted rounded-md transition-colors"
                  title="Copy transcript"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="min-h-[200px] max-h-[400px] overflow-y-auto p-4 bg-muted/30 rounded-lg border border-border/60">
              {transcript ? (
                <p className="text-sm whitespace-pre-wrap">{transcript}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No transcript available</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render in a portal to ensure it's above all other content
  return typeof document !== "undefined" 
    ? createPortal(content, document.body)
    : null;
}

