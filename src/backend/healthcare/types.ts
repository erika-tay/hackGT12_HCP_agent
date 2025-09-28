// Email related types
export interface EmailRecord {
  id: string;
  patient_id: string;
  subject: string;
  body: string;
  created_at: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  processed: boolean;
}

export interface EmailResponse {
  success: boolean;
  emails?: EmailRecord[];
  error?: string;
}