import React, { useState, useRef } from 'react';
import { Mic, MicOff, Play, Pause, Trash2, Square } from 'lucide-react';
import lamejs from 'lamejs';

function getSupportedAudioType() {
  // Chrome/Edge: prefer wav, fallback to webm
  if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav';
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
  if (MediaRecorder.isTypeSupported('audio/ogg')) return 'audio/ogg';
  return '';
}

const AudioRecorder = ({ onRecordingComplete, onClear, audioBlob }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionError, setConversionError] = useState(null);
  const [recordedMimeType, setRecordedMimeType] = useState(null);
  const [detailedError, setDetailedError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      setConversionError(null);
      setDetailedError(null);
      const mimeType = getSupportedAudioType();
      if (!mimeType) {
        setConversionError('Your browser does not support audio recording.');
        setDetailedError('No supported audio MIME type found.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      setRecordedMimeType(mimeType);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // Check file size (50MB limit)
        if (audioBlob.size > 50 * 1024 * 1024) {
          setConversionError('Audio file is too large. Please record a shorter message (max 50MB).');
          clearRecording();
          return;
        }
        setIsConverting(true);
        setConversionError(null);
        setDetailedError(null);
        // Only try MP3 conversion if WAV PCM 16-bit
        if (mimeType === 'audio/wav') {
          try {
            const wavBuffer = await audioBlob.arrayBuffer();
            const wavView = new DataView(wavBuffer);
            // Parse WAV header
            const readString = (offset, length) => {
              let str = '';
              for (let i = 0; i < length; i++) {
                str += String.fromCharCode(wavView.getUint8(offset + i));
              }
              return str;
            };
            if (readString(0, 4) !== 'RIFF' || readString(8, 4) !== 'WAVE') {
              throw new Error('Invalid WAV file format');
            }
            // Find "fmt " and "data" chunks
            let offset = 12;
            let fmtChunkFound = false;
            let dataChunkOffset = -1;
            let dataChunkSize = 0;
            let numChannels = 1;
            let sampleRate = 44100;
            let bitsPerSample = 16;
            while (offset < wavView.byteLength) {
              const chunkId = readString(offset, 4);
              const chunkSize = wavView.getUint32(offset + 4, true);
              if (chunkId === 'fmt ') {
                fmtChunkFound = true;
                numChannels = wavView.getUint16(offset + 10, true);
                sampleRate = wavView.getUint32(offset + 12, true);
                bitsPerSample = wavView.getUint16(offset + 22, true);
              } else if (chunkId === 'data') {
                dataChunkOffset = offset + 8;
                dataChunkSize = chunkSize;
                break;
              }
              offset += 8 + chunkSize;
            }
            if (!fmtChunkFound || dataChunkOffset === -1) {
              throw new Error('WAV file missing fmt or data chunk');
            }
            if (bitsPerSample !== 16) {
              throw new Error('Only 16-bit PCM WAV is supported for MP3 conversion.');
            }
            // Get PCM samples
            let samples = new Int16Array(wavBuffer, dataChunkOffset, dataChunkSize / 2);
            // Encode to MP3
            const mp3Encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, 128);
            const mp3Data = [];
            const samplesPerFrame = 1152;
            for (let i = 0; i < samples.length; i += samplesPerFrame) {
              const chunk = samples.subarray(i, i + samplesPerFrame);
              const mp3buf = mp3Encoder.encodeBuffer(chunk);
              if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            }
            const mp3buf = mp3Encoder.flush();
            if (mp3buf.length > 0) mp3Data.push(new Uint8Array(mp3buf));
            const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' });
            const url = URL.createObjectURL(mp3Blob);
            setAudioUrl(url);
            onRecordingComplete(mp3Blob);
          } catch (err) {
            setConversionError('Audio conversion failed. Your browser may not support WAV PCM 16-bit.');
            setDetailedError(err.message);
            const url = URL.createObjectURL(audioBlob);
            setAudioUrl(url);
            onRecordingComplete(audioBlob);
          } finally {
            setIsConverting(false);
          }
        } else {
          // For webm/ogg fallback, do not attempt MP3 conversion
          setConversionError('MP3 conversion is not supported in this browser. The original format will be used.');
          setDetailedError('Recorded format: ' + mimeType);
          const url = URL.createObjectURL(audioBlob);
          setAudioUrl(url);
          onRecordingComplete(audioBlob);
          setIsConverting(false);
        }
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setConversionError('Microphone access denied or not available.');
      setDetailedError(error.message);
      console.error('Error accessing microphone:', error);
      alert('Please allow microphone access to record audio.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const clearRecording = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    onClear();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {!audioUrl ? (
        <div className="flex items-center space-x-4">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-4 rounded-full transition-colors ${
              isRecording 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-primary-600 hover:bg-primary-700 text-white'
            }`}
          >
            {isRecording ? <Square className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </button>
          
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-700">
              {isRecording ? 'Recording...' : 'Click to start recording'}
            </div>
            {isRecording && (
              <div className="text-lg font-mono text-primary-600">
                {formatTime(recordingTime)}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={isPlaying ? pauseAudio : playAudio}
              className="p-3 bg-primary-600 hover:bg-primary-700 text-white rounded-full"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-700">Audio recorded</div>
              <div className="text-sm text-gray-500">Click to play/pause</div>
            </div>
            
            <button
              type="button"
              onClick={clearRecording}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-full"
              title="Clear recording"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
          
          {isConverting && (
            <div className="text-sm text-blue-600">Converting audio to mp3, please wait...</div>
          )}
          {conversionError && (
            <div className="text-sm text-red-600">{conversionError}</div>
          )}
          {detailedError && (
            <div className="text-xs text-gray-400">{detailedError}</div>
          )}

          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={handleAudioEnded}
            className="w-full"
            controls
          />
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        {!audioUrl ? (
          <p>Record your voice message. Click the microphone to start recording.</p>
        ) : (
          <p>Your audio message is ready. You can play it back or record a new one.</p>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder; 