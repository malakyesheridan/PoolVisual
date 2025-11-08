# Step-by-Step: Update n8n Workflow to Use Mask Images

## What's Already Done ✅
- Server now generates mask images from coordinates
- Mask image URL (`maskImageUrl`) is included in the webhook payload
- No code changes needed on your end

## What You Need to Do in n8n

### Step 1: Open Your n8n Workflow
1. Log into your n8n instance (https://easyflowai.app.n8n.cloud)
2. Navigate to your "AI Enhancement Engine (PoolVisual)" workflow
3. Click **Edit** to open the workflow editor

---

### Step 2: Locate the "Generate Image (Seedream)" Node
1. Find the node named **"Generate Image (Seedream)"** in your workflow
2. It should be after the "Generate Enhancement Prompt" node
3. Click on it to open its settings

---

### Step 3: Update the Request Body
1. In the node settings, find the **"Body Parameters (JSON)"** field (or `bodyParametersJson`)
2. You'll see the current JSON:
   ```json
   {
     "image": "{{$json.imageUrl}}",
     "prompt": "...",
     "variants": 1,
     "seed": null,
     "output_format": "png"
   }
   ```

3. **Update it to include the mask** (add the `mask` line):
   ```json
   {
     "image": "{{$json.imageUrl}}",
     "mask": "{{$json.maskImageUrl}}",
     "prompt": "{{ $items('Generate Enhancement Prompt')[0].json.data?.[0]?.choices?.[0]?.message?.content || $items('Generate Enhancement Prompt')[0].json.choices?.[0]?.message?.content }}",
     "variants": {{$json.options?.variants || 1}},
     "seed": {{$json.options?.seed || null}},
     "output_format": "png"
   }
   ```

   **Important Notes:**
   - The `mask` field uses `{{$json.maskImageUrl}}` - this is the generated mask image URL
   - If `maskImageUrl` is `null` (no masks), Seedream should ignore it or you can make it conditional (see Step 4)

4. Click **Save** on the node

---

### Step 4: (Optional but Recommended) Add Conditional Logic
To only send the mask when it exists, you can add a conditional check:

#### Option A: Simple Conditional in JSON (Easier)
Update the body to conditionally include mask:
```json
{
  "image": "{{$json.imageUrl}}",
  {{$json.maskImageUrl ? '"mask": "' + $json.maskImageUrl + '",' : ''}}
  "prompt": "...",
  "variants": 1,
  "seed": null,
  "output_format": "png"
}
```

**Note:** This might cause JSON syntax issues. Better to use Option B.

#### Option B: Add an IF Node (More Reliable)
1. **Add an IF node** between "Normalize Input" and "Generate Image (Seedream)"
2. **Configure the IF node:**
   - Condition: `{{$json.maskImageUrl}}` exists
   - This checks if `maskImageUrl` is not null/empty
3. **Create two branches:**
   - **True branch**: Goes to a copy of "Generate Image (Seedream)" with mask included
   - **False branch**: Goes to the original "Generate Image (Seedream)" without mask
4. **Merge both branches** after the Seedream calls

**OR** (Simpler): Just include the mask field - Seedream should ignore it if it's null/empty.

---

### Step 5: Verify Seedream API Requirements
**Before testing, check Seedream's API documentation:**
1. Verify the parameter name for masks:
   - Might be `mask`, `mask_image`, `inpaint_mask`, `mask_url`, etc.
   - Update the field name in Step 3 if different
2. Check if Seedream requires:
   - The mask as a URL (what we're sending) ✅
   - Or base64-encoded image
   - Or a different format
3. Verify if Seedream needs additional parameters for inpainting mode

---

### Step 6: Test the Workflow
1. **Save the workflow** in n8n
2. **Activate the workflow** (toggle the switch in top-right)
3. **Create a test enhancement job** from your PoolVisual app:
   - Go to the editor
   - Draw some masks
   - Click "Enhance" → "Add Pool" or "Add Decoration"
4. **Check the execution in n8n:**
   - Go to **Executions** tab
   - Find the latest execution
   - Click on it to see the data flow
5. **Verify at each step:**
   - **Webhook node**: Check that `maskImageUrl` is present in the payload
   - **Generate Image (Seedream) node**: Check that the request body includes the `mask` field with the URL
   - **Seedream response**: Check if the generated image only modifies the masked regions

---

### Step 7: Troubleshooting

#### If maskImageUrl is missing:
- Check Vercel logs for `[Outbox] Generating mask image` messages
- Verify masks are being sent from the client (check browser console)
- Check that `width` and `height` are included in the payload

#### If Seedream rejects the request:
- Verify the parameter name is correct (`mask`, `mask_image`, etc.)
- Check if Seedream requires the mask in a different format
- Verify the mask image URL is publicly accessible

#### If the generated image doesn't use masks:
- Check Seedream's API documentation for inpainting requirements
- Verify the mask image is valid (white regions = areas to modify)
- Check if Seedream needs an additional `mode` or `task` parameter for inpainting

---

## Quick Reference: What Changed

**Before:**
- Webhook received: `masks` array (coordinates)
- Seedream API call: Only sent `image` and `prompt`

**After:**
- Webhook receives: `masks` array + `maskImageUrl` (generated image)
- Seedream API call: Sends `image`, `mask` (URL), and `prompt`

---

## Summary Checklist
- [ ] Opened n8n workflow editor
- [ ] Found "Generate Image (Seedream)" node
- [ ] Added `"mask": "{{$json.maskImageUrl}}"` to body parameters
- [ ] (Optional) Added conditional logic for when mask doesn't exist
- [ ] Verified Seedream API parameter name
- [ ] Saved and activated workflow
- [ ] Tested with a real enhancement job
- [ ] Verified mask is used in generated image

---

## Need Help?
- Check Vercel logs for mask generation: Look for `[Outbox] Generating mask image`
- Check n8n execution logs: Verify `maskImageUrl` appears in webhook payload
- Verify Seedream API docs: Confirm mask parameter name and format

