import { Agent, Tool } from '@mastra/core';
import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables from project root
dotenv.config({ path: '../../../.env' });

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Email interfaces
interface EmailRecord {
  id: string;
  patient_id: string;
  subject: string;
  body: string;
  created_at: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  processed: boolean;
}

interface EmailResponse {
  success: boolean;
  emails?: EmailRecord[];
  error?: string;
}

// Define tools
const getEmailsTool = new Tool({
  id: 'get-emails',
  description: 'Get all emails with timestamps from Supabase',
  parameters: z.object({}),
  execute: async () => {
    const agent = new HealthcareAgent();
    return await agent.getEmails();
  }
});

const getPatientSummaryTool = new Tool({
  id: 'get-patient-summary',
  description: 'Get comprehensive patient health summary',
  parameters: z.object({
    patientId: z.string().describe('Patient ID to get summary for')
  }),
  execute: async ({ patientId }) => {
    const agent = new HealthcareAgent();
    return await agent.getPatientSummary(patientId);
  }
});

const queryDatabaseTool = new Tool({
  id: 'query-database',
  description: 'Query the database for patient data',
  parameters: z.object({
    table: z.string().describe('Table name to query'),
    filters: z.any().describe('Query filters and options')
  }),
  execute: async ({ table, filters }) => {
    const agent = new HealthcareAgent();
    return await agent.queryDatabase(table, filters);
  }
});

const calculateHealthStatsTool = new Tool({
  id: 'calculate-health-stats',
  description: 'Calculate health statistics from patient data',
  parameters: z.object({
    data: z.any().describe('Patient data to analyze')
  }),
  execute: async ({ data }) => {
    const agent = new HealthcareAgent();
    return await agent.calculateHealthStats(data);
  }
});


const generateEmailReplyTool = new Tool({
  id: 'generate-email-reply',
  description: 'Generate AI-powered email replies with patient context',
  parameters: z.object({
    patientId: z.string().describe('Patient ID to get context for'),
    originalEmail: z.string().describe('Original email content from patient'),
    currentDraft: z.string().describe('Current draft text (if any)')
  }),
  execute: async ({ patientId, originalEmail, currentDraft }) => {
    const agent = new HealthcareAgent();
    return await agent.generateEmailReply(patientId, originalEmail, currentDraft);
  }
});

const generateCedarEmailReplyTool = new Tool({
  id: 'generate-cedar-email-reply',
  description: 'Generate context-aware email replies using Cedar OS rich context',
  parameters: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string(),
      body: z.string(),
      patient: z.object({
        name: z.string(),
        mrn: z.string(),
        id: z.string()
      })
    }),
    draft: z.object({
      current: z.string(),
      isEmpty: z.boolean(),
      wordCount: z.number(),
      hasGreeting: z.boolean(),
      hasClosing: z.boolean(),
      sentiment: z.string()
    }),
    ui: z.object({
      selectedTab: z.string(),
      hasPatientSummary: z.boolean(),
      patientHealthScore: z.number().nullable(),
      riskLevel: z.string().nullable()
    }),
    instruction: z.string()
  }),
  execute: async (cedarContext) => {
    const agent = new HealthcareAgent();
    return await agent.generateCedarAwareEmailReply(cedarContext);
  }
});
const prioritizeEmailsTool = new Tool({
  id: 'prioritize-emails',
  description: 'Determine priority levels for all emails in the inbox',
  parameters: z.object({
    emails: z.array(z.object({
      id: z.string(),
      patientId: z.string().describe('Patient ID associated with the email'),
      text: z.string().describe('Email text to analyze'),
      subject: z.string().describe('Email subject'),
    })).describe('Array of emails to prioritize')
  }),
  execute: async ({ emails }) => {
    const agent = new HealthcareAgent();
    return await agent.prioritizeEmails(emails);
  }
});

const generateClinicalNoteTool = new Tool({
  id: 'generate-clinical-note',
  description: 'Generate or enhance clinical documentation using patient context and medical data',
  inputSchema: z.object({
    patientId: z.string().describe('Patient ID to generate note for'),
    noteType: z.string().describe('Type of clinical note (Progress Note, Assessment, etc.)'),
    currentContent: z.string().describe('Current note content if enhancing existing note'),
    instruction: z.string().describe('Specific instruction for note generation'),
    enhanceExisting: z.boolean().describe('Whether to enhance existing content or start fresh')
  }),
  execute: async (context) => {
    const agent = new HealthcareAgent();
    return await agent.generateClinicalNote(context.args);
  }
});

