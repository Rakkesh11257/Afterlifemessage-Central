# Quick Deployment Reference

## Quick Commands

### Development Deployment
```bash
# Deploy frontend to dev
npm run deploy:dev

# Deploy backend to dev
npm run deploy:backend:dev

# Deploy both to dev
npm run deploy:full:dev
```

### Production Deployment
```bash
# Deploy frontend to prod
npm run deploy:prod

# Deploy backend to prod
npm run deploy:backend:prod

# Deploy both to prod
npm run deploy:full:prod
```

### Using Deployment Scripts
```bash
# Linux/Mac
./deploy.sh dev frontend
./deploy.sh prod full

# Windows
deploy.bat dev frontend
deploy.bat prod full
```

## Development Workflow

1. **Make Changes Locally**
   ```bash
   npm start
   ```

2. **Test in Development**
   ```bash
   npm run deploy:full:dev
   ```

3. **Deploy to Production** (after testing)
   ```bash
   npm run deploy:full:prod
   ```

## Environment URLs

### Development
- Frontend: `http://afterlifemessage-dev.s3-website.ap-south-1.amazonaws.com`
- API: `https://27berxipfh.execute-api.ap-south-1.amazonaws.com/dev`

### Production
- Frontend: `http://afterlifemessage-prod.s3-website.ap-south-1.amazonaws.com`
- API: `https://27berxipfh.execute-api.ap-south-1.amazonaws.com/prod`

## Troubleshooting

### Common Issues
1. **Build fails**: Clear cache and rebuild
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run build:dev
   ```

2. **Deployment fails**: Check AWS credentials
   ```bash
   aws sts get-caller-identity
   ```

3. **S3 sync fails**: Verify bucket exists
   ```bash
   aws s3 ls s3://afterlifemessage-dev
   aws s3 ls s3://afterlifemessage-prod
   ```

### Environment Files
- Development: `env.development`
- Production: `env.production`

Make sure these files are properly configured before deployment. 