const prodConfig = {
  Auth: {
    region: 'ap-south-1',
    userPoolId: 'ap-south-1_AYpQVjJlV',
    userPoolWebClientId: '36o49m40gmp35t64g64mh7o7g6',
    identityPoolId: 'ap-south-1:6353ad8d-9a2f-4213-b682-4385c7b47e45',
    mandatorySignIn: true,
    cookieStorage: {
      domain: 'afterlifemessage.cloudmastery.in',
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
      bucket: 'afterlifemessage-prod',
      region: 'ap-south-1'
    }
  }
};

export default prodConfig; 