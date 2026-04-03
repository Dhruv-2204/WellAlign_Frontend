/**
 * Posture Advice Engine
 * Generates personalized advice and recommendations based on detected posture issues
 * Provides pre-written advice library, severity analysis, and actionable guidance
 */

// --------- Advice Library ----------

const ADVICE_LIBRARY = {
  FORWARD_HEAD: {
    title: 'Forward Head Posture',
    shortDescription: 'Head positioned in front of shoulders',
    fullDescription: 'Your head is positioned forward of your shoulders, creating extra strain on your neck and upper back. This is one of the most common posture issues in desk workers and can lead to chronic neck pain and tension headaches.',
    
    severity: {
      low: { threshold: 15, label: 'Minimal', color: 'green' },
      medium: { threshold: 35, label: 'Moderate', color: 'yellow' },
      high: { threshold: 100, label: 'Severe', color: 'red' }
    },
    
    healthImpact: [
      'Increased strain on neck muscles (up to 10x body weight per forward inch)',
      'Tension headaches and migraines',
      'Reduced lung capacity',
      'Digestive issues',
      'Chronic neck and shoulder pain'
    ],
    
    immediateActions: [
      'Adjust your monitor so the top is at eye level',
      'Position keyboard and mouse at elbow height',
      'Take a 5-minute posture reset break every hour',
      'Gently retract your chin to create a "double chin" position',
      'Relax shoulders down and back'
    ],
    
    dailyExercises: [
      {
        name: 'Chin Tucks',
        reps: '10-15 reps, 3 sets daily',
        description: 'Looking straight ahead, gently draw your chin straight back without tilting. Hold for 2 seconds.',
        frequency: '3 times daily'
      },
      {
        name: 'Neck Flexor Stretch',
        reps: '30 seconds per side, 2 sets',
        description: 'Gently tilt your head back, then turn slightly. Apply gentle pressure with hand. Feel stretch in front of neck.',
        frequency: 'Twice daily'
      },
      {
        name: 'Posture Reset',
        reps: '10 reps, 2 sets',
        description: 'Roll shoulders backward 5 times, then forward 5 times. Focus on proper alignment.',
        frequency: '2-3 times daily'
      }
    ],
    
    exerciseLinks: [
      { title: 'Complete Chin Tuck Tutorial', url: 'https://www.youtube.com/results?search_query=chin+tucks+posture' },
      { title: 'Forward Head Posture Fix (10 min)', url: 'https://www.youtube.com/results?search_query=forward+head+posture+exercises' },
      { title: 'Neck Strengthening Routine', url: 'https://www.youtube.com/results?search_query=neck+strengthening+exercises' }
    ],
    
    workstationSetup: [
      'Monitor top at or slightly below eye level, 20-26 inches away',
      'Keyboard and mouse at elbow height when arms are at 90 degrees',
      'Chair back supporting your lower back curve',
      'Feet flat on floor or footrest',
      'Document holder at arm\'s length for reference material'
    ],
    
    advice: [
      'Invest in an adjustable monitor stand to achieve proper eye level',
      'Use a document holder at arm\'s length to avoid looking down',
      'Take frequent breaks to reset your posture - every 30-60 minutes',
      'Strengthen your deep neck flexors with consistent exercise',
      'Consider a posture corrector for awareness during work',
      'Practice the "wall posture reset" - stand against a wall with shoulders, head, and glutes touching'
    ]
  },

  SLOUCHING: {
    title: 'Slouching / Poor Spine Alignment',
    shortDescription: 'Chest and spine are curved forward',
    fullDescription: 'Your upper back and spine are excessively rounded, putting pressure on your discs and ligaments. Slouching reduces lung capacity and can contribute to poor digestion and low energy.',
    
    severity: {
      low: { threshold: 15, label: 'Minimal', color: 'green' },
      medium: { threshold: 35, label: 'Moderate', color: 'yellow' },
      high: { threshold: 100, label: 'Severe', color: 'red' }
    },
    
    healthImpact: [
      'Intervertebral disc compression and potential hernia',
      'Rounded shoulders and kyphosis development',
      'Reduced lung capacity (up to 30% reduction)',
      'Poor circulation and oxygen delivery',
      'Digestive problems and acid reflux',
      'Low energy and mood issues'
    ],
    
    immediateActions: [
      'Sit up tall with your chest open',
      'Engage your core muscles lightly',
      'Slide your shoulder blades down and back',
      'Imagine a string pulling the top of your head toward the ceiling',
      'Maintain neutral spine - there should be a slight curve in your lower back'
    ],
    
    dailyExercises: [
      {
        name: 'Core Engagement Hold',
        reps: '20-30 seconds, 3 sets',
        description: 'Pull in your lower abdominals without holding your breath. This stabilizes your spine.',
        frequency: '2-3 times daily'
      },
      {
        name: 'Cat-Cow Stretch',
        reps: '10 reps each, 2 sets',
        description: 'On hands and knees: arch back (cow), then round spine (cat). Move slowly and controlled.',
        frequency: 'Daily'
      },
      {
        name: 'Prone Back Extension',
        reps: '15 reps, 2 sets',
        description: 'Lying face down, use hands to gently lift your chest off the ground, engaging back muscles.',
        frequency: 'Daily'
      },
      {
        name: 'Wall Posture Slides',
        reps: '12 reps, 2 sets',
        description: 'Stand against wall. Slide arms up and down while maintaining contact with wall.',
        frequency: '2-3 times daily'
      }
    ],
    
    exerciseLinks: [
      { title: 'Core Stabilization Routine (15 min)', url: 'https://www.youtube.com/results?search_query=core+stabilization+exercises' },
      { title: 'Back Strengthening for Slouching', url: 'https://www.youtube.com/results?search_query=slouching+posture+back+exercises' },
      { title: 'Mobility and Flexibility for Spine', url: 'https://www.youtube.com/results?search_query=spine+mobility+stretches' }
    ],
    
    workstationSetup: [
      'Chair with lumbar support to maintain natural spine curve',
      'Avoid deep sitting - sit about 80% back in chair for proper weight distribution',
      'Armrests at elbow height to reduce shoulder strain',
      'Desk height such that elbows are at 90-100 degrees',
      'Monitor directly in front, not off to the side'
    ],
    
    advice: [
      'Strengthen your core muscles - they are essential for proper posture',
      'Use a lumbar roll or support pillow to maintain lower back curve',
      'Set hourly reminders to check and reset your posture',
      'Stretch your chest and front shoulders regularly',
      'Consider yoga or pilates for core strength and body awareness',
      'Sleep on a supportive mattress with a pillow that keeps spine aligned',
      'Avoid prolonged sitting - stand and walk for 2-3 minutes every 30 minutes'
    ]
  },

  SHOULDER_ASYMMETRY: {
    title: 'Uneven Shoulders',
    shortDescription: 'One shoulder is higher than the other',
    fullDescription: 'Your shoulders are not level - one is raised higher than the other. This indicates muscular tension imbalance and can lead to uneven spinal stress, scoliosis risk, and chronic shoulder/neck pain.',
    
    severity: {
      low: { threshold: 10, label: 'Minimal', color: 'green' },
      medium: { threshold: 25, label: 'Moderate', color: 'yellow' },
      high: { threshold: 100, label: 'Severe', color: 'red' }
    },
    
    healthImpact: [
      'Muscle tension and trigger points',
      'Potential scoliotic curve development',
      'Chronic shoulder and neck pain',
      'Reduced mobility and flexibility',
      'Uneven spinal stress and disc strain',
      'Upper crossed syndrome'
    ],
    
    immediateActions: [
      'Roll your shoulders up toward your ears and down firmly',
      'Use your hands to check if shoulders are level',
      'Actively pull the higher shoulder down and relax',
      'Distribute weight evenly if standing',
      'Check your workstation for asymmetrical setup'
    ],
    
    dailyExercises: [
      {
        name: 'Shoulder Level Check & Reset',
        reps: '10 reps, 3-4 times daily',
        description: 'Drop the high shoulder consciously, then relax both. Repeat to build awareness.',
        frequency: '3-4 times daily'
      },
      {
        name: 'Shoulder Blade Squeeze',
        reps: '15 reps, 2 sets',
        description: 'Pull shoulder blades down and together. Hold for 2 seconds. Release slowly.',
        frequency: 'Daily'
      },
      {
        name: 'Cross-Body Shoulder Stretch',
        reps: '30 seconds each side, 2 sets',
        description: 'Bring one arm across body and gently pull. Feel stretch in shoulder and back.',
        frequency: 'Daily'
      },
      {
        name: 'Relaxation Breathing',
        reps: '5 minutes',
        description: 'Slow, deep breathing while consciously relaxing shoulders. Releases tension.',
        frequency: '2 times daily'
      }
    ],
    
    exerciseLinks: [
      { title: 'Shoulder Alignment Exercises', url: 'https://www.youtube.com/results?search_query=uneven+shoulders+exercises' },
      { title: 'Upper Crossed Syndrome Fix', url: 'https://www.youtube.com/results?search_query=upper+crossed+syndrome+exercises' },
      { title: 'Shoulder Tension Release', url: 'https://www.youtube.com/results?search_query=shoulder+tension+relief' }
    ],
    
    workstationSetup: [
      'Check that desk and monitor are directly in front (not angled)',
      'Mouse and keyboard centered, not off to one side',
      'Don\'t hold phone between shoulder and ear - use speakerphone or headset',
      'Avoid resting forearm on desk edge while typing',
      'Chair height allows elbows to be at proper height on both sides equally'
    ],
    
    advice: [
      'Check your posture setup - asymmetrical workstations cause this issue',
      'Rotate between both sides when working with a mouse',
      'Use a headset instead of holding phone to your ear',
      'Massage tight areas or use a massage gun on tense muscle',
      'Practice yoga with emphasis on shoulder opening poses',
      'Consider seeing a physical therapist if severe or persistent',
      'Use a standing desk periodically to change positioning',
      'Apply heat to tight shoulder before stretching'
    ]
  },

  HEAD_TILT: {
    title: 'Head Tilt',
    shortDescription: 'Head is tilted to one side',
    fullDescription: 'Your head is consistently tilted to one side, indicating neck muscle imbalance and uneven spine stress. This can develop into a habit that causes chronic neck pain and asymmetrical muscle development.',
    
    severity: {
      low: { threshold: 10, label: 'Minimal', color: 'green' },
      medium: { threshold: 20, label: 'Moderate', color: 'yellow' },
      high: { threshold: 100, label: 'Severe', color: 'red' }
    },
    
    healthImpact: [
      'Uneven neck muscle development',
      'Chronic neck pain and stiffness',
      'Temporomandibular joint (TMJ) issues',
      'Headaches and migraines',
      'Unequal spine stress',
      'Vision and balance problems'
    ],
    
    immediateActions: [
      'Check head position using a mirror or reflection',
      'Actively level your head - ears should align with shoulders',
      'Gently resist the tilt from the tilted side to build awareness',
      'Check if one ear is forward - adjust if needed',
      'Consider what\'s causing the tilt (monitor position, habit, eye dominance)'
    ],
    
    dailyExercises: [
      {
        name: 'Head Alignment Drill',
        reps: '10 reps, 3 times daily',
        description: 'Gently tilt head one direction, then consciously level it. Repeat opposite direction.',
        frequency: '3 times daily'
      },
      {
        name: 'Neck Isometric Hold',
        reps: '10 seconds each direction, 2 sets',
        description: 'Place hand on one side of head. Resist without moving. Strengthens neck laterally.',
        frequency: 'Daily'
      },
      {
        name: 'Lateral Neck Stretch',
        reps: '30 seconds each side, 2 sets',
        description: 'Tilt ear toward shoulder gently. Feel stretch on opposite side of neck.',
        frequency: 'Daily'
      }
    ],
    
    exerciseLinks: [
      { title: 'Neck Tilt Correction Exercises', url: 'https://www.youtube.com/results?search_query=head+tilt+correction+exercises' },
      { title: 'Neck Alignment Workout', url: 'https://www.youtube.com/results?search_query=neck+alignment+exercises' },
      { title: 'TMJ and Neck Tension Relief', url: 'https://www.youtube.com/results?search_query=tmj+neck+exercises' }
    ],
    
    workstationSetup: [
      'Monitor directly in front at eye level - not off to one side',
      'Ensure good eye focus on monitor - vision shouldn\'t pull head to one side',
      'Check for lighting glare that might cause you to tilt toward better view',
      'Position reference materials straight ahead, not to one side',
      'Use proper desk setup to avoid reaching to one side'
    ],
    
    advice: [
      'Check your monitor position - if it\'s off to one side, your head will follow',
      'If you wear glasses, check that your prescription is up to date',
      'Practice frequent awareness checks in a mirror',
      'Strengthen the weaker side of neck muscles',
      'Consider a mirror ball or sticky note reminder on your monitor',
      'Perform neck stretches throughout the day',
      'If vision issues are causing the tilt, see an eye doctor'
    ]
  },

  VERTICAL_TILT: {
    title: 'Vertical Head Tilt',
    shortDescription: 'Chin is pointing too far up or down',
    fullDescription: 'Your chin is excessively elevated or depressed, indicating improper screen viewing angle or habitual forward head posture. This strains the neck and reduces proper breathing.',
    
    severity: {
      low: { threshold: 12, label: 'Minimal', color: 'green' },
      medium: { threshold: 30, label: 'Moderate', color: 'yellow' },
      high: { threshold: 100, label: 'Severe', color: 'red' }
    },
    
    healthImpact: [
      'Excessive neck extension or flexion strain',
      'Reduced breathing capacity',
      'Neck and upper back pain',
      'Vision and focusing problems',
      'Tension in neck and jaw'
    ],
    
    immediateActions: [
      'Look straight ahead with eyes parallel to ground',
      'Adjust monitor height if you\'re looking down or up',
      'Relax jaw and neck muscles',
      'Take eyes on a slow sweep (up-down-left-right) to reset',
      'Blink and focus on distant object to reset eye strain'
    ],
    
    dailyExercises: [
      {
        name: 'Eye Level Gaze',
        reps: '10 times, 3 sets daily',
        description: 'Look straight ahead maintaining horizontal gaze. Focus on distant point.',
        frequency: '3 times daily'
      },
      {
        name: 'Neck Flexion/Extension Stretch',
        reps: '5 reps each direction, 2 sets',
        description: 'Gently drop chin toward chest (5 sec), then gently look up (5 sec).',
        frequency: 'Daily'
      },
      {
        name: '20-20-20 Vision Break',
        reps: 'Every 20 minutes for 20 seconds',
        description: 'Every 20 min, look at something 20 feet away for 20 seconds.',
        frequency: 'Every 20 minutes'
      }
    ],
    
    exerciseLinks: [
      { title: 'Proper Screen Viewing Posture', url: 'https://www.youtube.com/results?search_query=screen+viewing+angle+posture' },
      { title: 'Neck Vertical Alignment Exercises', url: 'https://www.youtube.com/results?search_query=neck+vertical+alignment+exercises' },
      { title: 'Digital Eye Strain Relief', url: 'https://www.youtube.com/results?search_query=eye+strain+relief+exercises' }
    ],
    
    workstationSetup: [
      'Monitor top at or slightly below eye level (15-20 degrees downward gaze)',
      'Avoid looking up at screen - promotes neck extension',
      'Avoid looking down at screen - promotes slouching',
      'Increase font size if you\'re straining to read',
      'Ensure proper lighting to reduce eye strain',
      'Use blue light filter or monitor with reduced blue light'
    ],
    
    advice: [
      'Adjust monitor height so you naturally look slightly downward (15-20 degrees)',
      'Move monitor closer if text is too small - don\'t tilt head back',
      'Use the 20-20-20 rule: Every 20 minutes, look 20 feet away for 20 seconds',
      'Consider screen position relative to eye height',
      'Reduce display brightness in dim environments',
      'Use anti-fatigue monitor glasses if you spend long hours at screen',
      'Take frequent breaks to refocus eyes on distant objects'
    ]
  }
};

