import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Mic, Video, Upload, Heart, Calendar, Clock, Mail, MessageSquare, Play, Pause, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import AudioRecorder from '../components/AudioRecorder';
import { messageAPI } from '../services/api';

const EditMessage = () => {
  const { messageId } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [messageType, setMessageType] = useState('text');
  const [deliveryType, setDeliveryType] = useState('date');
  const [existingMediaUrl, setExistingMediaUrl] = useState(null);
  const [mediaMimeType, setMediaMimeType] = useState(null);
  const [mediaError, setMediaError] = useState(null);

  // New media state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [videoBlob, setVideoBlob] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoStream, setVideoStream] = useState(null);
  const [videoRecorder, setVideoRecorder] = useState(null);
  const videoRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [totalFileSize, setTotalFileSize] = useState(0);

  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm();
  const triggerValue = watch('triggerValue');

  useEffect(() => {
    if (messageId) {
      fetchMessage();
    }
  }, [messageId]);



  // Set form values when message is loaded
  useEffect(() => {
    if (message) {
      console.log('🔍 DEBUG - Message loaded, setting form values:', message);
      setValue('recipientEmail', message.recipientEmail || '');
      setValue('recipientMobile', message.recipientMobile || '');
      setValue('deliveryType', message.deliveryType || 'date');
      setValue('triggerValue', message.triggerValue || '');
      setValue('messageContent', message.content || '');
      setValue('deliveryMethods', message.deliveryMethods || ['email']);
      setValue('inactivityMonths', message.inactivityMonths ? String(message.inactivityMonths) : '');
      setValue('deliveryDate', message.deliveryDate || '');
      console.log('🔍 DEBUG - Form values set successfully');
    }
  }, [message, setValue]);

  // Sync deliveryType state with react-hook-form
  useEffect(() => {
    setValue('deliveryType', deliveryType);
    if (deliveryType === 'date') {
      setValue('triggerValue', message?.triggerValue || message?.deliveryDate || '');
      setValue('inactivityMonths', '');
    } else if (deliveryType === 'inactivity') {
      setValue('inactivityMonths', message?.inactivityMonths ? String(message.inactivityMonths) : '');
      setValue('triggerValue', '');
    }
  }, [deliveryType, setValue, message]);

  const fetchMessage = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 DEBUG - Starting to fetch message:', messageId);
      
      const messageData = await messageAPI.getMessage(messageId);
      console.log('🔍 DEBUG - Message data received:', messageData);
      
      setMessage(messageData);
      setMessageType(messageData.type);
      setDeliveryType(messageData.deliveryType);
      
      console.log('🔍 DEBUG - Setting form values:', {
        recipientEmail: messageData.recipientEmail,
        recipientMobile: messageData.recipientMobile,
        deliveryType: messageData.deliveryType,
        triggerValue: messageData.triggerValue,
        messageContent: messageData.content,
        deliveryMethods: messageData.deliveryMethods
      });
      
      // Load existing media if present
      if (messageData.type === 'video' || messageData.type === 'audio') {
        console.log('🔍 DEBUG - Message has media, loading existing media...');
        await loadExistingMedia(messageData.type);
      }
      
    } catch (error) {
      console.error('Error fetching message:', error);
      toast.error('Failed to load message');
      navigate('/dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const loadExistingMedia = async (type) => {
    try {
      setMediaError(null);
      
      console.log('🔍 DEBUG - Loading existing media for type:', type);
      
      const mediaData = await messageAPI.getDecryptedMedia(messageId, type);
      console.log('🔍 DEBUG - Media data received:', mediaData);
      
      if (mediaData.presignedUrl) {
        // Use presigned URL directly
        setExistingMediaUrl(mediaData.presignedUrl);
        setMediaMimeType(mediaData.mediaMimeType);
        console.log('🔍 DEBUG - Using presigned URL for media:', mediaData.presignedUrl);
      } else if (mediaData.mediaData) {
        // Convert base64 to blob URL
        const binaryString = atob(mediaData.mediaData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        
        const blob = new Blob([bytes], { type: mediaData.mediaMimeType || 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        setExistingMediaUrl(url);
        setMediaMimeType(mediaData.mediaMimeType);
        
        console.log('🔍 DEBUG - Media loaded successfully:', {
          url: url,
          mimeType: mediaData.mediaMimeType,
          blobSize: blob.size
        });
      } else {
        throw new Error('No media data or presigned URL received');
      }
    } catch (error) {
      console.error('Error loading existing media:', error);
      setMediaError(error.message || 'Failed to load media');
    }
  };

  const handleAudioError = (e) => {
    console.error('Audio playback error:', e);
    setMediaError('Failed to play audio file');
  };

  const handleVideoError = (e) => {
    console.error('Video playback error:', e);
    setMediaError('Failed to play video file');
  };

  // Media handling functions
  const handleAudioRecorded = (blob) => {
    setAudioBlob(blob);
    setMediaMimeType(blob.type || 'audio/webm');
    toast.success('Audio recorded successfully! (will replace existing audio)');
  };

  const clearAudio = () => {
    setAudioBlob(null);
  };

  const handleVideoRecorded = (blob) => {
    // Clear any existing video file
    setVideoFile(null);
    setVideoBlob(blob);
    setMediaMimeType(blob.type || 'video/webm');
    toast.success('Video recorded successfully! (will replace existing video)');
  };

  const clearVideo = () => {
    console.log('🔍 DEBUG - Clearing video (videoBlob, videoFile)');
    setVideoBlob(null);
    setVideoFile(null);
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setIsVideoRecording(false);
  };

  const clearAllNewMedia = () => {
    setAudioBlob(null);
    setVideoBlob(null);
    setVideoFile(null);
    setSelectedFiles([]);
    setTotalFileSize(0);
    console.log('🔍 DEBUG - All new media cleared');
  };

  const handleVideoUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxSize = 250 * 1024 * 1024; // 250MB total limit for videos
    
    let totalVideoSize = 0;
    const validVideos = [];
    
    for (const file of files) {
      // Check if it's a video file
      if (!file.type.startsWith('video/')) {
        toast.error(`${file.name} is not a valid video file`);
        continue;
      }
      
      // Check file size
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 250MB)`);
        continue;
      }
      
      totalVideoSize += file.size;
      validVideos.push(file);
    }
    
    if (validVideos.length > 0) {
      console.log('🔍 DEBUG - Setting videoFile:', validVideos[0].name);
      // Clear any existing video recording
      setVideoBlob(null);
      setVideoFile(validVideos[0]);
      setMediaMimeType(validVideos[0].type);
      toast.success(`Video uploaded: ${validVideos[0].name} (will replace existing video)`);
    }
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const maxSize = 100 * 1024 * 1024; // 100MB per file
    const maxTotalSize = 100 * 1024 * 1024; // 100MB total
    
    const validFiles = [];
    let newTotalSize = totalFileSize;
    
    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`${file.name} is too large (max 100MB per file)`);
        continue;
      }
      
      if (newTotalSize + file.size > maxTotalSize) {
        toast.error(`Total file size would exceed 100MB limit`);
        continue;
      }
      
      newTotalSize += file.size;
      validFiles.push(file);
    }
    
    if (validFiles.length > 0) {
      // Clear any existing files and replace with new ones
      setSelectedFiles(validFiles);
      setTotalFileSize(newTotalSize);
      toast.success(`${validFiles.length} file(s) uploaded successfully (will replace existing files)`);
    }
  };

  const removeFile = (index) => {
    const fileToRemove = selectedFiles[index];
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setTotalFileSize(prev => prev - fileToRemove.size);
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    setTotalFileSize(0);
  };



  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        }, 
        audio: true 
      });
      
      setVideoStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp8') 
          ? 'video/webm;codecs=vp8' 
          : 'video/webm'
      });
      
      const chunks = [];
      
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType });
        handleVideoRecorded(blob);
        stream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
      };
      
      setVideoRecorder(recorder);
      recorder.start();
      setIsVideoRecording(true);
      
    } catch (error) {
      console.error('Error starting video recording:', error);
      toast.error('Failed to start video recording. Please check camera permissions.');
    }
  };

  const stopVideoRecording = () => {
    if (videoRecorder && isVideoRecording) {
      videoRecorder.stop();
      setIsVideoRecording(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      
      // Check if new media is provided (only for existing media types)
      if (message.type === 'audio' && !audioBlob && !existingMediaUrl) {
        toast.error('Please record your audio message or keep existing audio');
        return;
      }

      if (message.type === 'video' && !videoBlob && !videoFile && !existingMediaUrl) {
        toast.error('Please record or upload your video message or keep existing video');
        return;
      }

      if (message.type === 'files' && selectedFiles.length === 0) {
        toast.error('Please select at least one file');
        return;
      }
      
      // Check if user is uploading new media (which will replace existing media)
      const hasNewMedia = !!(audioBlob || videoBlob || videoFile || selectedFiles.length > 0);
      
      const messageData = {
        type: message.type, // Keep original message type
        content: message.type === 'text' ? data.messageContent : null,
        recipientEmail: data.recipientEmail,
        recipientMobile: data.recipientMobile,
        deliveryType: deliveryType,
        deliveryMethods: data.deliveryMethods, // <-- add this line
        deliveryDate: deliveryType === 'date' ? data.triggerValue : undefined,
        triggerValue: deliveryType === 'date' ? data.triggerValue : (deliveryType === 'inactivity' ? data.inactivityMonths : undefined),
        message: data.messageContent || `${message.type === 'audio' ? 'Audio' : message.type === 'video' ? 'Video' : message.type === 'files' ? 'Files' : 'Text'} message`
      };

      // Add media data if user is uploading new media (will replace existing media)
      if (hasNewMedia) {
        if (message.type === 'audio' && audioBlob) {
          messageData.audioBlob = audioBlob;
          messageData.mediaMimeType = mediaMimeType;
        }
        
        if (message.type === 'video' && (videoBlob || videoFile)) {
          messageData.videoBlob = videoBlob || videoFile;
          messageData.mediaMimeType = mediaMimeType;
        }
        
        if (message.type === 'files' && selectedFiles.length > 0) {
          messageData.files = selectedFiles;
        }
      } else {
        // Ensure no media data is sent when not uploading new media
        console.log('🔍 DEBUG - No new media detected, ensuring clean payload');
        delete messageData.audioBlob;
        delete messageData.videoBlob;
        delete messageData.videoFile;
        delete messageData.files;
        delete messageData.mediaMimeType;
      }

      console.log('🔍 DEBUG - Submitting message update:', {
        type: messageData.type,
        hasNewMedia: hasNewMedia,
        existingMediaUrl: !!existingMediaUrl,
        audioBlob: !!audioBlob,
        videoBlob: !!videoBlob,
        videoFile: !!videoFile,
        selectedFilesCount: selectedFiles.length,
        payloadSize: JSON.stringify(messageData).length,
        messageDataKeys: Object.keys(messageData)
      });

      await messageAPI.updateMessage(messageId, messageData);
      toast.success('Message updated successfully!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading message...</p>
        </div>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Message not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Edit Message</h1>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← Back to Dashboard
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Message Type Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Message Type</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  disabled={true}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'text'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Heart className="h-6 w-6 text-primary-600" />
                    <div className="flex-1">
                      <div className="font-medium">Text Message</div>
                      <div className="text-sm text-gray-600">Write your message</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-primary-600">₹99</div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  disabled={true}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'audio'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
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
                  disabled={true}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'video'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
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
                  disabled={true}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    messageType === 'files'
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
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
              
              {/* Message Type Lock Notice */}
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <svg className="h-5 w-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Message Type Locked
                    </p>
                    <p className="text-xs text-yellow-700">
                      You can only edit the content of your existing {messageType === 'audio' ? 'voice' : messageType === 'video' ? 'video' : messageType === 'files' ? 'files' : 'text'} message. 
                      To change message type, please create a new message.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Your Message Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Message</h3>
              
              {/* Existing Media Display */}
              {message && (message.type === 'audio' || message.type === 'video') && (
                <div className="mb-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {message.type === 'audio' ? (
                          <Mic className="h-6 w-6 text-blue-600" />
                        ) : (
                          <Video className="h-6 w-6 text-blue-600" />
                        )}
                        <div>
                          <h4 className="text-lg font-semibold text-blue-900">
                            Existing {message.type === 'audio' ? 'Audio' : 'Video'}
                          </h4>
                          <p className="text-sm text-blue-700">
                            This message contains an existing {message.type} recording
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Media Display */}
                    {existingMediaUrl ? (
                      <div className="space-y-4">
                        {message.type === 'audio' ? (
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Audio Preview</h5>
                            <audio
                              controls
                              className="w-full"
                              onError={handleAudioError}
                            >
                              <source src={existingMediaUrl} type={mediaMimeType} />
                              Your browser does not support the audio tag.
                            </audio>
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <h5 className="text-sm font-medium text-gray-700 mb-2">Video Preview</h5>
                            <video
                              controls
                              className="w-full max-w-sm rounded-lg"
                              onError={handleVideoError}
                            >
                              <source src={existingMediaUrl} type={mediaMimeType} />
                              Your browser does not support the video tag.
                            </video>
                          </div>
                        )}
                        

                      </div>
                    ) : mediaError ? (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div>
                            <h5 className="text-sm font-medium text-red-800">Media Loading Error</h5>
                            <p className="text-sm text-red-700">{mediaError}</p>
                          </div>
                        </div>
                        
                        <div className="mt-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              if (message.type === 'audio' || message.type === 'video') {
                                loadExistingMedia(message.type);
                              }
                            }}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Retry Loading Media
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-center space-x-3">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          <div>
                            <h5 className="text-sm font-medium text-gray-700">
                              Loading existing {message.type}...
                            </h5>
                            <p className="text-xs text-gray-500">
                              Please wait while we retrieve your media
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Message Content Section */}
              <div className="space-y-4">
                {/* Recipient Information */}
                <div>
                  <h4 className="text-md font-medium text-gray-900 mb-3">Recipient</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="recipientEmail" className="block text-sm font-medium text-gray-700 mb-1">
                        Recipient Email *
                      </label>
                      <input
                        type="email"
                        id="recipientEmail"
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
                      <label htmlFor="recipientMobile" className="block text-sm font-medium text-gray-700 mb-1">
                        Recipient Mobile (WhatsApp)
                      </label>
                      <input
                        type="tel"
                        id="recipientMobile"
                        {...register('recipientMobile')}
                        className="input-field"
                        placeholder="e.g. 919876543210"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Methods */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Method</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('deliveryMethods')}
                        value="email"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Email</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        {...register('deliveryMethods')}
                        value="whatsapp"
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">WhatsApp</span>
                    </label>
                  </div>
                </div>

                {/* Text Message Content */}
                {message.type === 'text' && (
                  <div>
                    <label htmlFor="messageContent" className="block text-sm font-medium text-gray-700 mb-2">
                      Write your message *
                    </label>
                    <textarea
                      id="messageContent"
                      {...register('messageContent', { 
                        required: message.type === 'text' ? 'Message content is required' : false,
                        minLength: message.type === 'text' ? {
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
                )}

                {/* Audio Message Content */}
                {message.type === 'audio' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Record your voice message *
                    </label>
                    {existingMediaUrl && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          📝 Upload new audio to replace the existing audio message.
                        </p>
                      </div>
                    )}
                    <AudioRecorder 
                      onRecordingComplete={handleAudioRecorded}
                      onClear={clearAudio}
                      audioBlob={audioBlob}
                    />
                  </div>
                )}

                {/* Video Message Content */}
                {message.type === 'video' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Video Message *
                    </label>
                    {existingMediaUrl && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          📝 Record or upload new video to replace the existing video message.
                        </p>
                      </div>
                    )}
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
                    </div>
                  </div>
                )}

                {/* Files Message Content */}
                {message.type === 'files' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Upload Files *
                    </label>
                    {existingMediaUrl && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          📝 Upload new files to replace the existing files.
                        </p>
                      </div>
                    )}
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
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* When to Deliver Section */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">When to Deliver</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

              {/* Delivery Settings */}
              {deliveryType === 'date' && (
                <div>
                  <label htmlFor="triggerValue" className="block text-sm font-medium text-gray-700 mb-2">
                    Delivery Date *
                  </label>
                  <input
                    type="date"
                    id="triggerValue"
                    {...register('triggerValue', { 
                      required: deliveryType === 'date' ? 'Delivery date is required' : false
                    })}
                    className="input-field"
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {errors.triggerValue && (
                    <p className="mt-1 text-sm text-red-600">{errors.triggerValue.message}</p>
                  )}
                </div>
              )}

              {deliveryType === 'inactivity' && (
                <div>
                  <label htmlFor="inactivityMonths" className="block text-sm font-medium text-gray-700 mb-2">
                    Inactivity Period *
                  </label>
                  <select
                    id="inactivityMonths"
                    {...register('inactivityMonths', { 
                      required: deliveryType === 'inactivity' ? 'Inactivity period is required' : false
                    })}
                    className="input-field"
                  >
                    <option value="">Select period</option>
                    <option value="1">1 month</option>
                    <option value="3">3 months</option>
                    <option value="6">6 months</option>
                    <option value="12">12 months</option>
                  </select>
                  {errors.inactivityMonths && (
                    <p className="mt-1 text-sm text-red-600">{errors.inactivityMonths.message}</p>
                  )}
                </div>
              )}
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
                {isLoading ? 'Updating...' : 'Update Message'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditMessage; 