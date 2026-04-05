import { getApiBaseUrl } from './api.js';
import { getAuthToken } from './auth.js';

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

  try {
    const response = await fetch(
      `${apiBaseUrl}/assessments`,
      {
        method: 'GET',
        headers: getHeaders()
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Fetch failed: ${response.status}`);
    }

    const data = await response.json();
    // Ensure sorted by latest first
    const assessments = Array.isArray(data) ? data : data.assessments || [];
    return assessments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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

  try {
    const payload = {
      timestamp: new Date().toISOString(),
      status: assessmentResult.status || 'unknown',
      front_score: assessmentResult.frontResult?.success ? assessmentResult.frontResult.score : null,
      front_findings: assessmentResult.frontResult?.success ? assessmentResult.frontResult.findings || [] : [],
      side_score: assessmentResult.sideResult?.success ? assessmentResult.sideResult.score : null,
      side_findings: assessmentResult.sideResult?.success ? assessmentResult.sideResult.findings || [] : [],
      overall_score: assessmentResult.report?.overall_score || null,
      combined_findings: assessmentResult.report?.combined_findings || [],
      exercises: assessmentResult.report?.exercises || [],
      symptoms: assessmentResult.report?.symptoms || [],
      recommendations: assessmentResult.report?.recommendations || [],
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
  const timestamp = new Date(assessment.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const mode = assessment.status === 'partial'
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
    status: assessment.status,
    exercises: assessment.exercises || [],
    findings: [
      ...(assessment.front_findings || []),
      ...(assessment.side_findings || []),
      ...(assessment.combined_findings || [])
    ],
    fullData: assessment
  };
}
