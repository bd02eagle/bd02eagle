// API Configuration
const API_BASE = 'http://localhost:3000/api';
let authToken = localStorage.getItem('authToken');

// Main app functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        // For demo purposes, create a mock token
        localStorage.setItem('authToken', 'demo-token');
    }

    // Initialize navigation
    initNavigation();

    // Initialize the app
    init();
});

function initNavigation() {
    // Add click handlers to navigation items
    const navItems = [
        { selector: '.v1_44, .v1_21', url: '/' },
        { selector: '.v1_23', url: '/review-management.html' },
        { selector: '.v1_28', url: '/exports.html' },
        { selector: '.v1_33', url: '/settings.html' }
    ];

    navItems.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                if (item.url.startsWith('/') && !item.url.includes('.html')) {
                    // Root path, redirect to evaluation
                    window.location.href = '/evaluation.html';
                } else if (item.url === '/exports.html' || item.url === '/settings.html') {
                    // Placeholder pages
                    alert(`${item.url.replace('/', '').replace('.html', '')} feature coming soon!`);
                } else {
                    window.location.href = item.url;
                }
            });
        });
    });
}

function init() {
    console.log('App initialized');

    // Set active navigation state based on current page
    setActiveNavigation();
}

function setActiveNavigation() {
    const currentPage = window.location.pathname;

    // Reset all nav items
    document.querySelectorAll('.v1_23, .v1_28, .v1_33').forEach(item => {
        item.style.color = 'rgba(156,163,175,1)';
    });

    // Set active state
    if (currentPage.includes('review-management')) {
        const reviewNav = document.querySelector('.v1_23');
        if (reviewNav) reviewNav.style.color = 'rgba(59,130,246,1)';
    } else if (currentPage.includes('evaluation') || currentPage === '/') {
        // Evaluation workspace is already styled as active
    }
}

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