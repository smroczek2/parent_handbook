# Vercel Deployment Guide

## Environment Variables Setup

In your Vercel project dashboard, configure the following environment variables:

### Required Variables:
- **VITE_OPENAI_API_KEY**: Your OpenAI API key for authentication
  - Get this from https://platform.openai.com/api-keys
  - Format: `sk-proj-...`
  - **IMPORTANT**: Must be prefixed with `VITE_` for Vite to expose it to the client

## Deployment Steps

1. **Connect Repository**:
   - Go to https://vercel.com/new
   - Import your Git repository
   - Vercel will auto-detect Vite configuration

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add `VITE_OPENAI_API_KEY` with your OpenAI API key
   - Apply to Production, Preview, and Development environments

3. **Deploy**:
   - Vercel will automatically deploy on every push to main
   - Build command: `npm run build`
   - Output directory: `dist`
   - Framework: Vite

## Security Features

The application includes the following security headers:
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-Frame-Options**: Prevents clickjacking attacks
- **X-XSS-Protection**: Enables browser XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts access to browser features

## Post-Deployment

After deployment:
1. Test the chatbot functionality
2. Verify that vector stores are loading correctly
3. Confirm chat streaming is working properly
4. Check browser console for any errors

## Troubleshooting

**Issue**: "Application is not properly configured" error
- **Solution**: Verify `VITE_OPENAI_API_KEY` is set in Vercel environment variables and redeploy

**Issue**: Vector stores not loading
- **Solution**: Check that your OpenAI API key has access to the vector stores API

**Issue**: Chat responses not streaming
- **Solution**: Verify network connectivity and check browser console for API errors
