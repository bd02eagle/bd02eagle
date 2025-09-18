
// API Configuration
const API_BASE = '/api';

// Application State
let authToken = localStorage.getItem('authToken');
let currentStep = 1;
let gameData = {
  gameDetails: {},
  homeTeam: {},
  awayTeam: {},
  events: []
};
let allTeams = [];
let currentEditingEventIndex = -1;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }

  initializeEventListeners();
  loadExistingTeams();
  updateStepVisibility();
});

function initializeEventListeners() {
  // Navigation buttons
  document.getElementById('next-btn').addEventListener('click', nextStep);
  document.getElementById('prev-btn').addEventListener('click', prevStep);
  
  // Header buttons
  document.getElementById('save-draft-btn').addEventListener('click', saveDraft);
  document.getElementById('submit-game-btn').addEventListener('click', submitGame);
  
  // Event management
  document.getElementById('add-event-btn').addEventListener('click', () => openEventModal());
  document.getElementById('bulk-import-btn').addEventListener('click', () => openCSVModal());
  
  // Modal controls
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  
  document.getElementById('save-event-btn').addEventListener('click', saveEvent);
  document.getElementById('cancel-event-btn').addEventListener('click', closeModals);
  document.getElementById('import-csv-btn').addEventListener('click', importCSV);
  document.getElementById('cancel-csv-btn').addEventListener('click', closeModals);
  
  // Team search functionality
  document.getElementById('home-team-search').addEventListener('input', (e) => {
    searchTeams(e.target.value, 'home');
  });
  
  document.getElementById('away-team-search').addEventListener('input', (e) => {
    searchTeams(e.target.value, 'away');
  });
  
  // Form validation
  document.querySelectorAll('input, select, textarea').forEach(input => {
    input.addEventListener('change', validateCurrentStep);
  });
}