// --------- Report Generation ----------

/**
 * Generate comprehensive posture report from session data
 * @param {Object} session - Session object from postureHistory
 * @returns {Object} Detailed report with advice and recommendations
 */
export function generateDetailedReport(session) {
  if (!session || !session.snapshots || session.snapshots.length === 0) {
    console.warn('generateDetailedReport: No snapshots recorded. Session may have been too short.');
    return {
      error: 'Insufficient session data',
      status: 'INSUFFICIENT_DATA',
      postureTimeDistribution: { GOOD: 50, WARNING: 30, POOR: 15, CRITICAL: 5 },
      detailedIssues: [],
      overallScore: 0,
      actionPlan: { priority: [], immediate: ['Ensure camera is visible'], shortTerm: ['Try longer session'], longTerm: [] }
    };
  }

  // Calculate posture time distribution
  const postureTimeDistribution = calculatePostureTimeDistribution(session);

  // Analyze detected issues
  const issueAnalysis = analyzeDetectedIssues(session);
  const detailedIssues = buildDetailedIssues(issueAnalysis, session.duration || 0);

  // Sort issues by severity
  const severityRanking = rankIssuesBySeverity(issueAnalysis);

  // Generate personalized advice
  const personalizedAdvice = generatePersonalizedAdvice(issueAnalysis);

  // Calculate health risk assessment
  const healthRiskAssessment = assessHealthRisk(issueAnalysis);

  // Generate action plan
  const actionPlan = generateActionPlan(issueAnalysis);

  return {
    status: 'SUCCESS',
    sessionId: session.id,
    sessionDate: new Date(session.startTime).toLocaleString(),
    duration: formatDuration(session.duration),
    durationSeconds: session.duration,
    
    // Time distribution
    postureTimeDistribution,
    
    // Issue analysis with severity
    detailedIssues,
    detectedIssues: issueAnalysis,
    severityRanking,
    
    // Personalized guidance
    personalizedAdvice,
    healthRiskAssessment: healthRiskAssessment.assessment,
    healthRiskDetails: healthRiskAssessment,
    actionPlan,
    
    // Summary
    overallScore: calculateOverallScore(postureTimeDistribution),
    recommendationSummary: generateRecommendationSummary(issueAnalysis),
    
    // Generated timestamp
    generatedAt: new Date().toISOString()
  };
}

