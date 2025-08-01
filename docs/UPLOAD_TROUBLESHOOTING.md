# Upload Troubleshooting Guide

This guide helps diagnose and fix upload issues in the Essence Web training system.

## Quick Diagnosis

**For ERR_SSL_BAD_RECORD_MAC_ALERT errors:**

```bash
pnpm test:ssl
```

**For general upload issues:**

```bash
pnpm test:upload:full
```

## Common Upload Errors

### 1. "ERR_SSL_BAD_RECORD_MAC_ALERT"

**Symptoms:**

- Browser shows ERR_SSL_BAD_RECORD_MAC_ALERT in network tab
- Upload fails immediately or during transfer
- May work intermittently or on different networks

**This is an SSL/TLS Connection Issue**

ERR_SSL_BAD_RECORD_MAC_ALERT is a specific SSL error that occurs when there's interference with the encrypted connection to Supabase storage during uploads.

**Immediate Solutions (try these first):**

#### A. Network Environment Changes

1. **Disable VPN temporarily**

   - VPNs often interfere with SSL connections
   - Try uploading with VPN disconnected

2. **Switch networks**

   - Try mobile hotspot instead of WiFi
   - Use different WiFi network if available
   - Test from different location

3. **Use different browser**
   - Try Chrome, Firefox, Safari, or Edge
   - Use incognito/private browsing mode
   - Disable browser extensions temporarily

#### B. Browser SSL Cache Issues

1. **Clear browser SSL cache:**

   - **Chrome:** Settings → Privacy and security → Clear browsing data → Cached images and files
   - **Firefox:** Settings → Privacy & Security → Cookies and Site Data → Clear Data
   - **Safari:** Develop → Empty Caches (or Settings → Privacy → Manage Website Data)

2. **Reset browser network settings:**
   - Chrome: Settings → Advanced → Reset and clean up → Restore settings
   - Firefox: Help → Troubleshooting Information → Refresh Firefox

#### C. System-Level Fixes

1. **Flush DNS cache:**

   ```bash
   # Windows
   ipconfig /flushdns

   # macOS
   sudo dscacheutil -flushcache

   # Linux
   sudo systemctl restart systemd-resolved
   ```

2. **Temporarily disable antivirus SSL scanning:**

   - Many antivirus programs scan SSL traffic and can cause this error
   - Temporarily disable HTTPS/SSL scanning in your antivirus settings

3. **Check firewall settings:**
   - Corporate firewalls often block or interfere with SSL connections
   - Contact your network administrator if on a corporate network

#### D. Test SSL Connectivity

Run our SSL diagnostic tool:

```bash
pnpm test:ssl
```

This will test SSL connectivity to Supabase and identify specific issues.

**Advanced Solutions:**

#### If Basic Solutions Don't Work

1. **Try uploading smaller files first**

   - Large uploads are more likely to trigger SSL issues
   - Test with 1-2 small images (< 1MB each)

2. **Use different device**

   - Test from mobile device on cellular data
   - Try from different computer on same network

3. **Contact network administrator**
   - If on corporate network, ask about SSL inspection policies
   - Request whitelisting of Supabase domains

**Prevention:**

- Avoid VPN during uploads
- Use stable network connections
- Keep browser updated
- Regular SSL cache clearing

### 2. "Upload failed due to network error"

**Symptoms:**

- Error message: "Failed to upload [filename]: Upload failed due to network error"
- Upload progress stops or fails immediately

**Possible Causes & Solutions:**

#### A. Supabase Configuration Issues

- **Check environment variables:**

  ```bash
  # Verify these are set in your .env.local:
  NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
  ```

- **Verify Supabase bucket permissions:**
  - Go to Supabase Dashboard → Storage
  - Check that `assets` and `models` buckets exist
  - Verify bucket policies allow uploads

#### B. CORS Configuration

- **Solution:** Update Supabase CORS settings in Storage → Settings → CORS
- **Add these origins:**
  ```
  http://localhost:3000
  https://yourdomain.com
  ```

#### C. File Size Issues

- **Individual file limit:** 10MB per image
- **Total upload limit:** 500MB for all images combined
- **Solution:** Compress images or reduce file count

#### D. Network Timeouts

- **Default timeout:** 5 minutes per file
- **For slow connections:** Images may timeout on large files
- **Solution:** Use smaller images or improve network connection

### 2. "Upload failed with HTTP [status]"

**HTTP 403: Forbidden**

- **Cause:** Invalid Supabase service role key or bucket permissions
- **Solution:** Check service role key and bucket policies