const summarizeEmailForNoteTool = new Tool({
  id: 'summarize-email-for-note',
  description: 'Analyzes a patient email and extracts a concise, one-sentence summary to be used as a clinical note.',
  parameters: z.object({
    emailContent: z.string().describe("The raw text content from the patient's email.")
  }),
  execute: async ({ emailContent }) => {
    const agent = new HealthcareAgent();
    return await agent.summarizeEmailForNote(emailContent);
  }
});

const saveClinicalNoteTool = new Tool({
    id: 'save-clinical-note',
    description: "Saves a clinical note to the patient's chart in the clinical_notes table.",
    parameters: z.object({
        patientId: z.string().describe("The ID of the patient the note belongs to."),
        noteContent: z.string().describe("The final text content of the note to be saved.")
    }),
    execute: async ({ patientId, noteContent }) => {
        const agent = new HealthcareAgent();
        return await agent.saveClinicalNote(patientId, noteContent);
    }
});

// --- NEW TOOL DEFINITION ---
const addNoteFromEmailTool = new Tool({
  id: 'add-note-from-email',
  description: 'Analyzes email content, converts it into a structured clinical note, and saves it to the patient chart.',
  parameters: z.object({
    patientId: z.string().describe("The ID of the patient the note belongs to."),
    emailContent: z.string().describe("The raw text content from the patient's email.")
  }),
  execute: async ({ patientId, emailContent }) => {
    const agent = new HealthcareAgent();
    return await agent.addNoteFromEmail(patientId, emailContent);
  }
});




export class HealthcareAgent extends Agent {

  constructor() {
    super({
      name: 'HealthcareAgent',
      description: 'AI agent for healthcare data processing and patient summaries',
      model: openai('gpt-4o-mini'),
      tools: [
        getPatientSummaryTool,
        queryDatabaseTool,
        calculateHealthStatsTool,
        generateEmailReplyTool,
        generateCedarEmailReplyTool,
        prioritizeEmailsTool,
        generateClinicalNoteTool, 
        summarizeEmailForNoteTool,
        saveClinicalNoteTool
      ]
    });

    this.model = this.model;
    console.log('🤖 Mastra Healthcare Agent initialized');
  }

