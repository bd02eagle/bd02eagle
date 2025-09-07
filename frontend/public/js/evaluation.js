const API_BASE = '/api';
let currentEventId = null;
let currentGameId = null;
let events = [];
let currentEventIndex = 0;
let authToken = localStorage.getItem('authToken');

// Form state
let formData = {
  infractionType: 'foul',
  foulType: 'shooting',
  callCorrectness: 'correct',
  referee: 'John Smith (Crew Chief)',
  notes: '',
  supervisorReview: false
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/';
    return;
  }

  initializeEventListeners();
  checkGameSelection();
  loadCurrentGame();
});

function checkGameSelection() {
  const selectedGameId = localStorage.getItem('selectedGameId');
  
  // If no game was selected and user came from somewhere other than My Games,
  // show a helpful message
  if (!selectedGameId && !document.referrer.includes('my-games')) {
    const gameTitle = document.getElementById('game-title');
    if (gameTitle) {
      const notice = document.createElement('div');
      notice.style.cssText = `
        background: #FEF3C7;
        border: 1px solid #F59E0B;
        border-radius: 6px;
        padding: 12px;
        margin: 12px 0;
        font-size: 14px;
        color: #92400E;
      `;
      notice.innerHTML = `
        <strong>Tip:</strong> Select a specific game from 
        <a href="/my-games.html" style="color: #3B82F6; text-decoration: underline;">My Games</a> 
        to evaluate your assigned events, or continue with the most recent game.
      `;
      gameTitle.parentNode.insertBefore(notice, gameTitle.nextSibling);
    }
  }
}

function initializeEventListeners() {
  // Navigation setup
  setupNavigation();
  
  // Form controls
  document.querySelectorAll('.infraction-btn').forEach(btn => {
    btn.addEventListener('click', () => selectInfraction(btn.dataset.value));
  });

  document.querySelectorAll('.foul-btn').forEach(btn => {
    btn.addEventListener('click', () => selectFoulType(btn.dataset.value));
  });

  document.querySelectorAll('.correctness-btn').forEach(btn => {
    btn.addEventListener('click', () => selectCorrectness(btn.dataset.value));
  });

  // Navigation controls
  document.getElementById('prev-event-btn').addEventListener('click', () => navigateEvent(-1));
  document.getElementById('next-event-btn').addEventListener('click', () => navigateEvent(1));

  // Save button
  document.getElementById('save-tag-btn').addEventListener('click', saveTag);

  // Video trim controls
  document.querySelectorAll('[data-trim]').forEach(btn => {
    btn.addEventListener('click', () => trimVideo(btn.dataset.trim));
  });

  // Notes textarea
  document.getElementById('tag-notes').addEventListener('input', (e) => {
    formData.notes = e.target.value;
  });

  // Supervisor review checkbox
  document.getElementById('supervisor-review').addEventListener('change', (e) => {
    formData.supervisorReview = e.target.checked;
  });
}