**HTTP 404: Not Found**

- **Cause:** Incorrect bucket name or Supabase URL
- **Solution:** Verify bucket names and Supabase project URL

**HTTP 413: Payload Too Large**

- **Cause:** File exceeds server limits
- **Solution:** Reduce file sizes

### 3. "Failed to generate upload URL"

**Symptoms:**

- Error occurs before upload starts
- Usually indicates server-side configuration issues

**Solutions:**

1. Check Supabase service role key permissions
2. Verify bucket exists and is accessible
3. Check Supabase project status (not paused)

### 4. "Upload timeout after [time] seconds"

**Symptoms:**

- Upload starts but never completes
- More common with large files or slow connections

**Solutions:**

1. **Reduce file sizes:**

   ```bash
   # Use image compression tools
   # Recommended: < 5MB per image for best performance
   ```

2. **Check network stability:**

   - Use wired connection if possible
   - Avoid uploading during peak network usage

3. **Retry upload:**
   - The system automatically retries up to 3 times
   - If persistent, reduce file sizes

## File Requirements

### Supported Formats

- **Images:** JPG, PNG, WEBP, GIF
- **Size limits:**
  - Individual: 10MB maximum
  - Total batch: 500MB maximum
  - Minimum files: 5 images required

### Recommended Specifications

- **Individual file size:** 1-5MB for optimal performance
- **Resolution:** 1024x1024 or similar (model training works best with consistent sizes)
- **Format:** JPG or PNG (most reliable)

## Diagnostic Steps

### Step 1: Test Basic Configuration

**If you're seeing ERR_SSL_BAD_RECORD_MAC_ALERT:**

```bash
pnpm test:ssl
```

**For general upload issues:**

```bash
pnpm test:upload:full
```

This will check:

- Environment variables
- Supabase connectivity
- SSL/TLS connections
- URL generation
- File validation

### Step 2: Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Try uploading files
4. Look for detailed error messages

### Step 3: Check Network Tab

1. Open browser developer tools → Network tab
2. Try uploading
3. Look for failed requests (red status)
4. Check request/response details

### Step 4: Verify Supabase Status

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Check project status (not paused)
3. Verify Storage → Buckets exist
4. Test bucket permissions

## Advanced Troubleshooting

### Enable Detailed Logging

Add this to your browser console for more detailed upload logs:

```javascript
localStorage.setItem("upload-debug", "true")
```

### Test Individual Components

#### Test Presigned URL Generation

```bash
curl -X POST http://localhost:3000/api/upload-presigned \
  -H "Content-Type: application/json" \
  -d '{
    "files": [{"name": "test.jpg", "size": 1048576, "type": "image/jpeg"}],
    "trainingJobId": "test-123"
  }'
```

#### Test Direct Upload (if you have a presigned URL)

```bash
curl -X PUT "YOUR_PRESIGNED_URL" \
  -H "Content-Type: image/jpeg" \
  --data-binary @your-test-image.jpg
```

## Performance Optimization

### For Slow Uploads

1. **Reduce image sizes:**

   - Use image compression tools
   - Resize to 1024x1024 or smaller
   - Convert to JPG format

2. **Upload fewer files at once:**

   - Split large batches into smaller groups
   - Upload 5-10 images at a time

3. **Check connection:**
   - Use wired internet if possible
   - Avoid peak network usage times

### For Large Datasets

- Consider using the asset-based training flow for very large datasets
- Use batch processing endpoints for bulk operations

## Getting Help

If issues persist after following this guide:

1. **Run the diagnostic script:**

   For SSL errors:

   ```bash
   pnpm test:ssl
   ```

   For general upload issues:

   ```bash
   pnpm test:upload:full
   ```

2. **Check recent error logs:**

   - Browser console errors
   - Network request failures
   - Server logs (if accessible)

3. **Collect information:**

   - Error messages (exact text)
   - File sizes and types being uploaded
   - Browser and operating system
   - Network type (wifi, ethernet, etc.)

4. **Common quick fixes:**
   - Refresh the page and try again
   - Clear browser cache
   - Try with smaller/fewer files
   - Check internet connection stability

## Prevention

### Best Practices

- Keep individual images under 5MB
- Use standard formats (JPG, PNG)
- Test with small batches first
- Ensure stable internet connection
- Regularly verify Supabase configuration

### Monitoring

- Run `pnpm test:upload:full` periodically
- Monitor Supabase project health
- Check for service role key expiration
- Verify bucket storage limits
