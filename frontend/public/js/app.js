const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentGameId = null;
let events = [];
let currentEventIndex = 0;
let filteredEvents = [];

// Form state
let evaluationData = {
  infractionType: '',
  rating: '',
  observability: '',
  notes: '',
  flagged: false
};

document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }

  // Check if we're on workspace page first
  if (window.location.pathname === '/workspace.html' || window.location.pathname === '/') {
    console.log('On workspace page, checking for game ID...');

    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    const gameIdFromStorage = localStorage.getItem('selectedGameId');

    console.log('Game ID from URL:', gameIdFromUrl);
    console.log('Game ID from storage:', gameIdFromStorage);

    // Use URL game ID first, then storage, then default
    const gameId = gameIdFromUrl || gameIdFromStorage;

    if (gameId) {
      console.log('Loading game data for workspace:', gameId);
      loadGameForWorkspace(gameId);
    } else {
      console.log('No game ID found, loading default game');
      initializeApp();
    }
  } else {
    // Not on workspace page, use normal initialization
    initializeApp();
  }
});

function initializeApp() {
  setupEventListeners();
  loadGameFromSelection();
  setupLogout();
}

function setupEventListeners() {
  console.log('Setting up event listeners');

  // Use a more robust approach to ensure button exists
  setTimeout(() => {
    const annotateBtn = document.getElementById('annotate-event-btn');
    const nextBtn = document.getElementById('next-event-btn');
    const prevBtn = document.getElementById('prev-event-btn');
    const viewTagsBtn = document.getElementById('view-tags-btn');

    if (annotateBtn) {
      console.log('Setting up annotate button event listener');
      // Clear any existing listeners first
      annotateBtn.removeEventListener('click', annotateEvent);
      annotateBtn.addEventListener('click', function(e) {
        e.preventDefault();
        console.log('Annotate button physically clicked!');
        annotateEvent();
      });

      // Ensure button is enabled
      annotateBtn.disabled = false;
      annotateBtn.style.opacity = '1';
      annotateBtn.style.pointerEvents = 'auto';
    } else {
      console.warn('Annotate button not found during setup');
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', nextEvent);
    }
  }, 500);
}

function setupFormControls() {
  // Infraction type buttons
  document.querySelectorAll('.infraction-buttons .form-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectInfractionType(btn.dataset.value);
    });
  });

  // Observability buttons
  document.querySelectorAll('.observability-buttons .form-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectObservability(btn.dataset.value);
    });
  });

  // Rating radio buttons
  document.querySelectorAll('input[name="rating"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      evaluationData.rating = e.target.value;
    });
  });

  // Notes textarea
  document.getElementById('notes').addEventListener('input', (e) => {
    evaluationData.notes = e.target.value;
  });
}

function setupVideoControls() {
  const video = document.getElementById('event-video');
  if (video) {
    video.addEventListener('loadeddata', updateVideoTime);
    video.addEventListener('timeupdate', updateVideoTime);
  }
}

function setupLogout() {
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('selectedGameId');
        window.location.href = '/login.html';
      }
    });
  }
}

async function loadGameFromSelection() {
  try {
    const selectedGameId = localStorage.getItem('selectedGameId');
    console.log('Loading game with selectedGameId:', selectedGameId);

    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!gamesResponse.ok) {
      if (gamesResponse.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        return;
      }
      throw new Error('Failed to fetch games');
    }

    const games = await gamesResponse.json();
    console.log('Fetched games:', games);

    if (games.length === 0) {
      showError('No games found');
      return;
    }

    let game;
    if (selectedGameId) {
      game = games.find(g => g.id === selectedGameId);
      console.log('Found selected game:', game);
      // Don't clear selection immediately - wait until we confirm it loaded
    }

    if (!game) {
      game = games[0]; // Default to most recent
      console.log('Using fallback game:', game);
    }

    currentGameId = game.id;
    updateGameHeader(game);
    await loadGameEvents(game.id);

    // Clear selection only after successful load
    if (selectedGameId) {
      localStorage.removeItem('selectedGameId');
    }

  } catch (error) {
    console.error('Error loading game:', error);
    showError('Failed to load game data: ' + error.message);
  }
}