function selectInfraction(type) {
  formData.infractionType = type;
  document.querySelectorAll('.infraction-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-value="${type}"]`).classList.add('active');
}

function selectFoulType(type) {
  formData.foulType = type;
  document.querySelectorAll('.foul-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.foul-btn[data-value="${type}"]`).classList.add('active');
}

function selectCorrectness(type) {
  formData.callCorrectness = type;
  document.querySelectorAll('.correctness-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.correctness-btn[data-value="${type}"]`).classList.add('active');
}

async function loadCurrentGame() {
  try {
    const selectedGameId = localStorage.getItem('selectedGameId');
    
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!gamesResponse.ok) {
      throw new Error('Failed to fetch games');
    }

    const games = await gamesResponse.json();
    if (games.length === 0) {
      displayError('No games found');
      return;
    }

    // Load the selected game from My Games, or default to most recent
    let game;
    if (selectedGameId) {
      game = games.find(g => g.id === selectedGameId);
      console.log('Found selected game:', game);
      // Clear the selection after using it
      localStorage.removeItem('selectedGameId');
    }
    
    // Fallback to most recent game if no selection or game not found
    if (!game) {
      game = games[0];
      console.log('Using fallback game:', game);
    }

    currentGameId = game.id;

    // Update game info with proper team names
    const gameTitle = document.getElementById('game-title');
    if (gameTitle) {
      // Use team names or shortNames, with fallback
      const homeTeam = game.homeTeam?.shortName || game.homeTeam?.name || 'Home';
      const awayTeam = game.awayTeam?.shortName || game.awayTeam?.name || 'Away';
      gameTitle.textContent = `${homeTeam} vs. ${awayTeam}`;
    }

    // Show indicator if this game was selected from My Games
    if (selectedGameId) {
      const gameTitle = document.getElementById('game-title');
      const indicator = document.createElement('span');
      indicator.style.cssText = 'color: #10B981; font-size: 12px; margin-left: 8px;';
      indicator.textContent = '(Selected from My Games)';
      gameTitle.appendChild(indicator);
    }

    // Update game status and time
    const gameTimeElement = document.getElementById('game-time');
    if (gameTimeElement) {
      gameTimeElement.textContent = 'Q4 | 04:39.5';
    }

    // Update possession
    const possessionElement = document.getElementById('possession-team');
    if (possessionElement) {
      possessionElement.textContent = game.homeTeam.name;
    }

    await loadEvents(game.id);
  } catch (error) {
    console.error('Error loading game:', error);
    displayError('Failed to load game data');
  }
}

async function loadEvents(gameId) {
  try {
    const eventsResponse = await fetch(`${API_BASE}/games/${gameId}/events`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch events');
    }

    events = await eventsResponse.json();

    if (events.length === 0) {
      displayError('No events found for this game');
      return;
    }

    // Load tags for each event with better error handling
    const tagPromises = events.map(async (event, index) => {
      try {
        const tagsResponse = await fetch(`${API_BASE}/events/${event.id}/tags`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });

        if (tagsResponse.ok) {
          events[index].tags = await tagsResponse.json();
        } else {
          console.warn(`Failed to load tags for event ${event.id}`);
          events[index].tags = [];
        }
      } catch (error) {
        console.warn(`Error loading tags for event ${event.id}:`, error);
        events[index].tags = [];
      }
    });

    await Promise.all(tagPromises);

    currentEventIndex = 0;
    loadCurrentEvent();
  } catch (error) {
    console.error('Error loading events:', error);
    displayError('Failed to load events');
  }
}

function loadCurrentEvent() {
  if (!events.length || currentEventIndex < 0 || currentEventIndex >= events.length) return;

  const event = events[currentEventIndex];
  currentEventId = event.id;

  // Update event info with more descriptive display
  const eventNumber = String(currentEventIndex + 1).padStart(3, '0');
  document.getElementById('event-number').textContent = `EVENT #${eventNumber}`;
  document.getElementById('event-type').textContent = event.type;
  document.getElementById('event-counter').textContent = `Event ${currentEventIndex + 1} of ${events.length}`;

  // Load video with improved error handling
  const video = document.getElementById('event-video');
  if (event.videoUrl) {
    // Clear any previous event listeners
    video.onloadstart = null;
    video.oncanplay = null;
    video.onerror = null;
    video.onloadeddata = null;

    // Set up new event listeners
    video.onloadstart = () => {
      console.log('Loading video:', event.videoUrl);
      showVideoStatus('Loading video...');
    };

    video.oncanplay = () => {
      console.log('Video ready to play');
      showVideoStatus('Video ready');
      // Auto-play video when ready
      video.play().catch(e => {
        console.log('Auto-play prevented by browser:', e);
        showVideoStatus('Click to play video');
      });
    };

    video.onerror = (e) => {
      console.error('Video error:', e, 'URL:', event.videoUrl);
      showVideoStatus('Video failed to load - trying backup...');

      // Try backup video URLs if primary fails
      const backupUrls = [
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4'
      ];

      const currentBackup = backupUrls.find(url => url !== event.videoUrl);
      if (currentBackup) {
        console.log('Trying backup URL:', currentBackup);
        video.src = currentBackup;
        video.load();
      } else {
        showVideoStatus('Video unavailable');
      }
    };

    video.onloadeddata = () => {
      console.log('Video data loaded successfully');
      updateVideoTime();
    };

    // Set CORS attributes for better compatibility
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    // Clear current source first to avoid invalid state
    video.pause();
    video.removeAttribute('src');
    video.load();

    // Set new source after clearing
    setTimeout(() => {
      video.src = event.videoUrl;
      video.load();
    }, 100);
  } else {
    showVideoStatus('No video available');
  }

  // Load existing tags if any
  loadExistingTags(event);

  // Update navigation buttons
  updateNavigationButtons();
}

function loadExistingTags(event) {
  if (event.tags && event.tags.length > 0) {
    const tag = event.tags[0]; // Load first tag

    // Update form with existing tag data
    if (tag.label.includes('foul')) {
      formData.infractionType = 'foul';
      selectInfraction('foul');
    }

    if (tag.notes) {
      formData.notes = tag.notes;
      document.getElementById('tag-notes').value = tag.notes;
    }
  } else {
    // Reset form for new tag
    resetForm();
  }
}

function resetForm() {
  formData = {
    infractionType: 'foul',
    foulType: 'shooting',
    callCorrectness: 'correct',
    referee: 'John Smith (Crew Chief)',
    notes: '',
    supervisorReview: false
  };

  // Reset UI
  selectInfraction('foul');
  selectFoulType('shooting');
  selectCorrectness('correct');
  document.getElementById('tag-notes').value = '';
  document.getElementById('supervisor-review').checked = false;
}

function updateNavigationButtons() {
  const prevBtn = document.getElementById('prev-event-btn');
  const nextBtn = document.getElementById('next-event-btn');

  prevBtn.style.opacity = currentEventIndex === 0 ? '0.5' : '1';
  nextBtn.style.opacity = currentEventIndex === events.length - 1 ? '0.5' : '1';
}

function navigateEvent(direction) {
  const newIndex = currentEventIndex + direction;

  if (newIndex >= 0 && newIndex < events.length) {
    currentEventIndex = newIndex;
    loadCurrentEvent();
  }
}

async function saveTag() {
  if (!currentEventId) return;

  const saveButton = document.getElementById('save-tag-btn');
  const originalText = saveButton.textContent;

  try {
    // Show saving state
    saveButton.textContent = 'Saving...';
    saveButton.disabled = true;
    saveButton.style.opacity = '0.7';

    const tagData = {
      label: `${formData.infractionType}_${formData.foulType}_${formData.callCorrectness}`,
      notes: formData.notes
    };

    const response = await fetch(`${API_BASE}/events/${currentEventId}/tags`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(tagData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to save tag');
    }

    const savedTag = await response.json();

    // Update local event data
    const currentEvent = events[currentEventIndex];
    if (!currentEvent.tags) currentEvent.tags = [];

    // Replace existing tag or add new one
    const existingIndex = currentEvent.tags.findIndex(tag => tag.label === savedTag.label);
    if (existingIndex >= 0) {
      currentEvent.tags[existingIndex] = savedTag;
    } else {
      currentEvent.tags.push(savedTag);
    }

    // Show success message
    showSuccessMessage('Tag saved successfully!');

    // Auto-advance to next event after a short delay
    setTimeout(() => {
      if (currentEventIndex < events.length - 1) {
        navigateEvent(1);
      } else {
        // All events completed
        showSuccessMessage('All events completed!');
      }
    }, 1500);

  } catch (error) {
    console.error('Error saving tag:', error);
    displayError(`Failed to save tag: ${error.message}`);
  } finally {
    // Reset button state
    saveButton.textContent = originalText;
    saveButton.disabled = false;
    saveButton.style.opacity = '1';
  }
}

function trimVideo(seconds) {
  const video = document.getElementById('event-video');
  const trimAmount = parseInt(seconds);

  try {
    // Check if video is ready and has valid duration
    if (video && video.readyState >= 1 && video.duration && !isNaN(video.duration)) {
      const newTime = video.currentTime + trimAmount;
      video.currentTime = Math.max(0, Math.min(video.duration, newTime));
      updateVideoTime();

      // Visual feedback for trim action
      showTrimFeedback(trimAmount);
    } else {
      console.warn('Video not ready for trimming');
      showVideoStatus('Video not ready');
    }
  } catch (error) {
    console.warn('Trim video error:', error);
    showVideoStatus('Video control error');
  }
}

function showTrimFeedback(seconds) {
  // Create temporary feedback element
  const feedback = document.createElement('div');
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0,0,0,0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    z-index: 1000;
    pointer-events: none;
  `;
  feedback.textContent = `${seconds > 0 ? '+' : ''}${seconds}s`;

  document.body.appendChild(feedback);
  setTimeout(() => feedback.remove(), 1000);
}

function updateVideoTime() {
  const video = document.getElementById('event-video');
  const timeDisplay = document.getElementById('video-time');

  if (video && timeDisplay) {
    try {
      // Check if video is in a valid state
      if (video.readyState >= 1) {
        const current = formatTime(video.currentTime || 0);
        const duration = formatTime(video.duration || 0);
        timeDisplay.textContent = `${current} / ${duration}`;

        // Update video state
        videoState.currentTime = video.currentTime || 0;
        videoState.duration = video.duration || 0;

        // Hide video status overlay when video is playing normally
        if (video.currentTime > 0 && !video.paused) {
          const statusOverlay = document.getElementById('video-status-overlay');
          if (statusOverlay) {
            statusOverlay.style.display = 'none';
          }
        }
      }
    } catch (error) {
      console.warn('Video state error:', error);
      // Don't update if video is in invalid state
    }
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function setupNavigation() {
  // Add logout handler
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('selectedGameId'); // Clean up game selection
        window.location.href = '/login.html';
      }
    });
  }
}

// Video state management
let videoState = {
  isPlaying: false,
  currentTime: 0,
  duration: 0
};

// Video event listeners
document.addEventListener('DOMContentLoaded', function() {
  const video = document.getElementById('event-video');
  if (video) {
    video.addEventListener('timeupdate', updateVideoTime);
    video.addEventListener('loadedmetadata', updateVideoTime);
    video.addEventListener('play', () => videoState.isPlaying = true);
    video.addEventListener('pause', () => videoState.isPlaying = false);
    video.addEventListener('loadeddata', () => {
      videoState.duration = video.duration;
      // Auto-play video when loaded
      video.play().catch(e => console.log('Auto-play prevented:', e));
    });
  }

  // Add keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
});

function handleKeyboardShortcuts(e) {
  const video = document.getElementById('event-video');
  if (!video || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

  switch(e.key) {
    case ' ':
    case 'k':
      e.preventDefault();
      try {
        if (video.readyState >= 1) {
          video.paused ? video.play() : video.pause();
        }
      } catch (error) {
        console.warn('Video play/pause error:', error);
      }
      break;
    case 'ArrowLeft':
      e.preventDefault();
      if (e.shiftKey) {
        navigateEvent(-1);
      } else {
        trimVideo(-5);
      }
      break;
    case 'ArrowRight':
      e.preventDefault();
      if (e.shiftKey) {
        navigateEvent(1);
      } else {
        trimVideo(5);
      }
      break;
    case 'j':
      e.preventDefault();
      trimVideo(-10);
      break;
    case 'l':
      e.preventDefault();
      trimVideo(10);
      break;
    case 'Enter':
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        saveTag();
      }
      break;
    case '1':
    case '2':
    case '3':
    case '4':
      e.preventDefault();
      const infractionTypes = ['turnover', 'foul', 'violation', 'stoppage'];
      const selectedType = infractionTypes[parseInt(e.key) - 1];
      if (selectedType) {
        selectInfraction(selectedType);
      }
      break;
    case 'r':
      e.preventDefault();
      resetForm();
      break;
  }
}

function showVideoStatus(message) {
  // Create or update video status overlay
  let statusOverlay = document.getElementById('video-status-overlay');
  if (!statusOverlay) {
    statusOverlay = document.createElement('div');
    statusOverlay.id = 'video-status-overlay';
    statusOverlay.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0,0,0,0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 100;
      pointer-events: none;
      font-family: Inter, sans-serif;
    `;

    const videoContainer = document.querySelector('.v1_308');
    if (videoContainer) {
      videoContainer.style.position = 'relative';
      videoContainer.appendChild(statusOverlay);
    }
  }

  statusOverlay.textContent = message;
  statusOverlay.style.display = 'block';

  // Hide status after 3 seconds for success messages
  if (message.includes('ready') || message.includes('Click to play')) {
    setTimeout(() => {
      statusOverlay.style.display = 'none';
    }, 3000);
  }
}

function displayError(message) {
  console.error('Error:', message);
  showVideoStatus(`Error: ${message}`);
}

function showSuccessMessage(message) {
  // Simple success display - could be enhanced with a proper toast/modal
  const button = document.getElementById('save-tag-btn');
  const originalText = button.textContent;

  button.textContent = '✓ Saved!';
  button.style.background = 'rgba(16,185,129,1)';

  setTimeout(() => {
    button.textContent = originalText;
    button.style.background = 'rgba(59,130,246,1)';
  }, 2000);
}

// Helper function to format timestamp
function formatTimestamp(timestampMs) {
  const date = new Date(timestampMs);
  const mins = Math.floor(timestampMs / 60000);
  const secs = Math.floor((timestampMs % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}