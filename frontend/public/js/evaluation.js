
const API_BASE = 'http://0.0.0.0:3000/api';
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
  loadCurrentGame();
});

function initializeEventListeners() {
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
    
    // Load the SC vs CONN game for demonstration
    const game = games.find(g => 
      g.homeTeam.shortName === 'SC' && g.awayTeam.shortName === 'CONN'
    ) || games[0];
    
    currentGameId = game.id;
    
    // Update game info with proper team names
    document.getElementById('game-title').textContent = `${game.homeTeam.shortName} vs. ${game.awayTeam.shortName}`;
    
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
  
  // Load video with loading state
  const video = document.getElementById('event-video');
  if (event.videoUrl) {
    video.src = event.videoUrl;
    video.load();
    
    // Show loading state
    video.addEventListener('loadstart', () => {
      console.log('Loading video:', event.videoUrl);
    });
    
    video.addEventListener('canplay', () => {
      console.log('Video ready to play');
    });
    
    video.addEventListener('error', (e) => {
      console.error('Video error:', e);
      displayError('Failed to load video');
    });
  }
  
  // Update video timestamp display
  updateVideoTime();
  
  // Load existing tags if any
  loadExistingTags(event);
  
  // Update navigation buttons
  updateNavigationButtons();
  
  // Auto-play video when loaded (if supported)
  setTimeout(() => {
    if (video.readyState >= 3) {
      video.play().catch(e => console.log('Auto-play prevented:', e));
    }
  }, 100);
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
  
  if (video.duration) {
    const newTime = video.currentTime + trimAmount;
    video.currentTime = Math.max(0, Math.min(video.duration, newTime));
    updateVideoTime();
    
    // Visual feedback for trim action
    showTrimFeedback(trimAmount);
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
    const current = formatTime(video.currentTime || 0);
    const duration = formatTime(video.duration || 0);
    timeDisplay.textContent = `${current} / ${duration}`;
  }
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
      video.paused ? video.play() : video.pause();
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

function displayError(message) {
  // Simple error display - could be enhanced with a proper toast/modal
  alert(`Error: ${message}`);
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
