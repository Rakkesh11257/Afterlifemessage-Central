/**
 * Serverless plugin to resolve SSM parameters with stage interpolation
 * This allows using ${self:provider.stage} in SSM paths
 */
class SsmStageResolver {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.hooks = {
      'initialize': this.resolveSsmParams.bind(this),
    };
  }

  resolveSsmParams() {
    const stage = this.options.stage || this.serverless.service.provider.stage || 'dev';
    const service = this.serverless.service;
    
    this.serverless.cli.log(`[SSM Stage Resolver] Resolving stage: ${stage}`);

    // Function to replace stage in SSM paths
    const replaceStage = (obj) => {
      if (typeof obj === 'string') {
        // Replace ${self:provider.stage} in SSM paths - handle both with and without ~true flag
        let result = obj;
        // Pattern: ${ssm:/afterlifemessage/${self:provider.stage}/param, true} or ${ssm:/afterlifemessage/${self:provider.stage}/param~true}
        // Handle both Serverless v4 syntax (, true) and legacy (~true)
        return obj.replace(
          /\$\{ssm:(\/afterlifemessage\/)\$\{self:provider\.stage\}([^}]+)\}/g,
          (match, path, param) => {
            // param includes everything after the stage, including , true or ~true if present
            // Convert ~true to , true for Serverless v4 compatibility
            const normalizedParam = param.replace(/~true/, ', true');
            return `\${ssm:${path}${stage}${normalizedParam}}`;
          }
        );
      } else if (Array.isArray(obj)) {
        return obj.map(replaceStage);
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const key in obj) {
          result[key] = replaceStage(obj[key]);
        }
        return result;
      }
      return obj;
    };

    // Process provider.environment
    if (service.provider.environment) {
      service.provider.environment = replaceStage(service.provider.environment);
    }

    // Process function environments
    if (service.functions) {
      Object.keys(service.functions).forEach(funcName => {
        if (service.functions[funcName].environment) {
          service.functions[funcName].environment = replaceStage(service.functions[funcName].environment);
        }
      });
    }

    // Process custom section
    if (service.custom) {
      service.custom = replaceStage(service.custom);
    }
  }
}

module.exports = SsmStageResolver;

