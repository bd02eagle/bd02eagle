
// API Configuration
const API_BASE = 'http://localhost:3000/api';
let authToken = localStorage.getItem('authToken');

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
  if (!authToken) {
    await login();
  }
  
  if (authToken) {
    await loadGameData();
  }
});

// Simple login function (for demo)
async function login() {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'analyst1@refintel.com',
        password: 'analyst123'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      authToken = data.token;
      localStorage.setItem('authToken', authToken);
      console.log('Logged in successfully');
    } else {
      console.error('Login failed');
    }
  } catch (error) {
    console.error('Login error:', error);
  }
}

// Load game data and events
async function loadGameData() {
  try {
    // Get games
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!gamesResponse.ok) {
      throw new Error('Failed to fetch games');
    }
    
    const games = await gamesResponse.json();
    
    if (games.length > 0) {
      // Load events for the first game (SC vs TX)
      const game = games.find(g => g.homeTeam === 'Texas' && g.awayTeam === 'SC') || games[0];
      await loadEvents(game.id);
    }
  } catch (error) {
    console.error('Error loading games:', error);
    displayError('Failed to load game data');
  }
}

// Load events for a specific game
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
    
    const events = await eventsResponse.json();
    
    // Load tags for each event
    const eventsWithTags = await Promise.all(
      events.map(async (event) => {
        const tagsResponse = await fetch(`${API_BASE}/events/${event.id}/tags`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        
        const tags = tagsResponse.ok ? await tagsResponse.json() : [];
        return { ...event, tags };
      })
    );
    
    displayEvents(eventsWithTags);
  } catch (error) {
    console.error('Error loading events:', error);
    displayError('Failed to load events');
  }
}

// Display events in the UI
function displayEvents(events) {
  const eventList = document.getElementById('event-list');
  
  if (events.length === 0) {
    eventList.innerHTML = '<p style="text-align: center; color: #6B7280; padding: 40px;">No events found</p>';
    return;
  }
  
  eventList.innerHTML = events.map(event => {
    const hasApprovedTags = event.tags.some(tag => 
      tag.analystActions && tag.analystActions.some(action => action.action === 'APPROVE')
    );
    const hasRequestedChanges = event.tags.some(tag => 
      tag.analystActions && tag.analystActions.some(action => action.action === 'REQUEST_CHANGES')
    );
    
    let status = 'pending';
    let statusText = 'Pending Review';
    
    if (hasRequestedChanges) {
      status = 'changes-requested';
      statusText = 'Changes Requested';
    } else if (hasApprovedTags) {
      status = 'approved';
      statusText = 'Approved';
    }
    
    return `
      <div class="event-item" onclick="openEvaluationWorkspace('${event.id}')">
        <div class="event-info">
          <h3>${event.type} - ${formatTimestamp(event.timestampMs)}</h3>
          <p>${event.tags.length} tag(s) • ${event.tags.map(tag => tag.label).join(', ')}</p>
        </div>
        <div class="event-status status-${status}">
          ${statusText}
        </div>
      </div>
    `;
  }).join('');
}

// Navigate to evaluation workspace
function openEvaluationWorkspace(eventId) {
  window.location.href = `/evaluation?eventId=${eventId}`;
}

// Helper function to format timestamp
function formatTimestamp(timestampMs) {
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// Display error message
function displayError(message) {
  const eventList = document.getElementById('event-list');
  eventList.innerHTML = `<p style="text-align: center; color: #EF4444; padding: 40px;">${message}</p>`;
}
