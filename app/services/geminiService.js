import { api } from './api.js';

function unwrapData(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  if (response.success && response.data !== undefined) {
    return response.data;
  }

  return response.data !== undefined ? response.data : response;
}

export async function sendGeminiChatMessage(userMessage) {
  const trimmed = String(userMessage || '').trim();
  if (!trimmed) {
    throw new Error('Message is required');
  }

  const payload = await api.post('/chats/send', { userMessage: trimmed });
  const data = unwrapData(payload) || {};

  return {
    id: data._id || null,
    userMessage: data.userMessage || trimmed,
    response: data.geminResponse || data.response || '',
    youtubeVideos: Array.isArray(data.youtubeVideos) ? data.youtubeVideos : [],
    source: data.source || 'unknown',
    videoPolicy: data.videoPolicy || null,
    createdAt: data.createdAt || new Date().toISOString()
  };
}

export async function fetchGeminiChatHistory({ limit = 20, skip = 0 } = {}) {
  const payload = await api.get(`/chats/history?limit=${encodeURIComponent(limit)}&skip=${encodeURIComponent(skip)}`);
  const rows = unwrapData(payload);

  return Array.isArray(rows)
    ? rows.map((item) => ({
        id: item._id || null,
        userMessage: item.userMessage || '',
        response: item.geminResponse || item.response || '',
        createdAt: item.createdAt || null
      }))
    : [];
}

export async function deleteGeminiChatMessage(chatId) {
  if (!chatId) {
    throw new Error('chatId is required');
  }

  return api.del(`/chats/${encodeURIComponent(chatId)}`);
}

export async function analyzeAssessmentWithGemini(assessmentId) {
  if (!assessmentId) {
    throw new Error('assessmentId is required');
  }

  const payload = await api.post(`/analysis/assessment/${encodeURIComponent(assessmentId)}`, {});
  const data = unwrapData(payload) || {};

  return {
    analysis: data.gemini_analysis || '',
    confirmedScore: Number.isFinite(Number(data.gemini_confirmed_score))
      ? Number(data.gemini_confirmed_score)
      : null,
    youtubeSearches: Array.isArray(data.youtube_searches) ? data.youtube_searches : []
  };
}

export async function analyzeMonitoringSessionWithGemini(sessionId) {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const payload = await api.post(`/analysis/session/${encodeURIComponent(sessionId)}`, {});
  const data = unwrapData(payload) || {};

  return {
    analysis: data.gemini_analysis || '',
    confirmedScore: Number.isFinite(Number(data.gemini_confirmed_score))
      ? Number(data.gemini_confirmed_score)
      : null,
    recommendedExercises: Array.isArray(data.recommended_exercises) ? data.recommended_exercises : [],
    youtubeSearches: Array.isArray(data.youtube_searches) ? data.youtube_searches : []
  };
}