  // Mastra tool execution
  async executeTool(toolName: string, params: any): Promise<any> {
    console.log(`🔧 Executing tool: ${toolName}`);
    
    switch (toolName) {
      case 'get-patient-summary':
        return await this.getPatientSummary(params.patientId);
      case 'query-database':
        return await this.queryDatabase(params.table, params.filters);
      case 'calculate-health-stats':
        return await this.calculateHealthStats(params.data);
      case 'generate-email-reply':
        return await this.generateEmailReply(params.patientId, params.originalEmail, params.currentDraft);
      case 'generate-cedar-email-reply':
        return await this.generateCedarAwareEmailReply(params);
      case 'prioritize-emails':
        return await this.prioritizeEmail(params.patientId, params.text);
      case 'summarize-email-for-note':
        return await this.summarizeEmailForNote(params.emailContent);
      case 'save-clinical-note':
        return await this.saveClinicalNote(params.patientId, params.noteContent);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  // Prioritize multiple emails
  async prioritizeEmails(emails: Array<{ id: string; patientId: string; text: string; subject: string }>) {
    try {
      console.log(`📧 Prioritizing ${emails.length} emails...`);
      
      const priorityResults = await Promise.all(
        emails.map(async (email) => {
          // Get patient context
          const patientSummary = await this.getPatientSummary(email.patientId);
          
          const prompt = `As a healthcare professional, evaluate the priority of this patient email.

Subject: ${email.subject}

Content: ${email.text}

Patient Context:
${patientSummary.success && patientSummary.data ? `
- Health Score: ${patientSummary.data.stats.healthScore}/100
- Risk Level: ${patientSummary.data.stats.riskLevel}
- Recent Abnormal Labs: ${patientSummary.data.stats.abnormalLabs}
- Critical Labs: ${patientSummary.data.stats.criticalLabs}
` : 'Patient context unavailable'}

Determine the priority level (HIGH/MEDIUM/LOW) and provide brief reasoning. Response format:
{
  "priority": "HIGH|MEDIUM|LOW",
  "reasoning": "Brief explanation of priority level"
}`;

          const { generateText } = await import('ai');
          const response = await generateText({
            model: openai('gpt-4o-mini'),
            prompt,
            temperature: 0.3
          });

          let result;
          try {
            result = JSON.parse(response.text);
          } catch {
            result = {
              priority: "MEDIUM",
              reasoning: "Unable to determine priority - defaulting to medium"
            };
          }

          return {
            emailId: email.id,
            ...result
          };
        })
      );

      return {
        success: true,
        data: priorityResults,
        generatedAt: new Date().toISOString(),
        agent: this.name
      };

    } catch (error: any) {
      console.error("❌ Error prioritizing emails:", error);
      return {
        success: false,
        error: error.message,
        generatedAt: new Date().toISOString(),
        agent: this.name
      };
    }
  }

  // Main function: Get comprehensive patient summary
  async getPatientSummary(patientId: string) {
    try {
      console.log(`🔍 Mastra Agent: Getting summary for patient: ${patientId}`);

      // Use Mastra's workflow capabilities
      const workflow = this.createWorkflow([
        'get-basic-patient-info',
        'get-recent-labs',
        'get-active-medications',
        'get-recent-emails',
        'calculate-health-stats',
        'generate-alerts'
      ]);

      // Step 1: Get basic patient info
      const patient = await this.queryDatabase('patients', { id: patientId });
      if (!patient.success || !patient.data?.[0]) {
        throw new Error('Patient not found');
      }

      // Step 2: Get recent lab results
      const recentLabs = await this.queryDatabase('lab_results', {
        patient_id: patientId,
        orderBy: { column: 'lab_date', ascending: false },
        limit: 10
      });

      // Step 3: Get active medications
      const medications = await this.queryDatabase('medications', {
        patient_id: patientId,
        active: true
      });

      // Step 4: Get recent emails
      const recentEmails = await this.queryDatabase('emails', {
        patient_id: patientId,
        orderBy: { column: 'created_at', ascending: false },
        limit: 5
      });

      // Step 5: Use Mastra to calculate health statistics
      const healthStats = await this.executeTool('calculate-health-stats', {
        data: {
          labs: recentLabs.data || [],
          medications: medications.data || [],
          emails: recentEmails.data || []
        }
      });

      // Step 6: Generate comprehensive summary
      const summary = {
        patient: {
          name: `${patient.data[0].first_name} ${patient.data[0].last_name}`,
          mrn: patient.data[0].medical_record_number,
          dateOfBirth: patient.data[0].date_of_birth,
          allergies: patient.data[0].allergies || []
        },
        stats: healthStats.data,
        recentLabs: recentLabs.data?.slice(0, 5) || [],
        medications: medications.data || [],
        recentEmails: recentEmails.data || [],
        alerts: this.generateAlerts({
          labs: recentLabs.data || [],
          emails: recentEmails.data || []
        }),
        workflow: workflow.id,
        processedBy: 'Mastra HealthcareAgent'
      };

      // Log successful execution
      await this.logAgentAction('get_patient_summary', patientId, true);

      console.log(`✅ Mastra Agent: Summary generated for ${summary.patient.name}`);
      
      return {
        success: true,
        data: summary,
        generatedAt: new Date().toISOString(),
        agent: this.name
      };

    } catch (error: any) {
      console.error('❌ Mastra Agent Error:', error);
      await this.logAgentAction('get_patient_summary', patientId, false, error.message);
      
      return {
        success: false,
        error: error.message,
        generatedAt: new Date().toISOString(),
        agent: this.name
      };
    }
  }


  async summarizeEmailForNote(emailContent: string) {
    try {
      console.log(`🧠 Summarizing email content for a clinical note...`);

      const prompt = `Analyze the following patient email. Extract the primary subjective complaint or piece of information.
      Respond with ONLY a single, concise sentence suitable for a clinical note.
      For example: "Patient reports experiencing headaches for the past 3 days." OR "Patient reports their home blood pressure reading was 140/90 this morning."

      **Patient Email:**
      """
      ${emailContent}
      """
      `;

      try {
        const { text } = await generateText({
          model: openai('gpt-4o-mini'),
          prompt,
          system: `You are a medical AI assistant that summarizes patient communication into a concise clinical statement.`
        });
        
        return {
          success: true,
          data: { suggestedNote: text.trim() }
        };
      } catch (error: any) {
        console.error('❌ OpenAI API Error:', error.message);
        if (error.message?.includes('quota') || error.message?.includes('billing')) {
          throw new Error('OpenAI quota exceeded. Please check your API key and billing settings.');
        }
        throw error;
      }

    } catch (error: any) {
      console.error('❌ Error summarizing email for note:', error);
      return {
        success: false,
        error: error.message || 'Failed to summarize email.'
      };
    }
  }

  async saveClinicalNote(patientId: string, noteContent: string) {
    try {
      console.log(`💾 Saving note for patient ${patientId}`);

      if (!noteContent.trim()) {
        throw new Error("Note content cannot be empty.");
      }

      const { data, error } = await supabase
        .from('clinical_notes')
        .insert({
          patient_id: patientId,
          note_date: new Date().toISOString().split('T')[0],
          note_type: 'Email Note',
          author: "Dr. Anya", 
          subject: "Follow Up on Your Recent Email",
          content: noteContent.trim()
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log(`✅ Note saved successfully with ID: ${data.id}`);
      await this.logAgentAction('save-encounter-note', patientId, true);

      return {
        success: true,
        data: {
          newNoteId: data.id,
          message: "Note successfully saved to patient's chart."
        }
      };

    } catch (error: any) {
        console.error('❌ Error saving encounter note:', error);
        await this.logAgentAction('save-encounter-note', patientId, false, error.message);
        return {
            success: false,
            error: error.message || 'Failed to save note to the database.'
        };
    }
  }

  // Mastra database query tool
  async queryDatabase(table: string, options: any = {}) {
    try {
      let query = supabase.from(table).select('*');
      
      // Apply filters
      Object.entries(options).forEach(([key, value]) => {
        if (key === 'orderBy') {
          query = query.order((value as any).column, { ascending: (value as any).ascending ?? true });
        } else if (key === 'limit') {
          query = query.limit(value as number);
        } else if (Array.isArray(value)) {
          query = query.in(key, value);
        } else {
          query = query.eq(key, value);
        }
      });

      const { data, error } = await query;
      
      if (error) throw error;
      
      return { success: true, data };
    } catch (error: any) {
      console.error(`Database query error on ${table}:`, error);
      return { success: false, error: error.message };
    }
  }
 
  // Mastra health statistics calculation
  async calculateHealthStats(data: any) {
    try {
      const { labs, medications, emails } = data;
      
      const abnormalLabs = labs.filter((lab: any) => lab.is_abnormal);
      const criticalLabs = abnormalLabs.filter((lab: any) => lab.abnormal_type === 'critical');
      const highPriorityEmails = emails.filter((email: any) => email.priority >= 8);

      const stats = {
        totalLabs: labs.length,
        abnormalLabs: abnormalLabs.length,
        criticalLabs: criticalLabs.length,
        activeMedications: medications.length,
        recentEmails: emails.length,
        highPriorityEmails: highPriorityEmails.length,
        healthScore: this.calculateHealthScore(labs, medications),
        riskLevel: criticalLabs.length > 0 ? 'HIGH' : abnormalLabs.length > 0 ? 'MEDIUM' : 'LOW'
      };

      return { success: true, data: stats };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Generate smart alerts using Mastra logic
  generateAlerts(data: any) {
    const alerts = [];
    const { labs, emails } = data;

    // Critical lab alerts
    const criticalLabs = labs.filter((lab: any) => lab.abnormal_type === 'critical');
    criticalLabs.forEach((lab: any) => {
      alerts.push({
        type: 'critical',
        category: 'lab',
        message: `CRITICAL: ${lab.test_name} = ${lab.value} ${lab.unit}`,
        severity: 'high',
        actionRequired: true,
        generatedBy: 'Mastra Agent'
      });
    });

    // High priority email alerts
    const urgentEmails = emails.filter((email: any) => email.priority >= 8);
    urgentEmails.forEach((email: any) => {
      alerts.push({
        type: 'communication',
        category: 'email',
        message: `High priority: ${email.subject}`,
        severity: 'medium',
        actionRequired: true,
        generatedBy: 'Mastra Agent'
      });
    });

    return alerts;
  }

  // Simple health score calculation (0-100)
  calculateHealthScore(labs: any[], medications: any[]) {
    let score = 100;
    
    // Deduct points for abnormal labs
    const abnormalLabs = labs.filter((lab: any) => lab.is_abnormal);
    score -= abnormalLabs.length * 5;
    
    // Deduct extra points for critical labs
    const criticalLabs = abnormalLabs.filter((lab: any) => lab.abnormal_type === 'critical');
    score -= criticalLabs.length * 15;
    
    // Consider medication burden
    if (medications.length > 5) score -= 10;
    if (medications.length > 10) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  // Prioritize Emails
  async prioritizeEmail(patientId: string, text: string,) {
    try {
      console.log(`📧 Prioritizing email for patient status: ${patientId}`);

      const prompt = `You are an AI assistant prioritizing healthcare emails. 
      Decide if the priority is "High", "Medium", or "Low".
      Rules:
      - HIGH: Urgent symptoms, emergencies, severe health issues, medication problems, critical patient.
      - MEDIUM: Appointment scheduling, follow-ups, moderate patient concerns.
      - LOW: General inquiries, admin issues, stable patient updates.

      Respond in JSON format:
      {
        "priority": "High" | "Medium" | "Low",
        "reasoning": "string explanation"
      }

      Email: """${text}"""
      Patient Id: ${patientId}`;
      
      // Use AI SDK v4 compatible generateText
      const response = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        temperature: 0.5
      });

      console.log(response);

      let rawResponseText = response.text ?? '{}';
      
      // Attempt to strip markdown code block wrapper if present
      if (rawResponseText.startsWith('```json')) {
        rawResponseText = rawResponseText.substring(rawResponseText.indexOf('{'), rawResponseText.lastIndexOf('}') + 1).trim();
      }

      const result = JSON.parse(rawResponseText); // parse output safely

      console.log('result', result);

      // Ensure the result has the expected priority and reasoning structure
      if (!result.priority || !result.reasoning) {
        throw new Error("AI response missing 'priority' or 'reasoning' fields.");
      }

      return {
        success: true,
        data: {
          priority: result.priority,
          reasoning: result.reasoning,
        },
        generatedAt: new Date().toISOString(),
        agent: this.name
      };

    } catch (error: any) {
      console.error("❌ Error prioritizing email:", error);

      return {
        success: false,
        error: error.message,
        generatedAt: new Date().toISOString(),
        agent: this.name
      };
    }
  }


  // Create Mastra workflow
  createWorkflow(steps: string[]) {
    return {
      id: `workflow-${Date.now()}`,
      steps,
      startTime: new Date().toISOString(),
      agent: this.name
    };
  }

  // Generate AI-powered email reply with patient context
  async generateEmailReply(patientId: string, originalEmail: string, currentDraft: string) {
    try {
      console.log('🤖 HealthcareAgent: Generating email reply...');
      
      // First, get patient summary using existing tool
      console.log('🔍 Getting patient context...');
      const patientSummary = await this.getPatientSummary(patientId);
      
      if (!patientSummary.success) {
        return {
          success: false,
          error: 'Failed to get patient context for email generation'
        };
      }

      const patientData = patientSummary.data;
      const prompt = `You are a healthcare professional assistant helping to draft a professional email reply to a patient.

**Patient Information:**
- Name: ${patientData.patient.name}
- Date of Birth: ${patientData.patient.dateOfBirth}
- Health Score: ${patientData.stats.healthScore}/100
- Risk Level: ${patientData.stats.riskLevel}

**Original Patient Email:**
${originalEmail}

**Current Draft (if any):**
${currentDraft}

**Patient Health Context:**
- Total Lab Results: ${patientData.stats.totalLabs} (${patientData.stats.abnormalLabs} abnormal, ${patientData.stats.criticalLabs} critical)
- Active Medications: ${patientData.stats.activeMedications}
- Allergies: ${patientData.patient.allergies.join(', ') || 'None on file'}
- Recent Alerts: ${patientData.alerts.length}

**Recent Lab Results:** ${JSON.stringify(patientData.recentLabs.slice(0, 3), null, 2)}

**Active Medications:** ${JSON.stringify(patientData.medications.slice(0, 5), null, 2)}

**Instructions:**
1. Write a professional, empathetic, and informative reply
2. Address the patient's specific concerns mentioned in their email
3. Use the health context to provide relevant medical insights (but avoid definitive diagnoses)
4. Include appropriate next steps or recommendations
5. Maintain a warm, professional tone suitable for healthcare communication
6. If there's already a current draft, continue/improve it rather than starting over
7. Keep the response concise but comprehensive (2-3 paragraphs)

Please generate the email reply:`;

      // Use AI SDK v4 compatible generateText
      const response = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        temperature: 0.7
      });

      const fullReply = response.text || '';

      if (fullReply) {
        return {
          success: true,
          reply: fullReply.trim()
        };
      } else {
        return {
          success: false,
          error: 'No response generated'
        };
      }

    } catch (error: any) {
      console.error('❌ HealthcareAgent: Email reply generation failed:', error);
      return {
        success: false,
        error: error.message || 'Email generation failed'
      };
    }
  }

  // Generate Cedar OS context-aware email reply
  async generateCedarAwareEmailReply(cedarContext: any) {
    try {
      console.log('🔮 HealthcareAgent: Generating Cedar-aware email reply...');
      console.log(`📧 Context: ${cedarContext.email.subject}`);
      console.log(`✏️ Draft: ${cedarContext.draft.isEmpty ? 'Empty' : `${cedarContext.draft.wordCount} words, ${cedarContext.draft.sentiment} tone`}`);
      
      // Get patient summary for medical context
      console.log('🏥 Getting patient medical context...');
      const patientSummary = await this.getPatientSummary(cedarContext.email.patient.id);
      
      if (!patientSummary.success) {
        return {
          success: false,
          error: 'Failed to get patient medical context for Cedar reply'
        };
      }

      const patientData = patientSummary.data;
      const prompt = `You are a healthcare professional assistant with Cedar OS context awareness. Generate a contextually appropriate email reply.

**CEDAR CONTEXT ANALYSIS:**
${cedarContext.instruction}

**EMAIL TO RESPOND TO:**
Subject: ${cedarContext.email.subject}
From: ${cedarContext.email.patient.name} (MRN: ${cedarContext.email.patient.mrn})

Content:
${cedarContext.email.body}

**CURRENT DRAFT STATE:**
${cedarContext.draft.isEmpty ? 'No draft started' : `
Current Draft (${cedarContext.draft.wordCount} words, ${cedarContext.draft.sentiment} sentiment):
"${cedarContext.draft.current}"

Analysis:
- Has greeting: ${cedarContext.draft.hasGreeting}
- Has closing: ${cedarContext.draft.hasClosing}
- Current tone: ${cedarContext.draft.sentiment}
`}

**PATIENT MEDICAL CONTEXT:**
- Name: ${patientData?.patient.name}
- Health Score: ${patientData?.stats.healthScore}/100
- Risk Level: ${patientData?.stats.riskLevel}
- Lab Results: ${patientData?.stats.totalLabs} total (${patientData?.stats.abnormalLabs} abnormal)
- Active Medications: ${patientData?.stats.activeMedications}
- Allergies: ${patientData?.patient.allergies.join(', ') || 'None on file'}

**UI CONTEXT:**
- Tab: ${cedarContext.ui.selectedTab}
- Patient summary loaded: ${cedarContext.ui.hasPatientSummary}

**INSTRUCTIONS:**
${cedarContext.draft.isEmpty ? `
CREATE a new professional email reply:
1. Start with appropriate greeting
2. Address patient's specific concerns from their email
3. Use medical context to provide relevant insights
4. Include appropriate next steps
5. End with professional closing
` : `
CONTINUE the existing draft:
1. Maintain the same ${cedarContext.draft.sentiment} tone and style
2. Build upon what's already written - don't restart
3. ${cedarContext.draft.hasGreeting ? 'Continue from where the draft left off' : 'Add greeting if missing'}
4. ${cedarContext.draft.hasClosing ? 'Draft is nearly complete' : 'Add appropriate closing'}
5. Seamlessly extend the existing content
`}

Generate the email reply (${cedarContext.draft.isEmpty ? 'new' : 'continuation'}):`;

      // Use AI SDK v4 compatible generateText
      const response = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        temperature: 0.7
      });

      const fullReply = response.text || '';

      if (fullReply) {
        return {
          success: true,
          reply: fullReply.trim()
        };
      } else {
        return {
          success: false,
          error: 'No Cedar-aware response generated'
        };
      }

    } catch (error: any) {
      console.error('❌ HealthcareAgent: Cedar-aware email reply generation failed:', error);
      return {
        success: false,
        error: error.message || 'Cedar-aware email generation failed'
      };
    }
  }

  // Clinical Note Generation Method
  async generateClinicalNote(params: {
    patientId: string;
    noteType: string;
    currentContent: string;
    instruction: string;
    enhanceExisting: boolean;
  }) {
    try {
      console.log(`📝 Generating clinical note for patient ${params.patientId}`);
      
      // Get comprehensive patient data for context
      const patientData = await this.getPatientSummary(params.patientId);
      
      if (!patientData?.success) {
        throw new Error('Failed to get patient context for note generation');
      }

      const prompt = params.enhanceExisting && params.currentContent
        ? `Enhance and continue the following clinical note:

**Current Note Content:**
${params.currentContent}

**Instruction:** ${params.instruction}

**Patient Context:**
${this.formatPatientContextForNote(patientData.data)}

Please continue or enhance this clinical note following professional medical documentation standards. Maintain SOAP format where appropriate and ensure clinical accuracy.`
        : `Generate a comprehensive ${params.noteType} for this patient:

**Instruction:** ${params.instruction}

**Patient Context:**
${this.formatPatientContextForNote(patientData.data)}

Please generate a professional clinical note following standard medical documentation practices. Use SOAP format where appropriate (Subjective, Objective, Assessment, Plan).`;

      const result = await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        system: `You are a medical AI assistant specialized in clinical documentation. Generate comprehensive, accurate, and professional clinical notes based on patient data. Always maintain medical accuracy and follow standard documentation practices.`
      });

      await this.logAgentAction('generate-clinical-note', params.patientId, true);
      
      return {
        success: true,
        note: result.text,
        noteType: params.noteType,
        generatedBy: 'Mastra Healthcare Agent',
        timestamp: new Date().toISOString(),
        enhanced: params.enhanceExisting
      };

    } catch (error: any) {
      console.error('❌ Clinical note generation error:', error);
      await this.logAgentAction('generate-clinical-note', params.patientId, false, error.message);
      
      return {
        success: false,
        error: error.message || 'Clinical note generation failed'
      };
    }
  }

  // Helper method to format patient context for clinical notes
  private formatPatientContextForNote(patientData: any): string {
    if (!patientData) return 'Patient data not available';

    return `
**Patient Information:**
- Name: ${patientData.patient?.name || 'Unknown'}
- Date of Birth: ${patientData.patient?.dateOfBirth || 'Unknown'}
- Health Score: ${patientData.stats?.healthScore || 'N/A'}/100
- Risk Level: ${patientData.stats?.riskLevel || 'Unknown'}
- Allergies: ${patientData.patient?.allergies?.join(', ') || 'None on file'}

**Clinical Summary:**
- Total Lab Results: ${patientData.stats?.totalLabs || 0} (${patientData.stats?.abnormalLabs || 0} abnormal, ${patientData.stats?.criticalLabs || 0} critical)
- Active Medications: ${patientData.stats?.activeMedications || 0}
- Recent Alerts: ${patientData.alerts?.length || 0}

**Recent Lab Results:** ${JSON.stringify(patientData.recentLabs?.slice(0, 3) || [], null, 2)}

**Active Medications:** ${JSON.stringify(patientData.medications?.slice(0, 5) || [], null, 2)}
    `.trim();
  }

  // Log agent actions for audit
  async logAgentAction(action: string, patientId: string, success: boolean, errorMessage: string | null = null) {
    try {
      await supabase.from('agent_logs').insert({
        agent_name: this.name,
        action,
        data: JSON.stringify({ 
          patientId, 
          timestamp: new Date().toISOString(),
          mastraAgent: true 
        }),
        success,
        error_message: errorMessage,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log agent action:', error);
    }
  }
}

export default HealthcareAgent;
