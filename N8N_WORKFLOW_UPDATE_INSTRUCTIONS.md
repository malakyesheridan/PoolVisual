# n8n Workflow Update Instructions

## Problem
The n8n workflow receives masks in the webhook payload, but the Seedream API call doesn't use them. This means the AI enhancement doesn't apply changes only to the masked regions.

## Solution
The server now generates a mask image from the mask coordinates and includes it in the payload as `maskImageUrl`. The n8n workflow needs to be updated to use this mask image in the Seedream API call.

## Current Payload Structure
The webhook now receives:
```json
{
  "jobId": "...",
  "imageUrl": "https://...",
  "masks": [...],  // Original mask coordinates (for reference)
  "maskImageUrl": "https://...",  // NEW: Generated mask image URL
  "mode": "add_decoration",
  "width": 2048,
  "height": 2048,
  ...
}
```

## Required n8n Workflow Changes

### Step 1: Update the "Generate Image (Seedream)" Node
In the `bodyParametersJson` field, add the `mask` parameter:

**Current:**
```json
{
  "image": "{{$json.imageUrl}}",
  "prompt": "...",
  "variants": 1,
  "seed": null,
  "output_format": "png"
}
```

**Updated (if maskImageUrl exists):**
```json
{
  "image": "{{$json.imageUrl}}",
  "mask": "{{$json.maskImageUrl}}",
  "prompt": "...",
  "variants": 1,
  "seed": null,
  "output_format": "png"
}
```

### Step 2: Add Conditional Logic (Optional but Recommended)
Add a conditional check before the Seedream API call to only include the mask if `maskImageUrl` is present:

1. Add a "IF" node after "Normalize Input"
2. Condition: `{{$json.maskImageUrl}}` exists
3. If true: Use the updated body with mask
4. If false: Use the original body without mask

### Step 3: Verify Seedream API Documentation
Check the Seedream API documentation to confirm:
- The parameter name for the mask (might be `mask`, `mask_image`, `inpaint_mask`, etc.)
- Whether the mask should be a URL or base64 encoded
- Any additional parameters needed for inpainting mode

## Testing
After updating the workflow:
1. Create an enhancement job with masks
2. Check the webhook execution in n8n to verify `maskImageUrl` is present
3. Verify the Seedream API call includes the mask parameter
4. Confirm the generated image only modifies the masked regions

## Notes
- The mask image is a black/white PNG where:
  - **White** = regions to be modified (masked areas)
  - **Black** = regions to remain unchanged
- The mask image dimensions match the original image dimensions (`width` x `height`)
- If mask generation fails, `maskImageUrl` will be `null` and the workflow should fall back to regular generation