// --------- Analysis Functions ----------

/**
 * Calculate time spent in each posture classification
 */
function calculatePostureTimeDistribution(session) {
  const distribution = {
    GOOD: 0,
    WARNING: 0,
    POOR: 0,
    CRITICAL: 0,
    UNKNOWN: 0
  };

  session.snapshots.forEach((snapshot) => {
    const classification = snapshot.postures.classification || 'UNKNOWN';
    if (distribution.hasOwnProperty(classification)) {
      distribution[classification]++;
    } else {
      distribution['UNKNOWN']++;
    }
  });

  // Calculate percentages
  const total = session.snapshots.length || 1;
  const result = {
    GOOD: total > 0 ? Math.round((distribution.GOOD / total) * 100) : 0,
    WARNING: total > 0 ? Math.round((distribution.WARNING / total) * 100) : 0,
    POOR: total > 0 ? Math.round((distribution.POOR / total) * 100) : 0,
    CRITICAL: total > 0 ? Math.round((distribution.CRITICAL / total) * 100) : 0
  };

  return result;
}

/**
 * Analyze detected issues from session
 */
function analyzeDetectedIssues(session) {
  const issues = {};

  // Count issue occurrences
  session.snapshots.forEach((snapshot) => {
    snapshot.postures.issues.forEach((issue) => {
      if (!issues[issue.type]) {
        issues[issue.type] = {
          type: issue.type,
          count: 0,
          totalSeverity: 0,
          avgSeverity: 0
        };
      }
      issues[issue.type].count++;
      issues[issue.type].totalSeverity += issue.severity || 0;
    });
  });

  // Calculate severity averages and percentages
  const total = session.snapshots.length;
  Object.keys(issues).forEach((key) => {
    const issue = issues[key];
    issue.avgSeverity = Math.round(issue.totalSeverity / issue.count);
    issue.percentage = total > 0 ? Math.round((issue.count / total) * 100) : 0;
    
    // Get advice from library
    const advice = ADVICE_LIBRARY[key];
    if (advice) {
      issue.title = advice.title;
      issue.description = advice.fullDescription;
      issue.severity = determineSeverityLevel(issue.percentage, advice.severity);
      issue.healthImpact = advice.healthImpact;
      issue.immediateActions = advice.immediateActions;
      issue.advice = advice.advice;
      issue.dailyExercises = advice.dailyExercises;
      issue.workstationSetup = advice.workstationSetup;
      issue.exerciseLinks = advice.exerciseLinks;
    }
  });

  return issues;
}

