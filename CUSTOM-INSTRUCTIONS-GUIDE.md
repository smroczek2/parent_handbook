# Custom Instructions User Guide

This guide explains how to add and manage custom safety instructions for your camp chatbot through the web interface.

## What Are Custom Instructions?

Custom instructions are rules and guidelines that the chatbot **MUST always follow** with highest priority. They're essential for:

- **Safety-critical responses** (allergies, medical issues, emergencies)
- **Contact information** (who to call for different types of questions)
- **Behavioral guidelines** (tone, what the chatbot can/cannot do)
- **Camp-specific policies** (electronics, visiting days, etc.)

## How to Add Custom Instructions

### Step 1: Select Your Camp

1. Navigate to the parent portal dashboard
2. Find the **"Camp Registration"** section
3. Select your camp from the dropdown menu

### Step 2: Access Custom Instructions

Once you select a camp, you'll see a new section called **"Custom Safety Instructions"** with a shield icon.

### Step 3: Create Your Instructions

You have two options:

**Option A: Load Template (Recommended for first-time users)**

1. Click the **"Load Template"** button
2. A pre-formatted template will appear with placeholders
3. Replace the placeholders (in `[BRACKETS]`) with your actual information:
   - `[NURSE_EMAIL]` → `nurse@yourcamp.com`
   - `[NURSE_PHONE]` → `(555) 123-4567`
   - `[HEALTH_EMAIL]` → `health@yourcamp.com`
   - etc.

**Option B: Write from scratch**

1. Click in the text area
2. Write your custom instructions using markdown format
3. Start with `# CUSTOM INSTRUCTIONS - HIGHEST PRIORITY`

### Step 4: Save Your Instructions

1. Click **"Save Instructions"**
2. Wait for the confirmation message: "Custom instructions saved successfully!"
3. The chatbot will now follow these rules for all conversations

### Step 5: Verify It's Working

1. Look for the green status box that says **"Custom instructions active"**
2. Test the chatbot with a critical question like:
   - "My child has a peanut allergy, what should I do?"
   - Expected: It should direct you to contact the camp nurse with the contact info you provided

## Example Custom Instructions

```markdown
# CUSTOM INSTRUCTIONS - HIGHEST PRIORITY

YOU MUST FOLLOW THESE INSTRUCTIONS ABOVE ALL ELSE.

## CRITICAL SAFETY RULES

### Allergies & Dietary Restrictions
NEVER provide specific medical advice about allergies or dietary restrictions.

ALWAYS respond with: "For allergy and dietary questions, please contact our camp nurse, Sarah Johnson, at nurse@sunnycamp.com or (555) 123-4567."

### Medical & Health Questions
NEVER diagnose or provide medical advice.

For health questions, ALWAYS respond: "For medical questions, please contact our Health Center at health@sunnycamp.com or (555) 123-4568."

### Medication Questions
ALWAYS respond: "All medication questions must be directed to our Health Center at health@sunnycamp.com or (555) 123-4568."

### Emergency Information
For emergencies, ALWAYS include: "In case of emergency during camp, call our 24/7 line at (555) 911-0000."

## BEHAVIORAL GUIDELINES

- Be warm and professional
- Never make medical diagnoses
- When you don't know, say: "I don't have that information. Please contact our office at info@sunnycamp.com or (555) 123-4500."

## CAMP-SPECIFIC INFORMATION

- Session 1: June 20 - July 15, 2025
- Session 2: July 18 - August 12, 2025
- Visiting Day: Third Sunday of each session, 10 AM - 3 PM
- Electronics Policy: No personal electronics allowed
```

## How It Works Behind the Scenes

1. When you save instructions, they're uploaded to your camp's vector store in OpenAI
2. The file is named `custom-instructions.md` automatically
3. When anyone chats with the bot for your camp, these instructions are loaded and given **highest priority**
4. The instructions are cached for performance - no delays for subsequent chats

## Editing Instructions

To update your custom instructions:

1. Select the same camp from the dropdown
2. The current instructions will load in the text area automatically
3. Make your changes
4. Click **"Save Instructions"** again
5. The old version is automatically replaced

## Best Practices

### Do's ✅

- **Be specific**: Include exact contact information (names, emails, phone numbers)
- **Use clear rules**: "ALWAYS respond with..." or "NEVER provide..."
- **Cover critical scenarios**: Allergies, medications, emergencies, behavioral issues
- **Update annually**: Review session dates, staff contacts, and policies before each season
- **Test thoroughly**: Ask the chatbot critical questions to verify responses

### Don'ts ❌

- **Don't leave placeholders**: Replace ALL `[BRACKETS]` with real information
- **Don't use vague language**: Instead of "contact staff," say "contact Camp Director Jane Smith at..."
- **Don't forget emergency contacts**: Always include 24/7 emergency phone numbers
- **Don't override safety**: Never instruct the bot to provide medical advice

## Troubleshooting

**Q: I saved instructions but they're not working**
- Verify you see the green "Custom instructions active" status box
- Check browser console for any errors (F12 → Console tab)
- Try refreshing the page and selecting the camp again

**Q: Instructions from one camp are showing up for another camp**
- Each camp has completely separate instructions - this shouldn't happen
- If it does, contact technical support immediately

**Q: The template button doesn't do anything**
- Make sure you've selected a camp first
- Try clicking "Load Template" again
- If it still doesn't work, you can copy the template from above and paste it manually

**Q: Save button says "Saving..." forever**
- Check your internet connection
- Look in browser console for error messages
- Contact support if the issue persists

## Testing Your Instructions

After saving, test these scenarios:

| Test Question | Expected Behavior |
|--------------|-------------------|
| "My child has a peanut allergy" | Should direct to camp nurse with contact info |
| "Can I send Tylenol with my camper?" | Should direct to health center with contact info |
| "What if there's an emergency?" | Should provide 24/7 emergency phone number |
| "What's the camp schedule?" | Should answer from documentation (not escalate) |

## Support

For help with custom instructions:

- **Technical issues**: Check [RAG-ENHANCEMENTS.md](RAG-ENHANCEMENTS.md) for technical details
- **Template questions**: See [custom-instructions-template.md](custom-instructions-template.md)
- **General help**: Contact your chatbot administrator

---

**Remember**: Custom instructions are the chatbot's highest priority rules. They ensure parent safety and proper escalation for critical questions. Take time to set them up correctly!
