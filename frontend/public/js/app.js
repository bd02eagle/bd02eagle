// API Configuration - Use relative URL to avoid CORS issues  
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');

// Main app functionality
document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const authToken = localStorage.getItem('authToken');
    if (!authToken) {
        // Redirect to login page
        window.location.href = '/login.html';
        return;
    }

    // Verify token is still valid
    verifyToken(authToken).then(valid => {
        if (!valid) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            window.location.href = '/login.html';
            return;
        }
        
        // Initialize navigation
        initNavigation();

        // Initialize the app
        init();
    }).catch(error => {
        console.error('Token verification failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
    });
});

async function verifyToken(token) {
    try {
        const response = await fetch(`${API_BASE}/games`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        return response.ok;
    } catch (error) {
        console.error('Token verification error:', error);
        return false;
    }
}

function initNavigation() {
    // Add click handlers to navigation items
    const navItems = [
        { selector: '.v1_23', url: '/my-games.html' },
        { selector: '.v1_44, .v1_21, .v1_28', url: '/evaluation.html' },
        { selector: '.v1_33', url: '/review-management.html' },
        { selector: '.v1_516', url: '/exports.html' }
    ];

    navItems.forEach(item => {
        const elements = document.querySelectorAll(item.selector);
        elements.forEach(element => {
            element.style.cursor = 'pointer';
            element.addEventListener('click', () => {
                if (item.url === '/exports.html') {
                    // Placeholder page
                    alert('Exports feature coming soon!');
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
    
    // Add logout functionality to user profile
    addLogoutHandler();
    
    // Load game data for evaluation workspace
    if (window.location.pathname.includes('evaluation') || window.location.pathname === '/') {
        loadGameData();
    }
}

function addLogoutHandler() {
    const userProfile = document.querySelector('.v1_37');
    if (userProfile) {
        userProfile.style.cursor = 'pointer';
        userProfile.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                window.location.href = '/login.html';
            }
        });
    }
}

function setActiveNavigation() {
    const currentPage = window.location.pathname;

    // Reset all nav items
    document.querySelectorAll('.v1_23, .v1_28, .v1_33, .v1_44').forEach(item => {
        item.style.color = 'rgba(156,163,175,1)';
    });

    // Set active state
    if (currentPage.includes('my-games')) {
        const myGamesNav = document.querySelector('.v1_23');
        if (myGamesNav) myGamesNav.style.color = 'rgba(59,130,246,1)';
    } else if (currentPage.includes('review-management')) {
        const reviewNav = document.querySelector('.v1_33');
        if (reviewNav) reviewNav.style.color = 'rgba(59,130,246,1)';
    } else if (currentPage.includes('evaluation') || currentPage === '/') {
        const evalNav = document.querySelector('.v1_44');
        if (evalNav) evalNav.style.color = 'rgba(59,130,246,1)';
    }
}

// Remove auto-login function - users should login through the login page

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
    console.log('Loaded events:', events);
    
    // Here you can update the UI with the events
    // For now, just log them
    return events;
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

// Load game data and events
async function loadGameData() {
  try {
    // Check if user is authenticated
    if (!authToken) {
      displayError('Please login to view games');
      return;
    }

    // Get games
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!gamesResponse.ok) {
      console.error('Games request failed:', gamesResponse.status, gamesResponse.statusText);
      
      // If unauthorized, redirect to login
      if (gamesResponse.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
        return;
      }
      
      throw new Error('Failed to fetch games');
    }

    const games = await gamesResponse.json();
    console.log('Loaded games:', games);

    if (games.length > 0) {
      // Load events for the most recent game
      const game = games[0];
      
      console.log('Selected game:', game);
      await loadEvents(game.id);
    } else {
      displayError('No games found');
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