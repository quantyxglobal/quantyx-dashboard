import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

/*== AMPLIFY AI CONFIGURATION =============================================
This schema defines AI-powered conversation and generation routes for the
Quantix Global medilegal dashboard. It includes:
- Medical case analysis conversations
- Document summarization and generation
- Medical chronology assistance
=========================================================================*/

const schema = a.schema({
  // AI Conversation Route - for interactive medical case analysis
  chat: a
    .conversation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt: `You are a helpful AI assistant for Quantix Global, a medilegal services company. 
      You help legal professionals analyze medical cases, understand medical terminology, and prepare case documentation.
      You should be professional, accurate, and provide clear explanations of medical concepts.
      When discussing medical cases, always maintain HIPAA compliance and remind users about confidentiality.`,
    })
    .authorization((allow) => [allow.authenticated()]),

  // AI Generation Route - for document generation and summarization
  generateMedicalSummary: a
    .generation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt: `You are a medical document summarization expert for Quantix Global.
      Generate clear, concise medical summaries from provided medical records.
      Focus on key medical events, diagnoses, treatments, and outcomes.
      Use professional medical terminology while remaining accessible to legal professionals.`,
    })
    .arguments({
      medicalRecords: a.string(),
      summaryType: a.string(), // e.g., "chronology", "narrative", "demand_letter"
    })
    .returns(a.customType({
      summary: a.string(),
      keyFindings: a.string().array(),
      timeline: a.string().array(),
    }))
    .authorization((allow) => [allow.authenticated()]),

  // AI Generation Route - for case analysis
  analyzeMedicalCase: a
    .generation({
      aiModel: a.ai.model('Claude 3.5 Sonnet'),
      systemPrompt: `You are a medical case analysis expert for Quantix Global.
      Analyze medical cases and provide insights on medical causation, treatment appropriateness, and case strength.
      Identify key medical issues, potential expert witnesses needed, and areas requiring further investigation.`,
    })
    .arguments({
      caseDescription: a.string(),
      medicalRecords: a.string(),
      analysisType: a.string(), // e.g., "causation", "standard_of_care", "damages"
    })
    .returns(a.customType({
      analysis: a.string(),
      keyIssues: a.string().array(),
      recommendations: a.string().array(),
      expertWitnessNeeds: a.string().array(),
    }))
    .authorization((allow) => [allow.authenticated()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});

/*== USAGE EXAMPLES =======================================================
// 1. Chat Conversation
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@/amplify/data/resource";

const client = generateClient<Schema>();

// Start a conversation
const { data: conversation } = await client.conversations.chat.create();

// Send a message
await conversation.sendMessage({
  content: [{ text: "Can you explain the medical significance of a herniated disc at L4-L5?" }]
});

// Listen for responses
conversation.onStreamEvent({
  next: (event) => {
    console.log(event);
  },
  error: (error) => {
    console.error(error);
  }
});

// 2. Generate Medical Summary
const { data: summary } = await client.generations.generateMedicalSummary({
  medicalRecords: "Patient medical records text...",
  summaryType: "chronology"
});

// 3. Analyze Medical Case
const { data: analysis } = await client.generations.analyzeMedicalCase({
  caseDescription: "Case description...",
  medicalRecords: "Medical records...",
  analysisType: "causation"
});
=========================================================================*/

// return <ul>{todos.map(todo => <li key={todo.id}>{todo.content}</li>)}</ul>
