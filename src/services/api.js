import axios from 'axios';
import { Storage } from 'aws-amplify';

// Determine API base URL based on environment
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.REACT_APP_ENV === 'development' ||
                     window.location.hostname === 'localhost' ||
                     window.location.hostname.includes('dev') ||
                     window.location.hostname === 'afterlifemessage.cloudmastery.in' ||
                     window.location.hostname === 'lifeaftermessagedev.cloudmastery.in' ||
                     window.location.hostname.includes('amplifyapp.com');

const API_BASE_URL = 'https://d15u5v4bkj.execute-api.ap-south-1.amazonaws.com/dev';

console.log('=== API CONFIGURATION ===');
console.log('Current hostname:', window.location.hostname);
console.log('Is development:', isDevelopment);
console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const { Auth } = await import('aws-amplify');
      const session = await Auth.currentSession();
      if (session.isValid()) {
        config.headers.Authorization = `Bearer ${session.getIdToken().getJwtToken()}`;
      }
    } catch (error) {
      console.log('No valid session found');
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Enhanced media validation and processing
class MediaProcessor {
  // Validate file type and size
  static validateFile(file, maxSize = 250 * 1024 * 1024) {
    const validTypes = {
      video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
      audio: ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm'],
      image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    };

    const allValidTypes = Object.values(validTypes).flat();
    
    if (!allValidTypes.includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }

    if (file.size > maxSize) {
      throw new Error(`File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB (max: ${(maxSize / 1024 / 1024).toFixed(2)}MB)`);
    }

    return true;
  }

  // Convert blob/file to base64 with validation
  static async toBase64(media) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        try {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          
          if (!base64) {
            throw new Error('Invalid data URL format');
          }

          // Validate base64 data
          if (base64.length === 0) {
            throw new Error('Empty base64 data');
          }

          console.log('🔍 DEBUG - Media conversion:', {
            originalSize: media.size,
            originalType: media.type,
            base64Length: base64.length,
            base64Start: base64.substring(0, 50),
            base64End: base64.substring(base64.length - 50)
          });

          resolve(base64);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(media);
    });
  }

  // Process different media types
  static async processMedia(media, type) {
    try {
      // Validate the media
      this.validateFile(media);

      // Convert to base64
      const base64Data = await this.toBase64(media);

      return {
        data: base64Data,
        type: media.type,
        size: media.size,
        name: media.name || `media.${media.type.split('/')[1]}`
      };
    } catch (error) {
      console.error('Media processing error:', error);
      throw new Error(`Failed to process ${type}: ${error.message}`);
    }
  }
}

