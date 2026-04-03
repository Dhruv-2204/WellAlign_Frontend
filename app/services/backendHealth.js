// Small helper used by views to display backend availability without failing the UI.
import { api } from './api.js';

export async function checkBackendHealth(options = {}) {
  const {
    endpoint = '/health',
    successMessage = 'Backend connected',
    unavailableMessage = 'Backend unavailable',
    countSuffix = 'records',
    withCount = false
  } = options;

  try {
    const payload = endpoint === '/health' ? await api.health.ping() : await api.get(endpoint);
    if (withCount && Array.isArray(payload)) {
      return `${successMessage} (${payload.length} ${countSuffix})`;
    }
    return successMessage;
  } catch (error) {
    return unavailableMessage;
  }
}
