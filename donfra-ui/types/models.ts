/**
 * Shared data models across the application
 * Centralized type definitions to avoid duplication
 */

/**
 * User represents an authenticated user in the system
 */
export interface User {
  id: number;
  email: string;
  username: string;
  role: 'user' | 'vip' | 'admin' | 'god';
  isActive: boolean;
  createdAt: string;
  canStealth?: boolean; // Admin stealth mode capability
}

/**
 * InterviewRoom represents a collaborative interview coding room
 */
export interface InterviewRoom {
  id: number;
  room_id: string;
  owner_id: number;
  headcount: number;
  code_snapshot: string;
  invite_link: string;
  created_at: string;
  updated_at: string;
}
