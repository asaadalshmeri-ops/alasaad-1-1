// Client API wrapper with JWT support and real-time SSE listener
const API_URL = ''; // Relative to the window origin since Vite proxies it or they run on same port

export function getAuthToken(): string | null {
  return localStorage.getItem('lms_token');
}

export function setAuthToken(token: string) {
  localStorage.setItem('lms_token', token);
}

export function getSavedUser() {
  const user = localStorage.getItem('lms_user');
  return user ? JSON.parse(user) : null;
}

export function setSavedUser(user: any) {
  localStorage.setItem('lms_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('lms_token');
  localStorage.removeItem('lms_user');
}

export async function apiRequest(endpoint: string, method = 'GET', body?: any) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options: RequestInit = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${endpoint}`, options);

  if (!res.ok) {
    if ((res.status === 401 || res.status === 403) && getAuthToken()) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
  }

  return res.json();
}

// SSE Connection Manager for Real-time Dashboard Sync
export function subscribeToEvents(onEvent: (event: any) => void): () => void {
  const eventSource = new EventSource(`${API_URL}/api/events`);

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onEvent(parsed);
    } catch (e) {
      console.error('Error parsing SSE event data:', e);
    }
  };

  eventSource.onerror = (err) => {
    console.warn('SSE connection state change:', err);
  };

  return () => {
    eventSource.close();
  };
}
