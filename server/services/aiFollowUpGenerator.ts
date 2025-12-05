/**
 * AI Follow-Up Message Generator
 * 
 * Generates SMS and email follow-up messages for buyer-property matches using OpenAI.
 */

import { storage } from '../storage.js';

export interface FollowUpMessageInput {
  matchSuggestionId: string;
}

export interface FollowUpMessageOutput {
  suggestedSmsText: string;
  suggestedEmailSubject: string;
  suggestedEmailBody: string;
}

/**
 * Generate follow-up message for a match suggestion
 */
export async function generateFollowUpMessage(
  input: FollowUpMessageInput
): Promise<FollowUpMessageOutput> {
  const { matchSuggestionId } = input;

  try {
    // 1. Load match suggestion
    const suggestion = await storage.getMatchSuggestion(matchSuggestionId);
    if (!suggestion) {
      throw new Error('Match suggestion not found');
    }

    // 2. Load buyer contact and profile
    const contact = await storage.getContact(suggestion.contactId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    const buyerProfile = contact.buyerProfile as any;
    const buyerName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'there';

    // 3. Load property
    const property = await storage.getJob(suggestion.propertyId);
    if (!property) {
      throw new Error('Property not found');
    }

    // 4. Prepare context for AI
    const propertyAddress = property.address || 'this property';
    const propertyPrice = property.estimatedPrice 
      ? (typeof property.estimatedPrice === 'string' ? property.estimatedPrice : `$${property.estimatedPrice.toLocaleString()}`)
      : 'price on application';
    const propertySuburb = property.address ? property.address.split(',').pop()?.trim() : '';
    const propertyBeds = property.bedrooms || 'N/A';
    const propertyBaths = property.bathrooms || 'N/A';
    const propertyType = property.propertyType || 'property';

    const buyerBudget = buyerProfile?.budgetMin && buyerProfile?.budgetMax
      ? `$${Number(buyerProfile.budgetMin).toLocaleString()} - $${Number(buyerProfile.budgetMax).toLocaleString()}`
      : buyerProfile?.budgetMax
      ? `up to $${Number(buyerProfile.budgetMax).toLocaleString()}`
      : 'flexible';
    
    const buyerSuburbs = Array.isArray(buyerProfile?.preferredSuburbs) && buyerProfile.preferredSuburbs.length > 0
      ? buyerProfile.preferredSuburbs.join(', ')
      : 'various suburbs';
    
    const matchReasons: string[] = [];
    if (buyerProfile?.budgetMin || buyerProfile?.budgetMax) {
      matchReasons.push(`fits your budget of ${buyerBudget}`);
    }
    if (propertySuburb && Array.isArray(buyerProfile?.preferredSuburbs) && buyerProfile.preferredSuburbs.some((s: string) => 
      propertySuburb.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(propertySuburb.toLowerCase())
    )) {
      matchReasons.push(`located in ${propertySuburb}, which you're interested in`);
    }
    if (buyerProfile?.bedsMin && property.bedrooms && Number(property.bedrooms) >= Number(buyerProfile.bedsMin)) {
      matchReasons.push(`has ${propertyBeds} bedrooms (meets your minimum of ${buyerProfile.bedsMin})`);
    }
    if (buyerProfile?.bathsMin && property.bathrooms && Number(property.bathrooms) >= Number(buyerProfile.bathsMin)) {
      matchReasons.push(`has ${propertyBaths} bathrooms (meets your minimum of ${buyerProfile.bathsMin})`);
    }

    const matchReasonText = matchReasons.length > 0 
      ? matchReasons.join(', ')
      : 'appears to be a good match for your criteria';

    // 5. Check if OpenAI is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiApiKey) {
      // Fallback to template-based generation if OpenAI is not configured
      return generateTemplateFollowUp({
        buyerName,
        propertyAddress,
        propertyPrice,
        propertySuburb,
        propertyBeds,
        propertyBaths,
        propertyType,
        matchReasonText,
      });
    }

    // 6. Call OpenAI API
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const systemPrompt = `You are a professional real estate agent assistant. Write concise, friendly, and professional follow-up messages to buyers about properties that match their criteria. Be warm but not overly casual. Keep messages brief and actionable.`;

      const userPrompt = `Write a follow-up message for ${buyerName} about a ${propertyType} at ${propertyAddress}.

Property details:
- Address: ${propertyAddress}
- Price: ${propertyPrice}
- Bedrooms: ${propertyBeds}
- Bathrooms: ${propertyBaths}
- Suburb: ${propertySuburb || 'N/A'}

Buyer's criteria:
- Budget: ${buyerBudget}
- Preferred suburbs: ${buyerSuburbs}
- Minimum beds: ${buyerProfile?.bedsMin || 'N/A'}
- Minimum baths: ${buyerProfile?.bathsMin || 'N/A'}

Why this matches: ${matchReasonText}

Generate:
1. A concise SMS message (max 160 characters, friendly and inviting)
2. An email subject line (clear and compelling)
3. An email body (2-3 short paragraphs, professional but warm, include a call to action to view the property or request more info)

Format your response as JSON:
{
  "sms": "SMS text here",
  "emailSubject": "Email subject here",
  "emailBody": "Email body here"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = completion.choices[0]?.message?.content || '';
      
      // Try to parse JSON response
      try {
        const parsed = JSON.parse(content);
        return {
          suggestedSmsText: parsed.sms || generateTemplateSMS(buyerName, propertyAddress, propertySuburb),
          suggestedEmailSubject: parsed.emailSubject || `New ${propertyType} in ${propertySuburb || 'your area'}`,
          suggestedEmailBody: parsed.emailBody || generateTemplateEmailBody(buyerName, propertyAddress, propertyPrice, propertySuburb, matchReasonText),
        };
      } catch {
        // If not JSON, try to extract from text
        return {
          suggestedSmsText: content.substring(0, 160) || generateTemplateSMS(buyerName, propertyAddress, propertySuburb),
          suggestedEmailSubject: `New ${propertyType} in ${propertySuburb || 'your area'}`,
          suggestedEmailBody: content || generateTemplateEmailBody(buyerName, propertyAddress, propertyPrice, propertySuburb, matchReasonText),
        };
      }
    } catch (openaiError: any) {
      console.error('[AI Follow-Up] OpenAI error:', openaiError?.message);
      // Fallback to template
      return generateTemplateFollowUp({
        buyerName,
        propertyAddress,
        propertyPrice,
        propertySuburb,
        propertyBeds,
        propertyBaths,
        propertyType,
        matchReasonText,
      });
    }

  } catch (error: any) {
    console.error('[AI Follow-Up] Error:', error?.message || error);
    throw error;
  }
}

function generateTemplateFollowUp(context: {
  buyerName: string;
  propertyAddress: string;
  propertyPrice: string;
  propertySuburb: string;
  propertyBeds: string;
  propertyBaths: string;
  propertyType: string;
  matchReasonText: string;
}): FollowUpMessageOutput {
  return {
    suggestedSmsText: generateTemplateSMS(context.buyerName, context.propertyAddress, context.propertySuburb),
    suggestedEmailSubject: `New ${context.propertyType} in ${context.propertySuburb || 'your area'}`,
    suggestedEmailBody: generateTemplateEmailBody(
      context.buyerName,
      context.propertyAddress,
      context.propertyPrice,
      context.propertySuburb,
      context.matchReasonText
    ),
  };
}

function generateTemplateSMS(buyerName: string, address: string, suburb: string): string {
  return `Hi ${buyerName}, I have a property in ${suburb || 'your area'} that might interest you. Would you like to know more?`;
}

function generateTemplateEmailBody(
  buyerName: string,
  address: string,
  price: string,
  suburb: string,
  matchReasonText: string
): string {
  return `Hi ${buyerName},

I wanted to reach out about a property that ${matchReasonText}.

${address}
Price: ${price}
${suburb ? `Suburb: ${suburb}` : ''}

Would you like to schedule a viewing or get more information about this property?

Best regards`;
}

