const getCookieDomain = () => {
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost') return 'localhost';
    if (window.location.hostname === 'afterlifemessage.cloudmastery.in') return 'afterlifemessage.cloudmastery.in';
    if (window.location.hostname === 'lifeaftermessagedev.cloudmastery.in') return 'lifeaftermessagedev.cloudmastery.in';
    if (window.location.hostname.includes('amplifyapp.com')) return window.location.hostname;
    if (window.location.hostname.includes('afterlifemessage-frontend-dev')) return 'afterlifemessage-frontend-dev.s3-website.ap-south-1.amazonaws.com';
  }
  return 'localhost'; // fallback for SSR or unknown
};

const devConfig = {
  Auth: {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_CRybCfDpw',
    userPoolWebClientId: '4u0t1nn1ivbrbplvdhd0pjjn6e',
    identityPoolId: 'ap-south-1:6a84df2f-0e11-46c6-a0bf-f69bfbd1e90e',
    mandatorySignIn: true,
    cookieStorage: {
      domain: getCookieDomain(),
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

export default devConfig; 