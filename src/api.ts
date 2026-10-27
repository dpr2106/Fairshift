import {
  User,
  Organization,
  Shift,
  AttendanceRecord,
  Payslip,
  SafetyReport,
  WorkplaceFeedback,
  FatigueAlert,
  SkillPassportItem
} from '../server/types.js';

const API_BASE = '/api';

class ApiService {
  private currentUserId: string = 'usr-worker-murugan';
  private sessionToken: string | null = null;

  public setUserId(id: string) {
    this.currentUserId = id;
    localStorage.setItem('fairshift_user_id', id);
  }

  public getUserId(): string {
    const saved = localStorage.getItem('fairshift_user_id');
    if (saved) {
      this.currentUserId = saved;
    }
    return this.currentUserId;
  }

  public setToken(token: string) {
    this.sessionToken = token;
    localStorage.setItem('fairshift_token', token);
  }

  public getToken(): string | null {
    if (!this.sessionToken) {
      this.sessionToken = localStorage.getItem('fairshift_token');
    }
    return this.sessionToken;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-id': this.getUserId(),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {})
    };

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      let errorMsg = `API Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.error) errorMsg = errorJson.error;
      } catch (e) {
        // ignore fallback
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // Auth & Personas
  async login(userId: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
    this.setToken(res.token);
    this.setUserId(res.user.id);
    return res;
  }

  async getCurrentUser(): Promise<User> {
    const token = this.getToken();
    if (!token) {
      // Auto-login default persona to acquire verified token
      const loginRes = await this.login(this.getUserId());
      return loginRes.user;
    }
    return this.request<User>('/auth/me');
  }

  async getAllUsers(): Promise<User[]> {
    return this.request<User[]>('/auth/users');
  }

  async getOrganizations(): Promise<Organization[]> {
    return this.request<Organization[]>('/organizations');
  }

  // Shifts
  async getShifts(industry?: string): Promise<Shift[]> {
    const query = industry ? `?industry=${industry}` : '';
    return this.request<Shift[]>(`/shifts${query}`);
  }

  async createShift(shift: Partial<Shift>): Promise<Shift> {
    return this.request<Shift>('/shifts', {
      method: 'POST',
      body: JSON.stringify(shift)
    });
  }

  // Attendance
  async getAttendance(industry?: string, workerId?: string): Promise<AttendanceRecord[]> {
    const params = new URLSearchParams();
    if (industry) params.append('industry', industry);
    if (workerId) params.append('workerId', workerId);
    return this.request<AttendanceRecord[]>(`/attendance?${params.toString()}`);
  }

  async checkIn(shiftId: string, verificationMethod: string = 'qr', qrToken?: string): Promise<AttendanceRecord> {
    return this.request<AttendanceRecord>('/attendance/check-in', {
      method: 'POST',
      body: JSON.stringify({ shiftId, verificationMethod, qrToken })
    });
  }

  async checkOut(attendanceId?: string): Promise<{ record: AttendanceRecord; fatigueAlertTriggered: boolean; fatigueAlert?: FatigueAlert }> {
    return this.request<{ record: AttendanceRecord; fatigueAlertTriggered: boolean; fatigueAlert?: FatigueAlert }>('/attendance/check-out', {
      method: 'POST',
      body: JSON.stringify({ attendanceId })
    });
  }

  async updateAttendanceStatus(id: string, status: 'approved' | 'disputed', reviewNotes?: string): Promise<void> {
    return this.request<void>(`/attendance/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reviewNotes })
    });
  }

  // Payslips
  async getPayslips(industry?: string, workerId?: string): Promise<Payslip[]> {
    const params = new URLSearchParams();
    if (industry) params.append('industry', industry);
    if (workerId) params.append('workerId', workerId);
    return this.request<Payslip[]>(`/payslips?${params.toString()}`);
  }

  async generatePayslip(workerId?: string): Promise<Payslip> {
    return this.request<Payslip>('/payslips/generate', {
      method: 'POST',
      body: JSON.stringify({ workerId })
    });
  }

  // Safety
  async getSafetyReports(industry?: string): Promise<SafetyReport[]> {
    const query = industry ? `?industry=${industry}` : '';
    return this.request<SafetyReport[]>(`/safety${query}`);
  }

  async submitSafetyReport(report: Partial<SafetyReport>): Promise<SafetyReport> {
    return this.request<SafetyReport>('/safety', {
      method: 'POST',
      body: JSON.stringify(report)
    });
  }

  async updateSafetyStatus(id: string, status: string, assignedPerson?: string, resolutionNotes?: string): Promise<void> {
    return this.request<void>(`/safety/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, assignedPerson, resolutionNotes })
    });
  }

  // Feedback
  async getFeedback(industry?: string): Promise<{ metrics: { total: number; concerns: number; positive: number; neutral: number }; items: WorkplaceFeedback[] }> {
    const query = industry ? `?industry=${industry}` : '';
    return this.request<{ metrics: { total: number; concerns: number; positive: number; neutral: number }; items: WorkplaceFeedback[] }>(`/feedback${query}`);
  }

  async submitFeedback(feedback: Partial<WorkplaceFeedback>): Promise<{ message: string; id: string }> {
    return this.request<{ message: string; id: string }>('/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback)
    });
  }

  // Fatigue
  async getFatigueAlerts(industry?: string): Promise<FatigueAlert[]> {
    const query = industry ? `?industry=${industry}` : '';
    return this.request<FatigueAlert[]>(`/fatigue${query}`);
  }

  async reviewFatigueAlert(id: string, reviewNotes: string): Promise<void> {
    return this.request<void>(`/fatigue/${id}/review`, {
      method: 'PATCH',
      body: JSON.stringify({ reviewNotes })
    });
  }

  // Skills
  async getSkills(workerId?: string): Promise<SkillPassportItem[]> {
    const query = workerId ? `?workerId=${workerId}` : '';
    return this.request<SkillPassportItem[]>(`/skills${query}`);
  }

  async addSkill(skill: Partial<SkillPassportItem>): Promise<SkillPassportItem> {
    return this.request<SkillPassportItem>('/skills', {
      method: 'POST',
      body: JSON.stringify(skill)
    });
  }

  async verifySkill(id: string, certificateRef?: string): Promise<void> {
    return this.request<void>(`/skills/${id}/verify`, {
      method: 'PATCH',
      body: JSON.stringify({ certificateRef })
    });
  }

  // Reset
  async resetSystem(): Promise<void> {
    return this.request<void>('/system/reset', { method: 'POST' });
  }
}

export const api = new ApiService();
