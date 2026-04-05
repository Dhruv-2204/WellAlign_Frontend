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
  if (!snapshot || snapshot.classification === 'GOOD') {
    return 'goodposture';
  }

  const issues = snapshot.issues || [];
  const hasSlouching = issues.some((issue) => issue.type === 'SLOUCHING');
  if (hasSlouching) {
    return 'Slumpsitting';
  }

  return 'Forwardposture';
}

function buildFrontFindings(snapshot) {
  const findings = [];
  const issues = snapshot?.issues || [];

  if (issues.length === 0) {
    findings.push('Front view appears well-aligned');
    findings.push('Shoulder and head symmetry look stable');
  } else {
    issues.forEach((issue) => {
      if (issue.type === 'FORWARD_HEAD') {
        findings.push('Forward head tendency detected from front view');
      }
      if (issue.type === 'HEAD_TILT' || issue.type === 'VERTICAL_TILT') {
        findings.push('Head tilt or neck alignment issue detected');
      }
      if (issue.type === 'SHOULDER_ASYMMETRY') {
        findings.push('Shoulder asymmetry detected');
      }
      if (issue.type === 'SLOUCHING') {
        findings.push('Upper trunk slouching tendency detected');
      }
    });
  }

  findings.push(`Front-view severity score: ${Math.round(snapshot?.overallSeverity || 0)}%`);
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
    const score = Math.max(0, Math.min(100, Math.round(100 - (snapshot.overallSeverity || 0))));
    const confidence = Math.max(50, Math.min(99, Math.round(100 - (snapshot.overallSeverity || 0))));

    return {
      success: true,
      score,
      class: mapSnapshotToPostureClass(snapshot),
      confidence,
      findings: buildFrontFindings(snapshot),
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
