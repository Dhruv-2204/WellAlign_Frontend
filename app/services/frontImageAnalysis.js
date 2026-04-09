import { analyzePostureSnapshot } from './postureAnalysis.js';

let poseScriptPromise = null;

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.body.appendChild(script);
  });
}

async function ensurePoseScript() {
  if (!poseScriptPromise) {
    poseScriptPromise = loadScriptOnce('https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js');
  }
  await poseScriptPromise;

  if (typeof window.Pose !== 'function') {
    throw new Error('MediaPipe Pose failed to initialize');
  }
}

function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to decode image file'));
    };
    img.src = objectUrl;
  });
}

async function extractPoseLandmarks(image) {
  await ensurePoseScript();

  const pose = new window.Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  });

  return new Promise((resolve, reject) => {
    let done = false;

    pose.onResults((results) => {
      if (done) return;
      done = true;
      resolve(results?.poseLandmarks || null);
    });

    pose.send({ image }).catch((err) => {
      if (done) return;
      done = true;
      reject(err);
    });
  });
}

function mapSnapshotToPostureClass(snapshot) {
  if (!snapshot) {
    return 'goodposture';
  }

  const metrics = snapshot.detailedMetrics || {};
  const headTiltDetected = Boolean(metrics.headTilt?.detected);
  const shoulderDetected = Boolean(metrics.shoulderAsymmetry?.detected);

  if (!headTiltDetected && !shoulderDetected) {
    return 'goodposture';
  }

  return 'Forwardposture';
}

function getSeverityLabel(percent) {
  if (percent >= 70) return 'severe';
  if (percent >= 40) return 'moderate';
  if (percent > 0) return 'mild';
  return 'none';
}

function buildFrontFindings(snapshot, headTiltPercent, shoulderPercent) {
  const findings = [];
  const metrics = snapshot?.detailedMetrics || {};
  const headTiltAngle = Number(metrics.headTilt?.value || 0);
  const shoulderRaw = Number(metrics.shoulderAsymmetry?.value || 0);

  findings.push(`Head tilt percentage: ${headTiltPercent}% (${getSeverityLabel(headTiltPercent)})`);
  findings.push(`Uneven shoulder percentage: ${shoulderPercent}% (${getSeverityLabel(shoulderPercent)})`);

  if (headTiltPercent === 0 && shoulderPercent === 0) {
    findings.push('Front posture is good. No significant head tilt or shoulder asymmetry detected.');
  } else {
    if (headTiltPercent > 0) {
      findings.push(`Head tilt detected at about ${Math.round(headTiltAngle)} degrees.`);
    }
    if (shoulderPercent > 0) {
      findings.push(`Shoulder asymmetry detected at about ${Math.round(shoulderRaw)}% height difference.`);
    }
  }

  const frontSeverity = Math.round((headTiltPercent + shoulderPercent) / 2);
  findings.push(`Front severity score: ${frontSeverity}%`);
  return Array.from(new Set(findings));
}

/**
 * Analyze uploaded front-view image locally using MediaPipe and posture heuristics.
 */
export async function analyzeFrontImageLocally(file) {
  if (!file) {
    return {
      success: false,
      error: 'validation_error',
      message: 'No front image provided'
    };
  }

  try {
    const image = await fileToImage(file);
    const landmarks = await extractPoseLandmarks(image);

    if (!landmarks || landmarks.length === 0) {
      return {
        success: false,
        error: 'landmarks',
        message: 'Could not detect body landmarks in front image'
      };
    }

    const snapshot = analyzePostureSnapshot(landmarks);
    const metrics = snapshot?.detailedMetrics || {};
    const headTiltPercent = Math.max(0, Math.min(100, Math.round(Number(metrics.headTilt?.severity || 0))));
    const shoulderPercent = Math.max(0, Math.min(100, Math.round(Number(metrics.shoulderAsymmetry?.severity || 0))));

    // Front score is derived from the two front-view issues requested by product logic.
    const weightedSeverity = Math.round((headTiltPercent * 0.55) + (shoulderPercent * 0.45));
    const score = Math.max(0, Math.min(100, 100 - weightedSeverity));
    const confidence = Math.max(50, Math.min(99, score));

    return {
      success: true,
      score,
      class: mapSnapshotToPostureClass(snapshot),
      confidence,
      head_tilt_percentage: headTiltPercent,
      shoulder_asymmetry_percentage: shoulderPercent,
      findings: buildFrontFindings(snapshot, headTiltPercent, shoulderPercent),
      landmarks
    };
  } catch (error) {
    return {
      success: false,
      error: 'front_local_analysis_error',
      message: error?.message || 'Local front analysis failed'
    };
  }
}
