// Assess view: collects front/side uploads and stages posture assessment requests.
import { checkBackendHealth } from '../services/backendHealth.js';
import { submitAssessment as submitAssessmentAPI } from '../services/assessment.js';
import { useStatusToast } from '../utils/useStatusToast.js';

export const AssessView = {
  setup() {
    const { ref, onMounted } = Vue;

    const backendStatus = ref('Connecting to backend...');
    const frontFileName = ref('');
    const sideFileName = ref('');
    
    // Image file objects and previews
    const frontFile = ref(null);
    const sideFile = ref(null);
    const frontPreview = ref('');
    const sidePreview = ref('');
    
    // Image metadata
    const frontDimensions = ref({ width: 0, height: 0, size: 0 });
    const sideDimensions = ref({ width: 0, height: 0, size: 0 });
    
    // Drag & drop state
    const frontDragActive = ref(false);
    const sideDragActive = ref(false);
    const frontInputRef = ref(null);
    const sideInputRef = ref(null);

    // Processing state
    const isProcessing = ref(false);
    const currentPhase = ref(null); // "analyzing_front" | "analyzing_side" | "generating_report"
    const report = ref(null);
    const reportHistory = ref([]);
    const errorState = ref(null); // { type: 'landmark_error' | 'timeout' | 'partial' | 'failed', message, image }

    const {
      showToast,
      toastTitle,
      toastMessage,
      showStatusToast,
      hideStatusToast
    } = useStatusToast(3500);

    const recentAssessments = ref([
      { id: 1, timestamp: 'Today, 10:15 AM', mode: 'Front + Side', score: 82, scoreColor: 'var(--accent)' },
      { id: 2, timestamp: 'Mar 28, 5:40 PM', mode: 'Front + Side', score: 80, scoreColor: 'var(--accent2)' }
    ]);

    // Helper: Process image file and extract metadata
    async function processImageFile(file, isFront = true) {
      if (!file.type.startsWith('image/')) {
        showStatusToast('Invalid File', 'Please upload an image file (PNG/JPG).', 'var(--warn)');
        return false;
      }

      // Check file size (10MB max)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        showStatusToast('File Too Large', 'Image must be under 10MB.', 'var(--warn)');
        return false;
      }

      // Create preview
      const reader = new FileReader();
      return new Promise((resolve) => {
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            if (isFront) {
              frontFile.value = file;
              frontFileName.value = file.name;
              frontPreview.value = e.target.result;
              frontDimensions.value = {
                width: img.width,
                height: img.height,
                size: (file.size / 1024).toFixed(2) // KB
              };
            } else {
              sideFile.value = file;
              sideFileName.value = file.name;
              sidePreview.value = e.target.result;
              sideDimensions.value = {
                width: img.width,
                height: img.height,
                size: (file.size / 1024).toFixed(2) // KB
              };
            }
            showStatusToast(
              isFront ? 'Front View Uploaded' : 'Side View Uploaded',
              `${file.name} (${img.width}×${img.height}px)`
            );
            resolve(true);
          };
          img.onerror = () => {
            showStatusToast('Image Error', 'Could not read image. Try a different file.', 'var(--warn)');
            resolve(false);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Capture selected front-view image metadata and confirm to the user.
    function onFrontFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      processImageFile(file, true);
    }

    // Capture selected side-view image metadata and confirm to the user.
    function onSideFileChange(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      processImageFile(file, false);
    }

    // Drag & drop handlers for front view
    function onFrontDragOver(event) {
      if (frontPreview.value) return;
      event.preventDefault();
      event.stopPropagation();
      frontDragActive.value = true;
    }

    function onFrontDragLeave(event) {
      event.preventDefault();
      event.stopPropagation();
      frontDragActive.value = false;
    }

    function onFrontFileDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      frontDragActive.value = false;
      if (frontPreview.value) return;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      processImageFile(file, true);
    }

    // Drag & drop handlers for side view
    function onSideDragOver(event) {
      if (sidePreview.value) return;
      event.preventDefault();
      event.stopPropagation();
      sideDragActive.value = true;
    }

    function onSideDragLeave(event) {
      event.preventDefault();
      event.stopPropagation();
      sideDragActive.value = false;
    }

    function onSideFileDrop(event) {
      event.preventDefault();
      event.stopPropagation();
      sideDragActive.value = false;
      if (sidePreview.value) return;
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      processImageFile(file, false);
    }

    function triggerFrontPicker() {
      frontInputRef.value?.click();
    }

    function triggerSidePicker() {
      sideInputRef.value?.click();
    }

    function clearFrontImage() {
      frontFile.value = null;
      frontFileName.value = '';
      frontPreview.value = '';
      frontDimensions.value = { width: 0, height: 0, size: 0 };
    }

    function clearSideImage() {
      sideFile.value = null;
      sideFileName.value = '';
      sidePreview.value = '';
      sideDimensions.value = { width: 0, height: 0, size: 0 };
    }

    function replaceFrontImage() {
      clearFrontImage();
      triggerFrontPicker();
    }

    function replaceSideImage() {
      clearSideImage();
      triggerSidePicker();
    }

    function getImageQuality(dimensions) {
      const shortEdge = Math.min(dimensions.width || 0, dimensions.height || 0);
      if (shortEdge >= 1200) return { label: 'High quality', tone: 'good' };
      if (shortEdge >= 800) return { label: 'Good quality', tone: 'ok' };
      return { label: 'Low quality', tone: 'warn' };
    }

    // Validate both uploads and initiate assessment submission.
    function confirmImages() {
      if (!frontFile.value || !sideFile.value) {
        showStatusToast('Upload Required', 'Please upload both front and side images first.', 'var(--warn)');
        return;
      }
      // Clear previous errors and reports
      errorState.value = null;
      report.value = null;
      // Trigger assessment submission (will be implemented in Task 3)
      submitAssessment(frontFile.value, sideFile.value);
    }

    // Submit images for assessment via API with state management
    async function submitAssessment(frontFileObj, sideFileObj) {
      isProcessing.value = true;
      errorState.value = null;
      report.value = null;

      try {
        // Call API with phase change callback for UI updates
        const result = await submitAssessmentAPI(
          frontFileObj,
          sideFileObj,
          (phase) => {
            currentPhase.value = phase;
          }
        );

        // Handle results based on status
        if (result.status === 'success') {
          // Full success: both analyses worked
          report.value = result;
          addToReportHistory(result);
          showStatusToast('Assessment Complete', 'Your posture assessment is ready.', 'var(--accent)');
        } else if (result.status === 'partial') {
          // Partial success: one analysis worked
          report.value = result;
          addToReportHistory(result);
          
          // Show warning based on which failed
          const warnings = result.warnings || [];
          const warningMsg = warnings.length > 0 ? warnings[0] : 'Partial assessment completed';
          showStatusToast('Partial Assessment', warningMsg, 'var(--warn)');
        } else {
          // Full failure: neither analysis worked
          errorState.value = result.error || { message: 'Assessment failed. Please try again.' };
          
          const errorMsg = result.error?.message || 'Assessment failed';
          const advice = result.error?.advice || '';
          showStatusToast(
            'Assessment Failed',
            advice ? `${errorMsg}\n${advice}` : errorMsg,
            'var(--danger)'
          );
        }
      } catch (error) {
        // Unexpected error
        errorState.value = {
          type: 'fatal_error',
          message: error.message || 'An unexpected error occurred'
        };
        showStatusToast('Error', error.message || 'Assessment failed', 'var(--danger)');
      } finally {
        isProcessing.value = false;
        currentPhase.value = null;
      }
    }

    // Helper: Add successful assessment to history
    function addToReportHistory(assessmentResult) {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });

      const frontScore = assessmentResult.frontResult?.success ? assessmentResult.frontResult.score : null;
      const sideScore = assessmentResult.sideResult?.success ? assessmentResult.sideResult.score : null;

      const entry = {
        id: Date.now(),
        timestamp,
        mode: assessmentResult.status === 'partial' 
          ? (frontScore ? 'Front Only' : 'Side Only')
          : 'Front + Side',
        frontScore,
        sideScore,
        overallScore: assessmentResult.report?.overall_score || null,
        status: assessmentResult.status,
        fullData: assessmentResult
      };

      // Add to beginning of history
      reportHistory.value.unshift(entry);
    }

    // Helper: Get phase display text and step number
    function getPhaseInfo() {
      const phases = {
        'analyzing_front': { text: 'Analyzing Front View', step: 1, total: 3 },
        'analyzing_side': { text: 'Analyzing Side View', step: 2, total: 3 },
        'generating_report': { text: 'Generating Report', step: 3, total: 3 }
      };
      return phases[currentPhase.value] || { text: 'Processing...', step: 0, total: 3 };
    }

    // Resolve backend availability so the UI can explain whether data is local or synced.
    onMounted(async () => {
      backendStatus.value = await checkBackendHealth({
        successMessage: 'Backend connected',
        unavailableMessage: 'Backend unavailable. You can still stage local uploads.',
        countSuffix: 'assessment entries available'
      });
    });

    return {
      backendStatus,
      frontFileName,
      sideFileName,
      frontFile,
      sideFile,
      frontPreview,
      sidePreview,
      frontDimensions,
      sideDimensions,
      frontDragActive,
      sideDragActive,
      frontInputRef,
      sideInputRef,
      isProcessing,
      currentPhase,
      report,
      reportHistory,
      errorState,
      recentAssessments,
      showToast,
      toastTitle,
      toastMessage,
      onFrontFileChange,
      onSideFileChange,
      onFrontDragOver,
      onFrontDragLeave,
      onFrontFileDrop,
      onSideDragOver,
      onSideDragLeave,
      onSideFileDrop,
      triggerFrontPicker,
      triggerSidePicker,
      clearFrontImage,
      clearSideImage,
      replaceFrontImage,
      replaceSideImage,
      getImageQuality,
      getPhaseInfo,
      confirmImages,
      submitAssessment,
      addToReportHistory,
      hideStatusToast
    };
  },
  template: `
    <div class="w-full">
      <app-card>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="font-[Syne] text-[2rem] font-extrabold mb-2">Assess Your Posture</h1>
            <p class="text-[var(--muted)] text-[0.95rem]">Upload front and side photos to generate an assessment summary.</p>
            <p class="text-[0.75rem] text-[var(--muted)] mt-2">{{ backendStatus }}</p>
          </div>
          <button class="btn-calibrate min-w-[10rem] mt-0">View History</button>
        </div>
      </app-card>
    </div>

    <div class="monitoring-grid">
      <div class="flex flex-col gap-5">
        <div class="card">
          <div class="section-header">
            <div class="section-title">Upload Images</div>
            <span class="badge badge-muted">Front + Side</span>
          </div>

          <div class="assess-upload-grid">
            <div
              class="upload-card"
              :class="{ 'is-drag': frontDragActive, 'has-file': !!frontPreview, 'front-card': true }"
              @dragover="onFrontDragOver"
              @dragleave="onFrontDragLeave"
              @drop="onFrontFileDrop"
            >
              <input ref="frontInputRef" class="hidden" type="file" accept="image/png,image/jpeg" @change="onFrontFileChange" />
              <div class="upload-card-head">
                <span class="upload-view-tag">Front View</span>
                <span class="upload-view-hint">Chest facing camera</span>
              </div>

              <div v-if="!frontPreview" class="upload-empty-state">
                <div class="upload-icon-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
                <p class="upload-empty-title">Drop front posture photo</p>
                <p class="upload-empty-subtitle">Drag and drop or click to upload</p>
                <span class="upload-empty-chip">PNG or JPG</span>
                <button class="upload-pick-btn" type="button" @click.stop="triggerFrontPicker">Choose Front Image</button>
              </div>

              <div v-else class="upload-preview-block">
                <div class="upload-preview-frame">
                  <img :src="frontPreview" class="upload-preview-img" alt="Front posture preview" />
                  <div class="upload-silhouette front">
                    <svg viewBox="0 0 64 64" aria-hidden="true">
                      <circle cx="32" cy="13" r="8"></circle>
                      <rect x="23" y="22" width="18" height="20" rx="8"></rect>
                      <rect x="14" y="24" width="8" height="18" rx="4"></rect>
                      <rect x="42" y="24" width="8" height="18" rx="4"></rect>
                      <rect x="24" y="42" width="7" height="17" rx="3.5"></rect>
                      <rect x="33" y="42" width="7" height="17" rx="3.5"></rect>
                    </svg>
                  </div>
                </div>
                <div class="upload-meta-row">
                  <div class="upload-meta-main">
                    <div class="upload-file-name">{{ frontFileName }}</div>
                    <div class="upload-file-specs">{{ frontDimensions.width }} × {{ frontDimensions.height }} px • {{ frontDimensions.size }} KB</div>
                  </div>
                  <button class="upload-replace-btn" type="button" @click.stop.prevent="replaceFrontImage">Replace Image</button>
                </div>
                <span class="upload-quality" :class="'quality-' + getImageQuality(frontDimensions).tone">{{ getImageQuality(frontDimensions).label }}</span>
                <p class="upload-locked-note">Image is locked. Use Replace Image to change it.</p>
              </div>
            </div>

            <div
              class="upload-card"
              :class="{ 'is-drag': sideDragActive, 'has-file': !!sidePreview, 'side-card': true }"
              @dragover="onSideDragOver"
              @dragleave="onSideDragLeave"
              @drop="onSideFileDrop"
            >
              <input ref="sideInputRef" class="hidden" type="file" accept="image/png,image/jpeg" @change="onSideFileChange" />
              <div class="upload-card-head">
                <span class="upload-view-tag">Side View</span>
                <span class="upload-view-hint">Profile posture angle</span>
              </div>

              <div v-if="!sidePreview" class="upload-empty-state">
                <div class="upload-icon-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
                <p class="upload-empty-title">Drop side posture photo</p>
                <p class="upload-empty-subtitle">Drag and drop or click to upload</p>
                <span class="upload-empty-chip">PNG or JPG</span>
                <button class="upload-pick-btn" type="button" @click.stop="triggerSidePicker">Choose Side Image</button>
              </div>

              <div v-else class="upload-preview-block">
                <div class="upload-preview-frame">
                  <img :src="sidePreview" class="upload-preview-img" alt="Side posture preview" />
                  <div class="upload-silhouette side">
                    <svg viewBox="0 0 64 64" aria-hidden="true">
                      <circle cx="29" cy="13" r="8"></circle>
                      <path d="M26 22h12c4 0 7 3 7 7v12c0 3-2 5-5 6l-5 2v10h-7V45l-4-2c-3-1-5-3-5-6V29c0-4 3-7 7-7z"></path>
                      <rect x="36" y="26" width="7" height="16" rx="3.5"></rect>
                    </svg>
                  </div>
                </div>
                <div class="upload-meta-row">
                  <div class="upload-meta-main">
                    <div class="upload-file-name">{{ sideFileName }}</div>
                    <div class="upload-file-specs">{{ sideDimensions.width }} × {{ sideDimensions.height }} px • {{ sideDimensions.size }} KB</div>
                  </div>
                  <button class="upload-replace-btn" type="button" @click.stop.prevent="replaceSideImage">Replace Image</button>
                </div>
                <span class="upload-quality" :class="'quality-' + getImageQuality(sideDimensions).tone">{{ getImageQuality(sideDimensions).label }}</span>
                <p class="upload-locked-note">Image is locked. Use Replace Image to change it.</p>
              </div>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-2 text-[0.85rem] text-[var(--muted)]">
            <span class="badge badge-muted">PNG/JPG up to 10MB</span>
            <span class="badge badge-muted">Good lighting</span>
            <span class="badge badge-muted">Full body in frame</span>
          </div>

          <div class="mt-4">
            <button 
              class="btn-calibrate w-full mt-0" 
              @click="confirmImages"
              :disabled="!frontFile || !sideFile || isProcessing"
              :class="{ 'opacity-50 cursor-not-allowed': !frontFile || !sideFile || isProcessing }"
            >
              {{ isProcessing ? 'Processing...' : 'Confirm Images' }}
            </button>
          </div>
        </div>

        <app-card title="Recent Assessments" badge="Auto-saved" badge-class="badge badge-green">
          <app-list :items="recentAssessments">
            <template #default="{ item }">
              <div class="flex justify-between items-center p-3 bg-[var(--surface2)] rounded-lg">
                <div>
                  <div class="font-semibold">{{ item.timestamp }}</div>
                  <div class="text-sm text-[var(--muted)]">{{ item.mode }}</div>
                </div>
                <div :style="{ color: item.scoreColor }" class="font-bold">Score {{ item.score }}%</div>
              </div>
            </template>
          </app-list>
        </app-card>
      </div>

      <div class="right-col">
        <div class="card">
          <div class="section-header">
            <div class="section-title">Guidelines</div>
          </div>
          <ul class="list-disc pl-5 space-y-2 text-[0.95rem] text-[var(--muted)]">
            <li>Stand neutral with arms relaxed at your sides.</li>
            <li>Place camera at shoulder height; keep feet visible.</li>
            <li>Avoid wide-angle distortion; step back if needed.</li>
            <li>Wear form-fitting clothing for clearer landmarks.</li>
          </ul>
        </div>

        <div class="card">
          <div class="section-header">
            <div class="section-title">Next Steps</div>
          </div>
          <div class="flex flex-col gap-2 text-[0.95rem]">
            <div class="flex items-center gap-2">
              <span class="badge badge-green">1</span>
              <span>Upload both views</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-green">2</span>
              <span>Generate alignment metrics</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="badge badge-green">3</span>
              <span>Send to Plan for recommendations</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading Overlay -->
    <div v-if="isProcessing" class="assess-loading-overlay">
      <div class="assess-loading-backdrop"></div>
      <div class="assess-loading-content">
        <div class="assess-spinner"></div>
        <div class="assess-phase-text">{{ getPhaseInfo().text }}</div>
        <div class="assess-progress-bar">
          <div class="assess-progress-fill" :style="{ width: (getPhaseInfo().step / getPhaseInfo().total) * 100 + '%' }"></div>
        </div>
        <div class="assess-progress-step">Step {{ getPhaseInfo().step }} of {{ getPhaseInfo().total }}</div>
      </div>
    </div>

    <div v-if="showToast" class="alert-toast">
      <div class="toast-header">
        <div class="toast-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 7h.01"/></svg></div>
        <div class="toast-title text-[var(--accent)]">{{ toastTitle }}</div>
      </div>
      <div class="toast-body">
        {{ toastMessage }}
      </div>
      <div class="toast-actions">
        <button class="toast-btn ghost" @click="hideStatusToast">Dismiss</button>
      </div>
    </div>
  `
};
