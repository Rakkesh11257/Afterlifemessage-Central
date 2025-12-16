import { Amplify } from 'aws-amplify';

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
      secure: true
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