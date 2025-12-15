@echo off
setlocal enabledelayedexpansion

REM Deployment script for AfterLife Message Platform (Windows)
REM Usage: deploy.bat [dev|prod] [frontend|backend|full]

set "ENV=%1"
set "COMPONENT=%2"

REM Check arguments
if "%ENV%"=="" (
    echo [ERROR] Missing environment argument
    echo Usage: deploy.bat [dev^|prod] [frontend^|backend^|full]
    echo.
    echo Examples:
    echo   deploy.bat dev frontend    # Deploy frontend to development
    echo   deploy.bat prod backend    # Deploy backend to production
    echo   deploy.bat dev full        # Deploy both to development
    echo   deploy.bat prod full       # Deploy both to production
    exit /b 1
)

if "%COMPONENT%"=="" (
    echo [ERROR] Missing component argument
    echo Usage: deploy.bat [dev^|prod] [frontend^|backend^|full]
    exit /b 1
)

REM Validate environment
if not "%ENV%"=="dev" if not "%ENV%"=="prod" (
    echo [ERROR] Invalid environment. Use 'dev' or 'prod'
    exit /b 1
)

REM Validate component
if not "%COMPONENT%"=="frontend" if not "%COMPONENT%"=="backend" if not "%COMPONENT%"=="full" (
    echo [ERROR] Invalid component. Use 'frontend', 'backend', or 'full'
    exit /b 1
)

REM Check AWS CLI
where aws >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] AWS CLI is not installed. Please install it first.
    exit /b 1
)

REM Check AWS credentials
aws sts get-caller-identity >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] AWS credentials not configured. Please run 'aws configure' first.
    exit /b 1
)

REM Confirm production deployment
if "%ENV%"=="prod" (
    echo.
    echo [WARNING] You are about to deploy to PRODUCTION environment!
    set /p "CONFIRM=Are you sure you want to continue? (y/N): "
    if /i not "!CONFIRM!"=="y" (
        echo [INFO] Deployment cancelled
        exit /b 0
    )
)

echo [INFO] Starting deployment to %ENV% environment...

REM Deploy based on component
if "%COMPONENT%"=="backend" (
    call :deploy_backend
) else if "%COMPONENT%"=="frontend" (
    call :deploy_frontend
) else if "%COMPONENT%"=="full" (
    call :deploy_backend
    call :deploy_frontend
)

echo [SUCCESS] Deployment completed successfully!
exit /b 0

:deploy_backend
echo [INFO] Deploying backend to %ENV% environment...
cd backend
serverless deploy --stage %ENV%
if %errorlevel% neq 0 (
    echo [ERROR] Backend deployment failed
    exit /b 1
)
cd ..
echo [SUCCESS] Backend deployed successfully to %ENV%
goto :eof

:deploy_frontend
echo [INFO] Deploying frontend to %ENV% environment...
if "%ENV%"=="dev" (
    npm run build:dev
) else (
    npm run build:prod
)
if %errorlevel% neq 0 (
    echo [ERROR] Frontend build failed
    exit /b 1
)

set "BUCKET=afterlifemessage-%ENV%"
aws s3 sync build/ s3://%BUCKET% --delete
if %errorlevel% neq 0 (
    echo [ERROR] Frontend deployment failed
    exit /b 1
)
echo [SUCCESS] Frontend deployed successfully to %ENV%
echo [INFO] Website URL: http://%BUCKET%.s3-website.ap-south-1.amazonaws.com
goto :eof 