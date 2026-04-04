// Assess view: collects front/side uploads and stages posture assessment requests.
import { checkBackendHealth } from '../services/backendHealth.js';
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
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      processImageFile(file, true);
    }

    // Drag & drop handlers for side view
    function onSideDragOver(event) {
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
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      processImageFile(file, false);
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

    function getImageQuality(dimensions) {
      const shortEdge = Math.min(dimensions.width || 0, dimensions.height || 0);
      if (shortEdge >= 1200) return { label: 'High quality', tone: 'good' };
      if (shortEdge >= 800) return { label: 'Good quality', tone: 'ok' };
      return { label: 'Low quality', tone: 'warn' };
    }

    // Validate both uploads before queuing assessment generation.
    function generateAssessment() {
      if (!frontFile.value || !sideFile.value) {
        showStatusToast('Upload Required', 'Please upload both front and side images first.', 'var(--warn)');
        return;
      }
      showStatusToast('Assessment Queued', 'Images uploaded. Alignment metrics will be generated shortly.');
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
      clearFrontImage,
      clearSideImage,
      getImageQuality,
      generateAssessment,
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
            <label
              class="upload-card"
              :class="{ 'is-drag': frontDragActive, 'has-file': !!frontPreview, 'front-card': true }"
              @dragover="onFrontDragOver"
              @dragleave="onFrontDragLeave"
              @drop="onFrontFileDrop"
            >
              <input class="hidden" type="file" accept="image/png,image/jpeg" @change="onFrontFileChange" />
              <div class="upload-card-head">
                <span class="upload-view-tag">Front View</span>
                <span class="upload-view-hint">Chest facing camera</span>
              </div>

              <div v-if="!frontPreview" class="upload-empty-state">
                <div class="upload-icon-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
                <p class="upload-empty-title">Drop front posture photo</p>
                <p class="upload-empty-subtitle">Drag and drop or click to upload</p>
                <span class="upload-empty-chip">PNG or JPG</span>
              </div>

              <div v-else class="upload-preview-block">
                <div class="upload-preview-frame">
                  <img :src="frontPreview" class="upload-preview-img" alt="Front posture preview" />
                </div>
                <div class="upload-meta-row">
                  <div class="upload-meta-main">
                    <div class="upload-file-name">{{ frontFileName }}</div>
                    <div class="upload-file-specs">{{ frontDimensions.width }} × {{ frontDimensions.height }} px • {{ frontDimensions.size }} KB</div>
                  </div>
                  <button class="upload-replace-btn" type="button" @click.stop.prevent="clearFrontImage">Replace</button>
                </div>
                <span class="upload-quality" :class="'quality-' + getImageQuality(frontDimensions).tone">{{ getImageQuality(frontDimensions).label }}</span>
              </div>
            </label>

            <label
              class="upload-card"
              :class="{ 'is-drag': sideDragActive, 'has-file': !!sidePreview, 'side-card': true }"
              @dragover="onSideDragOver"
              @dragleave="onSideDragLeave"
              @drop="onSideFileDrop"
            >
              <input class="hidden" type="file" accept="image/png,image/jpeg" @change="onSideFileChange" />
              <div class="upload-card-head">
                <span class="upload-view-tag">Side View</span>
                <span class="upload-view-hint">Profile posture angle</span>
              </div>

              <div v-if="!sidePreview" class="upload-empty-state">
                <div class="upload-icon-wrap"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-8 h-8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4"/><path stroke-linecap="round" stroke-linejoin="round" d="m7 9 5-5 5 5"/><path stroke-linecap="round" stroke-linejoin="round" d="M4 18h16"/></svg></div>
                <p class="upload-empty-title">Drop side posture photo</p>
                <p class="upload-empty-subtitle">Drag and drop or click to upload</p>
                <span class="upload-empty-chip">PNG or JPG</span>
              </div>

              <div v-else class="upload-preview-block">
                <div class="upload-preview-frame">
                  <img :src="sidePreview" class="upload-preview-img" alt="Side posture preview" />
                </div>
                <div class="upload-meta-row">
                  <div class="upload-meta-main">
                    <div class="upload-file-name">{{ sideFileName }}</div>
                    <div class="upload-file-specs">{{ sideDimensions.width }} × {{ sideDimensions.height }} px • {{ sideDimensions.size }} KB</div>
                  </div>
                  <button class="upload-replace-btn" type="button" @click.stop.prevent="clearSideImage">Replace</button>
                </div>
                <span class="upload-quality" :class="'quality-' + getImageQuality(sideDimensions).tone">{{ getImageQuality(sideDimensions).label }}</span>
              </div>
            </label>
          </div>

          <div class="mt-4 flex flex-wrap gap-2 text-[0.85rem] text-[var(--muted)]">
            <span class="badge badge-muted">PNG/JPG up to 10MB</span>
            <span class="badge badge-muted">Good lighting</span>
            <span class="badge badge-muted">Full body in frame</span>
          </div>

          <div class="mt-4">
            <button class="btn-calibrate w-full mt-0" @click="generateAssessment">Generate Assessment</button>
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
