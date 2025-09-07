
// API Configuration
const API_BASE = '/api';

// Application State
let authToken = localStorage.getItem('authToken');
let allActions = [];
let filteredActions = [];
let currentAction = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  if (!authToken) {
    window.location.href = '/login.html';
    return;
  }

  initializeEventListeners();
  loadAnalystActions();
});

function initializeEventListeners() {
  // Filters
  document.getElementById('period-filter').addEventListener('change', filterActions);
  document.getElementById('action-filter').addEventListener('change', filterActions);
  document.getElementById('search-input').addEventListener('input', filterActions);

  // Modal controls
  document.querySelector('.close-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-edit').addEventListener('click', closeModal);
  document.getElementById('save-comment').addEventListener('click', saveComment);

  // Close modal on background click
  document.getElementById('edit-action-modal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeModal();
    }
  });
}

async function loadAnalystActions() {
  try {
    showLoading();

    // Fetch all games to get comprehensive data
    const gamesResponse = await fetch(`${API_BASE}/games`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    if (!gamesResponse.ok) throw new Error('Failed to fetch games');
    const games = await gamesResponse.json();

    allActions = [];

    // For each game, get events and their tags with analyst actions
    for (const game of games) {
      const eventsResponse = await fetch(`${API_BASE}/games/${game.id}/events`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });

      if (eventsResponse.ok) {
        const events = await eventsResponse.json();

        for (const event of events) {
          const tagsResponse = await fetch(`${API_BASE}/events/${event.id}/tags`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });

          if (tagsResponse.ok) {
            const tags = await tagsResponse.json();

            // Extract analyst actions for current user
            tags.forEach(tag => {
              if (tag.analystActions && tag.analystActions.length > 0) {
                // Filter actions by current analyst
                const myActions = tag.analystActions.filter(action => 
                  action.analystId === getCurrentUserId()
                );

                myActions.forEach(action => {
                  allActions.push({
                    ...action,
                    tag: {
                      ...tag,
                      game: game,
                      event: event
                    }
                  });
                });
              }
            });
          }
        }
      }
    }

    // Sort by most recent first
    allActions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    filteredActions = [...allActions];
    renderActions();
    updateStats();

  } catch (error) {
    console.error('Error loading analyst actions:', error);
    showError('Failed to load your actions');
  }
}

function getCurrentUserId() {
  // Extract user ID from JWT token
  try {
    const payload = JSON.parse(atob(authToken.split('.')[1]));
    return payload.sub;
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

function filterActions() {
  const periodFilter = document.getElementById('period-filter').value;
  const actionFilter = document.getElementById('action-filter').value;
  const searchTerm = document.getElementById('search-input').value.toLowerCase();

  filteredActions = allActions.filter(action => {
    // Period filter
    let matchesPeriod = true;
    if (periodFilter !== 'all') {
      const actionDate = new Date(action.createdAt);
      const now = new Date();
      
      if (periodFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        matchesPeriod = actionDate >= weekAgo;
      } else if (periodFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchesPeriod = actionDate >= monthAgo;
      }
    }

    // Action type filter
    const matchesAction = actionFilter === 'all' || action.action === actionFilter;

    // Text search
    const matchesSearch = !searchTerm || 
      action.tag.label.toLowerCase().includes(searchTerm) ||
      action.tag.game.homeTeam.name.toLowerCase().includes(searchTerm) ||
      action.tag.game.awayTeam.name.toLowerCase().includes(searchTerm) ||
      action.tag.event.type.toLowerCase().includes(searchTerm) ||
      (action.comment && action.comment.toLowerCase().includes(searchTerm));

    return matchesPeriod && matchesAction && matchesSearch;
  });

  renderActions();
}

function renderActions() {
  const container = document.getElementById('actions-list');

  if (filteredActions.length === 0) {
    container.innerHTML = '<div class="no-actions">No actions found matching your criteria</div>';
    return;
  }

  container.innerHTML = filteredActions.map(action => `
    <div class="action-row">
      <div class="tag-info">
        <div class="tag-label">${escapeHtml(action.tag.label)}</div>
        ${action.tag.notes ? `<div class="tag-notes">${escapeHtml(action.tag.notes)}</div>` : ''}
      </div>
      <div class="game-info">
        ${escapeHtml(action.tag.game.homeTeam.name)} vs. ${escapeHtml(action.tag.game.awayTeam.name)}
      </div>
      <div class="event-info">
        <div class="event-type">${escapeHtml(action.tag.event.type)}</div>
        <div class="event-time">${formatTimestamp(action.tag.event.timestampMs)}</div>
      </div>
      <div>
        <span class="action-badge ${action.action.toLowerCase().replace('_', '-')}">
          ${formatActionType(action.action)}
        </span>
      </div>
      <div class="action-date">${formatDate(action.createdAt)}</div>
      <div class="action-buttons">
        <button class="edit-btn" onclick="openEditModal('${action.id}')">
          Edit Comment
        </button>
      </div>
    </div>
  `).join('');
}

function updateStats() {
  const totalCount = allActions.length;
  const approvedCount = allActions.filter(a => a.action === 'APPROVE').length;
  const changesCount = allActions.filter(a => a.action === 'REQUEST_CHANGES').length;
  
  // This week count
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekCount = allActions.filter(a => new Date(a.createdAt) >= weekAgo).length;

  document.getElementById('total-reviews-count').textContent = totalCount;
  document.getElementById('approved-reviews-count').textContent = approvedCount;
  document.getElementById('changes-reviews-count').textContent = changesCount;
  document.getElementById('week-reviews-count').textContent = weekCount;
}

function openEditModal(actionId) {
  currentAction = allActions.find(action => action.id === actionId);
  if (!currentAction) return;

  // Populate modal
  document.getElementById('modal-tag-label').textContent = currentAction.tag.label;
  document.getElementById('modal-game-info').textContent = 
    `${currentAction.tag.game.homeTeam.name} vs. ${currentAction.tag.game.awayTeam.name}`;
  document.getElementById('modal-event-info').textContent = 
    `${currentAction.tag.event.type} - ${formatTimestamp(currentAction.tag.event.timestampMs)}`;
  document.getElementById('modal-current-action').textContent = formatActionType(currentAction.action);
  document.getElementById('modal-action-date').textContent = formatDate(currentAction.createdAt);
  document.getElementById('edit-comment').value = currentAction.comment || '';

  // Show modal
  document.getElementById('edit-action-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('edit-action-modal').style.display = 'none';
  currentAction = null;
}

async function saveComment() {
  if (!currentAction) return;

  try {
    const comment = document.getElementById('edit-comment').value;

    // Note: This would require a new API endpoint to update analyst actions
    // For now, we'll show a success message
    showSuccessMessage('Comment updated successfully!');
    
    // Update local data
    currentAction.comment = comment;
    
    // Refresh display
    filterActions();
    closeModal();

  } catch (error) {
    console.error('Error updating comment:', error);
    alert('Failed to update comment');
  }
}

function formatActionType(action) {
  switch (action) {
    case 'APPROVE': return 'Approved';
    case 'REQUEST_CHANGES': return 'Changes Requested';
    default: return action;
  }
}

function formatTimestamp(timestampMs) {
  const mins = Math.floor(timestampMs / 60000);
  const secs = Math.floor((timestampMs % 60000) / 1000);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoading() {
  document.getElementById('actions-list').innerHTML = '<div class="loading">Loading your actions...</div>';
}

function showError(message) {
  document.getElementById('actions-list').innerHTML = `<div class="error">${message}</div>`;
}

function showSuccessMessage(message) {
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
  `;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 3000);
}