async function loadExistingTeams() {
  try {
    const response = await fetch(`${API_BASE}/teams`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (response.ok) {
      allTeams = await response.json();
    } else {
      // If no teams endpoint exists, we'll work without suggestions
      allTeams = [];
    }
  } catch (error) {
    console.error('Error loading teams:', error);
    allTeams = [];
  }
}

function searchTeams(query, teamType) {
  const suggestionsDiv = document.getElementById(`${teamType}-team-suggestions`);
  
  if (!query || query.length < 2) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  const matches = allTeams.filter(team => 
    team.name.toLowerCase().includes(query.toLowerCase()) ||
    (team.shortName && team.shortName.toLowerCase().includes(query.toLowerCase()))
  );
  
  if (matches.length === 0) {
    suggestionsDiv.style.display = 'none';
    return;
  }
  
  suggestionsDiv.innerHTML = matches.map(team => `
    <div class="suggestion-item" onclick="selectTeam('${teamType}', ${JSON.stringify(team).replace(/"/g, '&quot;')})">
      <strong>${escapeHtml(team.name)}</strong>
      ${team.shortName ? `<br><small>${escapeHtml(team.shortName)}</small>` : ''}
    </div>
  `).join('');
  
  suggestionsDiv.style.display = 'block';
}

function selectTeam(teamType, team) {
  const prefix = teamType === 'home' ? 'home' : 'away';
  
  document.getElementById(`${prefix}-team-name`).value = team.name;
  document.getElementById(`${prefix}-team-short`).value = team.shortName || '';
  document.getElementById(`${prefix}-team-primary`).value = team.primaryColor || '#000000';
  document.getElementById(`${prefix}-team-secondary`).value = team.secondaryColor || '#FFFFFF';
  
  document.getElementById(`${prefix}-team-suggestions`).style.display = 'none';
  
  // Store team ID if it exists
  gameData[`${teamType}Team`].existingId = team.id;
}

function nextStep() {
  if (!validateCurrentStep()) {
    return;
  }
  
  saveCurrentStepData();
  
  if (currentStep < 4) {
    currentStep++;
    updateStepVisibility();
  } else {
    // Final step - submit the game
    submitGame();
  }
}

function prevStep() {
  saveCurrentStepData();
  
  if (currentStep > 1) {
    currentStep--;
    updateStepVisibility();
  }
}

function updateStepVisibility() {
  // Update progress indicator
  document.querySelectorAll('.progress-step').forEach((step, index) => {
    const stepNumber = index + 1;
    step.classList.toggle('active', stepNumber === currentStep);
    step.classList.toggle('completed', stepNumber < currentStep);
  });
  
  // Update form steps
  document.querySelectorAll('.form-step').forEach((step, index) => {
    const stepNumber = index + 1;
    step.classList.toggle('active', stepNumber === currentStep);
  });
  
  // Update navigation buttons
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  
  prevBtn.style.display = currentStep === 1 ? 'none' : 'block';
  nextBtn.textContent = currentStep === 4 ? 'Submit Game' : 'Next';
  
  // Load step-specific content
  if (currentStep === 4) {
    populateReviewStep();
  }
}

function validateCurrentStep() {
  const currentStepDiv = document.querySelector(`.form-step[data-step="${currentStep}"]`);
  const requiredInputs = currentStepDiv.querySelectorAll('input[required], select[required]');
  
  for (const input of requiredInputs) {
    if (!input.value.trim()) {
      input.focus();
      showError(`Please fill in the required field: ${input.previousElementSibling.textContent}`);
      return false;
    }
  }
  
  // Step-specific validation
  if (currentStep === 1) {
    const dateInput = document.getElementById('game-date');
    if (!dateInput.value) {
      showError('Please select a game date and time');
      return false;
    }
  }
  
  if (currentStep === 2) {
    const homeTeamName = document.getElementById('home-team-name').value.trim();
    const awayTeamName = document.getElementById('away-team-name').value.trim();
    
    if (!homeTeamName || !awayTeamName) {
      showError('Please enter both home and away team names');
      return false;
    }
    
    if (homeTeamName === awayTeamName) {
      showError('Home and away teams cannot be the same');
      return false;
    }
  }
  
  return true;
}

function saveCurrentStepData() {
  if (currentStep === 1) {
    gameData.gameDetails = {
      date: document.getElementById('game-date').value,
      venue: document.getElementById('venue').value,
      season: document.getElementById('season').value,
      gameType: document.getElementById('game-type').value,
      status: document.getElementById('status').value,
      thumbnail: document.getElementById('thumbnail').value
    };
  } else if (currentStep === 2) {
    gameData.homeTeam = {
      name: document.getElementById('home-team-name').value,
      shortName: document.getElementById('home-team-short').value,
      primaryColor: document.getElementById('home-team-primary').value,
      secondaryColor: document.getElementById('home-team-secondary').value,
      existingId: gameData.homeTeam.existingId
    };
    
    gameData.awayTeam = {
      name: document.getElementById('away-team-name').value,
      shortName: document.getElementById('away-team-short').value,
      primaryColor: document.getElementById('away-team-primary').value,
      secondaryColor: document.getElementById('away-team-secondary').value,
      existingId: gameData.awayTeam.existingId
    };
    
    const homeScore = document.getElementById('home-score').value;
    const awayScore = document.getElementById('away-score').value;
    
    if (homeScore) gameData.gameDetails.homeScore = parseInt(homeScore);
    if (awayScore) gameData.gameDetails.awayScore = parseInt(awayScore);
  }
}

function openEventModal(eventIndex = -1) {
  currentEditingEventIndex = eventIndex;
  
  if (eventIndex >= 0) {
    // Edit existing event
    const event = gameData.events[eventIndex];
    document.getElementById('event-type').value = event.type;
    document.getElementById('event-time').value = event.timeDisplay;
    document.getElementById('event-video').value = event.videoUrl;
    document.getElementById('event-notes').value = event.notes || '';
  } else {
    // New event
    document.getElementById('event-type').value = '';
    document.getElementById('event-time').value = '';
    document.getElementById('event-video').value = '';
    document.getElementById('event-notes').value = '';
  }
  
  document.getElementById('event-modal').style.display = 'flex';
}

function saveEvent() {
  const type = document.getElementById('event-type').value;
  const timeDisplay = document.getElementById('event-time').value;
  const videoUrl = document.getElementById('event-video').value;
  const notes = document.getElementById('event-notes').value;
  
  if (!type || !timeDisplay || !videoUrl) {
    showError('Please fill in all required event fields');
    return;
  }
  
  // Convert time to milliseconds
  const timestampMs = convertTimeToMs(timeDisplay);
  if (timestampMs === null) {
    showError('Please enter time in format MM:SS (e.g., 15:30)');
    return;
  }
  
  const eventData = {
    type,
    timeDisplay,
    timestampMs,
    videoUrl,
    notes
  };
  
  if (currentEditingEventIndex >= 0) {
    gameData.events[currentEditingEventIndex] = eventData;
  } else {
    gameData.events.push(eventData);
  }
  
  renderEventsList();
  closeModals();
}

function convertTimeToMs(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  
  const minutes = parseInt(match[1]);
  const seconds = parseInt(match[2]);
  
  return (minutes * 60 + seconds) * 1000;
}

function renderEventsList() {
  const container = document.getElementById('events-list');
  
  if (gameData.events.length === 0) {
    container.innerHTML = '<div class="empty-state">No events added yet. Click "Add Event" to get started.</div>';
    return;
  }
  
  container.innerHTML = gameData.events.map((event, index) => `
    <div class="event-item">
      <div class="event-details">
        <div class="event-type">${escapeHtml(event.type)}</div>
        <div class="event-info">Time: ${escapeHtml(event.timeDisplay)} | Video: ${escapeHtml(event.videoUrl)}</div>
        ${event.notes ? `<div class="event-info">Notes: ${escapeHtml(event.notes)}</div>` : ''}
      </div>
      <div class="event-actions">
        <button class="edit-event-btn" onclick="openEventModal(${index})">Edit</button>
        <button class="delete-event-btn" onclick="deleteEvent(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

function deleteEvent(index) {
  if (confirm('Are you sure you want to delete this event?')) {
    gameData.events.splice(index, 1);
    renderEventsList();
  }
}

function openCSVModal() {
  document.getElementById('csv-modal').style.display = 'flex';
}

function importCSV() {
  const fileInput = document.getElementById('csv-file');
  const file = fileInput.files[0];
  
  if (!file) {
    showError('Please select a CSV file');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const csv = e.target.result;
      const lines = csv.split('\n').filter(line => line.trim());
      let importedCount = 0;
      
      // Skip header row if it exists
      const startIndex = lines[0].toLowerCase().includes('event_type') ? 1 : 0;
      
      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(',').map(part => part.trim().replace(/"/g, ''));
        
        if (parts.length >= 3) {
          const [type, time, videoUrl, notes = ''] = parts;
          const timestampMs = convertTimeToMs(time);
          
          if (timestampMs !== null) {
            gameData.events.push({
              type: type.toUpperCase().replace(/\s+/g, '_'),
              timeDisplay: time,
              timestampMs,
              videoUrl,
              notes
            });
            importedCount++;
          }
        }
      }
      
      renderEventsList();
      closeModals();
      showSuccess(`Successfully imported ${importedCount} events`);
      
    } catch (error) {
      console.error('Error parsing CSV:', error);
      showError('Error parsing CSV file. Please check the format.');
    }
  };
  
  reader.readAsText(file);
}

function populateReviewStep() {
  const reviewContent = document.getElementById('review-content');
  
  reviewContent.innerHTML = `
    <div class="review-section">
      <h3>Game Details</h3>
      <div class="review-item">
        <span class="review-label">Date:</span>
        <span class="review-value">${formatDate(gameData.gameDetails.date)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Venue:</span>
        <span class="review-value">${escapeHtml(gameData.gameDetails.venue || 'Not specified')}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Season:</span>
        <span class="review-value">${escapeHtml(gameData.gameDetails.season)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Game Type:</span>
        <span class="review-value">${escapeHtml(gameData.gameDetails.gameType)}</span>
      </div>
      <div class="review-item">
        <span class="review-label">Status:</span>
        <span class="review-value">${escapeHtml(gameData.gameDetails.status)}</span>
      </div>
    </div>
    
    <div class="review-section">
      <h3>Teams</h3>
      <div class="review-item">
        <span class="review-label">Home Team:</span>
        <span class="review-value">${escapeHtml(gameData.homeTeam.name)} (${escapeHtml(gameData.homeTeam.shortName)})</span>
      </div>
      <div class="review-item">
        <span class="review-label">Away Team:</span>
        <span class="review-value">${escapeHtml(gameData.awayTeam.name)} (${escapeHtml(gameData.awayTeam.shortName)})</span>
      </div>
      ${gameData.gameDetails.homeScore !== undefined ? `
        <div class="review-item">
          <span class="review-label">Final Score:</span>
          <span class="review-value">${gameData.homeTeam.shortName} ${gameData.gameDetails.homeScore} - ${gameData.awayTeam.shortName} ${gameData.gameDetails.awayScore}</span>
        </div>
      ` : ''}
    </div>
    
    <div class="review-section">
      <h3>Events</h3>
      <div class="review-item">
        <span class="review-label">Total Events:</span>
        <span class="review-value">${gameData.events.length}</span>
      </div>
      ${gameData.events.length > 0 ? `
        <div style="margin-top: 12px;">
          ${gameData.events.map(event => `
            <div style="margin-bottom: 8px; font-size: 13px; color: #6B7280;">
              ${escapeHtml(event.type)} at ${escapeHtml(event.timeDisplay)}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

async function submitGame() {
  if (!validateCurrentStep()) {
    return;
  }
  
  saveCurrentStepData();
  
  try {
    showLoading('Submitting game data...');
    
    // Create or get team IDs
    const homeTeamId = await createOrGetTeam(gameData.homeTeam);
    const awayTeamId = await createOrGetTeam(gameData.awayTeam);
    
    // Create game
    const gamePayload = {
      date: new Date(gameData.gameDetails.date).toISOString(),
      homeTeamId,
      awayTeamId,
      status: gameData.gameDetails.status,
      venue: gameData.gameDetails.venue,
      season: gameData.gameDetails.season,
      gameType: gameData.gameDetails.gameType,
      thumbnail: gameData.gameDetails.thumbnail,
      homeScore: gameData.gameDetails.homeScore,
      awayScore: gameData.gameDetails.awayScore
    };
    
    const gameResponse = await fetch(`${API_BASE}/games`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gamePayload)
    });
    
    if (!gameResponse.ok) {
      throw new Error('Failed to create game');
    }
    
    const game = await gameResponse.json();
    
    // Create events
    for (const event of gameData.events) {
      const eventPayload = {
        gameId: game.id,
        timestampMs: event.timestampMs,
        videoUrl: event.videoUrl,
        type: event.type
      };
      
      const eventResponse = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventPayload)
      });
      
      if (!eventResponse.ok) {
        console.warn('Failed to create event:', event);
      }
    }
    
    showSuccess('Game created successfully!');
    
    // Redirect to my games page after a delay
    setTimeout(() => {
      window.location.href = '/my-games.html';
    }, 2000);
    
  } catch (error) {
    console.error('Error submitting game:', error);
    showError('Failed to create game. Please try again.');
  }
}

async function createOrGetTeam(teamData) {
  if (teamData.existingId) {
    return teamData.existingId;
  }
  
  try {
    const payload = {
      name: teamData.name,
      shortName: teamData.shortName,
      primaryColor: teamData.primaryColor,
      secondaryColor: teamData.secondaryColor
    };
    
    const response = await fetch(`${API_BASE}/teams`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error('Failed to create team');
    }
    
    const team = await response.json();
    return team.id;
    
  } catch (error) {
    console.error('Error creating team:', error);
    throw error;
  }
}

function saveDraft() {
  saveCurrentStepData();
  localStorage.setItem('gameInputDraft', JSON.stringify(gameData));
  showSuccess('Draft saved successfully!');
}

function closeModals() {
  document.getElementById('event-modal').style.display = 'none';
  document.getElementById('csv-modal').style.display = 'none';
}

function formatDate(dateString) {
  if (!dateString) return 'Not specified';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  alert('Error: ' + message);
}

function showSuccess(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10B981;
    color: white;
    padding: 12px 24px;
    border-radius: 6px;
    z-index: 1001;
    font-weight: 500;
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

function showLoading(message) {
  // Simple loading implementation
  const loading = document.createElement('div');
  loading.id = 'loading-overlay';
  loading.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    color: white;
    font-size: 18px;
    font-weight: 500;
  `;
  loading.textContent = message;
  document.body.appendChild(loading);
}

// Load draft on page load
window.addEventListener('load', function() {
  const draft = localStorage.getItem('gameInputDraft');
  if (draft) {
    try {
      gameData = JSON.parse(draft);
      // Populate form fields from draft
      populateFormFromDraft();
    } catch (error) {
      console.error('Error loading draft:', error);
    }
  }
});

function populateFormFromDraft() {
  // Populate game details
  if (gameData.gameDetails.date) {
    document.getElementById('game-date').value = gameData.gameDetails.date;
  }
  if (gameData.gameDetails.venue) {
    document.getElementById('venue').value = gameData.gameDetails.venue;
  }
  // ... populate other fields as needed
  
  // Render events if any
  if (gameData.events && gameData.events.length > 0) {
    renderEventsList();
  }
}