function updateGameHeader(game) {
  const gameTitle = document.getElementById('game-title');
  const gameStatus = document.getElementById('game-status');

  console.log('Updating game header with game:', game);

  if (gameTitle) {
    // Handle both old format (homeTeam/awayTeam strings) and new format (homeTeam/awayTeam objects)
    let homeTeam, awayTeam;

    if (typeof game.homeTeam === 'string') {
      homeTeam = game.homeTeam;
      awayTeam = game.awayTeam;
    } else if (game.homeTeam && typeof game.homeTeam === 'object') {
      homeTeam = game.homeTeam.shortName || game.homeTeam.name || 'Home';
      awayTeam = game.awayTeam.shortName || game.awayTeam.name || 'Away';
    } else {
      homeTeam = 'Home';
      awayTeam = 'Away';
    }

    gameTitle.textContent = `Evaluation: ${homeTeam} vs. ${awayTeam}`;
    console.log('Updated game title:', gameTitle.textContent);

    // Show indicator if this game was selected from My Games
    const wasSelected = localStorage.getItem('selectedGameId');
    if (wasSelected) {
      const indicator = document.createElement('span');
      indicator.style.cssText = 'color: #10B981; font-size: 12px; margin-left: 8px;';
      indicator.textContent = '(Selected from My Games)';
      gameTitle.appendChild(indicator);
    }
  }

  if (gameStatus) {
    const status = game.status || 'SCHEDULED';
    gameStatus.textContent = status === 'COMPLETED' ? 'PUBLISHED' : 'IN PROGRESS';
    gameStatus.className = `game-status ${status === 'COMPLETED' ? 'published' : 'in-progress'}`;
  }
}

async function loadGameEvents(gameId) {
  try {
    console.log('Loading events for game:', gameId);

    const eventsResponse = await fetch(`${API_BASE}/games/${gameId}/events`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!eventsResponse.ok) {
      console.error('Events response not ok:', eventsResponse.status, eventsResponse.statusText);
      throw new Error('Failed to fetch events');
    }

    events = await eventsResponse.json();
    console.log('Loaded events:', events.length, events);

    if (events.length === 0) {
      showError('No events found for this game');
      return;
    }

    // Load tags for each event
    for (let i = 0; i < events.length; i++) {
      try {
        const tagsResponse = await fetch(`${API_BASE}/events/${events[i].id}/tags`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });

        if (tagsResponse.ok) {
          events[i].tags = await tagsResponse.json();
        } else {
          events[i].tags = [];
        }
      } catch (error) {
        console.warn(`Failed to load tags for event ${events[i].id}:`, error);
        events[i].tags = [];
      }
    }

    filteredEvents = [...events];
    renderEventsList();

    if (events.length > 0) {
      selectEvent(0);
    }

    updateProgress();

  } catch (error) {
    console.error('Error loading events:', error);
    showError('Failed to load events');
  }
}

function renderEventsList() {
  const eventsList = document.getElementById('events-list');

  if (!eventsList) {
    console.error('Events list element not found');
    return;
  }

  console.log('Rendering events list with', filteredEvents.length, 'events');

  if (filteredEvents.length === 0) {
    eventsList.innerHTML = '<div class="loading">No events found</div>';
    return;
  }

  eventsList.innerHTML = filteredEvents.map((event, index) => {
    const timeStr = formatEventTime(event.timestampMs || 0);
    const hasTag = event.tags && event.tags.length > 0;
    const tagInfo = hasTag ? event.tags[0] : null;

    let tagClass = 'untagged';
    let tagText = 'Untagged';

    if (tagInfo) {
      if (tagInfo.label.toLowerCase().includes('foul')) {
        tagClass = 'foul';
        tagText = 'Foul';
      } else if (tagInfo.label.toLowerCase().includes('violation')) {
        tagClass = 'violation';
        tagText = 'Violation';
      } else if (tagInfo.label.toLowerCase().includes('turnover')) {
        tagClass = 'turnover';
        tagText = 'Turnover';
      } else {
        tagClass = 'challenge';
        tagText = 'Challenge';
      }
    }

    return `
      <div class="event-item ${currentEventIndex === index ? 'active' : ''}" onclick="selectEvent(${index})">
        <div class="event-time">Q4 - ${timeStr}</div>
        <div class="event-description">${event.type || 'Unknown Event'}</div>
        <div class="event-id">Event #${String(index + 1).padStart(6, '0')}
          <span class="event-tag ${tagClass}">${tagText}</span>
        </div>
      </div>
    `;
  }).join('');

  console.log('Rendered events list HTML');
}

