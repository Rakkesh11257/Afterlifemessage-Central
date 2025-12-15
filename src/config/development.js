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
    userPoolId: 'ap-south-1_AYpQVjJlV',
    userPoolWebClientId: '36o49m40gmp35t64g64mh7o7g6',
    identityPoolId: 'ap-south-1:6353ad8d-9a2f-4213-b682-4385c7b47e45',
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
        endpoint: 'https://d15u5v4bkj.execute-api.ap-south-1.amazonaws.com/dev',
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