/**
 * Determine severity level based on percentage
 */
function determineSeverityLevel(percentage, severityThresholds) {
  return {
    percentage,
    level: percentage >= severityThresholds.high.threshold ? 
      severityThresholds.high.label :
      percentage >= severityThresholds.medium.threshold ?
      severityThresholds.medium.label :
      severityThresholds.low.label,
    color: percentage >= severityThresholds.high.threshold ?
      severityThresholds.high.color :
      percentage >= severityThresholds.medium.threshold ?
      severityThresholds.medium.color :
      severityThresholds.low.color
  };
}

/**
 * Rank issues by severity
 */
function rankIssuesBySeverity(issueAnalysis) {
  const issues = Object.values(issueAnalysis);
  
  return issues
    .sort((a, b) => {
      // Sort by percentage (descending)
      if (b.percentage !== a.percentage) {
        return b.percentage - a.percentage;
      }
      // Then by average severity (descending)
      return b.avgSeverity - a.avgSeverity;
    })
    .map((issue, index) => ({
      rank: index + 1,
      type: issue.type,
      title: issue.title,
      severity: issue.severity,
      percentage: issue.percentage,
      avgSeverity: issue.avgSeverity
    }));
}

/**
 * Generate personalized advice based on issues
 */
function generatePersonalizedAdvice(issueAnalysis) {
  const advice = [];

  Object.values(issueAnalysis)
    .sort((a, b) => b.percentage - a.percentage)
    .forEach((issue) => {
      if (issue.advice) {
        advice.push({
          issue: issue.title,
          priority: issue.severity.level === 'Severe' ? 'HIGH' : 
                   issue.severity.level === 'Moderate' ? 'MEDIUM' : 'LOW',
          tips: issue.advice,
          exercises: issue.dailyExercises,
          workstationTips: issue.workstationSetup,
          exerciseResources: issue.exerciseLinks
        });
      }
    });

  return advice;
}

