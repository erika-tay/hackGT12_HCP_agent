import { Agent, Tool } from '@mastra/core';
import { createClient } from '@supabase/supabase-js';
import { openai } from '@ai-sdk/openai';
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

// Define tools
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
        generateEmailReplyTool
      ]
    });
    
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
      default:
        throw new Error(`Unknown tool: ${toolName}`);
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
      const { generateText } = await import('ai');
      
      const response = await generateText({
        model: openai('gpt-4o-mini'),
        prompt: prompt,
        temperature: 0.7,
        maxTokens: 500
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
