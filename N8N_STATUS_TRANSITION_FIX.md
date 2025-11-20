# n8n Workflow Status Transition Fix

## Problem
The n8n workflow is trying to send status "completed" directly from "queued", which violates the database state machine rules.

**Error:**
```
Invalid status transition: queued -> completed. Allowed: {downloading,rendering,canceled,failed}
```

## Status Transition Rules

The database enforces these status transitions (from `migrations/010_state_machine.sql`):

```
queued → [downloading, rendering, canceled, failed]
downloading → [preprocessing, canceled, failed]
preprocessing → [rendering, canceled, failed]
rendering → [postprocessing, canceled, failed]
postprocessing → [uploading, canceled, failed]
uploading → [completed, canceled, failed]
completed → [] (terminal state)
failed → [] (terminal state)
canceled → [] (terminal state)
```

## Solution: Update n8n Workflow

The n8n workflow needs to send status updates in the correct sequence. Here's the recommended flow:

### Option 1: Simplified Flow (Recommended)
Since n8n handles the entire process, you can use a simplified flow:

1. **When starting processing:** Send `status: "rendering"`
2. **When processing completes:** Send `status: "postprocessing"`
3. **When ready to upload:** Send `status: "uploading"`
4. **When upload completes:** Send `status: "completed"` with the result URLs

### Option 2: Full Flow (More granular)
For better progress tracking:

1. `status: "downloading"` - When downloading the input image
2. `status: "rendering"` - When AI is processing
3. `status: "postprocessing"` - When post-processing results
4. `status: "uploading"` - When uploading final results
5. `status: "completed"` - When everything is done

## n8n Workflow Update

Update your callback HTTP Request node to send status updates at appropriate points:

### Step 1: After Image Download
Add a callback after downloading the image:
```json
{
  "status": "rendering",
  "progress": 30
}
```

### Step 2: After AI Processing
When the AI model finishes processing:
```json
{
  "status": "postprocessing",
  "progress": 70
}
```

### Step 3: After Post-Processing
When post-processing is done:
```json
{
  "status": "uploading",
  "progress": 90
}
```

### Step 4: Final Completion
When everything is complete, send:
```json
{
  "status": "completed",
  "progress": 100,
  "urls": ["https://...", "https://..."],
  // OR
  "enhancedImageUrl": "https://...",
  // OR
  "variants": [
    { "url": "https://...", "rank": 0 }
  ]
}
```

## Minimal Fix (Quick Solution)

If you want the quickest fix, update your final callback to send these statuses in sequence:

1. First callback: `{ "status": "rendering", "progress": 50 }`
2. Second callback: `{ "status": "postprocessing", "progress": 75 }`
3. Third callback: `{ "status": "uploading", "progress": 90 }`
4. Final callback: `{ "status": "completed", "progress": 100, "urls": [...] }`

You can use n8n's "Wait" node or "Set" node to send multiple callbacks, or use a Code node to send them sequentially.

## Example n8n Code Node

Here's an example of how to send status updates sequentially:

```javascript
const callbackUrl = $json.callbackUrl;
const callbackSecret = $json.callbackSecret;

// Function to send callback
async function sendCallback(status, progress, data = {}) {
  const payload = {
    status,
    progress,
    ...data
  };
  
  // Sign the payload (use your signature logic)
  const timestamp = Date.now().toString();
  const signature = /* your signature calculation */;
  
  await fetch(callbackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-timestamp': timestamp,
      'x-signature': signature
    },
    body: JSON.stringify(payload)
  });
}

// Send status updates
await sendCallback('rendering', 30);
// ... do work ...
await sendCallback('postprocessing', 70);
// ... do work ...
await sendCallback('uploading', 90);
// ... do work ...
await sendCallback('completed', 100, { urls: [/* result URLs */] });
```

## Important Notes

- **Never skip from "queued" directly to "completed"** - this will always fail
- **Always go through at least "rendering" → "uploading" → "completed"**
- The `progress` field is optional but recommended for better UX
- The final "completed" status should include the result URLs in one of these formats:
  - `urls: ["url1", "url2"]`
  - `enhancedImageUrl: "url"`
  - `variants: [{ url: "url", rank: 0 }]`

