import { getApiBaseUrl } from './api.js';
import { getAuthToken } from './auth.js';
import { analyzeFrontImageLocally } from './frontImageAnalysis.js';

/**
 * Assessment Service
 * Handles sequential posture analysis API calls with per-operation timeouts
 */

const OPERATION_TIMEOUT = 8000; // 8 seconds per operation

/**
 * Helper: Fetch with timeout
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} timeout - Timeout in ms
 * @returns {Promise} Response or timeout error
 */
async function fetchWithTimeout(url, options = {}, timeout = OPERATION_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Operation took too long');
    }
    throw error;
  }
}

/**
 * Helper: Build FormData for file upload
 */
function buildFormData(file) {
  const formData = new FormData();
  formData.append('file', file);
  return formData;
}

/**
 * Helper: Get auth headers for JSON requests
 */
function getHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * Helper: Parse error response and extract landmark/timeout info
 */
function parseErrorResponse(error, defaultImage = null) {
  try {
    const message = error.message || String(error);
    
    if (message.includes('landmarks') || message.includes('landmark')) {
      return {
        type: 'landmark_error',
        image: defaultImage,
        message: 'Could not detect body landmarks in image',
        advice: 'Ensure full body is visible, good lighting, neutral standing pose'
      };
    }

    if (message.includes('timeout') || message.includes('took too long')) {
      return {
        type: 'timeout',
        message: 'Analysis took too long. Please try again.',
        image: defaultImage
      };
    }

    return {
      type: 'error',
      message: message || 'Unknown error occurred',
      image: defaultImage
    };
  } catch (e) {
    return {
      type: 'error',
      message: 'Unknown error occurred',
      image: defaultImage
    };
  }
}

/**
 * Main: Submit images for sequential posture analysis
 * 
 * Sequential Flow:
 * 1. Analyze front image locally (MediaPipe + posture heuristics)
 * 2. If step 1 succeeds, send side image → get side_score, findings
 * 3. If step 1 or 2 succeeds, generate report → get exercises, combined findings
 * 
 * @param {File} frontFile - Front view image
 * @param {File} sideFile - Side view image
 * @param {Function} onPhaseChange - Callback when phase changes (for UI updates)
 * @returns {Promise<{frontResult, sideResult, report, warnings, error, status}>}
 */
export async function submitAssessment(frontFile, sideFile, onPhaseChange = null) {
  const apiBaseUrl = getApiBaseUrl();
  const results = {
    frontResult: null,
    sideResult: null,
    report: null,
    warnings: [],
    error: null,
    status: 'success' // 'success' | 'partial' | 'failed'
  };

  try {
    // ===== PHASE 1: Analyze Front View =====
    if (onPhaseChange) onPhaseChange('analyzing_front');

    try {
      const frontData = await analyzeFrontImageLocally(frontFile);

      if (!frontData?.success) {
        throw new Error(frontData?.message || 'Local front analysis failed');
      }

      results.frontResult = {
        success: true,
        score: frontData.score || 0,
        class: frontData.class || null,
        confidence: frontData.confidence || null,
        findings: frontData.findings || [],
        landmarks: frontData.landmarks || frontData.features || []
      };
    } catch (frontError) {
      const parsedError = parseErrorResponse(frontError, 'front');
      results.frontResult = {
        success: false,
        error: parsedError
      };
      results.warnings.push(`Front analysis failed: ${parsedError.message}`);
    }

    // ===== PHASE 2: Analyze Side View =====
    // Only proceed if we have at least one successful analysis, or we have a side file
    if (onPhaseChange) onPhaseChange('analyzing_side');

    try {
      const sideFormData = buildFormData(sideFile);
      const sideResponse = await fetchWithTimeout(
        `${apiBaseUrl}/assessments/analyze-side`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${getAuthToken()}` },
          body: sideFormData
        },
        OPERATION_TIMEOUT
      );

      const sideData = sideResponse?.data ?? sideResponse;

      results.sideResult = {
        success: true,
        score: sideData.score || 0,
        class: sideData.class || null,
        confidence: sideData.confidence || null,
        findings: sideData.findings || [],
        landmarks: sideData.landmarks || sideData.features || []
      };
    } catch (sideError) {
      const parsedError = parseErrorResponse(sideError, 'side');
      results.sideResult = {
        success: false,
        error: parsedError
      };
      results.warnings.push(`Side analysis failed: ${parsedError.message}`);
    }

    // ===== Determine if we can proceed to report generation =====
    const frontSuccess = results.frontResult?.success;
    const sideSuccess = results.sideResult?.success;

    if (!frontSuccess && !sideSuccess) {
      // Both failed
      results.status = 'failed';
      results.error = {
        type: 'both_failed',
        message: 'Both analyses failed. Please check image quality and try again.',
        advice: 'Ensure images have good lighting, full body visible, and neutral pose'
      };
      return results;
    }

    // Mark as partial if only one succeeded
    if (!frontSuccess || !sideSuccess) {
      results.status = 'partial';
    }

    // ===== PHASE 3: Generate Report =====
    if (onPhaseChange) onPhaseChange('generating_report');

    try {
      const reportPayload = {
        frontResult: frontSuccess ? results.frontResult : null,
        sideResult: sideSuccess ? results.sideResult : null,
        // Compatibility keys in case backend accepts alternate names
        frontAnalysis: frontSuccess ? results.frontResult : null,
        sideAnalysis: sideSuccess ? results.sideResult : null,
        front_success: frontSuccess,
        side_success: sideSuccess
      };

      const reportResponse = await fetchWithTimeout(
        `${apiBaseUrl}/assessments/analysis/report`,
        {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(reportPayload)
        },
        OPERATION_TIMEOUT
      );

      const reportData = reportResponse?.data ?? reportResponse;

      results.report = {
        combined_findings: reportData.combined_findings || [],
        exercises: reportData.exercises || [],
        symptoms: reportData.symptoms || [],
        overall_score: reportData.overall_score || 0,
        recommendations: reportData.recommendations || []
      };

      if (results.status === 'success' || !results.error) {
        results.status = 'success';
      }
    } catch (reportError) {
      const parsedError = parseErrorResponse(reportError);
      results.error = parsedError;
      // If report generation fails but we have at least one analysis, it's still partial
      if (frontSuccess || sideSuccess) {
        results.status = 'partial';
        results.warnings.push('Report generation failed, but analysis data is available');
      } else {
        results.status = 'failed';
      }
    }

    return results;
  } catch (fatalError) {
    // Catch-all for unexpected errors
    results.status = 'failed';
    results.error = {
      type: 'fatal_error',
      message: 'An unexpected error occurred',
      details: fatalError.message
    };
    return results;
  }
}

/**
 * Helper: Check if analysis was successful
 */
export function isAnalysisSuccessful(result) {
  const { frontResult, sideResult, status } = result;
  const frontOk = frontResult?.success;
  const sideOk = sideResult?.success;
  return status === 'success' && (frontOk || sideOk);
}

/**
 * Helper: Get human-readable summary of assessment results
 */
export function getSummary(result) {
  const parts = [];

  if (result.frontResult?.success) {
    parts.push(`Front: ${result.frontResult.score}%`);
  }
  if (result.sideResult?.success) {
    parts.push(`Side: ${result.sideResult.score}%`);
  }
  if (result.report?.overall_score) {
    parts.push(`Overall: ${result.report.overall_score}%`);
  }

  return parts.length > 0 ? parts.join(' • ') : 'No analysis completed';
}