function selectEvent(index) {
  if (index < 0 || index >= filteredEvents.length) return;

  currentEventIndex = index;
  const event = filteredEvents[index];

  // Update active event in list
  document.querySelectorAll('.event-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  // Update event details
  updateEventDetails(event, index);

  // Load existing tag data if available
  loadExistingEvaluation(event);

  // Load video
  loadEventVideo(event);
}

function updateEventDetails(event, index) {
  const eventNumber = document.getElementById('event-number');
  const eventType = document.getElementById('event-type');

  if (eventNumber) {
    eventNumber.textContent = `EVENT #${String(index + 1).padStart(6, '0')}`;
  }

  if (eventType) {
    eventType.textContent = event.type;
  }
}

function loadExistingEvaluation(event) {
  // Update event summary panel
  updateEventSummary(event);
}

function updateEventSummary(event) {
  // Update event details
  const eventTimeDetail = document.getElementById('event-time-detail');
  const eventTypeDetail = document.getElementById('event-type-detail');
  const eventStatus = document.getElementById('event-status');
  const eventTagsList = document.getElementById('event-tags-list');

  if (eventTimeDetail) {
    eventTimeDetail.textContent = `Q4 ${formatEventTime(event.timestampMs)}`;
  }

  if (eventTypeDetail) {
    eventTypeDetail.textContent = event.type;
  }

  if (eventStatus) {
    const hasTag = event.tags && event.tags.length > 0;
    eventStatus.textContent = hasTag ? 'Tagged' : 'Untagged';
    eventStatus.style.color = hasTag ? '#059669' : '#dc2626';
  }

  if (eventTagsList) {
    if (event.tags && event.tags.length > 0) {
      eventTagsList.innerHTML = event.tags.map(tag => 
        `<div class="tag-chip">${tag.label}</div>`
      ).join('');
    } else {
      eventTagsList.innerHTML = '<div class="no-tags" style="font-size: 12px; color: #64748b;">No tags available</div>';
    }
  }
}

function selectInfractionType(type) {
  evaluationData.infractionType = type;

  document.querySelectorAll('.infraction-buttons .form-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === type);
  });
}

function selectObservability(type) {
  evaluationData.observability = type;

  document.querySelectorAll('.observability-buttons .form-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === type);
  });
}

function toggleFlag() {
  evaluationData.flagged = !evaluationData.flagged;
  updateFlagButton(evaluationData.flagged);
}

function updateFlagButton(flagged) {
  const flagBtn = document.getElementById('flag-btn');
  if (flagBtn) {
    flagBtn.textContent = flagged ? '🚩 Flagged' : '🚩 Flag for Review';
    flagBtn.style.background = flagged ? '#fef2f2' : 'white';
  }
}

function annotateEvent() {
  console.log('=== ANNOTATE EVENT CLICKED ===');
  console.log('Current event index:', currentEventIndex);
  console.log('Filtered events length:', filteredEvents.length);
  console.log('Current game ID:', currentGameId);

  if (!filteredEvents || filteredEvents.length === 0) {
    console.error('No events available for annotation');
    alert('No events loaded. Please refresh the page.');
    return;
  }

  if (currentEventIndex < 0 || currentEventIndex >= filteredEvents.length) {
    console.error('Invalid event index:', currentEventIndex);
    alert('Please select a valid event first');
    return;
  }

  const event = filteredEvents[currentEventIndex];
  console.log('Navigating to evaluation for event:', event);

  if (!event || !event.id) {
    console.error('Invalid event data:', event);
    alert('Invalid event selected. Please try again.');
    return;
  }

  // Store context for the evaluation page
  localStorage.setItem('selectedGameId', currentGameId);
  localStorage.setItem('selectedEventId', event.id);
  localStorage.setItem('selectedEventIndex', currentEventIndex.toString());

  console.log('Stored context for evaluation:');
  console.log('- gameId:', currentGameId);
  console.log('- eventId:', event.id);
  console.log('- eventIndex:', currentEventIndex);

  // Navigate to evaluation page with URL parameters for immediate access
  const evaluationUrl = `/evaluation.html?gameId=${currentGameId}&eventId=${event.id}&eventIndex=${currentEventIndex}`;
  console.log('Navigating to evaluation page:', evaluationUrl);

  window.location.href = evaluationUrl;
}