/**
 * Assess overall health risk
 */
function assessHealthRisk(issueAnalysis) {
  let riskLevel = 'LOW';
  let criticalIssues = [];
  let healthConcerns = [];

  Object.values(issueAnalysis).forEach((issue) => {
    if (issue.severity && issue.percentage >= 35) {
      if (riskLevel === 'LOW') riskLevel = 'MEDIUM';
      criticalIssues.push(issue.title);
    }
    if (issue.severity && issue.percentage >= 50) {
      riskLevel = 'HIGH';
    }
    healthConcerns = healthConcerns.concat(issue.healthImpact || []);
  });

  return {
    riskLevel,
    assessment: riskLevel === 'HIGH' ? 'Significant posture issues detected. Corrective action recommended.' :
                riskLevel === 'MEDIUM' ? 'Some posture concerns. Consider implementing recommended exercises.' :
                'Overall good posture. Continue monitoring.',
    criticalIssues,
    potentialHealthConcerns: [...new Set(healthConcerns)] // Remove duplicates
  };
}

/**
 * Generate actionable action plan
 */
function generateActionPlan(issueAnalysis) {
  const plan = {
    immediate: [
      'Review and adjust your workstation setup',
      'Take frequent posture breaks every 30 minutes',
      'Perform initial stretches based on detected issues'
    ],
    shortTerm: [
      'Start daily exercise routine (1-2 weeks)',
      'Monitor posture improvement with daily session',
      'Implement workstation modifications'
    ],
    longTerm: [
      'Build consistent exercise habit (4+ weeks)',
      'Develop posture awareness',
      'Maintain proper ergonomic setup',
      'Schedule periodic posture assessments'
    ],
    priority: []
  };

  // Add priority actions based on issues
  Object.values(issueAnalysis)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 3) // Top 3 issues
    .forEach((issue) => {
      if (issue.dailyExercises && issue.dailyExercises.length > 0) {
        plan.priority.push({
          issue: issue.title,
          action: `Start with "${issue.dailyExercises[0].name}"`,
          frequency: issue.dailyExercises[0].frequency,
          details: issue.dailyExercises[0].description
        });
      }
    });

  return plan;
}

