import { Amplify } from 'aws-amplify';

// Determine if we're on localhost (non-HTTPS) for Safari compatibility
// Safari blocks secure cookies on localhost, so we need secure: false for local development
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || 
   window.location.hostname === '127.0.0.1' ||
   (window.location.hostname.startsWith('192.168.') && window.location.protocol === 'http:'));

const awsconfig = {
  Auth: {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_CRybCfDpw',
    userPoolWebClientId: '4u0t1nn1ivbrbplvdhd0pjjn6e',
    authenticationFlowType: 'USER_PASSWORD_AUTH',
    mandatorySignIn: true,
    cookieStorage: {
      domain: 'localhost',
      path: '/',
      expires: 365,
      secure: !isLocalhost // Safari requires secure: false for localhost (http://)
    }
  },
  API: {
    endpoints: [
      {
        name: 'AfterLifeMessageAPI',
        endpoint: 'https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev',
        region: 'ap-south-1'
      }
    ]
  },
  Storage: {
    AWSS3: {
      bucket: 'afterlifemessage-dev',
      region: 'ap-south-1'
    }
  }
};

Amplify.configure(awsconfig);

export default awsconfig; 