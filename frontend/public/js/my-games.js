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
  getCurrentUser().then(user => {
    if (user) {
      updateUserDisplay();
    }
  });

  // Load my game assignments
  loadMyGameAssignments();
});

function setupNavigation() {
  // Add click handlers for navigation items
  const navItems = document.querySelectorAll('.v1_505 span[onclick]');
  navItems.forEach(item => {
    // Navigation items already have onclick handlers in HTML
    console.log('Navigation item:', item.textContent);
  });

  // Add logout handler
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userRole');
        window.location.href = '/login.html';
      }
    });
  }
}

async function getCurrentUser() {
  try {
    // Extract user ID from JWT token
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    currentUserId = payload.sub;

    // You could also make an API call to get full user details if needed
    // For now, we'll use the role from localStorage
    const userRole = localStorage.getItem('userRole');

    return {
      id: currentUserId,
      role: userRole
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

function updateUserDisplay() {
  // Update user name in the profile section
  const userNameElement = document.getElementById('user-name-display');

  if (userNameElement) {
    const userRole = localStorage.getItem('userRole');
    const userName = getUserDisplayName(userRole, currentUserId);
    userNameElement.textContent = userName;
    console.log('Updated user display to:', userName);
  }
}

function getUserDisplayName(role, userId) {
  // Extract the user number from the user ID or create a display name
  // This is a simple approach - you might want to fetch actual user names from an API

  if (role === 'ANALYST') {
    // Try to determine which analyst based on known IDs from seed data
    if (userId === '6ca4cb13-9fc2-4b4a-9b45-15b796e1793a') {
      return 'Ref Analyst 1';
    } else if (userId === '7da5dc14-8fd3-4c5b-8c46-16c897f2804b') {
      return 'Ref Analyst 2';
    } else {
      // Fallback for unknown analyst IDs
      return 'Ref Analyst';
    }
  } else if (role === 'CHARTER') {
    return 'Charter User';
  } else if (role === 'ADMIN') {
    return 'Admin User';
  }

  return 'User';
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
          <div class="game-title">${escapeHtml(game.homeTeam.name || game.homeTeam.shortName)} vs. ${escapeHtml(game.awayTeam.name || game.awayTeam.shortName)}</div>
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
            Start Evaluation
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
  // Prevent multiple rapid clicks
  if (window.navigatingToGame) {
    console.log('Navigation already in progress, ignoring click');
    return;
  }

  window.navigatingToGame = true;

  // Navigate to Initial Evaluation Workspace with game context
  console.log('Setting selectedGameId:', gameId);

  // Use localStorage instead of sessionStorage for better persistence
  localStorage.setItem('selectedGameId', gameId);

  // Also pass in URL for immediate access
  window.location.href = `/workspace.html?gameId=${gameId}`;
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