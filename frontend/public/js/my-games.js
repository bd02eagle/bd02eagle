
// API Configuration
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUserId = null;
let assignedGames = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }

  // Set up navigation
  setupNavigation();
  
  // Get current user info from token
  getCurrentUser();
  
  // Load assigned games
  loadMyGames();
});

function setupNavigation() {
  // Set active navigation
  document.querySelector('.v1_23').style.color = 'rgba(59,130,246,1)';
  
  // Add click handlers
  document.querySelector('.v1_28').addEventListener('click', function() {
    window.location.href = '/evaluation.html';
  });
  
  document.querySelector('.v1_33').addEventListener('click', function() {
    window.location.href = '/review-management.html';
  });
}

function getCurrentUser() {
  try {
    const token = authToken.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    currentUserId = payload.sub;
  } catch (error) {
    console.error('Error parsing token:', error);
    window.location.href = '/login.html';
  }
}

async function loadMyGames() {
  try {
    showLoading();

    // Get all games
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!gamesResponse.ok) throw new Error('Failed to fetch games');
    const allGames = await gamesResponse.json();

    // Get tags for each game to determine assignments
    assignedGames = [];

    for (const game of allGames) {
      const eventsResponse = await fetch(`${API_BASE}/games/${game.id}/events`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        let totalTags = 0;
        let myTags = 0;
        let pendingTags = 0;
        let completedToday = 0;

        for (const event of events) {
          const tagsResponse = await fetch(`${API_BASE}/events/${event.id}/tags`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          if (tagsResponse.ok) {
            const tags = await tagsResponse.json();
            totalTags += tags.length;

            for (const tag of tags) {
              // Check if I have reviewed this tag
              const myActions = tag.analystActions?.filter(action => action.analystId === currentUserId) || [];
              
              if (myActions.length > 0) {
                myTags++;
                
                // Check if completed today
                const latestAction = myActions[myActions.length - 1];
                const actionDate = new Date(latestAction.createdAt);
                const today = new Date();
                
                if (actionDate.toDateString() === today.toDateString()) {
                  completedToday++;
                }
              } else if (!tag.analystActions || tag.analystActions.length === 0) {
                // Tag has no reviews yet - could be assigned to me
                pendingTags++;
              }
            }
          }
        }

        // Consider a game "assigned" if I have activity on it or there are pending tags
        if (myTags > 0 || pendingTags > 0) {
          const progress = totalTags > 0 ? (myTags / totalTags) * 100 : 0;
          const priority = getPriority(game, pendingTags, progress);

          assignedGames.push({
            ...game,
            totalTags,
            myTags,
            pendingTags,
            completedToday,
            progress,
            priority
          });
        }
      }
    }

    // Sort by priority and date
    assignedGames.sort((a, b) => {
      const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(a.date) - new Date(b.date);
    });

    renderGames();
    updateStats();

  } catch (error) {
    console.error('Error loading games:', error);
    showError('Failed to load your assigned games');
  }
}

function getPriority(game, pendingTags, progress) {
  const gameDate = new Date(game.date);
  const today = new Date();
  const daysUntilGame = Math.ceil((gameDate - today) / (1000 * 60 * 60 * 24));

  // High priority: recent games with many pending tags
  if (daysUntilGame <= 1 && pendingTags > 5) return 'high';
  if (pendingTags > 10) return 'high';

  // Medium priority: moderate workload
  if (daysUntilGame <= 3 && pendingTags > 0) return 'medium';
  if (progress < 50 && pendingTags > 0) return 'medium';

  // Low priority: everything else
  return 'low';
}

function renderGames() {
  const container = document.getElementById('games-container');

  if (assignedGames.length === 0) {
    container.innerHTML = '<div class="loading">No games assigned to you yet</div>';
    return;
  }

  container.innerHTML = assignedGames.map(game => `
    <div class="game-row">
      <div class="game-info">
        <div class="game-title">${escapeHtml(game.homeTeam.shortName)} vs. ${escapeHtml(game.awayTeam.shortName)}</div>
        <div class="game-venue">${escapeHtml(game.venue || 'TBD')}</div>
      </div>
      <div class="game-date">${formatDate(game.date)}</div>
      <div class="pending-count">${game.pendingTags}</div>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${game.progress}%"></div>
        </div>
        <div class="progress-text">${Math.round(game.progress)}% complete</div>
      </div>
      <div>
        <span class="priority-badge priority-${game.priority}">
          ${game.priority}
        </span>
      </div>
      <div class="action-buttons">
        <button class="action-btn primary" onclick="openGame('${game.id}')">
          Start Review
        </button>
        <button class="action-btn secondary" onclick="viewProgress('${game.id}')">
          Details
        </button>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const totalAssigned = assignedGames.length;
  const inProgress = assignedGames.filter(game => game.myTags > 0 && game.progress < 100).length;
  const completedToday = assignedGames.reduce((sum, game) => sum + game.completedToday, 0);

  document.getElementById('assigned-games-count').textContent = totalAssigned;
  document.getElementById('in-progress-count').textContent = inProgress;
  document.getElementById('completed-count').textContent = completedToday;
}

function openGame(gameId) {
  // Navigate to review management with game filter
  localStorage.setItem('selectedGameId', gameId);
  window.location.href = '/review-management.html';
}

function viewProgress(gameId) {
  // Navigate to evaluation workspace for this specific game
  localStorage.setItem('selectedGameId', gameId);
  window.location.href = '/evaluation.html';
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return date.toLocaleDateString();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  document.getElementById('games-container').innerHTML = '<div class="loading">Loading your assigned games...</div>';
}

function showError(message) {
  document.getElementById('games-container').innerHTML = `<div class="error">${message}</div>`;
}