// API endpoints
export const messageAPI = {
  // Create a new message
  createMessage: async (messageData) => {
    try {
      // Create clean message data
      const cleanMessageData = {
        type: messageData.type,
        content: messageData.content,
        recipientEmail: messageData.recipientEmail,
        recipientMobile: messageData.recipientMobile,
        deliveryType: messageData.deliveryType,
        deliveryMethods: messageData.deliveryMethods,
        deliveryDate: messageData.deliveryDate,
        triggerValue: messageData.triggerValue,
        message: messageData.message
      };

      // Check if we have large media that needs special handling
      const hasLargeMedia = messageData.audioBlob || messageData.videoBlob || 
                           (messageData.files && messageData.files.length > 0);

      if (hasLargeMedia) {
        console.log('🔍 DEBUG - Large media detected, processing media...');
        const largeFiles = [];

        if (messageData.audioBlob && messageData.audioBlob.size > 10 * 1024 * 1024) {
          largeFiles.push({ blob: messageData.audioBlob, type: 'audio' });
        } else if (messageData.audioBlob) {
          const processedAudio = await MediaProcessor.processMedia(messageData.audioBlob, 'audio');
          cleanMessageData.audioBlob = processedAudio.data;
          cleanMessageData.mediaMimeType = processedAudio.type;
        }

        if (messageData.videoBlob && messageData.videoBlob.size > 10 * 1024 * 1024) {
          largeFiles.push({ blob: messageData.videoBlob, type: 'video' });
        } else if (messageData.videoBlob) {
          const processedVideo = await MediaProcessor.processMedia(messageData.videoBlob, 'video');
          cleanMessageData.videoBlob = processedVideo.data;
          cleanMessageData.mediaMimeType = processedVideo.type;
        }

        if (messageData.files && messageData.files.length > 0) {
          const processedFiles = [];
          for (const file of messageData.files) {
            if (file.size > 10 * 1024 * 1024) {
              largeFiles.push({ blob: file, type: 'files', fileName: file.name });
            } else {
              const processedFile = await MediaProcessor.processMedia(file, 'file');
              processedFiles.push({
                name: processedFile.name,
                data: processedFile.data,
                type: processedFile.type,
                size: processedFile.size
              });
            }
          }
          if (processedFiles.length > 0) {
            cleanMessageData.files = processedFiles;
          }
        }

        // Upload large files to S3 using presigned URLs
        if (largeFiles.length > 0) {
          console.log('🔍 DEBUG - Uploading large files to S3...');
          // For create, we don't have a messageId yet, so use a temp UUID
          const tempId = Math.random().toString(36).substring(2, 15);
          for (const file of largeFiles) {
            const uploadResult = await messageAPI.uploadLargeFile(tempId, file);
            if (file.type === 'audio') {
              cleanMessageData.audioBlob = uploadResult.s3Key;
              cleanMessageData.mediaMimeType = file.blob.type;
            } else if (file.type === 'video') {
              cleanMessageData.videoBlob = uploadResult.s3Key;
              cleanMessageData.mediaMimeType = file.blob.type;
            } else if (file.type === 'files') {
              if (!cleanMessageData.files) cleanMessageData.files = [];
              cleanMessageData.files.push({
                name: file.fileName,
                s3Key: uploadResult.s3Key,
                type: file.blob.type,
                size: file.blob.size
              });
            }
          }
        }
      }

      console.log('🔍 DEBUG - Final message data:', {
        type: cleanMessageData.type,
        mediaMimeType: cleanMessageData.mediaMimeType,
        hasVideoBlob: !!cleanMessageData.videoBlob,
        hasAudioBlob: !!cleanMessageData.audioBlob,
        hasFiles: !!cleanMessageData.files,
        fileCount: cleanMessageData.files?.length || 0
      });

      const response = await api.post('/messages', cleanMessageData);
      return response.data;
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  },

  // Get user's messages
  getMessages: async () => {
    const response = await api.get('/messages');
    return response.data;
  },

  // Get a single message by ID
  getMessage: async (messageId) => {
    const response = await api.get(`/messages/${messageId}`);
    console.log('🔍 DEBUG - Raw API response:', response.data);
    // The backend returns { message: {...} }, so we need to extract the message
    return response.data.message || response.data;
  },

  // Update a message
  updateMessage: async (messageId, messageData) => {
    try {
      const cleanMessageData = {
        messageId,
        type: messageData.type,
        content: messageData.content,
        recipientEmail: messageData.recipientEmail,
        recipientMobile: messageData.recipientMobile,
        deliveryType: messageData.deliveryType,
        deliveryDate: messageData.deliveryDate,
        triggerValue: messageData.triggerValue,
        message: messageData.message
      };

      // Check if we have large media that needs special handling
      const hasLargeMedia = messageData.audioBlob || messageData.videoBlob || 
                           (messageData.files && messageData.files.length > 0);

      if (hasLargeMedia) {
        console.log('🔍 DEBUG - Large media detected, processing media...');
        
        // For large files (>10MB), use S3 presigned URLs
        const largeFiles = [];
        
        if (messageData.audioBlob && messageData.audioBlob.size > 10 * 1024 * 1024) {
          largeFiles.push({ blob: messageData.audioBlob, type: 'audio' });
        } else if (messageData.audioBlob) {
          const processedAudio = await MediaProcessor.processMedia(messageData.audioBlob, 'audio');
          cleanMessageData.audioBlob = processedAudio.data;
          cleanMessageData.mediaMimeType = processedAudio.type;
        }

        if (messageData.videoBlob && messageData.videoBlob.size > 10 * 1024 * 1024) {
          largeFiles.push({ blob: messageData.videoBlob, type: 'video' });
        } else if (messageData.videoBlob) {
          const processedVideo = await MediaProcessor.processMedia(messageData.videoBlob, 'video');
          cleanMessageData.videoBlob = processedVideo.data;
          cleanMessageData.mediaMimeType = processedVideo.type;
        }

        if (messageData.files && messageData.files.length > 0) {
          const processedFiles = [];
          for (const file of messageData.files) {
            if (file.size > 10 * 1024 * 1024) {
              largeFiles.push({ blob: file, type: 'files', fileName: file.name });
            } else {
              const processedFile = await MediaProcessor.processMedia(file, 'file');
              processedFiles.push({
                name: processedFile.name,
                data: processedFile.data,
                type: processedFile.type,
                size: processedFile.size
              });
            }
          }
          if (processedFiles.length > 0) {
            cleanMessageData.files = processedFiles;
          }
        }

                  // Upload large files to S3 using presigned URLs
          if (largeFiles.length > 0) {
            console.log('🔍 DEBUG - Uploading large files to S3...');
            for (const file of largeFiles) {
              const uploadResult = await messageAPI.uploadLargeFile(messageId, file);
            if (file.type === 'audio') {
              cleanMessageData.audioBlob = uploadResult.s3Key;
              cleanMessageData.mediaMimeType = file.blob.type;
            } else if (file.type === 'video') {
              cleanMessageData.videoBlob = uploadResult.s3Key;
              cleanMessageData.mediaMimeType = file.blob.type;
            } else if (file.type === 'files') {
              if (!cleanMessageData.files) cleanMessageData.files = [];
              cleanMessageData.files.push({
                name: file.fileName,
                s3Key: uploadResult.s3Key,
                type: file.blob.type,
                size: file.blob.size
              });
            }
          }
        }
      }

      console.log('🔍 DEBUG - Update message payload size:', JSON.stringify(cleanMessageData).length);
      console.log('🔍 DEBUG - Final payload keys:', Object.keys(cleanMessageData));

      const response = await api.put(`/messages/${messageId}`, cleanMessageData);
      return response.data;
    } catch (error) {
      console.error('Error updating message:', error);
      throw error;
    }
  },

  // Upload large file to S3 using presigned URL
  uploadLargeFile: async (messageId, fileInfo) => {
    try {
      // Get presigned URL
      const uploadUrlResponse = await api.post('/upload-url', {
        messageId,
        mediaType: fileInfo.type,
        fileName: fileInfo.fileName || `media.${fileInfo.blob.type.split('/')[1]}`,
        contentType: fileInfo.blob.type
      });

      const { uploadUrl, s3Key } = uploadUrlResponse.data;

      // Upload directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: fileInfo.blob,
        headers: {
          'Content-Type': fileInfo.blob.type
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload to S3: ${uploadResponse.statusText}`);
      }

      console.log('🔍 DEBUG - Large file uploaded to S3:', s3Key);
      return { s3Key };
    } catch (error) {
      console.error('Error uploading large file:', error);
      throw error;
    }
  },

  // Delete a message
  deleteMessage: async (messageId) => {
    const response = await api.delete(`/messages/${messageId}`);
    return response.data;
  },

  // Update user activity
  updateActivity: async () => {
    const response = await api.post('/activity');
    return response.data;
  },

  // Get user profile
  getUserProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },

  // Update user profile
  updateUserProfile: async (profileData) => {
    const response = await api.put('/profile', profileData);
    return response.data;
  },

  // Get decrypted media
  getDecryptedMedia: async (messageId, type) => {
    try {
      const response = await api.get(`/media/${messageId}`, {
        params: { type }
      });

      // Return the full response so the frontend can handle presignedUrl or mediaData
      return response.data;
    } catch (error) {
      console.error('Error getting decrypted media:', error);
      throw error;
    }
  }
};

export const paymentAPI = {
  // Create Razorpay order with dynamic pricing
  createPayment: async (messageId, messageType) => {
    const response = await api.post('/payment/create', {
      messageId,
      messageType
    });
    return response.data;
  },

  // Create Razorpay order
  createOrder: async (orderData) => {
    const response = await api.post('/payment/create-order', orderData);
    return response.data;
  },

  // Verify payment
  verifyPayment: async (paymentData) => {
    const response = await api.post('/payment/verify', paymentData);
    return response.data;
  },
};

export default api; 