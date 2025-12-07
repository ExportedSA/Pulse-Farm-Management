import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { 
  Mic, MicOff, Square, Play, Pause, Trash2, Loader2, 
  Clock, Volume2, Download, FileAudio
} from "lucide-react";
import { format } from "date-fns";
import type { VoiceNote } from "@shared/schema";

interface VoiceRecorderProps {
  animalId?: string;
  treatmentId?: string;
  onRecordingComplete?: (note: VoiceNote) => void;
  showExisting?: boolean;
}

export function VoiceRecorder({
  animalId,
  treatmentId,
  onRecordingComplete,
  showExisting = true,
}: VoiceRecorderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  
  // Dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [selectedNote, setSelectedNote] = useState<VoiceNote | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch existing voice notes
  const queryKey = animalId 
    ? ["/api/voice-notes/animal", animalId]
    : treatmentId 
    ? ["/api/voice-notes/treatment", treatmentId]
    : null;

  const { data: existingNotes = [], isLoading: loadingNotes } = useQuery<VoiceNote[]>({
    queryKey: queryKey || ["no-notes"],
    queryFn: async () => {
      if (!queryKey) return [];
      const endpoint = animalId 
        ? `/api/voice-notes/animal/${animalId}`
        : `/api/voice-notes/treatment/${treatmentId}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Failed to fetch voice notes");
      return res.json();
    },
    enabled: showExisting && !!(animalId || treatmentId),
  });

  // Upload and save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!audioBlob) throw new Error("No recording to save");

      // First upload the audio file
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const uploadRes = await fetch("/api/voice-notes/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload audio");
      const uploadData = await uploadRes.json();

      // Then create the voice note record
      const noteRes = await fetch("/api/voice-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId: animalId || null,
          treatmentId: treatmentId || null,
          audioUrl: uploadData.url,
          duration: recordingTime,
          fileSize: audioBlob.size,
          mimeType: audioBlob.type,
          transcription: transcription || null,
          isTranscribed: !!transcription,
          recordedBy: user?.id,
        }),
      });

      if (!noteRes.ok) throw new Error("Failed to save voice note");
      return noteRes.json();
    },
    onSuccess: (data) => {
      toast.success("Voice note saved");
      resetRecording();
      setShowSaveDialog(false);
      setTranscription("");
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      onRecordingComplete?.(data);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save voice note");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const res = await fetch(`/api/voice-notes/${noteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete voice note");
    },
    onSuccess: () => {
      toast.success("Voice note deleted");
      if (queryKey) {
        queryClient.invalidateQueries({ queryKey });
      }
      setSelectedNote(null);
      setShowDetailDialog(false);
    },
    onError: () => {
      toast.error("Failed to delete voice note");
    },
  });

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Pause/Resume recording
  const togglePause = () => {
    if (mediaRecorderRef.current) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      } else {
        mediaRecorderRef.current.pause();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
      }
      setIsPaused(!isPaused);
    }
  };

  // Reset recording
  const resetRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsRecording(false);
    setIsPaused(false);
  };

  // Play audio
  const playAudio = (url: string, noteId?: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(url);
    audioRef.current = audio;
    
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingNoteId(null);
    };
    
    audio.play();
    setIsPlaying(true);
    if (noteId) setPlayingNoteId(noteId);
  };

  // Stop playback
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setPlayingNoteId(null);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioRef.current) audioRef.current.pause();
    };
  }, [audioUrl]);

  return (
    <div className="space-y-4">
      {/* Recording Section */}
      <div className="space-y-3">
        <Label>Voice Note</Label>
        
        {!audioBlob ? (
          <Card className="p-4">
            <div className="flex flex-col items-center gap-4">
              {/* Recording indicator */}
              {isRecording && (
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                  <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
                  <Badge variant={isPaused ? "secondary" : "destructive"}>
                    {isPaused ? "Paused" : "Recording"}
                  </Badge>
                </div>
              )}

              {/* Controls */}
              <div className="flex items-center gap-3">
                {!isRecording ? (
                  <Button
                    onClick={startRecording}
                    size="lg"
                    className="bg-red-500 hover:bg-red-600"
                  >
                    <Mic className="h-5 w-5 mr-2" />
                    Start Recording
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={togglePause}
                      variant="outline"
                      size="lg"
                    >
                      {isPaused ? (
                        <>
                          <Mic className="h-5 w-5 mr-2" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="h-5 w-5 mr-2" />
                          Pause
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={stopRecording}
                      variant="destructive"
                      size="lg"
                    >
                      <Square className="h-5 w-5 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>

              {!isRecording && (
                <p className="text-sm text-muted-foreground text-center">
                  Click to start recording a voice note
                </p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-4 space-y-4">
            {/* Playback controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => isPlaying && !playingNoteId ? stopPlayback() : playAudio(audioUrl!)}
                >
                  {isPlaying && !playingNoteId ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{formatTime(recordingTime)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetRecording}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Save button */}
            <Button
              onClick={() => setShowSaveDialog(true)}
              className="w-full"
            >
              Save Voice Note
            </Button>
          </Card>
        )}
      </div>

      {/* Existing Voice Notes */}
      {showExisting && existingNotes.length > 0 && (
        <div className="space-y-2">
          <Label>Recorded Notes ({existingNotes.length})</Label>
          <div className="space-y-2">
            {existingNotes.map((note) => (
              <Card
                key={note.id}
                className="p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSelectedNote(note);
                  setShowDetailDialog(true);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (playingNoteId === note.id) {
                          stopPlayback();
                        } else {
                          playAudio(note.audioUrl, note.id);
                        }
                      }}
                    >
                      {playingNoteId === note.id && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                    <div>
                      <div className="flex items-center gap-2">
                        <FileAudio className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {format(new Date(note.recordedAt), "MMM d, h:mm a")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {note.duration ? formatTime(note.duration) : "—"}
                        {note.isTranscribed && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            Transcribed
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {showExisting && existingNotes.length === 0 && !loadingNotes && !audioBlob && (
        <div className="text-center py-6 text-muted-foreground">
          <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No voice notes yet</p>
        </div>
      )}

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Voice Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
              <FileAudio className="h-5 w-5" />
              <div>
                <p className="font-medium">Recording</p>
                <p className="text-sm text-muted-foreground">
                  Duration: {formatTime(recordingTime)}
                </p>
              </div>
            </div>
            
            <div>
              <Label>Transcription (optional)</Label>
              <Textarea
                placeholder="Add a text transcription of this recording..."
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Adding a transcription makes the note searchable
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Voice Note</DialogTitle>
          </DialogHeader>
          {selectedNote && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-md">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (playingNoteId === selectedNote.id) {
                      stopPlayback();
                    } else {
                      playAudio(selectedNote.audioUrl, selectedNote.id);
                    }
                  }}
                >
                  {playingNoteId === selectedNote.id && isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
                <div>
                  <p className="font-medium">
                    {format(new Date(selectedNote.recordedAt), "MMMM d, yyyy h:mm a")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Duration: {selectedNote.duration ? formatTime(selectedNote.duration) : "Unknown"}
                  </p>
                </div>
              </div>

              {selectedNote.transcription && (
                <div>
                  <Label className="text-muted-foreground">Transcription</Label>
                  <p className="mt-1 text-sm p-3 bg-muted rounded-md">
                    {selectedNote.transcription}
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {selectedNote.fileSize && (
                  <span>{(selectedNote.fileSize / 1024).toFixed(1)} KB</span>
                )}
                {selectedNote.mimeType && (
                  <span>• {selectedNote.mimeType}</span>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={() => selectedNote && deleteMutation.mutate(selectedNote.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default VoiceRecorder;
