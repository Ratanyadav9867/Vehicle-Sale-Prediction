/**
 * frontend/src/api/support.ts
 * API client for the Customer Support feature.
 */

import { http } from './client';

export interface SupportTicket {
  id: number;
  name: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  attachment_path: string | null;
  attachment_name: string | null;
  status: 'open' | 'resolved' | 'closed';
  ip_address: string;
  created_at: string;
  updated_at: string;
}

export interface TicketListResponse {
  items: SupportTicket[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubmitTicketResponse {
  ticket_id: number;
  message: string;
  email_sent: boolean;
}

/** Submit a new support ticket (multipart form, public endpoint). */
export async function submitTicket(formData: FormData): Promise<SubmitTicketResponse> {
  const response = await http.post<SubmitTicketResponse>('/api/support/tickets', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 20000,
  });
  return response.data;
}

/** Fetch paginated list of support tickets (admin only). */
export async function fetchTickets(params: {
  status?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<TicketListResponse> {
  const response = await http.get<TicketListResponse>('/api/support/tickets', { params });
  return response.data;
}

/** Fetch a single ticket by ID (admin only). */
export async function fetchTicket(id: number): Promise<SupportTicket> {
  const response = await http.get<SupportTicket>(`/api/support/tickets/${id}`);
  return response.data;
}

/** Update a ticket's status (admin only). */
export async function updateTicketStatus(
  id: number,
  status: 'open' | 'resolved' | 'closed',
): Promise<SupportTicket> {
  const response = await http.patch<SupportTicket>(`/api/support/tickets/${id}/status`, { status });
  return response.data;
}

/** Returns the URL to stream a ticket attachment (admin only). */
export function getAttachmentUrl(id: number): string {
  const base = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? 'http://localhost:8000';
  return `${base}/api/support/tickets/${id}/attachment`;
}
