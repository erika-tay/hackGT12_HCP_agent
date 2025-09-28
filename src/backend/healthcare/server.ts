import express from 'express';
import cors from 'cors';
import { HealthcareAgent } from './HealthcareAgent.js';

const app = express();
const PORT = process.env.HEALTHCARE_PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize our Mastra AI agent
const healthcareAgent = new HealthcareAgent();

console.log('🚀 Initializing Mastra Healthcare Agent API Server...');

// ===================
// MAIN ENDPOINT: Patient Summary via Mastra Agent
// ===================

app.get('/api/patient/:patientId/summary', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    console.log(`📡 API: Received request for patient ${patientId}`);
    console.log(`🤖 API: Delegating to Mastra HealthcareAgent...`);
    
    // Use Mastra agent tool execution
    const result = await healthcareAgent.executeTool('get-patient-summary', { 
      patientId 
    });
    
    if (result.success) {
      console.log(`✅ API: Mastra agent completed successfully`);
      console.log(`📊 API: Generated ${result.data.alerts.length} alerts, processed ${result.data.stats.totalLabs} labs`);
      
      res.json({
        success: true,
        data: result.data,
        meta: {
          processedBy: 'Mastra HealthcareAgent',
          timestamp: result.generatedAt,
          workflow: result.data.workflow,
          apiVersion: '1.0.0'
        }
      });
    } else {
      console.log(`❌ API: Mastra agent failed - ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          processedBy: 'Mastra HealthcareAgent',
          timestamp: result.generatedAt,
          apiVersion: '1.0.0'
        }
      });
    }
    
  } catch (error: any) {
    console.error('❌ API: Unexpected server error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      meta: {
        processedBy: 'API Server',
        timestamp: new Date().toISOString(),
        apiVersion: '1.0.0'
      }
    });
  }
});

// ===================
// EMAIL PRIORITY ENDPOINT
// ===================

app.post('/api/patient/:patientId/prioritize-email', async (req, res) => {
  console.log('req.params:', req.params);
  console.log('req.body:', req.body);
  
  try {
    const { patientId } = req.params;
    const { text } = req.body;

    if (!patientId || !text) {
      return res.status(400).json({
        success: false,
        error: 'Missing patientId or text',
        meta: {
          processedBy: 'Mastra HealthcareAgent',
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0'
        }
      });
    }

    console.log(`📡 API: Received email prioritization request for patient ${patientId}`);
    console.log(`🤖 API: Delegating to Mastra HealthcareAgent prioritizeEmails tool...`);

    // Use Mastra agent tool execution
    const result = await healthcareAgent.executeTool('prioritize-emails', { 
      patientId, 
      text
    });

    if (result.success) {
      console.log(`✅ API: Email prioritized successfully`);
      res.json({
        success: true,
        data: result.data, // e.g., { priority: 'High', reason: 'Critical lab results mentioned' }
        meta: {
          processedBy: 'Mastra HealthcareAgent',
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0'
        }
      });
    } else {
      console.log(`❌ API: Mastra agent failed to prioritize email - ${result.error}`);
      res.status(400).json({
        success: false,
        error: result.error,
        meta: {
          processedBy: 'Mastra HealthcareAgent',
          timestamp: new Date().toISOString(),
          apiVersion: '1.0.0'
        }
      });
    }

  } catch (error: any) {
    console.error('❌ API: Unexpected server error during email prioritization:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message,
      meta: {
        processedBy: 'API Server',
        timestamp: new Date().toISOString(),
        apiVersion: '1.0.0'
      }
    });
  }
});

// ===================
// MASTRA AGENT STATUS ENDPOINT
// ===================

app.get('/api/agent/status', async (req, res) => {
  try {
    const agentInfo = {
      name: healthcareAgent.name,
      description: healthcareAgent.description,
      tools: healthcareAgent.tools,
      status: 'active',
      framework: 'Mastra',
      capabilities: [
        'Patient data retrieval',
        'Health statistics calculation', 
        'Smart alert generation',
        'Database querying',
        'Workflow orchestration'
      ],
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      agent: agentInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get agent status'
    });
  }
});

// ===================
// MASTRA AGENT TOOLS ENDPOINT (for debugging)
// ===================

app.post('/api/agent/execute-tool', async (req, res) => {
  try {
    const { toolName, params } = req.body;
    
    console.log(`🔧 API: Executing Mastra tool: ${toolName}`);
    
    const result = await healthcareAgent.executeTool(toolName, params);
    
    res.json({
      success: true,
      tool: toolName,
      result,
      executedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Tool execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tool: req.body?.toolName || 'unknown'
    });
  }
});

// ===================
// EMAIL REPLY GENERATION ENDPOINT
// ===================

app.post('/api/emails/:patientId/draft-reply', async (req, res) => {
  try {
    const { patientId } = req.params;
    const { originalEmail, currentDraft } = req.body;
    
    console.log(`📧 API: Generating email reply for patient ${patientId}`);
    
    // Use Mastra agent tool execution for email generation
    const result = await healthcareAgent.executeTool('generate-email-reply', { 
      patientId,
      originalEmail,
      currentDraft: currentDraft || ''
    });
    
    if (result.success) {
      console.log(`✅ API: Email reply generated successfully`);
      
      // Set up Server-Sent Events for streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      });

      // Stream the response
      const replyText = result.reply;
      const words = replyText.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        res.write(words[i] + ' ');
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
      }
      
      res.end();
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to generate reply'
      });
    }
    
  } catch (error: any) {
    console.error('❌ API: Email reply generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ===================
// CEDAR OS CONTEXT-AWARE EMAIL REPLY ENDPOINT
// ===================

app.post('/api/emails/cedar-reply', async (req, res) => {
  try {
    const cedarContext = req.body;
    
    console.log(`🔮 Cedar API: Context-aware email generation for patient ${cedarContext.email.patient.id}`);
    console.log(`📝 Cedar Context: Draft state - ${cedarContext.draft.isEmpty ? 'empty' : `${cedarContext.draft.wordCount} words`}`);
    
    // Use Mastra agent tool execution with Cedar context
    const result = await healthcareAgent.executeTool('generate-cedar-email-reply', cedarContext);
    
    if (result.success) {
      console.log(`✅ Cedar API: Context-aware reply generated successfully`);
      
      // Set up Server-Sent Events for streaming response
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      });

      // Stream the response with realistic delays
      const replyText = result.reply;
      const sentences = replyText.split('. ').filter((s: string) => s.trim());
      
      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i] + (i < sentences.length - 1 ? '. ' : '');
        const words = sentence.split(' ');
        
        for (const word of words) {
          res.write(word + ' ');
          await new Promise(resolve => setTimeout(resolve, 30)); // Realistic typing speed
        }
      }
      
      res.end();
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to generate context-aware reply'
      });
    }
    
  } catch (error: any) {
    console.error('❌ Cedar API: Context-aware reply generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ===================
// HEALTH CHECK ENDPOINT
// ===================

app.get('/api/health', async (req, res) => {
  try {
    // Test agent responsiveness
    const agentTest = await healthcareAgent.executeTool('query-database', {
      table: 'patients',
      limit: 1
    });

    res.json({
      status: 'healthy',
      api: 'Mastra Healthcare Agent API',
      agent: {
        name: healthcareAgent.name,
        framework: 'Mastra',
        responsive: agentTest.success
      },
      database: agentTest.success ? 'connected' : 'connection_issues',
      timestamp: new Date().toISOString(),
      endpoints: [
        'GET /api/patient/:id/summary',
        'GET /api/agent/status', 
        'POST /api/agent/execute-tool',
        'GET /api/health',
        'POST /api/patient/:id/prioritize-email'
      ]
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ===================
// ERROR HANDLING MIDDLEWARE
// ===================

app.use((error: any, req: any, res: any, next: any) => {
  console.error('❌ Unhandled API error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// ===================
// START SERVER
// ===================

app.listen(PORT, () => {
  console.log(`🚀 Mastra Healthcare Agent API running on http://localhost:${PORT}`);
  console.log(`🤖 Agent: ${healthcareAgent.name} initialized and ready`);
  console.log(`⚡ Framework: Mastra with ${healthcareAgent.tools.length} tools available`);
  console.log(`📋 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🔧 Agent Status: http://localhost:${PORT}/api/agent/status`);
  console.log(`👤 Patient Summary: http://localhost:${PORT}/api/patient/{id}/summary`);
});

export default app;
