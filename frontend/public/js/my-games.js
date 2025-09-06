
// API Configuration
const API_BASE = '/api';
let authToken = localStorage.getItem('authToken');
let currentUserId = null;
let myGameAssignments = [];

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
  
  // Load my game assignments
  loadMyGameAssignments();
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

async function loadMyGameAssignments() {
  try {
    showLoading();

    const response = await fetch(`${API_BASE}/assignments/my-games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        return;
      }
      throw new Error('Failed to fetch assignments');
    }

    myGameAssignments = await response.json();
    renderGames();
    updateStats();

  } catch (error) {
    console.error('Error loading game assignments:', error);
    showError('Failed to load your assigned games');
  }
}

function renderGames() {
  const container = document.getElementById('games-container');

  if (myGameAssignments.length === 0) {
    container.innerHTML = '<div class="loading">No games assigned to you yet</div>';
    return;
  }

  container.innerHTML = myGameAssignments.map(assignment => {
    const game = assignment.game;
    const pendingTags = assignment.totalTags - assignment.completedTags;
    
    return `
      <div class="game-row">
        <div class="game-info">
          <div class="game-title">${escapeHtml(game.homeTeam.shortName)} vs. ${escapeHtml(game.awayTeam.shortName)}</div>
          <div class="game-venue">${escapeHtml(game.venue || 'TBD')}</div>
        </div>
        <div class="game-date">${formatDate(game.date)}</div>
        <div class="pending-count">${pendingTags}</div>
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${assignment.progress}%"></div>
          </div>
          <div class="progress-text">${assignment.progress}% complete</div>
        </div>
        <div>
          <span class="priority-badge priority-${assignment.priority}">
            ${assignment.priority}
          </span>
        </div>
        <div class="action-buttons">
          <button class="action-btn primary" onclick="viewGameTags('${game.id}', '${escapeHtml(game.homeTeam.shortName)} vs. ${escapeHtml(game.awayTeam.shortName)}')">
            Review Tags
          </button>
          <button class="action-btn secondary" onclick="openGame('${game.id}')">
            Start Review
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  const totalAssigned = myGameAssignments.length;
  const inProgress = myGameAssignments.filter(assignment => 
    assignment.completedTags > 0 && assignment.progress < 100
  ).length;
  
  // Count tags completed today
  const today = new Date().toDateString();
  let completedToday = 0;
  // This would need to be calculated from actual completion dates in a real implementation
  
  document.getElementById('assigned-games-count').textContent = totalAssigned;
  document.getElementById('in-progress-count').textContent = inProgress;
  document.getElementById('completed-count').textContent = completedToday;
}

async function viewGameTags(gameId, gameTitle) {
  try {
    showTagsLoading(gameTitle);

    const response = await fetch(`${API_BASE}/assignments/games/${gameId}/tags`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch tags for game');
    }

    const tags = await response.json();
    displayGameTags(gameTitle, tags);

  } catch (error) {
    console.error('Error loading game tags:', error);
    showError('Failed to load tags for this game');
  }
}

function showTagsLoading(gameTitle) {
  const container = document.getElementById('games-container');
  container.innerHTML = `
    <div class="tags-view">
      <div class="tags-header">
        <button class="back-btn" onclick="loadMyGameAssignments()">← Back to My Games</button>
        <h3>Tags for ${gameTitle}</h3>
      </div>
      <div class="loading">Loading tags...</div>
    </div>
  `;
}

function displayGameTags(gameTitle, tags) {
  const container = document.getElementById('games-container');
  
  if (tags.length === 0) {
    container.innerHTML = `
      <div class="tags-view">
        <div class="tags-header">
          <button class="back-btn" onclick="loadMyGameAssignments()">← Back to My Games</button>
          <h3>Tags for ${gameTitle}</h3>
        </div>
        <div class="no-tags">No tags found for this game</div>
      </div>
    `;
    return;
  }

  const tagsHtml = tags.map(tag => {
    const hasMyAction = tag.analystActions.some(action => action.analyst.id === currentUserId);
    const statusClass = hasMyAction ? 'reviewed' : 'pending';
    const statusText = hasMyAction ? 'Reviewed' : 'Pending Review';
    
    return `
      <div class="tag-item ${statusClass}">
        <div class="tag-header">
          <span class="tag-label">${escapeHtml(tag.label)}</span>
          <span class="tag-status ${statusClass}">${statusText}</span>
        </div>
        <div class="tag-details">
          <div class="tag-time">Event Type: ${escapeHtml(tag.event.type)} | Time: ${formatTimestamp(tag.event.timestampMs)}</div>
          ${tag.notes ? `<div class="tag-notes">${escapeHtml(tag.notes)}</div>` : ''}
          <div class="tag-creator">Created by: ${escapeHtml(tag.createdBy.firstName || tag.createdBy.email)}</div>
        </div>
        <div class="tag-actions">
          <button class="action-btn primary" onclick="reviewTag('${tag.id}')">
            ${hasMyAction ? 'Update Review' : 'Review Tag'}
          </button>
          <button class="action-btn secondary" onclick="viewVideo('${tag.event.videoUrl}')">
            View Video
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="tags-view">
      <div class="tags-header">
        <button class="back-btn" onclick="loadMyGameAssignments()">← Back to My Games</button>
        <h3>Tags for ${gameTitle}</h3>
        <div class="tags-summary">${tags.length} total tags</div>
      </div>
      <div class="tags-list">
        ${tagsHtml}
      </div>
    </div>
  `;
}

function reviewTag(tagId) {
  // Navigate to review management with specific tag
  localStorage.setItem('selectedTagId', tagId);
  window.location.href = '/review-management.html';
}

function viewVideo(videoUrl) {
  // Open video in new tab
  window.open(videoUrl, '_blank');
}

function openGame(gameId) {
  // Navigate to review management with game filter
  localStorage.setItem('selectedGameId', gameId);
  window.location.href = '/review-management.html';
}

function formatTimestamp(timestampMs) {
  const minutes = Math.floor(timestampMs / 60000);
  const seconds = Math.floor((timestampMs % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
