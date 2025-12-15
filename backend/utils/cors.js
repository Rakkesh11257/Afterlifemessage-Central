function getCorsHeaders(event) {
  const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/, // any localhost port
    /^https?:\/\/afterlifemessage-frontend-(dev|prod)\.s3-website\.ap-south-1\.amazonaws\.com$/
  ];
  const origin = event.headers?.origin || event.headers?.Origin;
  const isAllowed = allowedOriginPatterns.some(pattern => pattern.test(origin));
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : "",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE"
  };
}

function addCorsHeaders(headers = {}) {
  const allowedOriginPatterns = [
    /^http:\/\/localhost:\d+$/,
    /^https?:\/\/afterlifemessage-frontend-(dev|prod)\.s3-website\.ap-south-1\.amazonaws\.com$/
  ];
  
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent,X-Amzn-Trace-Id",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS,PUT,DELETE",
    ...headers
  };
}

module.exports = { getCorsHeaders, addCorsHeaders }; 