function annotateSpecificEvent(eventIndex) {
  console.log('=== ANNOTATE EVENT CLICKED ===');
  console.log('Event index:', eventIndex);
  console.log('Total filtered events:', filteredEvents.length);

  if (!filteredEvents[eventIndex]) {
    console.error('No event found at index:', eventIndex);
    alert('Event not found. Please try again.');
    return;
  }

  const event = filteredEvents[eventIndex];
  console.log('Event to annotate:', event.type, 'ID:', event.id);

  // Visual feedback - show button was clicked
  const clickedButton = event.target || document.querySelector(`button[onclick*="annotateSpecificEvent(${eventIndex})"]`);
  if (clickedButton) {
    clickedButton.textContent = 'Opening...';
    clickedButton.style.background = '#059669';
  }

  // Store the specific event context and navigate to detailed evaluation
  localStorage.setItem('currentEventId', event.id);
  localStorage.setItem('currentEventIndex', eventIndex.toString());
  localStorage.setItem('selectedGameId', currentGameId);

  console.log('Stored in localStorage:');
  console.log('- currentEventId:', event.id);
  console.log('- currentEventIndex:', eventIndex.toString());
  console.log('- selectedGameId:', currentGameId);

  // Navigate to evaluation page with URL parameters for immediate access
  const evaluationUrl = `/evaluation.html?eventId=${event.id}&gameId=${currentGameId}&eventIndex=${eventIndex}`;
  console.log('Navigating to:', evaluationUrl);

  // Small delay to show visual feedback
  setTimeout(() => {
    window.location.href = evaluationUrl;
  }, 200);
}

function nextEvent() {
  if (filteredEvents.length === 0) return;

  const nextIndex = currentEventIndex + 1;
  if (nextIndex < filteredEvents.length) {
    currentEventIndex = nextIndex;
  } else {
    // Cycle back to the first event
    currentEventIndex = 0;
  }

  console.log('Next event - moving to index:', currentEventIndex);

  // Use selectEvent to properly update everything
  selectEvent(currentEventIndex);
}



function viewEventTags() {
  if (!filteredEvents[currentEventIndex]) return;

  const event = filteredEvents[currentEventIndex];
  if (event.tags && event.tags.length > 0) {
    const tagsList = event.tags.map(tag => `• ${tag.label}${tag.notes ? ': ' + tag.notes : ''}`).join('\n');
    alert(`Tags for this event:\n\n${tagsList}`);
  } else {
    alert('No tags found for this event');
  }
}

function loadEventVideo(event) {
  const video = document.getElementById('event-video');
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  console.log('Loading video for event:', event.type, 'URL:', event.videoUrl);

  if (event.videoUrl) {
    video.src = event.videoUrl;
    video.load();
  } else {
    // Use sample video for demo
    console.log('No video URL, using sample video');
    video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    video.load();
  }

  // Add error handling
  video.onerror = function() {
    console.error('Video failed to load:', event.videoUrl);
  };

  video.onloadeddata = function() {
    console.log('Video loaded successfully');
  };
}

function updateVideoTime() {
  const video = document.getElementById('event-video');
  const timeDisplay = document.getElementById('video-time');

  if (video && timeDisplay && video.duration) {
    const current = formatTime(video.currentTime || 0);
    const duration = formatTime(video.duration || 0);
    timeDisplay.textContent = `${current} / ${duration}`;
  }
}

function skipVideo(seconds) {
  const video = document.getElementById('event-video');
  if (video && video.duration) {
    video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
  }
}

function filterEvents() {
  const quarterFilter = document.getElementById('quarter-filter').value;
  const typeFilter = document.getElementById('type-filter').value;

  filteredEvents = events.filter(event => {
    const quarterMatch = !quarterFilter || event.quarter === quarterFilter;
    const typeMatch = !typeFilter || event.type.toLowerCase().includes(typeFilter.toLowerCase());

    return quarterMatch && typeMatch;
  });

  renderEventsList();

  // Select first event if available
  if (filteredEvents.length > 0) {
    selectEvent(0);
  }
}

