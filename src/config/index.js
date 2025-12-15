import devConfig from './development';
import prodConfig from './production';

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     process.env.REACT_APP_ENV === 'development' ||
                     window.location.hostname === 'localhost' ||
                     window.location.hostname.includes('dev') ||
                     window.location.hostname === 'lifeaftermessagedev.cloudmastery.in' ||
                     window.location.hostname.includes('amplifyapp.com');

// Export appropriate configuration
export default isDevelopment ? devConfig : prodConfig; 