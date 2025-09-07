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

  initializeApp();

  const urlParams = new URLSearchParams(window.location.search);
  // Load game data if we're on workspace page and have a game ID
  if (window.location.pathname === '/workspace.html' || window.location.pathname === '/') {
    const gameId = urlParams.get('gameId');
    if (gameId) {
      console.log('Loading game data for workspace:', gameId);
      loadGameForWorkspace(gameId);
    } else {
      console.log('No game ID provided, showing default state');
      showDefaultWorkspaceState();
    }
  }
});

function initializeApp() {
  setupEventListeners();
  loadGameFromSelection();
  setupLogout();
}

function setupEventListeners() {
  // Filter controls
  document.getElementById('quarter-filter').addEventListener('change', filterEvents);
  document.getElementById('type-filter').addEventListener('change', filterEvents);

  // Form controls
  setupFormControls();

  // Action buttons
  document.getElementById('annotate-event-btn').addEventListener('click', annotateEvent);
  document.getElementById('next-event-btn').addEventListener('click', nextEvent);
  document.getElementById('view-tags-btn').addEventListener('click', viewEventTags);

  // Video controls
  setupVideoControls();
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
  if (!filteredEvents[currentEventIndex]) return;

  const event = filteredEvents[currentEventIndex];

  // Store the current event context and navigate to detailed evaluation
  localStorage.setItem('currentEventId', event.id);
  localStorage.setItem('currentEventIndex', currentEventIndex.toString());
  localStorage.setItem('selectedGameId', currentGameId);

  window.location.href = '/evaluation.html';
}

function nextEvent() {
  const nextIndex = currentEventIndex + 1;
  if (nextIndex < filteredEvents.length) {
    selectEvent(nextIndex);
  } else {
    alert('You have reached the last event');
  }
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
  if (!video) return;

  if (event.videoUrl) {
    video.src = event.videoUrl;
    video.load();
  } else {
    // Use sample video for demo
    video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
    video.load();
  }
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
    console.log('Fetching game data for:', gameId);

    // Fetch game details
    const gameResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!gameResponse.ok) {
      throw new Error('Failed to fetch games');
    }

    const games = await gameResponse.json();
    const game = games.find(g => g.id === gameId);

    if (!game) {
      throw new Error('Game not found');
    }

    console.log('Found game:', game);

    // Update game info in UI
    updateGameInfo(game);

    // Fetch events for this game
    const eventsResponse = await fetch(`${API_BASE}/games/${gameId}/events`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!eventsResponse.ok) {
      throw new Error('Failed to fetch events');
    }

    const loadedEvents = await eventsResponse.json();
    console.log('Found events:', loadedEvents);

    // Update events list
    updateEventsList(loadedEvents);

    // Set the current game ID globally
    currentGameId = gameId;

  } catch (error) {
    console.error('Error loading game for workspace:', error);
    showError('Failed to load game data');
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

function updateEventsList(events) {
  console.log('Updating events list:', events);

  const eventsList = document.getElementById('events-list');
  if (!eventsList) {
    console.warn('Events list element not found');
    return;
  }

  if (!events || events.length === 0) {
    eventsList.innerHTML = '<div class="no-events">No events found for this game</div>';
    return;
  }

  eventsList.innerHTML = events.map((event, index) => `
    <div class="event-item" onclick="selectEvent(${index})" data-event-id="${event.id}">
      <div class="event-info">
        <div class="event-timestamp">${formatTimestamp(event.timestampMs)}</div>
        <div class="event-type">${event.type || 'Unknown'}</div>
      </div>
      <div class="event-actions">
        <button class="evaluate-btn" onclick="event.stopPropagation(); evaluateEvent('${event.id}')">
          Evaluate
        </button>
      </div>
    </div>
  `).join('');

  // Store events globally for navigation
  window.events = events;
  window.filteredEvents = events;
}


// Global functions for event handlers
window.selectEvent = selectEvent;
window.skipVideo = skipVideo;

function formatTimestamp(timestampMs) {
  if (!timestampMs) return '0:00';
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function selectEvent(index) {
  console.log('Selecting event at index:', index);
  if (window.events && window.events[index]) {
    const event = window.events[index];
    evaluateEvent(event.id);
  }
}

function evaluateEvent(eventId) {
  console.log('Evaluating event:', eventId);
  window.location.href = `/evaluation.html?eventId=${eventId}&gameId=${currentGameId}`;
}