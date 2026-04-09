const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';
const YOUTUBE_KEY_STORAGE = 'wa-youtube-api-key';
let hasWarnedMissingYoutubeKey = false;

function getApiKey() {
  return window.WA_YOUTUBE_API_KEY || localStorage.getItem(YOUTUBE_KEY_STORAGE) || '';
}

export function setYouTubeApiKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) {
    localStorage.removeItem(YOUTUBE_KEY_STORAGE);
    return;
  }
  localStorage.setItem(YOUTUBE_KEY_STORAGE, key);
}

export async function searchYouTubeVideos(query, maxResults = 3) {
  const q = String(query || '').trim();
  if (!q) {
    return [];
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    if (!hasWarnedMissingYoutubeKey) {
      hasWarnedMissingYoutubeKey = true;
      console.info('YouTube API key is not configured. Falling back to search-result links.');
    }
    return [];
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    q,
    maxResults: String(Math.max(1, Math.min(5, Number(maxResults) || 3))),
    key: apiKey
  });

  const response = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `YouTube search failed: ${response.status}`);
  }

  const body = await response.json();
  const items = Array.isArray(body.items) ? body.items : [];

  return items
    .map((item) => {
      const videoId = item?.id?.videoId;
      const title = item?.snippet?.title;
      if (!videoId || !title) {
        return null;
      }

      return {
        title,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnail: item?.snippet?.thumbnails?.medium?.url || item?.snippet?.thumbnails?.default?.url || ''
      };
    })
    .filter(Boolean);
}

export async function enrichSearchesWithVideos(searches, maxPerSearch = 3) {
  const validSearches = Array.isArray(searches)
    ? searches.filter((row) => row && typeof row.query === 'string' && row.query.trim())
    : [];

  const results = [];
  for (const search of validSearches) {
    try {
      const videos = await searchYouTubeVideos(search.query, maxPerSearch);
      results.push({
        query: search.query,
        reason: search.reason || '',
        videos
      });
    } catch (error) {
      console.error('YouTube search failed:', error);
      results.push({
        query: search.query,
        reason: search.reason || '',
        videos: []
      });
    }
  }

  return results;
}