function updateProgress() {
  const taggedCount = events.filter(event => event.tags && event.tags.length > 0).length;
  const totalCount = events.length;
  const percentage = totalCount > 0 ? Math.round((taggedCount / totalCount) * 100) : 0;

  const progressCount = document.getElementById('progress-count');
  const progressFill = document.getElementById('progress-fill');

  if (progressCount) {
    progressCount.textContent = `${taggedCount} of ${totalCount} tagged`;
  }

  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }
}

// Utility functions
function formatEventTime(timestampMs) {
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else {
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}

function showError(message) {
  const eventsList = document.getElementById('events-list');
  if (eventsList) {
    eventsList.innerHTML = `<div class="error" style="color: #dc2626; padding: 20px; text-align: center;">${message}</div>`;
  }

  // Also show error in game title if loading failed
  const gameTitle = document.getElementById('game-title');
  if (gameTitle && message.includes('game data')) {
    gameTitle.textContent = 'Error loading game data';
    gameTitle.style.color = '#dc2626';
  }
}

// --- Workspace specific functions ---

function showDefaultWorkspaceState() {
  console.log('Showing default workspace state');
  document.getElementById('game-title').textContent = 'No game selected';
  document.getElementById('events-list').innerHTML = '<div class="loading">Please select a game from "My Games"</div>';
}

async function loadGameForWorkspace(gameId) {
  try {
    console.log('=== Loading game for workspace ===');
    console.log('Requested game ID:', gameId);
    console.log('Auth token present:', !!authToken);

    // Fetch game details
    const gameResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('Games response status:', gameResponse.status);

    if (!gameResponse.ok) {
      if (gameResponse.status === 401) {
        console.error('Unauthorized - redirecting to login');
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        return;
      }
      throw new Error(`Failed to fetch games: ${gameResponse.status}`);
    }

    const games = await gameResponse.json();
    console.log('Total games fetched:', games.length);
    console.log('Games:', games.map(g => ({ id: g.id, homeTeam: g.homeTeam, awayTeam: g.awayTeam })));

    const game = games.find(g => g.id === gameId);
    console.log('Found matching game:', !!game);

    if (!game) {
      console.error('Game not found with ID:', gameId);
      console.log('Available game IDs:', games.map(g => g.id));
      throw new Error(`Game not found: ${gameId}`);
    }

    console.log('Selected game details:', game);

    // Clear the storage after successful load
    localStorage.removeItem('selectedGameId');

    // Update game info in UI
    updateGameInfo(game);

    // Fetch events for this game
    console.log('Fetching events for game:', gameId);
    const eventsResponse = await fetch(`${API_BASE}/games/${gameId}/events`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    console.log('Events response status:', eventsResponse.status);

    if (!eventsResponse.ok) {
      throw new Error(`Failed to fetch events: ${eventsResponse.status}`);
    }

    const loadedEvents = await eventsResponse.json();
    console.log('Loaded events count:', loadedEvents.length);

    // Set up the workspace with this game
    currentGameId = gameId;
    events = loadedEvents;
    filteredEvents = [...loadedEvents];

    // Update UI
    updateEventsList(loadedEvents);
    renderEventsList();

    // For workspace, properly select the first event
    if (loadedEvents.length > 0) {
      console.log('Auto-selecting first event');
      currentEventIndex = 0;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        selectEvent(0);

        // Enable the annotate button after selection
        const annotateBtn = document.getElementById('annotate-event-btn');
        if (annotateBtn) {
          console.log('Enabling annotate button');
          annotateBtn.disabled = false;
          annotateBtn.style.opacity = '1';
          annotateBtn.style.pointerEvents = 'auto';
          annotateBtn.style.cursor = 'pointer';

          // Make sure the event listener is attached
          annotateBtn.removeEventListener('click', annotateEvent);
          annotateBtn.addEventListener('click', annotateEvent);
        } else {
          console.error('Annotate button not found!');
        }

        // Also ensure the first event is visually selected
        document.querySelectorAll('.event-item').forEach((item, i) => {
          item.classList.toggle('active', i === 0);
        });
      }, 100);
    }

    console.log('=== Game loading completed successfully ===');

  } catch (error) {
    console.error('=== Error loading game for workspace ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    showError(`Failed to load game data: ${error.message}`);
  }
}

function updateGameInfo(game) {
  console.log('Updating game info:', game);

  if (game) {
    currentGameId = game.id;

    // Update game title and details
    const gameTitle = document.getElementById('game-title');
    if (gameTitle) {
      // Handle both old format (awayTeam/homeTeam strings) and new format (team objects)
      if (typeof game.awayTeam === 'string') {
        gameTitle.textContent = `${game.awayTeam} @ ${game.homeTeam}`;
      } else if (game.awayTeam && game.homeTeam) {
        gameTitle.textContent = `${game.awayTeam.name} @ ${game.homeTeam.name}`;
      } else {
        gameTitle.textContent = 'Game Details';
      }
    }

    // Update game details if elements exist
    const gameDate = document.getElementById('game-date');
    if (gameDate && game.date) {
      const date = new Date(game.date);
      gameDate.textContent = date.toLocaleDateString();
    }

    const gameVenue = document.getElementById('game-venue');
    if (gameVenue && game.venue) {
      gameVenue.textContent = game.venue;
    }

    // Update game status
    const gameStatus = document.getElementById('game-status');
    if (gameStatus && game.status) {
      gameStatus.textContent = game.status;
    }
  }
}

function updateEventsList(loadedEvents) {
  console.log('Updating events list:', loadedEvents);

  const eventsList = document.getElementById('events-list');
  if (!eventsList) {
    console.warn('Events list element not found');
    return;
  }

  if (!loadedEvents || loadedEvents.length === 0) {
    eventsList.innerHTML = '<div class="no-events">No events found for this game</div>';
    return;
  }

  // Set global events arrays
  events = loadedEvents;
  filteredEvents = [...loadedEvents];

  const isWorkspacePage = window.location.pathname === '/workspace.html' || window.location.pathname === '/';

  eventsList.innerHTML = loadedEvents.map((event, index) => `
    <div class="event-item ${index === 0 ? 'active' : ''}" onclick="selectEvent(${index})" data-event-id="${event.id}">
      <div class="event-info">
        <div class="event-timestamp">${formatTimestamp(event.timestampMs)}</div>
        <div class="event-type">${event.type || 'Unknown'}</div>
      </div>
      <div class="event-actions">
        <button class="evaluate-btn" onclick="event.stopPropagation(); annotateSpecificEvent(${index})">
          ${isWorkspacePage ? 'Annotate Event' : 'View Details'}
        </button>
      </div>
    </div>
  `).join('');

  // Store events globally for navigation
  window.events = loadedEvents;
  window.filteredEvents = loadedEvents;
}


// Global functions for event handlers
window.selectEvent = selectEvent;
window.skipVideo = skipVideo;
window.annotateEvent = annotateEvent;
window.testAnnotate = function() {
  console.log('=== MANUAL TEST ANNOTATE ===');
  console.log('Current event index:', currentEventIndex);
  console.log('Filtered events length:', filteredEvents.length);
  console.log('Current game ID:', currentGameId);
  annotateEvent();
};

function formatTimestamp(timestampMs) {
  if (!timestampMs) return '0:00';
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function selectEvent(index) {
  console.log('Selecting event at index:', index, 'Total events:', filteredEvents.length);

  if (index < 0 || index >= filteredEvents.length || !filteredEvents[index]) {
    console.warn('Invalid event index:', index);
    return;
  }

  const event = filteredEvents[index];
  currentEventIndex = index;

  console.log('Selected event:', event.type, 'at', formatEventTime(event.timestampMs));

  // Update active event in list
  document.querySelectorAll('.event-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });

  // Update event details
  updateEventDetails(event, index);

  // Load existing evaluation data
  loadExistingEvaluation(event);

  // Load video
  loadEventVideo(event);

  // Check if we're on workspace page - if so, don't redirect on click
  const isWorkspacePage = window.location.pathname === '/workspace.html' || window.location.pathname === '/';

  if (!isWorkspacePage) {
    // On evaluation page, we might want additional behavior
    console.log('Event selected on evaluation page');
  }
}

// Removed evaluateEvent function - using annotateEvent instead