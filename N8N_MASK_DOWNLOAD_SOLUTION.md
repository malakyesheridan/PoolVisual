# Solution: Downloading Image with Masks in n8n

## The Problem
- You're downloading the original image from `{{ $json.body.imageUrl }}`
- You tried to add masks to the request body, but got `[object] [object]`
- **Why it doesn't work**: GET requests don't have bodies, and the Vercel Blob URL is just a static file - it can't process mask coordinates

## Solution: Download Mask Image Separately

The server now generates a **mask image** (`maskImageUrl`) that you can download separately. This is a black/white PNG where:
- **White** = masked regions (areas to modify)
- **Black** = background (unchanged areas)

### Step-by-Step Fix

#### Step 1: Keep Your Current Node (Original Image)
Your current HTTP Request node that downloads `{{ $json.body.imageUrl }}` is correct - keep it as is.

#### Step 2: Add a Second HTTP Request Node (Mask Image)
1. **Add a new HTTP Request node** after your current one
2. **Configure it:**
   - **Method**: `GET`
   - **URL**: `{{ $json.body.maskImageUrl }}`
   - **Name it**: "Download Mask Image" (or similar)

#### Step 3: Handle Cases Where No Mask Exists
Add an IF node before the mask download:
1. **Add an IF node** between "Normalize Input" and "Download Mask Image"
2. **Condition**: `{{ $json.body.maskImageUrl }}` exists (not null/empty)
3. **True branch**: Goes to "Download Mask Image" node
4. **False branch**: Skips mask download (or sets a placeholder)

#### Step 4: Combine Both Images for Analysis
After both downloads, you'll have:
- **Original image** (from first HTTP Request)
- **Mask image** (from second HTTP Request)

You can then:
- **Option A**: Upload both to Dropbox separately
- **Option B**: Use both in your "Analyse Image" node (if it accepts multiple inputs)
- **Option C**: Use the composite endpoint (see Option 2 below)

---

## Alternative: Use Composite Endpoint (Image with Masks Already Applied)

If you want a **single image with masks already applied** (composite), use this instead:

### Step 1: Get Photo ID from Payload
The webhook payload should include `photoId`. If not, you can extract it from the `imageUrl` or add it to the payload.

### Step 2: Call Composite Endpoint
1. **Add an HTTP Request node**
2. **Method**: `GET`
3. **URL**: `https://poolvisual.vercel.app/api/photos/{{ $json.body.photoId }}/composite`
4. **Headers**: 
   - You'll need authentication (session cookie or API key)
   - Check your authentication setup

5. **Response**: Returns JSON with:
   ```json
   {
     "beforeUrl": "...",
     "afterUrl": "...",  // This is the composite image with masks applied
     "sideBySideUrl": "...",
     "status": "completed",
     "hasEdits": true
   }
   ```

6. **Then download the composite**:
   - Add another HTTP Request node
   - **URL**: `{{ $items('Get Composite')[0].json.afterUrl }}`
   - This downloads the image with masks already applied

---

## Recommended Workflow Structure

### For Separate Image + Mask:
```
Webhook → Normalize Input → IF (maskImageUrl exists?)
                                    ├─ Yes → Download Original Image
                                    │         Download Mask Image
                                    │         → Upload to Dropbox
                                    │         → Analyse Image
                                    │
                                    └─ No → Download Original Image
                                              → Upload to Dropbox
                                              → Analyse Image
```

### For Composite Image:
```
Webhook → Normalize Input → Get Composite (GET /api/photos/:id/composite)
                                    │
                                    └─ Download Composite Image (from afterUrl)
                                              → Upload to Dropbox
                                              → Analyse Image
```

---

## Quick Fix: Update Your Current Node

If you just want to test quickly, you can add a second HTTP Request node right after your current one:

1. **Duplicate your current HTTP Request node**
2. **Change the URL** to: `{{ $json.body.maskImageUrl }}`
3. **Name it**: "Download Mask Image"

Now you'll have:
- **First node**: Downloads original image
- **Second node**: Downloads mask image (black/white PNG)

Both can be uploaded to Dropbox and used for analysis.

---

## Important Notes

1. **`maskImageUrl` might be null**: If there are no masks, `maskImageUrl` will be `null`. Add conditional logic to handle this.

2. **Authentication**: If using the composite endpoint, you'll need to handle authentication (session cookies or API keys).

3. **Mask Image Format**: The mask image is a black/white PNG where white = masked regions, black = background.

4. **Why `[object] [object]` happened**: When you tried to stringify the `masks` array in the request body, JavaScript converted the complex object to `[object Object]`. This is expected behavior - you can't send complex objects in a GET request body anyway.

---

## Testing

1. **Check webhook payload**: Verify `maskImageUrl` is present in the webhook input
2. **Test mask download**: The second HTTP Request should download a black/white PNG
3. **Verify both files**: You should have both the original image and the mask image
4. **Test analysis**: Feed both to your "Analyse Image" node

