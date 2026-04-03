// Reusable composable-like helper for timed status toasts across views.
export function useStatusToast(defaultDuration = 3200) {
  const { ref, onBeforeUnmount } = Vue;

  const showToast = ref(false);
  const toastTitle = ref('');
  const toastMessage = ref('');
  const toastColor = ref('var(--accent)');

  let toastTimer = null;

  function hideStatusToast() {
    showToast.value = false;
  }

  // Shows a toast and auto-dismisses it unless manually closed earlier.
  function showStatusToast(title, message, color = 'var(--accent)', duration = defaultDuration) {
    toastTitle.value = title;
    toastMessage.value = message;
    toastColor.value = color;
    showToast.value = true;

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      showToast.value = false;
      toastTimer = null;
    }, duration);
  }

  onBeforeUnmount(() => {
    // Prevent orphaned timers when a view is destroyed.
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
  });

  return {
    showToast,
    toastTitle,
    toastMessage,
    toastColor,
    showStatusToast,
    hideStatusToast
  };
}