/**
 * Calculate overall posture score
 */
function calculateOverallScore(postureTimeDistribution) {
  let score = 100;

  // Deduct points based on bad posture time
  score -= (postureTimeDistribution.CRITICAL || 0) * 2;
  score -= (postureTimeDistribution.POOR || 0) * 1;
  score -= (postureTimeDistribution.WARNING || 0) * 0.5;

  return Math.max(0, Math.round(score));
}

/**
 * Convert issue analysis map into UI-friendly issue cards.
 */
function buildDetailedIssues(issueAnalysis, sessionDurationSeconds) {
  return Object.values(issueAnalysis)
    .sort((a, b) => b.percentage - a.percentage)
    .map((issue) => {
      const durationMinutes = ((sessionDurationSeconds * issue.percentage) / 100) / 60;
      return {
        type: issue.type,
        title: issue.title,
        description: issue.description,
        severity: issue.avgSeverity,
        percentage: issue.percentage,
        durationMinutes: `${durationMinutes.toFixed(1)} min`,
        healthRisk: (issue.healthImpact || []).slice(0, 2).join(' '),
        immediateActions: issue.immediateActions || [],
        dailyExercises: issue.dailyExercises || [],
        workstationSetup: issue.workstationSetup || [],
        exerciseLinks: issue.exerciseLinks || [],
        personalizedAdvice: issue.advice || []
      };
    });
}

/**
 * Generate one-line recommendation summary
 */
function generateRecommendationSummary(issueAnalysis) {
  const issues = Object.values(issueAnalysis)
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 2);

  if (issues.length === 0) {
    return 'Excellent posture! Keep up the great work.';
  }

  if (issues.length === 1) {
    return `Focus on addressing ${issues[0].title.toLowerCase()}.`;
  }

  return `Priority: ${issues[0].title.toLowerCase()} and ${issues[1].title.toLowerCase()}.`;
}

// --------- Utility Functions ----------

/**
 * Format duration in seconds
 */
function formatDuration(seconds) {
  if (!seconds || seconds < 0) return '0s';

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get advice for specific issue type
 */
export function getAdviceForIssue(issueType) {
  return ADVICE_LIBRARY[issueType] || null;
}

/**
 * Get all issue types in advice library
 */
export function getAllIssueTypes() {
  return Object.keys(ADVICE_LIBRARY);
}

/**
 * Export full advice library
 */
export function getAdviceLibrary() {
  return ADVICE_LIBRARY;
}
