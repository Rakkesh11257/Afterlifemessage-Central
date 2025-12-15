import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Mic, MicOff, Play, Pause, Trash2, Calendar, Clock, Mail, Heart, Video, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import AudioRecorder from '../components/AudioRecorder';
import { messageAPI } from '../services/api';

const CreateMessage = () => {
  const [messageType, setMessageType] = useState('text');
  const [deliveryType, setDeliveryType] = useState('date');
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [videoRecorder, setVideoRecorder] = useState(null);
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedTemplate, setLoadedTemplate] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [totalFileSize, setTotalFileSize] = useState(0);
  const [mediaMimeType, setMediaMimeType] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm();
  const triggerValue = watch('triggerValue');

  // Handle template data from navigation
  useEffect(() => {
    if (location.state?.template) {
      const template = location.state.template;
      setLoadedTemplate(template);
      // Set message type if template has type
      if (template.type) {
        setMessageType(template.type);
      }
      // Set message content for text templates
      if (template.type === 'text' && template.content) {
        setValue('messageContent', template.content);
        toast.success(`Template "${template.name}" loaded!`);
      }
    }
  }, [location.state, setValue]);

  // Calculate price based on message type
  const getMessagePrice = () => {
    switch (messageType) {
      case 'video':
        return 199;
      case 'files':
        return 159;
      case 'audio':
      case 'text':
      default:
        return 99;
    }
  };

  const getMessageTypeName = () => {
    switch (messageType) {
      case 'video':
        return 'Video Message';
      case 'audio':
        return 'Voice Message';
      case 'text':
        return 'Text Message';
      case 'files':
        return 'Files Message';
      default:
        return 'Message';
    }
  };

  const onSubmit = async (data) => {
    // Check if recipient email is filled
    if (!data.recipientEmail) {
      toast.error('Please fill in recipient email');
      return;
    }

    // Check message content based on type
    if (messageType === 'text' && !data.messageContent) {
      toast.error('Please fill in message content');
      return;
    }

    if (messageType === 'audio' && !audioBlob) {
      toast.error('Please record your audio message');
      return;
    }

    if (messageType === 'video' && !videoBlob && !videoFile) {
      toast.error('Please record or upload your video message');
      return;
    }

    if (messageType === 'files' && selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    // Check delivery settings
    if (deliveryType === 'date' && !data.triggerValue) {
      toast.error('Please select a delivery date');
      return;
    }

    if (deliveryType === 'inactivity' && !data.inactivityMonths) {
      toast.error('Please select inactivity period');
      return;
    }

    setIsLoading(true);

    try {
      const messageData = {
        type: messageType,
        content: messageType === 'text' ? data.messageContent : null,
        audioBlob: messageType === 'audio' ? audioBlob : null,
        videoBlob: messageType === 'video' ? (videoBlob || videoFile) : null,
        files: messageType === 'files' ? selectedFiles : null,
        recipientEmail: data.recipientEmail,
        recipientMobile: data.recipientMobile, // Ensure this is sent
        deliveryType: deliveryType,
        deliveryMethods: data.deliveryMethods, // <-- new
        deliveryDate: deliveryType === 'date' ? data.triggerValue : undefined,
        triggerValue: deliveryType === 'date' ? data.triggerValue : (deliveryType === 'inactivity' ? data.inactivityMonths : undefined),
        message: data.messageContent || `${messageType === 'audio' ? 'Audio' : messageType === 'video' ? 'Video' : messageType === 'files' ? 'Files' : 'Text'} message`,
        mediaMimeType: mediaMimeType // Pass the detected MIME type
      };

      // Debug logging
      console.log('🔍 DEBUG - Creating message with data:', {
        type: messageData.type,
        mediaMimeType: messageData.mediaMimeType,
        hasVideoBlob: !!messageData.videoBlob,
        hasAudioBlob: !!messageData.audioBlob,
        hasFiles: !!messageData.files
      });

      // Call the real API to create the message
      const response = await messageAPI.createMessage(messageData);
      
      console.log('🔍 DEBUG - Message created successfully:', response);
      
      // Update user activity
      try {
        await messageAPI.updateActivity();
      } catch (error) {
        console.error('Error updating activity:', error);
      }
      
      toast.success('Message created successfully!');
      navigate('/success');
    } catch (error) {
      console.error('Error creating message:', error);
      toast.error('Failed to create message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioRecorded = (blob) => {
    setAudioBlob(blob);
    setMediaMimeType(blob.type || 'audio/webm');
    toast.success('Audio recorded successfully!');
  };

  const clearAudio = () => {
    setAudioBlob(null);
  };

  const handleVideoRecorded = (blob) => {
    setVideoBlob(blob);
    setMediaMimeType(blob.type || 'video/webm');
    toast.success('Video recorded successfully!');
  };

  const clearVideo = () => {
    setVideoBlob(null);
    setVideoFile(null);
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setIsVideoRecording(false);
  };

  const handleVideoUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxSize = 250 * 1024 * 1024; // 250MB total limit for videos
    
    let totalVideoSize = 0;
    const validVideos = [];
    
    for (const file of files) {
      // Check if it's a video file
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      
      const isVideo = fileType.startsWith('video/') || 
                     fileName.endsWith('.mp4') || fileName.endsWith('.mov') || 
                     fileName.endsWith('.avi') || fileName.endsWith('.mkv') ||
                     fileName.endsWith('.webm') || fileName.endsWith('.flv');
      
      if (!isVideo) {
        toast.error(`${file.name} is not a video file. Only video files are allowed.`);
        continue;
      }
      
      if (totalVideoSize + file.size > maxSize) {
        toast.error(`Cannot add ${file.name}. Total video size would exceed 250MB limit.`);
        continue;
      }
      validVideos.push(file);
      totalVideoSize += file.size;
    }
    
    if (validVideos.length > 0) {
      // For now, we'll use the first video file (keeping existing behavior)
      // In the future, we can extend this to handle multiple videos
      setVideoFile(validVideos[0]);
      setMediaMimeType(validVideos[0].type || 'video/mp4');
      if (validVideos.length > 1) {
        toast.success(`${validVideos.length} videos selected. Using the first video.`);
      } else {
        toast.success('Video uploaded successfully!');
      }
    }
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxSize = 100 * 1024 * 1024; // 100MB total limit for files
    
    let newTotalSize = totalFileSize;
    const validFiles = [];
    
    for (const file of files) {
      // Check file type - only allow images and documents
      const fileType = file.type.toLowerCase();
      const fileName = file.name.toLowerCase();
      
      // Allow images
      const isImage = fileType.startsWith('image/') || 
                     fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                     fileName.endsWith('.png') || fileName.endsWith('.gif') || 
                     fileName.endsWith('.bmp') || fileName.endsWith('.webp');
      
      // Allow documents
      const isDocument = fileType.includes('pdf') || fileType.includes('document') || 
                        fileType.includes('text') || fileType.includes('msword') ||
                        fileName.endsWith('.pdf') || fileName.endsWith('.doc') || 
                        fileName.endsWith('.docx') || fileName.endsWith('.txt') ||
                        fileName.endsWith('.rtf') || fileName.endsWith('.odt');
      
      if (!isImage && !isDocument) {
        toast.error(`${file.name} is not allowed. Only images and documents are permitted.`);
        continue;
      }
      
      if (newTotalSize + file.size > maxSize) {
        toast.error(`Cannot add ${file.name}. Total size would exceed 100MB limit.`);
        continue;
      }
      validFiles.push(file);
      newTotalSize += file.size;
    }
    
    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
      setTotalFileSize(newTotalSize);
      toast.success(`${validFiles.length} file(s) added successfully!`);
    }
  };

  const removeFile = (index) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setTotalFileSize(prev => prev - fileToRemove.size);
    toast.success('File removed successfully!');
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setTotalFileSize(0);
  };

  const startVideoRecording = async () => {
    try {
      // Request camera and microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 }
        }, 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      setVideoStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      // Find the best supported MIME type
      const mimeTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4',
        'video/ogg;codecs=theora,vorbis'
      ];
      
      let recorder = null;
      let selectedMimeType = null;
      
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          try {
            recorder = new MediaRecorder(stream, { 
              mimeType,
              videoBitsPerSecond: 2500000, // 2.5 Mbps
              audioBitsPerSecond: 128000   // 128 kbps
            });
            selectedMimeType = mimeType;
            console.log('🔍 DEBUG - Using MIME type:', mimeType);
            break;
          } catch (error) {
            console.log('🔍 DEBUG - Failed to create MediaRecorder with:', mimeType, error);
            continue;
          }
        }
      }
      
      if (!recorder) {
        throw new Error('No supported video format found. Please try uploading a video file instead.');
      }
      
      const chunks = [];
      let recordingStartTime = Date.now();
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
          console.log('🔍 DEBUG - Received chunk:', {
            size: event.data.size,
            type: event.data.type,
            timestamp: Date.now() - recordingStartTime
          });
        }
      };
      
      recorder.onstop = async () => {
        try {
          const recordingDuration = Date.now() - recordingStartTime;
          const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
          
          console.log('🔍 DEBUG - Recording completed:', {
            duration: recordingDuration,
            chunksCount: chunks.length,
            totalSize: totalSize,
            selectedMimeType: selectedMimeType
          });
          
          // Create blob with the selected MIME type
          const blob = new Blob(chunks, { type: selectedMimeType });
          
          // Validate the recorded video
          if (blob.size === 0) {
            throw new Error('Recording failed: Empty video data');
          }
          
          if (blob.size < 1024) { // Less than 1KB
            throw new Error('Recording failed: Video too small, please try again');
          }
          
          // Test the video blob before proceeding
          const testVideo = document.createElement('video');
          const testUrl = URL.createObjectURL(blob);
          
          await new Promise((resolve, reject) => {
            testVideo.onloadstart = () => console.log('🔍 DEBUG - Test video load started');
            testVideo.onloadeddata = () => {
              console.log('🔍 DEBUG - Test video loaded successfully');
              URL.revokeObjectURL(testUrl);
              resolve();
            };
            testVideo.onerror = (e) => {
              console.error('🔍 DEBUG - Test video error:', e.target.error);
              URL.revokeObjectURL(testUrl);
              reject(new Error('Recorded video is invalid. Please try again.'));
            };
            testVideo.src = testUrl;
            testVideo.load();
          });
          
          // If we get here, the video is valid
          handleVideoRecorded(blob);
          toast.success('Video recorded successfully!');
          
        } catch (error) {
          console.error('Video recording error:', error);
          toast.error(error.message || 'Video recording failed. Please try again.');
        } finally {
          stream.getTracks().forEach(track => track.stop());
          setVideoStream(null);
          setIsVideoRecording(false);
        }
      };
      
      recorder.onerror = (event) => {
        console.error('🔍 DEBUG - MediaRecorder error:', event);
        toast.error('Video recording failed. Please try again.');
        stream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
        setIsVideoRecording(false);
      };
      
      setVideoRecorder(recorder);
      recorder.start(1000); // Collect data every second
      setIsVideoRecording(true);
      toast.success('Video recording started!');
      
    } catch (error) {
      console.error('Error starting video recording:', error);
      if (error.name === 'NotAllowedError') {
        toast.error('Camera access denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        toast.error('No camera found. Please connect a camera and try again.');
      } else {
        toast.error('Unable to access camera. Please use file upload instead.');
      }
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorder && isVideoRecording) {
      videoRecorder.stop();
      toast.success('Video recording stopped!');
    }
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [videoStream]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Message</h1>
          <p className="text-gray-600">
            Leave a heartfelt message for your loved ones. It will be delivered when the time is right.
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Message Type Selection */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose Message Type</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setMessageType('text')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'text'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Mail className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium">Text Message</div>
                      <div className="text-sm text-gray-600">Write your heartfelt message</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">₹99</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMessageType('audio')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'audio'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Mic className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium">Voice Message</div>
                      <div className="text-sm text-gray-600">Record your voice message</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">₹99</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMessageType('video')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'video'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Video className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium">Video Message</div>
                      <div className="text-sm text-gray-600">Record or upload video</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">₹199</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMessageType('files')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'files'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Upload className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium">Files Message</div>
                      <div className="text-sm text-gray-600">Upload images & documents (100MB max)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">₹159</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Message Content */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Your Message</h3>
                {loadedTemplate && (
                  <div className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    <span className="text-green-700 text-sm font-medium">📝 Template Loaded</span>
                    <span className="text-green-600 text-sm">"{loadedTemplate.name}"</span>
                    <button
                      type="button"
                      className="ml-2 text-xs text-red-600 hover:underline"
                      onClick={() => {
                        setLoadedTemplate(null);
                        setValue('messageContent', '');
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              
              {messageType === 'text' ? (
                <div>
                  <label htmlFor="messageContent" className="block text-sm font-medium text-gray-700 mb-2">
                    Write your message *
                  </label>
                  <textarea
                    id="messageContent"
                    {...register('messageContent', { 
                      required: messageType === 'text' ? 'Message content is required' : false,
                      minLength: messageType === 'text' ? {
                        value: 10,
                        message: 'Message must be at least 10 characters'
                      } : undefined
                    })}
                    rows={6}
                    className="input-field"
                    placeholder="Write your heartfelt message here... Share your love, wisdom, memories, or anything you want your loved ones to know."
                  />
                  {errors.messageContent && (
                    <p className="mt-1 text-sm text-red-600">{errors.messageContent.message}</p>
                  )}
                </div>
              ) : messageType === 'audio' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Record your voice message *
                  </label>
                  <AudioRecorder 
                    onRecordingComplete={handleAudioRecorded}
                    onClear={clearAudio}
                    audioBlob={audioBlob}
                  />
                </div>
              ) : messageType === 'video' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Video Message *
                  </label>
                  <div className="space-y-4">
                    {/* Video Recording */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Video className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-4">
                        Record a video message or upload an existing video file
                      </p>
                      
                      {/* Video Preview */}
                      {videoStream && (
                        <div className="mb-4">
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full max-h-64 rounded border"
                          />
                        </div>
                      )}
                      
                      {/* Recording Controls */}
                      <div className="flex justify-center space-x-4 mb-4">
                        <button
                          type="button"
                          onClick={isVideoRecording ? stopVideoRecording : startVideoRecording}
                          className={`btn-primary ${isVideoRecording ? 'bg-red-600 hover:bg-red-700' : ''}`}
                          disabled={videoFile || videoBlob}
                        >
                          <Video className="h-4 w-4 mr-2" />
                          {isVideoRecording ? 'Stop Recording' : 'Start Recording'}
                        </button>
                        
                        {(videoFile || videoBlob) && (
                          <button
                            type="button"
                            onClick={clearVideo}
                            className="btn-secondary"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear Video
                          </button>
                        )}
                      </div>
                      
                      {/* Recording Status */}
                      {isVideoRecording && (
                        <div className="flex items-center justify-center text-red-600">
                          <div className="animate-pulse w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                          Recording...
                        </div>
                      )}
                    </div>

                    {/* Video Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">
                        Upload video files (MP4, MOV, AVI, MKV, WebM, FLV) - Max 250MB total
                      </p>
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        onChange={handleVideoUpload}
                        className="hidden"
                        id="video-upload"
                        disabled={isVideoRecording}
                      />
                      <label
                        htmlFor="video-upload"
                        className={`btn-secondary cursor-pointer inline-flex items-center ${isVideoRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Video Files
                      </label>
                    </div>

                    {/* Video Preview */}
                    {(videoFile || videoBlob) && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            {videoFile ? videoFile.name : 'Recorded Video'}
                          </span>
                          <button
                            type="button"
                            onClick={clearVideo}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        {videoFile && (
                          <video
                            controls
                            className="w-full max-h-64 rounded"
                            src={URL.createObjectURL(videoFile)}
                          />
                        )}
                        {videoBlob && (
                          <video
                            controls
                            className="w-full max-h-64 rounded"
                            src={URL.createObjectURL(videoBlob)}
                          />
                        )}
                      </div>
                    )}

                    {/* Mobile Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">📱 Mobile Tips:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Use the front camera for personal messages</li>
                        <li>• Hold your device in landscape for better video</li>
                        <li>• Ensure good lighting for clear video</li>
                        <li>• Keep your message under 5 minutes for best results</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : messageType === 'files' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Files *
                  </label>
                  <div className="space-y-4">
                    {/* File Upload */}
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600 mb-2">
                        Upload images and documents only - Max 100MB total
                      </p>
                      <input
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt,.rtf,.odt"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="btn-secondary cursor-pointer inline-flex items-center"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choose Files
                      </label>
                    </div>

                    {/* File List */}
                    {selectedFiles.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="font-medium text-gray-900">Selected Files</h4>
                            <p className="text-sm text-gray-600">
                              Total size: {Math.round(totalFileSize / 1024 / 1024)}MB / 100MB
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={clearFiles}
                            className="btn-secondary"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Clear All
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white rounded p-3">
                              <div className="flex items-center space-x-3">
                                <Upload className="h-4 w-4 text-gray-400" />
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                                  <p className="text-xs text-gray-500">
                                    {Math.round(file.size / 1024 / 1024)}MB
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* File Upload Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">📁 File Upload Tips:</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• Supported: Images (JPG, PNG, GIF, BMP, WebP) and Documents (PDF, DOC, DOCX, TXT, RTF, ODT)</li>
                        <li>• Maximum total size: 100MB</li>
                        <li>• Files will be compressed into a ZIP archive</li>
                        <li>• Recipients can download the complete package</li>
                        <li>• Video files are not allowed here - use Video Message type instead</li>
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Recipient */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recipient</h3>
              <div>
                <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email *
                </label>
                <input
                  id="recipientEmail"
                  type="email"
                  {...register('recipientEmail', { 
                    required: 'Recipient email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  className="input-field"
                  placeholder="Enter recipient's email address"
                />
                {errors.recipientEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.recipientEmail.message}</p>
                )}
              </div>
              <div>
                <label htmlFor="recipientMobile" className="block text-sm font-medium text-gray-700">
                  Recipient Mobile (WhatsApp)
                </label>
                <input
                  id="recipientMobile"
                  type="text"
                  {...register('recipientMobile', {
                    pattern: {
                      value: /^[0-9]{10,15}$/,
                      message: 'Enter a valid mobile number'
                    }
                  })}
                  className="input-field"
                  placeholder="e.g. 919876543210"
                />
                {errors.recipientMobile && <span className="text-red-600 text-sm">{errors.recipientMobile.message}</span>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Method</label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center">
                    <input type="checkbox" value="email" {...register('deliveryMethods')} className="mr-2" />
                    Email
                  </label>
                  <label className="flex items-center">
                    <input type="checkbox" value="whatsapp" {...register('deliveryMethods')} className="mr-2" />
                    WhatsApp
                  </label>
                </div>
                {errors.deliveryMethods && <span className="text-red-600 text-sm">{errors.deliveryMethods.message}</span>}
              </div>
            </div>

            {/* Delivery Settings */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">When to Deliver</h3>
              
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <button
                  type="button"
                  onClick={() => setDeliveryType('date')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    deliveryType === 'date'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-6 w-6 text-primary-600" />
                    <div>
                      <div className="font-medium">Specific Date</div>
                      <div className="text-sm text-gray-600">Deliver on a chosen date</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryType('inactivity')}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    deliveryType === 'inactivity'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Clock className="h-6 w-6 text-primary-600" />
                    <div>
                      <div className="font-medium">Inactivity</div>
                      <div className="text-sm text-gray-600">Deliver after no login</div>
                    </div>
                  </div>
                </button>
              </div>

              {deliveryType === 'date' ? (
                <div>
                  <label htmlFor="triggerValue" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Date *
                  </label>
                  <input
                    id="triggerValue"
                    type="date"
                    {...register('triggerValue', { 
                      required: 'Delivery date is required',
                      validate: value => {
                        const selectedDate = new Date(value);
                        const today = new Date();
                        return selectedDate > today || 'Delivery date must be in the future';
                      }
                    })}
                    className="input-field"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.triggerValue && (
                    <p className="mt-1 text-sm text-red-600">{errors.triggerValue.message}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="inactivityMonths" className="block text-sm font-medium text-gray-700 mb-2">
                    Inactivity Period *
                  </label>
                  <select
                    id="inactivityMonths"
                    {...register('inactivityMonths', { 
                      required: 'Inactivity period is required'
                    })}
                    className="input-field"
                  >
                    <option value="">Select period</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                    <option value="18">18 months</option>
                    <option value="24">24 months</option>
                  </select>
                  {errors.inactivityMonths && (
                    <p className="mt-1 text-sm text-red-600">{errors.inactivityMonths.message}</p>
                  )}
                </div>
              )}
            </div>

            {/* Pricing Info */}
            <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900">{getMessageTypeName()}</h4>
                  <p className="text-sm text-gray-600">
                    {messageType === 'video' 
                      ? 'Upload or record video messages up to 5 minutes'
                      : messageType === 'audio'
                      ? 'Record voice messages with crystal clear audio'
                      : 'Write heartfelt text messages'
                    }
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">₹{getMessagePrice()}</div>
                  <div className="text-sm text-gray-600">
                    {messageType === 'video' ? 'Premium plan' : 'Basic plan'}
                  </div>
                </div>
              </div>
              
              {/* Pricing Comparison */}
              <div className="mt-4 pt-4 border-t border-primary-200">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Text Message</div>
                    <div className="text-primary-600 font-bold">₹99</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Voice Message</div>
                    <div className="text-primary-600 font-bold">₹99</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-700">Video Message</div>
                    <div className="text-primary-600 font-bold">₹199</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Message...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Heart className="h-5 w-5 mr-2" />
                    Create Message (₹{getMessagePrice()})
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateMessage; 