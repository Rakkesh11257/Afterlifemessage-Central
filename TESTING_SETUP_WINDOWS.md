# Testing Setup Guide for Windows

This guide will help your team pull the code from GitHub and test it on Windows systems.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Git** - [Download Git for Windows](https://git-scm.com/download/win)
2. **Node.js** (v18 or higher) - [Download Node.js](https://nodejs.org/)
3. **npm** (comes with Node.js) or **yarn**
4. **AWS CLI** - [Download AWS CLI](https://aws.amazon.com/cli/)
5. **Serverless Framework** (for backend testing)
6. **AWS Account** with appropriate credentials

## Step 1: Clone the Repository

Open **Git Bash** or **Command Prompt** (cmd) or **PowerShell** and run:

```bash
# Clone the repository
git clone https://github.com/Rakkesh11257/Afterlifemessage-Central.git

# Navigate to the project directory
cd Afterlifemessage-Central

# Check current branch (should be 'Dev')
git branch

# If not on Dev branch, switch to it
git checkout Dev

# Pull latest changes
git pull origin Dev
```

## Step 2: Frontend Setup

### Install Dependencies

```bash
# Navigate to the root directory (where package.json is located)
cd Afterlifemessage-Central

# Install frontend dependencies
npm install
```

### Configure Environment (if needed)

The frontend is configured to use the development API endpoint by default. If you need to change it, check `src/services/api.js`.

### Run the Frontend

```bash
# Start the development server
npm start
```

The application will open at `http://localhost:3000` in your default browser.

**Note:** If port 3000 is already in use, React will ask to use a different port (e.g., 3001).

## Step 3: Backend Setup (Optional - if testing backend changes)

### Install Serverless Framework

```bash
# Install Serverless Framework globally
npm install -g serverless

# Verify installation
serverless --version
```

### Configure AWS Credentials

1. Open Command Prompt or PowerShell
2. Configure AWS credentials:

```bash
aws configure
```

You'll be prompted to enter:
- **AWS Access Key ID**: Your AWS access key
- **AWS Secret Access Key**: Your AWS secret key
- **Default region**: `ap-south-1`
- **Default output format**: `json`

Alternatively, set environment variables:

```bash
# PowerShell
$env:AWS_ACCESS_KEY_ID="your-access-key"
$env:AWS_SECRET_ACCESS_KEY="your-secret-key"
$env:AWS_DEFAULT_REGION="ap-south-1"

# Command Prompt (cmd)
set AWS_ACCESS_KEY_ID=your-access-key
set AWS_SECRET_ACCESS_KEY=your-secret-key
set AWS_DEFAULT_REGION=ap-south-1
```

### Install Backend Dependencies

```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install
```

### Deploy Backend (Optional - only if testing backend changes)

**Note:** Only deploy if you have AWS credentials and need to test backend changes. The backend is already deployed on AWS.

```bash
# Deploy to dev stage
serverless deploy --stage dev

# Or deploy a specific function
serverless deploy function -f createMessage --stage dev
```

## Step 4: Testing Checklist

### Frontend Testing

1. **User Authentication:**
   - [ ] Sign up with a new account
   - [ ] Verify email address
   - [ ] Sign in with verified account
   - [ ] Test password reset functionality

2. **Profile Management:**
   - [ ] View profile
   - [ ] Edit profile (name, phone, email)
   - [ ] Change email and verify new email

3. **Message Creation:**
   - [ ] Create text message
   - [ ] Create audio message (record)
   - [ ] Create video message (record)
   - [ ] Create video message (upload file)
   - [ ] Create message with files
   - [ ] Set delivery date
   - [ ] Set inactivity trigger

4. **Message Management:**
   - [ ] View all messages
   - [ ] View single message
   - [ ] Edit message
   - [ ] Delete message

5. **Media Playback:**
   - [ ] Play audio messages in browser
   - [ ] Play video messages in browser
   - [ ] Download audio/video files
   - [ ] Test on different browsers (Chrome, Firefox, Edge)

### Browser Compatibility Testing

Test on:
- [ ] Google Chrome (latest)
- [ ] Microsoft Edge (latest)
- [ ] Mozilla Firefox (latest)
- [ ] Safari (if available on Windows via developer tools)

### Common Issues and Solutions

#### Issue: Port 3000 already in use
**Solution:**
```bash
# Find what's using port 3000 (PowerShell)
netstat -ano | findstr :3000

# Kill the process (replace PID with the actual process ID)
taskkill /PID <PID> /F

# Or use a different port
set PORT=3001
npm start
```

#### Issue: npm install fails
**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rmdir /s node_modules
del package-lock.json

# Reinstall
npm install
```

#### Issue: Git authentication fails
**Solution:**
- Use HTTPS with personal access token
- Or configure SSH keys for Git
- Or use Git Credential Manager

#### Issue: AWS credentials not found
**Solution:**
- Ensure AWS CLI is installed: `aws --version`
- Configure credentials: `aws configure`
- Check credentials file: `%USERPROFILE%\.aws\credentials`

#### Issue: Module not found errors
**Solution:**
```bash
# Ensure you're in the correct directory
cd Afterlifemessage-Central

# Delete node_modules and reinstall
rmdir /s node_modules
npm install
```

## Step 5: Pulling Latest Changes

When you need to pull the latest changes from the repository:

```bash
# Ensure you're on the Dev branch
git checkout Dev

# Pull latest changes
git pull origin Dev

# Install any new dependencies (if package.json changed)
npm install

# Restart the development server
npm start
```

## Step 6: Reporting Issues

If you encounter any issues during testing:

1. **Check Browser Console:**
   - Press `F12` to open Developer Tools
   - Check the Console tab for errors
   - Take screenshots of errors

2. **Check Network Tab:**
   - Open Developer Tools → Network tab
   - Try the action that's failing
   - Look for failed requests (red status codes)
   - Check request/response details

3. **Document the Issue:**
   - Describe what you were trying to do
   - Include error messages
   - Include browser and OS information
   - Include screenshots if possible

4. **Report to Team:**
   - Create an issue in GitHub (if you have access)
   - Or report to the team lead with all details

## Quick Start Summary

For quick testing (frontend only):

```bash
# 1. Clone repository
git clone https://github.com/Rakkesh11257/Afterlifemessage-Central.git
cd Afterlifemessage-Central

# 2. Install dependencies
npm install

# 3. Start the application
npm start

# 4. Open http://localhost:3000 in your browser
```

## Environment Information

- **Frontend:** React application running on `http://localhost:3000`
- **Backend API:** `https://kk9hsbofeh.execute-api.ap-south-1.amazonaws.com/dev`
- **Region:** `ap-south-1` (Asia Pacific - Mumbai)
- **Branch:** `Dev` (development branch)

## Additional Notes

- The backend is already deployed on AWS, so frontend-only testing doesn't require AWS credentials
- For backend changes, you'll need AWS credentials and Serverless Framework
- All sensitive credentials are stored in AWS SSM Parameter Store (not in code)
- The frontend automatically connects to the development API endpoint

## Contact

If you have questions or need help, contact the development team lead.

