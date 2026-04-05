import { getApiBaseUrl } from './api.js';
import { getAuthToken, useAuth } from './auth.js';

/**
 * Assessment History Service
 * Handles saving and fetching posture assessments from backend
 */

function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Fetch assessment history for current user
 * @returns {Promise<Array>} List of past assessments sorted by latest first
 */
export async function fetchAssessmentHistory() {
  const apiBaseUrl = getApiBaseUrl();
  const token = getAuthToken();
  const auth = useAuth();
  const currentUserId = auth?.user?.id ? String(auth.user.id) : null;

  if (!token) {
    return [];
  }

  try {
    const response = await fetch(
      `${apiBaseUrl}/assessments`,
      {
        method: 'GET',
        headers: getHeaders(),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Fetch failed: ${response.status}`);
    }

    const data = await response.json();

    // Backend wraps payload as { success, data }, while some environments may return raw arrays.
    const assessments = Array.isArray(data)
      ? data
      : (Array.isArray(data?.data)
          ? data.data
          : (Array.isArray(data?.assessments) ? data.assessments : []));

    // Defense in depth: only keep records for the current signed-in user.
    const scoped = currentUserId
      ? assessments.filter((item) => String(item.userId || '') === currentUserId)
      : assessments;

    // Ensure sorted by latest first. Prefer createdAt from DB, fallback to timestamp.
    return scoped.sort((a, b) => {
      const aDate = new Date(a.createdAt || a.timestamp || 0).getTime();
      const bDate = new Date(b.createdAt || b.timestamp || 0).getTime();
      return bDate - aDate;
    });
  } catch (error) {
    console.error('Failed to fetch assessment history:', error);
    return []; // Return empty array on error
  }
}

/**
 * Save a new assessment to backend
 * @param {Object} assessmentResult - Result object from submitAssessment API
 * @returns {Promise<Object>} Saved assessment record with ID
 */
export async function saveAssessment(assessmentResult) {
  const apiBaseUrl = getApiBaseUrl();
  const token = getAuthToken();

  if (!token) {
    throw new Error('Not authenticated');
  }

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      status: assessmentResult.status || 'unknown',
      // Send as nested objects, not flat fields!
      frontResult: assessmentResult.frontResult ? {
        success: assessmentResult.frontResult.success,
        score: assessmentResult.frontResult.score,
        findings: assessmentResult.frontResult.findings || [],
        class: assessmentResult.frontResult.class
      } : null,
      sideResult: assessmentResult.sideResult ? {
        success: assessmentResult.sideResult.success,
        score: assessmentResult.sideResult.score,
        findings: assessmentResult.sideResult.findings || [],
        class: assessmentResult.sideResult.class
      } : null,
      report: assessmentResult.report ? {
        overall_score: assessmentResult.report.overall_score,
        combined_findings: assessmentResult.report.combined_findings || [],
        exercises: assessmentResult.report.exercises || [],
        symptoms: assessmentResult.report.symptoms || [],
        recommendations: assessmentResult.report.recommendations || []
      } : null,
      error_message: assessmentResult.error?.message || null,
      warnings: assessmentResult.warnings || []
    };


    const response = await fetch(
      `${apiBaseUrl}/assessments`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Save failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to save assessment:', error);
    throw error;
  }
}

/**
 * Helper: Format assessment for history display
 */
export function formatAssessmentForHistory(assessment) {
  const sourceTime = assessment.createdAt || assessment.timestamp;
  const timestamp = sourceTime
    ? new Date(sourceTime).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    : 'Unknown date';

  const normalizedStatus = String(assessment.status || 'unknown').toLowerCase();

  const mode = normalizedStatus === 'partial'
    ? (assessment.front_score ? 'Front Only' : assessment.side_score ? 'Side Only' : 'Unknown')
    : assessment.front_score && assessment.side_score
    ? 'Front + Side'
    : 'Unknown';

  return {
    id: assessment._id || assessment.id,
    timestamp,
    mode,
    frontScore: assessment.front_score,
    sideScore: assessment.side_score,
    overallScore: assessment.overall_score,
    status: normalizedStatus,
    exercises: assessment.exercises || [],
    findings: [
      ...(assessment.front_findings || []),
      ...(assessment.side_findings || []),
      ...(assessment.combined_findings || [])
    ],
    fullData: assessment
  };
}
