/**
 * Posture Report Component
 * Displays comprehensive session analysis, statistics, and personalized recommendations
 * Shows issue breakdown, trends, and actionable advice with exercise links
 */

export const PostureReport = {
  props: {
    report: {
      type: Object,
      required: true
    },
    sessionDuration: {
      type: String,
      default: '00:00:00'
    },
    previousSessions: {
      type: Array,
      default: () => []
    }
  },
  
  emits: ['download-report', 'start-new-session', 'go-to-dashboard'],

  setup(props, { emit }) {
    const { computed } = Vue;

    // Compute report statistics
    const overallScore = computed(() => props.report?.overallScore || 0);
    
    const scoreColor = computed(() => {
      const score = overallScore.value;
      if (score >= 80) return 'text-[var(--accent)]';
      if (score >= 60) return 'text-[var(--warn)]';
      return 'text-[var(--danger)]';
    });

    const scoreBackground = computed(() => {
      const score = overallScore.value;
      if (score >= 80) return 'bg-[rgba(106,249,224,0.1)]';
      if (score >= 60) return 'bg-[rgba(249,115,22,0.1)]';
      return 'bg-[rgba(239,68,68,0.1)]';
    });

    // Calculate trend vs previous session
    const trendInfo = computed(() => {
      if (!props.previousSessions || props.previousSessions.length === 0) {
        return null;
      }

      const lastSession = props.previousSessions[props.previousSessions.length - 1];
      if (!lastSession?.report?.overallScore) {
        return null;
      }

      const currentScore = overallScore.value;
      const previousScore = lastSession.report.overallScore;
      const improvement = currentScore - previousScore;

      return {
        previousScore,
        improvement,
        isImproved: improvement > 0,
        isDeclined: improvement < 0,
        isFlat: Math.abs(improvement) <= 1,
        percentChange: improvement > 0 ? `+${improvement}%` : `${improvement}%`
      };
    });

    // Get issue severity color
    function getSeverityColor(severity) {
      if (severity > 66) return 'bg-[rgba(239,68,68,0.1)] border-[var(--danger)] text-[var(--danger)]';
      if (severity > 33) return 'bg-[rgba(249,115,22,0.1)] border-[var(--warn)] text-[var(--warn)]';
      return 'bg-[rgba(106,249,224,0.1)] border-[var(--accent2)] text-[var(--accent2)]';
    }

    function getSeverityIcon(severity) {
      if (severity > 66) return '🔴';
      if (severity > 33) return '🟡';
      return '🟢';
    }

    // Format issue percentage
    function formatIssuePercentage(snapshots, issueKey) {
      if (!snapshots || snapshots.length === 0) return 0;
      
      const issueCount = snapshots.filter(s => 
        s.postures?.issues?.some(issue => issue.type === issueKey || issue.key === issueKey)
      ).length;
      
      return Math.round((issueCount / snapshots.length) * 100);
    }

    // Group issues by type for display
    const issuesByType = computed(() => {
      const issues = props.report?.detailedIssues || [];
      return issues.reduce((acc, issue) => {
        if (!acc[issue.type]) {
          acc[issue.type] = issue;
        }
        return acc;
      }, {});
    });

    return {
      overallScore,
      scoreColor,
      scoreBackground,
      trendInfo,
      getSeverityColor,
      getSeverityIcon,
      formatIssuePercentage,
      issuesByType,
      emit
    };
  },

  template: `
    <div class="w-full space-y-6">
      <!-- Overall Score Summary -->
      <div :class="['p-8 rounded-xl border-2 border-opacity-50', scoreBackground]" 
           :style="{ borderColor: scoreColor === 'text-[var(--accent)]' ? 'var(--accent)' : scoreColor === 'text-[var(--warn)]' ? 'var(--warn)' : 'var(--danger)' }">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[var(--muted)] text-[0.95rem] mb-2">Session Score</div>
            <div class="flex items-baseline gap-3">
              <div :class="['font-[Syne] text-[4rem] font-extrabold', scoreColor]">
                {{ overallScore }}
              </div>
              <div class="text-[var(--muted)] text-[1.1rem]">/ 100</div>
            </div>
          </div>

          <!-- Trend Indicator -->
          <div v-if="trendInfo" class="text-right p-4 bg-[var(--surface2)] rounded-lg border border-[var(--border)]">
            <div class="text-[var(--muted)] text-[0.85rem] mb-1">vs Last Session</div>
            <div class="flex items-center gap-2 justify-end">
              <span :class="['text-[1.4rem]', trendInfo.isImproved ? 'text-[var(--accent)]' : trendInfo.isDeclined ? 'text-[var(--danger)]' : 'text-[var(--muted)]']">
                {{ trendInfo.isImproved ? '📈' : trendInfo.isDeclined ? '📉' : '→' }}
              </span>
              <span :class="['font-semibold text-[1.2rem]', trendInfo.isImproved ? 'text-[var(--accent)]' : trendInfo.isDeclined ? 'text-[var(--danger)]' : 'text-[var(--muted)]']">
                {{ trendInfo.percentChange }}
              </span>
            </div>
          </div>
        </div>

        <!-- Session Info -->
        <div class="flex flex-wrap gap-4 mt-6 pt-6 border-t" :style="{ borderColor: 'currentColor', opacity: '0.2' }">
          <div>
            <div class="text-[var(--muted)] text-[0.85rem]">Duration</div>
            <div class="font-['JetBrains_Mono'] font-semibold text-[1.1rem]">{{ sessionDuration }}</div>
          </div>
          <div>
            <div class="text-[var(--muted)] text-[0.85rem]">Generated</div>
            <div class="font-['JetBrains_Mono'] font-semibold text-[1.1rem]">{{ new Date(report.generatedAt || Date.now()).toLocaleString() }}</div>
          </div>
        </div>
      </div>

      <!-- Quality Breakdown -->
      <div class="p-6 bg-[var(--surface2)] rounded-xl border border-[var(--border)]">
        <h3 class="font-semibold text-[1.1rem] mb-4">Posture Quality Breakdown</h3>
        <div class="grid grid-cols-4 gap-3">
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] text-center">
            <div class="text-[var(--accent)] font-['JetBrains_Mono'] text-[2rem] font-bold">
              {{ report.postureTimeDistribution?.GOOD || 0 }}%
            </div>
            <div class="text-[var(--muted)] text-[0.8rem] mt-1">Good</div>
          </div>
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] text-center">
            <div class="text-[var(--accent2)] font-['JetBrains_Mono'] text-[2rem] font-bold">
              {{ report.postureTimeDistribution?.WARNING || 0 }}%
            </div>
            <div class="text-[var(--muted)] text-[0.8rem] mt-1">Warning</div>
          </div>
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] text-center">
            <div class="text-[var(--warn)] font-['JetBrains_Mono'] text-[2rem] font-bold">
              {{ report.postureTimeDistribution?.POOR || 0 }}%
            </div>
            <div class="text-[var(--muted)] text-[0.8rem] mt-1">Poor</div>
          </div>
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)] text-center">
            <div class="text-[var(--danger)] font-['JetBrains_Mono'] text-[2rem] font-bold">
              {{ report.postureTimeDistribution?.CRITICAL || 0 }}%
            </div>
            <div class="text-[var(--muted)] text-[0.8rem] mt-1">Critical</div>
          </div>
        </div>
      </div>

      <!-- Issues Breakdown -->
      <div v-if="report.detailedIssues && report.detailedIssues.length > 0" class="p-6 bg-[var(--surface2)] rounded-xl border border-[var(--border)]">
        <h3 class="font-semibold text-[1.1rem] mb-4">Detected Issues</h3>
        <div class="space-y-3">
          <div v-for="(issue, idx) in report.detailedIssues" :key="idx" 
               :class="['p-4 rounded-lg border-2', getSeverityColor(issue.severity)]">
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[1.2rem]">{{ getSeverityIcon(issue.severity) }}</span>
                  <h4 class="font-semibold text-[1rem]">{{ issue.title }}</h4>
                </div>
                <p class="text-[0.85rem] text-[var(--muted)] mb-2">{{ issue.description }}</p>
                <div class="text-[0.8rem] mb-2">
                  <span class="font-semibold">Severity:</span>
                  <span class="ml-1 font-['JetBrains_Mono']">{{ issue.severity }}%</span>
                </div>
              </div>
              <div class="text-right whitespace-nowrap">
                <div class="text-[0.8rem] text-[var(--muted)] mb-1">Duration</div>
                <div class="font-['JetBrains_Mono'] font-semibold">{{ issue.durationMinutes || '—' }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Personalized Advice Section -->
      <div v-if="report.detailedIssues && report.detailedIssues.length > 0" class="space-y-4">
        <h3 class="font-semibold text-[1.2rem]">Personalized Recommendations</h3>
        
        <div v-for="(issue, idx) in report.detailedIssues" :key="'advice-' + idx" 
             class="p-6 bg-[var(--surface2)] rounded-xl border border-[var(--border)]">
          
          <!-- Issue Header -->
          <div class="mb-4 pb-4 border-b border-[var(--border)]">
            <h4 class="font-semibold text-[1.1rem] mb-1">{{ issue.title }}</h4>
            <p class="text-[var(--muted)] text-[0.9rem]">{{ issue.description }}</p>
          </div>

          <!-- Why It Matters (Health Impact) -->
          <div class="mb-4">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">⚠️ Why It Matters:</div>
            <p class="text-[0.9rem]">{{ issue.healthRisk }}</p>
          </div>

          <!-- Immediate Actions -->
          <div class="mb-4">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">⚡ Quick Fixes:</div>
            <ul class="space-y-1">
              <li v-for="(action, i) in (issue.immediateActions || []).slice(0, 3)" :key="i" class="text-[0.85rem] flex gap-2">
                <span class="text-[var(--accent)]">→</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>

          <!-- Daily Exercises -->
          <div class="mb-4">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">💪 Daily Exercises:</div>
            <div class="space-y-2">
              <div v-for="(exercise, i) in (issue.dailyExercises || []).slice(0, 2)" :key="i" class="p-3 bg-[var(--surface)] rounded-lg text-[0.85rem]">
                <div class="font-semibold">{{ exercise.name }}</div>
                <div class="text-[var(--muted)] text-[0.8rem]">{{ exercise.frequency }} — {{ exercise.reps || '' }}</div>
              </div>
            </div>
          </div>

          <!-- Exercise Links -->
          <div v-if="issue.exerciseLinks && issue.exerciseLinks.length > 0" class="mb-4">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">📺 Learn More:</div>
            <div class="flex flex-wrap gap-2">
              <a v-for="(link, i) in issue.exerciseLinks.slice(0, 2)" :key="i"
                 :href="link.url" target="_blank" rel="noopener noreferrer"
                 class="inline-flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-[var(--surface)] text-[0.8rem] rounded-lg font-semibold hover:opacity-80 transition">
                {{ link.title }}
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                </svg>
              </a>
            </div>
          </div>

          <!-- Workstation Tips -->
          <div v-if="issue.workstationSetup && issue.workstationSetup.length > 0">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">🪑 Workstation Setup:</div>
            <ul class="space-y-1">
              <li v-for="(tip, i) in issue.workstationSetup.slice(0, 2)" :key="i" class="text-[0.85rem] flex gap-2">
                <span class="text-[var(--accent2)]">✓</span>
                <span>{{ tip }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Action Plan Summary -->
      <div v-if="report.actionPlan" class="p-6 bg-[rgba(106,249,224,0.05)] border-2 border-[var(--accent2)] rounded-xl">
        <h3 class="font-semibold text-[1.1rem] mb-4 text-[var(--accent2)]">🎯 Your Action Plan</h3>
        
        <div class="grid grid-cols-3 gap-4">
          <!-- Immediate -->
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)]">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">Today</div>
            <ul class="space-y-1">
              <li v-for="(action, i) in (report.actionPlan.immediate || []).slice(0, 2)" :key="i" class="text-[0.8rem] flex gap-1">
                <span>•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>

          <!-- Short-term -->
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)]">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">This Week</div>
            <ul class="space-y-1">
              <li v-for="(action, i) in (report.actionPlan.shortTerm || []).slice(0, 2)" :key="i" class="text-[0.8rem] flex gap-1">
                <span>•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>

          <!-- Long-term -->
          <div class="bg-[var(--surface)] p-4 rounded-lg border border-[var(--border)]">
            <div class="text-[0.85rem] font-semibold text-[var(--muted)] mb-2">This Month</div>
            <ul class="space-y-1">
              <li v-for="(action, i) in (report.actionPlan.longTerm || []).slice(0, 2)" :key="i" class="text-[0.8rem] flex gap-1">
                <span>•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Health Assessment Warning -->
      <div v-if="report.healthRiskAssessment" class="p-6 bg-[rgba(239,68,68,0.1)] border-2 border-[var(--danger)] rounded-xl">
        <div class="flex gap-3">
          <div class="text-[1.5rem]">⚠️</div>
          <div>
            <h4 class="font-semibold text-[var(--danger)] mb-2">Health Assessment</h4>
            <p class="text-[0.9rem]">{{ report.healthRiskAssessment }}</p>
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap gap-3 justify-center pt-4">
        <button @click="emit('download-report')" 
                class="btn-calibrate btn-emphasis btn-emphasis-accent px-6 py-3 rounded-lg font-semibold">
          📥 Download Report
        </button>
        <button @click="emit('start-new-session')" 
                class="btn-calibrate btn-emphasis btn-emphasis-accent px-6 py-3 rounded-lg font-semibold">
          🔄 Start New Session
        </button>
        <button @click="emit('go-to-dashboard')" 
                class="btn-calibrate bg-[var(--surface2)] text-[var(--text)] px-6 py-3 rounded-lg font-semibold hover:bg-[var(--border)] transition">
          📊 View Dashboard
        </button>
      </div>
    </div>
  `
};
