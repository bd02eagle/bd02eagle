
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
    // For demo, we'll load the first game
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
    
    const game = games[0];
    currentGameId = game.id;
    
    // Update game info
    document.getElementById('game-title').textContent = `${game.homeTeam} vs. ${game.awayTeam}`;
    
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
    
    // Load tags for each event
    for (let i = 0; i < events.length; i++) {
      const tagsResponse = await fetch(`${API_BASE}/events/${events[i].id}/tags`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      events[i].tags = tagsResponse.ok ? await tagsResponse.json() : [];
    }
    
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
  
  // Update event info
  document.getElementById('event-number').textContent = `EVENT #${event.id.slice(-6).toUpperCase()}`;
  document.getElementById('event-type').textContent = event.type;
  document.getElementById('event-counter').textContent = `Event ${currentEventIndex + 1} of ${events.length}`;
  
  // Load video
  const video = document.getElementById('event-video');
  if (event.videoUrl) {
    video.src = event.videoUrl;
    video.load();
  }
  
  // Update video timestamp display
  updateVideoTime();
  
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
  
  try {
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
      throw new Error('Failed to save tag');
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
    
    // Auto-advance to next event
    setTimeout(() => {
      if (currentEventIndex < events.length - 1) {
        navigateEvent(1);
      }
    }, 1000);
    
  } catch (error) {
    console.error('Error saving tag:', error);
    displayError('Failed to save tag');
  }
}

function trimVideo(seconds) {
  const video = document.getElementById('event-video');
  const trimAmount = parseInt(seconds);
  
  if (trimAmount < 0) {
    // Trim from beginning
    video.currentTime = Math.max(0, video.currentTime + trimAmount);
  } else {
    // Trim from end (extend current time)
    video.currentTime = Math.min(video.duration, video.currentTime + trimAmount);
  }
  
  updateVideoTime();
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

// Video event listeners
document.addEventListener('DOMContentLoaded', function() {
  const video = document.getElementById('event-video');
  if (video) {
    video.addEventListener('timeupdate', updateVideoTime);
    video.addEventListener('loadedmetadata', updateVideoTime);
  }
});

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
